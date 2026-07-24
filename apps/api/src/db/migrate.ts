// Idempotent SQL migration runner for @writ/api.
//
// Applies the plain-SQL files in `db/migrations/*.sql` in filename order and
// records each in a `schema_migrations` table so re-runs are no-ops. The same
// primitives drive hermetic tests, which apply the migrations into a disposable
// temporary schema instead of `public`.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReservedSql, Sql } from "./client.js";
import { closeSql, getSql } from "./client.js";

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

/** Absolute path to the repository's `db/migrations` directory. */
export function defaultMigrationsDir(): string {
  return fileURLToPath(new URL("../../../../db/migrations/", import.meta.url));
}

/** Load and hash every `*.sql` migration file, sorted by filename. */
export function loadMigrationFiles(dir: string = defaultMigrationsDir()): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(new URL(name, `file://${dir}`), "utf8");
      const checksum = `sha256:${createHash("sha256").update(sql).digest("hex")}`;
      return { name, sql, checksum };
    });
}

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

/**
 * Apply pending migrations on an already-reserved connection whose `search_path`
 * is set to the target schema. Returns the filenames that were applied. Assumes
 * caller-managed connection/search_path; used directly by the temp-schema test
 * harness and by {@link applyMigrations}.
 */
export async function applyPendingOnConnection(
  conn: ReservedSql,
  files: MigrationFile[] = loadMigrationFiles(),
): Promise<string[]> {
  await conn.unsafe(MIGRATIONS_TABLE);
  const rows = await conn<{ filename: string; checksum: string }[]>`
    SELECT filename, checksum FROM schema_migrations`;
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  const done: string[] = [];
  for (const file of files) {
    const priorChecksum = applied.get(file.name);
    if (priorChecksum !== undefined) {
      if (priorChecksum !== file.checksum) {
        throw new Error(
          `migration ${file.name} was modified after being applied ` +
            `(recorded ${priorChecksum}, now ${file.checksum})`,
        );
      }
      continue;
    }
    await conn.unsafe(file.sql);
    await conn`
      INSERT INTO schema_migrations (filename, checksum)
      VALUES (${file.name}, ${file.checksum})
      ON CONFLICT (filename) DO NOTHING`;
    done.push(file.name);
  }
  return done;
}

export interface ApplyOptions {
  /** Target schema; defaults to `public`. */
  schema?: string;
  /** Migration files; defaults to those loaded from {@link defaultMigrationsDir}. */
  files?: MigrationFile[];
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name: string): string {
  if (!IDENT.test(name)) {
    throw new Error(`unsafe schema identifier: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Apply pending migrations against a schema, serialised by an advisory lock so
 * concurrent runners cannot race. Reserves and releases its own connection.
 */
export async function applyMigrations(sql: Sql, options: ApplyOptions = {}): Promise<string[]> {
  const schema = options.schema ?? "public";
  const files = options.files ?? loadMigrationFiles();
  const conn = await sql.reserve();
  try {
    await conn`SELECT pg_advisory_lock(hashtext('writ.migrations.' || ${schema}))`;
    const searchPath =
      schema === "public" ? "public" : `${quoteIdent(schema)}, public`;
    await conn.unsafe(`SET search_path TO ${searchPath}`);
    try {
      return await applyPendingOnConnection(conn, files);
    } catch (error) {
      // Migration files are transactional. A failed multi-statement migration
      // leaves PostgreSQL in an aborted transaction, so roll it back before
      // attempting the advisory-unlock query and preserve the original error.
      await conn.unsafe("ROLLBACK");
      throw error;
    } finally {
      await conn`SELECT pg_advisory_unlock(hashtext('writ.migrations.' || ${schema}))`;
    }
  } finally {
    conn.release();
  }
}

// CLI: `bun run apps/api/src/db/migrate.ts` (run from repo root so .env loads).
if (typeof import.meta.main === "boolean" && import.meta.main) {
  const sql = getSql();
  try {
    const applied = await applyMigrations(sql);
    if (applied.length === 0) {
      console.log("schema is up to date; no migrations applied");
    } else {
      console.log(`applied ${applied.length} migration(s):`);
      for (const name of applied) console.log(`  - ${name}`);
    }
  } finally {
    await closeSql();
  }
}
