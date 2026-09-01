import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { WritRecord } from "@writ/domain";
import { compileSource } from "@writ/language";

import {
  LEGAL_POLICY_RECORD_SCHEMA,
  loadRepository,
  logicalPassageConflicts,
  resolveLogicalPassage,
  resolveRoutedSource,
  repositoryRoot,
  verifyInteroperability,
  verifyOntology,
  verifyProvenance,
  verifySnapshot,
  type LoadedRecord,
  type RepositorySnapshot,
} from "../src/index.js";

const ROOT = repositoryRoot(import.meta.dir);
const FIXTURE = join(import.meta.dir, "fixtures/native-legal-policy");
const baseline = loadRepository(ROOT).snapshot;
const clone = (): RepositorySnapshot => structuredClone(baseline);
const codes = (result: { issues: Array<{ code: string }> }): string[] =>
  result.issues.map(({ code }) => code);

const ASCII_QUOTE = "A policy states one bounded requirement.";
const ASCII_HASH = "sha256:3f6fe63be01912fb99033b62c4c8affb4ae3b0cf8b428b4e5cbb8b88fc209a18";
const NFC_HASH = "sha256:73473dcc12b763085904a5279d048c4d5b3b008c46f1f32443b99de04aa83a14";
const NFD_HASH = "sha256:c42cc7a1ca08364b6fd859fa50d2454730a8236290a423373cc630da77c6d711";

function sourceRecord(snapshot: RepositorySnapshot): LoadedRecord {
  return snapshot.records.find(
    ({ governing_contract, value }) =>
      governing_contract.verifies_core_provenance &&
      value.evidence.length > 0 &&
      snapshot.objects.some(
        (object) => object.kind === "source_document" && object.id === value.evidence[0]!.source_id,
      ),
  )!;
}

function addNativeLegalRecord(
  snapshot: RepositorySnapshot,
  recordId: string,
  corpusId = "synthetic.native.legal",
): LoadedRecord {
  const template = structuredClone(sourceRecord(snapshot));
  const value = template.value as WritRecord & Record<string, unknown>;
  value.record_id = recordId;
  value.corpus_id = corpusId;
  value.family = "legal_policy";
  value.review_state = "draft";
  template.corpus_id = corpusId;
  template.file = `synthetic/${recordId}.writ`;
  template.manifest_family = "legal_policy";
  template.catalog_family = "legal_policy";
  template.governing_contract = {
    kind: "native",
    id: LEGAL_POLICY_RECORD_SCHEMA,
    version: "0.2.0",
    adapter_kind: "current_native_core",
    expected_family: "legal_policy",
    verifies_core_provenance: true,
  };
  snapshot.records.push(template);
  const source = snapshot.objects.find(
    (object) =>
      object.kind === "source_document" && object.id === template.value.evidence[0]!.source_id,
  )!;
  snapshot.sourceRoutes.push({ corpus_id: corpusId, file: source.file });
  return template;
}

function miniNativeLegalWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "writ-native-provenance-"));
  cpSync(join(ROOT, "schemas"), join(root, "schemas"), { recursive: true });
  const corpusPath = "corpora/test/native-legal-policy";
  mkdirSync(join(root, corpusPath), { recursive: true });
  cpSync(FIXTURE, join(root, corpusPath), { recursive: true });
  writeFileSync(
    join(root, "corpora/catalog.yaml"),
    Bun.YAML.stringify({
      schema_version: "1.0.0",
      implemented_native_families: ["legal_policy", "institutional"],
      native_corpora: [
        {
          corpus_id: "test.native_legal_policy",
          family: "legal_policy",
          jurisdiction: "US",
          status: "draft",
          path: corpusPath,
          manifest: `${corpusPath}/corpus.yaml`,
        },
      ],
      retired_corpus_migrations: [],
    }),
  );
  writeFileSync(
    join(root, corpusPath, "corpus.yaml"),
    Bun.YAML.stringify({
      schema_version: "1.0.0",
      corpus_id: "test.native_legal_policy",
      title: "Synthetic native legal-policy verifier corpus",
      family: "legal_policy",
      jurisdiction: "US",
      corpus_version: "0.2.0",
      record_contract: {
        kind: "native",
        id: LEGAL_POLICY_RECORD_SCHEMA,
        version: "0.2.0",
      },
      status: "draft",
      identity_namespace: "test.native_legal_policy",
      migration_aliases: [],
      instrument_id: "synthetic_policy",
      record_counts: { legal_policy_records: 1, record_links: 0, disposition_judgments: 0 },
      review_counts: {
        approved_records: 0,
        superseded_records: 0,
        draft_records: 1,
        approved_record_links: 0,
        draft_record_links: 0,
        accepted_disposition_judgments: 0,
        proposed_disposition_judgments: 0,
        superseded_disposition_judgments: 0,
      },
      unresolved_evidence_count: 0,
      locations: {
        sources: ["sources.writ"],
        passages: ["records.writ"],
        records: ["records.writ"],
        relationships: [],
        judgments: [],
        migration: [],
      },
    }),
  );
  return root;
}

