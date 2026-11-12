-- Module Clinique (tranche 1) : consultation (constantes, note SOAP, diagnostics, signature, addenda) et allergies du patient.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS iam, administration, patients, admissions (clés étrangères) ; les
-- permissions du module sont ajoutées en fin de script, après que iam.pg.sql a recréé les rôles système.

CREATE SEQUENCE IF NOT EXISTS clinical_encounter_number_seq;

-- Consultation : un médecin voit un patient dans un service, le plus souvent à l'occasion d'une admission. Une fois signée, ou annulée, elle ne
-- change plus (le déclencheur ci-dessous le garantit, quoi que fasse l'application) : les corrections passent par des addenda.
CREATE TABLE IF NOT EXISTS clinical_encounters (
  id                   uuid PRIMARY KEY,
  encounter_number     text NOT NULL CHECK (encounter_number ~ '^CON-[0-9]{7,12}$'),
  patient_id           uuid NOT NULL REFERENCES patients (id),
  service_id           uuid NOT NULL REFERENCES administration_structure_nodes (id),
  admission_id         uuid REFERENCES admissions (id),
  doctor_id            uuid NOT NULL,
  status               text NOT NULL CHECK (status IN ('IN_PROGRESS', 'SIGNED', 'CANCELLED')),
  started_at           timestamptz NOT NULL,
  temperature          numeric(4, 1) CHECK (temperature IS NULL OR temperature BETWEEN 30 AND 45),
  pulse                smallint CHECK (pulse IS NULL OR pulse BETWEEN 20 AND 300),
  systolic             smallint CHECK (systolic IS NULL OR systolic BETWEEN 40 AND 300),
  diastolic            smallint CHECK (diastolic IS NULL OR diastolic BETWEEN 20 AND 200),
  respiratory_rate     smallint CHECK (respiratory_rate IS NULL OR respiratory_rate BETWEEN 4 AND 80),
  spo2                 smallint CHECK (spo2 IS NULL OR spo2 BETWEEN 50 AND 100),
  weight_kg            numeric(5, 1) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0.3 AND 500),
  height_cm            numeric(4, 1) CHECK (height_cm IS NULL OR height_cm BETWEEN 20 AND 260),
  vitals_by            uuid,
  vitals_at            timestamptz,
  chief_complaint      text CHECK (chief_complaint IS NULL OR length(chief_complaint) <= 500),
  history              text CHECK (history IS NULL OR length(history) <= 2000),
  examination          text CHECK (examination IS NULL OR length(examination) <= 2000),
  assessment           text CHECK (assessment IS NULL OR length(assessment) <= 2000),
  plan                 text CHECK (plan IS NULL OR length(plan) <= 2000),
  signed_by            uuid,
  signed_at            timestamptz,
  cancelled_by         uuid,
  cancelled_at         timestamptz,
  cancellation_reason  text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) BETWEEN 1 AND 200),
  version              integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (diastolic IS NULL OR systolic IS NULL OR diastolic < systolic),
  CHECK ((vitals_by IS NULL) = (vitals_at IS NULL)),
  CHECK ((status = 'SIGNED') = (signed_at IS NOT NULL AND signed_by IS NOT NULL)),
  CHECK (signed_by IS NULL OR signed_by = doctor_id),
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clinical_encounters_number ON clinical_encounters (encounter_number);
-- Une seule consultation en cours par admission : deux médecins n'ouvrent pas la même en même temps.
CREATE UNIQUE INDEX IF NOT EXISTS ux_clinical_encounters_open_admission ON clinical_encounters (admission_id) WHERE status = 'IN_PROGRESS' AND admission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_clinical_encounters_patient ON clinical_encounters (patient_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_clinical_encounters_service ON clinical_encounters (service_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_clinical_encounters_doctor ON clinical_encounters (doctor_id, started_at DESC);

-- Diagnostics d'une consultation (code CIM-10, un seul principal) : remplacés d'un bloc tant que la consultation est en cours.
CREATE TABLE IF NOT EXISTS clinical_encounter_diagnoses (
  encounter_id  uuid NOT NULL REFERENCES clinical_encounters (id),
  position      smallint NOT NULL CHECK (position >= 0),
  code          text NOT NULL CHECK (code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$'),
  label         text NOT NULL CHECK (length(label) BETWEEN 1 AND 150),
  kind          text NOT NULL CHECK (kind IN ('PRIMARY', 'SECONDARY')),
  certainty     text NOT NULL CHECK (certainty IN ('PROVISIONAL', 'CONFIRMED')),
  PRIMARY KEY (encounter_id, position),
  UNIQUE (encounter_id, code)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clinical_diagnoses_primary ON clinical_encounter_diagnoses (encounter_id) WHERE kind = 'PRIMARY';

-- Addenda : corrections et compléments d'une consultation signée. Ajout seul.
CREATE TABLE IF NOT EXISTS clinical_encounter_addenda (
  encounter_id  uuid NOT NULL REFERENCES clinical_encounters (id),
  seq           integer NOT NULL CHECK (seq >= 1),
  text          text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  by            uuid NOT NULL,
  at            timestamptz NOT NULL,
  PRIMARY KEY (encounter_id, seq)
);

-- Allergies du patient : rien n'est supprimé, une saisie erronée est déclarée telle (avec son motif).
CREATE TABLE IF NOT EXISTS clinical_allergies (
  id            uuid PRIMARY KEY,
  patient_id    uuid NOT NULL REFERENCES patients (id),
  substance     text NOT NULL CHECK (length(substance) BETWEEN 1 AND 100),
  reaction      text CHECK (reaction IS NULL OR length(reaction) BETWEEN 1 AND 200),
  severity      text NOT NULL CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE')),
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENTERED_IN_ERROR')),
  recorded_by   uuid NOT NULL,
  recorded_at   timestamptz NOT NULL,
  voided_by     uuid,
  voided_at     timestamptz,
  void_reason   text CHECK (void_reason IS NULL OR length(void_reason) BETWEEN 1 AND 200),
  version       integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'ENTERED_IN_ERROR') = (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_clinical_allergies_patient ON clinical_allergies (patient_id, recorded_at DESC);

-- Verrous du dossier clinique, en base : une consultation signée ou annulée ne bouge plus, ses diagnostics non plus, un addendum ne se
-- pose que sur une consultation signée, rien de clinique ne s'efface.
CREATE OR REPLACE FUNCTION clinical_encounter_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'clinical_encounters : suppression interdite' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'clinical_encounters : une consultation % ne peut plus être modifiée', OLD.status USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_encounter_lock ON clinical_encounters;
CREATE TRIGGER trg_clinical_encounter_lock BEFORE UPDATE OR DELETE ON clinical_encounters FOR EACH ROW EXECUTE FUNCTION clinical_encounter_lock();

CREATE OR REPLACE FUNCTION clinical_diagnoses_lock() RETURNS trigger AS $$
DECLARE parent text;
BEGIN
  SELECT status INTO parent FROM clinical_encounters WHERE id = COALESCE(NEW.encounter_id, OLD.encounter_id);
  IF parent IS DISTINCT FROM 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'clinical_encounter_diagnoses : la consultation n''est plus en cours' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_diagnoses_lock ON clinical_encounter_diagnoses;
CREATE TRIGGER trg_clinical_diagnoses_lock BEFORE INSERT OR UPDATE OR DELETE ON clinical_encounter_diagnoses FOR EACH ROW EXECUTE FUNCTION clinical_diagnoses_lock();

CREATE OR REPLACE FUNCTION clinical_addenda_guard() RETURNS trigger AS $$
DECLARE parent text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'clinical_encounter_addenda est en ajout seul : % interdit', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT status INTO parent FROM clinical_encounters WHERE id = NEW.encounter_id;
  IF parent IS DISTINCT FROM 'SIGNED' THEN
    RAISE EXCEPTION 'clinical_encounter_addenda : seule une consultation signée reçoit un addendum' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_addenda_guard ON clinical_encounter_addenda;
CREATE TRIGGER trg_clinical_addenda_guard BEFORE INSERT OR UPDATE OR DELETE ON clinical_encounter_addenda FOR EACH ROW EXECUTE FUNCTION clinical_addenda_guard();
DROP TRIGGER IF EXISTS trg_clinical_addenda_no_truncate ON clinical_encounter_addenda;
CREATE TRIGGER trg_clinical_addenda_no_truncate BEFORE TRUNCATE ON clinical_encounter_addenda FOR EACH STATEMENT EXECUTE FUNCTION clinical_addenda_guard();

CREATE OR REPLACE FUNCTION clinical_allergies_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'clinical_allergies : suppression interdite (déclarez la saisie erronée)' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_allergies_no_delete ON clinical_allergies;
CREATE TRIGGER trg_clinical_allergies_no_delete BEFORE DELETE ON clinical_allergies FOR EACH ROW EXECUTE FUNCTION clinical_allergies_no_delete();

-- Droits. Le médecin conduit la consultation dans ses services ; le médecin et l'infirmier relèvent les constantes et tiennent la liste des allergies
-- du patient ; le pharmacien lit les allergies pour vérifier une ordonnance. L'administrateur système n'a aucun droit sur le dossier clinique.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY[
         'clinical.encounters:read:department', 'clinical.encounters:write:department', 'clinical.vitals:record:department', 'clinical.allergies:read', 'clinical.allergies:write'
       ]) AS p ORDER BY p)
 WHERE code = 'DOCTOR';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['clinical.encounters:read:department', 'clinical.vitals:record:department', 'clinical.allergies:read', 'clinical.allergies:write']) AS p ORDER BY p)
 WHERE code = 'NURSE';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['clinical.allergies:read']) AS p ORDER BY p)
 WHERE code = 'PHARMACIST';

