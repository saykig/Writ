/**
 * FATF Mutual Evaluation follow-up stream — the third methodology (scaffold).
 *
 * This proves the ENCODING: Covenant compiles `examples/fatf-mutual-evaluation
 * .covenant`, the follow-up score program analyzes clean (the regular/enhanced
 * branches partition the rating space), and the rule computes the documented
 * outcome over evidence. The evidence used here is SYNTHETIC and clearly labelled
 * — it is illustrative rating data, NOT a real country's FATF ratings. The real
 * per-country reproduction (against the published Consolidated Assessment Ratings
 * and the actual assigned follow-up streams) is held pending until that source is
 * reachable and the trigger constants are verified against the FATF Procedures;
 * see the `test.todo` at the end and benchmark/fatf-mutual-evaluation/README.md.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileSource } from "@covenant/language";
import { evaluateCommitment, verifyReceipt } from "@covenant/evaluator";
import { analyzeScoreProgramByEnumeration, type FiniteDomains } from "@covenant/analyzer";
import type { CanonicalIr, Evidence } from "@covenant/domain";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CUTOFF = "2026-03-23T00:00:00Z";

function compileFatf(): CanonicalIr {
  const source = readFileSync(join(REPO_ROOT, "examples", "fatf-mutual-evaluation.covenant"), "utf8");
  const result = compileSource(source, { fileName: "fatf-mutual-evaluation.covenant" });
  if (!result.ir) throw new Error("FATF methodology failed to compile.");
  return result.ir;
}

// --- Synthetic (illustrative) evidence -------------------------------------
//
// A rating is one reviewed, accepted claim. `technical_compliance` claims carry
// a subject_ref "R.<n>" and an object in {C, LC, PC, NC, NA}; `effectiveness`
// claims carry "IO.<n>" and an object in {High, Substantial, Moderate, Low}.
// These are hand-built to exercise the rule — no relation to any real country.

interface Rating {
  readonly kind: "technical_compliance" | "effectiveness";
  readonly ref: string;
  readonly rating: string;
}

function snapshotFor(ratings: readonly Rating[]): Evidence {
  const claims: unknown[] = [];
  const reviews: unknown[] = [];
  ratings.forEach((r, i) => {
    const id = `claim-${r.kind}-${r.ref}-${i}`;
    claims.push({
      id,
      claim_type: r.kind,
      subject_ref: r.ref,
      object: r.rating,
      truth_value: "true",
      status: "accepted",
      recorded_at: "2026-01-01T00:00:00Z",
      evidence_links: ["passage-fatf"],
    });
    reviews.push({ id: `review-${i}`, object_id: id, object_type: "claim", decision: "accept" });
  });
  return {
    schema_version: "1.0.0",
    snapshot: {
      id: "snap-fatf-synthetic",
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

/** N technical-compliance ratings of `rating` on non-core Recommendations. */
function tc(n: number, rating: string, startAt = 21): Rating[] {
  // Recommendations 21..40 are all non-core, so these never hit trigger (b).
  return Array.from({ length: n }, (_, i) => ({
    kind: "technical_compliance" as const,
    ref: `R.${startAt + i}`,
    rating,
  }));
}

/** N effectiveness ratings of `rating`. */
function io(n: number, rating: string, startAt = 1): Rating[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: "effectiveness" as const,
    ref: `IO.${startAt + i}`,
    rating,
  }));
}

function follow(ratings: readonly Rating[]): string {
  const receipt = evaluateCommitment({
    ir: compileFatf(),
    commitmentId: "FATF_MUTUAL_EVALUATION",
    snapshot: snapshotFor(ratings),
    subject: "fatf-assessed-country",
    cutoff: CUTOFF,
  });
  return receipt.result;
}

