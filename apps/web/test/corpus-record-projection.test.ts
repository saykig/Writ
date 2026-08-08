import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isRecordDeclaration, parseDocument as parseWritDocument } from "@writ/language";
import { parseDocument as parseYamlDocument } from "yaml";

import { CORPUS_CATALOG } from "../lib/corpus-catalog-data";
import {
  deriveCorpusTraceState,
  extractWritRecordSources,
  extractYamlSequenceRecords,
  projectCorpusRecords,
  unresolvedLegalSupports,
  validateLegalRelationships,
} from "../scripts/embed-corpus-records";
import { readNativeCorpora, repoRoot } from "../scripts/lib/read-native-corpora";

const projection = projectCorpusRecords();
const records = projection.index;
const details = Object.values(projection.details);

describe("canonical Corpus record projection", () => {
  test("projects the current accepted and approved corpus without superseded records", () => {
    expect(records).toHaveLength(66);
    expect(records.filter((record) => record.family === "legal_policy")).toHaveLength(32);
    expect(records.filter((record) => record.family === "institutional")).toHaveLength(34);
    expect(
      records.filter((record) => record.corpusId === "eu.institutions.european_commission"),
    ).toHaveLength(20);
    expect(records.filter((record) => record.corpusId === "us.institutions.nist")).toHaveLength(14);
    expect(records.some((record) => record.recordId === "nist_measurement_science_function")).toBe(
      false,
    );
  });

  test("preserves family review vocabulary separately from corpus status", () => {
    expect(
      records
        .filter((record) => record.family === "legal_policy")
        .every((record) => record.reviewState === "accepted"),
    ).toBe(true);
    expect(
      records
        .filter((record) => record.family === "institutional")
        .every((record) => record.reviewState === "approved" && record.corpusStatus === "draft"),
    ).toBe(true);
  });

  test("has stable unique keys, catalog membership and deterministic order", () => {
    expect(new Set(records.map((record) => record.recordKey)).size).toBe(66);
    const catalogIds = new Set(CORPUS_CATALOG.map((corpus) => corpus.corpusId));
    expect(records.every((record) => catalogIds.has(record.corpusId))).toBe(true);
    expect(projectCorpusRecords()).toEqual(projection);
  });

  test("retains all evidence supports separately and derives three-state tracing", () => {
    const cooperation = details.find(
      (detail) => detail.index.recordId === "eu_ai_office_cooperation_capacity",
    );
    expect(cooperation?.evidence).toHaveLength(2);
    expect(cooperation?.evidence[0]?.passageId).not.toBe(cooperation?.evidence[1]?.passageId);
    expect(records.filter((record) => record.traceState === "untraced")).toHaveLength(5);
    expect(records.filter((record) => record.traceState === "fully_traced")).toHaveLength(61);

    const traced = cooperation!.evidence[0]!;
    const unresolved = { ...traced, state: "unresolved" as const, quote: null };
    expect(deriveCorpusTraceState([traced, unresolved])).toBe("partially_traced");
    expect(deriveCorpusTraceState([unresolved])).toBe("untraced");
  });

  test("keeps unresolved coverage beside traced support for a partial legal record", () => {
    const corpus = readNativeCorpora().find(
      ({ entry }) =>
        entry.corpus_id === "writ.corpus.legal-policy.eu.european-commission.gpai-guidelines",
    )!;
    const unresolved = unresolvedLegalSupports(
      corpus,
      { machine_id: "claim", instrument: "TEST_INSTRUMENT", source_locator: "section 1" },
      [
        {
          machine_id: "source",
          display_ref: "Unresolved test source",
          verification_status: "unresolved",
        },
      ],
      [
        {
          machine_id: "coverage",
          source_machine_id: "source",
          instrument: "TEST_INSTRUMENT",
          reason: "source is not registered",
        },
      ],
    );
    const traced = details.find((detail) => detail.index.displayId === "EU-01")!.evidence[0]!;
    expect(unresolved).toHaveLength(1);
    expect(deriveCorpusTraceState([traced, ...unresolved])).toBe("partially_traced");
  });

  test("rejects malformed or dangling evidence relationships", () => {
    const base = {
      machine_id: "relationship",
      relationship_type: "supported_by_passage",
      subject_machine_id: "claim",
      subject_type: "claim",
      object_machine_id: "passage",
      object_type: "passage",
    };
    expect(() => validateLegalRelationships([base], new Set(["claim"]), new Set())).toThrow(
      "missing passage",
    );
    expect(() =>
      validateLegalRelationships(
        [{ ...base, object_type: "entity" }],
        new Set(["claim"]),
        new Set(["passage"]),
      ),
    ).toThrow("malformed evidence endpoint types");
    expect(() =>
      validateLegalRelationships([base, base], new Set(["claim"]), new Set(["passage"])),
    ).toThrow("Duplicate relationship id");
  });

  test("always scans native families and rejects every compiler diagnostic", () => {
    const generator = readFileSync(
      join(repoRoot, "apps/web/scripts/embed-corpus-records.ts"),
      "utf8",
    );
    expect(generator).not.toContain('corpus.entry.family === "legal_policy" && acceptedCount > 0');
    expect(generator).not.toContain('corpus.entry.family === "institutional" && approvedCount > 0');
    expect(generator).toContain("compiled.diagnostics.length > 0");
  });

  test("encodes exactly the seven curated Lab mappings", () => {
    expect(
      records.flatMap((record) => (record.labRecordId ? [record.labRecordId] : [])).sort(),
    ).toEqual(["EU-01", "EU-05", "EU-06", "EU-12", "US-03", "US-08A", "US-11"]);
  });

  test("keeps the client index free of full source payloads", () => {
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("passageHash");
    expect(serialized).not.toContain("documentHash");
    expect(serialized).not.toContain("storedSource");
    expect(serialized).not.toContain("compiledOutput");
  });
});

