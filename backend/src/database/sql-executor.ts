/**
 * Accès SQL minimal et paramétré ($1, $2…). Les dépôts n'en dépendent que lui : on peut donc les tester sur un vrai
 * PostgreSQL embarqué (PGlite) comme les brancher sur TypeORM en production, sans que le métier le sache.
 */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<R>(work: (tx: SqlExecutor) => Promise<R>): Promise<R>;
}

export const SQL_EXECUTOR = Symbol('SQL_EXECUTOR');
