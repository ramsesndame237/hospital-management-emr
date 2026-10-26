import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const STATUSES = ['SCHEDULED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'];
const START_HELP = "Début, au format ISO 8601 **avec fuseau** (ex. `2026-11-02T09:00:00+01:00`). Doit être dans le futur (un an au plus).";

/** Bornes de taille partout : pas de corps géants. Les règles précises (créneau, affectation du professionnel…) sont dans le domaine. */
export class ScheduleAppointmentDto {
  @DocProperty({ description: 'Identifiant du patient (champ `id` de `/api/v1/patients`).', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @DocProperty({ description: 'Identifiant de la fiche du professionnel qui reçoit (`/api/v1/staff`). Il doit être en poste et affecté au service ce jour-là.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' })
  @IsUUID()
  practitionerId!: string;

  @DocProperty({ description: 'Service ou unité du rendez-vous (`/api/v1/structure`).', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @DocProperty({ description: START_HELP, example: '2026-11-02T09:00:00+01:00', maxLength: 40 })
  @IsString() @MaxLength(40)
  startsAt!: string;

  @DocProperty({ description: 'Durée en minutes (5 à 240, par pas de 5).', example: 30 })
  @IsInt() @Min(1) @Max(1000)
  durationMinutes!: number;

  @DocProperty({ description: 'Motif : code actif du catalogue `VISIT_REASON` des référentiels (facultatif).', example: 'FOLLOW_UP', maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  reasonCode?: string;
}

export class RescheduleAppointmentDto {
  @DocProperty({ description: `Nouveau début. ${START_HELP}`, example: '2026-11-03T10:30:00+01:00', maxLength: 40, optional: true })
  @IsOptional() @IsString() @MaxLength(40)
  startsAt?: string;

  @DocProperty({ description: 'Nouvelle durée en minutes.', example: 45, optional: true })
  @IsOptional() @IsInt() @Min(1) @Max(1000)
  durationMinutes?: number;

  @DocProperty({ description: 'Nouveau professionnel.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  practitionerId?: string;

  @DocProperty({ description: 'Nouveau service ou nouvelle unité.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  locationId?: string;

  @DocProperty({ description: 'Nouveau motif ; `null` le retire.', example: 'FOLLOW_UP', maxLength: 32, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(32)
  reasonCode?: string | null;
}

export class CancelAppointmentDto {
  @DocProperty({ description: "Motif de l'annulation (obligatoire, 200 caractères au plus).", example: 'Demande du patient', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class AppointmentPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Élisabeth' })
  firstName!: string;
}

export class AppointmentPractitionerDto {
  @DocProperty({ description: 'Identifiant de la fiche du personnel.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Matricule.', example: 'MAT-0042' })
  staffNumber!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Curie' })
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Marie' })
  firstName!: string;
}

export class AppointmentDto {
  @DocProperty({ description: 'Identifiant du rendez-vous.', example: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro lisible.', example: 'RDV-0000045' })
  number!: string;

  @DocProperty({ description: '`SCHEDULED` (à venir), `ARRIVED` (patient présenté, admission ouverte), `CANCELLED`, `NO_SHOW` (patient absent).', example: 'SCHEDULED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Début (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  startsAt!: string;

  @DocProperty({ description: 'Fin (ISO 8601, UTC).', example: '2026-11-02T08:30:00Z', format: 'date-time' })
  endsAt!: string;

  @DocProperty({ description: 'Durée en minutes.', example: 30 })
  durationMinutes!: number;

  @DocProperty({ description: 'Le patient.', type: AppointmentPatientDto, nullable: true })
  patient!: AppointmentPatientDto | null;

  @DocProperty({ description: 'Le professionnel.', type: AppointmentPractitionerDto, nullable: true })
  practitioner!: AppointmentPractitionerDto | null;

  @DocProperty({ description: 'Service ou unité du rendez-vous.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  locationId!: string;

  @DocProperty({ description: 'Service dont dépend ce lieu (il borne les droits d\'accès).', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Motif (code).', example: 'FOLLOW_UP', nullable: true })
  reasonCode!: string | null;

  @DocProperty({ description: "Motif de l'annulation.", example: null, nullable: true })
  cancellationReason!: string | null;
}

export class AppointmentPageDto {
  @DocProperty({ description: 'Rendez-vous de la page, du plus proche au plus lointain.', type: AppointmentDto, itemType: AppointmentDto })
  items!: readonly AppointmentDto[];

  @DocProperty({ description: 'Nombre total de rendez-vous correspondants.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}
