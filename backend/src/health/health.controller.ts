import { Controller, Get, Inject, Optional } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../platform/platform.module';
import { DocGroup, DocOperation } from '../modules/api-docs';
import { DataSource } from 'typeorm';
import { DanpheApi } from '../common/danphe-response';
import { Public } from '../modules/iam/presentation/decorators';

@DocGroup('Système', 'Supervision du service.', 90)
@DanpheApi()
@Controller('api/Health')
export class HealthController {
  constructor(
    @Optional() private readonly dataSource?: DataSource,
    @Optional() @Inject(REDIS) private readonly redis?: Redis | null,
  ) {}

  /** Sonde de disponibilité (Dokploy, Docker HEALTHCHECK). La base est testée si elle est activée. */
  @DocOperation({
    summary: 'État du service',
    description: "Sonde de disponibilité utilisée par Docker et Dokploy. Teste l'accès à la base. Réponse au format historique `{ Status, Results }`.",
    auth: 'none',
    responses: [{ status: 200, description: 'Service joignable ; `Results.database` et `Results.redis` valent `up`, `down` ou `disabled` ; `Results.status` vaut `degraded` si l\'un des deux est `down`.' }],
  })
  @Public()
  @Get()
  async check() {
    let db: 'up' | 'down' | 'disabled' = 'disabled';
    if (this.dataSource) {
      try {
        await this.dataSource.query('SELECT 1');
        db = 'up';
      } catch {
        db = 'down';
      }
    }
    // Sans Redis, personne ne peut ouvrir ni rafraîchir de session : l'application est inutilisable, donc dégradée.
    let cache: 'up' | 'down' | 'disabled' = 'disabled';
    if (this.redis) {
      try {
        cache = (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
      } catch {
        cache = 'down';
      }
    }
    return { service: 'sanjeevani-api', status: db === 'down' || cache === 'down' ? 'degraded' : 'up', database: db, redis: cache };
  }
}
