// DATA-002 — governed command API: auth, RBAC, separation of duties,
// optimistic concurrency, idempotency, and the immutable audit trail.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FastifyInstance } from "fastify";
import { createSql, type Sql } from "../src/db/client.js";
import { createRepositories, type Repositories } from "../src/db/repositories/index.js";
import { buildApp } from "../src/http/app.js";
import { StaticTokenVerifier, type Actor } from "../src/http/auth.js";
import { createTempDb, hasDatabase, type TempDb } from "./testdb.js";

const suite = hasDatabase ? describe : describe.skip;

const TOKENS: Record<string, Actor> = {
  "author-token": { id: "alice", roles: ["author"] },
  "reviewer-token": { id: "bob", roles: ["reviewer"] },
  "reviewer2-token": { id: "dave", roles: ["reviewer"] },
  "admin-token": { id: "carol", roles: ["admin"] },
  "authrev-token": { id: "eve", roles: ["author", "reviewer"] },
};

let counter = 0;
const uid = (p: string): string => `${p}-${Date.now()}-${counter++}`;

function claimBody(id: string): Record<string, unknown> {
  return {
    id,
    claim_type: "fact",
    subject_ref: "action:1",
    predicate: "amount",
    object: { value: "100", currency: "USD", bound: "exact" },
    truth_value: "true",
    recorded_at: "2025-06-01T00:00:00Z",
    origin: "human",
  };
}

suite("DATA-002 command API", () => {
  let pool: Sql | undefined;
  let db: TempDb;
  let repos: Repositories;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = createSql({ max: 3 });
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

  const post = (
    url: string,
    token: string | null,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const merged: Record<string, string> = {
      ...(token !== null ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    };
    return app.inject({
      method: "POST",
      url,
      headers: merged,
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
  };

  test("an unauthenticated write is rejected with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/claims",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(claimBody(uid("claim"))),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "unauthorized" });
  });

  test("a valid token with the wrong role is forbidden (403)", async () => {
    const id = uid("claim");
    await post("/v1/claims", "author-token", claimBody(id));
    // An author cannot accept — that is a reviewer/admin action.
    const res = await post(`/v1/claims/${id}/accept`, "author-token");
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "forbidden_role" });
  });

  test("create -> submit -> accept writes one immutable audit event per transition", async () => {
    const id = uid("claim");
    const create = await post("/v1/claims", "author-token", claimBody(id));
    expect(create.statusCode).toBe(201);
    expect(create.json()).toMatchObject({ id, object_type: "claim", status: "candidate" });

    const submit = await post(`/v1/claims/${id}/submit`, "author-token");
    expect(submit.statusCode).toBe(200);

    const accept = await post(`/v1/claims/${id}/accept`, "reviewer-token");
    expect(accept.statusCode).toBe(200);
    expect(accept.json()).toMatchObject({ status: "accepted" });

    const events = await repos.audit.listForObject("claim", id);
    expect(events.map((e) => e.event_type)).toEqual([
      "claim.created",
      "claim.submitted",
      "claim.accepted",
    ]);
    // The chain links each event to the previous head.
    expect(events[1]?.prior_hash).toBe(events[0]?.event_hash ?? null);
    expect(events[2]?.prior_hash).toBe(events[1]?.event_hash ?? null);

    // Acceptance recorded a durable accept review (drives downstream eligibility).
    const reviews = await repos.reviews.listForObject("claim", id);
    expect(reviews.some((r) => r.decision === "accept" && r.reviewer_id === "bob")).toBe(true);
  });

  test("self-approval is rejected (separation of duties)", async () => {
    const id = uid("claim");
    // eve holds both author and reviewer roles.
    await post("/v1/claims", "authrev-token", claimBody(id));
    await post(`/v1/claims/${id}/submit`, "authrev-token");
    const res = await post(`/v1/claims/${id}/accept`, "authrev-token");
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "self_approval" });

    // A different reviewer may accept it.
    const ok = await post(`/v1/claims/${id}/accept`, "reviewer-token");
    expect(ok.statusCode).toBe(200);
  });

  test("a stale expected-version write returns 409", async () => {
    const id = uid("claim");
    const create = await post("/v1/claims", "author-token", claimBody(id));
    const staleVersion = create.json().version as string;

    // bob accepts (version advances candidate -> accepted).
    const accept = await post(`/v1/claims/${id}/accept`, "reviewer-token");
    expect(accept.statusCode).toBe(200);

    // A write carrying the now-stale version is rejected.
    const conflict = await post(`/v1/claims/${id}/accept`, "reviewer2-token", {
      expected_version: staleVersion,
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ error: "version_conflict" });
  });

  test("a repeated idempotency key is a no-op returning the prior result", async () => {
    const id = uid("claim");
    const key = uid("idem");
    const first = await post("/v1/claims", "author-token", claimBody(id), {
      "idempotency-key": key,
    });
    expect(first.statusCode).toBe(201);

    // Replaying the SAME command + key returns the stored response WITHOUT
    // re-executing (a re-run would hit the primary-key and 500).
    const second = await post("/v1/claims", "author-token", claimBody(id), {
      "idempotency-key": key,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());

    // The command ran exactly once: a single claim.created audit event.
    const events = await repos.audit.listForObject("claim", id);
    expect(events.filter((e) => e.event_type === "claim.created")).toHaveLength(1);
  });

  test("action lifecycle mirrors claims and emits audit events", async () => {
    const id = uid("action");
    const body = {
      id,
      label: "Compute subsidy",
      actors: ["Canada"],
      jurisdiction: "Canada",
      kind: "compute_subsidy",
      implementation_stage: "funded",
      beneficiary_targeting: "explicit",
      attribution: "unilateral",
      announcement_time: "2025-06-25T00:00:00Z",
    };
    expect((await post("/v1/actions", "author-token", body)).statusCode).toBe(201);
    expect((await post(`/v1/actions/${id}/submit`, "author-token")).statusCode).toBe(200);
    const accept = await post(`/v1/actions/${id}/accept`, "reviewer-token");
    expect(accept.statusCode).toBe(200);
    expect(accept.json()).toMatchObject({ status: "accepted", object_type: "action" });

    const events = await repos.audit.listForObject("action", id);
    expect(events.map((e) => e.event_type)).toEqual([
      "action.created",
      "action.submitted",
      "action.accepted",
    ]);
  });

  test("an accepted claim is superseded, not edited, and the new version is accepted", async () => {
    const id = uid("claim");
    await post("/v1/claims", "author-token", claimBody(id));
    await post(`/v1/claims/${id}/accept`, "reviewer-token");

    const replacementId = uid("claim");
    const res = await post(`/v1/claims/${id}/supersede`, "reviewer-token", {
      replacement_id: replacementId,
      object: { value: "150", currency: "USD", bound: "exact" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ status: "accepted", replacement_id: replacementId });

    const current = await repos.claims.currentByLogicalId(id);
    expect(current?.id).toBe(replacementId);
    const old = await repos.claims.get(id);
    expect(old?.status).toBe("superseded");
    const events = await repos.audit.listForObject("claim", id);
    expect(events.some((e) => e.event_type === "claim.superseded")).toBe(true);
  });
});
