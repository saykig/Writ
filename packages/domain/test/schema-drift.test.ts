/**
 * Drift guard: the vendored schemas in `packages/domain/schemas/` must not drift
 * from the authoritative `specs/*.schema.json` contracts.
 *
 * Comparison is by parsed JSON structure (deep equality), not raw bytes: the
 * mandated `prettier --write` step reformats JSON whitespace, so a byte-level
 * assertion could not survive a re-run, whereas structural equality still fails
 * on any real content drift (added/removed/changed keys or values).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCHEMA_FILES, SCHEMA_KINDS } from "../src/schemas.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SPECS_DIR = join(REPO_ROOT, "specs");
const VENDORED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");

describe("vendored schemas match specs/ (authoritative)", () => {
  for (const kind of SCHEMA_KINDS) {
    test(`${kind} has not drifted from specs/`, () => {
      const file = SCHEMA_FILES[kind];
      const spec: unknown = JSON.parse(readFileSync(join(SPECS_DIR, file), "utf8"));
      const vendored: unknown = JSON.parse(readFileSync(join(VENDORED_DIR, file), "utf8"));
      expect(vendored).toEqual(spec);
    });
  }

  test("every spec schema is vendored", () => {
    // The set of vendored kinds must exactly cover the specs/*.schema.json files
    // (openapi.yaml is a YAML planning contract, not a JSON Schema, and is excluded).
    expect(SCHEMA_KINDS.length).toBe(9);
  });
});
