import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { REDIS } from '../../platform/platform.module';
import type { RedisClient } from '../../platform/platform.module';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { Temporal } from '../../shared-kernel/temporal';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { CACHE, CachePort } from '../cache/cache.port';
import { AccessDecider } from './application/access-decider';
import { PermissionResolver } from './application/permission-resolver';
import { SessionIssuer } from './application/session-issuer';
import { ChangePasswordUseCase } from './application/use-cases/change-password';
import { GetCurrentUserUseCase } from './application/use-cases/current-user';
import { LoginUseCase } from './application/use-cases/login';
import { LogoutUseCase } from './application/use-cases/logout';
import { CreateUserUseCase, ListUsersUseCase, ManageUserUseCases } from './application/use-cases/manage-users';
import { ActivateMfaUseCase, BeginMfaEnrollmentUseCase } from './application/use-cases/mfa';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session';
import { GetUserAccessUseCase } from './application/use-cases/user-access';
import {
  BREACHED_PASSWORD_CHECKER, BreachedPasswordChecker, DEPARTMENT_DIRECTORY, DepartmentDirectory, LEGACY_PASSWORD_VERIFIER, LegacyPasswordVerifier, PASSWORD_HASHER,
  PasswordHasher, REFRESH_SESSION_STORE, RefreshSessionStore, ROLE_REPOSITORY, RoleRepository, SECRET_CIPHER, SecretCipher,
  TOKEN_ISSUER, TOTP_SERVICE, TokenIssuer, TotpService, USER_REPOSITORY, UserRepository,
} from './domain/ports';
import { AesGcmSecretCipher } from './infrastructure/crypto/aes-gcm-secret-cipher';
import { Argon2PasswordHasher } from './infrastructure/crypto/argon2-password-hasher';
import { HibpBreachedPasswordChecker, NoBreachedPasswordChecker } from './infrastructure/crypto/hibp-breached-password-checker';
import { JwtTokenIssuer } from './infrastructure/crypto/jwt-token-issuer';
import { Legacy3desVerifier } from './infrastructure/crypto/legacy-3des-verifier';
import { OtplibTotpService } from './infrastructure/crypto/otplib-totp.service';
import { PgRoleRepository } from './infrastructure/persistence/pg-role.repository';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
import { MemoryRefreshSessionStore } from './infrastructure/sessions/memory-refresh-session-store';
import { RedisRefreshSessionStore } from './infrastructure/sessions/redis-refresh-session-store';
import { AuthController } from './presentation/auth.controller';
import { AuthGuard } from './presentation/guards/auth.guard';
import { PermissionCatalog } from './presentation/permission-catalog';
import { PermissionsGuard } from './presentation/guards/permissions.guard';
import { RefreshCookie } from './presentation/refresh-cookie';
import { UsersController } from './presentation/users.controller';

/**
 * Module Identité & accès. C'est ici, et seulement ici, que les ports du domaine sont reliés à leurs adaptateurs
 * concrets (Argon2, Redis, PostgreSQL…). Changer d'adaptateur = changer une ligne de ce fichier.
 */
