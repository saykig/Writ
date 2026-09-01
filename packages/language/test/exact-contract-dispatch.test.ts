import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateContract } from "@writ/domain";
import { compileSource, resolveWritDialect } from "../src/index.js";

const FIXTURES = fileURLToPath(
  new URL("../../../internal/verification/fixtures/record-grammar-v0.1/", import.meta.url),
);
const NIST_RECORDS = fileURLToPath(
  new URL("../../../corpora/institutional/us/nist/records.writ", import.meta.url),
);
const NIST_SOURCES = fileURLToPath(
  new URL("../../../corpora/institutional/us/nist/sources.writ", import.meta.url),
);

const LEGAL_V1 = readFileSync(`${FIXTURES}/valid-legal-policy.writ`, "utf8");
const INSTITUTIONAL_V1 = readFileSync(`${FIXTURES}/valid-institutional.writ`, "utf8");
const JUDGMENT_V1 = readFileSync(`${FIXTURES}/valid-record-judgment.writ`, "utf8");
const SOURCE_ONLY_V1 = `language writ "0.1"
package writ.fixtures.source_only version "0.1.0";

source fixture_source {
  uri "https://example.com/source";
  media_type "text/html";
  retrieved 2026-08-31T00:00:00Z;
  sha256 "sha256:0000000000000000000000000000000000000000000000000000000000000000";
}`;

const dialect = (source: string, value: string): string =>
  source.replace(/language writ "[^"]+"/, `language writ "${value}"`);

const recordDeclarations = (source: string): string => source.slice(source.indexOf("\n\n") + 2);

const futureFamily = (source: string, id: string): string =>
  source
    .replace("us_constitution_article_i", id)
    .replace(": legal_policy", ": theoretical")
    .replace(/\n {2}legal_policy \{[\s\S]*\n {2}\}\n\}\s*$/, "\n}\n");

const CURRENT_LEGAL_CONTRACT =
  "https://writ.example/schemas/extensions/legal-policy-record.schema.json";
const UNSUPPORTED_DIALECTS = [
  "__proto__",
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "9.9",
] as const;

function expectUnsupportedDialect(source: string, sourceDialect: string): void {
  let compiled: ReturnType<typeof compileSource> | undefined;
  expect(() => {
    compiled = compileSource(dialect(source, sourceDialect));
  }).not.toThrow();
  if (!compiled) throw new Error(`Compilation did not return for ${sourceDialect}`);

  expect(resolveWritDialect(sourceDialect), sourceDialect).toBeUndefined();
  expect(compiled.schemaValid, sourceDialect).toBe(false);
  expect(compiled.records, sourceDialect).toEqual([]);
  expect(compiled.judgments, sourceDialect).toEqual([]);
  expect(compiled.diagnostics, sourceDialect).toHaveLength(1);
  expect(compiled.diagnostics[0], sourceDialect).toMatchObject({
    code: "WRT-DIALECT-UNSUPPORTED",
    severity: "error",
    message: `Unsupported Writ source dialect: ${sourceDialect}`,
  });
}