describe("exact canonical source extraction", () => {
  test("slices a stored legal-policy YAML record that reparses to its identity", () => {
    const path = join(
      repoRoot,
      "corpora/legal-policy/eu/european-union/artificial-intelligence-act-2024-1689/records/claims.yaml",
    );
    const sourceText = readFileSync(path, "utf8");
    const extracted = extractYamlSequenceRecords(sourceText, "claims", "machine_id")[0]!;
    const reparsed = parseYamlDocument(extracted.source).toJS();
    expect(reparsed[0].machine_id).toBe(extracted.value.machine_id);
    expect(sourceText.includes(extracted.source)).toBe(true);
  });

  test("slices a canonical Writ declaration that reparses to its identity", () => {
    const path = join(repoRoot, "corpora/institutional/us/nist/records.writ");
    const sourceText = readFileSync(path, "utf8");
    const extracted = extractWritRecordSources(sourceText, path).get("nist_identity")!;
    const reparsed = parseWritDocument(
      `language writ "0.2"\npackage corpus.extraction.test version "0.2.0";\n\n${extracted}`,
    );
    expect(reparsed.ok).toBe(true);
    expect(reparsed.model.declarations.find(isRecordDeclaration)?.name).toBe("nist_identity");
    expect(sourceText.includes(extracted)).toBe(true);
  });
});

test("the homepage catalog projection still agrees with the shared canonical reader", () => {
  const native = readNativeCorpora();
  expect(
    CORPUS_CATALOG.map((corpus) => ({
      corpusId: corpus.corpusId,
      family: corpus.family,
      jurisdiction: corpus.jurisdiction,
      status: corpus.status,
    })),
  ).toEqual(
    native.map(({ entry }) => ({
      corpusId: entry.corpus_id,
      family: entry.family,
      jurisdiction: entry.jurisdiction,
      status: entry.status,
    })),
  );
});
