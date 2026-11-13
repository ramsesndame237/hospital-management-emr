-- Module Imagerie : catalogue des examens, demandes d'examens (planning, réalisation avec dépistage de sécurité), compte rendu signé
-- (versions en ajout seul) et appel du clinicien pour une découverte critique.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS iam, patients, clinical (clés étrangères logiques) ; les droits
-- du module sont ajoutés en fin de script, après que iam.pg.sql a recréé les rôles système.

CREATE SEQUENCE IF NOT EXISTS imaging_order_number_seq;

-- Catalogue des examens. Le code et la modalité ne changent jamais (la modalité décide si l'examen est irradiant) ; rien n'est supprimé :
-- un examen retiré se désactive.
CREATE TABLE IF NOT EXISTS imaging_exam_types (
  id               uuid PRIMARY KEY,
  code             text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,19}$'),
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  modality         text NOT NULL CHECK (modality IN ('XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'OTHER')),
  body_part        text CHECK (body_part IS NULL OR length(body_part) BETWEEN 1 AND 60),
  uses_contrast    boolean NOT NULL DEFAULT false,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 480),
  preparation      text CHECK (preparation IS NULL OR length(preparation) <= 500),
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_imaging_exam_types_code ON imaging_exam_types (code);
CREATE INDEX IF NOT EXISTS ix_imaging_exam_types_modality ON imaging_exam_types (modality) WHERE active;

-- Une demande = un examen pour un patient. Le code, le libellé et la modalité sont copiés au moment de la demande.
CREATE TABLE IF NOT EXISTS imaging_orders (
  id                   uuid PRIMARY KEY,
  order_number         text NOT NULL CHECK (order_number ~ '^IMG-[0-9]{7,12}$'),
  patient_id           uuid NOT NULL REFERENCES patients (id),
  exam_type_id         uuid NOT NULL REFERENCES imaging_exam_types (id),
  exam_code            text NOT NULL,
  exam_name            text NOT NULL,
  modality             text NOT NULL CHECK (modality IN ('XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'OTHER')),
  priority             text NOT NULL CHECK (priority IN ('ROUTINE', 'URGENT', 'STAT')),
  source               text NOT NULL CHECK (source IN ('OPD', 'IPD', 'ER', 'EXTERNAL')),
  status               text NOT NULL CHECK (status IN ('ORDERED', 'SCHEDULED', 'PERFORMED', 'REPORTED', 'CANCELLED')),
  clinical_question    text NOT NULL CHECK (length(clinical_question) BETWEEN 1 AND 500),
  encounter_id         uuid,
  ordered_by           uuid NOT NULL,
  ordered_at           timestamptz NOT NULL,
  scheduled_for        timestamptz,
  scheduled_by         uuid,
  performed_at         timestamptz,
  performed_by         uuid,
  technique_note       text CHECK (technique_note IS NULL OR length(technique_note) <= 500),
  screening_pregnant   boolean,
  screening_allergy    boolean,
  override_reason      text CHECK (override_reason IS NULL OR length(override_reason) BETWEEN 1 AND 200),
  -- brouillon du compte rendu (effacé à la signature : le texte signé est dans imaging_report_versions)
  draft_technique      text CHECK (draft_technique IS NULL OR length(draft_technique) <= 2000),
  draft_findings       text CHECK (draft_findings IS NULL OR length(draft_findings) <= 8000),
  draft_impression     text CHECK (draft_impression IS NULL OR length(draft_impression) <= 2000),
  draft_critical       boolean,
  draft_by             uuid,
  draft_at             timestamptz,
  cancelled_by         uuid,
  cancelled_at         timestamptz,
  cancellation_reason  text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) BETWEEN 1 AND 200),
  version              integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL)),
  CHECK (status <> 'SCHEDULED' OR (scheduled_for IS NOT NULL AND scheduled_by IS NOT NULL)),
  CHECK (status NOT IN ('PERFORMED', 'REPORTED') OR (performed_at IS NOT NULL AND performed_by IS NOT NULL AND screening_pregnant IS NOT NULL AND screening_allergy IS NOT NULL)),
  CHECK ((draft_by IS NULL) = (draft_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_imaging_orders_number ON imaging_orders (order_number);
CREATE INDEX IF NOT EXISTS ix_imaging_orders_patient ON imaging_orders (patient_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS ix_imaging_orders_status ON imaging_orders (status, ordered_at);
CREATE INDEX IF NOT EXISTS ix_imaging_orders_orderer ON imaging_orders (ordered_by, ordered_at DESC);
CREATE INDEX IF NOT EXISTS ix_imaging_orders_encounter ON imaging_orders (encounter_id) WHERE encounter_id IS NOT NULL;

-- Versions signées du compte rendu : ajout seul. La version 1 est le compte rendu signé ; les suivantes sont des addenda motivés.
CREATE TABLE IF NOT EXISTS imaging_report_versions (
  order_id    uuid NOT NULL REFERENCES imaging_orders (id),
  version     integer NOT NULL CHECK (version >= 1),
  technique   text CHECK (technique IS NULL OR length(technique) <= 2000),
  findings    text NOT NULL CHECK (length(findings) BETWEEN 1 AND 8000),
  impression  text NOT NULL CHECK (length(impression) BETWEEN 1 AND 2000),
  critical    boolean NOT NULL,
  reason      text CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 200),
  signed_by   uuid NOT NULL,
  signed_at   timestamptz NOT NULL,
  PRIMARY KEY (order_id, version),
  CHECK ((version = 1) = (reason IS NULL))
);

-- Appel du clinicien pour une découverte critique : ajout seul ; la relecture est obligatoire.
CREATE TABLE IF NOT EXISTS imaging_critical_communications (
  order_id       uuid NOT NULL REFERENCES imaging_orders (id),
  seq            integer NOT NULL CHECK (seq >= 1),
  version        integer NOT NULL CHECK (version >= 1),
  notified_name  text NOT NULL CHECK (length(notified_name) BETWEEN 1 AND 100),
  notified_role  text NOT NULL CHECK (length(notified_role) BETWEEN 1 AND 60),
  method         text NOT NULL CHECK (method IN ('PHONE', 'IN_PERSON', 'SECURE_MESSAGE')),
  read_back      boolean NOT NULL CHECK (read_back),
  at             timestamptz NOT NULL,
  by             uuid NOT NULL,
  PRIMARY KEY (order_id, seq)
);

CREATE OR REPLACE FUNCTION imaging_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_imaging_report_versions_append_only ON imaging_report_versions;
CREATE TRIGGER trg_imaging_report_versions_append_only BEFORE UPDATE OR DELETE ON imaging_report_versions FOR EACH ROW EXECUTE FUNCTION imaging_append_only();
DROP TRIGGER IF EXISTS trg_imaging_report_versions_no_truncate ON imaging_report_versions;
CREATE TRIGGER trg_imaging_report_versions_no_truncate BEFORE TRUNCATE ON imaging_report_versions FOR EACH STATEMENT EXECUTE FUNCTION imaging_append_only();
DROP TRIGGER IF EXISTS trg_imaging_critical_communications_append_only ON imaging_critical_communications;
CREATE TRIGGER trg_imaging_critical_communications_append_only BEFORE UPDATE OR DELETE ON imaging_critical_communications FOR EACH ROW EXECUTE FUNCTION imaging_append_only();
DROP TRIGGER IF EXISTS trg_imaging_critical_communications_no_truncate ON imaging_critical_communications;
CREATE TRIGGER trg_imaging_critical_communications_no_truncate BEFORE TRUNCATE ON imaging_critical_communications FOR EACH STATEMENT EXECUTE FUNCTION imaging_append_only();

-- Droits. Le catalogue est lu par les médecins et le radiologue, et tenu par l'administrateur système. Le médecin prescrit et suit ses
-- propres demandes ; le radiologue voit toutes les demandes, planifie, réalise, rédige, documente l'appel d'une découverte critique,
-- signe et complète ses comptes rendus ; l'administrateur système lit tout (arbitrage).
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['imaging.catalog:read', 'imaging.orders:order', 'imaging.orders:read:own', 'imaging.orders:cancel']) AS p ORDER BY p)
 WHERE code = 'DOCTOR';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY[
         'imaging.catalog:read', 'imaging.orders:order', 'imaging.orders:read:all', 'imaging.orders:cancel', 'imaging.orders:schedule', 'imaging.exams:perform',
         'imaging.reports:write', 'imaging.reports:notify', 'imaging.reports:sign'
       ]) AS p ORDER BY p)
 WHERE code = 'RADIOLOGIST';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['imaging.catalog:read', 'imaging.catalog:manage', 'imaging.orders:read:all']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
