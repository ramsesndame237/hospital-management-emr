-- Module Laboratoire : catalogue des analyses, demandes d'analyses, échantillons (prélèvement, réception, rejet) et leur traçabilité.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS iam, administration, patients (clés étrangères) ; les
-- permissions du module sont ajoutées en fin de script, après que iam.pg.sql a recréé les rôles système.

CREATE SEQUENCE IF NOT EXISTS lab_requisition_number_seq;
CREATE SEQUENCE IF NOT EXISTS lab_specimen_barcode_seq;

-- Catalogue des analyses. Le code et le type de résultat ne changent jamais ; rien n'est supprimé (une analyse retirée se désactive).
CREATE TABLE IF NOT EXISTS lab_tests (
  id            uuid PRIMARY KEY,
  code          text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,19}$'),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  section       text NOT NULL CHECK (section IN ('HAEMATOLOGY', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'MICROBIOLOGY', 'HISTOLOGY', 'OTHER')),
  specimen_type text NOT NULL CHECK (specimen_type IN ('BLOOD', 'SERUM', 'PLASMA', 'URINE', 'STOOL', 'SWAB', 'CSF', 'TISSUE', 'OTHER')),
  container     text NOT NULL CHECK (container IN ('RED', 'YELLOW', 'PURPLE', 'LIGHT_BLUE', 'GREEN', 'GREY', 'STERILE_CUP', 'SWAB', 'OTHER')),
  result_type   text NOT NULL CHECK (result_type IN ('NUMERIC', 'TEXT', 'CHOICE')),
  unit          text CHECK (unit IS NULL OR length(unit) BETWEEN 1 AND 20),
  decimals      smallint NOT NULL DEFAULT 0 CHECK (decimals BETWEEN 0 AND 4),
  choices       text[] NOT NULL DEFAULT '{}',
  tat_minutes   integer NOT NULL DEFAULT 240 CHECK (tat_minutes BETWEEN 1 AND 43200),
  instructions  text CHECK (instructions IS NULL OR length(instructions) <= 500),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- une unité n'a de sens que pour un résultat numérique, des choix que pour un résultat à choix
  CHECK (unit IS NULL OR result_type = 'NUMERIC'),
  CHECK ((result_type = 'CHOICE') = (cardinality(choices) >= 2))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_tests_code ON lab_tests (code);
CREATE INDEX IF NOT EXISTS ix_lab_tests_section ON lab_tests (section) WHERE active;

-- Valeurs de référence par sexe et tranche d'âge (en jours), avec seuils critiques.
CREATE TABLE IF NOT EXISTS lab_reference_ranges (
  test_id        uuid NOT NULL REFERENCES lab_tests (id) ON DELETE CASCADE,
  position       smallint NOT NULL CHECK (position >= 0),
  sex            text NOT NULL CHECK (sex IN ('ANY', 'FEMALE', 'MALE')),
  age_min_days   integer NOT NULL CHECK (age_min_days >= 0),
  age_max_days   integer,
  low            numeric,
  high           numeric,
  critical_low   numeric,
  critical_high  numeric,
  PRIMARY KEY (test_id, position),
  CHECK (age_max_days IS NULL OR age_max_days > age_min_days),
  CHECK (low IS NOT NULL OR high IS NOT NULL),
  CHECK (low IS NULL OR high IS NULL OR low <= high),
  CHECK (critical_low IS NULL OR low IS NULL OR critical_low <= low),
  CHECK (critical_high IS NULL OR high IS NULL OR critical_high >= high)
);

CREATE TABLE IF NOT EXISTS lab_requisitions (
  id                  uuid PRIMARY KEY,
  requisition_number  text NOT NULL CHECK (requisition_number ~ '^LAB-[0-9]{7,12}$'),
  patient_id          uuid NOT NULL REFERENCES patients (id),
  priority            text NOT NULL CHECK (priority IN ('ROUTINE', 'URGENT', 'STAT')),
  source              text NOT NULL CHECK (source IN ('OPD', 'IPD', 'ER', 'EXTERNAL')),
  status              text NOT NULL CHECK (status IN ('ORDERED', 'PARTIALLY_COLLECTED', 'COLLECTED', 'RECEIVED', 'CANCELLED')),
  clinical_notes      text CHECK (clinical_notes IS NULL OR length(clinical_notes) <= 500),
  ordered_by          uuid NOT NULL,
  ordered_at          timestamptz NOT NULL,
  cancelled_by        uuid,
  cancelled_at        timestamptz,
  cancellation_reason text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) BETWEEN 1 AND 200),
  version             integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_requisitions_number ON lab_requisitions (requisition_number);