-- ---------------------------------------------------------------------------------------------------------------------------------------------
-- Tranche 2 : ordonnances. Une ordonnance est émise pendant une consultation en cours par le médecin qui la conduit ; elle ne se réécrit plus
-- (seul son statut passe de ISSUED à CANCELLED, avec un motif). Les médicaments viennent du formulaire de la pharmacie (clé étrangère).
-- ---------------------------------------------------------------------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS clinical_prescription_number_seq;

CREATE TABLE IF NOT EXISTS clinical_prescriptions (
  id                   uuid PRIMARY KEY,
  prescription_number  text NOT NULL CHECK (prescription_number ~ '^RX-[0-9]{7,12}$'),
  encounter_id         uuid NOT NULL REFERENCES clinical_encounters (id),
  patient_id           uuid NOT NULL REFERENCES patients (id),
  service_id           uuid NOT NULL REFERENCES administration_structure_nodes (id),
  doctor_id            uuid NOT NULL,
  status               text NOT NULL CHECK (status IN ('ISSUED', 'CANCELLED')),
  issued_at            timestamptz NOT NULL,
  notes                text CHECK (notes IS NULL OR length(notes) BETWEEN 1 AND 300),
  cancelled_by         uuid,
  cancelled_at         timestamptz,
  cancellation_reason  text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) BETWEEN 1 AND 200),
  version              integer NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clinical_prescriptions_number ON clinical_prescriptions (prescription_number);
