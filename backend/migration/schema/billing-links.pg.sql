-- Facturation reliée : une demande d'analyses, un examen d'imagerie réalisé ou une délivrance de médicaments devient une facture.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS billing, lab, imaging et dispensing.

-- Un acte du catalogue peut être mis en correspondance avec le code d'une analyse (LABORATORY), d'un examen d'imagerie (RADIOLOGY) ou d'un
-- médicament (PHARMACY) : c'est ainsi que la facture connaît le prix de ce qui a été fait. Sans correspondance, rien n'est facturé en silence.
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS source_code text;
DO $$ BEGIN
  ALTER TABLE billing_items ADD CONSTRAINT billing_items_source_code_check
    CHECK (source_code IS NULL OR (source_code ~ '^[A-Z0-9][A-Z0-9_.-]{0,29}$' AND category IN ('LABORATORY', 'RADIOLOGY', 'PHARMACY')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Un code source n'a qu'un acte actif : deux prix pour la même analyse seraient ambigus.
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_items_source ON billing_items (category, source_code) WHERE source_code IS NOT NULL AND active;

-- Ce qui a déjà été facturé : une source (demande d'analyses, examen, délivrance) n'a qu'une facture non annulée. Une facture annulée libère sa source.
CREATE TABLE IF NOT EXISTS billing_invoice_sources (
  source_type text NOT NULL CHECK (source_type IN ('LAB_REQUISITION', 'IMAGING_ORDER', 'DISPENSATION')),
  source_id   uuid NOT NULL,
  invoice_id  uuid NOT NULL REFERENCES billing_invoices (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_type, source_id)
);
CREATE INDEX IF NOT EXISTS ix_billing_invoice_sources_invoice ON billing_invoice_sources (invoice_id);
