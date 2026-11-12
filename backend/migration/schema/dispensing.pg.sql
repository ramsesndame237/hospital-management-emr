-- Dispensation en pharmacie : le pharmacien délivre une ordonnance (en une ou plusieurs fois), le stock sort lot par lot (premier périmé, premier sorti).
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS pharmacy et clinical (clés étrangères vers les ordonnances et les lots).

CREATE SEQUENCE IF NOT EXISTS pharmacy_dispensation_number_seq;

-- Le grand livre du stock connaît désormais la sortie « délivrance ». Les contraintes d'origine (type et signe du mouvement) sont remplacées.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'pharmacy_stock_movements'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%ADJUSTMENT_OUT%' LOOP
    EXECUTE format('ALTER TABLE pharmacy_stock_movements DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE pharmacy_stock_movements ADD CONSTRAINT ck_pharmacy_movements_type CHECK (type IN ('RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DISPENSE'));
ALTER TABLE pharmacy_stock_movements ADD CONSTRAINT ck_pharmacy_movements_sign CHECK ((type IN ('ADJUSTMENT_OUT', 'DISPENSE')) = (delta < 0));

-- Une dispensation : un pharmacien délivre tout ou partie d'une ordonnance. Écrite une fois pour toutes (le stock sort dans la même transaction).
CREATE TABLE IF NOT EXISTS pharmacy_dispensations (
  id                   uuid PRIMARY KEY,
  dispensation_number  text NOT NULL CHECK (dispensation_number ~ '^DSP-[0-9]{7,12}$'),
  prescription_id      uuid NOT NULL REFERENCES clinical_prescriptions (id),
  patient_id           uuid NOT NULL REFERENCES patients (id),
  dispensed_by         uuid NOT NULL,
  dispensed_at         timestamptz NOT NULL,
  notes                text CHECK (notes IS NULL OR length(notes) BETWEEN 1 AND 200),
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pharmacy_dispensations_number ON pharmacy_dispensations (dispensation_number);
CREATE INDEX IF NOT EXISTS ix_pharmacy_dispensations_prescription ON pharmacy_dispensations (prescription_id, dispensed_at);
CREATE INDEX IF NOT EXISTS ix_pharmacy_dispensations_at ON pharmacy_dispensations (dispensed_at DESC);

-- Une ligne par lot prélevé : « position » est celle de la ligne de l'ordonnance, « batch_id » le lot d'où sort la quantité.
CREATE TABLE IF NOT EXISTS pharmacy_dispensation_lines (
  dispensation_id        uuid NOT NULL REFERENCES pharmacy_dispensations (id),
  position               smallint NOT NULL CHECK (position >= 0),
  prescription_position  smallint NOT NULL CHECK (prescription_position >= 0),
  drug_id                uuid NOT NULL REFERENCES pharmacy_drugs (id),
  batch_id               uuid NOT NULL REFERENCES pharmacy_batches (id),
  batch_number           text NOT NULL,
  expiry_date            date NOT NULL,
  quantity               integer NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  -- Motif du pharmacien qui délivre malgré une allergie connue que le médecin n'avait pas levée (allergie saisie après l'ordonnance).
  allergy_override       text CHECK (allergy_override IS NULL OR length(allergy_override) BETWEEN 3 AND 200),
  PRIMARY KEY (dispensation_id, position)
);
CREATE INDEX IF NOT EXISTS ix_pharmacy_dispensation_lines_batch ON pharmacy_dispensation_lines (batch_id);

-- Ajout seul ; une ligne ne s'écrit que pour une ordonnance en cours, de la bonne personne, et sans dépasser la quantité prescrite — même si deux postes
-- délivrent en même temps (le verrou partagé sur l'ordonnance fait attendre une annulation concurrente, et la somme est relue sous le verrou de la transaction).
CREATE OR REPLACE FUNCTION pharmacy_dispensations_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pharmacy_dispensations_append_only ON pharmacy_dispensations;
CREATE TRIGGER trg_pharmacy_dispensations_append_only BEFORE UPDATE OR DELETE ON pharmacy_dispensations FOR EACH ROW EXECUTE FUNCTION pharmacy_dispensations_guard();
DROP TRIGGER IF EXISTS trg_pharmacy_dispensation_lines_append_only ON pharmacy_dispensation_lines;
CREATE TRIGGER trg_pharmacy_dispensation_lines_append_only BEFORE UPDATE OR DELETE ON pharmacy_dispensation_lines FOR EACH ROW EXECUTE FUNCTION pharmacy_dispensations_guard();

CREATE OR REPLACE FUNCTION pharmacy_dispensation_lines_check() RETURNS trigger AS $$
DECLARE
  rx_id uuid;
  rx_status text;
  rx_patient uuid;
  dsp_patient uuid;
  prescribed integer;
  already integer;
BEGIN
  SELECT prescription_id, patient_id INTO rx_id, dsp_patient FROM pharmacy_dispensations WHERE id = NEW.dispensation_id;
  SELECT status, patient_id INTO rx_status, rx_patient FROM clinical_prescriptions WHERE id = rx_id FOR SHARE;
  IF rx_status IS DISTINCT FROM 'ISSUED' THEN
    RAISE EXCEPTION 'pharmacy_dispensation_lines : seule une ordonnance en cours se délivre' USING ERRCODE = 'restrict_violation';
  END IF;
  IF rx_patient IS DISTINCT FROM dsp_patient THEN
    RAISE EXCEPTION 'pharmacy_dispensation_lines : le patient de la dispensation n''est pas celui de l''ordonnance' USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT quantity INTO prescribed FROM clinical_prescription_lines WHERE prescription_id = rx_id AND position = NEW.prescription_position AND drug_id = NEW.drug_id;
  IF prescribed IS NULL THEN
    RAISE EXCEPTION 'pharmacy_dispensation_lines : cette ligne n''existe pas sur l''ordonnance' USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT COALESCE(SUM(l.quantity), 0) INTO already FROM pharmacy_dispensation_lines l JOIN pharmacy_dispensations d ON d.id = l.dispensation_id
   WHERE d.prescription_id = rx_id AND l.prescription_position = NEW.prescription_position;
  IF already + NEW.quantity > prescribed THEN
    RAISE EXCEPTION 'pharmacy_dispensation_lines : plus que la quantité prescrite (% sur %)', already + NEW.quantity, prescribed USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pharmacy_dispensation_lines_check ON pharmacy_dispensation_lines;
CREATE TRIGGER trg_pharmacy_dispensation_lines_check BEFORE INSERT ON pharmacy_dispensation_lines FOR EACH ROW EXECUTE FUNCTION pharmacy_dispensation_lines_check();

-- Une ordonnance déjà délivrée (même en partie) ne s'annule plus : ce qui est sorti du stock ne se rattrape pas par une annulation.
CREATE OR REPLACE FUNCTION clinical_prescriptions_no_cancel_when_dispensed() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status = 'ISSUED' THEN
    -- Verrou d'abord : une délivrance en cours (verrou partagé) finit avant qu'on regarde si l'ordonnance a été délivrée.
    PERFORM 1 FROM clinical_prescriptions WHERE id = NEW.id FOR UPDATE;
  END IF;
  IF NEW.status = 'CANCELLED' AND OLD.status = 'ISSUED' AND EXISTS (SELECT 1 FROM pharmacy_dispensations WHERE prescription_id = NEW.id) THEN
    RAISE EXCEPTION 'clinical_prescriptions : une ordonnance déjà délivrée ne s''annule pas' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_prescriptions_no_cancel_dispensed ON clinical_prescriptions;
CREATE TRIGGER trg_clinical_prescriptions_no_cancel_dispensed BEFORE UPDATE ON clinical_prescriptions FOR EACH ROW EXECUTE FUNCTION clinical_prescriptions_no_cancel_when_dispensed();

-- Droits : le pharmacien voit la file des ordonnances et délivre.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['pharmacy.dispensing:read', 'pharmacy.dispensing:dispense']) AS p ORDER BY p)
 WHERE code = 'PHARMACIST';
