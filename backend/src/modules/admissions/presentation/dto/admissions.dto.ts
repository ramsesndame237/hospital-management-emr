import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const TYPES = ['OUTPATIENT', 'EMERGENCY', 'INPATIENT'];
const STATUSES = ['IN_PROGRESS', 'DISCHARGED', 'CANCELLED'];
const DISCHARGES = ['HOME', 'TRANSFERRED_OUT', 'LEFT_AGAINST_ADVICE', 'DECEASED', 'OTHER'];
const ISO = 'Date et heure ISO 8601 **avec fuseau** (ex. `2026-11-02T09:00:00+01:00`).';

/** Bornes de taille partout : pas de corps géants. Les règles précises (lit libre, affectation, cohérence) sont dans le domaine. */
export class OpenAdmissionDto {
  @DocProperty({ description: 'Identifiant du patient (champ `id` de `/api/v1/patients`). Un patient non identifié (identité `PROVISIONAL`) peut être admis.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @DocProperty({ description: "`OUTPATIENT` (consultation ou soin sans nuit), `EMERGENCY` (urgence) ou `INPATIENT` (hospitalisation : un lit est exigé).", example: 'INPATIENT', enum: TYPES })
  @IsString() @MaxLength(16)
  type!: string;

  @DocProperty({ description: "Service ou unité (`/api/v1/structure`). Obligatoire hors hospitalisation (sauf si `appointmentId` le donne) ; pour une hospitalisation il se déduit du lit, et s'il est indiqué il doit y correspondre.", example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  serviceId?: string;

  @DocProperty({ description: "Lit (élément de niveau `BED` de la structure), libre et actif. Uniquement pour une hospitalisation.", example: '4d5e6f70-8192-4a3b-9c4d-5e6f708192a3', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  bedId?: string;

  @DocProperty({ description: 'Professionnel responsable (fiche du personnel), en poste et affecté au service ce jour-là.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  practitionerId?: string;

  @DocProperty({ description: 'Rendez-vous honoré par cette admission : il doit être à venir et concerner ce patient. Il passe à `ARRIVED`.', example: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  appointmentId?: string;

  @DocProperty({ description: 'Motif : code actif du catalogue `VISIT_REASON` des référentiels.', example: 'EMERGENCY', maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  reasonCode?: string;

  @DocProperty({ description: `Heure d'arrivée (maintenant par défaut ; au plus 48 heures dans le passé, jamais dans le futur). ${ISO}`, example: '2026-11-02T09:00:00+01:00', maxLength: 40, optional: true })
  @IsOptional() @IsString() @MaxLength(40)
  admittedAt?: string;
}

export class TransferAdmissionDto {
  @DocProperty({ description: "Nouveau lit (hospitalisation) : libre et actif ; le service est celui du lit.", example: '4d5e6f70-8192-4a3b-9c4d-5e6f708192a3', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  bedId?: string;

  @DocProperty({ description: "Nouveau service ou nouvelle unité (admission sans lit).", example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  serviceId?: string;
}

export class DischargeAdmissionDto {
  @DocProperty({ description: 'Nature de la sortie : domicile, transfert vers un autre établissement, sortie contre avis médical, décès, autre. `DECEASED` n\'enregistre pas le décès du patient (`POST /patients/{id}/death`).', example: 'HOME', enum: DISCHARGES })
  @IsString() @MaxLength(24)
  type!: string;

  @DocProperty({ description: `Heure de sortie (maintenant par défaut ; entre l'arrivée et maintenant). ${ISO}`, example: '2026-11-05T11:30:00+01:00', maxLength: 40, optional: true })
  @IsOptional() @IsString() @MaxLength(40)
  at?: string;
}

export class CancelAdmissionDto {
  @DocProperty({ description: "Motif de l'annulation (obligatoire, 200 caractères au plus) : admission ouverte par erreur.", example: 'Mauvais patient', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class AdmissionPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Élisabeth' })
  firstName!: string;
}

export class AdmissionBedDto {
  @DocProperty({ description: 'Identifiant du lit.', example: '4d5e6f70-8192-4a3b-9c4d-5e6f708192a3', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code du lit.', example: 'B1' })
  code!: string;

  @DocProperty({ description: 'Nom du lit.', example: 'Lit 1' })
  name!: string;

  @DocProperty({ description: 'Où se trouve le lit dans son service (unité › salle) : plusieurs lits portent le même code dans des salles différentes.', example: 'Néonatologie › Salle 1' })
  location!: string;
}

export class AdmissionPractitionerDto {
  @DocProperty({ description: 'Identifiant de la fiche du personnel.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Matricule.', example: 'MAT-0042' })
  staffNumber!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Curie' })
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Marie' })
  firstName!: string;
}

export class AdmissionDto {
  @DocProperty({ description: "Identifiant de l'admission.", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro lisible.', example: 'ADM-0000045' })
  number!: string;

  @DocProperty({ description: 'Nature.', example: 'INPATIENT', enum: TYPES })
  type!: string;

  @DocProperty({ description: '`IN_PROGRESS`, `DISCHARGED` (sortie enregistrée) ou `CANCELLED` (ouverte par erreur).', example: 'IN_PROGRESS', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Le patient.', type: AdmissionPatientDto, nullable: true })
  patient!: AdmissionPatientDto | null;

  @DocProperty({ description: 'Service responsable (il borne les droits d\'accès).', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Lit occupé (hospitalisation en cours seulement ; libéré à la sortie).', type: AdmissionBedDto, nullable: true })
  bed!: AdmissionBedDto | null;

  @DocProperty({ description: 'Professionnel responsable.', type: AdmissionPractitionerDto, nullable: true })
  practitioner!: AdmissionPractitionerDto | null;

  @DocProperty({ description: 'Rendez-vous honoré.', example: null, format: 'uuid', nullable: true })
  appointmentId!: string | null;

  @DocProperty({ description: 'Motif (code).', example: 'EMERGENCY', nullable: true })
  reasonCode!: string | null;

  @DocProperty({ description: "Arrivée (ISO 8601, UTC).", example: '2026-11-02T08:00:00Z', format: 'date-time' })
  admittedAt!: string;

  @DocProperty({ description: 'Sortie (ISO 8601, UTC).', example: null, nullable: true })
  dischargedAt!: string | null;

  @DocProperty({ description: 'Nature de la sortie.', example: null, enum: DISCHARGES, nullable: true })
  dischargeType!: string | null;

  @DocProperty({ description: "Motif de l'annulation.", example: null, nullable: true })
  cancellationReason!: string | null;
}

export class AdmissionPageDto {
  @DocProperty({ description: 'Admissions de la page, des plus récentes aux plus anciennes.', type: AdmissionDto, itemType: AdmissionDto })
  items!: readonly AdmissionDto[];

  @DocProperty({ description: "Nombre total d'admissions correspondantes.", example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

export class MovementDto {
  @DocProperty({ description: 'Rang du mouvement (1 = arrivée).', example: 2 })
  seq!: number;

  @DocProperty({ description: '`ADMISSION`, `TRANSFER`, `DISCHARGE` ou `CANCELLATION`.', example: 'TRANSFER', enum: ['ADMISSION', 'TRANSFER', 'DISCHARGE', 'CANCELLATION'] })
  kind!: string;

  @DocProperty({ description: 'Heure (ISO 8601, UTC).', example: '2026-11-03T09:00:00Z', format: 'date-time' })
  at!: string;

  @DocProperty({ description: 'Compte qui a fait le mouvement.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73' })
  actorId!: string;

  @DocProperty({ description: 'Service concerné.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Lit concerné (nouveau lit après un transfert, lit libéré pour une sortie ou une annulation).', example: '4d5e6f70-8192-4a3b-9c4d-5e6f708192a3', nullable: true })
  bedId!: string | null;
}

export class OccupancyBedDto {
  @DocProperty({ description: 'Identifiant du lit.', example: '4d5e6f70-8192-4a3b-9c4d-5e6f708192a3', format: 'uuid' })
  bedId!: string;

  @DocProperty({ description: 'Code du lit.', example: 'B1' })
  code!: string;

  @DocProperty({ description: 'Nom du lit.', example: 'Lit 1' })
  name!: string;

  @DocProperty({ description: 'Où se trouve le lit dans son service (unité › salle).', example: 'Néonatologie › Salle 1' })
  location!: string;

  @DocProperty({ description: 'Faux si le lit est désactivé (hors capacité).', example: true })
  active!: boolean;

  @DocProperty({ description: 'Le lit est occupé.', example: true })
  occupied!: boolean;

  @DocProperty({ description: "Admission qui l'occupe.", example: null, format: 'uuid', nullable: true })
  admissionId!: string | null;

  @DocProperty({ description: "L'occupant.", type: AdmissionPatientDto, nullable: true })
  patient!: AdmissionPatientDto | null;
}

export class OccupancyDto {
  @DocProperty({ description: 'Service.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Lits actifs du service.', example: 20 })
  capacity!: number;

  @DocProperty({ description: 'Lits actifs occupés.', example: 14 })
  occupied!: number;

  @DocProperty({ description: 'Lits actifs libres.', example: 6 })
  free!: number;

  @DocProperty({ description: 'Tous les lits du service, par code.', type: OccupancyBedDto, itemType: OccupancyBedDto })
  beds!: readonly OccupancyBedDto[];
}
