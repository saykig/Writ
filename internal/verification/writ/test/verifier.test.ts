import { describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CURRENT_WORKFLOW_REGISTRATIONS,
  ExactContractAdapterRegistry,
  INSTITUTIONAL_RECORD_SCHEMA,
  INVARIANTS,
  LEGACY_LEGAL_POLICY_RECORD_SCHEMA,
  LEGAL_POLICY_RECORD_SCHEMA,
  checkManifestChecksum,
  classifyRecordContract,
  findObjects,
  gateResult,
  loadAuthorityIndex,
  loadRepository,
  normalizeCommandOutput,
  parseInstitutionalMigrationDocument,
  renderVerificationJson,
  renderVerificationText,
  repositoryRoot,
  resolveWorkspacePath,
  runVerification,
  verificationWorkspace,
  verifyIntegrity,
  verifyInteroperability,
  verifyOntology,
  verifyProvenance,
  verifySnapshot,
  verifyWorkspace,
  type RepositorySnapshot,
} from "../src/index.js";

const ROOT = repositoryRoot(import.meta.dir);
const loaded = loadRepository(ROOT);
const baseline = loaded.snapshot;

const clone = (): RepositorySnapshot => structuredClone(baseline);
const codes = (result: { issues: Array<{ code: string }> }): string[] =>
  result.issues.map(({ code }) => code);

function candidateWorkspace(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  cpSync(join(ROOT, "schemas"), join(root, "schemas"), { recursive: true });
  cpSync(join(ROOT, "corpora"), join(root, "corpora"), { recursive: true });
  return root;
}

function routeFirstManifest(root: string, fileName: string, value: string): void {
  const catalog = structuredClone(baseline.catalog);
  catalog.native_corpora[0]!.manifest = `corpora/${fileName}`;
  writeFileSync(join(root, "corpora", "catalog.yaml"), Bun.YAML.stringify(catalog, null, 2));
  writeFileSync(join(root, "corpora", fileName), value);
}

describe("authority and adapter boundaries", () => {
  test("loads normative schema identities only from schemas", () => {
    const authority = loadAuthorityIndex(ROOT);
    expect(authority.issues).toEqual([]);
    for (const schema of authority.schemas.values()) {
      expect(schema.file.startsWith("schemas/")).toBe(true);
      expect(schema.file).not.toContain("packages/domain");
    }
  });

  test("every fail-closed invariant resolves to a surviving authority", () => {
    expect(INVARIANTS.length).toBeGreaterThan(10);
    for (const invariant of INVARIANTS) {
      expect(invariant.code).toMatch(/^[A-Z0-9_]+$/);
      expect(existsSync(join(ROOT, invariant.authority.source))).toBe(true);
      expect(invariant.authority.source).not.toContain("0019-cross-family");
    }
  });

  test("supports generic legal-policy contracts and the retained reviewed payload contract", () => {
    const authority = loadAuthorityIndex(ROOT);
    expect(classifyRecordContract(authority, INSTITUTIONAL_RECORD_SCHEMA, "0.2.0")).toBe(
      "supported",
    );
    expect(classifyRecordContract(authority, LEGAL_POLICY_RECORD_SCHEMA, "0.2.0")).toBe(
      "supported",
    );
    expect(classifyRecordContract(authority, LEGACY_LEGAL_POLICY_RECORD_SCHEMA, "0.1.0")).toBe(
      "supported",
    );
    expect(
      classifyRecordContract(
        authority,
        "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json",
        "1.0.0",
      ),
    ).toBe("supported");
  });

  test("distinguishes invalid contract identities from unsupported exact versions", () => {
    const authority = loadAuthorityIndex(ROOT);
    expect(classifyRecordContract(authority, INSTITUTIONAL_RECORD_SCHEMA, "9.0.0")).toBe(
      "unsupported",
    );
    expect(
      classifyRecordContract(
        authority,
        "https://writ.example/schemas/missing.schema.json",
        "1.0.0",
      ),
    ).toBe("invalid");
  });

  test("fails closed when authoritative schema identities conflict", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-authority-conflict-"));
    mkdirSync(join(root, "schemas"));
    const schema = JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://writ.example/schemas/test.schema.json",
      type: "object",
    });
    writeFileSync(join(root, "schemas", "a.schema.json"), schema);
    writeFileSync(join(root, "schemas", "b.schema.json"), schema);
    expect(codes({ issues: loadAuthorityIndex(root).issues })).toContain(
      "VERIFIER_AUTHORITY_CONFLICT",
    );
  });

  test("has no active workflow registration for retired ADR-0019 artifacts", () => {
    expect(CURRENT_WORKFLOW_REGISTRATIONS).toEqual([]);
    expect(baseline.workflowStates).toEqual({});
  });

  test("fails closed on malformed and unsupported exact migration adapter versions", () => {
    const malformed = parseInstitutionalMigrationDocument(
      { schema_version: "1.0.0", approved_id_renames: "not-an-array" },
      "synthetic/migration.yaml",
      "synthetic.corpus",
    );
    expect(codes({ issues: malformed.issues })).toContain("PROVENANCE_MIGRATION_INVALID");

    const unsupported = parseInstitutionalMigrationDocument(
      { schema_version: "1.0.1" },
      "synthetic/migration.yaml",
      "synthetic.corpus",
    );
    expect(codes({ issues: unsupported.issues })).toEqual(["VERIFIER_UNSUPPORTED_CONTRACT"]);
  });

  test("retains a family-agnostic exact adapter kernel", () => {
    const adapters = new ExactContractAdapterRegistry([
      { contractId: "synthetic", declaredVersion: "1.0.0", adapt: (value) => value },
    ]);
    expect(adapters.resolve("synthetic", "1.0.0")).toBeDefined();
    expect(adapters.resolve("synthetic", "1.0.1")).toBeUndefined();
    const result = runVerification({ value: true }, "ontology", {
      order: ["ontology", "interoperability", "provenance", "integrity"],
      runners: {
        ontology: () => gateResult("ontology", []),
        interoperability: () => gateResult("interoperability", []),
        provenance: () => gateResult("provenance", []),
        integrity: () => gateResult("integrity", []),
      },
      loadIssues: () => [],
    });
    expect(result.passed).toBe(true);
  });
});

