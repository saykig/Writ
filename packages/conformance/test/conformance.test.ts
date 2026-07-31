/**
 * The whole conformance corpus, run against the canonical `@writ/*` engines.
 *
 * Every case in `internal/verification/conformance/cases/**` must pass, and the corpus must cover all
 * ten semantic areas (04_FORMAL_SEMANTICS.md §19).
 */

import { describe, expect, test } from "bun:test";
import { AREAS, loadCases, runCase } from "../src/index.js";

const cases = loadCases();

describe("conformance corpus", () => {
  test("the corpus is non-empty and well-formed", () => {
    expect(cases.length).toBeGreaterThan(0);
    for (const testCase of cases) {
      expect(typeof testCase.id).toBe("string");
      expect(AREAS as readonly string[]).toContain(testCase.area);
      expect(typeof testCase.kind).toBe("string");
      expect(typeof testCase.description).toBe("string");
    }
  });

  test("case ids are unique", () => {
    const ids = cases.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all ten areas are covered", () => {
    const covered = new Set(cases.map((testCase) => testCase.area));
    for (const area of AREAS) {
      expect(covered.has(area)).toBe(true);
    }
    expect(covered.size).toBe(AREAS.length);
  });

  for (const testCase of cases) {
    test(`${testCase.area}/${testCase.id}`, async () => {
      const result = await runCase(testCase);
      if (!result.passed) {
        const detail = result.error !== undefined ? `\n  error:    ${result.error}` : "";
        throw new Error(
          `Case ${testCase.id} did not match.\n` +
            `  actual:   ${JSON.stringify(result.actual)}\n` +
            `  expected: ${JSON.stringify(result.expected)}${detail}`,
        );
      }
      expect(result.passed).toBe(true);
    });
  }
});
