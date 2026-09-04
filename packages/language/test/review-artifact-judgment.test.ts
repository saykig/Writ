import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID } from "@writ/domain";
import { compileSource, formatText, resolveWritDialect } from "../src/index.js";

const binding = `review_artifact {
    path "docs/reviews/human-disposition.yaml";
    content_hash "sha256:${"a".repeat(64)}";
  }`;
const source = (dialect = "0.3", declaration = binding): string => `language writ "${dialect}"
package test.review_binding version "1.0.0";
judgment bound_review {
  target record synthetic_record;
  type review_disposition;
  value "approved";
  rationale "Synthetic association; does not prove semantic agreement.";
  evidence_refs { synthetic.passage };
  reviewer "Synthetic reviewer label";
  status proposed;
  created_at 2026-09-04;
  ${declaration}
}`;

describe("explicit review-artifact judgment dialect", () => {
  test("v0.3 emits the optional binding under its exact new contract", () => {
    const result = compileSource(source());
    expect(result.schemaValid).toBe(true);
    expect(result.judgments[0]).toMatchObject({
      schema_version: "0.3.0",
      judgment_id: "bound_review",
      status: "proposed",
      review_artifact: {
        path: "docs/reviews/human-disposition.yaml",
        content_hash: `sha256:${"a".repeat(64)}`,
      },
    });
    expect(resolveWritDialect("0.3")?.judgment).toEqual({
      id: REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
      schemaVersion: "0.3.0",
    });
    expect(compileSource(source())).toEqual(result);
  });

  test("formatting preserves the binding and reaches a deterministic fixed point", () => {
    const formatted = formatText(source());
    expect(formatText(formatted)).toBe(formatted);
    expect(compileSource(formatted).schemaValid).toBe(true);
    expect(compileSource(formatted).judgments).toEqual(compileSource(source()).judgments);
  });

  test("v0.3 leaves the v0.2 record contracts and compiled records unchanged", () => {
    expect(resolveWritDialect("0.3")?.records).toEqual(resolveWritDialect("0.2")?.records);
    const nist = readFileSync(
      fileURLToPath(
        new URL("../../../corpora/institutional/us/nist/records.writ", import.meta.url),
      ),
      "utf8",
    );
    expect(
      compileSource(nist.replace('language writ "0.2"', 'language writ "0.3"')).records,
    ).toEqual(compileSource(nist).records);
  });

  test("v0.2 keeps unbound judgments valid and refuses opt-in fields without changing contracts", () => {
    const old = compileSource(source("0.2", ""));
    expect(old.schemaValid).toBe(true);
    expect(old.judgments[0]?.schema_version).toBe("0.2.0");
    expect(old.judgments[0]).not.toHaveProperty("review_artifact");
    const unsupported = compileSource(source("0.2"));
    expect(unsupported.schemaValid).toBe(false);
    expect(unsupported.judgments[0]?.schema_version).toBe("0.2.0");
    expect(compileSource(source("0.3", "")).schemaValid).toBe(true);
  });

  test("new syntax keywords remain valid old-dialect identifiers", () => {
    for (const name of ["review_artifact", "path", "content_hash"]) {
      for (const dialect of ["0.1", "0.2"]) {
        let text = source(dialect, "")
          .replace("judgment bound_review", `judgment ${name}`)
          .replace("test.review_binding", `test.${name}`)
          .replace("type review_disposition", "type disagreement")
          .replace("synthetic_record", name)
          .replace("synthetic.passage", `${name}.${name}`);
        if (dialect === "0.1") text = text.replace("target record ", "target ");
        const result = compileSource(text);
        expect(result.schemaValid, `${dialect}:${name}`).toBe(true);
        expect(result.judgments[0]?.judgment_id).toBe(name);
        expect(result.judgments[0]?.evidence_refs).toEqual([`${name}.${name}`]);
      }
    }
  });

  test("duplicate identical and contradictory bindings fail rather than silently choosing one", () => {
    for (const second of [binding, binding.replace("docs/reviews/", "other/reviews/")]) {
      const result = compileSource(source("0.3", `${binding}\n${second}`));
      expect(result.schemaValid).toBe(false);
      expect(result.diagnostics).toMatchObject([
        {
          code: "WRT-JUDGMENT-REVIEW-ARTIFACT-DUPLICATE",
          severity: "error",
          objectId: "bound_review",
        },
      ]);
    }
  });

  test("malformed binding components are not silently discarded by lowering", () => {
    for (const declaration of [
      binding.replace("sha256:", "sha512:"),
      binding.replace("docs/reviews/", "../docs/reviews/"),
      binding.replace('path "docs/reviews/human-disposition.yaml";', ""),
      binding.replace("review_artifact {", 'review_artifact { reviewer "other";'),
    ]) {
      expect(compileSource(source("0.3", declaration)).schemaValid).toBe(false);
    }
  });
});
