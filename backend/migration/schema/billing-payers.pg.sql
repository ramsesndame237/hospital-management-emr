-- Assurances et tiers payant : un assureur prend en charge une part (en %) de la facture d'un patient couvert ; le patient ne règle que le reste, et la part de
-- l'assureur devient une créance qu'on suit jusqu'à son règlement. Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS billing et patients.

CREATE TABLE IF NOT EXISTS billing_payers (
  id          uuid PRIMARY KEY,
  code        text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,19}$'),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_payers_code ON billing_payers (code);

-- Couverture d'un patient : son assureur, son numéro d'assuré, le pourcentage pris en charge et sa période de validité. Une couverture ne s'efface pas : elle se désactive.
CREATE TABLE IF NOT EXISTS billing_coverages (
  id            uuid PRIMARY KEY,
  patient_id    uuid NOT NULL REFERENCES patients (id),
  payer_id      uuid NOT NULL REFERENCES billing_payers (id),
  policy_number text NOT NULL CHECK (length(policy_number) BETWEEN 1 AND 40),
  percent       smallint NOT NULL CHECK (percent BETWEEN 1 AND 100),
  valid_from    date NOT NULL,
  valid_until   date,
  active        boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE INDEX IF NOT EXISTS ix_billing_coverages_patient ON billing_coverages (patient_id, active);

-- Sur la facture : l'assureur et le pourcentage (figés au moment où la couverture est appliquée), puis le règlement de la créance.
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES billing_payers (id);
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS coverage_percent smallint;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS coverage_policy text;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS payer_settled_at timestamptz;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS payer_settled_by uuid;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS payer_settlement_reference text;
DO $$ BEGIN
  ALTER TABLE billing_invoices ADD CONSTRAINT billing_invoices_coverage_check CHECK (
    (payer_id IS NULL) = (coverage_percent IS NULL) AND (coverage_percent IS NULL OR coverage_percent BETWEEN 1 AND 100)
    AND (payer_settled_at IS NULL) = (payer_settled_by IS NULL) AND (payer_settled_at IS NULL) = (payer_settlement_reference IS NULL)
    AND (payer_settled_at IS NULL OR payer_id IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ix_billing_invoices_payer ON billing_invoices (payer_id, payer_settled_at) WHERE payer_id IS NOT NULL;

-- Droits. La caisse et l'accueil voient les assureurs et enregistrent la couverture d'un patient ; la comptabilité tient la liste des assureurs et règle leurs créances ;
-- l'administrateur système tient la liste des assureurs.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.payers:read', 'billing.coverages:write']) AS p ORDER BY p)
 WHERE code IN ('CASHIER', 'RECEPTIONIST');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.payers:read', 'billing.payers:manage', 'billing.payers:settle', 'billing.coverages:write']) AS p ORDER BY p)
 WHERE code = 'ACCOUNTANT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.payers:read', 'billing.payers:manage']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