describe("retained corpus repository with NIST as the development proving ground", () => {
  test("loads retained catalogued corpora without specialized workflow state", () => {
    const corpusIds = baseline.catalogEntries.map(({ corpus_id }) => corpus_id);
    expect(corpusIds).toHaveLength(16);
    expect(corpusIds).toContain("us.institutions.nist");
    expect(corpusIds).toContain("eu.institutions.european_commission");
    expect(corpusIds).toContain(
      "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689",
    );
    expect(baseline.records).toHaveLength(38);
    expect(baseline.links).toHaveLength(6);
    expect(baseline.judgments).toHaveLength(44);
    expect(baseline.workflowStates).toEqual({});
    expect(baseline.loadIssues).toEqual([]);
  });

  test("passes every verification dimension", () => {
    const result = verifySnapshot(baseline, "all", { runExternalChecks: false });
    expect(result.passed).toBe(true);
    expect(result.gates.every(({ passed }) => passed)).toBe(true);
  });

  test("uses the current checkout and renders deterministic output", () => {
    expect(verificationWorkspace().root).toBe(ROOT);
    const result = verifySnapshot(baseline, "all", { runExternalChecks: false });
    const first = renderVerificationJson(result);
    const second = renderVerificationJson(result);
    expect(first).toBe(second);
    expect(first).not.toContain(ROOT);
    expect(Object.keys(JSON.parse(first))).toEqual(["status", "gates", "issues", "summary"]);
    expect(renderVerificationText(result)).toContain("VERIFICATION RESULT: PASS");
  });

  test("verifies an alternate workspace without mutating it", () => {
    const root = candidateWorkspace("writ-alternate-workspace-");
    const catalogFile = join(root, "corpora", "catalog.yaml");
    const before = readFileSync(catalogFile);
    const contents = readdirSync(root).sort();

    const result = verifyWorkspace(verificationWorkspace(root), "ontology", {
      runExternalChecks: false,
    });
    const cli = Bun.spawnSync(
      [
        process.execPath,
        join(ROOT, "internal/verification/writ/src/cli.ts"),
        "ontology",
        "--root",
        root,
        "--format",
        "json",
      ],
      { cwd: ROOT, stdout: "pipe", stderr: "pipe" },
    );

    expect(result.passed).toBe(true);
    expect(cli.exitCode, cli.stderr.toString()).toBe(0);
    expect(JSON.parse(cli.stdout.toString()).status).toBe("PASS");
    expect(readFileSync(catalogFile)).toEqual(before);
    expect(readdirSync(root).sort()).toEqual(contents);
  });

  test("normalizes workspace-specific paths in deterministic failure output", () => {
    const firstRoot = mkdtempSync(join(tmpdir(), "writ-output-first-"));
    const secondRoot = mkdtempSync(join(tmpdir(), "writ-output-second-"));
    const output = (root: string) =>
      normalizeCommandOutput(root, `Generated file ${join(root, "generated.json")} is stale.`);
    expect(output(firstRoot)).toBe(output(secondRoot));
    expect(output(firstRoot)).toContain("<workspace>/generated.json");
  });

  test("documents verification as an instrument, not acceptance authority", () => {
    const adr = readFileSync(join(ROOT, "adr/0020-deterministic-writ-verification.md"), "utf8");
    expect(adr).toContain(
      "It does not decide whether that representation should become part of Writ",
    );
  });
});

