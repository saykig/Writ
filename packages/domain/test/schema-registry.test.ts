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

  test("current version is 1.0.0 for every kind and matches the schema $id", () => {
    for (const kind of SCHEMA_KINDS) {
      const entry = SCHEMA_REGISTRY[kind];
      expect(entry.current).toBe("1.0.0");
      expect(entry.versions["1.0.0"]?.schemaId).toBe(SCHEMA_IDS[kind]);
      expect(entry.versions["1.0.0"]?.kind).toBe(kind);
    }
  });

  test("resolveSchemaVersion defaults to current and returns metadata", () => {
    const entry = resolveSchemaVersion("evidence");
    expect(entry?.schemaVersion).toBe("1.0.0");
    expect(entry?.title).toBe("Covenant Evidence Snapshot");
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
