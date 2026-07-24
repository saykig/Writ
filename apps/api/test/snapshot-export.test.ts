// DATA-003 — snapshot freeze + export.
//
// Proves: (1) a frozen snapshot exports a schema-valid evidence document;
// (2) adding evidence after the freeze does not change the frozen snapshot;
// (3) the exported document is consumed DIRECTLY by `evaluateCommitment` to
// produce a receipt (the benchmark-phase integration point).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FastifyInstance } from "fastify";
import { canonicalJson } from "@writ/provenance";
import { validate, type CanonicalIr, type Evidence } from "@writ/domain";
import { evaluateCommitment } from "@writ/evaluator";
import type { Sql } from "../src/db/client.js";
import { createRepositories, type Repositories } from "../src/db/repositories/index.js";
import { buildApp } from "../src/http/app.js";
import { StaticTokenVerifier, type Actor } from "../src/http/auth.js";
import { exportSnapshot } from "../src/services/snapshot.js";
import { createTempDb, createTestSql, hasDatabase, type TempDb } from "./testdb.js";

const suite = hasDatabase ? describe : describe.skip;

const TOKENS: Record<string, Actor> = {
  "admin-token": { id: "carol", roles: ["admin"] },
  "author-token": { id: "alice", roles: ["author"] },
};

const CUTOFF = "2025-12-31T23:59:59Z";

let counter = 0;
const uid = (p: string): string => `${p}-${Date.now()}-${counter++}`;
const sha = (seed: string): string => `sha256:${seed.repeat(64).slice(0, 64)}`;
/** A globally-unique sha256-shaped digest (document_versions.sha256 is UNIQUE). */
const uniqueSha = (): string => `sha256:${(counter++).toString(16).padStart(64, "0")}`;

/** A minimal, self-contained IR whose score is +1 iff at least one action is eligible. */
function minimalIr(): CanonicalIr {
  return {
    schema_version: "1.0.0",
    language_version: "1.0.0",
    package: { name: "test.snapshot", version: "1.0.0", content_hash: sha("f"), imports: [] },
    commitments: [
      {
        id: "c1",
        title: "At least one action",
        subjects: ["Canada"],
        evaluation_window: {
          start: "2025-01-01T00:00:00Z",
          end: "2025-12-31T23:59:59Z",
          start_inclusive: true,
          end_inclusive: true,
        },
        evidence_policy: "open_world",
        unknown_policy: "propagate",
        parameters: [],
        action_identity: { policy: "strict_separate", key_paths: ["id"] },
        predicates: [],
        classifications: [],
        variables: [],
        score_program: {
          rules: [
            {
              id: "has_action",
              priority: 1,
              result: "+1",
              when: {
                kind: "compare",
                op: "gte",
                left: { kind: "query", operation: "count", collection: "actions" },
                right: { kind: "literal", value: 1 },
              },
            },
          ],
          otherwise: { result: "0", message: "no eligible actions" },
        },
        assertions: [],
      },
    ],
  };
}

interface Seeded {
  versionId: string;
  claimId: string;
  actionId: string;
}

