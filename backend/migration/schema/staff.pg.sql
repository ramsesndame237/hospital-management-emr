-- Module Personnel : fiches du personnel et affectations. Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam.pg.sql et administration.pg.sql (comptes, établissements, structure) ; les permissions du module
-- sont ajoutées en fin de script, après que iam.pg.sql a recréé les rôles système.

-- Une fiche existe avec ou sans compte de connexion. Rien n'est supprimé : un départ est une date.
CREATE TABLE IF NOT EXISTS staff_members (
  id              uuid PRIMARY KEY,
  staff_number    text NOT NULL CHECK (staff_number ~ '^[A-Z0-9][A-Z0-9_./-]{0,31}$'),
  first_name      text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 100),
  last_name       text NOT NULL CHECK (length(btrim(last_name)) BETWEEN 1 AND 100),
  -- codes du référentiel (catalogues PROFESSION et SPECIALTY, module Référentiels)
  profession_code text NOT NULL,
  specialty_code  text,
  email           text CHECK (email IS NULL OR length(email) <= 254),
  phone           text CHECK (phone IS NULL OR length(phone) <= 20),
  hired_on        date,
  departed_on     date,
  -- compte de connexion relié (module IAM) : une fiche pour un compte, et inversement
  user_id         uuid REFERENCES iam_users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (hired_on IS NULL OR departed_on IS NULL OR departed_on >= hired_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_members_number ON staff_members (staff_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_members_user ON staff_members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_staff_members_name ON staff_members (lower(last_name), lower(first_name));

-- Affectation d'une personne à un service ou une unité sur une période (fin ouverte tant qu'elle n'est pas décidée).
-- L'historique est conservé : on date la fin, on ne supprime pas. Les chevauchements au même endroit et la
-- cohérence avec l'emploi sont contrôlés par l'application ; la base garantit l'intégrité des références et des dates.
CREATE TABLE IF NOT EXISTS staff_assignments (
  id          uuid PRIMARY KEY,
  staff_id    uuid NOT NULL REFERENCES staff_members (id),
  node_id     uuid NOT NULL REFERENCES administration_structure_nodes (id),
  facility_id uuid NOT NULL REFERENCES administration_facilities (id),
  start_date  date NOT NULL,
  end_date    date,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS ix_staff_assignments_staff ON staff_assignments (staff_id, start_date DESC);
CREATE INDEX IF NOT EXISTS ix_staff_assignments_node ON staff_assignments (node_id);

-- Droits : la direction informatique (administrateur système) gère le personnel ; l'auditeur le lit ; chacun lit sa propre fiche
-- et ses affectations (hors patient, qui n'a pas de fiche). Les données du personnel sont personnelles : lecture étendue limitée.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['staff:read:own']) AS p ORDER BY p)
 WHERE is_system AND code <> 'PATIENT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['staff:read', 'staff:manage']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['staff:read']) AS p ORDER BY p)
 WHERE code = 'DPO_AUDITOR';
