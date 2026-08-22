// DATA-001: referential integrity, immutability, supersession, bitemporality.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Sql } from "../src/db/client.js";
import { createRepositories, type Repositories } from "../src/db/repositories/index.js";
import { createTempDb, createTestSql, hasDatabase, type TempDb } from "./testdb.js";

const SHA = `sha256:${"a".repeat(64)}`;
let counter = 0;
const uid = (prefix: string): string => `${prefix}-${Date.now()}-${counter++}`;

// Assert a database operation rejects. We use try/catch rather than
// `expect(query).rejects` because a porsager query is a LAZY thenable and
// passing it straight to bun's `.rejects` matcher can leave the reserved
// connection mid-protocol, wedging every subsequent query on it. Awaiting the
// thunk inside a try/catch consumes the query cleanly and lets the connection
// recover.
async function expectRejects(run: () => Promise<unknown>): Promise<void> {
  let threw = false;
  try {
    await run();
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
}

const suite = hasDatabase ? describe : describe.skip;

suite("DATA-001 integrity", () => {
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

  // --- Referential integrity ------------------------------------------------
  test("foreign-key violation is rejected", async () => {
    await expectRejects(() =>
      repos.documents.insertVersion({
        id: uid("dv"),
        document_id: "does-not-exist",
        retrieved_at: new Date(),
        media_type: "text/html",
        sha256: SHA,
        storage_uri: "s3://writ/x",
      }),
    );
  });

  // --- Immutability: audit events -------------------------------------------
  test("audit events are append-only", async () => {
    const event = await repos.audit.append({
      actor_id: "tester",
      event_type: "claim.accepted",
      object_type: "claim",
      object_id: "c1",
      event_hash: `sha256:${"8".repeat(64)}`,
      payload: { note: "x" },
    });
    await expectRejects(
      () => db.sql`UPDATE audit_events SET actor_id = 'x' WHERE sequence = ${event.sequence}`,
    );
    await expectRejects(() => db.sql`DELETE FROM audit_events WHERE sequence = ${event.sequence}`);
  });

  // --- Supersession + bitemporality -----------------------------------------
  test("superseding a claim adds a new row and closes the old one", async () => {
    const oldId = uid("claim");
    const original = await repos.claims.insert({
      id: oldId,
      claim_type: "fact",
      subject_ref: "action:1",
      predicate: "amount",
      object_value: { value: "100", currency: "USD", bound: "exact" },
      truth_value: "true",
      status: "accepted",
      recorded_at: new Date(),
      origin: "human",
    });
    expect(original.logical_id).toBe(oldId);
    expect(original.system_to).toBeNull();

    const newId = uid("claim");
    const { superseded, replacement } = await repos.claims.supersede(oldId, {
      id: newId,
      claim_type: "fact",
      subject_ref: "action:1",
      predicate: "amount",
      object_value: { value: "150", currency: "USD", bound: "exact" },
      truth_value: "true",
      status: "accepted",
      recorded_at: new Date(),
      origin: "human",
    });

    expect(superseded.status).toBe("superseded");
    expect(superseded.system_to).not.toBeNull();
    expect(replacement.supersedes_claim_id).toBe(oldId);
    expect(replacement.logical_id).toBe(oldId);
    expect(replacement.system_to).toBeNull();

    const current = await repos.claims.currentByLogicalId(oldId);
    expect(current?.id).toBe(newId);

    const [openRow] = await db.sql<{ n: string }[]>`
      SELECT count(*)::text AS n FROM claims WHERE logical_id = ${oldId} AND system_to IS NULL`;
    expect(openRow?.n).toBe("1");
  });

  test("accepted claim content cannot be edited or deleted in place", async () => {
    const id = uid("claim");
    await repos.claims.insert({
      id,
      claim_type: "fact",
      subject_ref: "action:2",
      predicate: "stage",
      object_value: "launched",
      truth_value: "true",
      status: "accepted",
      recorded_at: new Date(),
      origin: "human",
    });
    await expectRejects(() => db.sql`UPDATE claims SET subject_ref = 'tampered' WHERE id = ${id}`);
    await expectRejects(() => db.sql`DELETE FROM claims WHERE id = ${id}`);
  });
});
