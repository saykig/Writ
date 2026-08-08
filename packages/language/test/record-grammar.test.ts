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
  test("atomic institutional functions compile without mandate or capacity", () => {
    const path = fileURLToPath(
      new URL(
        "../../../corpora/institutional/eu/european-commission/records.writ",
        import.meta.url,
      ),
    );
    const compiled = compileSource(readFileSync(path, "utf8"), { fileName: path });
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records).toHaveLength(20);
    const preservedFunctions = compiled.records.filter((record) =>
      [
        "eu_ai_office_technical_documentation_receipt",
        "eu_ai_office_training_summary_template_function",
        "eu_ai_office_serious_incident_report_receipt",
      ].includes(record.record_id),
    );
    expect(preservedFunctions).toHaveLength(3);
    for (const record of preservedFunctions) {
      expect(record).toMatchObject({
        schema_version: "0.2.0",
        family: "institutional",
        institutional_fact_type: "function",
        review_state: "draft",
      });
      expect(record).not.toHaveProperty("mandate");
      expect(record).not.toHaveProperty("operational_capacity");
    }
  });

  test("current judgments preserve an explicit record-link target", () => {
    const source = `language writ "0.2"
package test.judgment version "0.2.0";
judgment link_review {
  target record_link example_link;
  type disagreement;
  value unknown;
  rationale "Independent link review.";
  evidence_refs { passage_one };
  reviewer "reviewer";
  status proposed;
  created_at 2026-08-04;
}`;
    const compiled = compileSource(source);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.judgments[0]).toMatchObject({
      schema_version: "0.2.0",
      target_kind: "record_link",
      target_id: "example_link",
    });
    expect(compiled.judgments[0]).not.toHaveProperty("target_record_id");
    expect(formatText(formatText(source))).toBe(formatText(source));
  });

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
