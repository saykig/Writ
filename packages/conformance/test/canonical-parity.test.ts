/**
 * Parity guard: the canonical `@writ/*` stack must reproduce the reference-core
 * AI-for-SMEs gap and overlap outcomes.
 *
 * `reference-core` is the dependency-light semantic reference. This test runs it
 * next to the canonical evaluator/analyzer over the SAME program+domain data that
 * lives in the conformance corpus, and asserts the score results and the
 * gap/overlap witnesses agree. Once this parity holds across releases, reference-core
 * can be retired without losing its guarantees.
 *
 * reference-core is loaded through a computed module specifier so the conformance
 * package's TypeScript build does not pull its (differently configured) sources
 * into type-checking; Bun resolves and runs the TypeScript directly at runtime.
 */

import { describe, expect, test } from "bun:test";
import { deepEqual, loadCases, produce, type ConformanceCase } from "../src/index.js";

interface RefDiagnostic {
  readonly code: string;
  readonly witness?: Record<string, unknown>;
}
interface ReferenceCore {
  evaluateScore(
    program: unknown,
    facts: unknown,
  ): { readonly result: string; readonly diagnostics: readonly RefDiagnostic[] };
  analyzeScoreProgram(
    program: unknown,
    domains: unknown,
  ): { readonly diagnostics: readonly RefDiagnostic[] };
}

const referenceCoreUrl = new URL("../../../reference-core/src/index.ts", import.meta.url).href;
const reference = (await import(referenceCoreUrl)) as ReferenceCore;

const cases = loadCases();
function byId(id: string): ConformanceCase {
  const found = cases.find((testCase) => testCase.id === id);
  if (found === undefined) throw new Error(`Case not found: ${id}`);
  return found;
}

interface CanonicalScore {
  readonly result: string;
  readonly diagnostics: readonly string[];
}
interface CanonicalAnalysisDiag {
  readonly code: string;
  readonly witness?: Record<string, unknown>;
}

describe("canonical vs reference-core parity (AI-for-SMEs)", () => {
  test("literal gap: both engines return unresolved for 0 strong / 5 weak / no counter", async () => {
    const gapCase = byId("score.ai-sme.literal.gap");
    const canonical = (await produce(gapCase)) as CanonicalScore;
    const ref = reference.evaluateScore(gapCase.input.program, gapCase.input.facts);
    expect(ref.result).toBe("unresolved");
    expect(canonical.result).toBe(ref.result);
  });

  test("different-result overlap: both engines return unresolved and flag ambiguity", async () => {
    const overlapCase = byId("score.ai-sme.literal.different-result-overlap");
    const canonical = (await produce(overlapCase)) as CanonicalScore;
    const ref = reference.evaluateScore(overlapCase.input.program, overlapCase.input.facts);
    expect(ref.result).toBe("unresolved");
    expect(canonical.result).toBe(ref.result);
    // Both flag ambiguity, each in its own catalog (WRT-SCORE-* vs WRT-EVAL-*).
    expect(ref.diagnostics.some((diagnostic) => diagnostic.code.includes("AMBIGUOUS"))).toBe(true);
    expect(canonical.diagnostics).toContain("WRT-EVAL-AMBIGUOUS");
  });

  test("literal analysis: the gap witness agrees and the reference overlap is reproduced", async () => {
    const analyzeCase = byId("score.analyze.ai-sme.literal");
    const canonicalDiags = (await produce(analyzeCase)) as CanonicalAnalysisDiag[];
    const refAnalysis = reference.analyzeScoreProgram(
      analyzeCase.input.program,
      analyzeCase.input.domains,
    );

    const refGap = refAnalysis.diagnostics.find((d) => d.code === "WRT-SCORE-GAP");
    const canonGap = canonicalDiags.find((d) => d.code === "WRT-SCORE-GAP");
    expect(refGap).toBeDefined();
    expect(canonGap).toBeDefined();
    expect(canonGap?.witness).toEqual(refGap?.witness ?? {});

    const refOverlap = refAnalysis.diagnostics.find((d) => d.code === "WRT-SCORE-OVERLAP");
    const canonOverlaps = canonicalDiags.filter((d) => d.code === "WRT-SCORE-OVERLAP");
    expect(refOverlap).toBeDefined();
    expect(canonOverlaps.some((o) => deepEqual(o.witness, refOverlap?.witness))).toBe(true);
  });

  test("inclusive analysis: the reference overlap witness is reproduced", async () => {
    const analyzeCase = byId("score.analyze.ai-sme.inclusive-up-to");
    const canonicalDiags = (await produce(analyzeCase)) as CanonicalAnalysisDiag[];
    const refAnalysis = reference.analyzeScoreProgram(
      analyzeCase.input.program,
      analyzeCase.input.domains,
    );
    const refOverlap = refAnalysis.diagnostics.find((d) => d.code === "WRT-SCORE-OVERLAP");
    const canonOverlaps = canonicalDiags.filter((d) => d.code === "WRT-SCORE-OVERLAP");
    expect(refOverlap).toBeDefined();
    expect(canonOverlaps.some((o) => deepEqual(o.witness, refOverlap?.witness))).toBe(true);
  });

  test("resolved analysis: both engines find no gap and no overlap", async () => {
    const analyzeCase = byId("score.analyze.ai-sme.resolved-clean");
    const canonicalDiags = (await produce(analyzeCase)) as CanonicalAnalysisDiag[];
    const refAnalysis = reference.analyzeScoreProgram(
      analyzeCase.input.program,
      analyzeCase.input.domains,
    );
    for (const code of ["WRT-SCORE-GAP", "WRT-SCORE-OVERLAP"]) {
      expect(canonicalDiags.some((d) => d.code === code)).toBe(false);
      expect(refAnalysis.diagnostics.some((d) => d.code === code)).toBe(false);
    }
  });
});
