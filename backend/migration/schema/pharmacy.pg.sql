-- Module Pharmacie (tranche 1) : catalogue des médicaments, stock par lot, réceptions de marchandises, ajustements approuvés et grand livre
-- des mouvements. Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS iam, administration (clés étrangères) ; les
-- permissions du module sont ajoutées en fin de script, après que iam.pg.sql a recréé les rôles système.

CREATE SEQUENCE IF NOT EXISTS pharmacy_receipt_number_seq;
CREATE SEQUENCE IF NOT EXISTS pharmacy_adjustment_number_seq;

-- Catalogue (formulaire) des médicaments. Le code ne change jamais ; rien n'est supprimé (un médicament retiré se désactive).
-- Les prix sont des entiers en plus petite unité monétaire de l'installation (jamais de décimaux).
CREATE TABLE IF NOT EXISTS pharmacy_drugs (
  id            uuid PRIMARY KEY,
  code          text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,29}$'),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  generic_name  text NOT NULL CHECK (length(generic_name) BETWEEN 1 AND 120),
  strength      text CHECK (strength IS NULL OR length(strength) BETWEEN 1 AND 40),
  form          text NOT NULL CHECK (form IN ('TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'INFUSION', 'CREAM', 'OINTMENT', 'DROPS', 'INHALER', 'SUPPOSITORY', 'POWDER', 'PATCH', 'OTHER')),
  schedule      text NOT NULL CHECK (schedule IN ('OTC', 'PRESCRIPTION', 'CONTROLLED')),
  storage       text NOT NULL DEFAULT 'ROOM' CHECK (storage IN ('ROOM', 'COOL', 'COLD_CHAIN')),
  atc_code      text CHECK (atc_code IS NULL OR atc_code ~ '^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$'),
  unit          text NOT NULL CHECK (length(unit) BETWEEN 1 AND 20),
  unit_price    bigint NOT NULL DEFAULT 0 CHECK (unit_price BETWEEN 0 AND 1000000000000),
  reorder_level integer NOT NULL DEFAULT 0 CHECK (reorder_level BETWEEN 0 AND 1000000),
  notes         text CHECK (notes IS NULL OR length(notes) <= 500),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pharmacy_drugs_code ON pharmacy_drugs (code);
CREATE INDEX IF NOT EXISTS ix_pharmacy_drugs_generic ON pharmacy_drugs (generic_name);

-- Lots : un lot est identifié par son numéro chez le fabricant ; une seconde livraison du même lot s'ajoute au premier (même péremption).
CREATE TABLE IF NOT EXISTS pharmacy_batches (
  id                 uuid PRIMARY KEY,
  drug_id            uuid NOT NULL REFERENCES pharmacy_drugs (id),
  batch_number       text NOT NULL CHECK (batch_number ~ '^[A-Z0-9][A-Z0-9 ._/-]{0,39}$'),
  expiry_date        date NOT NULL,
  quantity           integer NOT NULL CHECK (quantity >= 0),
  unit_cost          bigint NOT NULL CHECK (unit_cost BETWEEN 0 AND 1000000000000),
  status             text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'QUARANTINED')),
  quarantine_reason  text CHECK (quarantine_reason IS NULL OR length(quarantine_reason) BETWEEN 1 AND 200),
  quarantined_by     uuid,
  quarantined_at     timestamptz,
  received_at        timestamptz NOT NULL,
  version            integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'QUARANTINED') = (quarantine_reason IS NOT NULL AND quarantined_by IS NOT NULL AND quarantined_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pharmacy_batches_number ON pharmacy_batches (drug_id, batch_number);
CREATE INDEX IF NOT EXISTS ix_pharmacy_batches_expiry ON pharmacy_batches (expiry_date) WHERE quantity > 0;

-- Grand livre des mouvements : ajout seul. `balance` est le solde du lot après le mouvement (la somme des mouvements d'un lot donne sa quantité).
CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id    uuid NOT NULL REFERENCES pharmacy_drugs (id),
  batch_id   uuid NOT NULL REFERENCES pharmacy_batches (id),
  type       text NOT NULL CHECK (type IN ('RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')),
  delta      integer NOT NULL CHECK (delta <> 0),
  balance    integer NOT NULL CHECK (balance >= 0),
  reason     text CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 200),
  reference  text CHECK (reference IS NULL OR length(reference) BETWEEN 1 AND 40),
  by         uuid NOT NULL,
  at         timestamptz NOT NULL,
  seq        bigint GENERATED ALWAYS AS IDENTITY,
  CHECK ((type = 'ADJUSTMENT_OUT') = (delta < 0))
);
CREATE INDEX IF NOT EXISTS ix_pharmacy_movements_drug ON pharmacy_stock_movements (drug_id, seq DESC);
CREATE INDEX IF NOT EXISTS ix_pharmacy_movements_batch ON pharmacy_stock_movements (batch_id, seq DESC);