suite("DATA-003 snapshot freeze + export", () => {
  let pool: Sql | undefined;
  let db: TempDb;
  let repos: Repositories;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = createTestSql({ max: 3 });
    db = await createTempDb(pool);
    repos = createRepositories(db.sql);
    app = buildApp({ client: db.sql, verifier: new StaticTokenVerifier(TOKENS) });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
    await pool?.end({ timeout: 5 });
  });

  /** Seed a full accepted+reviewed evidence graph: document -> version -> passage -> claim -> action. */
  async function seedEvidence(prefix: string): Promise<Seeded> {
    const docId = uid(`${prefix}-doc`);
    const versionId = uid(`${prefix}-dv`);
    const passageId = uid(`${prefix}-p`);
    const claimId = uid(`${prefix}-claim`);
    const actionId = uid(`${prefix}-action`);

    await repos.documents.insertDocument({
      id: docId,
      canonical_uri: `https://gov.example/${docId}`,
    });
    await repos.documents.insertVersion({
      id: versionId,
      document_id: docId,
      retrieved_at: "2025-06-01T00:00:00Z",
      issued_at: "2025-05-30T00:00:00Z",
      media_type: "application/pdf",
      sha256: uniqueSha(),
      storage_uri: `s3://writ/${versionId}`,
    });
    await repos.documents.insertPassage({
      id: passageId,
      document_version_id: versionId,
      anchor_type: "whole_document",
      anchor: {},
      quote: "The government will fund compute for SMEs.",
      normalized_quote: "the government will fund compute for smes",
      anchor_hash: sha("c"),
    });
    await repos.claims.insert({
      id: claimId,
      claim_type: "fact",
      subject_ref: `action:${actionId}`,
      predicate: "funds_compute",
      object_value: true,
      truth_value: "true",
      status: "accepted",
      recorded_at: "2025-06-01T00:00:00Z",
      origin: "human",
      created_by: "alice",
    });
    await repos.claims.addEvidenceLink({
      claim_id: claimId,
      passage_id: passageId,
      stance: "supports",
      support_type: "direct",
    });
    await repos.reviews.insert({
      id: uid(`${prefix}-rev`),
      object_type: "claim",
      object_id: claimId,
      reviewer_id: "bob",
      decision: "accept",
      rationale: "verified against the passage",
      created_at: "2025-06-02T00:00:00Z",
    });
    await repos.actions.insert({
      id: actionId,
      label: "Compute subsidy for SMEs",
      actors: ["Canada"],
      jurisdiction: "Canada",
      kind: "compute_subsidy",
      implementation_stage: "funded",
      beneficiary_targeting: "explicit",
      attribution: "unilateral",
      status: "accepted",
      announcement_time: "2025-06-25T00:00:00Z",
    });
    await repos.claims.linkToAction(actionId, claimId);
    await repos.reviews.insert({
      id: uid(`${prefix}-arev`),
      object_type: "action",
      object_id: actionId,
      reviewer_id: "bob",
      decision: "accept",
      rationale: "action reviewed",
      created_at: "2025-06-26T00:00:00Z",
    });

    return { versionId, claimId, actionId };
  }

  const freeze = (token: string, body: unknown) =>
    app.inject({
      method: "POST",
      url: "/v1/snapshots/freeze",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: JSON.stringify(body),
    });

  const exportHttp = (token: string, id: string) =>
    app.inject({
      method: "GET",
      url: `/v1/snapshots/${id}/export`,
      headers: { authorization: `Bearer ${token}` },
    });

  test("freeze requires the admin role", async () => {
    const res = await freeze("author-token", { id: uid("snap"), cutoff: CUTOFF });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "forbidden_role" });
  });

  test("a frozen snapshot exports a schema-valid evidence document", async () => {
    const seeded = await seedEvidence("seed");
    const snapId = uid("snap");
    const frozen = await freeze("admin-token", {
      id: snapId,
      cutoff: CUTOFF,
      document_version_ids: [seeded.versionId],
    });
    expect(frozen.statusCode).toBe(201);
    const summary = frozen.json();
    expect(summary.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(summary.claim_count).toBe(1);
    expect(summary.action_count).toBe(1);

    const exported = await exportHttp("author-token", snapId);
    expect(exported.statusCode).toBe(200);
    const evidence = exported.json() as Evidence;
    expect(validate("evidence", evidence).valid).toBe(true);
    expect(evidence.snapshot.content_hash).toBe(summary.content_hash as string);
    expect(evidence.claims.map((c) => c.id)).toContain(seeded.claimId);
    expect(evidence.actions.map((a) => a.id)).toContain(seeded.actionId);
    // Every exported claim carries at least one evidence link (schema minItems).
    expect(evidence.claims.every((c) => c.evidence_links.length >= 1)).toBe(true);
  });

  test("adding evidence after freezing does not change the frozen snapshot", async () => {
    const seeded = await seedEvidence("immut");
    const snapId = uid("snap");
    const frozen = await freeze("admin-token", {
      id: snapId,
      cutoff: CUTOFF,
      document_version_ids: [seeded.versionId],
    });
    const contentHash = frozen.json().content_hash as string;

    const before = (await exportHttp("admin-token", snapId)).json() as Evidence;

    // New evidence lands on a NEW document version, outside the frozen membership.
    const late = await seedEvidence("late");
    expect(late.versionId).not.toBe(seeded.versionId);

    const after = (await exportHttp("admin-token", snapId)).json() as Evidence;

    expect(after.snapshot.content_hash).toBe(contentHash);
    expect(canonicalJson(after)).toBe(canonicalJson(before));
    expect(after.claims.map((c) => c.id)).not.toContain(late.claimId);
    expect(after.actions.map((a) => a.id)).not.toContain(late.actionId);
  });

  test("the exported snapshot round-trips through evaluateCommitment to a receipt", async () => {
    const seeded = await seedEvidence("roundtrip");
    const snapId = uid("snap");
    const frozen = await freeze("admin-token", {
      id: snapId,
      cutoff: CUTOFF,
      document_version_ids: [seeded.versionId],
    });
    expect(frozen.statusCode).toBe(201);

    // Export via the reusable service function (not just HTTP).
    const evidence = await exportSnapshot(db.sql, snapId);
    expect(validate("evidence", evidence).valid).toBe(true);

    const receipt = evaluateCommitment({ ir: minimalIr(), snapshot: evidence, subject: "Canada" });
    expect(validate("evaluation-receipt", receipt).valid).toBe(true);
    expect(receipt.canonical_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The eligible action produces a determinate +1.
    expect(receipt.result).toBe("+1");
    expect(receipt.result_status).toBe("supported");
    // The receipt binds to exactly this frozen snapshot.
    expect(receipt.dependencies.source_snapshot_ids).toEqual([snapId]);
    expect(receipt.dependencies.action_ids).toContain(seeded.actionId);
  });
});