@Module({})
export class IamModule {
  /** `rateLimiting: false` n'est destiné qu'aux tests qui enchaînent des dizaines de connexions depuis la même adresse. */
  static register(options: { rateLimiting?: boolean } = {}): DynamicModule {
    const rateLimiting = options.rateLimiting ?? true;
    return {
      module: IamModule,
      // Global : la racine de composition (`src/integration`) en consomme les services sans réimporter (ni dupliquer) le module.
      global: true,
      imports: [DiscoveryModule, ...(rateLimiting ? [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])] : [])],
      controllers: [AuthController, UsersController],
      providers: [
        // --- adaptateurs ---
        { provide: USER_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgUserRepository(sql) },
        { provide: ROLE_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgRoleRepository(sql) },
        { provide: PASSWORD_HASHER, useFactory: () => new Argon2PasswordHasher() },
        {
          provide: LEGACY_PASSWORD_VERIFIER,
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => new Legacy3desVerifier(cfg.get<string>('LEGACY_PASSWORD_SALT') ?? ''),
        },
        {
          provide: BREACHED_PASSWORD_CHECKER,
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => (cfg.get<boolean>('BREACH_CHECK_ENABLED') ? new HibpBreachedPasswordChecker() : new NoBreachedPasswordChecker()),
        },
        { provide: TOTP_SERVICE, useFactory: () => new OtplibTotpService() },
        {
          provide: SECRET_CIPHER,
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => {
            const key = cfg.get<string>('SECRET_ENCRYPTION_KEY');
            if (key) return new AesGcmSecretCipher(key);
            // validateEnv l'interdit en production ; en développement la clé est éphémère (les secrets MFA ne survivent pas au redémarrage).
            new Logger('Iam').warn('SECRET_ENCRYPTION_KEY absent : clé éphémère (développement uniquement).');
            return new AesGcmSecretCipher(randomBytes(32).toString('base64'));
          },
        },
        {
          provide: TOKEN_ISSUER,
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => {
            const secret = cfg.get<string>('JWT_SECRET') ?? '';
            if (secret.length < 32) throw new Error('JWT_SECRET doit faire au moins 32 caractères.');
            return new JwtTokenIssuer(new JwtService(), {
              secret,
              issuer: cfg.getOrThrow<string>('JWT_ISSUER'),
              audience: cfg.getOrThrow<string>('JWT_AUDIENCE'),
              ttlMinutes: cfg.getOrThrow<number>('ACCESS_TOKEN_MINUTES'),
            });
          },
        },
        {
          provide: REFRESH_SESSION_STORE,
          inject: [REDIS],
          useFactory: (redis: RedisClient | null) => (redis ? new RedisRefreshSessionStore(redis) : new MemoryRefreshSessionStore()),
        },
        { provide: RefreshCookie, inject: [ConfigService], useFactory: (cfg: ConfigService) => new RefreshCookie(cfg.get<boolean>('COOKIE_SECURE') ?? true) },

        // --- services applicatifs ---
        {
          provide: SessionIssuer,
          inject: [TOKEN_ISSUER, REFRESH_SESSION_STORE, ID_GENERATOR, CLOCK, ConfigService],
          useFactory: (t: TokenIssuer, s: RefreshSessionStore, ids: IdGenerator, c: Clock, cfg: ConfigService) =>
            new SessionIssuer(t, s, ids, c, Temporal.Duration.from({ hours: 24 * cfg.getOrThrow<number>('REFRESH_TOKEN_DAYS') })),
        },
        {
          provide: PermissionResolver,
          inject: [USER_REPOSITORY, ROLE_REPOSITORY, CACHE],
          useFactory: (u: UserRepository, r: RoleRepository, c: CachePort) => new PermissionResolver(u, r, c),
        },

        {
          // Annuaire des services facultatif : fourni par la racine de composition quand le module Personnel est présent.
          provide: AccessDecider,
          inject: [PermissionResolver, { token: DEPARTMENT_DIRECTORY, optional: true }],
          useFactory: (r: PermissionResolver, d: DepartmentDirectory | undefined) => new AccessDecider(r, d ?? null),
        },
        PermissionCatalog,

        // --- cas d'usage ---
        {
          provide: LoginUseCase,
          inject: [USER_REPOSITORY, ROLE_REPOSITORY, PASSWORD_HASHER, LEGACY_PASSWORD_VERIFIER, TOTP_SERVICE, SECRET_CIPHER, SessionIssuer, AUDIT_LOG, CLOCK],
          useFactory: (u: UserRepository, r: RoleRepository, h: PasswordHasher, l: LegacyPasswordVerifier, t: TotpService, c: SecretCipher, s: SessionIssuer, a: AuditLog, clock: Clock) =>
            new LoginUseCase(u, r, h, l, t, c, s, a, clock),
        },
        {
          provide: RefreshSessionUseCase,
          inject: [REFRESH_SESSION_STORE, USER_REPOSITORY, ROLE_REPOSITORY, SessionIssuer, AUDIT_LOG, CLOCK],
          useFactory: (st: RefreshSessionStore, u: UserRepository, r: RoleRepository, s: SessionIssuer, a: AuditLog, c: Clock) => new RefreshSessionUseCase(st, u, r, s, a, c),
        },
        {
          provide: LogoutUseCase,
          inject: [REFRESH_SESSION_STORE, AUDIT_LOG, CLOCK],
          useFactory: (st: RefreshSessionStore, a: AuditLog, c: Clock) => new LogoutUseCase(st, a, c),
        },
        {
          provide: BeginMfaEnrollmentUseCase,
          inject: [USER_REPOSITORY, TOTP_SERVICE, SECRET_CIPHER],
          useFactory: (u: UserRepository, t: TotpService, c: SecretCipher) => new BeginMfaEnrollmentUseCase(u, t, c),
        },
        {
          provide: ActivateMfaUseCase,
          inject: [USER_REPOSITORY, TOTP_SERVICE, SECRET_CIPHER, AUDIT_LOG, CLOCK],
          useFactory: (u: UserRepository, t: TotpService, c: SecretCipher, a: AuditLog, clock: Clock) => new ActivateMfaUseCase(u, t, c, a, clock),
        },
        {
          provide: ChangePasswordUseCase,
          inject: [USER_REPOSITORY, PASSWORD_HASHER, LEGACY_PASSWORD_VERIFIER, BREACHED_PASSWORD_CHECKER, REFRESH_SESSION_STORE, SessionIssuer, PermissionResolver, AUDIT_LOG, CLOCK],
          useFactory: (u: UserRepository, h: PasswordHasher, l: LegacyPasswordVerifier, b: BreachedPasswordChecker, st: RefreshSessionStore, s: SessionIssuer, r: PermissionResolver, a: AuditLog, c: Clock) =>
            new ChangePasswordUseCase(u, h, l, b, st, s, r, a, c),
        },
        {
          provide: GetCurrentUserUseCase,
          inject: [USER_REPOSITORY, PermissionResolver],
          useFactory: (u: UserRepository, r: PermissionResolver) => new GetCurrentUserUseCase(u, r),
        },
        {
          provide: ListUsersUseCase,
          inject: [USER_REPOSITORY, CLOCK],
          useFactory: (u: UserRepository, c: Clock) => new ListUsersUseCase(u, c),
        },
        {
          provide: CreateUserUseCase,
          inject: [USER_REPOSITORY, ROLE_REPOSITORY, PASSWORD_HASHER, ID_GENERATOR, AUDIT_LOG, CLOCK],
          useFactory: (u: UserRepository, r: RoleRepository, h: PasswordHasher, ids: IdGenerator, a: AuditLog, c: Clock) => new CreateUserUseCase(u, r, h, ids, a, c),
        },
        {
          provide: GetUserAccessUseCase,
          inject: [USER_REPOSITORY, ROLE_REPOSITORY, PermissionResolver, AccessDecider, { token: DEPARTMENT_DIRECTORY, optional: true }],
          useFactory: (u: UserRepository, r: RoleRepository, res: PermissionResolver, d: AccessDecider, dir: DepartmentDirectory | undefined) =>
            new GetUserAccessUseCase(u, r, res, d, dir ?? null),
        },
        {
          provide: ManageUserUseCases,
          inject: [USER_REPOSITORY, ROLE_REPOSITORY, REFRESH_SESSION_STORE, PermissionResolver, AUDIT_LOG, CLOCK],
          useFactory: (u: UserRepository, r: RoleRepository, st: RefreshSessionStore, res: PermissionResolver, a: AuditLog, c: Clock) => new ManageUserUseCases(u, r, st, res, a, c),
        },

        // --- gardes globaux, dans cet ordre : débit, authentification, permissions ---
        ...(rateLimiting ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }] : []),
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
      exports: [PermissionResolver, AccessDecider, USER_REPOSITORY, ROLE_REPOSITORY, TOKEN_ISSUER],
    };
  }
}
