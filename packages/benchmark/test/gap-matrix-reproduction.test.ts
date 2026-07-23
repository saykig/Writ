/**
 * Faithful-encoding check for the ported Gap Matrix (Sara Kim, cepheus).
 *
 * Writ compiles `examples/ai-governance-gap-matrix.writ`, evaluates it
 * against evidence carrying her actual analyst assessments (component-assessments
 * .json), and must reproduce her `deriveAssessment` outputs exactly:
 *   - publicAuthority: all five components at level 2 ⇒ round(100·Σ 0.2·2/4) = 50;
 *   - knowledgeConcentration: two of five components pending ⇒ the index is
 *     pending (null), never a silent 0 (her `if some score null return null`).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileSource } from "@writ/language";
import { evaluateCommitment } from "@writ/evaluator";
import { analyzeMeasures } from "@writ/analyzer";
import type { CanonicalIr, Evidence } from "@writ/domain";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CUTOFF = "2026-07-21T00:00:00Z";

/** Sara's assessment (component-assessments.json): level 0..4, or null = pending. */
const KNOWLEDGE: Record<string, number | null> = {
  "operational-control": 3,
  "critical-resource-control": null,
  "information-asymmetry": 3,
  "evaluation-dependence": 3,
  "expertise-concentration": null,
};
const AUTHORITY: Record<string, number | null> = {
  "binding-legal-mandate": 2,
  "compulsory-information-access": 2,
  "independent-evaluation-power": 2,
  "corrective-and-enforcement-power": 2,
  "coverage-and-coordination": 2,
};

/** Sara's engine, inlined: round(100·Σ wᵢ·sᵢ/4); null if any component pending. */
function saraIndex(levels: Record<string, number | null>): number | null {
  const values = Object.values(levels);
  if (values.some((v) => v === null)) return null;
  const weight = 1 / values.length;
  return Math.round(100 * (values as number[]).reduce((sum, v) => sum + weight * (v / 4), 0));
}

/** An accepted, reviewed `assessed_level` claim for one component (or none if pending). */
function assessmentClaims(levels: Record<string, number | null>) {
  const claims: unknown[] = [];
  const reviews: unknown[] = [];
  for (const [component, level] of Object.entries(levels)) {
    if (level === null) continue; // pending ⇒ no reviewed level claim
    const id = `claim-${component}`;
    claims.push({
      id,
      claim_type: "assessment",
      subject_ref: component,
      predicate: "assessed_level",
      object: level,
      truth_value: "true",
      status: "accepted",
      recorded_at: "2026-01-01T00:00:00Z",
      evidence_links: ["passage-gap-matrix"],
    });
    reviews.push({
      id: `review-${component}`,
      object_id: id,
      object_type: "claim",
      decision: "accept",
    });
  }
  return { claims, reviews };
}

function snapshot(): Evidence {
  const k = assessmentClaims(KNOWLEDGE);
  const a = assessmentClaims(AUTHORITY);
  return {
    schema_version: "1.0.0",
    snapshot: {
      id: "snap-gap-matrix",
      frozen_at: CUTOFF,
      cutoff: CUTOFF,
      content_hash: `sha256:${"0".repeat(64)}`,
    },
    document_versions: [],
    passages: [],
    claims: [...k.claims, ...a.claims],
    actions: [],
    reviews: [...k.reviews, ...a.reviews],
  } as unknown as Evidence;
}

function compileGapMatrix(): CanonicalIr {
  const source = readFileSync(join(REPO_ROOT, "examples", "ai-governance-gap-matrix.writ"), "utf8");
  const result = compileSource(source, { fileName: "ai-governance-gap-matrix.writ" });
  if (!result.ir) throw new Error("Gap Matrix methodology failed to compile.");
  return result.ir;
}

describe("Gap Matrix reproduction (faithful encoding)", () => {
  const receipt = evaluateCommitment({
    ir: compileGapMatrix(),
    commitmentId: "FRONTIER_AI_GOVERNANCE",
    snapshot: snapshot(),
    subject: "frontier-ai-governance",
    cutoff: CUTOFF,
  });
  const measures =
    (receipt as unknown as { measures?: Array<Record<string, unknown>> }).measures ?? [];
  const byId = (id: string) => measures.find((m) => m.id === id);

  test("public_authority reproduces Sara's index of 50", () => {
    expect(saraIndex(AUTHORITY)).toBe(50);
    const pa = byId("public_authority");
    expect(pa?.pending).toBe(false);
    expect(pa?.internal_score).toBe(50);
    expect(pa?.public_score).toBe(50);
  });

  test("knowledge_concentration is pending (null), matching two unassessed components", () => {
    expect(saraIndex(KNOWLEDGE)).toBeNull();
    const kc = byId("knowledge_concentration");
    expect(kc?.pending).toBe(true);
    expect(kc?.internal_score).toBeNull();
    expect(kc?.public_score).toBeNull();
  });

  test("the two pending components are exactly the ones Sara left unassessed", () => {
    const kc = byId("knowledge_concentration") as {
      components: Array<{ id: string; pending: boolean }>;
    };
    const pending = kc.components
      .filter((c) => c.pending)
      .map((c) => c.id)
      .sort();
    expect(pending).toEqual(["critical_resource_control", "expertise_concentration"]);
  });

  test("the analyzer reports the rubric clean and localizes pending-decisiveness", () => {
    const commitment = compileGapMatrix().commitments[0]!;
    const findings = analyzeMeasures(commitment.measures ?? [], {}, { objectId: commitment.id });
    const codes = findings.map((f) => f.code);
    // Weights are well-formed (0.2 × 5 = 1), so no weight finding.
    expect(codes).not.toContain("WRT-MEASURE-WEIGHTS");
    // Both measures are all-or-nothing: the index depends on every component.
    expect(codes.filter((c) => c === "WRT-MEASURE-PENDING-DECISIVE")).toHaveLength(2);
  });

  test("the receipt is deterministic (byte-identical canonical hash across runs)", () => {
    const again = evaluateCommitment({
      ir: compileGapMatrix(),
      commitmentId: "FRONTIER_AI_GOVERNANCE",
      snapshot: snapshot(),
      subject: "frontier-ai-governance",
      cutoff: CUTOFF,
    });
    expect(again.canonical_hash).toBe(receipt.canonical_hash);
  });
});
