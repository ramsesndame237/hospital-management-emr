-- Module Admissions : arrivée d'un patient dans un service, occupation des lits, sortie. Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam, administration, référentiels, personnel, patients et rendez-vous (clés étrangères) ; les permissions du module
-- sont ajoutées en fin de script, après que iam.pg.sql a recréé les rôles système.

CREATE SEQUENCE IF NOT EXISTS admissions_number_seq;

CREATE TABLE IF NOT EXISTS admissions (
  id                  uuid PRIMARY KEY,
  admission_number    text NOT NULL CHECK (admission_number ~ '^ADM-[0-9]{7,12}$'),
  patient_id          uuid NOT NULL REFERENCES patients (id),
  admission_type      text NOT NULL CHECK (admission_type IN ('OUTPATIENT', 'EMERGENCY', 'INPATIENT')),
  status              text NOT NULL CHECK (status IN ('IN_PROGRESS', 'DISCHARGED', 'CANCELLED')),
  -- service responsable (il borne les droits d'accès) ; le lit n'est renseigné que pendant une hospitalisation en cours
  service_id          uuid NOT NULL REFERENCES administration_structure_nodes (id),
  bed_id              uuid REFERENCES administration_structure_nodes (id),
  practitioner_id     uuid REFERENCES staff_members (id),
  appointment_id      uuid REFERENCES appointments (id),
  reason_code         text,
  admitted_at         timestamptz NOT NULL,
  discharged_at       timestamptz,
  discharge_type      text CHECK (discharge_type IS NULL OR discharge_type IN ('HOME', 'TRANSFERRED_OUT', 'LEFT_AGAINST_ADVICE', 'DECEASED', 'OTHER')),
  cancellation_reason text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) <= 200),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- une hospitalisation en cours occupe un lit, les autres admissions n'en ont pas ; une admission terminée a libéré le sien
  CHECK (status <> 'IN_PROGRESS' OR ((admission_type = 'INPATIENT') = (bed_id IS NOT NULL))),
  CHECK (status = 'IN_PROGRESS' OR bed_id IS NULL),
  CHECK ((status = 'DISCHARGED') = (discharged_at IS NOT NULL AND discharge_type IS NOT NULL)),
  CHECK ((status = 'CANCELLED') = (cancellation_reason IS NOT NULL)),
  CHECK (discharged_at IS NULL OR discharged_at >= admitted_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_admissions_number ON admissions (admission_number);
-- « Un lit, un occupant » : garanti par la base, pas seulement par l'application (deux accueils peuvent viser le même lit en même temps).
CREATE UNIQUE INDEX IF NOT EXISTS ux_admissions_bed_active ON admissions (bed_id) WHERE status = 'IN_PROGRESS' AND bed_id IS NOT NULL;
-- Un patient n'a qu'une hospitalisation en cours à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS ux_admissions_patient_inpatient ON admissions (patient_id) WHERE status = 'IN_PROGRESS' AND admission_type = 'INPATIENT';
-- Un rendez-vous ne donne lieu qu'à une admission (hors admission annulée).
CREATE UNIQUE INDEX IF NOT EXISTS ux_admissions_appointment ON admissions (appointment_id) WHERE appointment_id IS NOT NULL AND status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS ix_admissions_patient ON admissions (patient_id, admitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_admissions_service ON admissions (service_id, admitted_at DESC);

-- Mouvements : arrivée, transferts, sortie ou annulation, avec le service, le lit, l'auteur et l'heure. Ajout seul : l'historique
-- d'occupation d'un lit ne se réécrit pas.
CREATE TABLE IF NOT EXISTS admission_movements (
  admission_id uuid NOT NULL REFERENCES admissions (id),
  seq          integer NOT NULL CHECK (seq >= 1),
  kind         text NOT NULL CHECK (kind IN ('ADMISSION', 'TRANSFER', 'DISCHARGE', 'CANCELLATION')),
  at           timestamptz NOT NULL,
  actor_id     text NOT NULL,
  service_id   uuid NOT NULL REFERENCES administration_structure_nodes (id),
  bed_id       uuid REFERENCES administration_structure_nodes (id),
  PRIMARY KEY (admission_id, seq)
);
CREATE INDEX IF NOT EXISTS ix_admission_movements_bed ON admission_movements (bed_id, at) WHERE bed_id IS NOT NULL;

CREATE OR REPLACE FUNCTION admission_movements_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admission_movements est en ajout seul : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admission_movements_immutable ON admission_movements;
CREATE TRIGGER trg_admission_movements_immutable BEFORE UPDATE OR DELETE ON admission_movements
  FOR EACH ROW EXECUTE FUNCTION admission_movements_immutable();
DROP TRIGGER IF EXISTS trg_admission_movements_no_truncate ON admission_movements;
CREATE TRIGGER trg_admission_movements_no_truncate BEFORE TRUNCATE ON admission_movements
  FOR EACH STATEMENT EXECUTE FUNCTION admission_movements_immutable();

-- Droits. Accueil et administrateur système : tous les services, lecture et écriture. Médecins et infirmiers : lecture et écriture dans
-- leur service (le périmètre vient des affectations du personnel). Les autres profils et le patient (portail) n'ont rien ici.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['admissions:read:all', 'admissions:write:all']) AS p ORDER BY p)
 WHERE code IN ('RECEPTIONIST', 'SYSTEM_ADMIN');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['admissions:read:department', 'admissions:write:department']) AS p ORDER BY p)
 WHERE code IN ('DOCTOR', 'NURSE');
