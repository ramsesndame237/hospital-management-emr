import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PGlite } from '@electric-sql/pglite';
import { configureApp } from '../../src/app.setup';
import type { ApiDocsOptions } from '../../src/modules/api-docs';
import { buildApiDocsOptions } from '../../src/config/api-docs.config';
import { validateEnv } from '../../src/config/env.validation';
import { SQL_EXECUTOR } from '../../src/database/sql-executor';
import { PgAuditLog } from '../../src/modules/audit/infrastructure/pg-audit-log';
import { AdministrationIntegrationModule } from '../../src/integration/administration.integration';
import { AdmissionsIntegrationModule } from '../../src/integration/admissions.integration';
import { AppointmentsIntegrationModule } from '../../src/integration/appointments.integration';
import { BillingIntegrationModule } from '../../src/integration/billing.integration';
import { LabIntegrationModule } from '../../src/integration/lab.integration';
import { PharmacyIntegrationModule } from '../../src/integration/pharmacy.integration';
import { ServiceAccessIntegrationModule } from '../../src/integration/service-access.integration';
import { AuthorizationIntegrationModule } from '../../src/integration/authorization.integration';
import { ApiDocsIntegrationModule } from '../../src/integration/api-docs.integration';
import { StaffIntegrationModule } from '../../src/integration/staff.integration';
import { HealthController } from '../../src/health/health.controller';
import { AdministrationModule } from '../../src/modules/administration/administration.module';
import { AdmissionsModule } from '../../src/modules/admissions/admissions.module';
import { AppointmentsModule } from '../../src/modules/appointments/appointments.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { BillingModule } from '../../src/modules/billing/billing.module';
import { LabModule } from '../../src/modules/lab/lab.module';
import { PharmacyModule } from '../../src/modules/pharmacy/pharmacy.module';
import { IamModule } from '../../src/modules/iam/iam.module';
import { PatientsModule } from '../../src/modules/patients/patients.module';
import { ReferentialsModule } from '../../src/modules/referentials/referentials.module';
import { StaffModule } from '../../src/modules/staff/staff.module';
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

// Même ordre qu'au démarrage du conteneur : l'administration complète les rôles système créés par l'IAM.
const DDL = ['iam.pg.sql', 'administration.pg.sql', 'referentials.pg.sql', 'staff.pg.sql', 'patients.pg.sql', 'appointments.pg.sql', 'admissions.pg.sql', 'billing.pg.sql', 'lab.pg.sql', 'pharmacy.pg.sql'].map((f) => fs.readFileSync(path.join(__dirname, '../../migration/schema', f), 'utf8')).join('\n');

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
export async function createTestWorld(options: {
    rateLimiting?: boolean;
    i18nAdapter?: I18nAdapterName;
    docs?: boolean;
    /** Surcharge des options de documentation (p. ex. `{ requireLogin: false }`). */
    docsOptions?: Partial<ApiDocsOptions>;
    secureCookies?: boolean;
    beforeInit?: (app: NestExpressApplication) => void;
  } = {}): Promise<TestWorld> {
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
    controllers: [HealthController],
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, validate: () => validateEnv(env) as never }),
      LocalizationModule.register({ adapter: options.i18nAdapter ?? 'nestjs-i18n', locales: ['fr', 'en'], defaultLocale: 'fr' }),
      PlatformModule.register(),
      ApiDocsIntegrationModule.register(),
      IamModule.register({ rateLimiting: options.rateLimiting ?? false }),
      ReferentialsModule.register(),
      AdministrationIntegrationModule.register(),
      AdministrationModule.register(),
      StaffIntegrationModule.register(),
      StaffModule.register(),
      AuthorizationIntegrationModule.register(),
      AuditModule.register(),
      PatientsModule.register(),
      ServiceAccessIntegrationModule.register(),
      AppointmentsIntegrationModule.register(),
      AppointmentsModule.register(),
      AdmissionsIntegrationModule.register(),
      AdmissionsModule.register(),
      BillingIntegrationModule.register(),
      BillingModule.register(),
      LabIntegrationModule.register(),
      LabModule.register(),
      PharmacyIntegrationModule.register(),
      PharmacyModule.register(),
    ],
  })
    .overrideProvider(SQL_EXECUTOR).useValue(sql)
    .overrideProvider(REDIS).useValue(null)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app as NestExpressApplication, { corsOrigins: ['http://localhost:4200'], docs: options.docs ? { ...buildApiDocsOptions(true), ...options.docsOptions } : undefined, secureCookies: options.secureCookies ?? false });
  options.beforeInit?.(app as NestExpressApplication);
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
