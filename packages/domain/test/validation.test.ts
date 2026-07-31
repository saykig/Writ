/**
 * Validation of the checked-in example artifacts against their schemas, plus
 * unit coverage of the validate/isValid/assertValid API and error-path surfacing.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertValid, isValid, SchemaValidationError, validate } from "../src/validation.js";
import type { SchemaKind } from "../src/schemas.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const EXAMPLES_DIR = join(
  REPO_ROOT,
  "internal/verification/fixtures/compatibility/g7-ai-sme/schemas",
);

/** Filename suffix -> schema kind, per the task's fixture inference rules. */
const SUFFIX_TO_KIND: ReadonlyArray<readonly [string, SchemaKind]> = [
  [".ir.json", "canonical-ir"],
  [".sample-evidence.json", "evidence"],
  [".sample-receipt.json", "evaluation-receipt"],
  [".sample-profile.json", "interpretation-profile"],
  [".sample-search-protocol.json", "search-protocol"],
  [".methodology-inventory.json", "methodology-inventory"],
  [".sample-discrepancy.json", "discrepancy"],
  [".sample-release.json", "release"],
];

function inferKind(filename: string): SchemaKind | undefined {
  return SUFFIX_TO_KIND.find(([suffix]) => filename.endsWith(suffix))?.[1];
}

describe("compatibility artifacts validate against their schemas", () => {
  const jsonFiles = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const matched = jsonFiles.filter((f) => inferKind(f) !== undefined);

  test("every schema compatibility fixture maps to a known schema kind", () => {
    expect(matched).toEqual(jsonFiles);
  });

  for (const file of matched) {
    const kind = inferKind(file)!;
    test(`${file} is valid ${kind}`, () => {
      const data: unknown = JSON.parse(readFileSync(join(EXAMPLES_DIR, file), "utf8"));
      const result = validate(kind, data);
      // Surface any failure paths to make a regression legible.
      expect(result.errors.map((e) => `${e.instancePath || "/"} ${e.keyword}`)).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }
});

describe("validation API", () => {
  const goodReceipt = () =>
    JSON.parse(
      readFileSync(join(EXAMPLES_DIR, "2025-ai-sme.sample-receipt.json"), "utf8"),
    ) as unknown;

  test("validate returns valid:true with no errors for a good document", () => {
    const result = validate("evaluation-receipt", goodReceipt());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test("validate surfaces the failing JSON path for a bad document", () => {
    const data = goodReceipt() as Record<string, unknown>;
    data.result = "not-a-result";
    const result = validate("evaluation-receipt", data);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    const paths = result.errors.map((e) => e.instancePath);
    expect(paths).toContain("/result");
    expect(result.errors.find((e) => e.instancePath === "/result")?.keyword).toBe("enum");
  });

  test("isValid narrows and returns a boolean", () => {
    expect(isValid("evaluation-receipt", goodReceipt())).toBe(true);
    expect(isValid("evaluation-receipt", { nope: true })).toBe(false);
  });

  test("assertValid throws SchemaValidationError with issues on failure", () => {
    let thrown: unknown;
    try {
      assertValid("release", { schema_version: "1.0.0" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SchemaValidationError);
    const err = thrown as SchemaValidationError;
    expect(err.kind).toBe("release");
    expect(err.issues.length).toBeGreaterThan(0);
    expect(err.message).toContain("release");
  });

  test("assertValid does not throw for a valid document", () => {
    expect(() => assertValid("evaluation-receipt", goodReceipt())).not.toThrow();
  });
});
