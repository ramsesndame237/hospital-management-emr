import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { validateEnv } from './config/env.validation';
import { ALL_ENTITIES } from './database/entities';
import { HealthController } from './health/health.controller';
import { IamModule } from './modules/iam/iam.module';
import { PlatformModule } from './platform/platform.module';

/**
 * Module racine. Chaque module métier migré (security, appointment, billing…) s'ajoute à `imports`.
 * La base peut être désactivée (`DB_ENABLED=false`) pour les tests unitaires et la sonde de santé.
 */
@Module({})
export class AppModule {
  static register(options: { database?: boolean } = {}): DynamicModule {
    const imports: DynamicModule['imports'] = [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })];
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
    // Les modules métier exigent la base (comptes, audit) : sans elle (`DB_ENABLED=false`) seule la sonde de santé répond.
    if (useDb) imports.push(PlatformModule.register(), IamModule.register());
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
