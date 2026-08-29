import { describe, expect, test } from "bun:test";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { generateWritDataBundleForCommit, resolveCommitIdentity } from "../src/generate.js";
import { serializeBundle } from "../src/hashing.js";
import { projectCanonicalObjects, projectCompatibilityEvidence } from "../src/project.js";
import {
  rawHash,
  readNativeRepository,
  repositoryRoot,
  type NativeCorpus,
} from "../src/repository.js";
import { assertSourceFragments, validateWritDataBundle } from "../src/validate.js";

const TEST_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const bundle = generateWritDataBundleForCommit(TEST_COMMIT);

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

describe("Writ data bundle membership", () => {
  test("exports every manifest-routed record without approval filtering", () => {
    expect(bundle.corpora).toHaveLength(16);
    expect(bundle.records).toHaveLength(73);
    expect(bundle.recordLinks).toHaveLength(7);
    expect(bundle.recordJudgments).toHaveLength(46);

    expect(countBy(bundle.records.map((record) => record.reviewState ?? "none"))).toEqual({
      accepted: 32,
      none: 2,
      draft: 3,
      approved: 34,
      superseded: 2,
    });
    expect(countBy(bundle.records.map((record) => record.recordType))).toEqual({
      political_claim: 32,
      political_entity: 2,
      legal_policy: 3,
      institutional: 36,
    });
  });

  test("uses globally unique stable keys and preserves corpus membership", () => {
    expect(new Set(bundle.records.map((record) => record.recordKey)).size).toBe(73);
    for (const record of bundle.records) {
      expect(record.recordKey).toBe(`${record.corpusId}::${record.recordId}`);
      expect(bundle.corpora.some((corpus) => corpus.corpusId === record.corpusId)).toBe(true);
    }
  });
});

