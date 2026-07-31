import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeMeasures } from "@writ/analyzer";
import type { CanonicalIr, Evidence } from "@writ/domain";
import { evaluateCommitment } from "@writ/evaluator";
import { compileSource } from "@writ/language";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURE = join(
  REPO_ROOT,
  "packages",
  "benchmark",
  "test",
  "fixtures",
  "weighted-ordinal-methodology.writ",
);
const CUTOFF = "2026-01-01T00:00:00Z";

type Levels = Record<string, number | null>;

function syntheticIndex(levels: Levels): number | null {
  const values = Object.values(levels);
  if (values.some((value) => value === null)) return null;
  const weight = 1 / values.length;
  return Math.round(
    100 * (values as number[]).reduce((sum, value) => sum + weight * (value / 4), 0),
  );
}

function snapshot(levels: Levels): Evidence {
  const claims: unknown[] = [];
  const reviews: unknown[] = [];
  for (const [component, level] of Object.entries(levels)) {
    if (level === null) continue;
    const id = `claim-${component}`;
    claims.push({
      id,
      claim_type: "assessment",
      subject_ref: component,
      predicate: "assessed_level",
      object: level,
      truth_value: "true",
      status: "accepted",
      recorded_at: "2025-12-31T00:00:00Z",
      evidence_links: ["passage-synthetic-assessment"],
    });
    reviews.push({
      id: `review-${component}`,
      object_id: id,
      object_type: "claim",
      decision: "accept",
    });
  }
  return {
    schema_version: "1.0.0",
    snapshot: {
      id: "snapshot-synthetic-weighted-ordinal",
      frozen_at: CUTOFF,
      cutoff: CUTOFF,
      content_hash: `sha256:${"0".repeat(64)}`,
    },
    document_versions: [],
    passages: [],
    claims,
    actions: [],
    reviews,
  } as unknown as Evidence;
}

function compileFixture(): CanonicalIr {
  const result = compileSource(readFileSync(FIXTURE, "utf8"), {
    fileName: "weighted-ordinal-methodology.writ",
  });
  if (!result.ir) throw new Error("Synthetic weighted-ordinal methodology failed to compile.");
  return result.ir;
}

function evaluate(levels: Levels) {
  return evaluateCommitment({
    ir: compileFixture(),
    commitmentId: "SYNTHETIC_INSTITUTIONAL_CAPACITY",
    snapshot: snapshot(levels),
    subject: "synthetic-institution",
    cutoff: CUTOFF,
  });
}

function measureFrom(receipt: ReturnType<typeof evaluate>) {
  const measures =
    (receipt as unknown as { measures?: Array<Record<string, unknown>> }).measures ?? [];
  return measures.find((measure) => measure.id === "institutional_capacity");
}

describe("synthetic weighted-ordinal evaluation", () => {
  test("two reviewed midpoint levels produce a score of 50", () => {
    const levels = { "administrative-reach": 2, "implementation-readiness": 2 };
    expect(syntheticIndex(levels)).toBe(50);
    expect(measureFrom(evaluate(levels))).toMatchObject({
      pending: false,
      internal_score: 50,
      public_score: 50,
    });
  });

  test("an unassessed component keeps the measure pending", () => {
    const levels = { "administrative-reach": 3, "implementation-readiness": null };
    expect(syntheticIndex(levels)).toBeNull();
    const measure = measureFrom(evaluate(levels)) as {
      pending: boolean;
      internal_score: number | null;
      public_score: number | null;
      components: Array<{ id: string; pending: boolean }>;
    };
    expect(measure.pending).toBe(true);
    expect(measure.internal_score).toBeNull();
    expect(measure.public_score).toBeNull();
    expect(measure.components.filter((component) => component.pending).map(({ id }) => id)).toEqual(
      ["implementation_readiness"],
    );
  });

  test("the analyzer keeps generic structural validation and pending diagnostics", () => {
    const commitment = compileFixture().commitments[0]!;
    const findings = analyzeMeasures(commitment.measures ?? [], {}, { objectId: commitment.id });
    const codes = findings.map((finding) => finding.code);
    expect(codes).not.toContain("WRT-MEASURE-WEIGHTS");
    expect(codes).not.toContain("WRT-MEASURE-ANCHOR-GAP");
    expect(codes).not.toContain("WRT-MEASURE-ANCHOR-OVERLAP");
    expect(codes.filter((code) => code === "WRT-MEASURE-PENDING-DECISIVE")).toHaveLength(1);
  });

  test("the receipt hash is deterministic", () => {
    const levels = { "administrative-reach": 2, "implementation-readiness": 2 };
    expect(evaluate(levels).canonical_hash).toBe(evaluate(levels).canonical_hash);
  });
});
