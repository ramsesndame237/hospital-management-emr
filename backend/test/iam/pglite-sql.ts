import type { PGlite } from '@electric-sql/pglite';
import { SqlExecutor } from '../../src/database/sql-executor';

/** Exécuteur SQL branché sur PostgreSQL embarqué : mêmes requêtes qu'en production, vrai moteur. */
export class PgliteSql implements SqlExecutor {
  constructor(private readonly db: Pick<PGlite, 'query'> & Partial<Pick<PGlite, 'transaction'>>) {}
  async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, [...params])).rows;
  }
  transaction<R>(work: (tx: SqlExecutor) => Promise<R>): Promise<R> {
    if (!this.db.transaction) return work(this);
    return this.db.transaction((tx) => work(new PgliteSql(tx as never)));
  }
}