CREATE INDEX IF NOT EXISTS ix_lab_requisitions_patient ON lab_requisitions (patient_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS ix_lab_requisitions_status ON lab_requisitions (status, ordered_at);
CREATE INDEX IF NOT EXISTS ix_lab_requisitions_orderer ON lab_requisitions (ordered_by, ordered_at DESC);

-- Échantillons : un par couple (type d'échantillon, contenant) de la demande ; un rejet en crée un nouveau (recollection_of).
CREATE TABLE IF NOT EXISTS lab_specimens (
  id                uuid PRIMARY KEY,
  barcode           text NOT NULL CHECK (barcode ~ '^SPC-[0-9]{7,12}$'),
  requisition_id    uuid NOT NULL REFERENCES lab_requisitions (id),
  specimen_type     text NOT NULL CHECK (specimen_type IN ('BLOOD', 'SERUM', 'PLASMA', 'URINE', 'STOOL', 'SWAB', 'CSF', 'TISSUE', 'OTHER')),
  container         text NOT NULL CHECK (container IN ('RED', 'YELLOW', 'PURPLE', 'LIGHT_BLUE', 'GREEN', 'GREY', 'STERILE_CUP', 'SWAB', 'OTHER')),
  status            text NOT NULL CHECK (status IN ('PENDING_COLLECTION', 'COLLECTED', 'RECEIVED', 'REJECTED')),
  collected_by      uuid,
  collected_at      timestamptz,
  received_by       uuid,
  received_at       timestamptz,
  rejection_reason  text CHECK (rejection_reason IS NULL OR rejection_reason IN ('HEMOLYSED', 'INSUFFICIENT_VOLUME', 'WRONG_CONTAINER', 'CLOTTED', 'MISLABELLED', 'UNLABELLED', 'LEAKING', 'CONTAMINATED', 'EXPIRED_CONTAINER', 'OTHER')),
  rejection_note    text CHECK (rejection_note IS NULL OR length(rejection_note) BETWEEN 1 AND 200),
  rejected_by       uuid,
  rejected_at       timestamptz,
  recollection_of   uuid REFERENCES lab_specimens (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- un échantillon à prélever n'a rien d'enregistré ; prélevé ou reçu, il a son préleveur ; reçu, son récepteur ; rejeté, son motif
  CHECK (status <> 'PENDING_COLLECTION' OR (collected_at IS NULL AND received_at IS NULL AND rejected_at IS NULL)),
  CHECK (status NOT IN ('COLLECTED', 'RECEIVED') OR (collected_at IS NOT NULL AND collected_by IS NOT NULL)),
  CHECK (status <> 'RECEIVED' OR (received_at IS NOT NULL AND received_by IS NOT NULL)),
  CHECK ((status = 'REJECTED') = (rejection_reason IS NOT NULL AND rejected_at IS NOT NULL AND rejected_by IS NOT NULL)),
  CHECK (rejection_reason IS DISTINCT FROM 'OTHER' OR rejection_note IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_specimens_barcode ON lab_specimens (barcode);
CREATE INDEX IF NOT EXISTS ix_lab_specimens_requisition ON lab_specimens (requisition_id);
CREATE INDEX IF NOT EXISTS ix_lab_specimens_status ON lab_specimens (status);

-- Les analyses d'une demande, avec le code et le libellé copiés au moment de la demande (le catalogue peut évoluer sans les toucher).
CREATE TABLE IF NOT EXISTS lab_requisition_tests (
  requisition_id uuid NOT NULL REFERENCES lab_requisitions (id),
  test_id        uuid NOT NULL REFERENCES lab_tests (id),
  position       smallint NOT NULL CHECK (position >= 0),
  test_code      text NOT NULL,
  test_name      text NOT NULL,
  section        text NOT NULL CHECK (section IN ('HAEMATOLOGY', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'MICROBIOLOGY', 'HISTOLOGY', 'OTHER')),
  specimen_id    uuid NOT NULL REFERENCES lab_specimens (id),
  PRIMARY KEY (requisition_id, test_id)
);
CREATE INDEX IF NOT EXISTS ix_lab_requisition_tests_specimen ON lab_requisition_tests (specimen_id);
CREATE INDEX IF NOT EXISTS ix_lab_requisition_tests_test ON lab_requisition_tests (test_id);

-- Chaîne de traçabilité d'un échantillon : ajout seul, jamais réécrite.
CREATE TABLE IF NOT EXISTS lab_specimen_events (
  specimen_id uuid NOT NULL REFERENCES lab_specimens (id),
  seq         integer NOT NULL CHECK (seq >= 1),
  kind        text NOT NULL CHECK (kind IN ('CREATED', 'COLLECTED', 'RECEIVED', 'REJECTED')),
  at          timestamptz NOT NULL,
  actor_id    uuid,
  note        text CHECK (note IS NULL OR length(note) <= 300),
  PRIMARY KEY (specimen_id, seq)
);

CREATE OR REPLACE FUNCTION lab_specimen_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lab_specimen_events est en ajout seul : % interdit', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lab_specimen_events_immutable ON lab_specimen_events;
CREATE TRIGGER trg_lab_specimen_events_immutable BEFORE UPDATE OR DELETE ON lab_specimen_events
  FOR EACH ROW EXECUTE FUNCTION lab_specimen_events_immutable();
DROP TRIGGER IF EXISTS trg_lab_specimen_events_no_truncate ON lab_specimen_events;
CREATE TRIGGER trg_lab_specimen_events_no_truncate BEFORE TRUNCATE ON lab_specimen_events
  FOR EACH STATEMENT EXECUTE FUNCTION lab_specimen_events_immutable();

-- Droits. Le catalogue est lu par les médecins et le laboratoire, et tenu par l'administrateur système. Le médecin prescrit et suit ses
-- propres demandes ; le laboratoire voit toutes les demandes, prélève, reçoit et rejette ; l'administrateur système lit tout (arbitrage).
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['lab.catalog:read', 'lab.requisitions:order', 'lab.requisitions:read:own', 'lab.requisitions:cancel']) AS p ORDER BY p)
 WHERE code = 'DOCTOR';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY[
         'lab.catalog:read', 'lab.requisitions:order', 'lab.requisitions:read:all', 'lab.requisitions:cancel', 'lab.specimens:collect', 'lab.specimens:receive', 'lab.specimens:reject'
       ]) AS p ORDER BY p)
 WHERE code = 'LAB_TECHNICIAN';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['lab.catalog:read', 'lab.catalog:manage', 'lab.requisitions:read:all']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
