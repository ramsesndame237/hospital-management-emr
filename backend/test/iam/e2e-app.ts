import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PGlite } from '@electric-sql/pglite';
import { configureApp } from '../../src/app.setup';
import { validateEnv } from '../../src/config/env.validation';
import { SQL_EXECUTOR } from '../../src/database/sql-executor';
import { PgAuditLog } from '../../src/modules/audit/infrastructure/pg-audit-log';
import { IamModule } from '../../src/modules/iam/iam.module';
import { I18nAdapterName, LocalizationModule } from '../../src/modules/i18n/localization.module';
import {
  PASSWORD_HASHER, PasswordHasher, SECRET_CIPHER, SecretCipher, USER_REPOSITORY, UserRepository,
} from '../../src/modules/iam/domain/ports';
import { User } from '../../src/modules/iam/domain/user';
import { Email } from '../../src/modules/iam/domain/value-objects/email';
import { PlainPassword } from '../../src/modules/iam/domain/value-objects/plain-password';
import { RoleCode } from '../../src/modules/iam/domain/value-objects/role-code';
import { UserId } from '../../src/modules/iam/domain/value-objects/user-id';
import { Username } from '../../src/modules/iam/domain/value-objects/username';
import { PlatformModule, REDIS } from '../../src/platform/platform.module';
import { Temporal } from '../../src/shared-kernel/temporal';
import { PgliteSql } from './pglite-sql';
import { must } from './fakes';

const DDL = fs.readFileSync(path.join(__dirname, '../../migration/schema/iam.pg.sql'), 'utf8');

// otplib v13 exige ≥ 16 octets ; 32 caractères base32 = 20 octets (taille standard RFC 4226).
export const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

export interface TestWorld {
  app: INestApplication;
  db: PGlite;
  sql: PgliteSql;
  audit: PgAuditLog;
  /** Crée un compte directement en base (comme un script d'amorçage), avec un vrai hachage Argon2id. */
  seed(input: { username: string; password: string; roles: string[]; mfa?: boolean; mustChangePassword?: boolean }): Promise<User>;
  close(): Promise<void>;
}

/** Application complète (mêmes modules, gardes et configuration HTTP qu'en production) sur PostgreSQL embarqué ; Redis remplacé par la mémoire. */
export async function createTestWorld(options: { rateLimiting?: boolean; i18nAdapter?: I18nAdapterName } = {}): Promise<TestWorld> {
  const db = new PGlite();
  await db.exec(DDL);
  const sql = new PgliteSql(db);

  const env = {
    NODE_ENV: 'test',
    JWT_SECRET: 'j'.repeat(48),
    JWT_ISSUER: 'sanjeevani-test',
    JWT_AUDIENCE: 'sanjeevani-web-test',
    SECRET_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    COOKIE_SECURE: 'false',
    BREACH_CHECK_ENABLED: 'false',
    LEGACY_PASSWORD_SALT: 'sel-de-test',
    REDIS_URL: '',
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, validate: () => validateEnv(env) as never }),
      LocalizationModule.register({ adapter: options.i18nAdapter ?? 'nestjs-i18n', locales: ['fr', 'en'], defaultLocale: 'fr' }),
      PlatformModule.register(),
      IamModule.register({ rateLimiting: options.rateLimiting ?? false }),
    ],
  })
    .overrideProvider(SQL_EXECUTOR).useValue(sql)
    .overrideProvider(REDIS).useValue(null)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app as NestExpressApplication, { corsOrigins: ['http://localhost:4200'] });
  await app.init();

  const users = app.get<UserRepository>(USER_REPOSITORY);
  const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
  const cipher = app.get<SecretCipher>(SECRET_CIPHER);

  return {
    app,
    db,
    sql,
    audit: new PgAuditLog(sql),
    async seed({ username, password, roles, mfa, mustChangePassword }) {
      const user = User.register({
        id: must(UserId.create(randomUUID())),
        username: must(Username.create(username)),
        email: must(Email.create(`${username}@hopital.test`)),
        passwordHash: await hasher.hash(must(PlainPassword.forVerification(password))),
        roles: roles.map((r) => must(RoleCode.create(r))),
        now: Temporal.Now.instant(),
        mustChangePassword: mustChangePassword ?? false,
      });
      if (mfa) {
        user.beginMfaEnrollment(cipher.encrypt(TOTP_SECRET));
        user.confirmMfaEnrollment(['unused']);
      }
      await users.save(user);
      return user;
    },
    async close() {
      await app.close();
      await db.close();
    },
  };
}