// --- Static analysis (runs now, no data needed) ----------------------------

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const DOMAINS: FiniteDomains = {
  tc_deficient: range(41), // 0..40 Recommendations
  tc_core_deficient: [false, true],
  eff_low_or_moderate: range(12), // 0..11 Immediate Outcomes
  eff_low: range(12),
} as FiniteDomains;

describe("FATF follow-up rule — static shape", () => {
  test("compiles with no error diagnostics", () => {
    const source = readFileSync(
      join(REPO_ROOT, "examples", "fatf-mutual-evaluation.covenant"),
      "utf8",
    );
    const result = compileSource(source, { fileName: "fatf-mutual-evaluation.covenant" });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.ir).toBeDefined();
  });

  test("the regular/enhanced branches partition the rating space (no gap, no overlap)", () => {
    const program = (compileFatf().commitments[0] as unknown as { score_program: never })
      .score_program;
    const { diagnostics } = analyzeScoreProgramByEnumeration(program, DOMAINS, {
      objectId: "FATF_MUTUAL_EVALUATION",
    });
    const codes = diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c === "COV-SCORE-GAP")).toHaveLength(0);
    expect(codes.filter((c) => c === "COV-SCORE-OVERLAP")).toHaveLength(0);
  });
});

describe("FATF follow-up rule — computed over illustrative evidence", () => {
  test("a fully compliant profile is placed in regular follow-up", () => {
    // 40 Recommendations Compliant, 11 Immediate Outcomes High → no trigger.
    const clean = [...tc(20, "C", 1), ...tc(20, "C", 21), ...io(11, "High")];
    expect(follow(clean)).toBe("+1"); // +1 = regular follow-up
  });

  test("many partially/non-compliant Recommendations trigger enhanced follow-up", () => {
    // 12 PC on non-core Recommendations — well above the technical-compliance
    // threshold, robust to its exact (source-gated) value.
    expect(follow([...tc(12, "PC"), ...io(11, "High")])).toBe("-1"); // -1 = enhanced follow-up
  });

  test("a single core-Recommendation deficiency alone triggers enhanced follow-up", () => {
    // One PC on R.3 (a core Recommendation) — trigger (b), independent of any count.
    const oneCore: Rating[] = [
      { kind: "technical_compliance", ref: "R.3", rating: "PC" },
      ...io(11, "High"),
    ];
    expect(follow(oneCore)).toBe("-1"); // -1 = enhanced follow-up
  });

  test("widespread low/moderate effectiveness triggers enhanced follow-up", () => {
    // 11 Immediate Outcomes at Low — triggers both the low/moderate and the low
    // effectiveness conditions, robust to their exact thresholds.
    expect(follow([...tc(2, "C", 21), ...io(11, "Low")])).toBe("-1"); // -1 = enhanced follow-up
  });

  test("the receipt is deterministic (byte-identical canonical hash across runs)", () => {
    const ratings = [...tc(12, "PC"), ...io(11, "High")];
    const once = evaluateCommitment({
      ir: compileFatf(),
      commitmentId: "FATF_MUTUAL_EVALUATION",
      snapshot: snapshotFor(ratings),
      subject: "fatf-assessed-country",
      cutoff: CUTOFF,
    });
    const twice = evaluateCommitment({
      ir: compileFatf(),
      commitmentId: "FATF_MUTUAL_EVALUATION",
      snapshot: snapshotFor(ratings),
      subject: "fatf-assessed-country",
      cutoff: CUTOFF,
    });
    expect(twice.canonical_hash).toBe(once.canonical_hash);
    expect(verifyReceipt(once).valid).toBe(true);
  });
});

// The real reproduction: one snapshot per assessed country carrying its published
// FATF ratings, asserting the computed follow-up stream equals the stream FATF
// actually assigned. Held pending until the Consolidated Assessment Ratings table
// is reachable AND the enhanced-follow-up trigger constants are verified against
// the FATF Procedures. See benchmark/fatf-mutual-evaluation/README.md.
test.todo("reproduces FATF's assigned follow-up stream for each assessed country", () => {});
