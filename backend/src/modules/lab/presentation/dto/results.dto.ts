import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const METHODS = ['PHONE', 'IN_PERSON', 'SECURE_MESSAGE'];

export class EnterResultDto {
  @DocProperty({
    description: "Valeur du résultat : un nombre (virgule ou point, 6 décimales au plus) pour une analyse numérique, une des valeurs admises pour une analyse à choix, un texte (2000 caractères au plus) sinon.",
    example: '9.4', maxLength: 2000,
  })
  @IsString() @MinLength(1) @MaxLength(2000)
  value!: string;

  @DocProperty({ description: 'Commentaire du technicien (300 caractères au plus).', example: 'Contrôlé sur un second passage.', maxLength: 300, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(300)
  comment?: string | null;
}

export class AmendResultDto extends EnterResultDto {
  @DocProperty({ description: "Motif de l'amendement (obligatoire, 200 caractères au plus).", example: 'Erreur de transcription', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class ReturnResultDto {
  @DocProperty({ description: 'Motif du renvoi (obligatoire, 200 caractères au plus).', example: 'Valeur incohérente avec le précédent résultat', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class CriticalNotificationInputDto {
  @DocProperty({ description: 'Nom de la personne prévenue (100 caractères au plus).', example: 'Dr Curie', maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  notifiedName!: string;

  @DocProperty({ description: 'Fonction de la personne prévenue (60 caractères au plus).', example: 'Médecin de garde', maxLength: 60 })
  @IsString() @MinLength(1) @MaxLength(60)
  notifiedRole!: string;

  @DocProperty({ description: 'Moyen : `PHONE`, `IN_PERSON` ou `SECURE_MESSAGE`.', example: 'PHONE', enum: METHODS })
  @IsString() @IsIn(METHODS)
  method!: string;

  @DocProperty({ description: 'La personne prévenue a relu la valeur à voix haute : **doit être vrai**.', example: true })
  @IsBoolean()
  readBackConfirmed!: boolean;
}