describe("focused negative fixtures", () => {
  test("detects catalog-to-manifest family drift", () => {
    const snapshot = clone();
    const nist = snapshot.catalogEntries.find(
      ({ corpus_id }) => corpus_id === "us.institutions.nist",
    )!;
    nist.family = "legal_policy";
    expect(codes(verifyOntology(snapshot))).toContain("ONTOLOGY_FAMILY_MISMATCH");
  });

  test("detects missing native link endpoints, evidence, and support", () => {
    const snapshot = clone();
    const partOf = snapshot.links.find(({ value }) => value.relation_type === "part_of")!;
    partOf.value.source_id = "missing_institution";
    partOf.value.evidence_refs = ["missing_passage"];
    partOf.value.supporting_record_ids = ["missing_record"];
    const findings = codes(verifyInteroperability(snapshot));
    expect(findings).toContain("INTEROP_SOURCE_NOT_FOUND");
    expect(findings).toContain("INTEROP_EVIDENCE_NOT_FOUND");
    expect(findings).toContain("INTEROP_SUPPORT_NOT_FOUND");
  });

  test("mechanically rejects endpoint kinds that do not match resolved objects", () => {
    const snapshot = clone();
    const link = snapshot.links.find(({ value }) => value.relation_type === "assigns_function_to")!;
    link.value.source_kind = "arbitrary_source_kind";
    link.value.target_kind = "arbitrary_target_kind";
    const findings = codes(verifyInteroperability(snapshot));
    expect(findings.filter((code) => code === "INTEROP_DECLARED_KIND_MISMATCH")).toHaveLength(2);
    expect(findings).not.toContain("INTEROP_SOURCE_NOT_FOUND");
    expect(findings).not.toContain("INTEROP_TARGET_NOT_FOUND");
  });

  test("reports ambiguity only for a referenced endpoint in its declared kind", () => {
    const ambiguous = clone();
    const link = ambiguous.links.find(
      ({ value }) => value.relation_type === "assigns_function_to",
    )!;
    const source = findObjects(ambiguous, link.value.source_id, [link.value.source_kind])[0]!;
    ambiguous.objects.push({ ...source, file: "synthetic/duplicate-source.yaml" });
    expect(codes(verifyInteroperability(ambiguous))).toContain("INTEROP_REFERENCE_AMBIGUOUS");

    const unreferenced = clone();
    unreferenced.objects.push(
      {
        id: "unused_duplicate",
        kind: "record",
        value: {},
        file: "synthetic/unused-a.yaml",
        corpus_id: "synthetic",
        aliases: [],
      },
      {
        id: "unused_duplicate",
        kind: "record",
        value: {},
        file: "synthetic/unused-b.yaml",
        corpus_id: "synthetic",
        aliases: [],
      },
    );
    expect(codes(verifyInteroperability(unreferenced))).not.toContain(
      "INTEROP_REFERENCE_AMBIGUOUS",
    );
  });

  test("detects judgment target, evidence, and supersession drift", () => {
    const snapshot = clone();
    const judgment = snapshot.judgments[0]!.value;
    judgment.target_id = "missing_target";
    judgment.evidence_refs = ["missing_passage"];
    judgment.supersedes_judgment_ids = ["missing_judgment"];
    const findings = codes(verifyProvenance(snapshot));
    expect(findings).toContain("PROVENANCE_JUDGMENT_TARGET_NOT_FOUND");
    expect(findings).toContain("PROVENANCE_EVIDENCE_NOT_FOUND");
    expect(findings).toContain("PROVENANCE_SUPERSESSION_INVALID");
  });

  test("rejects previous record IDs on active surfaces within the migrated corpus", () => {
    const snapshot = clone();
    const migration = snapshot.migrations.find(
      ({ previous_id }) => previous_id === "eu_ai_office_technical_documentation_receipt",
    )!;
    const link = snapshot.links.find(
      ({ value }) => value.owning_corpus_id === migration.corpus_id,
    )!;
    link.value.supporting_record_ids = [migration.previous_id];
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_ACTIVE_LEGACY_ID");
  });

  test("reports ambiguous judgment targets", () => {
    const ambiguous = clone();
    const judgment = ambiguous.judgments.find(
      ({ value }) => value.target_kind === "record" && value.status === "accepted",
    )!;
    const target = ambiguous.records.find(
      ({ value }) => value.record_id === judgment.value.target_id,
    )!;
    ambiguous.records.push({ ...target, file: "synthetic/duplicate-target.writ" });
    expect(codes(verifyProvenance(ambiguous))).toContain("PROVENANCE_REFERENCE_AMBIGUOUS");
  });

  test("detects manifest count drift", () => {
    const snapshot = clone();
    snapshot.manifests[0]!.value.record_counts.institutional_records = 999;
    expect(codes(verifyIntegrity(snapshot, { runExternalChecks: false }))).toContain(
      "INTEGRITY_COUNT_MISMATCH",
    );
  });

  test("detects dangling active links", () => {
    const snapshot = clone();
    snapshot.links[0]!.value.source_id = "missing_source";
    expect(codes(verifyIntegrity(snapshot, { runExternalChecks: false }))).toContain(
      "INTEGRITY_DANGLING_REFERENCE",
    );
  });

  test("detects checksum content and inventory drift", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-checksum-"));
    writeFileSync(join(root, "a.txt"), "actual\n");
    const mismatch = checkManifestChecksum({
      root,
      trackedFiles: ["a.txt", "MANIFEST.sha256"],
      manifestText: `${"0".repeat(64)}  a.txt\n`,
    });
    expect(codes({ issues: mismatch })).toContain("INTEGRITY_CHECKSUM_MISMATCH");

    const hash = new Bun.CryptoHasher("sha256")
      .update(readFileSync(join(root, "a.txt")))
      .digest("hex");
    const inventory = checkManifestChecksum({
      root,
      trackedFiles: ["a.txt", "missing.txt", "MANIFEST.sha256"],
      manifestText: `${hash}  a.txt\n`,
    });
    expect(codes({ issues: inventory })).toContain("INTEGRITY_CHECKSUM_INVENTORY_MISMATCH");
  });
});

