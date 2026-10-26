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

-- Sessions de caisse : un caissier ouvre sa caisse en comptant son fonds, encaisse, puis la clôture en comptant ce qu'il a en main.
-- Elles ne se suppriment ni ne se rouvrent. Un caissier n'a qu'une session ouverte, et un poste n'est tenu que par une session ouverte.
CREATE SEQUENCE IF NOT EXISTS billing_session_number_seq;

CREATE TABLE IF NOT EXISTS billing_cash_sessions (
  id              uuid PRIMARY KEY,
  session_number  text NOT NULL CHECK (session_number ~ '^CAI-[0-9]{7,12}$'),
  cashier_id      uuid NOT NULL,
  counter         text NOT NULL CHECK (length(counter) BETWEEN 1 AND 40),
  currency        char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status          text NOT NULL CHECK (status IN ('OPEN', 'AWAITING_REVIEW', 'CLOSED')),
  opened_at       timestamptz NOT NULL,
  -- comptage par valeur de billet ou de pièce : {"10000": 3, "500": 2}
  opening_count   jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_float   bigint NOT NULL CHECK (opening_float >= 0),
  closed_at       timestamptz,
  closing_count   jsonb,
  counted_cash    bigint CHECK (counted_cash IS NULL OR counted_cash >= 0),
  expected_cash   bigint CHECK (expected_cash IS NULL OR expected_cash >= 0),
  -- écart = espèces comptées - espèces attendues (négatif : il manque de l'argent)
  variance        bigint,
  variance_reason text CHECK (variance_reason IS NULL OR length(variance_reason) BETWEEN 1 AND 200),
  requires_cosign boolean NOT NULL DEFAULT false,
  cosigned_by     uuid,
  cosigned_at     timestamptz,
  cosign_comment  text CHECK (cosign_comment IS NULL OR length(cosign_comment) BETWEEN 1 AND 200),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- une session ouverte n'a rien de clôturé ; une session clôturée a tout
  CHECK ((status = 'OPEN') = (closed_at IS NULL)),
  CHECK ((status = 'OPEN') = (counted_cash IS NULL AND expected_cash IS NULL AND variance IS NULL AND closing_count IS NULL)),
  -- un écart a toujours son explication
  CHECK (variance IS NULL OR variance = 0 OR variance_reason IS NOT NULL),
  -- une session close avec contre-signature requise l'a reçue ; seule une session close la porte
  CHECK (NOT (status = 'CLOSED' AND requires_cosign AND cosigned_by IS NULL)),
  CHECK (status <> 'OPEN' OR (cosigned_by IS NULL AND NOT requires_cosign))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_sessions_number ON billing_cash_sessions (session_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_sessions_open_cashier ON billing_cash_sessions (cashier_id) WHERE status = 'OPEN';
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_sessions_open_counter ON billing_cash_sessions (lower(counter)) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS ix_billing_sessions_cashier ON billing_cash_sessions (cashier_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS ix_billing_sessions_status ON billing_cash_sessions (status, opened_at DESC);

-- Chaque encaissement appartient à la session pendant laquelle il a été perçu (vide pour les encaissements antérieurs aux sessions).
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES billing_cash_sessions (id);
CREATE INDEX IF NOT EXISTS ix_billing_payments_session ON billing_payments (session_id) WHERE session_id IS NOT NULL;

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

-- Sessions de caisse : la caisse ouvre, clôture et lit ses propres sessions ; la comptabilité contre-signe les clôtures à écart élevé et lit toutes les
-- sessions ; l'administrateur système les lit (arbitrage) mais ne tient jamais une caisse.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.sessions:operate', 'billing.sessions:read:own']) AS p ORDER BY p)
 WHERE code = 'CASHIER';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.sessions:read:all', 'billing.sessions:cosign']) AS p ORDER BY p)
 WHERE code = 'ACCOUNTANT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.sessions:read:all']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';

-- Circuit d'approbation : une remise au-delà du seuil, ou l'annulation d'une facture émise, passe par une demande motivée qu'un responsable
-- (jamais le demandeur) accepte ou refuse. Une demande décidée ne se modifie plus et rien ne se supprime ; une facture n'a qu'une demande en cours.
CREATE TABLE IF NOT EXISTS billing_approvals (
  id               uuid PRIMARY KEY,
  invoice_id       uuid NOT NULL REFERENCES billing_invoices (id),
  kind             text NOT NULL CHECK (kind IN ('DISCOUNT', 'CANCEL')),
  status           text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  -- montant de la remise demandée (vide pour une annulation)
  amount           bigint CHECK (amount IS NULL OR amount > 0),
  reason           text NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  -- version de la facture au moment de la demande : si elle a bougé depuis, la demande est périmée et ne peut plus être acceptée
  invoice_version  integer NOT NULL,
  requested_by     uuid NOT NULL,
  requested_at     timestamptz NOT NULL,
  decided_by       uuid,
  decided_at       timestamptz,
  decision_comment text CHECK (decision_comment IS NULL OR length(decision_comment) BETWEEN 1 AND 200),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'DISCOUNT') = (amount IS NOT NULL)),
  -- en attente : ni décideur ni date ; décidée, retirée : les deux
  CHECK ((status = 'PENDING') = (decided_at IS NULL)),
  CHECK ((status = 'PENDING') = (decided_by IS NULL)),
  -- un refus s'explique ; personne ne décide de sa propre demande (seul le retrait la concerne)
  CHECK (status <> 'REJECTED' OR decision_comment IS NOT NULL),
  CHECK (status NOT IN ('APPROVED', 'REJECTED') OR decided_by <> requested_by),
  CHECK (status <> 'WITHDRAWN' OR decided_by = requested_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_approvals_pending ON billing_approvals (invoice_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_billing_approvals_invoice ON billing_approvals (invoice_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS ix_billing_approvals_status ON billing_approvals (status, requested_at);
CREATE INDEX IF NOT EXISTS ix_billing_approvals_requester ON billing_approvals (requested_by, requested_at DESC);

CREATE OR REPLACE FUNCTION billing_approvals_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Une demande d''approbation ne se supprime pas ; une fois décidée, elle ne se modifie plus.' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_billing_approvals_guard ON billing_approvals;
CREATE TRIGGER trg_billing_approvals_guard BEFORE UPDATE OR DELETE ON billing_approvals
  FOR EACH ROW EXECUTE FUNCTION billing_approvals_guard();
DROP TRIGGER IF EXISTS trg_billing_approvals_no_truncate ON billing_approvals;
CREATE TRIGGER trg_billing_approvals_no_truncate BEFORE TRUNCATE ON billing_approvals
  FOR EACH STATEMENT EXECUTE FUNCTION billing_approvals_guard();

-- Droits : la caisse demande et suit ses demandes ; la comptabilité et l'administrateur système (arbitrage) lisent toutes les demandes et les décident.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.approvals:request', 'billing.approvals:read:own']) AS p ORDER BY p)
 WHERE code = 'CASHIER';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['billing.approvals:read:all', 'billing.approvals:decide']) AS p ORDER BY p)
 WHERE code IN ('ACCOUNTANT', 'SYSTEM_ADMIN');
