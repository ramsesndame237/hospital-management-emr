import { Controller, Get, Optional } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { DanpheApi } from '../common/danphe-response';

@ApiTags('health')
@DanpheApi()
@Controller('api/Health')
export class HealthController {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  /** Sonde de disponibilité (Dokploy, Docker HEALTHCHECK). La base est testée si elle est activée. */
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