CREATE INDEX IF NOT EXISTS ix_clinical_prescriptions_encounter ON clinical_prescriptions (encounter_id, issued_at);
CREATE INDEX IF NOT EXISTS ix_clinical_prescriptions_patient ON clinical_prescriptions (patient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS ix_clinical_prescriptions_service ON clinical_prescriptions (service_id, status, issued_at DESC);

CREATE TABLE IF NOT EXISTS clinical_prescription_lines (
  prescription_id   uuid NOT NULL REFERENCES clinical_prescriptions (id),
  position          smallint NOT NULL CHECK (position >= 0),
  drug_id           uuid NOT NULL REFERENCES pharmacy_drugs (id),
  dose              text NOT NULL CHECK (length(dose) BETWEEN 1 AND 60),
  frequency         text NOT NULL CHECK (length(frequency) BETWEEN 1 AND 60),
  duration_days     smallint CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 365),
  quantity          integer NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  instructions      text CHECK (instructions IS NULL OR length(instructions) BETWEEN 1 AND 200),
  -- Motif du médecin qui prescrit malgré une allergie connue du patient à ce médicament ; absent quand il n'y avait aucune alerte.
  allergy_override  text CHECK (allergy_override IS NULL OR length(allergy_override) BETWEEN 3 AND 200),
  PRIMARY KEY (prescription_id, position),
  UNIQUE (prescription_id, drug_id)
);

-- Une ordonnance ne naît que d'une consultation en cours ; ses lignes ne se réécrivent ni ne s'effacent ; elle ne s'efface pas, et une fois
-- annulée elle ne bouge plus.
CREATE OR REPLACE FUNCTION clinical_prescriptions_guard() RETURNS trigger AS $$
DECLARE parent text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'clinical_prescriptions : suppression interdite' USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO parent FROM clinical_encounters WHERE id = NEW.encounter_id;
    IF parent IS DISTINCT FROM 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'clinical_prescriptions : une ordonnance ne se rédige que pendant une consultation en cours' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'ISSUED' THEN
    RAISE EXCEPTION 'clinical_prescriptions : une ordonnance % ne peut plus être modifiée', OLD.status USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_prescriptions_guard ON clinical_prescriptions;
CREATE TRIGGER trg_clinical_prescriptions_guard BEFORE INSERT OR UPDATE OR DELETE ON clinical_prescriptions FOR EACH ROW EXECUTE FUNCTION clinical_prescriptions_guard();

CREATE OR REPLACE FUNCTION clinical_prescription_lines_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'clinical_prescription_lines est en ajout seul : % interdit', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_clinical_prescription_lines_guard ON clinical_prescription_lines;
CREATE TRIGGER trg_clinical_prescription_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON clinical_prescription_lines FOR EACH ROW EXECUTE FUNCTION clinical_prescription_lines_guard();

-- Droits. Le médecin prescrit dans ses services ; l'infirmier les lit. (Le pharmacien les lira avec la dispensation.)
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['clinical.prescriptions:read:department', 'clinical.prescriptions:write:department']) AS p ORDER BY p)
 WHERE code = 'DOCTOR';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['clinical.prescriptions:read:department']) AS p ORDER BY p)
 WHERE code = 'NURSE';
