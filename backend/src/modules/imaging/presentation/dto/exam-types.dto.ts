import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

export const MODALITIES = ['XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'OTHER'];

export class CreateExamTypeDto {
  @DocProperty({ description: "Code de l'examen (1 à 20 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique ; **ne pourra plus être modifié**.", example: 'RX-THORAX', maxLength: 20 })
  @IsString() @MaxLength(20)
  code!: string;

  @DocProperty({ description: "Libellé de l'examen.", example: 'Radiographie du thorax de face', minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @DocProperty({ description: 'Modalité. **Ne pourra plus être modifiée** : elle décide si l’examen est irradiant (radiographie, scanner, mammographie, scopie).', example: 'XRAY', enum: MODALITIES })
  @IsString() @IsIn(MODALITIES)
  modality!: string;

  @DocProperty({ description: 'Région examinée.', example: 'Thorax', maxLength: 60, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(60)
  bodyPart?: string | null;

  @DocProperty({ description: 'Examen avec produit de contraste (défaut `false`) : une allergie connue bloque la réalisation sans dérogation motivée.', example: false, optional: true })
  @IsOptional() @IsBoolean()
  usesContrast?: boolean;

  @DocProperty({ description: 'Durée prévue du créneau, en minutes (5 à 480 ; 30 par défaut).', example: 20, optional: true })
  @IsOptional() @IsInt() @Min(5) @Max(480)
  durationMinutes?: number;

  @DocProperty({ description: 'Préparation du patient (500 caractères au plus).', example: 'Retirer bijoux et objets métalliques.', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  preparation?: string | null;
}

export class UpdateExamTypeDto {
  @DocProperty({ description: 'Nouveau libellé.', example: 'Radiographie du thorax (face)', maxLength: 120, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @DocProperty({ description: 'Nouvelle région examinée ; `null` l’efface.', example: 'Thorax', maxLength: 60, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(60)
  bodyPart?: string | null;

  @DocProperty({ description: 'Avec ou sans produit de contraste.', example: false, optional: true })
  @IsOptional() @IsBoolean()
  usesContrast?: boolean;

  @DocProperty({ description: 'Nouvelle durée de créneau, en minutes (5 à 480).', example: 20, optional: true })
  @IsOptional() @IsInt() @Min(5) @Max(480)
  durationMinutes?: number;

  @DocProperty({ description: 'Nouvelle préparation ; `null` ou vide l’efface.', example: null, maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  preparation?: string | null;
}

export class ExamTypeDto {
  @DocProperty({ description: "Identifiant de l'examen.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'RX-THORAX' })
  code!: string;

  @DocProperty({ description: 'Libellé.', example: 'Radiographie du thorax de face' })
  name!: string;

  @DocProperty({ description: 'Modalité.', example: 'XRAY', enum: MODALITIES })
  modality!: string;

  @DocProperty({ description: 'Région examinée.', example: 'Thorax', nullable: true })
  bodyPart!: string | null;

  @DocProperty({ description: 'Examen avec produit de contraste.', example: false })
  usesContrast!: boolean;

  @DocProperty({ description: 'Durée prévue du créneau, en minutes.', example: 20 })
  durationMinutes!: number;

  @DocProperty({ description: 'Préparation du patient.', example: null, nullable: true })
  preparation!: string | null;

  @DocProperty({ description: 'Actif : peut être demandé.', example: true })
  active!: boolean;
}

export class ExamTypePageDto {
  @DocProperty({ description: "Examens de la page, triés par modalité puis code.", type: ExamTypeDto, itemType: ExamTypeDto })
  items!: readonly ExamTypeDto[];

  @DocProperty({ description: "Nombre total d'examens correspondants (toutes pages).", example: 24 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}
