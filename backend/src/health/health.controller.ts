import { Controller, Get, Optional } from '@nestjs/common';
import { DocGroup, DocOperation } from '../modules/api-docs';
import { DataSource } from 'typeorm';
import { DanpheApi } from '../common/danphe-response';
import { Public } from '../modules/iam/presentation/decorators';

@DocGroup('Système', 'Supervision du service.', 90)
@DanpheApi()
@Controller('api/Health')
export class HealthController {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  /** Sonde de disponibilité (Dokploy, Docker HEALTHCHECK). La base est testée si elle est activée. */
  @DocOperation({
    summary: 'État du service',
    description: "Sonde de disponibilité utilisée par Docker et Dokploy. Teste l'accès à la base. Réponse au format historique `{ Status, Results }`.",
    auth: 'none',
    responses: [{ status: 200, description: 'Service joignable ; `Results.database` vaut `up`, `down` ou `disabled`.' }],
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
    return { service: 'sanjeevani-api', status: db === 'down' ? 'degraded' : 'up', database: db };
  }
}
