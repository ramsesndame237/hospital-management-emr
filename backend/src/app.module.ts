import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { validateEnv } from './config/env.validation';
import { ALL_ENTITIES } from './database/entities';
import { HealthController } from './health/health.controller';
import { AdministrationModule } from './modules/administration/administration.module';
import { IamModule } from './modules/iam/iam.module';
import { LocalizationModule } from './modules/i18n/localization.module';
import { ReferentialsModule } from './modules/referentials/referentials.module';
import { StaffModule } from './modules/staff/staff.module';
import { AdministrationIntegrationModule } from './integration/administration.integration';
import { ApiDocsIntegrationModule } from './integration/api-docs.integration';
import { StaffIntegrationModule } from './integration/staff.integration';
import { PlatformModule } from './platform/platform.module';

/**
 * Module racine. Chaque module métier migré (security, appointment, billing…) s'ajoute à `imports`.
 * La base peut être désactivée (`DB_ENABLED=false`) pour les tests unitaires et la sonde de santé.
 */
@Module({})
export class AppModule {
  static register(options: { database?: boolean } = {}): DynamicModule {
    const imports: DynamicModule['imports'] = [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, ignoreEnvFile: process.env.NODE_ENV === 'test' })];
    const useDb = options.database ?? process.env.DB_ENABLED !== 'false';
    if (useDb) {
      imports.push(
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => ({
            type: 'postgres' as const,
            host: cfg.getOrThrow<string>('DB_HOST'),
            port: cfg.getOrThrow<number>('DB_PORT'),
            database: cfg.getOrThrow<string>('DB_NAME'),
            username: cfg.getOrThrow<string>('DB_USER'),
            password: cfg.getOrThrow<string>('DB_PASSWORD'),
            ssl: cfg.get<boolean>('DB_SSL') ? { rejectUnauthorized: false } : false,
            entities: ALL_ENTITIES,
            synchronize: cfg.get<boolean>('DB_SYNCHRONIZE') ?? false,
          }),
        }),
      );
    }
    // Internationalisation : transversale (messages d'erreur, validation), donc toujours présente, base ou non.
    const env = validateEnv(process.env);
    imports.push(
      LocalizationModule.register({
        adapter: env.I18N_ADAPTER,
        locales: env.I18N_LOCALES,
        defaultLocale: env.I18N_DEFAULT_LOCALE,
        catalogsDir: env.I18N_CATALOGS_DIR || undefined,
        watch: env.NODE_ENV === 'development',
      }),
    );
    // Les modules métier exigent la base (comptes, audit) : sans elle (`DB_ENABLED=false`) seule la sonde de santé répond.
    if (useDb) imports.push(PlatformModule.register(), IamModule.register(), ReferentialsModule.register(), AdministrationIntegrationModule.register(), AdministrationModule.register(), StaffIntegrationModule.register(), StaffModule.register());
    // Toujours présent (accès `null` sans base) : voir `ApiDocsIntegrationModule`.
    imports.push(ApiDocsIntegrationModule.register({ identity: useDb }));
    return {
      module: AppModule,
      imports,
      controllers: [HealthController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
      ],
    };
  }
}
