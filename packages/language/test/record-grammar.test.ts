import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileSource, formatText, normalizeTopic, parseDocument } from "../src/index.js";
import { validate } from "@writ/domain";

const FIXTURES = fileURLToPath(
  new URL("../../../internal/verification/fixtures/record-grammar-v0.1/", import.meta.url),
);

function fixture(name: string): string {
  return readFileSync(`${FIXTURES}/${name}`, "utf8");
}

describe("native record grammar", () => {
  for (const name of ["valid-legal-policy.writ", "valid-institutional.writ", "valid-record-judgment.writ"]) {
    test(`${name} parses, compiles, validates, and formats idempotently`, () => {
      const source = fixture(name);
      expect(parseDocument(source, { fileName: name }).ok).toBe(true);
      const compiled = compileSource(source, { fileName: name });
      expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(compiled.schemaValid).toBe(true);
      expect(formatText(formatText(source))).toBe(formatText(source));
      for (const record of compiled.records) {
        expect(validate(record.family === "legal_policy" ? "legal-policy-record" : "institutional-record", record).valid).toBe(true);
      }
      for (const judgment of compiled.judgments) {
        expect(validate("record-judgment", judgment).valid).toBe(true);
      }
    });
  }

  const invalid = [
    ["invalid-legal-policy-missing-evidence.writ", "evidence"],
    ["invalid-institutional-missing-authority.writ", "authority_sources"],
    ["invalid-record-judgment-missing-rationale.writ", "rationale"],
  ] as const;
  for (const [name, field] of invalid) {
    test(`${name} fails schema validation for ${field}`, () => {
      const compiled = compileSource(fixture(name), { fileName: name });
      expect(parseDocument(fixture(name), { fileName: name }).ok).toBe(true);
      expect(compiled.schemaValid).toBe(false);
      expect(compiled.schemaErrors.some((error) => error.message.includes(field) || error.instancePath.includes(field))).toBe(true);
    });
  }
});

describe("controlled AI topic aliases", () => {
  test("exact aliases resolve to artificial_intelligence", () => {
    expect(normalizeTopic("AI")).toBe("artificial_intelligence");
    expect(normalizeTopic("artificial intelligence")).toBe("artificial_intelligence");
    expect(normalizeTopic("artificial_intelligence")).toBe("artificial_intelligence");
  });

  test("substring matches do not resolve", () => {
    expect(normalizeTopic("rail")).toBe("rail");
    expect(normalizeTopic("fairness")).toBe("fairness");
  });
});