const positiveWorkspace = miniNativeLegalWorkspace();

describe("generic current-native Core provenance", () => {
  test("compiles, contract-loads, and verifies a native legal-policy v0.2 record", () => {
    const recordFile = join(FIXTURE, "records.writ");
    const compiled = compileSource(readFileSync(recordFile, "utf8"), { fileName: recordFile });
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.schemaValid).toBe(true);
    expect(compiled.records).toHaveLength(1);

    const snapshot = loadRepository(positiveWorkspace).snapshot;
    expect(snapshot.loadIssues).toEqual([]);
    expect(snapshot.records[0]!.governing_contract).toEqual({
      kind: "native",
      id: LEGAL_POLICY_RECORD_SCHEMA,
      version: "0.2.0",
      adapter_kind: "current_native_core",
      expected_family: "legal_policy",
      verifies_core_provenance: true,
    });
    expect(
      verifySnapshot(snapshot, "all", { runExternalChecks: false }).gates.every(
        ({ passed }) => passed,
      ),
    ).toBe(true);
  });

  test("applies source, document, version, and route checks to native legal-policy", () => {
    const missing = clone();
    const missingRecord = addNativeLegalRecord(missing, "synthetic_missing_source");
    missingRecord.value.evidence[0]!.source_id = "synthetic.missing";
    Object.assign(missingRecord.value, {
      source_metadata: {
        title: "Convincing but non-authoritative embedded metadata",
        source_url: "https://example.test/embedded",
      },
    });
    expect(codes(verifyProvenance(missing))).toContain("PROVENANCE_SOURCE_NOT_FOUND");

    const notRouted = clone();
    const notRoutedRecord = addNativeLegalRecord(notRouted, "synthetic_not_routed");
    notRouted.sourceRoutes = notRouted.sourceRoutes.filter(
      (route) => route.corpus_id !== notRoutedRecord.corpus_id,
    );
    expect(codes(verifyProvenance(notRouted))).toContain("PROVENANCE_SOURCE_NOT_ROUTED");

    const wrongSource = clone();
    const wrongSourceRecord = addNativeLegalRecord(wrongSource, "synthetic_wrong_source");
    const alternate = wrongSource.objects.find(
      (object) =>
        object.kind === "source_document" &&
        object.id !== wrongSourceRecord.value.evidence[0]!.source_id,
    )!;
    wrongSourceRecord.value.evidence[0]!.source_id = alternate.id;
    wrongSource.sourceRoutes.push({ corpus_id: wrongSourceRecord.corpus_id, file: alternate.file });
    expect(codes(verifyProvenance(wrongSource))).toContain("PROVENANCE_SOURCE_MISMATCH");

    const wrongHash = clone();
    const wrongHashRecord = addNativeLegalRecord(wrongHash, "synthetic_wrong_hash");
    const source = wrongHash.objects.find(
      (object) => object.id === wrongHashRecord.value.evidence[0]!.source_id,
    )!;
    source.value.document_hash = `sha256:${"0".repeat(64)}`;
    expect(codes(verifyProvenance(wrongHash))).toContain("PROVENANCE_SOURCE_MISMATCH");

    const wrongVersion = clone();
    addNativeLegalRecord(
      wrongVersion,
      "synthetic_wrong_version",
    ).value.evidence[0]!.document_version_id = "synthetic.other.version";
    expect(codes(verifyProvenance(wrongVersion))).toContain("PROVENANCE_SOURCE_VERSION_MISMATCH");

    const absentVersion = clone();
    const absentVersionRecord = addNativeLegalRecord(absentVersion, "synthetic_absent_version");
    const absentVersionSource = absentVersion.objects.find(
      (object) => object.id === absentVersionRecord.value.evidence[0]!.source_id,
    )!;
    delete absentVersionSource.value.document_version_id;
    expect(codes(verifyProvenance(absentVersion))).toContain("PROVENANCE_SOURCE_VERSION_MISMATCH");

    const absentDeclaredVersionRoot = miniNativeLegalWorkspace();
    const sourceFile = join(
      absentDeclaredVersionRoot,
      "corpora/test/native-legal-policy/sources.writ",
    );
    writeFileSync(
      sourceFile,
      readFileSync(sourceFile, "utf8").replace(
        /\nconcept SyntheticPolicyDocumentVersionIdentity \{[\s\S]*?\n\}\n/,
        "\n",
      ),
    );
    const absentDeclaredVersion = loadRepository(absentDeclaredVersionRoot).snapshot;
    expect(codes({ issues: absentDeclaredVersion.loadIssues })).toContain(
      "INTEGRITY_CONTRACT_INVALID",
    );
    expect(codes(verifyProvenance(absentDeclaredVersion))).toContain("PROVENANCE_SOURCE_NOT_FOUND");
  });

  test("allows physical source reuse through routes and rejects duplicate declarations", () => {
    const shared = clone();
    const sharedRecord = addNativeLegalRecord(shared, "synthetic_shared_source");
    expect(codes(verifyProvenance(shared))).not.toContain("PROVENANCE_SOURCE_NOT_ROUTED");
    const sharedResolution = resolveRoutedSource(
      shared,
      sharedRecord.corpus_id,
      sharedRecord.value.evidence[0]!.source_id,
    );
    expect(sharedResolution.status).toBe("resolved");
    if (sharedResolution.status === "resolved") {
      expect(sharedResolution.source.corpus_id).not.toBe(sharedRecord.corpus_id);
      expect(
        shared.sourceRoutes.filter(({ file }) => file === sharedResolution.source.file).length,
      ).toBeGreaterThanOrEqual(2);
    }

    for (const differentMetadata of [false, true]) {
      const duplicate = clone();
      const record = addNativeLegalRecord(duplicate, `synthetic_duplicate_${differentMetadata}`);
      const source = duplicate.objects.find(
        (object) => object.id === record.value.evidence[0]!.source_id,
      )!;
      duplicate.objects.push({
        ...structuredClone(source),
        file: `synthetic/duplicate-${differentMetadata}.writ`,
        value: {
          ...structuredClone(source.value),
          ...(differentMetadata ? { document_hash: `sha256:${"f".repeat(64)}` } : {}),
        },
      });
      duplicate.sourceRoutes.push({
        corpus_id: record.corpus_id,
        file: `synthetic/duplicate-${differentMetadata}.writ`,
      });
      expect(codes(verifyProvenance(duplicate))).toContain("PROVENANCE_REFERENCE_AMBIGUOUS");
    }

    const aliasCollision = clone();
    const aliasRecord = addNativeLegalRecord(aliasCollision, "synthetic_alias_collision");
    const aliasSource = aliasCollision.objects.find(
      (object) => object.id === aliasRecord.value.evidence[0]!.source_id,
    )!;
    aliasCollision.objects.push({
      ...structuredClone(aliasSource),
      id: "synthetic.other.canonical.source",
      aliases: [aliasSource.id],
      file: "synthetic/alias-collision.writ",
    });
    aliasCollision.sourceRoutes.push({
      corpus_id: aliasRecord.corpus_id,
      file: "synthetic/alias-collision.writ",
    });
    expect(codes(verifyProvenance(aliasCollision))).toContain("PROVENANCE_REFERENCE_AMBIGUOUS");
  });

  test("keeps current compatibility source mappings governed and fail-closed", () => {
    expect(codes(verifyProvenance(clone()))).not.toContain("PROVENANCE_SOURCE_NOT_FOUND");

    const unauthorizedVersion = clone();
    const unauthorizedMapping = unauthorizedVersion.objects.find(
      (object) => object.kind === "compatibility_source_identity",
    )!;
    const mappedRecord = unauthorizedVersion.records.find(({ value }) =>
      value.evidence.some(({ source_id }) => source_id === unauthorizedMapping.id),
    )!;
    const target = unauthorizedVersion.objects.find(
      (object) => object.id === unauthorizedMapping.value.compatibility_source_id,
    )!;
    mappedRecord.value.evidence.find(
      ({ source_id }) => source_id === unauthorizedMapping.id,
    )!.document_version_id = target.aliases[0] ?? target.id;
    expect(codes(verifyProvenance(unauthorizedVersion))).toContain(
      "PROVENANCE_SOURCE_VERSION_MISMATCH",
    );

    const broken = clone();
    const mapping = broken.objects.find(
      (object) => object.kind === "compatibility_source_identity",
    )!;
    mapping.value.compatibility_source_id = "synthetic.missing.compatibility.target";
    expect(codes(verifyProvenance(broken))).toContain("PROVENANCE_SOURCE_NOT_FOUND");
  });
});

