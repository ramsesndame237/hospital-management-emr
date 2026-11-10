import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';
export const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'];

export class UserSummaryDto {
  @DocProperty({ description: 'Identifiant du compte.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'medecin' })
  username!: string;
}

export class RecordAllergyDto {
  @DocProperty({ description: 'Substance en cause (1 à 100 caractères) : un médicament, une classe, un aliment, le latex…', example: 'Pénicilline', minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  substance!: string;

  @DocProperty({ description: 'Réaction observée (200 caractères au plus).', example: 'Urticaire généralisée', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  reaction?: string | null;

  @DocProperty({ description: 'Gravité : `MILD`, `MODERATE` ou `SEVERE`.', example: 'SEVERE', enum: SEVERITIES })
  @IsString() @IsIn(SEVERITIES)
  severity!: string;
}

export class UpdateAllergyDto {
  @DocProperty({ description: 'Nouvelle réaction ; `null` l’efface.', example: 'Éruption cutanée', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  reaction?: string | null;

  @DocProperty({ description: 'Nouvelle gravité.', example: 'MODERATE', enum: SEVERITIES, optional: true })
  @IsOptional() @IsString() @IsIn(SEVERITIES)
  severity?: string;
}

export class VoidAllergyDto {
  @DocProperty({ description: 'Motif de la saisie erronée (1 à 200 caractères).', example: 'Saisie sur le mauvais dossier.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class AllergyDto {
  @DocProperty({ description: 'Identifiant de l’allergie.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant du patient.', example: ID_EXAMPLE, format: 'uuid' })
  patientId!: string;

  @DocProperty({ description: 'Substance en cause.', example: 'Pénicilline' })
  substance!: string;

  @DocProperty({ description: 'Réaction observée.', example: 'Urticaire généralisée', nullable: true })
  reaction!: string | null;

  @DocProperty({ description: 'Gravité.', example: 'SEVERE', enum: SEVERITIES })
  severity!: string;

  @DocProperty({ description: '`ACTIVE`, ou `ENTERED_IN_ERROR` (saisie déclarée erronée : elle reste au dossier mais sort de la liste active).', example: 'ACTIVE', enum: ['ACTIVE', 'ENTERED_IN_ERROR'] })
  status!: string;

  @DocProperty({ description: 'Qui l’a enregistrée.', type: UserSummaryDto, nullable: true })
  recordedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Enregistrée le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  recordedAt!: string;

  @DocProperty({ description: 'Qui l’a déclarée erronée.', type: UserSummaryDto, nullable: true })
  voidedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Déclarée erronée le.', example: null, format: 'date-time', nullable: true })
  voidedAt!: string | null;

  @DocProperty({ description: 'Motif de la saisie erronée.', example: null, nullable: true })
  voidReason!: string | null;
}
