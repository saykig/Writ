// Hermetic database test harness.
//
// DB-touching tests are gated on DATABASE_URL (a no-DB unit run skips them
// cleanly). Each suite runs inside a disposable schema on a reserved connection
// whose search_path points at that schema, so migrations, triggers, and data
// never touch the real `public` ledger and are dropped on teardown.
import { randomUUID } from "node:crypto";
import type { ReservedSql, Sql } from "../src/db/client.js";
import { applyPendingOnConnection, loadMigrationFiles } from "../src/db/migrate.js";

export const hasDatabase =
  typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.trim() !== "";

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