describe("exact UTF-8 evidence passage hashing", () => {
  const vectors = [
    ["space space", "sha256:40efc2c669a6e18c40c890f99719fc9f3efab119703658ca34b52164b68a5eda"],
    ["space\u00a0space", "sha256:b21f516d46c09df3bf5f1eace4ac2ddbc72cee5c9b02c79972f960113c9b3461"],
    ["Café", NFC_HASH],
    ["Café", NFD_HASH],
    ["“quoted”", "sha256:675587678ab187204408a9804299a93a49763fc568c472e5663e86cb1d62521c"],
    ['"quoted"', "sha256:272fca25899893eeb27b89583d5c81b8a4ac5af4d1e37e3909d879947303c1c5"],
  ] as const;

  test("accepts independently pinned UTF-8 hashes without normalization", () => {
    for (const [index, [quote, hash]] of vectors.entries()) {
      const snapshot = clone();
      const record = addNativeLegalRecord(snapshot, `synthetic_utf8_${index}`);
      Object.assign(record.value.evidence[0]!, {
        passage_id: `synthetic.utf8.${index}`,
        quote,
        passage_hash: hash,
      });
      expect(
        verifyProvenance(snapshot).issues.some(
          ({ code, object_id }) =>
            code === "PROVENANCE_PASSAGE_HASH_MISMATCH" && object_id === record.value.record_id,
        ),
      ).toBe(false);
    }
  });

  test("rejects one-character, trailing-space, and deliberately wrong hashes", () => {
    for (const [index, quote] of [
      "A policy states one bounded requirement!",
      "A policy states one bounded requirement. ",
      ASCII_QUOTE,
    ].entries()) {
      const snapshot = clone();
      const record = addNativeLegalRecord(snapshot, `synthetic_bad_bytes_${index}`);
      Object.assign(record.value.evidence[0]!, {
        passage_id: `synthetic.bad.bytes.${index}`,
        quote,
        passage_hash: index === 2 ? `sha256:${"0".repeat(64)}` : ASCII_HASH,
      });
      expect(
        verifyProvenance(snapshot).issues.some(
          ({ code, object_id }) =>
            code === "PROVENANCE_PASSAGE_HASH_MISMATCH" && object_id === record.value.record_id,
        ),
      ).toBe(true);
    }
  });
});

