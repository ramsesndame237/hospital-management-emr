import { DataSource, EntityManager } from 'typeorm';
import { SqlExecutor } from './sql-executor';

export class TypeOrmSqlExecutor implements SqlExecutor {
  constructor(private readonly source: DataSource | EntityManager) {}

  query<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return this.source.query(sql, [...params]) as Promise<T[]>;
  }

  transaction<R>(work: (tx: SqlExecutor) => Promise<R>): Promise<R> {
    if (this.source instanceof DataSource) {
      return this.source.transaction((manager) => work(new TypeOrmSqlExecutor(manager)));
    }
    // déjà dans une transaction : on la réutilise
    return work(this);
  }
}
