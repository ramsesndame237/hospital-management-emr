-- Module Référentiels : nomenclatures (spécialités, unités de mesure, motifs…). Idempotent : peut être rejoué à chaque déploiement.
-- À appliquer APRÈS iam.pg.sql (qui recrée les rôles système) : les permissions du module sont ajoutées en fin de script.

-- Les catalogues sont définis par l'application (le code métier y fait référence) ; leurs entrées sont gérées par les administrateurs.
CREATE TABLE IF NOT EXISTS referentials_catalogs (
  code   text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  -- { "fr": "...", "en": "..." } : au moins une langue
  labels jsonb NOT NULL CHECK (jsonb_typeof(labels) = 'object' AND labels <> '{}'::jsonb)
);

-- Une entrée n'est jamais supprimée (d'autres données y renvoient) : on la désactive. Son code ne change jamais.
CREATE TABLE IF NOT EXISTS referentials_entries (
  id           uuid PRIMARY KEY,
  catalog_code text NOT NULL REFERENCES referentials_catalogs (code),
  code         text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,31}$'),
  labels       jsonb NOT NULL CHECK (jsonb_typeof(labels) = 'object' AND labels <> '{}'::jsonb),
  sort_order   integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 100000),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_code, code)
);
CREATE INDEX IF NOT EXISTS ix_referentials_entries_list ON referentials_entries (catalog_code, active, sort_order, code);

INSERT INTO referentials_catalogs (code, labels) VALUES
  ('SPECIALTY',        jsonb_build_object('fr', 'Spécialités médicales', 'en', 'Medical specialties')),
  ('MEASUREMENT_UNIT', jsonb_build_object('fr', 'Unités de mesure',      'en', 'Units of measurement')),
  ('VISIT_REASON',     jsonb_build_object('fr', 'Motifs de consultation', 'en', 'Reasons for visit')),
  ('PROFESSION',       jsonb_build_object('fr', 'Professions et fonctions', 'en', 'Professions and job functions'))
ON CONFLICT (code) DO UPDATE SET labels = EXCLUDED.labels;

