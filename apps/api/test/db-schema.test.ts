// DATA-001: migrations apply from clean and produce the full schema.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Sql } from "../src/db/client.js";
import { applyPendingOnConnection, loadMigrationFiles } from "../src/db/migrate.js";
import { createTempDb, createTestSql, hasDatabase, type TempDb } from "./testdb.js";

const REQUIRED_TABLES = [
  "institutions",
  "institution_aliases",
  "documents",
  "document_versions",
  "passages",
  "claims",
  "claim_evidence_links",
  "actions",
  "action_claims",
  "action_relationships",
  "reviews",
  "audit_events",
  "source_registry_entries",
  "corpus_blobs",
  "corpus_objects",
  "schema_migrations",
];

const REQUIRED_VIEWS = [
  "source_registry_health",
  "source_coverage_by_jurisdiction",
  "source_coverage_by_tier",
  "source_coverage_by_status",
  "corpus_current_objects",
];

const suite = hasDatabase ? describe : describe.skip;

suite("DATA-001 schema", () => {
  let pool: Sql | undefined;
  let db: TempDb;

  beforeAll(async () => {
    pool = createTestSql({ max: 3 });
    db = await createTempDb(pool);
  });

  afterAll(async () => {
    await db?.drop();
    await pool?.end({ timeout: 5 });
  });

  test("all required tables exist after a clean apply", async () => {
    const rows = await db.sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = ${db.schema}`;
    const present = new Set(rows.map((r) => r.tablename));
    for (const table of REQUIRED_TABLES) {
      expect(present.has(table)).toBe(true);
    }
  });

  test("health and coverage views exist", async () => {
    const rows = await db.sql<{ viewname: string }[]>`
      SELECT viewname FROM pg_views WHERE schemaname = ${db.schema}`;
    const present = new Set(rows.map((r) => r.viewname));
    for (const view of REQUIRED_VIEWS) {
      expect(present.has(view)).toBe(true);
    }
  });

  test("bitemporal columns exist on claims and actions", async () => {
    const rows = await db.sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = ${db.schema}
        AND table_name IN ('claims', 'actions')
        AND column_name IN ('logical_id', 'system_from', 'system_to')`;
    expect(rows.length).toBe(6);
  });

  test("migration runner is idempotent", async () => {
    const applied = await applyPendingOnConnection(db.sql, loadMigrationFiles());
    expect(applied).toEqual([]);
    const recorded = await db.sql<{ filename: string }[]>`
      SELECT filename FROM schema_migrations ORDER BY filename`;
    expect(recorded.length).toBe(loadMigrationFiles().length);
  });
});
