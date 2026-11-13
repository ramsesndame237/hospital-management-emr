-- Portail patient : un compte de connexion (rôle PATIENT) est relié à UN dossier patient ; il ne lit que les données de ce dossier.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS iam et patients.

CREATE TABLE IF NOT EXISTS portal_accounts (
  user_id     uuid PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES patients (id),
  linked_by   uuid NOT NULL,
  linked_at   timestamptz NOT NULL
);
-- Un dossier n'a qu'un compte de portail, un compte qu'un dossier : la base le garantit, même si deux postes lient en même temps.
CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_accounts_patient ON portal_accounts (patient_id);

-- Un lien ne se réécrit pas et ne s'efface pas (on ne détourne pas un compte vers un autre dossier) ; le délier est une décision de l'administration.
CREATE OR REPLACE FUNCTION portal_accounts_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'portal_accounts : % interdit (un lien ne se modifie pas)', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_portal_accounts_immutable ON portal_accounts;
CREATE TRIGGER trg_portal_accounts_immutable BEFORE UPDATE OR DELETE ON portal_accounts FOR EACH ROW EXECUTE FUNCTION portal_accounts_immutable();

-- Droits : le patient lit SON espace ; l'accueil et l'administrateur système relient un compte à un dossier.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['portal:read:own']) AS p ORDER BY p)
 WHERE code = 'PATIENT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['portal.accounts:manage']) AS p ORDER BY p)
 WHERE code IN ('RECEPTIONIST', 'SYSTEM_ADMIN');
