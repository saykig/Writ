/**
 * End-to-end tests for the studio API surface. The request handler is called
 * directly (no socket) so these run under the Bun runner without a network
 * port. Each assertion exercises the real Covenant toolchain server-side.
 */

import { expect, test, describe } from "bun:test";
import { handleRequest } from "../src/index.js";
import { loadExamples } from "../src/toolchain.js";

function get(path: string): Promise<Response> {
  return handleRequest(new Request(`http://studio.test${path}`));
}
function post(path: string, body: unknown): Promise<Response> {
  return handleRequest(
    new Request(`http://studio.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const LITERAL = loadExamples().find((e) => e.id === "literal")!.source;
const RESOLVED = loadExamples().find((e) => e.id === "resolved")!.source;

describe("/api/examples", () => {
  test("returns the literal and resolved readings with sources", async () => {
    const res = await get("/api/examples");
    const body = (await res.json()) as { examples: { id: string; source: string }[] };
    const ids = body.examples.map((e) => e.id);
    expect(ids).toContain("literal");
    expect(ids).toContain("resolved");
    for (const example of body.examples) {
      expect(example.source).toContain("commitment AI_SME_ADOPTION");
    }
  });
});

describe("/api/compile", () => {
  test("compiles the literal to schema-shaped canonical IR", async () => {
    const res = await post("/api/compile", { source: LITERAL });
    const body = (await res.json()) as {
      schemaValid: boolean;
      ir?: { package: { name: string }; commitments: { id: string; score_program: unknown }[] };
    };
    expect(body.schemaValid).toBe(true);
    expect(body.ir).toBeDefined();
    expect(body.ir!.package.name).toBe("g7.kananaskis_2025.ai_sme.literal");
    expect(body.ir!.commitments[0]!.id).toBe("AI_SME_ADOPTION");
    expect(body.ir!.commitments[0]!.score_program).toBeDefined();
  });

  test("rejects a request without a source string", async () => {
    const res = await post("/api/compile", {});
    expect(res.status).toBe(400);
  });
});

describe("/api/analyze", () => {
  test("reports COV-SCORE-GAP with a witness on the literal reading", async () => {
    const res = await post("/api/analyze", { source: LITERAL });
    const body = (await res.json()) as {
      findings: { code: string; witness?: Record<string, unknown> }[];
    };
    const gap = body.findings.find((f) => f.code === "COV-SCORE-GAP");
    expect(gap).toBeDefined();
    expect(gap!.witness).toMatchObject({ strong_count: 0, weak_count: 5 });
  });

  test("reports no findings on the resolved reading", async () => {
    const res = await post("/api/analyze", { source: RESOLVED });
    const body = (await res.json()) as { findings: unknown[] };
    expect(body.findings).toHaveLength(0);
  });
});

describe("/api/evaluate", () => {
  test("evaluates Japan under the published profile to result 0", async () => {
    const res = await post("/api/evaluate", { source: RESOLVED, member: "japan" });
    const body = (await res.json()) as {
      ok: boolean;
      receipt?: { result: string; result_status: string; matched_rule_id?: string };
    };
    expect(body.ok).toBe(true);
    expect(body.receipt!.result).toBe("0");
    expect(body.receipt!.result_status).toBe("supported");
  });

  test("the generous profile flips Japan to +1", async () => {
    const res = await post("/api/evaluate", {
      source: RESOLVED,
      member: "japan",
      profile: "generous",
    });
    const body = (await res.json()) as { receipt?: { result: string } };
    expect(body.receipt!.result).toBe("+1");
  });

  test("a receipt binds five content hashes", async () => {
    const res = await post("/api/evaluate", { source: RESOLVED, member: "canada" });
    const body = (await res.json()) as {
      receipt: {
        canonical_hash: string;
        dependencies: {
          methodology_bundle_hash: string;
          evidence_snapshot_hash: string;
          interpretation_profile_hash: string;
          evaluator_build_hash: string;
        };
      };
    };
    expect(body.receipt.canonical_hash).toMatch(/^sha256:/);
    expect(body.receipt.dependencies.methodology_bundle_hash).toMatch(/^sha256:/);
    expect(body.receipt.dependencies.evidence_snapshot_hash).toMatch(/^sha256:/);
    expect(body.receipt.dependencies.interpretation_profile_hash).toMatch(/^sha256:/);
    expect(body.receipt.dependencies.evaluator_build_hash).toMatch(/^sha256:/);
  });

  test("fails gracefully for an unknown member", async () => {
    const res = await post("/api/evaluate", { source: RESOLVED, member: "atlantis" });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("atlantis");
  });
});

describe("/api/benchmark", () => {
  test("reproduces eight cells with two interpretation-sensitive", async () => {
    const res = await get("/api/benchmark");
    const body = (await res.json()) as {
      cells: { member: string; sensitive: boolean; flips: boolean }[];
      summary: { cells: number; interpretation_sensitive_cells: number };
    };
    expect(body.cells).toHaveLength(8);
    expect(body.summary.cells).toBe(8);
    expect(body.summary.interpretation_sensitive_cells).toBe(2);
    const sensitive = body.cells
      .filter((c) => c.sensitive)
      .map((c) => c.member)
      .sort();
    expect(sensitive).toEqual(["japan", "united_states"]);
  });
});

describe("static + routing", () => {
  test("serves the landing page at /", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Covenant Studio");
  });

  test("unknown API endpoints 404", async () => {
    const res = await get("/api/nope");
    expect(res.status).toBe(404);
  });
});
