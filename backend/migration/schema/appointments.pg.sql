-- Module Rendez-vous. Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam, administration, référentiels, personnel et patients (clés étrangères) ; les permissions du module
-- sont ajoutées en fin de script, après que iam.pg.sql a recréé les rôles système.

CREATE SEQUENCE IF NOT EXISTS appointments_number_seq;

CREATE TABLE IF NOT EXISTS appointments (
  id                  uuid PRIMARY KEY,
  appointment_number  text NOT NULL CHECK (appointment_number ~ '^RDV-[0-9]{7,12}$'),
  patient_id          uuid NOT NULL REFERENCES patients (id),
  practitioner_id     uuid NOT NULL REFERENCES staff_members (id),
  -- service ou unité du rendez-vous, et service dont il dépend (c'est lui qui borne les droits d'accès)
  location_id         uuid NOT NULL REFERENCES administration_structure_nodes (id),
  service_id          uuid NOT NULL REFERENCES administration_structure_nodes (id),
  starts_at           timestamptz NOT NULL,
  duration_minutes    integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 240 AND duration_minutes % 5 = 0),
  -- fin du créneau, calculée par l'application (début + durée) et stockée pour chercher les chevauchements
  ends_at             timestamptz NOT NULL,
  reason_code         text,
  status              text NOT NULL CHECK (status IN ('SCHEDULED', 'ARRIVED', 'CANCELLED', 'NO_SHOW')),
  cancellation_reason text CHECK (cancellation_reason IS NULL OR length(cancellation_reason) <= 200),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((status = 'CANCELLED') = (cancellation_reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_number ON appointments (appointment_number);
-- Agenda d'un professionnel et d'un patient, limité aux rendez-vous actifs (les seuls qui occupent un créneau).
CREATE INDEX IF NOT EXISTS ix_appointments_practitioner ON appointments (practitioner_id, starts_at) WHERE status IN ('SCHEDULED', 'ARRIVED');
CREATE INDEX IF NOT EXISTS ix_appointments_patient ON appointments (patient_id, starts_at) WHERE status IN ('SCHEDULED', 'ARRIVED');
CREATE INDEX IF NOT EXISTS ix_appointments_service_time ON appointments (service_id, starts_at);

-- Droits. Accueil et administrateur système : tous les services, lecture et écriture. Médecins : les rendez-vous de leur service
-- (lecture et écriture). Infirmiers : lecture des rendez-vous de leur service. Le périmètre « service » vient des affectations du
-- personnel (voir le module Personnel). Les autres profils et le patient (portail) n'ont rien ici.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['appointments:read:all', 'appointments:write:all']) AS p ORDER BY p)
 WHERE code IN ('RECEPTIONIST', 'SYSTEM_ADMIN');

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['appointments:read:department', 'appointments:write:department']) AS p ORDER BY p)
 WHERE code = 'DOCTOR';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['appointments:read:department']) AS p ORDER BY p)
 WHERE code = 'NURSE';
