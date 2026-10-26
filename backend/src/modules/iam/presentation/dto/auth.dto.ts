import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

/** Bornes de taille partout : pas de corps géants, et le hachage coûteux n'est jamais déclenché par un mot de passe démesuré. */
export class LoginDto {
  @DocProperty({ description: 'Identifiant de connexion (insensible à la casse).', example: 'marie.curie', maxLength: 64 })
  @IsString() @MinLength(1) @MaxLength(64)
  username!: string;

  @DocProperty({ description: 'Mot de passe.', example: 'votre mot de passe', maxLength: 1024 })
  @IsString() @MinLength(1) @MaxLength(1024)
  password!: string;

  @DocProperty({
    description: "Code à 6 chiffres de l'application d'authentification. À fournir quand la première tentative a répondu `mfa_required`.",
    example: '123456',
    optional: true,
  })
  @IsOptional() @IsString() @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'validation.sixDigits' })
  totpCode?: string;

  @DocProperty({ description: "Code de secours (usage unique), à la place du code de l'application.", example: 'ABCDE-FGHJK', optional: true, maxLength: 32 })
  @IsOptional() @IsString() @MaxLength(32)
  recoveryCode?: string;
}

export class ChangePasswordDto {
  @DocProperty({ description: 'Mot de passe actuel (ou provisoire).', example: 'mot de passe actuel', maxLength: 1024 })
  @IsString() @MinLength(1) @MaxLength(1024)
  currentPassword!: string;

  @DocProperty({
    description: "Nouveau mot de passe : au moins 12 caractères, pas dans les listes de mots de passe courants ou compromis, sans l'identifiant ni l'e-mail. Les phrases de passe sont encouragées ; aucune règle de composition n'est imposée.",
    example: 'une phrase de passe longue et unique',
    maxLength: 1024,
  })
  @IsString() @MinLength(1) @MaxLength(1024)
  newPassword!: string;
}

export class ActivateMfaDto {
  @DocProperty({ description: "Code à 6 chiffres affiché par l'application d'authentification après avoir scanné le QR code.", example: '123456' })
  @IsString() @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'validation.sixDigits' })
  code!: string;
}

export class CreateUserDto {
  @DocProperty({ description: 'Identifiant de connexion : 3 à 64 caractères (lettres, chiffres, « . », « _ », « - »).', example: 'pharmacien.un', minLength: 3, maxLength: 64 })
  @IsString() @MinLength(3) @MaxLength(64)
  username!: string;

  @DocProperty({ description: 'Adresse e-mail professionnelle.', example: 'p.un@hopital.example', format: 'email', maxLength: 254 })
  @IsEmail() @MaxLength(254)
  email!: string;

  @DocProperty({ description: 'Codes des rôles à attribuer (voir `GET /api/v1/roles`).', example: ['PHARMACIST'], itemType: 'string' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true })
  roles!: string[];
}

export class AssignRolesDto {
  @DocProperty({ description: "Nouvelle liste complète des rôles (elle remplace l'ancienne).", example: ['DOCTOR', 'NURSE'], itemType: 'string' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true })
  roles!: string[];
}
