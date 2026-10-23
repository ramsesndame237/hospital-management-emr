-- Module 1 : identité & accès (IAM) + journal d'audit. Idempotent : peut être rejoué à chaque déploiement.
-- Les tables héritées (rbac_*) restent intactes ; iam_users.legacy_rbac_user_id les relie pour la reprise des comptes.

CREATE TABLE IF NOT EXISTS iam_roles (
  code         text PRIMARY KEY,
  name         text NOT NULL,
  requires_mfa boolean NOT NULL DEFAULT false,
  is_system    boolean NOT NULL DEFAULT false,
  -- `ressource:action:portée`, validées par le value object Permission côté application
  permissions  text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS iam_users (
  id                    uuid PRIMARY KEY,
  username              text NOT NULL,
  email                 text NOT NULL,
  password_hash         text NOT NULL,
  status                text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  failed_attempts       integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until          timestamptz,
  must_change_password  boolean NOT NULL DEFAULT true,
  -- secrets TOTP chiffrés (AES-256-GCM) par l'application ; jamais en clair
  mfa_secret            text,
  pending_mfa_secret    text,
  recovery_code_hashes  text[] NOT NULL DEFAULT '{}',
  password_changed_at   timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL,
  legacy_rbac_user_id   integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_iam_users_username ON iam_users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS ux_iam_users_email ON iam_users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS ux_iam_users_legacy ON iam_users (legacy_rbac_user_id) WHERE legacy_rbac_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS iam_user_roles (
  user_id   uuid NOT NULL REFERENCES iam_users (id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES iam_roles (code),
  PRIMARY KEY (user_id, role_code)
);
CREATE INDEX IF NOT EXISTS ix_iam_user_roles_role ON iam_user_roles (role_code);

-- Journal d'audit : ajout seul, chaîné par hachage (prev_hash -> hash). Aucune donnée de santé ni secret.
CREATE TABLE IF NOT EXISTS audit_log (
  id             bigserial PRIMARY KEY,
  occurred_at    timestamptz NOT NULL,
  action         text NOT NULL,
  outcome        text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED')),
  actor_id       text,
  actor_username text,
  resource_type  text,
  resource_id    text,
  ip             text,
  user_agent     text,
  reason         text,
  metadata       jsonb,
  prev_hash      text NOT NULL,
  hash           text NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_log_actor ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_log_resource ON audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_action ON audit_log (action, occurred_at DESC);

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log est en ajout seul : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
CREATE TRIGGER trg_audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- Rôles système. Les permissions suivent le moindre privilège ; l'administrateur système n'a AUCUN accès clinique
-- (séparation des tâches). D'autres modules ajouteront leurs permissions à ces rôles dans leurs propres migrations.
INSERT INTO iam_roles (code, name, requires_mfa, is_system, permissions) VALUES
  ('SYSTEM_ADMIN',   'Administrateur système',     true,  true, ARRAY['iam.users:read','iam.users:manage','iam.roles:read','folders:manage','files:read','files:upload','files:delete']),
  ('DOCTOR',         'Médecin',                    true,  true, ARRAY['files:read:department','files:upload','folders:manage:own','files.clinical:read:department','files.clinical:upload','files.clinical:break-glass']),
  ('NURSE',          'Infirmier(ère)',             true,  true, ARRAY['files:read:department','files:upload','folders:manage:own','files.clinical:read:department','files.clinical:upload']),
  ('PHARMACIST',     'Pharmacien(ne)',             true,  true, ARRAY['files:read:department','files:upload','folders:manage:own','files.clinical:read:department']),
  ('LAB_TECHNICIAN', 'Technicien(ne) de laboratoire', true, true, ARRAY['files:read:department','files:upload','folders:manage:own','files.clinical:read:department','files.clinical:upload']),
  ('RADIOLOGIST',    'Radiologue',                 true,  true, ARRAY['files:read:department','files:upload','folders:manage:own','files.clinical:read:department','files.clinical:upload']),
  ('CASHIER',        'Caissier(ère) / Facturation', false, true, ARRAY['files:read:department','files:upload']),
  ('RECEPTIONIST',   'Réceptionniste / Admission', false, true, ARRAY['files:read:department','files:upload']),
  ('ACCOUNTANT',     'Comptable',                  false, true, ARRAY['files:read:department','files:upload','files:delete:own','folders:manage:own']),
  ('DPO_AUDITOR',    'DPO / Auditeur',             true,  true, ARRAY['audit:read','iam.users:read','iam.roles:read']),
  ('PATIENT',        'Patient (portail)',          false, true, ARRAY['files:read:own','files:upload:own','files.clinical:read:own'])
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name, requires_mfa = EXCLUDED.requires_mfa, permissions = EXCLUDED.permissions
  WHERE iam_roles.is_system;