-- Valeurs de départ. `DO NOTHING` : une entrée modifiée ou désactivée par un administrateur n'est jamais ramenée à son état d'origine.
INSERT INTO referentials_entries (id, catalog_code, code, labels, sort_order)
SELECT gen_random_uuid(), v.catalog, v.code, v.labels, v.sort_order
FROM (VALUES
  ('SPECIALTY', 'GENERAL_MEDICINE',      jsonb_build_object('fr', 'Médecine générale',          'en', 'General medicine'),         10),
  ('SPECIALTY', 'INTERNAL_MEDICINE',     jsonb_build_object('fr', 'Médecine interne',           'en', 'Internal medicine'),        20),
  ('SPECIALTY', 'PEDIATRICS',            jsonb_build_object('fr', 'Pédiatrie',                  'en', 'Paediatrics'),              30),
  ('SPECIALTY', 'OBSTETRICS_GYNECOLOGY', jsonb_build_object('fr', 'Gynécologie-obstétrique',    'en', 'Obstetrics and gynaecology'), 40),
  ('SPECIALTY', 'GENERAL_SURGERY',       jsonb_build_object('fr', 'Chirurgie générale',         'en', 'General surgery'),          50),
  ('SPECIALTY', 'CARDIOLOGY',            jsonb_build_object('fr', 'Cardiologie',                'en', 'Cardiology'),               60),
  ('SPECIALTY', 'EMERGENCY_MEDICINE',    jsonb_build_object('fr', 'Médecine d''urgence',        'en', 'Emergency medicine'),       70),
  ('SPECIALTY', 'ANESTHESIOLOGY',        jsonb_build_object('fr', 'Anesthésie-réanimation',     'en', 'Anaesthesiology and intensive care'), 80),
  ('SPECIALTY', 'RADIOLOGY',             jsonb_build_object('fr', 'Radiologie',                 'en', 'Radiology'),                90),
  ('SPECIALTY', 'OPHTHALMOLOGY',         jsonb_build_object('fr', 'Ophtalmologie',              'en', 'Ophthalmology'),           100),
  ('SPECIALTY', 'DENTISTRY',             jsonb_build_object('fr', 'Médecine dentaire',          'en', 'Dentistry'),               110),
  ('SPECIALTY', 'PSYCHIATRY',            jsonb_build_object('fr', 'Psychiatrie',                'en', 'Psychiatry'),              120),

  ('MEASUREMENT_UNIT', 'KG',     jsonb_build_object('fr', 'Kilogramme (kg)',                'en', 'Kilogram (kg)'),              10),
  ('MEASUREMENT_UNIT', 'G',      jsonb_build_object('fr', 'Gramme (g)',                     'en', 'Gram (g)'),                   20),
  ('MEASUREMENT_UNIT', 'MG',     jsonb_build_object('fr', 'Milligramme (mg)',               'en', 'Milligram (mg)'),             30),
  ('MEASUREMENT_UNIT', 'CM',     jsonb_build_object('fr', 'Centimètre (cm)',                'en', 'Centimetre (cm)'),            40),
  ('MEASUREMENT_UNIT', 'ML',     jsonb_build_object('fr', 'Millilitre (mL)',                'en', 'Millilitre (mL)'),            50),
  ('MEASUREMENT_UNIT', 'CELSIUS', jsonb_build_object('fr', 'Degré Celsius (°C)',            'en', 'Degree Celsius (°C)'),        60),
  ('MEASUREMENT_UNIT', 'MMHG',   jsonb_build_object('fr', 'Millimètre de mercure (mmHg)',   'en', 'Millimetre of mercury (mmHg)'), 70),
  ('MEASUREMENT_UNIT', 'BPM',    jsonb_build_object('fr', 'Battements par minute (bpm)',    'en', 'Beats per minute (bpm)'),     80),
  ('MEASUREMENT_UNIT', 'PERCENT', jsonb_build_object('fr', 'Pourcentage (%)',               'en', 'Percent (%)'),                90),
  ('MEASUREMENT_UNIT', 'G_DL',   jsonb_build_object('fr', 'Gramme par décilitre (g/dL)',    'en', 'Gram per decilitre (g/dL)'), 100),
  ('MEASUREMENT_UNIT', 'MMOL_L', jsonb_build_object('fr', 'Millimole par litre (mmol/L)',   'en', 'Millimole per litre (mmol/L)'), 110),

  ('PROFESSION', 'DOCTOR', jsonb_build_object('fr', 'Médecin', 'en', 'Physician'), 10),
  ('PROFESSION', 'NURSE', jsonb_build_object('fr', 'Infirmier(ère)', 'en', 'Nurse'), 20),
  ('PROFESSION', 'MIDWIFE', jsonb_build_object('fr', 'Sage-femme', 'en', 'Midwife'), 30),
  ('PROFESSION', 'PHARMACIST', jsonb_build_object('fr', 'Pharmacien(ne)', 'en', 'Pharmacist'), 40),
  ('PROFESSION', 'LAB_TECHNICIAN', jsonb_build_object('fr', 'Technicien(ne) de laboratoire', 'en', 'Laboratory technician'), 50),
  ('PROFESSION', 'RADIOGRAPHER', jsonb_build_object('fr', 'Manipulateur(trice) en imagerie médicale', 'en', 'Radiographer'), 60),
  ('PROFESSION', 'NURSING_AIDE', jsonb_build_object('fr', 'Aide-soignant(e)', 'en', 'Nursing assistant'), 70),
  ('PROFESSION', 'ADMINISTRATIVE_STAFF', jsonb_build_object('fr', 'Personnel administratif', 'en', 'Administrative staff'), 80),
  ('PROFESSION', 'CASHIER', jsonb_build_object('fr', 'Caissier(ère)', 'en', 'Cashier'), 90),
  ('PROFESSION', 'ACCOUNTANT', jsonb_build_object('fr', 'Comptable', 'en', 'Accountant'), 100),
  ('PROFESSION', 'MAINTENANCE_TECHNICIAN', jsonb_build_object('fr', 'Technicien(ne) de maintenance', 'en', 'Maintenance technician'), 110),
  ('PROFESSION', 'IT_STAFF', jsonb_build_object('fr', 'Informaticien(ne)', 'en', 'IT staff'), 120),
  ('PROFESSION', 'HOUSEKEEPING', jsonb_build_object('fr', 'Agent d''entretien', 'en', 'Housekeeping staff'), 130),
  ('PROFESSION', 'SECURITY', jsonb_build_object('fr', 'Agent de sécurité', 'en', 'Security officer'), 140),

  ('VISIT_REASON', 'ROUTINE_CONSULTATION', jsonb_build_object('fr', 'Consultation courante',      'en', 'Routine consultation'),   10),
  ('VISIT_REASON', 'FOLLOW_UP',            jsonb_build_object('fr', 'Suivi',                      'en', 'Follow-up'),              20),
  ('VISIT_REASON', 'EMERGENCY',            jsonb_build_object('fr', 'Urgence',                    'en', 'Emergency'),              30),
  ('VISIT_REASON', 'VACCINATION',          jsonb_build_object('fr', 'Vaccination',                'en', 'Vaccination'),            40),
  ('VISIT_REASON', 'PRENATAL_CARE',        jsonb_build_object('fr', 'Consultation prénatale',     'en', 'Prenatal care'),          50),
  ('VISIT_REASON', 'POSTNATAL_CARE',       jsonb_build_object('fr', 'Consultation postnatale',    'en', 'Postnatal care'),         60),
  ('VISIT_REASON', 'MEDICAL_CERTIFICATE',  jsonb_build_object('fr', 'Certificat médical',         'en', 'Medical certificate'),    70)
) AS v(catalog, code, labels, sort_order)
ON CONFLICT (catalog_code, code) DO NOTHING;

-- Permissions du module, ajoutées aux rôles système sans écraser les autres (réexécutable : pas de doublon).
-- Tout le personnel lit les nomenclatures (formulaires, listes déroulantes) ; seul l'administrateur système les gère.
-- Le patient (portail) n'en a pas besoin.
UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['referentials:read']) AS p ORDER BY p)
 WHERE is_system AND code <> 'PATIENT';

UPDATE iam_roles
   SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['referentials:manage']) AS p ORDER BY p)
 WHERE code = 'SYSTEM_ADMIN';
