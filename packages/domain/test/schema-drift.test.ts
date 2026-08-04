/**
 * Drift guard: the vendored schemas in `packages/domain/schemas/` must not drift
 * from their authoritative contracts under the repository `schemas/` tree.
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
import { SCHEMA_AUTHORITY_FILES, SCHEMA_FILES, SCHEMA_KINDS } from "../src/schemas.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const AUTHORITY_DIR = join(REPO_ROOT, "schemas");
const VENDORED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");

describe("vendored schemas match the authoritative schemas/ tree", () => {
  for (const kind of SCHEMA_KINDS) {
    test(`${kind} has not drifted from its authoritative layer`, () => {
      const file = SCHEMA_FILES[kind];
      const authority: unknown = JSON.parse(
        readFileSync(join(AUTHORITY_DIR, SCHEMA_AUTHORITY_FILES[kind]), "utf8"),
      );
      const vendored: unknown = JSON.parse(readFileSync(join(VENDORED_DIR, file), "utf8"));
      expect(vendored).toEqual(authority);
    });
  }

  test("every runtime schema kind has one authority mapping", () => {
    expect(Object.keys(SCHEMA_AUTHORITY_FILES).sort()).toEqual([...SCHEMA_KINDS].sort());
    expect(new Set(Object.values(SCHEMA_AUTHORITY_FILES)).size).toBe(SCHEMA_KINDS.length);
    expect(SCHEMA_KINDS.length).toBe(13);
  });
});
