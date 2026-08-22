/**
 * Hand-authored INVALID fixtures: each is a valid example with exactly one
 * broken field, and must fail validation at a specific JSON path and keyword.
 * This guards that validation errors carry an accurate failing location.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validate } from "../src/validation.js";
import type { SchemaKind } from "../src/schemas.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "invalid");

interface InvalidCase {
  file: string;
  kind: SchemaKind;
  /** RFC 6901 JSON Pointer of the expected failure ("" = document root). */
  expectPath: string;
  expectKeyword: string;
}

const CASES: readonly InvalidCase[] = [
  {
    file: "evidence-bad-truth-value.json",
    kind: "evidence",
    expectPath: "/claims/0/truth_value",
    expectKeyword: "enum",
  },
];

describe("invalid fixtures fail at the expected schema path", () => {
  for (const testCase of CASES) {
    test(`${testCase.file} fails at ${testCase.expectPath || "(root)"} [${testCase.expectKeyword}]`, () => {
      const data: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, testCase.file), "utf8"));
      const result = validate(testCase.kind, data);
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error("unreachable");
      const match = result.errors.find(
        (e) => e.instancePath === testCase.expectPath && e.keyword === testCase.expectKeyword,
      );
      expect(match).toBeDefined();
    });
  }
});
