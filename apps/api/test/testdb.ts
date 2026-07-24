// Database test harness.
//
// DB-touching tests are gated on WRIT_TEST_DATABASE_URL and still ignore the
// application's DATABASE_URL, so DB suites run only when that variable is set
// explicitly (an opt-in), never as a side effect of Bun's .env loading. This is
// a single-developer setup: WRIT_TEST_DATABASE_URL may point at the same Neon
// database as the app. Isolation does not come from the role — it comes from the
// per-suite disposable schema (see createTempDb), which is created and dropped
// on teardown and never writes to the public schema.
import { randomUUID } from "node:crypto";
import { createSql, type ReservedSql, type Sql } from "../src/db/client.js";
import { applyPendingOnConnection, loadMigrationFiles } from "../src/db/migrate.js";

export function validateTestDatabaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("WRIT_TEST_DATABASE_URL must be a postgres connection string");
  }
  return rawUrl;
}

const configuredTestDatabaseUrl = process.env.WRIT_TEST_DATABASE_URL?.trim();
const testDatabaseUrl = configuredTestDatabaseUrl
  ? validateTestDatabaseUrl(configuredTestDatabaseUrl)
  : undefined;

export const hasDatabase = testDatabaseUrl !== undefined;

export function createTestSql(options: { max?: number } = {}): Sql {
  if (!testDatabaseUrl) {
    throw new Error(
      "WRIT_TEST_DATABASE_URL is not set; database tests require a local, ephemeral, or restricted test role",
    );
  }
  return createSql({
    url: testDatabaseUrl,
    ...(options.max === undefined ? {} : { max: options.max }),
  });
}

export interface TempDb {
  /** Reserved connection bound (via search_path) to the temporary schema. */
  sql: ReservedSql;
  schema: string;
  drop(): Promise<void>;
}

/** Create a fresh schema, apply all migrations into it, and bind a connection. */
export async function createTempDb(pool: Sql): Promise<TempDb> {
  const schema = `writ_test_${randomUUID().replace(/-/g, "")}`;
  const conn = await pool.reserve();
  await conn.unsafe(`CREATE SCHEMA "${schema}"`);
  await conn.unsafe(`SET search_path TO "${schema}", public`);
  await applyPendingOnConnection(conn, loadMigrationFiles());
  return {
    sql: conn,
    schema,
    async drop() {
      await conn.unsafe(`SET search_path TO public`);
      await conn.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
      conn.release();
    },
  };
}
