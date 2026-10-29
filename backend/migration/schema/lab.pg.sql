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

-- ---- Résultats --------------------------------------------------------------------------------------------------------------
-- Statuts de demande élargis aux résultats (le CHECK d'origine est remplacé : idempotent).
ALTER TABLE lab_requisitions DROP CONSTRAINT IF EXISTS lab_requisitions_status_check;
ALTER TABLE lab_requisitions ADD CONSTRAINT lab_requisitions_status_check
  CHECK (status IN ('ORDERED', 'PARTIALLY_COLLECTED', 'COLLECTED', 'RECEIVED', 'IN_ANALYSIS', 'RESULTED', 'VERIFIED', 'RELEASED', 'CANCELLED'));

-- Le résultat d'une analyse d'une demande : son état ; ses saisies successives sont dans lab_result_versions (ajout seul).
CREATE TABLE IF NOT EXISTS lab_results (
  requisition_id   uuid NOT NULL REFERENCES lab_requisitions (id),
  test_id          uuid NOT NULL REFERENCES lab_tests (id),
  status           text NOT NULL CHECK (status IN ('ENTERED', 'RETURNED', 'VERIFIED', 'RELEASED')),
  -- dernière version publiée : celle que voit le prescripteur, même pendant un amendement
  released_version integer CHECK (released_version IS NULL OR released_version >= 1),
  return_reason    text CHECK (return_reason IS NULL OR length(return_reason) BETWEEN 1 AND 200),
  verified_by      uuid,
  verified_at      timestamptz,
  released_by      uuid,
  released_at      timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requisition_id, test_id),
  FOREIGN KEY (requisition_id, test_id) REFERENCES lab_requisition_tests (requisition_id, test_id),
  CHECK (status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (status <> 'RETURNED' OR return_reason IS NOT NULL),
  CHECK (status <> 'RELEASED' OR (released_by IS NOT NULL AND released_at IS NOT NULL AND released_version IS NOT NULL)),
  CHECK ((released_version IS NULL) = (released_at IS NULL))
);

CREATE TABLE IF NOT EXISTS lab_result_versions (
  requisition_id   uuid NOT NULL,
  test_id          uuid NOT NULL,
  version          integer NOT NULL CHECK (version >= 1),
  value            text NOT NULL CHECK (length(value) BETWEEN 1 AND 2000),
  value_number     numeric,
  flag             text CHECK (flag IS NULL OR flag IN ('NORMAL', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH')),
  ref_low          numeric,
  ref_high         numeric,
  critical_low     numeric,
  critical_high    numeric,
  unit             text,
  previous_value   numeric,
  delta_alert      boolean NOT NULL DEFAULT false,
  entered_by       uuid NOT NULL,
  entered_at       timestamptz NOT NULL,
  comment          text CHECK (comment IS NULL OR length(comment) <= 300),
  amendment_reason text CHECK (amendment_reason IS NULL OR length(amendment_reason) BETWEEN 1 AND 200),
  PRIMARY KEY (requisition_id, test_id, version),
  FOREIGN KEY (requisition_id, test_id) REFERENCES lab_results (requisition_id, test_id)
);

-- Appel du clinicien pour une valeur critique : ajout seul ; la relecture de la valeur est obligatoire.
CREATE TABLE IF NOT EXISTS lab_critical_notifications (
  requisition_id uuid NOT NULL,
  test_id        uuid NOT NULL,
  seq            integer NOT NULL CHECK (seq >= 1),
  version        integer NOT NULL CHECK (version >= 1),
  notified_name  text NOT NULL CHECK (length(notified_name) BETWEEN 1 AND 100),
  notified_role  text NOT NULL CHECK (length(notified_role) BETWEEN 1 AND 60),
  method         text NOT NULL CHECK (method IN ('PHONE', 'IN_PERSON', 'SECURE_MESSAGE')),
  read_back      boolean NOT NULL CHECK (read_back),
  at             timestamptz NOT NULL,
  by             uuid NOT NULL,
  PRIMARY KEY (requisition_id, test_id, seq),
  FOREIGN KEY (requisition_id, test_id) REFERENCES lab_results (requisition_id, test_id)
);

CREATE OR REPLACE FUNCTION lab_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lab_result_versions_append_only ON lab_result_versions;
CREATE TRIGGER trg_lab_result_versions_append_only BEFORE UPDATE OR DELETE ON lab_result_versions FOR EACH ROW EXECUTE FUNCTION lab_append_only();
DROP TRIGGER IF EXISTS trg_lab_result_versions_no_truncate ON lab_result_versions;
CREATE TRIGGER trg_lab_result_versions_no_truncate BEFORE TRUNCATE ON lab_result_versions FOR EACH STATEMENT EXECUTE FUNCTION lab_append_only();
DROP TRIGGER IF EXISTS trg_lab_critical_notifications_append_only ON lab_critical_notifications;
CREATE TRIGGER trg_lab_critical_notifications_append_only BEFORE UPDATE OR DELETE ON lab_critical_notifications FOR EACH ROW EXECUTE FUNCTION lab_append_only();
DROP TRIGGER IF EXISTS trg_lab_critical_notifications_no_truncate ON lab_critical_notifications;
CREATE TRIGGER trg_lab_critical_notifications_no_truncate BEFORE TRUNCATE ON lab_critical_notifications FOR EACH STATEMENT EXECUTE FUNCTION lab_append_only();

CREATE INDEX IF NOT EXISTS ix_lab_results_test ON lab_results (test_id, released_at DESC) WHERE released_version IS NOT NULL;

-- Droits : le laboratoire saisit, valide, publie, amende et documente les valeurs critiques (la validation et la publication par un autre que
-- l'auteur de la saisie sont imposées par l'application). Le prescripteur ne voit que ce qui est publié.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['lab.results:enter', 'lab.results:verify', 'lab.results:release', 'lab.results:amend', 'lab.results:notify']) AS p ORDER BY p)
 WHERE code = 'LAB_TECHNICIAN';
