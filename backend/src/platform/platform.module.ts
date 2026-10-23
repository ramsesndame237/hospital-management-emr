import { DynamicModule, Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { SQL_EXECUTOR } from '../database/sql-executor';
import { TypeOrmSqlExecutor } from '../database/typeorm-sql-executor';
import { AUDIT_LOG } from '../modules/audit/domain/audit-log.port';
import { PgAuditLog } from '../modules/audit/infrastructure/pg-audit-log';
import { CACHE } from '../modules/cache/cache.port';
import { MemoryCache } from '../modules/cache/infrastructure/memory-cache';
import { RedisCache } from '../modules/cache/infrastructure/redis-cache';
import { CLOCK, ID_GENERATOR, SystemClock } from '../shared-kernel/ports';
import type { SqlExecutor } from '../database/sql-executor';

export const REDIS = Symbol('REDIS');

/** Type du client Redis pour les modules qui le reçoivent par injection, sans importer la bibliothèque. */
export type RedisClient = Redis;

/** Ferme proprement la connexion Redis à l'arrêt (Dokploy envoie SIGTERM à chaque déploiement). */
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}
  async onApplicationShutdown(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}

/**
 * Infrastructure partagée par tous les modules métier : horloge, identifiants, accès SQL, Redis, cache, journal d'audit.
 * Global : un module métier injecte `CLOCK`, `CACHE`, `AUDIT_LOG`… sans connaître Redis ni PostgreSQL.
 */
@Global()
@Module({})
export class PlatformModule {
  static register(): DynamicModule {
    return {
      module: PlatformModule,
      providers: [
        { provide: CLOCK, useValue: new SystemClock() },
        { provide: ID_GENERATOR, useValue: { next: () => randomUUID() } },
        {
          provide: SQL_EXECUTOR,
          inject: [DataSource],
          useFactory: (source: DataSource): SqlExecutor => new TypeOrmSqlExecutor(source),
        },
        {
          provide: REDIS,
          inject: [ConfigService],
          useFactory: (cfg: ConfigService): Redis | null => {
            const url = cfg.get<string>('REDIS_URL');
            if (!url) {
              new Logger('Platform').warn('REDIS_URL absent : sessions et cache en mémoire (développement uniquement).');
              return null;
            }
            // Pas de file d'attente hors ligne : si Redis tombe, les requêtes échouent vite (échec fermé) au lieu de s'empiler.
            return new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
          },
        },
        {
          provide: CACHE,
          inject: [REDIS],
          useFactory: (redis: Redis | null) => (redis ? new RedisCache(redis) : new MemoryCache()),
        },
        { provide: AUDIT_LOG, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgAuditLog(sql) },
        { provide: RedisLifecycle, inject: [REDIS], useFactory: (redis: Redis | null) => new RedisLifecycle(redis) },
      ],
      exports: [CLOCK, ID_GENERATOR, SQL_EXECUTOR, REDIS, CACHE, AUDIT_LOG],
    };
  }
}
