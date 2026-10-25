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
