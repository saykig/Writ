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
  for (const name of [
    "valid-legal-policy.writ",
    "valid-institutional.writ",
    "valid-legacy-record-syntax.writ",
    "valid-record-judgment.writ",
  ]) {
    test(`${name} parses, compiles, validates, and formats idempotently`, () => {
      const source = fixture(name);
      expect(parseDocument(source, { fileName: name }).ok).toBe(true);
      const compiled = compileSource(source, { fileName: name });
      expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual(
        [],
      );
      expect(compiled.schemaValid).toBe(true);
      expect(formatText(formatText(source))).toBe(formatText(source));
      for (const record of compiled.records) {
        expect(
          validate(
            record.family === "legal_policy" ? "legal-policy-record" : "institutional-record",
            record,
          ).valid,
        ).toBe(true);
      }
      for (const judgment of compiled.judgments) {
        expect(validate("record-judgment", judgment).valid).toBe(true);
      }
    });
  }

  const invalid = [
    ["invalid-legal-policy-missing-evidence.writ", "evidence"],
    ["invalid-institutional-missing-mandate.writ", "mandate"],
    ["invalid-record-judgment-missing-rationale.writ", "rationale"],
  ] as const;
  for (const [name, field] of invalid) {
    test(`${name} fails schema validation for ${field}`, () => {
      const compiled = compileSource(fixture(name), { fileName: name });
      expect(parseDocument(fixture(name), { fileName: name }).ok).toBe(true);
      expect(compiled.schemaValid).toBe(false);
      expect(
        compiled.schemaErrors.some(
          (error) => error.message.includes(field) || error.instancePath.includes(field),
        ),
      ).toBe(true);
    });
  }
});

describe("structured record lowering", () => {
  test("structured subjects, scope, mandate, and mission compile without semantic inference", () => {
    const compiled = compileSource(fixture("valid-institutional.writ"));
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records[0]).toMatchObject({
      subjects: [
        {
          subject_id: "nist",
          subject_type: "institution",
          label: "National Institute of Standards and Technology",
          role: "subject",
        },
      ],
      scope: {
        jurisdictions: ["United States"],
        institutional_scope: ["nist"],
        temporal_scope: {},
        conditions: [],
      },
      mandate: {
        status: "unknown",
        text: "The cited mission statement does not establish a legal mandate.",
      },
      mission: {
        text: "Advance measurement science, standards, and technology.",
        source_ids: ["nist.about"],
        evidence_refs: ["nist.about.mission"],
      },
      operational_capacity: { status: "unknown" },
    });
  });

  test("legacy syntax migrates deterministically to the structured contract", () => {
    const source = fixture("valid-legacy-record-syntax.writ");
    const first = compileSource(source);
    const second = compileSource(source);
    expect(first.records).toEqual(second.records);
    expect(first.records[0]).toMatchObject({
      subjects: [{ subject_id: "nist", subject_type: "unspecified" }],
      scope: {
        jurisdictions: ["United States"],
        institutional_scope: [],
        temporal_scope: {},
        conditions: ["Measurement science"],
      },
      mandate: {
        status: "unknown",
        text: "Legacy source-reported text.",
        authority_source_ids: ["nist.about"],
      },
    });
  });

  test("future record families compile and validate against the shared base", () => {
    const source = fixture("valid-legal-policy.writ")
      .replace(": legal_policy", ": theoretical")
      .replace(/\n {2}legal_policy \{[\s\S]*\n {2}\}\n\}\s*$/, "\n}\n");
    const compiled = compileSource(source);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records[0]?.family).toBe("theoretical");
    expect(validate("record", compiled.records[0]).valid).toBe(true);
  });
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
