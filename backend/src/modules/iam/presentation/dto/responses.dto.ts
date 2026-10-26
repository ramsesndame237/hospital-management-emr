import { DocProperty } from '../../../api-docs';

/**
 * Formes des réponses. Ces classes servent à deux choses : typer ce que renvoient les contrôleurs, et documenter
 * l'API (schémas et exemples dans la documentation interactive).
 */

export class TokenResponseDto {
  @DocProperty({ description: "Jeton d'accès JWT (15 minutes). À envoyer dans `Authorization: Bearer <jeton>` ; le garder en mémoire, pas dans le stockage du navigateur.", example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @DocProperty({ description: "Date d'expiration du jeton d'accès (ISO 8601, UTC).", example: '2026-10-23T10:15:00Z', format: 'date-time' })
  accessExpiresAt!: string;

  @DocProperty({
    description: "`full` : accès complet. `setup` : session restreinte, seules sont permises la lecture du profil, le changement de mot de passe et l'inscription à la double authentification.",
    example: 'full',
    enum: ['full', 'setup'],
  })
  scope!: 'full' | 'setup';
}

export class LoginResponseDto {
  @DocProperty({
    description: "`authenticated` : session ouverte (jeton d'accès dans la réponse, jeton de rafraîchissement en cookie `httpOnly`). `mfa_required` : mot de passe correct, renvoyer la requête avec `totpCode` ou `recoveryCode`.",
    example: 'authenticated',
    enum: ['authenticated', 'mfa_required'],
  })
  status!: 'authenticated' | 'mfa_required';

  @DocProperty({ description: "Jeton d'accès JWT (si `authenticated`).", example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', optional: true })
  accessToken?: string;

  @DocProperty({ description: "Expiration du jeton d'accès (si `authenticated`).", example: '2026-10-23T10:15:00Z', format: 'date-time', optional: true })
  accessExpiresAt?: string;

  @DocProperty({ description: 'Portée de la session (si `authenticated`).', example: 'full', enum: ['full', 'setup'], optional: true })
  scope?: 'full' | 'setup';

  @DocProperty({ description: "Le mot de passe provisoire doit être changé avant tout autre usage (si `authenticated`).", example: false, optional: true })
  mustChangePassword?: boolean;

  @DocProperty({ description: "Le profil exige la double authentification et elle n'est pas encore inscrite (si `authenticated`).", example: false, optional: true })
  mfaEnrollmentRequired?: boolean;
}

export class CurrentUserDto {
  @DocProperty({ description: 'Identifiant du compte.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'marie.curie' })
  username!: string;

  @DocProperty({ description: 'Adresse e-mail.', example: 'marie.curie@hopital.example' })
  email!: string;

  @DocProperty({ description: 'Codes des rôles.', example: ['DOCTOR'], itemType: 'string' })
  roles!: readonly string[];

  @DocProperty({ description: "Permissions effectives (`ressource:action:portée`). Sert à afficher ou masquer menus et boutons ; l'API revérifie toujours côté serveur.", example: ['files:upload:all', 'files.clinical:read:department'], itemType: 'string' })
  permissions!: readonly string[];

  @DocProperty({ description: 'La double authentification est activée.', example: true })
  mfaEnabled!: boolean;

  @DocProperty({ description: 'Les rôles du compte exigent la double authentification.', example: true })
  mfaRequired!: boolean;

  @DocProperty({ description: 'Le mot de passe provisoire doit être changé.', example: false })
  mustChangePassword!: boolean;

  @DocProperty({ description: 'Portée de la session courante.', example: 'full', enum: ['full', 'setup'] })
  scope!: 'full' | 'setup';
}

export class MfaEnrollmentDto {
  @DocProperty({ description: "URI `otpauth://` à transformer en QR code côté client pour l'application d'authentification.", example: 'otpauth://totp/Sanjeevani%20EMR:marie.curie%40hopital.example?secret=GEZDGNBVGY3TQOJQ&issuer=Sanjeevani%20EMR' })
  keyUri!: string;

  @DocProperty({ description: 'Secret en clair pour une saisie manuelle. Affiché une seule fois ; stocké chiffré côté serveur.', example: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' })
  secret!: string;
}

export class RecoveryCodesDto {
  @DocProperty({ description: 'Dix codes de secours à usage unique. Affichés une seule fois : à imprimer ou ranger dans un gestionnaire de mots de passe.', example: ['ABCDE-FGHJK', 'KMNPQ-RSTUV'], itemType: 'string' })
  recoveryCodes!: readonly string[];
}

export class UserDto {
  @DocProperty({ description: 'Identifiant du compte.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'pharmacien.un' })
  username!: string;

  @DocProperty({ description: 'Adresse e-mail.', example: 'p.un@hopital.example' })
  email!: string;

  @DocProperty({ description: 'Codes des rôles.', example: ['PHARMACIST'], itemType: 'string' })
  roles!: readonly string[];

  @DocProperty({ description: 'Compte actif (non désactivé).', example: true })
  active!: boolean;

  @DocProperty({ description: 'Compte verrouillé temporairement après des échecs de connexion.', example: false })
  locked!: boolean;

  @DocProperty({ description: 'La double authentification est activée.', example: false })
  mfaEnabled!: boolean;

  @DocProperty({ description: 'Le mot de passe provisoire doit être changé à la prochaine connexion.', example: true })
  mustChangePassword!: boolean;
}

export class UserPageDto {
  @DocProperty({ description: 'Comptes de la page demandée.', type: UserDto, itemType: UserDto })
  items!: readonly UserDto[];

  @DocProperty({ description: 'Nombre total de comptes (toutes pages).', example: 42 })
  total!: number;
}

export class CreatedUserDto {
  @DocProperty({ description: 'Le compte créé.', type: UserDto })
  user!: UserDto;

  @DocProperty({ description: "Mot de passe provisoire (16 caractères aléatoires). Renvoyé UNE SEULE FOIS : à transmettre à l'utilisateur par un canal sûr. Il devra le changer à sa première connexion.", example: 'k7Qm2xWvB9nRtE4y' })
  temporaryPassword!: string;
}

export class RoleDto {
  @DocProperty({ description: 'Code du rôle.', example: 'DOCTOR' })
  code!: string;

  @DocProperty({ description: 'Libellé.', example: 'Médecin' })
  name!: string;

  @DocProperty({ description: 'Ce rôle exige la double authentification.', example: true })
  requiresMfa!: boolean;

  @DocProperty({ description: 'Rôle fourni par le système (non modifiable depuis l\'interface).', example: true })
  isSystem!: boolean;

  @DocProperty({ description: 'Permissions accordées (`ressource:action:portée`, portée : `own` < `department` < `all`).', example: ['files:upload:all', 'files.clinical:read:department'], itemType: 'string' })
  permissions!: readonly string[];
}
