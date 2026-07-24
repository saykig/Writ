// DATA-004: source registry verification gate, secret handling, seed import.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Sql } from "../src/db/client.js";
import { createRepositories, type Repositories } from "../src/db/repositories/index.js";
import {
  evaluateEnablement,
  type RegistryDocument,
  type RegistryEntry,
  sanitizeEntry,
} from "../src/db/repositories/sourceRegistry.js";
import { createTempDb, createTestSql, hasDatabase, type TempDb } from "./testdb.js";

function makeEntry(overrides: Partial<RegistryEntry> & { id: string }): RegistryEntry {
  return {
    name: "Test Source",
    jurisdictions: ["G7"],
    source_tier: 1,
    source_types: ["executive"],
    base_uri: "https://example.gov/",
    discovery_method: "api",
    fetch_method: "http",
    enabled: false,
    verification_status: "verified",
    terms_status: "reviewed",
    robots_policy: "respect",
    authentication: { type: "none" },
    ...overrides,
  };
}

// --- Pure gate logic (no database) ------------------------------------------
describe("DATA-004 verification gate", () => {
  test("a complete, verified, operator-requested connector is enabled", () => {
    const decision = evaluateEnablement(makeEntry({ id: "ok", enabled: true }));
    expect(decision.eligible).toBe(true);
    expect(decision.enabled).toBe(true);
    expect(decision.reasons).toEqual([]);
    expect(decision.disabledReason).toBeNull();
  });

  test("an unverified connector requesting enablement stays disabled", () => {
    const decision = evaluateEnablement(
      makeEntry({ id: "pending", enabled: true, verification_status: "verify_before_enable" }),
    );
    expect(decision.eligible).toBe(false);
    expect(decision.enabled).toBe(false);
    expect(decision.reasons).toContain("not_verified");
    expect(decision.disabledReason).toContain("not_verified");
  });

  test("unreviewed terms and manual-review robots block enablement", () => {
    const decision = evaluateEnablement(
      makeEntry({
        id: "terms",
        enabled: true,
        terms_status: "review_required",
        robots_policy: "manual_review",
      }),
    );
    expect(decision.enabled).toBe(false);
    expect(decision.reasons).toContain("license_or_terms_not_reviewed");
    expect(decision.reasons).toContain("access_policy_requires_manual_review");
  });

  test("authenticated connector without a secret reference is blocked", () => {
    const noRef = evaluateEnablement(
      makeEntry({ id: "auth", enabled: true, authentication: { type: "api_key" } }),
    );
    expect(noRef.enabled).toBe(false);
    expect(noRef.reasons).toContain("missing_secret_reference");

    const withRef = evaluateEnablement(
      makeEntry({
        id: "auth2",
        enabled: true,
        authentication: { type: "api_key", secret_ref: "env:API_KEY" },
      }),
    );
    expect(withRef.enabled).toBe(true);
  });

  test("an eligible connector the operator did not request stays disabled", () => {
    const decision = evaluateEnablement(makeEntry({ id: "off", enabled: false }));
    expect(decision.eligible).toBe(true);
    expect(decision.enabled).toBe(false);
    expect(decision.disabledReason).toBe("operator_disabled");
  });
});

// --- Secret handling (no database) ------------------------------------------
describe("DATA-004 secret handling", () => {
  test("sanitizeEntry keeps the secret reference but strips raw secrets", () => {
    const entry = makeEntry({
      id: "sec",
      authentication: { type: "api_key", secret_ref: "vault://writ/x" },
    });
    (entry as Record<string, unknown>).api_key = "RAW-SECRET-VALUE";
    (entry.authentication as unknown as Record<string, unknown>).password = "RAW-PASSWORD";

    const { body, secretRef } = sanitizeEntry(entry);
    expect(secretRef).toBe("vault://writ/x");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("RAW-SECRET-VALUE");
    expect(serialized).not.toContain("RAW-PASSWORD");
    expect(serialized).toContain("vault://writ/x");
  });
});

// --- Seed import + persistence (database) ------------------------------------
const suite = hasDatabase ? describe : describe.skip;

suite("DATA-004 registry import", () => {
  let pool: Sql | undefined;
  let db: TempDb;
  let repos: Repositories;

  beforeAll(async () => {
    pool = createTestSql({ max: 3 });
    db = await createTempDb(pool);
    repos = createRepositories(db.sql);
  });

  afterAll(async () => {
    await db?.drop();
    await pool?.end({ timeout: 5 });
  });

  test("the 104-entry seed imports and only verified+ready connectors enable", async () => {
    const doc = JSON.parse(
      readFileSync(new URL("../../../data/source-registry.json", import.meta.url), "utf8"),
    ) as RegistryDocument;

    const summary = await repos.sourceRegistry.importRegistry(doc);
    expect(summary.total).toBe(104);
    expect(summary.imported).toBe(104);
    // g20_research_group is enabled (verified) in this branch, so one more source
    // is enabled/eligible and one fewer is verification-pending/disabled.
    expect(summary.enabled).toBe(6);
    expect(summary.eligible).toBe(7);
    expect(summary.verificationPending).toBe(91);
    expect(summary.disabled).toBe(98);

    const enabled = await repos.sourceRegistry.listEnabled();
    expect(enabled.length).toBe(6);
    for (const row of enabled) {
      expect(row.verification_status).toBe("verified");
      expect(row.eligible).toBe(true);
    }

    const [verified] = await db.sql<
      { total: string; enabled: string; eligible: string }[]
    >`SELECT total::text, enabled::text, eligible::text
        FROM source_coverage_by_status WHERE verification_status = 'verified'`;
    expect(Number(verified?.total)).toBe(12);
    expect(Number(verified?.enabled)).toBe(6);
    expect(Number(verified?.eligible)).toBe(7);

    const g20 = await repos.sourceRegistry.getEntry("g20_research_group");
    expect(g20?.verification_status).toBe("verified");
    expect(g20?.enabled).toBe(true);
    expect(g20?.disabled_reason).toBeFalsy();
  });

  test("an incomplete production connector is imported DISABLED with a reason", async () => {
    const decision = await repos.sourceRegistry.importEntry(
      makeEntry({
        id: "incomplete.connector",
        enabled: true,
        verification_status: "verify_before_enable",
      }),
    );
    expect(decision.enabled).toBe(false);
    const row = await repos.sourceRegistry.getEntry("incomplete.connector");
    expect(row?.enabled).toBe(false);
    expect(row?.disabled_reason).toContain("not_verified");
  });

  test("raw secrets are never persisted in registry rows", async () => {
    const entry = makeEntry({
      id: "with.secret",
      verification_status: "catalogued",
      authentication: { type: "api_key", secret_ref: "env:WRIT_TEST_KEY" },
    });
    (entry as Record<string, unknown>).api_key = "SUPER-SECRET-1234";

    await repos.sourceRegistry.importEntry(entry);

    const [row] = await db.sql<{ body: unknown; secret_ref: string | null }[]>`
      SELECT body, secret_ref FROM source_registry_entries WHERE id = 'with.secret'`;
    expect(row?.secret_ref).toBe("env:WRIT_TEST_KEY");
    expect(JSON.stringify(row?.body)).not.toContain("SUPER-SECRET-1234");
  });
});
