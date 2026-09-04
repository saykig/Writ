import { describe, expect, test } from "bun:test";

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import { RAW_COMPATIBILITY_SCHEMAS, SCHEMA_IDS } from "@writ/domain";
import { generateWritDataBundleForCommit, resolveCommitIdentity } from "../src/generate.js";
import { serializeBundle } from "../src/hashing.js";
import {
  projectCanonicalObjects,
  projectCompatibilityEvidence,
  projectRecordLinks,
} from "../src/project.js";
import {
  REVIEWED_DOCUMENT_CONTRACT,
  assertSupportedRecordContract,
  rawHash,
  readNativeRepository,
  repositoryRoot,
  source,
  type NativeCorpus,
  type NativeRepository,
} from "../src/repository.js";
import { assertSourceFragments, validateWritDataBundle } from "../src/validate.js";

const TEST_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const bundle = generateWritDataBundleForCommit(TEST_COMMIT);
const NATIVE_LEGAL_FIXTURE = "internal/verification/writ/test/fixtures/native-legal-policy";

function nativeLegalFixtureRepository(includeRoutedSource = true): NativeRepository {
  const recordPath = `${NATIVE_LEGAL_FIXTURE}/records.writ`;
  const sourcePath = `${NATIVE_LEGAL_FIXTURE}/sources.writ`;
  const manifest = {
    schema_version: "1.0.0",
    corpus_id: "test.native_legal_policy",
    title: "Synthetic native legal-policy verifier corpus",
    family: "legal_policy",
    jurisdiction: "US",
    status: "draft",
    corpus_version: "0.2.0",
    record_contract: {
      kind: "native" as const,
      id: SCHEMA_IDS["legal-policy-record"],
      version: "0.2.0",
    },
    locations: {
      sources: includeRoutedSource ? [sourcePath] : [],
      passages: [recordPath],
      records: [recordPath],
      relationships: [],
      judgments: [],
      migration: [],
    },
    record_counts: { legal_policy_records: 1, record_links: 0, disposition_judgments: 0 },
    review_counts: {},
    unresolved_evidence_count: 0,
  };
  const entry = {
    corpus_id: manifest.corpus_id,
    family: manifest.family,
    jurisdiction: manifest.jurisdiction,
    status: manifest.status,
    path: NATIVE_LEGAL_FIXTURE,
    manifest: `${NATIVE_LEGAL_FIXTURE}/corpus.yaml`,
  };
  const manifestText = Bun.YAML.stringify(manifest);
  const corpus: NativeCorpus = {
    entry,
    manifest,
    manifestSource: source(entry.manifest, manifestText),
    canonicalIdentity: { kind: "instrument", instrumentId: "synthetic_policy" },
    resources: manifest.locations,
  };
  return {
    catalog: {},
    catalogSource: source("corpora/catalog.yaml", "{}\n"),
    corpora: [corpus],
    resources: new Map(
      [recordPath, ...(includeRoutedSource ? [sourcePath] : [])].map((path) => [
        path,
        source(path),
      ]),
    ),
  };
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function compatibilityEvidenceCorpus(
  sources: Array<Record<string, unknown>>,
  passages: Array<Record<string, unknown>>,
): { corpus: NativeCorpus; cleanup: () => void } {
  const directory = mkdtempSync(`${repositoryRoot}/packages/data-bundle/test/.adversarial-`);
  const sourcePath = relative(repositoryRoot, `${directory}/sources.yaml`);
  const passagePath = relative(repositoryRoot, `${directory}/passages.yaml`);
  const relationshipPath = relative(repositoryRoot, `${directory}/relationships.yaml`);
  writeFileSync(`${directory}/sources.yaml`, Bun.YAML.stringify({ sources }));
  writeFileSync(`${directory}/passages.yaml`, Bun.YAML.stringify({ passages }));
  writeFileSync(
    `${directory}/relationships.yaml`,
    Bun.YAML.stringify({
      relationships: [
        {
          machine_id: "support.one",
          relationship_type: "supported_by_passage",
          subject_machine_id: "claim.one",
          object_machine_id: "passage.one",
        },
      ],
    }),
  );
  const base = nativeLegalFixtureRepository().corpora[0]!;
  return {
    corpus: {
      ...base,
      resources: {
        ...base.resources,
        sources: [sourcePath],
        passages: [passagePath],
        relationships: [relationshipPath],
      },
    },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

const compatibilitySource = {
  machine_id: "source.one",
  aliases: [],
  legacy_refs: [],
  document_version_id: "source.one.v1",
  title: "Synthetic source",
  uri: "https://example.test/source",
  sha256: `sha256:${"1".repeat(64)}`,
};
const compatibilityPassage = {
  machine_id: "passage.one",
  source_machine_id: "source.one",
  dom_path: "main/p[1]",
  quote: "Synthetic evidence.",
  anchor_hash: `sha256:${"2".repeat(64)}`,
};

describe("Writ data bundle membership", () => {
  test("exports every manifest-routed record without approval filtering", () => {
    expect(bundle.corpora).toHaveLength(16);
    expect(bundle.records).toHaveLength(81);
    expect(bundle.recordLinks).toHaveLength(16);
    expect(bundle.recordJudgments).toHaveLength(65);

    expect(countBy(bundle.records.map((record) => record.reviewState ?? "none"))).toEqual({
      accepted: 32,
      none: 2,
      draft: 3,
      approved: 34,
      superseded: 10,
    });
    expect(countBy(bundle.records.map((record) => record.recordType))).toEqual({
      political_claim: 32,
      political_entity: 2,
      legal_policy: 3,
      institutional: 44,
    });
  });

  test("uses globally unique stable keys and preserves corpus membership", () => {
    expect(new Set(bundle.records.map((record) => record.recordKey)).size).toBe(81);
    for (const record of bundle.records) {
      expect(record.recordKey).toBe(`${record.corpusId}::${record.recordId}`);
      expect(bundle.corpora.some((corpus) => corpus.corpusId === record.corpusId)).toBe(true);
    }
  });
});

describe("canonical source and provenance", () => {
  test("projects a valid native legal-policy record through routed source authority", () => {
    const projected = projectCanonicalObjects(nativeLegalFixtureRepository());
    expect(projected.records).toHaveLength(1);
    expect(projected.records[0]!.recordId).toBe("synthetic_native_legal_policy_record");
    expect(projected.records[0]!.evidence).toEqual([
      expect.objectContaining({
        state: "traced",
        passageId: "synthetic.policy.passage",
        passageHash: "sha256:3f6fe63be01912fb99033b62c4c8affb4ae3b0cf8b428b4e5cbb8b88fc209a18",
        documentHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        source: expect.objectContaining({
          sourceId: "synthetic.policy.source",
          documentVersionId: "synthetic.policy.source.v1",
        }),
      }),
    ]);
  });

  test("does not let native source_metadata fabricate traced evidence", () => {
    expect(() => projectCanonicalObjects(nativeLegalFixtureRepository(false))).toThrow(
      /evidence source synthetic\.policy\.source does not resolve to structured source metadata/,
    );
  });

  test("rejects duplicate native Writ source declarations before projection", () => {
    for (const variation of ["identical", "conflicting"] as const) {
      const directory = mkdtempSync(`${repositoryRoot}/packages/data-bundle/test/.adversarial-`);
      const path = relative(repositoryRoot, `${directory}/sources.writ`);
      const original = readFileSync(
        `${repositoryRoot}/${NATIVE_LEGAL_FIXTURE}/sources.writ`,
        "utf8",
      );
      const sourceBlock = original.match(/source synthetic_policy_source \{[\s\S]*?\n\}/)![0];
      const metadataBlock = original.match(
        /concept SyntheticPolicySourceMetadata \{[\s\S]*?\n\}/,
      )![0];
      const duplicateSource = sourceBlock
        .replace("synthetic_policy_source", "synthetic_policy_source_duplicate")
        .replace(
          /sha256:[0-9a-f]{64}/,
          variation === "conflicting"
            ? `sha256:${"f".repeat(64)}`
            : original.match(/sha256:[0-9a-f]{64}/)![0],
        );
      const duplicateMetadata = metadataBlock.replace(
        "SyntheticPolicySourceMetadata",
        "SyntheticPolicySourceMetadataDuplicate",
      );
      writeFileSync(
        `${directory}/sources.writ`,
        `${original.trim()}\n\n${duplicateSource}\n${duplicateMetadata}\n`,
      );
      const repository = nativeLegalFixtureRepository();
      try {
        expect(() =>
          projectCanonicalObjects({
            ...repository,
            corpora: repository.corpora.map((corpus) => ({
              ...corpus,
              resources: { ...corpus.resources, sources: [path] },
            })),
          }),
        ).toThrow(/duplicate source identity synthetic\.policy\.source/);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  test("rejects reviewed source canonical, alias, and legacy identity collisions", () => {
    for (const variation of ["identical", "conflicting", "alias", "legacy"] as const) {
      const first = structuredClone(compatibilitySource);
      const second: Record<string, unknown> = structuredClone(compatibilitySource);
      if (variation === "conflicting") second.sha256 = `sha256:${"f".repeat(64)}`;
      if (variation === "alias" || variation === "legacy") {
        second.machine_id = "source.two";
        second.aliases = variation === "alias" ? [first.machine_id] : [];
        second.legacy_refs = variation === "legacy" ? [first.machine_id] : [];
      }
      const fixture = compatibilityEvidenceCorpus(
        [first, second],
        [structuredClone(compatibilityPassage)],
      );
      try {
        expect(() =>
          projectCompatibilityEvidence(fixture.corpus, {
            record_type: "political_claim",
            machine_id: "claim.one",
          }),
        ).toThrow(/duplicate source identity/);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("rejects identical and conflicting reviewed passage declarations", () => {
    for (const variation of ["identical", "conflicting"] as const) {
      const first = structuredClone(compatibilityPassage);
      const second: Record<string, unknown> = structuredClone(compatibilityPassage);
      if (variation === "conflicting") {
        second.quote = "Conflicting evidence.";
        second.anchor_hash = `sha256:${"f".repeat(64)}`;
      }
      const fixture = compatibilityEvidenceCorpus(
        [structuredClone(compatibilitySource)],
        [first, second],
      );
      try {
        expect(() =>
          projectCompatibilityEvidence(fixture.corpus, {
            record_type: "political_claim",
            machine_id: "claim.one",
          }),
        ).toThrow(/duplicate passage identity/);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("rejects record-link owning corpus contradictions", () => {
    const repository = readNativeRepository();
    const corpus = repository.corpora.find(
      ({ manifest, resources }) =>
        manifest.record_contract.kind === "native" &&
        resources.relationships.some((path) => path.endsWith(".yaml")),
    )!;
    expect(corpus.resources.relationships.length).toBeGreaterThan(0);
    expect(() =>
      projectRecordLinks({
        ...corpus,
        entry: { ...corpus.entry, corpus_id: "synthetic.laundered.owner" },
      }),
    ).toThrow(/declares owning corpus .* but is stored by synthetic\.laundered\.owner/);
  });

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
    expect(records).toHaveLength(20);
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
  test("matches the human-reviewed semantic projections at a fixed commit identity", () => {
    expect(bundle.metadata.sectionHashes).toEqual({
      catalog: "sha256:144f343a1234b167fa84db89ec20216c47162d796b3131a9eaf8eeaa4275ad4d",
      corpora: "sha256:dcc673a2143e57e5b76690980ff810ac406c560a701667ade4944d3320842d9d",
      resources: "sha256:a38e63a5cc23cd5545a1fec5ad2eaa9827b5619f498f431e6cc5fd53fb7b7b6d",
      records: "sha256:9434e3aba7664876dcd5fe075b074209b5275bcf242f1dd66aa9377505b77ab2",
      recordLinks: "sha256:34852b10c260f587d8caa6b1c25377b99e584dad4d1fe36375c863d69672968c",
      recordJudgments: "sha256:74b0af33d521d948fa5472f559c0ca0faacd78b6582d5d4af5a845e0bd0a02ca",
    });
  });

  test("exports both approved NIST bindings with exact reloadable bytes and distinct lineages", () => {
    expect(bundle.metadata.bundleFormatVersion).toBe("1.1.0");
    const artifact = readFileSync(
      `${repositoryRoot}/docs/migrations/nist-handbook-competence/human-review.yaml`,
    );
    const ids = [
      "judgment_nist_nvlap_lab_decision_right_v2_bound_review",
      "judgment_nist_nvlap_lab_decision_right_v2_supersession_bound_review",
    ];
    const entries = bundle.recordJudgments.filter((entry) => ids.includes(entry.judgmentId));
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.compiledJudgment!.target_id)).size).toBe(2);
    for (const entry of entries) {
      expect(entry.reviewArtifact?.encoding).toBe("base64");
      expect(Buffer.from(entry.reviewArtifact!.content, "base64")).toEqual(artifact);
      expect(entry.compiledJudgment!.review_artifact).toEqual({
        path: "docs/migrations/nist-handbook-competence/human-review.yaml",
        content_hash: "sha256:75e67171bd28d33e623b8079ae20fb6c92dd7ba7b984c8ddbf8ee940fcd0f713",
      });
    }
    expect(() => validateWritDataBundle(JSON.parse(serializeBundle(bundle)))).not.toThrow();
  });

  test("rejects a known record contract with an unsupported exact version", () => {
    const repository = readNativeRepository();
    const changed = {
      ...repository,
      corpora: repository.corpora.map((corpus, index) =>
        index === 0
          ? {
              ...corpus,
              manifest: {
                ...corpus.manifest,
                record_contract: { ...corpus.manifest.record_contract, version: "9.0.0" },
              },
            }
          : corpus,
      ),
    };
    expect(() => projectCanonicalObjects(changed)).toThrow(
      /unsupported exact record contract .* version 9\.0\.0/,
    );
  });

  test("accepts exactly the current verifier-supported manifest contract capabilities", () => {
    const supported = [
      {
        kind: "native",
        id: SCHEMA_IDS["institutional-record"],
        version: "0.2.0",
      },
      {
        kind: "native",
        id: SCHEMA_IDS["legal-policy-record"],
        version: "0.2.0",
      },
      {
        kind: "compatibility",
        id: String(RAW_COMPATIBILITY_SCHEMAS["legal-policy-record"].$id),
        version: "0.1.0",
      },
      {
        kind: "compatibility",
        id: REVIEWED_DOCUMENT_CONTRACT,
        version: "1.0.0",
      },
    ] as const;

    for (const contract of supported) {
      expect(() => assertSupportedRecordContract(contract, "supported fixture")).not.toThrow();
    }
  });

  test("does not export compiler-only contracts unsupported by verifier manifest adapters", () => {
    const compilerOnly = [
      { kind: "native", id: SCHEMA_IDS.record, version: "0.2.0" },
      {
        kind: "compatibility",
        id: String(RAW_COMPATIBILITY_SCHEMAS.record.$id),
        version: "0.1.0",
      },
      {
        kind: "compatibility",
        id: String(RAW_COMPATIBILITY_SCHEMAS["institutional-record"].$id),
        version: "0.1.0",
      },
    ] as const;

    for (const contract of compilerOnly) {
      expect(() => assertSupportedRecordContract(contract, "compiler-only fixture")).toThrow(
        /unsupported exact record contract/,
      );
    }
  });

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