describe("canonical source and provenance", () => {
  test("exports exact reparsed YAML and Writ source slices", () => {
    const yaml = bundle.records.find((record) => record.recordType === "political_claim")!;
    expect(yaml.storedSource.language).toBe("yaml");
    expect(yaml.storedSource.fragment).toBe(yaml.recordId);
    expect(yaml.storedRecord?.machine_id).toBe(yaml.recordId);
    expect(yaml.storedSource.content).toContain(yaml.recordId);

    const writ = bundle.records.find((record) => record.recordType === "institutional")!;
    expect(writ.storedSource.language).toBe("writ");
    expect(writ.storedSource.fragment).toBe(writ.recordId);
    expect(writ.compiledRecord?.record_id).toBe(writ.recordId);
    expect(writ.storedSource.content).toContain(writ.recordId);
  });

  test("identifies every record-level source slice without path ambiguity", () => {
    const identities = bundle.records.map(
      (record) => `${record.storedSource.path}#${record.storedSource.fragment}`,
    );
    expect(new Set(identities).size).toBe(bundle.records.length);
    expect(bundle.records.every((record) => record.storedSource.fragment === record.recordId)).toBe(
      true,
    );
    expect(
      bundle.recordJudgments.every(
        (judgment) => judgment.storedSource.fragment === judgment.judgmentId,
      ),
    ).toBe(true);

    const ambiguous = structuredClone(bundle);
    Object.assign(ambiguous.records[0]!.storedSource, { fragment: "another-record" });
    expect(() => assertSourceFragments(ambiguous)).toThrow(/stored-source fragment/);
  });

  test("resolves native Writ evidence through source modules in the same corpus", () => {
    const nistSupport = bundle.records
      .filter((record) => record.corpusId === "us.institutions.nist")
      .flatMap((record) => record.evidence)
      .find((support) => support.source.sourceId === "nist.about")!;
    expect(nistSupport.source.documentVersionId).toBe("nist.about.v2022_01_11");
    expect(nistSupport.source.title).toBe("About NIST");
    expect(nistSupport.source.uri).toBe("https://www.nist.gov/about-nist");
    expect(nistSupport.source.mediaType).toBe("text/html");
    expect(nistSupport.source.retrievedAt).toBe("2026-08-03T00:00:00-04:00");

    const compatibilitySourceId = "eu_ai_act_2024_1689";
    const euInstitutionalSupport = bundle.records
      .filter((record) => record.corpusId === "eu.institutions.european_commission")
      .flatMap((record) => record.evidence)
      .find((support) => support.source.sourceId === compatibilitySourceId)!;
    expect(euInstitutionalSupport.source.documentVersionId).toBe("dv_eu_ai_act_2024_1689");
    expect(euInstitutionalSupport.source.title).toContain("Artificial Intelligence Act");
    expect(euInstitutionalSupport.source.uri).toBe(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689",
    );

    const repository = readNativeRepository();
    const maliciousSource = [
      "sources:",
      "  - machine_id: nist.about",
      '    title: "Borrowed from another corpus"',
      "",
    ].join("\n");
    expect(() =>
      projectCanonicalObjects({
        ...repository,
        corpora: repository.corpora.map((corpus) =>
          corpus.entry.corpus_id === "us.institutions.nist"
            ? { ...corpus, resources: { ...corpus.resources, sources: [] } }
            : corpus,
        ),
        resources: new Map([
          ...repository.resources,
          [
            "corpora/foreign/sources.yaml",
            {
              path: "corpora/foreign/sources.yaml",
              fragment: null,
              language: "yaml" as const,
              sha256: rawHash(maliciousSource),
              content: maliciousSource,
            },
          ],
        ]),
      }),
    ).toThrow(/evidence source nist\.about does not resolve/);
  });

  test("exports every NIST fact with complete portable structured evidence", () => {
    const records = bundle.records.filter((record) => record.corpusId === "us.institutions.nist");
    expect(records).toHaveLength(16);
    for (const record of records) {
      expect(record.recordKey).toBe(`us.institutions.nist::${record.recordId}`);
      expect(record.evidence.length, record.recordId).toBeGreaterThan(0);
      const compiledEvidence = record.compiledRecord?.evidence;
      expect(Array.isArray(compiledEvidence), record.recordId).toBe(true);
      const sourceBasisByPassage = new Map<string, string>();
      for (const evidence of compiledEvidence as Array<{
        passage_id?: unknown;
        basis?: unknown;
      }>) {
        if (typeof evidence.passage_id !== "string" || typeof evidence.basis !== "string") {
          throw new Error(`${record.recordId}: compiled evidence has no passage ID or basis`);
        }
        sourceBasisByPassage.set(evidence.passage_id, evidence.basis);
      }
      for (const support of record.evidence) {
        expect(support.state, record.recordId).toBe("traced");
        expect(support.passageId, record.recordId).toBeTruthy();
        if (support.passageId === null || support.basis === null) {
          throw new Error(`${record.recordId}: portable evidence has no passage ID or basis`);
        }
        expect(["direct", "inferred", "inherited"], record.recordId).toContain(support.basis);
        const sourceBasis = sourceBasisByPassage.get(support.passageId);
        if (sourceBasis === undefined) {
          throw new Error(`${record.recordId}: portable passage is absent from compiled evidence`);
        }
        expect(support.basis, `${record.recordId}:${support.passageId}`).toBe(sourceBasis);
        expect(support.locator, record.recordId).toBeTruthy();
        expect(support.quote, record.recordId).toBeTruthy();
        expect(support.passageHash, record.recordId).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(support.documentHash, record.recordId).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(support.source.sourceId, record.recordId).toBeTruthy();
        expect(support.source.documentVersionId, record.recordId).toBeTruthy();
        expect(support.source.title, record.recordId).toBeTruthy();
        expect(support.source.uri, record.recordId).toMatch(/^https:\/\//);
        expect(support.source.retrievedAt, record.recordId).toBeTruthy();
        expect(support.source.mediaType, record.recordId).toBeTruthy();
        const passageHash = `sha256:${createHash("sha256").update(support.quote!).digest("hex")}`;
        expect(passageHash, `${record.recordId}:${support.passageId}`).toBe(support.passageHash!);
      }
    }
  });

  test("preserves multiple and unresolved evidence supports separately", () => {
    expect(bundle.records.some((record) => record.evidence.length > 1)).toBe(true);
    expect(
      bundle.records.some((record) =>
        record.evidence.some((support) => support.state === "unresolved"),
      ),
    ).toBe(true);
    for (const record of bundle.records) {
      expect(new Set(record.evidence.map((support) => support.supportId)).size).toBe(
        record.evidence.length,
      );
    }
  });

  test("does not invent unresolved evidence when no canonical support exists", () => {
    const corpus = {
      resources: {
        sources: [],
        passages: [],
        records: [],
        relationships: [],
        judgments: [],
        migration: [],
      },
    } as unknown as NativeCorpus;
    expect(
      projectCompatibilityEvidence(corpus, {
        record_type: "political_claim",
        machine_id: "claim.without.canonical.evidence",
      }),
    ).toEqual([]);
    expect(
      bundle.records
        .flatMap((record) => record.evidence)
        .some((support) => support.supportId.endsWith(":unresolved")),
    ).toBe(false);
  });
});

describe("deterministic neutral contract", () => {
  test("validates hashes and is byte-identical across clean generation", () => {
    validateWritDataBundle(bundle);
    const second = generateWritDataBundleForCommit(TEST_COMMIT);
    expect(serializeBundle(second)).toBe(serializeBundle(bundle));
  });

  test("does not expose web-owned projection fields", () => {
    const rootKeys = Object.keys(bundle);
    expect(rootKeys).toEqual([
      "metadata",
      "catalog",
      "corpora",
      "resources",
      "records",
      "recordLinks",
      "recordJudgments",
    ]);
    const recordKeys = new Set(bundle.records.flatMap((record) => Object.keys(record)));
    for (const forbidden of [
      "corpusIndex",
      "recordIndex",
      "displayId",
      "searchableText",
      "labRecordId",
      "mappedCount",
      "homepageSubset",
      "demoAnalysis",
      "pilotFiles",
    ]) {
      expect(recordKeys.has(forbidden)).toBe(false);
    }
    expect("generatedAt" in bundle.metadata).toBe(false);
  });

  test("refuses to label a dirty or invalid repository state as a Writ commit", () => {
    expect(resolveCommitIdentity(TEST_COMMIT, "")).toBe(TEST_COMMIT);
    expect(() => resolveCommitIdentity(TEST_COMMIT, " M corpora/catalog.yaml")).toThrow(
      /clean committed repository state/,
    );
    expect(() => resolveCommitIdentity("not-a-commit", "")).toThrow(/Invalid Writ commit identity/);
  });

  test("preserves Writ's declared rights metadata", () => {
    expect(bundle.metadata.softwareLicense).toBe("Apache-2.0");
    expect(bundle.metadata.softwareLicenseFile).toBe("LICENSE");
    expect(bundle.metadata.softwareLicenseText).toBe(
      readFileSync(`${repositoryRoot}/LICENSE`, "utf8"),
    );
    expect(bundle.metadata.copyrightNotice).toBe("Copyright 2026 Sara Kim");
    expect(bundle.metadata.thirdPartyNoticesFile).toBe("THIRD_PARTY_NOTICES.md");
    expect(bundle.metadata.thirdPartyNoticesText).toBe(
      readFileSync(`${repositoryRoot}/THIRD_PARTY_NOTICES.md`, "utf8"),
    );
  });
});
