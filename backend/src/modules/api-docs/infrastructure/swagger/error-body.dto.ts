import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Erreur de validation d'un champ (présente dans `errors` quand `code` vaut `VALIDATION_FAILED`). */
export class FieldErrorDto {
  @ApiProperty({ description: 'Nom du champ en cause (chemin pointé pour les objets imbriqués).', example: 'username' })
  field!: string;

  @ApiProperty({ description: 'Règle violée, stable : à utiliser pour réagir par programme.', example: 'isString' })
  rule!: string;

  @ApiProperty({ description: "Message lisible dans la langue de la requête (`?lang=`, `X-Locale` ou `Accept-Language`).", example: 'Le champ « identifiant » doit être un texte.' })
  message!: string;
}

/** Forme unique de toutes les erreurs de la nouvelle API. */
export class ErrorBodyDto {
  @ApiProperty({ description: 'Statut HTTP.', example: 401 })
  statusCode!: number;

  @ApiProperty({ description: 'Code stable de l\'erreur (ne change jamais avec la langue) : les clients s\'appuient dessus.', example: 'INVALID_CREDENTIALS' })
  code!: string;

  @ApiProperty({ description: 'Message lisible dans la langue de la requête.', example: 'Identifiant ou mot de passe incorrect.' })
  message!: string;

  @ApiPropertyOptional({ description: 'Détail par champ, uniquement pour `VALIDATION_FAILED`.', type: [FieldErrorDto] })
  errors?: FieldErrorDto[];
}
