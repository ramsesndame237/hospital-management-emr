-- Module Hospitalisation (soins au lit du patient) : observations avec score NEWS2, administration des médicaments (MAR) et notes de soins.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS iam, administration, patients, admissions et clinical (clés étrangères).
-- Tout est en AJOUT SEUL : une erreur de saisie se corrige par une nouvelle ligne et une note, jamais en réécrivant l'historique des soins.

-- Observations : un relevé complet des constantes. Le score NEWS2 est calculé à l'écriture et conservé tel quel (un seuil qui change plus tard ne réécrit pas l'histoire).
CREATE TABLE IF NOT EXISTS inpatient_observations (
  id               uuid PRIMARY KEY,
  admission_id     uuid NOT NULL REFERENCES admissions (id),
  patient_id       uuid NOT NULL REFERENCES patients (id),
  service_id       uuid NOT NULL REFERENCES administration_structure_nodes (id),
  recorded_by      uuid NOT NULL,
  recorded_at      timestamptz NOT NULL,
  temperature      numeric(4, 1) NOT NULL CHECK (temperature BETWEEN 30 AND 45),
  pulse            smallint NOT NULL CHECK (pulse BETWEEN 20 AND 300),
  systolic         smallint NOT NULL CHECK (systolic BETWEEN 40 AND 300),
  diastolic        smallint CHECK (diastolic IS NULL OR diastolic BETWEEN 20 AND 200),
  respiratory_rate smallint NOT NULL CHECK (respiratory_rate BETWEEN 4 AND 80),
  spo2             smallint NOT NULL CHECK (spo2 BETWEEN 50 AND 100),
  supplemental_o2  boolean NOT NULL,
  consciousness    text NOT NULL CHECK (consciousness IN ('ALERT', 'CONFUSION', 'VOICE', 'PAIN', 'UNRESPONSIVE')),
  news2            smallint NOT NULL CHECK (news2 BETWEEN 0 AND 20),
  risk             text NOT NULL CHECK (risk IN ('LOW', 'MEDIUM', 'HIGH')),
  note             text CHECK (note IS NULL OR length(note) BETWEEN 1 AND 300),
  CHECK (diastolic IS NULL OR diastolic < systolic)
);
CREATE INDEX IF NOT EXISTS ix_inpatient_observations_admission ON inpatient_observations (admission_id, recorded_at DESC);

-- Administrations : ce que l'infirmier a fait d'une ligne d'ordonnance (donné, refusé par le patient, suspendu), avec l'heure et, sinon donné, le motif.
CREATE TABLE IF NOT EXISTS inpatient_administrations (
  id               uuid PRIMARY KEY,
  admission_id     uuid NOT NULL REFERENCES admissions (id),
  patient_id       uuid NOT NULL REFERENCES patients (id),
  service_id       uuid NOT NULL REFERENCES administration_structure_nodes (id),
  prescription_id  uuid NOT NULL REFERENCES clinical_prescriptions (id),
  position         smallint NOT NULL CHECK (position >= 0),
  status           text NOT NULL CHECK (status IN ('GIVEN', 'REFUSED', 'HELD')),
  reason           text CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 200),
  administered_by  uuid NOT NULL,
  administered_at  timestamptz NOT NULL,
  FOREIGN KEY (prescription_id, position) REFERENCES clinical_prescription_lines (prescription_id, position),
  CHECK ((status = 'GIVEN') = (reason IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_inpatient_administrations_admission ON inpatient_administrations (admission_id, administered_at DESC);
CREATE INDEX IF NOT EXISTS ix_inpatient_administrations_line ON inpatient_administrations (prescription_id, position, administered_at DESC);

-- Notes de soins : texte libre court, signé par son auteur, jamais modifié.
CREATE TABLE IF NOT EXISTS inpatient_notes (
  id           uuid PRIMARY KEY,
  admission_id uuid NOT NULL REFERENCES admissions (id),
  patient_id   uuid NOT NULL REFERENCES patients (id),
  service_id   uuid NOT NULL REFERENCES administration_structure_nodes (id),
  author_id    uuid NOT NULL,
  written_at   timestamptz NOT NULL,
  text         text NOT NULL CHECK (length(text) BETWEEN 1 AND 1000)
);
CREATE INDEX IF NOT EXISTS ix_inpatient_notes_admission ON inpatient_notes (admission_id, written_at DESC);

CREATE OR REPLACE FUNCTION inpatient_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_inpatient_observations_append_only ON inpatient_observations;
CREATE TRIGGER trg_inpatient_observations_append_only BEFORE UPDATE OR DELETE ON inpatient_observations FOR EACH ROW EXECUTE FUNCTION inpatient_append_only();
DROP TRIGGER IF EXISTS trg_inpatient_observations_no_truncate ON inpatient_observations;
CREATE TRIGGER trg_inpatient_observations_no_truncate BEFORE TRUNCATE ON inpatient_observations FOR EACH STATEMENT EXECUTE FUNCTION inpatient_append_only();
DROP TRIGGER IF EXISTS trg_inpatient_administrations_append_only ON inpatient_administrations;
CREATE TRIGGER trg_inpatient_administrations_append_only BEFORE UPDATE OR DELETE ON inpatient_administrations FOR EACH ROW EXECUTE FUNCTION inpatient_append_only();
DROP TRIGGER IF EXISTS trg_inpatient_administrations_no_truncate ON inpatient_administrations;
CREATE TRIGGER trg_inpatient_administrations_no_truncate BEFORE TRUNCATE ON inpatient_administrations FOR EACH STATEMENT EXECUTE FUNCTION inpatient_append_only();
DROP TRIGGER IF EXISTS trg_inpatient_notes_append_only ON inpatient_notes;
CREATE TRIGGER trg_inpatient_notes_append_only BEFORE UPDATE OR DELETE ON inpatient_notes FOR EACH ROW EXECUTE FUNCTION inpatient_append_only();
DROP TRIGGER IF EXISTS trg_inpatient_notes_no_truncate ON inpatient_notes;
CREATE TRIGGER trg_inpatient_notes_no_truncate BEFORE TRUNCATE ON inpatient_notes FOR EACH STATEMENT EXECUTE FUNCTION inpatient_append_only();

-- Droits, bornés au service du patient. L'infirmier relève les constantes, administre et écrit ses notes ; le médecin lit le dossier de soins, relève des constantes
-- et écrit ses notes (sa tournée passe par la consultation).
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY[
         'inpatient.chart:read:department', 'inpatient.observations:record:department', 'inpatient.administrations:record:department', 'inpatient.notes:write:department'
       ]) AS p ORDER BY p)
 WHERE code = 'NURSE';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY[
         'inpatient.chart:read:department', 'inpatient.observations:record:department', 'inpatient.notes:write:department'
       ]) AS p ORDER BY p)
 WHERE code = 'DOCTOR';