-- Réceptions de marchandises : écrites une fois pour toutes (le stock est mis à jour dans la même transaction).
CREATE TABLE IF NOT EXISTS pharmacy_receipts (
  id              uuid PRIMARY KEY,
  receipt_number  text NOT NULL CHECK (receipt_number ~ '^GRN-[0-9]{7,12}$'),
  supplier        text NOT NULL CHECK (length(supplier) BETWEEN 1 AND 120),
  delivery_note   text CHECK (delivery_note IS NULL OR length(delivery_note) BETWEEN 1 AND 60),
  notes           text CHECK (notes IS NULL OR length(notes) <= 200),
  received_by     uuid NOT NULL,
  received_at     timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pharmacy_receipts_number ON pharmacy_receipts (receipt_number);
CREATE INDEX IF NOT EXISTS ix_pharmacy_receipts_at ON pharmacy_receipts (received_at DESC);

CREATE TABLE IF NOT EXISTS pharmacy_receipt_lines (
  receipt_id    uuid NOT NULL REFERENCES pharmacy_receipts (id),
  position      smallint NOT NULL CHECK (position >= 0),
  drug_id       uuid NOT NULL REFERENCES pharmacy_drugs (id),
  batch_id      uuid NOT NULL REFERENCES pharmacy_batches (id),
  batch_number  text NOT NULL,
  expiry_date   date NOT NULL,
  quantity      integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit_cost     bigint NOT NULL CHECK (unit_cost BETWEEN 0 AND 1000000000000),
  PRIMARY KEY (receipt_id, position)
);

-- Ajustements de stock : demandés par un pharmacien, appliqués seulement quand un AUTRE les approuve (la règle est aussi en base).
CREATE TABLE IF NOT EXISTS pharmacy_adjustments (
  id                 uuid PRIMARY KEY,
  adjustment_number  text NOT NULL CHECK (adjustment_number ~ '^ADJ-[0-9]{7,12}$'),
  drug_id            uuid NOT NULL REFERENCES pharmacy_drugs (id),
  batch_id           uuid NOT NULL REFERENCES pharmacy_batches (id),
  direction          text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  quantity           integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  reason             text NOT NULL CHECK (reason IN ('COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'OTHER')),
  note               text CHECK (note IS NULL OR length(note) BETWEEN 1 AND 200),
  status             text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by       uuid NOT NULL,
  requested_at       timestamptz NOT NULL,
  decided_by         uuid,
  decided_at         timestamptz,
  decision_comment   text CHECK (decision_comment IS NULL OR length(decision_comment) BETWEEN 1 AND 200),
  version            integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'PENDING') = (decided_by IS NULL)),
  CHECK ((status = 'PENDING') = (decided_at IS NULL)),
  CHECK (decided_by IS NULL OR decided_by <> requested_by),
  CHECK (status <> 'REJECTED' OR decision_comment IS NOT NULL),
  CHECK (reason <> 'OTHER' OR note IS NOT NULL),
  CHECK (direction = 'OUT' OR reason IN ('COUNT_CORRECTION', 'FOUND', 'OTHER')),
  CHECK (direction = 'IN' OR reason <> 'FOUND')
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pharmacy_adjustments_number ON pharmacy_adjustments (adjustment_number);
CREATE INDEX IF NOT EXISTS ix_pharmacy_adjustments_status ON pharmacy_adjustments (status, requested_at);
CREATE INDEX IF NOT EXISTS ix_pharmacy_adjustments_batch ON pharmacy_adjustments (batch_id) WHERE status = 'PENDING';

CREATE OR REPLACE FUNCTION pharmacy_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pharmacy_movements_append_only ON pharmacy_stock_movements;
CREATE TRIGGER trg_pharmacy_movements_append_only BEFORE UPDATE OR DELETE ON pharmacy_stock_movements FOR EACH ROW EXECUTE FUNCTION pharmacy_append_only();
DROP TRIGGER IF EXISTS trg_pharmacy_movements_no_truncate ON pharmacy_stock_movements;
CREATE TRIGGER trg_pharmacy_movements_no_truncate BEFORE TRUNCATE ON pharmacy_stock_movements FOR EACH STATEMENT EXECUTE FUNCTION pharmacy_append_only();
DROP TRIGGER IF EXISTS trg_pharmacy_receipts_append_only ON pharmacy_receipts;
CREATE TRIGGER trg_pharmacy_receipts_append_only BEFORE UPDATE OR DELETE ON pharmacy_receipts FOR EACH ROW EXECUTE FUNCTION pharmacy_append_only();
DROP TRIGGER IF EXISTS trg_pharmacy_receipt_lines_append_only ON pharmacy_receipt_lines;
CREATE TRIGGER trg_pharmacy_receipt_lines_append_only BEFORE UPDATE OR DELETE ON pharmacy_receipt_lines FOR EACH ROW EXECUTE FUNCTION pharmacy_append_only();

-- Droits. Médecins et infirmiers consultent le catalogue (futures prescriptions) ; le pharmacien tient le catalogue et le stock (réception,
-- ajustement, approbation par un autre pharmacien, mise en quarantaine) ; l'administrateur système lit le tout et peut tenir le catalogue.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['pharmacy.catalog:read']) AS p ORDER BY p)
 WHERE code IN ('DOCTOR', 'NURSE');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY[
         'pharmacy.catalog:read', 'pharmacy.catalog:manage', 'pharmacy.stock:read', 'pharmacy.stock:receive', 'pharmacy.stock:adjust', 'pharmacy.stock:approve', 'pharmacy.stock:quarantine'
       ]) AS p ORDER BY p)
 WHERE code = 'PHARMACIST';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['pharmacy.catalog:read', 'pharmacy.catalog:manage', 'pharmacy.stock:read']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
