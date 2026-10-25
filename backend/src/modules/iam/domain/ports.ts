import { Instant } from '../../../shared-kernel/temporal';
import { Role } from './role';
import { User } from './user';
import { Email } from './value-objects/email';
import { PasswordHash } from './value-objects/password-hash';
import { PlainPassword } from './value-objects/plain-password';
import { RoleCode } from './value-objects/role-code';
import { UserId } from './value-objects/user-id';
import { Username } from './value-objects/username';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByUsername(username: Username): Promise<User | null>;
  existsByUsernameOrEmail(username: Username, email: Email): Promise<boolean>;
  /** Insère ou met à jour l'agrégat. */
  save(user: User): Promise<void>;
  list(offset: number, limit: number): Promise<{ items: User[]; total: number }>;
}

export interface RoleRepository {
  findByCodes(codes: readonly RoleCode[]): Promise<Role[]>;
  findAll(): Promise<Role[]>;
}

/** Hachage des mots de passe (adaptateur : Argon2id). */
export interface PasswordHasher {
  hash(password: PlainPassword): Promise<PasswordHash>;
  verify(hash: PasswordHash, password: PlainPassword): Promise<boolean>;
  /** Vrai si l'empreinte n'utilise pas les paramètres actuels et doit être recalculée à la prochaine connexion. */
  needsRehash(hash: PasswordHash): boolean;
  /** Dépense le même temps qu'une vérification réelle : appelé quand le compte n'existe pas ou est inutilisable (anti-chronométrage). */
  equalizeTiming(password: PlainPassword): Promise<void>;
}

/** Vérifie les empreintes héritées du backend .NET (3DES-ECB réversible). Sert uniquement à la migration vers Argon2id. */
export interface LegacyPasswordVerifier {
  verify(hash: PasswordHash, password: PlainPassword): boolean;
}

/** Vérification contre des listes de mots de passe compromis (p. ex. HIBP k-anonymity). Échec d'accès au service = on accepte. */
export interface BreachedPasswordChecker {
  isBreached(password: PlainPassword): Promise<boolean>;
}

export interface TotpService {
  generateSecret(): string;
  /** URI `otpauth://` à encoder en QR code côté client. */
  keyUri(secret: string, accountName: string, issuer: string): string;
  verify(secret: string, code: string): boolean;
}

/** Chiffrement réversible des secrets stockés (secret TOTP). */
export interface SecretCipher {
  encrypt(plain: string): string;
  decrypt(cipherText: string): string;
}

/**
 * Portée du jeton : `setup` n'autorise que le changement de mot de passe et l'inscription MFA
 * (compte à finaliser) ; `full` donne accès à l'application.
 */
export type TokenScope = 'full' | 'setup';

export interface AccessClaims {
  /** Fin de validité du jeton (renseignée par `verify`, absente à l'émission). */
  readonly expiresAt?: Instant;
  readonly userId: string;
  readonly username: string;
  readonly roles: readonly string[];
  readonly scope: TokenScope;
}

export interface TokenIssuer {
  issue(claims: AccessClaims): Promise<{ token: string; expiresAt: Instant }>;
  verify(token: string): Promise<AccessClaims | null>;
}

/**
 * Session de rafraîchissement. Le jeton remis au client est `<id>.<secret>` ; seul le hachage du secret est stocké.
 * Rotation à chaque usage ; la réutilisation d'un jeton déjà consommé révèle un vol et révoque toute la famille.
 */
export interface RefreshSession {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly secretHash: string;
  readonly expiresAt: Instant;
  readonly scope: TokenScope;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export interface RefreshSessionStore {
  create(session: RefreshSession): Promise<void>;
  find(id: string): Promise<{ session: RefreshSession; used: boolean } | null>;
  /** Marque la session consommée de façon atomique ; faux si elle l'était déjà (rejeu concurrent). */
  markUsed(id: string): Promise<boolean>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

/**
 * Services (départements) auxquels un utilisateur est rattaché aujourd'hui. Ils dépendent de l'organisation du personnel,
 * que l'IAM ignore : la racine de composition branche ce port sur le module Personnel. Sans lui, personne n'a de département.
 */
export interface DepartmentDirectory {
  departmentsOf(userId: string): Promise<readonly string[]>;
}

export const DEPARTMENT_DIRECTORY = Symbol('DEPARTMENT_DIRECTORY');
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const LEGACY_PASSWORD_VERIFIER = Symbol('LEGACY_PASSWORD_VERIFIER');
export const BREACHED_PASSWORD_CHECKER = Symbol('BREACHED_PASSWORD_CHECKER');
export const TOTP_SERVICE = Symbol('TOTP_SERVICE');
export const SECRET_CIPHER = Symbol('SECRET_CIPHER');
export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');
export const REFRESH_SESSION_STORE = Symbol('REFRESH_SESSION_STORE');
