// Hermetic database test harness.
//
// DB-touching tests are gated on WRIT_TEST_DATABASE_URL. They deliberately
// ignore the application's DATABASE_URL so Bun's automatic .env loading cannot
// send tests to a production or owner-level database by accident. Each suite
// runs inside a disposable schema on a reserved connection whose search_path
// points at that schema and is dropped on teardown.
import { randomUUID } from "node:crypto";
import { createSql, type ReservedSql, type Sql } from "../src/db/client.js";
import { applyPendingOnConnection, loadMigrationFiles } from "../src/db/migrate.js";

const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRIVILEGED_REMOTE_ROLE = /(?:^|[_-])(owner|admin|root|postgres)(?:$|[_-])/i;

export function validateTestDatabaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  const username = decodeURIComponent(parsed.username);
  if (!LOCAL_TEST_HOSTS.has(parsed.hostname) && PRIVILEGED_REMOTE_ROLE.test(username)) {
    throw new Error(
      "WRIT_TEST_DATABASE_URL must not use a remote owner, admin, root, or postgres role",
    );
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