describe("candidate repository loading", () => {
  test("reports malformed catalog syntax and malformed catalog entries", () => {
    const syntaxRoot = candidateWorkspace("writ-malformed-catalog-");
    writeFileSync(join(syntaxRoot, "corpora", "catalog.yaml"), "native_corpora: [");
    expect(codes({ issues: loadRepository(syntaxRoot).snapshot.loadIssues })).toContain(
      "INTEGRITY_CATALOG_INVALID",
    );

    const entryRoot = candidateWorkspace("writ-malformed-catalog-entry-");
    const catalog = structuredClone(baseline.catalog) as unknown as { native_corpora: unknown[] };
    catalog.native_corpora.unshift({ corpus_id: "unsafe-incomplete-entry" });
    writeFileSync(join(entryRoot, "corpora", "catalog.yaml"), Bun.YAML.stringify(catalog, null, 2));
    const snapshot = loadRepository(entryRoot).snapshot;
    expect(codes({ issues: snapshot.loadIssues })).toContain("INTEGRITY_CATALOG_INVALID");
    expect(
      snapshot.catalogEntries.some(({ corpus_id }) => corpus_id === "unsafe-incomplete-entry"),
    ).toBe(false);
  });

  test("reports malformed manifest syntax and structure", () => {
    const syntaxRoot = candidateWorkspace("writ-malformed-manifest-syntax-");
    routeFirstManifest(syntaxRoot, "malformed-syntax.yaml", "locations: [");
    expect(codes({ issues: loadRepository(syntaxRoot).snapshot.loadIssues })).toContain(
      "INTEGRITY_MANIFEST_INVALID",
    );

    const structureRoot = candidateWorkspace("writ-malformed-manifest-structure-");
    routeFirstManifest(
      structureRoot,
      "malformed-structure.yaml",
      Bun.YAML.stringify({ schema_version: "1.0.0", corpus_id: "incomplete" }, null, 2),
    );
    expect(codes({ issues: loadRepository(structureRoot).snapshot.loadIssues })).toContain(
      "INTEGRITY_MANIFEST_INVALID",
    );
  });

  test("confines catalog, manifest, and location routes to the workspace", () => {
    const corpusRoot = candidateWorkspace("writ-corpus-traversal-");
    const corpusCatalog = structuredClone(baseline.catalog);
    corpusCatalog.native_corpora[0]!.path = "../../outside-corpus";
    writeFileSync(
      join(corpusRoot, "corpora", "catalog.yaml"),
      Bun.YAML.stringify(corpusCatalog, null, 2),
    );
    expect(codes({ issues: loadRepository(corpusRoot).snapshot.loadIssues })).toContain(
      "INTEGRITY_ROUTED_FILE_MISSING",
    );

    const manifestRoot = candidateWorkspace("writ-manifest-traversal-");
    const manifestCatalog = structuredClone(baseline.catalog);
    manifestCatalog.native_corpora[0]!.manifest = join(tmpdir(), "outside-writ-manifest.yaml");
    writeFileSync(
      join(manifestRoot, "corpora", "catalog.yaml"),
      Bun.YAML.stringify(manifestCatalog, null, 2),
    );
    expect(codes({ issues: loadRepository(manifestRoot).snapshot.loadIssues })).toContain(
      "INTEGRITY_ROUTED_FILE_MISSING",
    );

    const locationRoot = candidateWorkspace("writ-location-traversal-");
    const first = baseline.catalog.native_corpora[0]!;
    const manifest = Bun.YAML.parse(readFileSync(join(ROOT, first.manifest), "utf8")) as {
      locations: { records: string[] };
    };
    manifest.locations.records = ["../../../../../../outside-record.writ"];
    routeFirstManifest(locationRoot, "traversal-location.yaml", Bun.YAML.stringify(manifest));
    expect(codes({ issues: loadRepository(locationRoot).snapshot.loadIssues })).toContain(
      "INTEGRITY_ROUTED_FILE_MISSING",
    );
  });

  test("rejects a metadata route whose symlink resolves outside the workspace", () => {
    const root = candidateWorkspace("writ-symlink-traversal-");
    const outside = mkdtempSync(join(tmpdir(), "writ-outside-workspace-"));
    const outsideManifest = join(outside, "outside-manifest.yaml");
    writeFileSync(outsideManifest, "this malformed content must not be read: [");
    symlinkSync(outsideManifest, join(root, "corpora", "escaped-manifest.yaml"));
    const catalog = structuredClone(baseline.catalog);
    catalog.native_corpora[0]!.manifest = "corpora/escaped-manifest.yaml";
    writeFileSync(join(root, "corpora", "catalog.yaml"), Bun.YAML.stringify(catalog, null, 2));

    const findings = codes({ issues: loadRepository(root).snapshot.loadIssues });
    expect(findings).toContain("INTEGRITY_ROUTED_FILE_MISSING");
    expect(findings).not.toContain("INTEGRITY_MANIFEST_INVALID");
  });

  test("allows normalized routes that remain inside the workspace", () => {
    const root = candidateWorkspace("writ-contained-route-");
    const route = resolveWorkspacePath(root, "corpora/institutional/nist", "../../catalog.yaml");
    expect(route.ok).toBe(true);
    if (route.ok) expect(route.relative).toBe("corpora/catalog.yaml");
  });
});
