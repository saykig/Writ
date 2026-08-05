import { describe, expect, test } from "bun:test";
import {
  SCHEMA_REGISTRY,
  currentSchemaVersion,
  resolveSchemaVersion,
} from "../src/schema-registry.js";
import { SCHEMA_IDS, SCHEMA_KINDS } from "../src/schemas.js";

describe("schema-version registry", () => {
  test("has an entry for every schema kind", () => {
    expect(Object.keys(SCHEMA_REGISTRY).sort()).toEqual([...SCHEMA_KINDS].sort());
  });

  test("current version matches each schema and its $id", () => {
    const versionTwo = new Set([
      "record",
      "legal-policy-record",
      "institutional-record",
      "record-judgment",
    ]);
    for (const kind of SCHEMA_KINDS) {
      const entry = SCHEMA_REGISTRY[kind];
      const expected = versionTwo.has(kind) ? "0.2.0" : "1.0.0";
      expect(entry.current).toBe(expected);
      expect(entry.versions[expected]?.schemaId).toBe(SCHEMA_IDS[kind]);
      expect(entry.versions[expected]?.kind).toBe(kind);
    }
  });

  test("retains explicit v0.1 native compatibility contracts", () => {
    for (const kind of [
      "record",
      "legal-policy-record",
      "institutional-record",
      "record-judgment",
    ] as const) {
      expect(resolveSchemaVersion(kind, "0.1.0")?.schemaId).toContain(
        "/compatibility/record-grammar-v0.1/",
      );
    }
  });

  test("resolveSchemaVersion defaults to current and returns metadata", () => {
    const entry = resolveSchemaVersion("evidence");
    expect(entry?.schemaVersion).toBe("1.0.0");
    expect(entry?.title).toBe("Writ Evidence Snapshot");
  });

  test("resolveSchemaVersion returns undefined for an unknown version (never coerces)", () => {
    expect(resolveSchemaVersion("evidence", "9.9.9")).toBeUndefined();
  });

  test("currentSchemaVersion returns the pinned version", () => {
    expect(currentSchemaVersion("release")).toBe("1.0.0");
  });

  test("registry is frozen", () => {
    expect(Object.isFrozen(SCHEMA_REGISTRY)).toBe(true);
    expect(Object.isFrozen(SCHEMA_REGISTRY.evidence)).toBe(true);
  });
});
