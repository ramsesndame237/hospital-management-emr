-- Module Administration : organisation et établissements. Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam.pg.sql (qui recrée les rôles système) : les permissions du module sont ajoutées en fin de script.

-- Une organisation par installation (déploiement dédié à un client) : l'index sur une constante interdit une seconde ligne.
CREATE TABLE IF NOT EXISTS administration_organizations (
  id         uuid PRIMARY KEY,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_administration_single_organization ON administration_organizations ((true));

CREATE TABLE IF NOT EXISTS administration_facilities (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES administration_organizations (id),
  code            text NOT NULL CHECK (length(btrim(code)) > 0),
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  -- Valeurs de FacilityStatusEnum (domaine). Une valeur inconnue est refusée en base aussi.
  status          text NOT NULL CHECK (status IN (
    'ADMIN_AUTHORIZED', 'ADMIN_AUTHORIZATION_EXPIRED', 'ADMIN_SUSPENDED', 'ADMIN_LICENSE_REVOKED',
    'OPERATIONAL_OPEN', 'OPERATIONAL_TEMPORARILY_CLOSED', 'OPERATIONAL_PERMANENTLY_CLOSED', 'OPERATIONAL_UNDER_CONSTRUCTION',
    'QUALITY_CERTIFIED', 'QUALITY_CERTIFICATION_IN_PROGRESS', 'QUALITY_NOT_CERTIFIED'
  )),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_administration_facilities_code ON administration_facilities (code);
CREATE INDEX IF NOT EXISTS ix_administration_facilities_org ON administration_facilities (organization_id);

-- Permissions du module, ajoutées aux rôles système sans écraser les autres (réexécutable : pas de doublon).
-- L'administrateur système voit et gère tout ; l'auditeur (DPO) lit seulement.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(
         permissions || ARRAY['administration.organization:read', 'administration.organization:manage', 'administration.facilities:read', 'administration.facilities:manage']
       ) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(
         permissions || ARRAY['administration.organization:read', 'administration.facilities:read']
       ) AS p ORDER BY p)
 WHERE code = 'DPO_AUDITOR';

-- Structure de l'établissement : services > unités > salles > lits (liste d'adjacence, un seul tableau).
-- Rien n'est supprimé (les admissions et dossiers y renverront) : un élément se désactive. Code et rattachement ne changent jamais.
CREATE TABLE IF NOT EXISTS administration_structure_nodes (
  id             uuid PRIMARY KEY,
  facility_id    uuid NOT NULL REFERENCES administration_facilities (id),
  parent_id      uuid,
  kind           text NOT NULL CHECK (kind IN ('SERVICE', 'UNIT', 'ROOM', 'BED')),
  code           text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,31}$'),
  name           text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  active         boolean NOT NULL DEFAULT true,
  -- attributs propres à un niveau
  service_type   text CHECK (service_type IN ('CLINICAL', 'MEDICO_TECHNICAL', 'ADMINISTRATIVE', 'SUPPORT')),
  specialty_code text,
  floor          text CHECK (floor IS NULL OR length(btrim(floor)) BETWEEN 1 AND 32),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- un parent appartient forcément au même établissement
  UNIQUE (id, facility_id),
  FOREIGN KEY (parent_id, facility_id) REFERENCES administration_structure_nodes (id, facility_id),
  CHECK ((kind = 'SERVICE') = (parent_id IS NULL)),
  CHECK ((kind = 'SERVICE') = (service_type IS NOT NULL)),
  CHECK (kind = 'SERVICE' OR specialty_code IS NULL),
  CHECK (kind = 'ROOM' OR floor IS NULL)
);
-- Le code est unique parmi les frères (même parent ; les services sont frères au sein de l'établissement).
CREATE UNIQUE INDEX IF NOT EXISTS ux_administration_structure_siblings
  ON administration_structure_nodes (facility_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
CREATE INDEX IF NOT EXISTS ix_administration_structure_parent ON administration_structure_nodes (parent_id);

-- Tout le personnel lit la structure (choix du service, du lit…) ; l'administrateur système la gère. Pas le patient (portail).
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['administration.structure:read']) AS p ORDER BY p)
 WHERE is_system AND code <> 'PATIENT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['administration.structure:manage']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
