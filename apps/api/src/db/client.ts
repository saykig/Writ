// PostgreSQL client factory for @covenant/api.
//
// Uses the porsager `postgres` driver. TLS is derived from the connection
// string (`sslmode=require`, as Neon uses) so the same factory serves both the
// managed Neon database and the plain local `postgres:17` used in CI.
import postgres from "postgres";

export type Sql = postgres.Sql<Record<string, never>>;
export type ReservedSql = postgres.ReservedSql<Record<string, never>>;
export type TransactionSql = postgres.TransactionSql<Record<string, never>>;

/**
 * A queryable handle the repositories accept: either the pool or a reserved
 * connection (both expose `.begin`, so repository methods that open a
 * transaction work against either). A temp-schema test passes its reserved
 * connection so every query runs under the test's `search_path`.
 */
export type DbClient = Sql | ReservedSql;

export interface ClientOptions {
  /** Connection string; defaults to `process.env.DATABASE_URL`. */
  url?: string;
  /** Max pool size. */
  max?: number;
}

/**
 * Create a postgres.js client. Notices are silenced (migrations emit expected
 * `IF EXISTS` notices) and `onnotice` keeps secrets out of stdout.
 */
export function createSql(options: ClientOptions = {}): Sql {
  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; cannot create a postgres client");
  }
  return postgres(url, {
    max: options.max ?? 10,
    onnotice: () => {},
    // The connection string carries `sslmode`; the driver maps it to `ssl`.
  }) as Sql;
}

let shared: Sql | undefined;

/** Lazily-created process-wide client bound to `DATABASE_URL`. */
export function getSql(): Sql {
  if (!shared) {
    shared = createSql();
  }
  return shared;
}

/** Close the shared client (used on shutdown and in test teardown). */
export async function closeSql(): Promise<void> {
  if (shared) {
    await shared.end({ timeout: 5 });
    shared = undefined;
  }
}