describe("logical unqualified passage identity", () => {
  function repeatedPair(
    mutate?: (record: LoadedRecord) => void,
    secondCorpus = "synthetic.second.family",
    secondFamily: "legal_policy" | "institutional" = "legal_policy",
  ): RepositorySnapshot {
    const snapshot = clone();
    const first = addNativeLegalRecord(snapshot, "synthetic_passage_first");
    const second = addNativeLegalRecord(snapshot, "synthetic_passage_second", secondCorpus);
    const evidence = structuredClone(first.value.evidence[0]!);
    evidence.passage_id = "synthetic.shared.passage";
    first.value.evidence = [structuredClone(evidence)];
    second.value.evidence = [structuredClone(evidence)];
    if (secondFamily === "institutional") {
      second.value.family = "institutional";
      second.manifest_family = "institutional";
      second.catalog_family = "institutional";
      second.governing_contract = {
        kind: "native",
        id: "https://writ.example/schemas/extensions/institutional-record.schema.json",
        version: "0.2.0",
        adapter_kind: "current_native_core",
        expected_family: "institutional",
        verifies_core_provenance: true,
      };
    }
    mutate?.(second);
    return snapshot;
  }

  test("coalesces identical signatures within and across corpora independent of basis", () => {
    for (const snapshot of [
      repeatedPair(undefined, "synthetic.native.legal"),
      repeatedPair(undefined, "synthetic.institutional", "institutional"),
      repeatedPair((record) => {
        record.value.evidence[0]!.basis = "inferred";
      }),
    ]) {
      const resolution = resolveLogicalPassage(snapshot, "synthetic.shared.passage");
      expect(resolution.status).toBe("resolved");
      expect(resolution.occurrences).toHaveLength(2);
      expect(logicalPassageConflicts(snapshot)).toEqual([]);
    }
  });

  test("rejects every field-level signature conflict and permits distinct passage IDs", () => {
    const mutations: Array<(record: LoadedRecord) => void> = [
      (record) => {
        record.value.evidence[0]!.source_id = "synthetic.other.source";
      },
      (record) => {
        record.value.evidence[0]!.document_version_id = "synthetic.other.version";
      },
      (record) => {
        record.value.evidence[0]!.locator = "Other locator";
      },
      (record) => {
        record.value.evidence[0]!.quote = "Other quote";
      },
      (record) => {
        record.value.evidence[0]!.passage_hash = `sha256:${"0".repeat(64)}`;
      },
      (record) => {
        record.value.evidence[0]!.document_hash = `sha256:${"f".repeat(64)}`;
      },
    ];
    for (const mutate of mutations) {
      expect(resolveLogicalPassage(repeatedPair(mutate), "synthetic.shared.passage").status).toBe(
        "conflict",
      );
    }

    const distinct = repeatedPair((record) => {
      record.value.evidence[0]!.passage_id = "synthetic.distinct.passage";
    });
    expect(resolveLogicalPassage(distinct, "synthetic.shared.passage").status).toBe("resolved");
    expect(resolveLogicalPassage(distinct, "synthetic.distinct.passage").status).toBe("resolved");

    const unicodeConflict = repeatedPair((record) => {
      Object.assign(record.value.evidence[0]!, {
        quote: "Café",
        passage_hash: NFD_HASH,
      });
    });
    Object.assign(
      unicodeConflict.records.find(({ value }) => value.record_id === "synthetic_passage_first")!
        .value.evidence[0]!,
      { quote: "Café", passage_hash: NFC_HASH },
    );
    expect(resolveLogicalPassage(unicodeConflict, "synthetic.shared.passage").status).toBe(
      "conflict",
    );
  });

  test("uses the same logical resolution for Core links and judgments", () => {
    const identical = repeatedPair();
    const link = identical.links.find(({ value }) => value.review_state === "approved")!;
    link.value.evidence_refs = ["synthetic.shared.passage"];
    const judgment = identical.judgments.find(({ value }) => value.status === "accepted")!;
    judgment.value.evidence_refs = ["synthetic.shared.passage"];
    expect(codes(verifyInteroperability(identical))).not.toContain("INTEROP_REFERENCE_AMBIGUOUS");
    expect(codes(verifyProvenance(identical))).not.toContain("PROVENANCE_REFERENCE_AMBIGUOUS");

    const conflict = repeatedPair((record) => {
      record.value.evidence[0]!.locator = "Conflicting locator";
    });
    conflict.links.find(({ value }) => value.review_state === "approved")!.value.evidence_refs = [
      "synthetic.shared.passage",
    ];
    conflict.judgments.find(({ value }) => value.status === "accepted")!.value.evidence_refs = [
      "synthetic.shared.passage",
    ];
    expect(codes(verifyInteroperability(conflict))).toContain("INTEROP_REFERENCE_AMBIGUOUS");
    expect(codes(verifyProvenance(conflict))).toContain("PROVENANCE_REFERENCE_AMBIGUOUS");
  });

  test("keeps passage conflict output deterministic under occurrence order reversal", () => {
    const snapshot = repeatedPair((record) => {
      record.value.evidence[0]!.locator = "Conflicting locator";
    });
    const forward = verifyProvenance(snapshot).issues.filter(
      ({ code }) => code === "PROVENANCE_PASSAGE_CONFLICT",
    );
    snapshot.records.reverse();
    snapshot.catalogEntries.reverse();
    snapshot.sourceRoutes.reverse();
    const reversed = verifyProvenance(snapshot).issues.filter(
      ({ code }) => code === "PROVENANCE_PASSAGE_CONFLICT",
    );
    expect(reversed).toEqual(forward);
  });
});

