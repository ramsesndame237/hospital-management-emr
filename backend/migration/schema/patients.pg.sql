-- Module Patients : identité et dossier administratif. Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam.pg.sql (qui recrée les rôles système) : les permissions du module sont ajoutées en fin de script.
-- Aucune donnée médicale ici : les modules cliniques référenceront `patients.id`.

-- Numéro de dossier : jamais réutilisé, même si l'enregistrement qui suit échoue (des trous sont normaux).
CREATE SEQUENCE IF NOT EXISTS patients_number_seq;

CREATE TABLE IF NOT EXISTS patients (
  id                    uuid PRIMARY KEY,
  patient_number        text NOT NULL CHECK (patient_number ~ '^PAT-[0-9]{7,12}$'),
  identity_status       text NOT NULL CHECK (identity_status IN ('CONFIRMED', 'PROVISIONAL')),
  last_name             text NOT NULL CHECK (length(btrim(last_name)) BETWEEN 1 AND 100),
  first_name            text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 100),
  -- clé de comparaison (sans accents ni casse, mots triés) calculée par l'application : recherche et détection des doublons
  name_key              text NOT NULL,
  sex                   text NOT NULL CHECK (sex IN ('MALE', 'FEMALE', 'UNDETERMINED')),
  birth_date            date NOT NULL CHECK (birth_date >= DATE '1880-01-01'),
  birth_date_estimated  boolean NOT NULL DEFAULT false,
  birth_place           text CHECK (birth_place IS NULL OR length(birth_place) <= 100),
  nationality           text CHECK (nationality IS NULL OR nationality ~ '^[A-Z]{2}$'),
  marital_status        text CHECK (marital_status IS NULL OR marital_status IN ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED')),
  occupation            text CHECK (occupation IS NULL OR length(occupation) <= 100),
  phone                 text CHECK (phone IS NULL OR length(phone) <= 20),
  -- chiffres seuls du téléphone ; on compare leurs 8 derniers chiffres (« 655 00 00 00 » et « +237 655 00 00 00 » sont le même abonné)
  phone_digits          text,
  email                 text CHECK (email IS NULL OR length(email) <= 254),
  address_line          text CHECK (address_line IS NULL OR length(address_line) <= 200),
  address_quarter       text CHECK (address_quarter IS NULL OR length(address_quarter) <= 100),
  address_city          text CHECK (address_city IS NULL OR length(address_city) <= 100),
  address_region        text CHECK (address_region IS NULL OR length(address_region) <= 100),
  address_country       text CHECK (address_country IS NULL OR address_country ~ '^[A-Z]{2}$'),
  document_type         text CHECK (document_type IS NULL OR document_type IN ('NATIONAL_ID', 'PASSPORT', 'BIRTH_CERTIFICATE', 'DRIVING_LICENSE', 'OTHER')),
  document_number       text CHECK (document_number IS NULL OR document_number ~ '^[A-Z0-9][A-Z0-9/-]{2,39}$'),
  kin_name              text CHECK (kin_name IS NULL OR length(kin_name) <= 100),
  kin_relationship      text CHECK (kin_relationship IS NULL OR kin_relationship IN ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'RELATIVE', 'FRIEND', 'GUARDIAN', 'OTHER')),
  kin_phone             text CHECK (kin_phone IS NULL OR length(kin_phone) <= 20),
  date_of_death         date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- une pièce se renseigne avec son type ET son numéro ; la personne à prévenir avec ses trois éléments
  CHECK ((document_type IS NULL) = (document_number IS NULL)),
  CHECK ((kin_name IS NULL) = (kin_relationship IS NULL) AND (kin_name IS NULL) = (kin_phone IS NULL)),
  CHECK (date_of_death IS NULL OR date_of_death >= birth_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_number ON patients (patient_number);
-- Une même pièce d'identité ne désigne qu'un dossier : l'application avertit avant, la base garantit après.
CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_document ON patients (document_type, document_number) WHERE document_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_patients_name_birth ON patients (name_key, birth_date);
CREATE INDEX IF NOT EXISTS ix_patients_birth_date ON patients (birth_date);
CREATE INDEX IF NOT EXISTS ix_patients_phone ON patients (right(phone_digits, 8)) WHERE phone_digits IS NOT NULL;

-- Historique des versions du dossier (qui a corrigé quoi, quand, pourquoi). Ajout seul, comme le journal d'audit :
-- une identité corrigée ne s'efface pas. Contient des données personnelles : accès restreint (patients.history:read).
CREATE TABLE IF NOT EXISTS patients_revisions (
  patient_id     uuid NOT NULL REFERENCES patients (id),
  revision       integer NOT NULL CHECK (revision >= 1),
  changed_at     timestamptz NOT NULL,
  changed_by     text NOT NULL,
  reason         text CHECK (reason IS NULL OR length(reason) <= 200),
  changed_fields text[] NOT NULL,
  snapshot       jsonb NOT NULL,
  PRIMARY KEY (patient_id, revision)
);

CREATE OR REPLACE FUNCTION patients_revisions_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'patients_revisions est en ajout seul : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patients_revisions_immutable ON patients_revisions;
CREATE TRIGGER trg_patients_revisions_immutable BEFORE UPDATE OR DELETE ON patients_revisions
  FOR EACH ROW EXECUTE FUNCTION patients_revisions_immutable();
DROP TRIGGER IF EXISTS trg_patients_revisions_no_truncate ON patients_revisions;
CREATE TRIGGER trg_patients_revisions_no_truncate BEFORE TRUNCATE ON patients_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION patients_revisions_immutable();

-- Droits. Lire l'identité : le personnel soignant et d'accueil, plus l'administrateur système et l'auditeur (lecture tracée à chaque
-- ouverture de dossier). Créer et corriger : l'accueil et l'administrateur système. Constater un décès : les médecins et l'administrateur
-- système. Historique des corrections : administrateur système et auditeur seulement. Le patient (portail) n'a rien ici.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['patients:read']) AS p ORDER BY p)
 WHERE code IN ('DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'RECEPTIONIST', 'CASHIER', 'SYSTEM_ADMIN', 'DPO_AUDITOR');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['patients:write']) AS p ORDER BY p)
 WHERE code IN ('RECEPTIONIST', 'SYSTEM_ADMIN');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['patients.death:record']) AS p ORDER BY p)
 WHERE code IN ('DOCTOR', 'SYSTEM_ADMIN');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['patients.history:read']) AS p ORDER BY p)
 WHERE code IN ('SYSTEM_ADMIN', 'DPO_AUDITOR');
