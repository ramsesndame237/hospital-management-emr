-- Liens avec la visite : une demande d'analyses peut se rattacher à la consultation qui l'a prescrite, une facture à l'admission qu'elle règle.
-- Idempotent : peut être rejoué à chaque déploiement. À appliquer APRÈS lab, billing, admissions et clinical (clés étrangères).

ALTER TABLE lab_requisitions ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES clinical_encounters (id);
CREATE INDEX IF NOT EXISTS ix_lab_requisitions_encounter ON lab_requisitions (encounter_id) WHERE encounter_id IS NOT NULL;

ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES admissions (id);
CREATE INDEX IF NOT EXISTS ix_billing_invoices_admission ON billing_invoices (admission_id) WHERE admission_id IS NOT NULL;

-- La caisse lit les admissions (patient, service, heures : aucun contenu clinique) pour rattacher une facture à celle qu'elle règle.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['admissions:read:all']) AS p ORDER BY p)
 WHERE code = 'CASHIER';
