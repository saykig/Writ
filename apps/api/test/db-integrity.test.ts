// DATA-001: referential integrity, immutability, supersession, bitemporality.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSql, type Sql } from "../src/db/client.js";
import { createRepositories, type Repositories } from "../src/db/repositories/index.js";
import { createTempDb, hasDatabase, type TempDb } from "./testdb.js";

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
    pool = createSql({ max: 3 });
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

  // --- Immutability: evidence snapshots ------------------------------------
  test("published evidence snapshot rejects UPDATE and DELETE", async () => {
    const snapshot = await repos.snapshots.freeze({
      id: uid("snap"),
      frozen_at: new Date(),
      cutoff: new Date(),
      content_hash: `sha256:${"b".repeat(64)}`,
      created_by: "tester",
    });
    await expectRejects(
      () => db.sql`UPDATE evidence_snapshots SET description = 'x' WHERE id = ${snapshot.id}`,
    );
    await expectRejects(() => db.sql`DELETE FROM evidence_snapshots WHERE id = ${snapshot.id}`);
  });

  test("snapshot membership is frozen", async () => {
    const docId = uid("doc");
    await repos.documents.insertDocument({ id: docId, canonical_uri: "https://x/doc" });
    const version = await repos.documents.insertVersion({
      id: uid("dv"),
      document_id: docId,
      retrieved_at: new Date(),
      media_type: "application/pdf",
      sha256: `sha256:${"c".repeat(64)}`,
      storage_uri: "s3://writ/doc",
    });
    const snap = await repos.snapshots.freeze({
      id: uid("snap"),
      frozen_at: new Date(),
      cutoff: new Date(),
      content_hash: `sha256:${"d".repeat(64)}`,
      created_by: "tester",
      document_version_ids: [version.id],
    });
    expect(await repos.snapshots.listMembers(snap.id)).toEqual([version.id]);
    await expectRejects(
      () => db.sql`DELETE FROM snapshot_document_versions WHERE snapshot_id = ${snap.id}`,
    );
  });

  // --- Immutability: receipts ----------------------------------------------
  test("evaluation receipt is immutable", async () => {
    const bundleId = uid("mb");
    const profileId = uid("ip");
    const snapId = uid("snap");
    await db.sql`
      INSERT INTO methodology_bundles (
        id, package_name, package_version, language_version, canonical_ir,
        canonical_hash, source_bundle_hash, created_by
      ) VALUES (
        ${bundleId}, ${"pkg"}, ${"1.0.0"}, ${"1.0.0"}, ${db.sql.json({})},
        ${`sha256:${"1".repeat(64)}`}, ${`sha256:${"2".repeat(64)}`}, ${"tester"}
      )`;
    await db.sql`
      INSERT INTO interpretation_profiles (
        id, methodology_bundle_id, name, version, canonical_hash, created_by
      ) VALUES (
        ${profileId}, ${bundleId}, ${"default"}, ${"1.0.0"},
        ${`sha256:${"3".repeat(64)}`}, ${"tester"}
      )`;
    await repos.snapshots.freeze({
      id: snapId,
      frozen_at: new Date(),
      cutoff: new Date(),
      content_hash: `sha256:${"4".repeat(64)}`,
      created_by: "tester",
    });
    const run = await repos.evaluations.insertRun({
      id: uid("run"),
      methodology_bundle_id: bundleId,
      interpretation_profile_id: profileId,
      evidence_snapshot_id: snapId,
      commitment_id: "c1",
      subject_id: "s1",
      as_of: new Date(),
      cutoff: new Date(),
      evaluator_build_hash: `sha256:${"5".repeat(64)}`,
    });
    const receipt = await repos.evaluations.insertReceipt({
      id: uid("rcpt"),
      evaluation_run_id: run.id,
      result: "+1",
      result_status: "supported",
      receipt: { proof: { root_id: "n0", nodes: [] } },
      canonical_hash: `sha256:${"6".repeat(64)}`,
    });
    await expectRejects(
      () => db.sql`UPDATE evaluation_receipts SET result = '-1' WHERE id = ${receipt.id}`,
    );
    await expectRejects(() => db.sql`DELETE FROM evaluation_receipts WHERE id = ${receipt.id}`);
  });

  // --- Immutability: published releases -------------------------------------
  test("draft release is mutable; published release is immutable", async () => {
    const releaseId = uid("rel");
    await repos.releases.insert({
      id: releaseId,
      name: "g7-2025",
      version: "1.0.0",
      methodology_bundle_ids: [],
      evidence_snapshot_ids: [],
      receipt_ids: [],
      manifest: { schema_version: "1.0.0" },
      canonical_hash: `sha256:${"7".repeat(64)}`,
      created_by: "tester",
      status: "draft",
    });
    // Draft rows may still change.
    await db.sql`UPDATE releases SET name = 'g7-2025-rc' WHERE id = ${releaseId}`;
    const published = await repos.releases.publish(releaseId);
    expect(published.status).toBe("published");
    await expectRejects(
      () => db.sql`UPDATE releases SET name = 'tampered' WHERE id = ${releaseId}`,
    );
    await expectRejects(() => db.sql`DELETE FROM releases WHERE id = ${releaseId}`);
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