describe("exact source-dialect contract dispatch", () => {
  test("maps Writ 0.1 and 0.2 explicitly rather than equating dialect and schema strings", () => {
    expect(resolveWritDialect("0.1")).toMatchObject({
      dialect: "0.1",
      records: {
        base: { schemaVersion: "0.1.0" },
        legal_policy: { schemaVersion: "0.1.0" },
        institutional: { schemaVersion: "0.1.0" },
      },
      judgment: { schemaVersion: "0.1.0" },
    });
    expect(resolveWritDialect("0.2")).toMatchObject({
      dialect: "0.2",
      records: {
        base: { schemaVersion: "0.2.0" },
        legal_policy: { schemaVersion: "0.2.0" },
        institutional: { schemaVersion: "0.2.0" },
      },
      judgment: { schemaVersion: "0.2.0" },
    });
    expect(resolveWritDialect("0.2.0")).toBeUndefined();
  });

  test("keeps Writ 0.1 legal-policy records on the frozen compatibility contract", () => {
    const compiled = compileSource(LEGAL_V1);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records[0]?.schema_version).toBe("0.1.0");
    expect(resolveWritDialect("0.1")?.records.legal_policy.id).toContain(
      "/compatibility/record-grammar-v0.1/",
    );
  });

  test("emits Writ 0.2 legal-policy records under the native v0.2 contract", () => {
    const compiled = compileSource(dialect(LEGAL_V1, "0.2"));
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records[0]?.schema_version).toBe("0.2.0");
    expect(resolveWritDialect("0.2")?.records.legal_policy.id).toBe(CURRENT_LEGAL_CONTRACT);
  });

  test("does not upgrade a Writ 0.1 institutional atomic payload because fact_type exists", () => {
    const compiled = compileSource(dialect(readFileSync(NIST_RECORDS, "utf8"), "0.1"));
    expect(compiled.records.length).toBeGreaterThan(0);
    expect(compiled.records.every((record) => record.schema_version === "0.1.0")).toBe(true);
    expect(compiled.schemaValid).toBe(false);
  });

  test("does not downgrade a Writ 0.2 legacy institutional profile lacking the atomic contract", () => {
    const compiled = compileSource(dialect(INSTITUTIONAL_V1, "0.2"));
    expect(compiled.records[0]?.schema_version).toBe("0.2.0");
    expect(compiled.schemaValid).toBe(false);
    expect(
      compiled.schemaErrors.some((error) => error.message.includes("institutional_fact_type")),
    ).toBe(true);
  });

  test("does not upgrade a Writ 0.1 judgment because explicit target-kind syntax is present", () => {
    const currentSyntax = `language writ "0.1"
package test.judgment version "9.9.9";
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
    const compiled = compileSource(currentSyntax);
    expect(compiled.judgments[0]?.schema_version).toBe("0.1.0");
    expect(compiled.judgments[0]).toHaveProperty("target_kind", "record_link");
    expect(compiled.schemaValid).toBe(false);
  });

  test("does not downgrade a Writ 0.2 judgment missing the current explicit target kind", () => {
    const compiled = compileSource(dialect(JUDGMENT_V1, "0.2"));
    expect(compiled.judgments[0]?.schema_version).toBe("0.2.0");
    expect(compiled.judgments[0]).toHaveProperty("target_record_id");
    expect(compiled.schemaValid).toBe(false);
    expect(compiled.schemaErrors.some((error) => error.message.includes("target_kind"))).toBe(true);
  });

  for (const sourceDialect of UNSUPPORTED_DIALECTS) {
    test(`rejects unsupported dialect ${sourceDialect} for record modules`, () => {
      expectUnsupportedDialect(LEGAL_V1, sourceDialect);
    });

    test(`rejects unsupported dialect ${sourceDialect} for judgment modules`, () => {
      expectUnsupportedDialect(JUDGMENT_V1, sourceDialect);
    });

    test(`rejects unsupported dialect ${sourceDialect} for source-only modules`, () => {
      expectUnsupportedDialect(SOURCE_ONLY_V1, sourceDialect);
    });
  }

  test("keeps future shared-Core families extensible under each dialect", () => {
    for (const [sourceDialect, schemaVersion] of [
      ["0.1", "0.1.0"],
      ["0.2", "0.2.0"],
    ] as const) {
      const source = futureFamily(
        dialect(LEGAL_V1, sourceDialect),
        `future_family_${sourceDialect.replace(".", "_")}`,
      );
      const compiled = compileSource(source);
      expect(compiled.schemaValid, sourceDialect).toBe(true);
      expect(compiled.records[0]?.family).toBe("theoretical");
      expect(compiled.records[0]?.schema_version).toBe(schemaVersion);
    }
  });

  test("keeps standalone compilation broader than catalogued manifest adapter support", () => {
    const compatibilityInstitutional = compileSource(INSTITUTIONAL_V1);
    expect(compatibilityInstitutional.schemaValid).toBe(true);
    expect(compatibilityInstitutional.records[0]).toMatchObject({
      family: "institutional",
      schema_version: "0.1.0",
    });

    const futureCore = compileSource(
      futureFamily(dialect(LEGAL_V1, "0.2"), "future_standalone_record"),
    );
    expect(futureCore.schemaValid).toBe(true);
    expect(futureCore.records[0]).toMatchObject({
      family: "theoretical",
      schema_version: "0.2.0",
    });
  });

  test("does not use package or record revision metadata for contract dispatch", () => {
    const source = dialect(LEGAL_V1, "0.2");
    const revised = source
      .replace(
        'package writ.fixtures.records version "0.1.0";',
        'package writ.fixtures.records version "9.8.7";',
      )
      .replace('version "0.1.0";', 'version "7.6.5";');
    const original = compileSource(source);
    const changed = compileSource(revised);
    expect(original.schemaValid).toBe(true);
    expect(changed.schemaValid).toBe(true);
    expect(original.records[0]?.schema_version).toBe("0.2.0");
    expect(changed.records[0]?.schema_version).toBe("0.2.0");
    expect(changed.records[0]?.record_version).toBe("7.6.5");
  });

  test("compiles mixed-family Writ 0.2 without coupling to a corpus manifest", () => {
    const legal = recordDeclarations(dialect(LEGAL_V1, "0.2"));
    const generic = futureFamily(legal, "future_mixed_record");
    const source = `language writ "0.2"
package writ.fixtures.mixed version "4.3.2";

${legal}
${generic}`;
    const compiled = compileSource(source);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records.map(({ family }) => family)).toEqual(["legal_policy", "theoretical"]);
    expect(compiled.records.every((record) => record.schema_version === "0.2.0")).toBe(true);
    expect(validateContract(CURRENT_LEGAL_CONTRACT, compiled.records[0]).valid).toBe(true);
    expect(validateContract(CURRENT_LEGAL_CONTRACT, compiled.records[1]).valid).toBe(false);
  });

  test("keeps supported source-only modules working without records or judgments", () => {
    const compiled = compileSource(readFileSync(NIST_SOURCES, "utf8"));
    expect(compiled.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records).toEqual([]);
    expect(compiled.judgments).toEqual([]);
  });
});
