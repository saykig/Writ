import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertValid, isValid, SchemaValidationError, validate } from "../src/validation.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sourceRegistry = (): unknown =>
  JSON.parse(
    readFileSync(join(REPO_ROOT, "internal/infrastructure/generated/source-registry.json"), "utf8"),
  );

describe("validation API", () => {
  test("validates the generated source registry", () => {
    expect(validate("source-registry", sourceRegistry())).toEqual({ valid: true, errors: [] });
  });

  test("surfaces a failing JSON path", () => {
    const data = sourceRegistry() as { entries: Array<Record<string, unknown>> };
    data.entries[0]!.source_tier = 99;
    const result = validate("source-registry", data);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.errors.some((issue) => issue.instancePath === "/entries/0/source_tier")).toBe(
      true,
    );
  });

  test("isValid narrows and returns a boolean", () => {
    expect(isValid("source-registry", sourceRegistry())).toBe(true);
    expect(isValid("source-registry", { nope: true })).toBe(false);
  });

  test("assertValid throws typed issues on failure", () => {
    expect(() => assertValid("source-registry", { schema_version: "1.0.0" })).toThrow(
      SchemaValidationError,
    );
  });
});
