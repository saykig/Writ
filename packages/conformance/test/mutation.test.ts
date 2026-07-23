/**
 * Mutation tests: prove the suite is sensitive, not vacuous.
 *
 * Each test takes a passing case, perturbs it the way a real regression would
 * (a flipped truth value, a widened count interval, a dropped gap witness, or a
 * changed input that shifts the engine's answer), and asserts the runner now
 * reports the case as FAILED. If the runner still passed, the corpus would not be
 * catching regressions (11_TEST_AND_VALIDATION.md §8).
 */

import { describe, expect, test } from "bun:test";
import { loadCases, runCase, type ConformanceCase } from "../src/index.js";

const cases = loadCases();

function byId(id: string): ConformanceCase {
  const found = cases.find((testCase) => testCase.id === id);
  if (found === undefined) throw new Error(`Representative case not found: ${id}`);
  return found;
}

interface CountExpectation {
  readonly interval: { min: number; max: number } | null;
  readonly blocking: boolean;
  readonly diagnostics: readonly string[];
}

describe("mutation sensitivity", () => {
  const controls = [
    "truth.and.contested-true",
    "identity.strict-deduplicate.interval",
    "score.analyze.ai-sme.literal",
    "score.ai-sme.resolved.full-compliance",
  ];

  test("control: the representative cases pass unmutated", async () => {
    for (const id of controls) {
      const result = await runCase(byId(id));
      expect(result.passed).toBe(true);
    }
  });

  test("flipping an expected truth value makes the case fail", async () => {
    // Real answer is "contested"; assert a wrong "true" is caught.
    const mutated: ConformanceCase = { ...byId("truth.and.contested-true"), expected: "true" };
    const result = await runCase(mutated);
    expect(result.passed).toBe(false);
  });

  test("widening an expected count interval makes the case fail", async () => {
    const original = byId("identity.strict-deduplicate.interval");
    const expectation = original.expected as CountExpectation;
    const interval = expectation.interval;
    if (interval === null) throw new Error("expected a concrete interval to widen");
    // Real distinct count is [1,1]; assert a widened [1,2] is caught.
    const mutated: ConformanceCase = {
      ...original,
      expected: { ...expectation, interval: { min: interval.min, max: interval.max + 1 } },
    };
    const result = await runCase(mutated);
    expect(result.passed).toBe(false);
  });

  test("dropping the gap witness from a score analysis makes the case fail", async () => {
    const original = byId("score.analyze.ai-sme.literal");
    const diagnostics = original.expected as ReadonlyArray<{ code: string }>;
    const withoutGap = diagnostics.filter((diagnostic) => diagnostic.code !== "COV-SCORE-GAP");
    expect(withoutGap.length).toBeLessThan(diagnostics.length);
    const mutated: ConformanceCase = { ...original, expected: withoutGap };
    const result = await runCase(mutated);
    expect(result.passed).toBe(false);
  });

  test("perturbing an input so the engine yields a different result makes the case fail", async () => {
    const original = byId("score.ai-sme.resolved.full-compliance");
    const facts = original.input.facts as Record<string, unknown>;
    // With 0 strong actions the resolved program selects the -1 `none` branch, not +1.
    const mutated: ConformanceCase = {
      ...original,
      input: { ...original.input, facts: { ...facts, strong_count: 0 } },
    };
    const result = await runCase(mutated);
    expect(result.passed).toBe(false);
    expect((result.actual as { result: string }).result).not.toBe("+1");
  });
});
