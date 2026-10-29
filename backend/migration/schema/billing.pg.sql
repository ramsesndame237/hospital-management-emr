-- Module Facturation : catalogue des actes, factures, encaissements. Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam, administration, patients (clés étrangères) ; les permissions du module sont ajoutées en fin de script,
-- après que iam.pg.sql a recréé les rôles système.
-- Les montants sont des ENTIERS dans la plus petite unité de la devise de l'installation (le franc CFA n'a pas de centimes) :
-- jamais de nombre décimal pour de l'argent.

CREATE SEQUENCE IF NOT EXISTS billing_invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS billing_receipt_number_seq;

-- Catalogue des actes facturables. Rien n'est supprimé : un acte retiré est désactivé (les factures y renvoient).
CREATE TABLE IF NOT EXISTS billing_items (
  id          uuid PRIMARY KEY,
  code        text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,31}$'),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  category    text NOT NULL CHECK (category IN ('CONSULTATION', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'PROCEDURE', 'HOSPITALIZATION', 'OTHER')),
  unit_price  bigint NOT NULL CHECK (unit_price >= 0 AND unit_price <= 1000000000000),
  service_id  uuid REFERENCES administration_structure_nodes (id),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_items_code ON billing_items (code);
CREATE INDEX IF NOT EXISTS ix_billing_items_category ON billing_items (category) WHERE active;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id                  uuid PRIMARY KEY,
  invoice_number      text NOT NULL CHECK (invoice_number ~ '^FAC-[0-9]{7,12}$'),
  patient_id          uuid NOT NULL REFERENCES patients (id),
  status              text NOT NULL CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
  currency            char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  discount_amount     bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_reason     text CHECK (discount_reason IS NULL OR length(discount_reason) BETWEEN 1 AND 200),
  note                text CHECK (note IS NULL OR length(note) <= 500),
  cancellation_reason text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) BETWEEN 1 AND 200),
  issued_at           timestamptz,
  version             integer NOT NULL DEFAULT 0,
  created_by          uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- une remise a toujours son motif ; une facture annulée a toujours le sien ; une facture émise a une date d'émission
  CHECK ((discount_amount > 0) = (discount_reason IS NOT NULL)),
  CHECK ((status = 'CANCELLED') = (cancellation_reason IS NOT NULL)),
  CHECK ((status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')) <= (issued_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_invoices_number ON billing_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS ix_billing_invoices_patient ON billing_invoices (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_billing_invoices_status ON billing_invoices (status, created_at DESC);

-- Lignes : copie de l'acte au moment de la facturation (le catalogue peut changer ensuite sans toucher aux factures).
CREATE TABLE IF NOT EXISTS billing_invoice_lines (
  id          uuid PRIMARY KEY,
  invoice_id  uuid NOT NULL REFERENCES billing_invoices (id),
  position    integer NOT NULL CHECK (position >= 1),
  item_id     uuid NOT NULL REFERENCES billing_items (id),
  item_code   text NOT NULL,
  item_name   text NOT NULL,
  unit_price  bigint NOT NULL CHECK (unit_price >= 0),
  quantity    integer NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
  UNIQUE (invoice_id, position)
);

-- Encaissements : écrits une fois, jamais modifiés ni supprimés (une erreur se corrige par un avoir).
CREATE TABLE IF NOT EXISTS billing_payments (
  id              uuid PRIMARY KEY,
  invoice_id      uuid NOT NULL REFERENCES billing_invoices (id),
  receipt_number  text NOT NULL CHECK (receipt_number ~ '^REC-[0-9]{7,12}$'),
  mode            text NOT NULL CHECK (mode IN ('CASH', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER')),
  amount          bigint NOT NULL CHECK (amount > 0),
  reference       text CHECK (reference IS NULL OR length(reference) BETWEEN 1 AND 64),
  received_by     uuid NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_payments_receipt ON billing_payments (receipt_number);
CREATE INDEX IF NOT EXISTS ix_billing_payments_invoice ON billing_payments (invoice_id);

CREATE OR REPLACE FUNCTION billing_payments_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Les encaissements ne se modifient ni ne se suppriment : corrigez par un avoir.' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_billing_payments_immutable ON billing_payments;
CREATE TRIGGER trg_billing_payments_immutable BEFORE UPDATE OR DELETE ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION billing_payments_immutable();
DROP TRIGGER IF EXISTS trg_billing_payments_no_truncate ON billing_payments;
CREATE TRIGGER trg_billing_payments_no_truncate BEFORE TRUNCATE ON billing_payments
  FOR EACH STATEMENT EXECUTE FUNCTION billing_payments_immutable();

-- Droits. Le catalogue est lu par la caisse, la comptabilité et l'accueil (pour annoncer un prix) et tenu par l'administrateur système.
-- Les factures : la caisse les crée et les gère, et seule elle encaisse ; la comptabilité et l'administrateur système (arbitrage) les lisent.
-- Aucun accès aux données cliniques n'est donné ici : une facture ne porte que l'identité du patient et des montants.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.catalog:read', 'billing.invoices:read:all', 'billing.invoices:write:all', 'billing.payments:collect:all']) AS p ORDER BY p)
 WHERE code = 'CASHIER';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.catalog:read', 'billing.invoices:read:all']) AS p ORDER BY p)
 WHERE code = 'ACCOUNTANT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.catalog:read']) AS p ORDER BY p)
 WHERE code = 'RECEPTIONIST';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.catalog:read', 'billing.catalog:manage', 'billing.invoices:read:all']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