describe("family, manifest, contract, and record coherence", () => {
  test("rejects manifest family laundering through exact native contracts", () => {
    const legalManifestWithInstitutionalContract = miniNativeLegalWorkspace();
    const firstManifestFile = join(
      legalManifestWithInstitutionalContract,
      "corpora/test/native-legal-policy/corpus.yaml",
    );
    const firstManifest = Bun.YAML.parse(readFileSync(firstManifestFile, "utf8")) as Record<
      string,
      unknown
    >;
    firstManifest.record_contract = {
      kind: "native",
      id: "https://writ.example/schemas/extensions/institutional-record.schema.json",
      version: "0.2.0",
    };
    writeFileSync(firstManifestFile, Bun.YAML.stringify(firstManifest));
    const firstCodes = codes(
      verifyOntology(loadRepository(legalManifestWithInstitutionalContract).snapshot),
    );
    expect(firstCodes).toContain("ONTOLOGY_CONTRACT_FAMILY_MISMATCH");
    expect(firstCodes).toContain("ONTOLOGY_RECORD_FAMILY_MISMATCH");

    const institutionalManifestWithLegalContract = miniNativeLegalWorkspace();
    const secondCatalogFile = join(institutionalManifestWithLegalContract, "corpora/catalog.yaml");
    const secondCatalog = Bun.YAML.parse(readFileSync(secondCatalogFile, "utf8")) as {
      native_corpora: Array<Record<string, unknown>>;
    };
    secondCatalog.native_corpora[0]!.family = "institutional";
    writeFileSync(secondCatalogFile, Bun.YAML.stringify(secondCatalog));
    const secondManifestFile = join(
      institutionalManifestWithLegalContract,
      "corpora/test/native-legal-policy/corpus.yaml",
    );
    const secondManifest = Bun.YAML.parse(readFileSync(secondManifestFile, "utf8")) as Record<
      string,
      unknown
    >;
    secondManifest.family = "institutional";
    delete secondManifest.instrument_id;
    secondManifest.root_institution_id = "synthetic_institution";
    writeFileSync(secondManifestFile, Bun.YAML.stringify(secondManifest));
    const secondCodes = codes(
      verifyOntology(loadRepository(institutionalManifestWithLegalContract).snapshot),
    );
    expect(secondCodes).toContain("ONTOLOGY_CONTRACT_FAMILY_MISMATCH");
    expect(secondCodes).toContain("ONTOLOGY_RECORD_FAMILY_MISMATCH");

    const wrongCompiledFamily = miniNativeLegalWorkspace();
    writeFileSync(
      join(wrongCompiledFamily, "corpora/test/native-legal-policy/records.writ"),
      readFileSync(join(ROOT, "corpora/institutional/us/nist/records.writ"), "utf8"),
    );
    expect(codes(verifyOntology(loadRepository(wrongCompiledFamily).snapshot))).toContain(
      "ONTOLOGY_RECORD_FAMILY_MISMATCH",
    );
  });

  test("keeps catalog-to-manifest family drift distinct", () => {
    const root = miniNativeLegalWorkspace();
    const catalogFile = join(root, "corpora/catalog.yaml");
    const catalog = Bun.YAML.parse(readFileSync(catalogFile, "utf8")) as {
      native_corpora: Array<Record<string, unknown>>;
    };
    catalog.native_corpora[0]!.family = "institutional";
    writeFileSync(catalogFile, Bun.YAML.stringify(catalog));
    expect(codes(verifyOntology(loadRepository(root).snapshot))).toContain(
      "ONTOLOGY_FAMILY_MISMATCH",
    );
  });

  test("keeps positive current native institutional coherence", () => {
    expect(
      baseline.records
        .filter(({ value }) => value.family === "institutional")
        .every(
          ({ governing_contract, manifest_family, catalog_family }) =>
            governing_contract.adapter_kind === "current_native_core" &&
            governing_contract.expected_family === "institutional" &&
            manifest_family === "institutional" &&
            catalog_family === "institutional",
        ),
    ).toBe(true);
  });

  test("finds no contract-family drift in the current repository", () => {
    expect(codes(verifyOntology(baseline))).not.toContain("ONTOLOGY_CONTRACT_FAMILY_MISMATCH");
    expect(codes(verifyOntology(baseline))).not.toContain("ONTOLOGY_RECORD_FAMILY_MISMATCH");
  });

  test("retains frozen and reviewed compatibility adapter identities", () => {
    const frozen = baseline.records.find(
      ({ governing_contract }) =>
        governing_contract.adapter_kind === "frozen_compiled_compatibility",
    )!;
    expect(frozen.governing_contract).toMatchObject({
      kind: "compatibility",
      version: "0.1.0",
      expected_family: "legal_policy",
      verifies_core_provenance: false,
    });
    expect(
      baseline.documents.some(
        ({ governing_contract }) =>
          governing_contract.adapter_kind === "reviewed_compatibility_document" &&
          governing_contract.kind === "compatibility" &&
          governing_contract.version === "1.0.0" &&
          governing_contract.expected_family === "legal_policy" &&
          !governing_contract.verifies_core_provenance,
      ),
    ).toBe(true);
  });
});
