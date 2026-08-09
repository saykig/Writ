import { describe, expect, test } from "bun:test";
import {
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
import type { AtomicInstitutionalRecord, CurrentRecordJudgment, RecordLink } from "@writ/domain";

import {
  INVARIANTS,
  ExactContractAdapterRegistry,
  checkManifestChecksum,
  classifyRecordContract,
  findObjects,
  gateResult,
  loadAuthorityIndex,
  loadRepository,
  parseCrossFamilyHumanReviewDocument,
  parseInstitutionalMigrationDocument,
  parseMappingQueueFile,
  repositoryRoot,
  renderVerificationJson,
  renderVerificationText,
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
const baseline = loadRepository(ROOT).snapshot;

function clone(): RepositorySnapshot {
  return structuredClone(baseline);
}

function codes(result: { issues: Array<{ code: string }> }): string[] {
  return result.issues.map((item) => item.code);
}

function crossFamilyLink(snapshot: RepositorySnapshot) {
  return snapshot.links.find(({ value }) => value.relation_type === "assigns_function_to")!;
}

function declaredSchemaVersions(value: unknown, key = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => declaredSchemaVersions(item, key));
  if (value === null || typeof value !== "object") return [];
  const result: string[] = [];
  for (const [childKey, child] of Object.entries(value)) {
    if ((key === "properties" && childKey === "schema_version") || childKey === "schemaVersion") {
      if (
        child !== null &&
        typeof child === "object" &&
        "const" in child &&
        typeof child.const === "string"
      )
        result.push(child.const);
    }
    result.push(...declaredSchemaVersions(child, childKey));
  }
  return result;
}

function crossFamilyResolution(snapshot: RepositorySnapshot) {
  return snapshot.links
    .filter(({ value }) => value.relation_type === "assigns_function_to")
    .map(({ value }) => ({
      link_id: value.link_id,
      source: findObjects(snapshot, value.source_id).map(({ id, kind, corpus_id }) => ({
        id,
        kind,
        corpus_id,
      })),
      evidence: value.evidence_refs.flatMap((id) =>
        findObjects(snapshot, id, ["passage"]).map(({ kind, corpus_id }) => ({
          id,
          kind,
          corpus_id,
        })),
      ),
    }))
    .sort((left, right) => left.link_id.localeCompare(right.link_id));
}

describe("authority isolation", () => {
  test("discovers normative schema identities only from schemas/", () => {
    const authority = loadAuthorityIndex(ROOT);
    expect(authority.issues).toEqual([]);
    expect(authority.schemas.size).toBeGreaterThan(20);
    for (const schema of authority.schemas.values()) {
      expect(schema.file.startsWith("schemas/")).toBe(true);
      expect(schema.file).not.toContain("packages/domain");
    }
  });

  test("every fail-closed invariant resolves to its declared authority without owning vocabulary", () => {
    const authority = loadAuthorityIndex(ROOT);
    expect(INVARIANTS.length).toBeGreaterThan(20);
    for (const invariant of INVARIANTS) {
      expect(invariant.code).toMatch(/^[A-Z0-9_]+$/);
      const source = join(ROOT, invariant.authority.source);
      expect(existsSync(source), `${invariant.code}: ${invariant.authority.source}`).toBe(true);
      expect(invariant.authority.section.length).toBeGreaterThan(0);
      expect(invariant).not.toHaveProperty("allowed_values");
      expect(invariant).not.toHaveProperty("vocabulary");
      if (invariant.authority.kind === "schema") {
        const schema = [...authority.schemas.values()].find(
          (candidate) => candidate.file === invariant.authority.source,
        );
        expect(schema, invariant.code).toBeDefined();
        expect(schema?.id).toBe(`https://writ.example/${invariant.authority.source}`);
        expect(invariant.authority.version).toBeDefined();
        expect(declaredSchemaVersions(schema?.document)).toContain(invariant.authority.version!);
      } else if (invariant.authority.kind === "adr") {
        expect(invariant.authority.source).toBe("adr/0019-cross-family-interoperability.md");
        expect(readFileSync(source, "utf8")).toContain("**Status:** Accepted");
      } else if (invariant.authority.kind === "meta") {
        expect(invariant.authority.source).toBe("adr/0020-deterministic-writ-verification.md");
        expect(readFileSync(source, "utf8")).toContain("**Status:** Accepted");
      } else if (invariant.authority.kind === "core_contract") {
        expect(invariant.authority.source).toBe("packages/domain/src/judgments.ts");
        expect(invariant.authority.version).toBe("0.2.0");
      }
    }
    expect(
      INVARIANTS.some(({ authority }) => authority.source.includes("internal-repository-support")),
    ).toBe(false);
    expect(INVARIANTS.some(({ code }) => code === "ONTOLOGY_PLACEMENT_SUPPORT_INCOMPATIBLE")).toBe(
      false,
    );
    expect(INVARIANTS.some(({ code }) => code === "INTEROP_SUPPORT_ENDPOINT_MISMATCH")).toBe(false);
    expect(
      INVARIANTS.filter(
        ({ authority }) => authority.source === "adr/0019-cross-family-interoperability.md",
      )
        .map(({ code }) => code)
        .sort(),
    ).toEqual(
      [
        "INTEROP_ENDPOINT_KIND_MISMATCH",
        "INTEROP_INHERITED_SUPPORT_MISSING",
        "INTEROP_INVERSE_DUPLICATE",
        "INTEROP_OWNER_MISMATCH",
        "INTEROP_UNRESOLVED_ACTIVE",
        "ONTOLOGY_IDENTITY_AMBIGUOUS",
        "ONTOLOGY_IDENTITY_NOT_FOUND",
        "ONTOLOGY_INVALID_SOURCE_KIND",
        "ONTOLOGY_INVALID_TARGET_KIND",
        "PROVENANCE_AUTOMATION_ATTRIBUTION",
        "PROVENANCE_DISPOSITION_AMBIGUOUS",
        "PROVENANCE_DISPOSITION_MISSING",
        "PROVENANCE_DRAFT_HUMAN_MISMATCH",
      ].sort(),
    );
  });

  test("distinguishes invalid identities from unsupported exact versions", () => {
    const authority = loadAuthorityIndex(ROOT);
    const id = "https://writ.example/schemas/extensions/institutional-record.schema.json";
    expect(classifyRecordContract(authority, id, "0.2.0")).toBe("supported");
    expect(classifyRecordContract(authority, id, "9.0.0")).toBe("unsupported");
    expect(
      classifyRecordContract(
        authority,
        "https://writ.example/schemas/missing.schema.json",
        "1.0.0",
      ),
    ).toBe("invalid");
  });

  test("fails closed when authoritative schema IDs conflict", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-authority-"));
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
});

describe("workflow adapter versions", () => {
  test("distinguishes malformed supported queues from unsupported future versions", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-queue-"));
    const malformed = join(root, "mapping-queue.yaml");
    writeFileSync(malformed, "schema_version: 1.0.0\nqueue_id: incomplete\n");
    expect(codes({ issues: parseMappingQueueFile(malformed, root).issues })).toContain(
      "INTEROP_QUEUE_INVALID",
    );

    const future = join(root, "future-mapping-queue.yaml");
    writeFileSync(future, "schema_version: 2.0.0\nqueue_id: future\n");
    expect(codes({ issues: parseMappingQueueFile(future, root).issues })).toContain(
      "VERIFIER_UNSUPPORTED_CONTRACT",
    );
    expect(codes({ issues: parseMappingQueueFile(future, root).issues })).not.toContain(
      "INTEROP_QUEUE_INVALID",
    );
  });

  test("rejects unknown v1 queue statuses without substring classification", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-queue-status-"));
    const queue = {
      schema_version: "1.0.0",
      queue_id: "synthetic-queue",
      status: "human_review_complete",
      human_review_artifact: "docs/migrations/synthetic/human-review.yaml",
      active_link_ids: [],
      mappings: [
        {
          mapping_id: "synthetic-mapping",
          legal_policy_record_id: "synthetic-record",
          proposed_relation: "assigns_function_to",
          target_institutional_id: "synthetic-institution",
          mapping_status: "inactive",
        },
      ],
    };
    const file = join(root, "mapping-queue.yaml");
    writeFileSync(file, Bun.YAML.stringify(queue, null, 2));
    expect(codes({ issues: parseMappingQueueFile(file, root).issues })).toContain(
      "INTEROP_QUEUE_INVALID",
    );
    queue.mappings[0]!.mapping_status = "reactivated";
    writeFileSync(file, Bun.YAML.stringify(queue, null, 2));
    expect(codes({ issues: parseMappingQueueFile(file, root).issues })).toContain(
      "INTEROP_QUEUE_INVALID",
    );
    const wrongType = structuredClone(queue) as unknown as {
      mappings: Array<{ mapping_status: unknown }>;
    };
    wrongType.mappings[0]!.mapping_status = ["active_approved"];
    writeFileSync(file, Bun.YAML.stringify(wrongType, null, 2));
    expect(codes({ issues: parseMappingQueueFile(file, root).issues })).toContain(
      "INTEROP_QUEUE_INVALID",
    );
  });

  test("fails closed on malformed and unsupported cross-family review adapters", () => {
    const malformed = parseCrossFamilyHumanReviewDocument(
      { schema_version: "1.0.0", review_id: "incomplete" },
      "human-review.yaml",
    );
    expect(codes({ issues: malformed.issues })).toContain("PROVENANCE_HUMAN_REVIEW_INVALID");

    const future = parseCrossFamilyHumanReviewDocument(
      { schema_version: "2.0.0" },
      "human-review.yaml",
    );
    expect(codes({ issues: future.issues })).toContain("VERIFIER_UNSUPPORTED_CONTRACT");
    expect(codes({ issues: future.issues })).not.toContain("PROVENANCE_HUMAN_REVIEW_INVALID");
  });

  test("fails closed on malformed supported institutional migrations", () => {
    const malformed = parseInstitutionalMigrationDocument(
      {
        schema_version: "1.0.0",
        approved_id_renames: [{ previous_draft_id: "old" }],
      },
      "migration.yaml",
      "test.institution",
    );
    expect(codes({ issues: malformed.issues })).toContain("PROVENANCE_MIGRATION_INVALID");
    expect(malformed.renames).toEqual([]);

    const supported = parseInstitutionalMigrationDocument(
      {
        schema_version: "1.0.0",
        stage_b_review: {
          approved_id_renames: [{ previous_draft_id: "old", approved_id: "active" }],
        },
      },
      "migration.yaml",
      "test.institution",
    );
    expect(supported.issues).toEqual([]);
    expect(
      supported.renames.map(({ previous_id, active_id }) => ({ previous_id, active_id })),
    ).toEqual([{ previous_id: "old", active_id: "active" }]);

    const future = parseInstitutionalMigrationDocument(
      { schema_version: "2.0.0" },
      "migration.yaml",
      "test.institution",
    );
    expect(codes({ issues: future.issues })).toContain("VERIFIER_UNSUPPORTED_CONTRACT");
    expect(codes({ issues: future.issues })).not.toContain("PROVENANCE_MIGRATION_INVALID");
  });
});

describe("family-agnostic harness kernel", () => {
  test("runs an in-memory synthetic adapter family without changing kernel code", () => {
    // This synthetic family demonstrates adapter extensibility only. It is not a Writ authority.
    const adapters = new ExactContractAdapterRegistry<
      { family: string; payload: string },
      { family: string; objects: Array<{ id: string; kind: string; value: string }> }
    >([
      {
        contractId: "https://synthetic.invalid/contracts/example",
        declaredVersion: "7",
        adapt: (input) => ({
          family: input.family,
          objects: [{ id: "synthetic-1", kind: "synthetic-kind", value: input.payload }],
        }),
      },
    ]);
    const adapter = adapters.resolve("https://synthetic.invalid/contracts/example", "7")!;
    const target = adapter.adapt({
      family: "synthetic_adapter_family_not_authority",
      payload: "bounded fixture",
    });
    const passing = () => gateResult("ontology", []);
    const result = runVerification(target, "ontology", {
      order: ["ontology", "interoperability", "provenance", "integrity"],
      runners: {
        ontology: passing,
        interoperability: () => gateResult("interoperability", []),
        provenance: () => gateResult("provenance", []),
        integrity: () => gateResult("integrity", []),
      },
      loadIssues: () => [],
    });

    expect(target.family).toBe("synthetic_adapter_family_not_authority");
    expect(target.objects).toEqual([
      { id: "synthetic-1", kind: "synthetic-kind", value: "bounded fixture" },
    ]);
    expect(result.passed).toBe(true);
  });

  test("resolves adapters only by exact contract ID and declared version", () => {
    const adapters = new ExactContractAdapterRegistry([
      { contractId: "synthetic", declaredVersion: "1.0.0", adapt: (value) => value },
    ]);
    expect(adapters.resolve("synthetic", "1.0.0")).toBeDefined();
    expect(adapters.resolve("synthetic", "1.0.1")).toBeUndefined();
    expect(adapters.resolve("synthetic", "2.0.0")).toBeUndefined();
  });

  test("documents the harness as an instrument with human acceptance authority", () => {
    const adr = readFileSync(join(ROOT, "adr/0020-deterministic-writ-verification.md"), "utf8");
    const guide = readFileSync(join(ROOT, "docs/verification/verification-harness.md"), "utf8");
    expect(adr).toContain(
      "It does not decide whether that representation should become part of Writ",
    );
    expect(adr).toContain("The human question is:");
    expect(guide).toContain("Human review determines acceptance");
    expect(guide).not.toContain("PASS authorizes");
  });
});

describe("current repository", () => {
  test("uses the current checkout as the default verification workspace", () => {
    expect(verificationWorkspace().root).toBe(ROOT);
  });

  test("passes all verification dimensions without external drift commands", () => {
    const result = verifySnapshot(baseline, "all", { runExternalChecks: false });
    expect(result.passed).toBe(true);
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  test("loads externally routed evidence identically when catalog order is reversed", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-reversed-catalog-"));
    symlinkSync(join(ROOT, "schemas"), join(root, "schemas"));
    symlinkSync(join(ROOT, "docs"), join(root, "docs"));
    mkdirSync(join(root, "corpora"));
    for (const entry of readdirSync(join(ROOT, "corpora"), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        symlinkSync(join(ROOT, "corpora", entry.name), join(root, "corpora", entry.name));
      }
    }
    const reversedCatalog = structuredClone(baseline.catalog);
    reversedCatalog.native_corpora.reverse();
    writeFileSync(
      join(root, "corpora", "catalog.yaml"),
      Bun.YAML.stringify(reversedCatalog, null, 2),
    );

    const reversed = loadRepository(root).snapshot;
    expect(reversed.loadIssues).toEqual([]);
    expect(crossFamilyResolution(reversed)).toEqual(crossFamilyResolution(baseline));
  });

  test("verifies an alternate workspace root without mutating it", () => {
    const root = mkdtempSync(join(tmpdir(), "writ-alternate-root-"));
    symlinkSync(join(ROOT, "schemas"), join(root, "schemas"));
    symlinkSync(join(ROOT, "docs"), join(root, "docs"));
    mkdirSync(join(root, "corpora"));
    for (const entry of readdirSync(join(ROOT, "corpora"), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        symlinkSync(join(ROOT, "corpora", entry.name), join(root, "corpora", entry.name));
      }
    }
    const catalogFile = join(root, "corpora", "catalog.yaml");
    writeFileSync(catalogFile, readFileSync(join(ROOT, "corpora", "catalog.yaml")));
    const before = readFileSync(catalogFile);

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
    expect(readdirSync(root).sort()).toEqual(["corpora", "docs", "schemas"]);
  });

  test("renders deterministic machine and human instrument output", () => {
    const result = verifySnapshot(baseline, "all", { runExternalChecks: false });
    const first = renderVerificationJson(result);
    const second = renderVerificationJson(result);
    expect(first).toBe(second);
    expect(first).not.toContain(ROOT);
    expect(Object.keys(JSON.parse(first))).toEqual(["status", "gates", "issues", "summary"]);

    const text = renderVerificationText(result);
    expect(text).toStartWith("WRIT VERIFICATION\n");
    expect(text).toContain("VERIFICATION RESULT: PASS");
    expect(text).toContain("Human review determines acceptance.");
    expect(text).not.toContain("MERGE GATE");
  });

  test("keeps deterministic issue ordering and authority context in JSON", () => {
    const snapshot = clone();
    const link = crossFamilyLink(snapshot);
    link.value.source_id = "missing_source_for_json";
    link.value.evidence_refs = ["missing_evidence_for_json"];
    const result = verifySnapshot(snapshot, "interoperability", { runExternalChecks: false });
    const output = renderVerificationJson(result);
    const parsed = JSON.parse(output) as {
      issues: Array<{ code: string; authority?: { source: string } }>;
    };
    expect(parsed.issues.map(({ code }) => code)).toEqual(
      [...parsed.issues.map(({ code }) => code)].sort(),
    );
    expect(parsed.issues.every(({ authority }) => typeof authority?.source === "string")).toBe(
      true,
    );
    expect(renderVerificationJson(result)).toBe(output);
  });
});

describe("ontology negative fixtures", () => {
  test("rejects zero and duplicate approved identities", () => {
    const missing = clone();
    missing.institutionalRecords = missing.institutionalRecords.filter(
      ({ value }) => value.record_id !== "eu_ai_office_identity",
    );
    missing.records = missing.records.filter(
      ({ value }) => value.record_id !== "eu_ai_office_identity",
    );
    expect(codes(verifyOntology(missing))).toContain("ONTOLOGY_IDENTITY_NOT_FOUND");

    const duplicate = clone();
    const identity = duplicate.institutionalRecords.find(
      ({ value }) => value.record_id === "eu_ai_office_identity",
    )!;
    const value = {
      ...identity.value,
      record_id: "duplicate_eu_ai_office_identity",
    } as AtomicInstitutionalRecord;
    duplicate.institutionalRecords.push({ ...identity, value });
    expect(codes(verifyOntology(duplicate))).toContain("ONTOLOGY_IDENTITY_AMBIGUOUS");
  });

  test("rejects ADR 0019 endpoint-kind violations", () => {
    const source = clone();
    crossFamilyLink(source).value.source_kind = "source_document";
    expect(codes(verifyOntology(source))).toContain("ONTOLOGY_INVALID_SOURCE_KIND");

    const target = clone();
    crossFamilyLink(target).value.target_kind = "legal_policy_provision";
    expect(codes(verifyOntology(target))).toContain("ONTOLOGY_INVALID_TARGET_KIND");
  });

  test("does not impose placement-support semantics on part_of", () => {
    const snapshot = clone();
    const partOf = snapshot.links.find(
      ({ value }) => value.relation_type === "part_of" && value.basis === "direct",
    )!;
    const nonPlacement = snapshot.institutionalRecords.find(
      ({ value }) => value.institutional_fact_type === "function",
    )!;
    partOf.value.supporting_record_ids = [nonPlacement.value.record_id];
    expect(codes(verifyOntology(snapshot))).not.toContain(
      "ONTOLOGY_PLACEMENT_SUPPORT_INCOMPATIBLE",
    );
  });
});

describe("interoperability negative fixtures", () => {
  test("rejects missing endpoints and support", () => {
    const missingSource = clone();
    crossFamilyLink(missingSource).value.source_id = "missing_legal_policy_claim";
    expect(codes(verifyInteroperability(missingSource))).toContain("INTEROP_SOURCE_NOT_FOUND");

    const missingSupport = clone();
    const link = crossFamilyLink(missingSupport);
    link.value.supporting_record_ids = ["missing_support"];
    expect(codes(verifyInteroperability(missingSupport))).toContain("INTEROP_SUPPORT_NOT_FOUND");
  });

  test("requires actual endpoint objects to match the declared ADR 0019 kind", () => {
    const claimMismatch = clone();
    const link = crossFamilyLink(claimMismatch);
    claimMismatch.objects = claimMismatch.objects.filter(
      (item) => !(item.id === link.value.source_id && item.kind === "legal_policy_claim"),
    );
    claimMismatch.objects.push({
      id: link.value.source_id,
      kind: "record",
      value: {},
      file: "synthetic/generic-record.yaml",
      corpus_id: "synthetic",
      aliases: [],
    });
    const claimCodes = codes(verifyInteroperability(claimMismatch));
    expect(claimCodes).toContain("INTEROP_ENDPOINT_KIND_MISMATCH");
    expect(claimCodes).not.toContain("INTEROP_SOURCE_NOT_FOUND");

    const institutionMismatch = clone();
    crossFamilyLink(institutionMismatch).value.target_kind = "institution";
    expect(codes(verifyInteroperability(institutionMismatch))).toContain(
      "INTEROP_ENDPOINT_KIND_MISMATCH",
    );
  });

  test("requires inherited support only for ADR 0019 relations", () => {
    const inherited = clone();
    const inheritedLink = crossFamilyLink(inherited);
    inheritedLink.value.basis = "inherited";
    delete inheritedLink.value.supporting_record_ids;
    expect(codes(verifyInteroperability(inherited))).toContain("INTEROP_INHERITED_SUPPORT_MISSING");

    const supportedInherited = clone();
    crossFamilyLink(supportedInherited).value.basis = "inherited";
    expect(codes(verifyInteroperability(supportedInherited))).not.toContain(
      "INTEROP_INHERITED_SUPPORT_MISSING",
    );

    const direct = clone();
    delete crossFamilyLink(direct).value.supporting_record_ids;
    expect(codes(verifyInteroperability(direct))).not.toContain(
      "INTEROP_INHERITED_SUPPORT_MISSING",
    );

    const nonAdr = clone();
    const partOf = nonAdr.links.find(({ value }) => value.relation_type === "part_of")!;
    partOf.value.basis = "inherited";
    delete partOf.value.supporting_record_ids;
    expect(codes(verifyInteroperability(nonAdr))).not.toContain(
      "INTEROP_INHERITED_SUPPORT_MISSING",
    );
  });

  test("retains ordinary part_of endpoint existence checks", () => {
    const snapshot = clone();
    const partOf = snapshot.links.find(({ value }) => value.relation_type === "part_of")!;
    partOf.value.source_id = "missing_institutional_symbol";
    expect(codes(verifyInteroperability(snapshot))).toContain("INTEROP_SOURCE_NOT_FOUND");
  });

  test("rejects an unresolved queue candidate activated as a Core link", () => {
    const snapshot = clone();
    const template = crossFamilyLink(snapshot);
    const unresolved = snapshot.queues[0]!.mappings.find(
      (mapping) => mapping.mapping_status === "unresolved" && mapping.legal_policy_record_id,
    )!;
    const value: RecordLink = {
      ...template.value,
      link_id: "synthetic_unresolved_active",
      source_id: unresolved.legal_policy_record_id!,
      relation_type: unresolved.proposed_relation as RecordLink["relation_type"],
      target_id: unresolved.target_institutional_id,
    };
    snapshot.links.push({ ...template, value });
    expect(codes(verifyInteroperability(snapshot))).toContain("INTEROP_UNRESOLVED_ACTIVE");
  });

  test("rejects an exact reverse duplicate of the same ADR 0019 relation", () => {
    const inverse = clone();
    const template = crossFamilyLink(inverse);
    inverse.links.push({
      ...template,
      value: {
        ...template.value,
        link_id: "synthetic_inverse",
        source_id: template.value.target_id,
        target_id: template.value.source_id,
      },
    });
    expect(codes(verifyInteroperability(inverse))).toContain("INTEROP_INVERSE_DUPLICATE");
  });

  test("permits reversed endpoints when the two ADR 0019 relations are semantically distinct", () => {
    const snapshot = clone();
    const template = crossFamilyLink(snapshot);
    const identityTemplate = snapshot.institutionalRecords.find(
      ({ value }) =>
        value.institutional_fact_type === "identity" &&
        value.corpus_id === template.value.owning_corpus_id,
    )!;
    const functionTemplate = snapshot.institutionalRecords.find(
      ({ value }) =>
        value.institutional_fact_type === "function" &&
        value.corpus_id === template.value.owning_corpus_id,
    )!;
    const identity = {
      ...identityTemplate.value,
      record_id: "synthetic_dual_identity",
      institution_id: "synthetic_dual",
    } as AtomicInstitutionalRecord;
    const institutionFunction = {
      ...functionTemplate.value,
      record_id: "synthetic_dual",
      institution_id: "synthetic_dual",
    } as AtomicInstitutionalRecord;
    for (const value of [identity, institutionFunction]) {
      const loaded = { ...identityTemplate, value };
      snapshot.records.push(loaded);
      snapshot.institutionalRecords.push(loaded);
      snapshot.objects.push({
        id: value.record_id,
        kind: "record",
        value: value as unknown as Record<string, unknown>,
        file: `synthetic/${value.record_id}.writ`,
        corpus_id: loaded.corpus_id,
        aliases: [],
      });
    }
    const provision = snapshot.records.find(({ value }) => value.family === "legal_policy")!;
    const forward: RecordLink = {
      ...template.value,
      link_id: "synthetic_distinct_forward",
      source_id: provision.value.record_id,
      source_kind: "legal_policy_provision",
      target_id: "synthetic_dual",
      target_kind: "institution",
    };
    const reverse: RecordLink = {
      ...template.value,
      link_id: "synthetic_distinct_reverse",
      source_id: "synthetic_dual",
      source_kind: "institutional_function",
      target_id: provision.value.record_id,
      target_kind: "legal_policy_provision",
      relation_type: "derives_authority_from",
    };
    delete forward.supporting_record_ids;
    delete reverse.supporting_record_ids;
    snapshot.links.push({ ...template, value: forward }, { ...template, value: reverse });

    expect(codes(verifyOntology(snapshot))).not.toContain("ONTOLOGY_INVALID_SOURCE_KIND");
    expect(codes(verifyOntology(snapshot))).not.toContain("ONTOLOGY_INVALID_TARGET_KIND");
    const interopCodes = codes(verifyInteroperability(snapshot));
    expect(interopCodes).not.toContain("INTEROP_INVERSE_DUPLICATE");
    expect(interopCodes).not.toContain("INTEROP_ENDPOINT_KIND_MISMATCH");
    expect(interopCodes).not.toContain("INTEROP_SOURCE_NOT_FOUND");
    expect(interopCodes).not.toContain("INTEROP_TARGET_NOT_FOUND");
  });

  test("permits active links created outside a historical queue", () => {
    const outsideQueue = clone();
    const partOf = outsideQueue.links.find(({ value }) => value.relation_type === "part_of")!;
    outsideQueue.links.push({
      ...partOf,
      value: { ...partOf.value, link_id: "synthetic_outside_queue" },
    });
    expect(codes(verifyInteroperability(outsideQueue))).not.toContain(
      "INTEROP_ACTIVE_SET_MISMATCH",
    );
  });

  test("requires queue-local active mapping and active_link_id agreement", () => {
    const missingDeclaration = clone();
    missingDeclaration.queues[0]!.active_link_ids.pop();
    expect(codes(verifyInteroperability(missingDeclaration))).toContain(
      "INTEROP_ACTIVE_SET_MISMATCH",
    );

    const missingMapping = clone();
    const activeId = missingMapping.queues[0]!.active_link_ids[0]!;
    const activeLink = missingMapping.links.find(({ value }) => value.link_id === activeId)!;
    const activeMapping = missingMapping.queues[0]!.mappings.find(
      (mapping) =>
        mapping.mapping_status === "active_approved" &&
        mapping.legal_policy_record_id === activeLink.value.source_id,
    )!;
    activeMapping.mapping_status = "unresolved";
    expect(codes(verifyInteroperability(missingMapping))).toContain("INTEROP_ACTIVE_SET_MISMATCH");

    const draftLink = clone();
    const declaredId = draftLink.queues[0]!.active_link_ids[0]!;
    draftLink.links.find(({ value }) => value.link_id === declaredId)!.value.review_state = "draft";
    expect(codes(verifyInteroperability(draftLink))).toContain("INTEROP_ACTIVE_SET_MISMATCH");
  });

  test("requires derives_authority_from ownership to follow its institutional source", () => {
    const snapshot = clone();
    const template = crossFamilyLink(snapshot);
    const nistFunction = snapshot.institutionalRecords.find(
      ({ value, corpus_id }) =>
        corpus_id === "us.institutions.nist" &&
        value.institutional_fact_type === "function" &&
        value.review_state !== "superseded" &&
        value.review_state !== "withdrawn",
    )!;
    const provision = snapshot.records.find(({ value }) => value.family === "legal_policy")!;
    const value: RecordLink = {
      ...template.value,
      link_id: "synthetic_wrong_owner_derives_authority",
      relation_type: "derives_authority_from",
      source_id: nistFunction.value.record_id,
      source_kind: "institutional_function",
      target_id: provision.value.record_id,
      target_kind: "legal_policy_provision",
    };
    delete value.supporting_record_ids;
    snapshot.links.push({ ...template, value });
    expect(codes(verifyInteroperability(snapshot))).toContain("INTEROP_OWNER_MISMATCH");
  });

  test("reports ambiguity only when a scoped reference resolves more than once", () => {
    const ambiguous = clone();
    const link = crossFamilyLink(ambiguous);
    const source = findObjects(ambiguous, link.value.source_id)[0]!;
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
});

describe("provenance negative fixtures", () => {
  test("requires dispositions only for ADR 0019 links", () => {
    const snapshot = clone();
    const target = crossFamilyLink(snapshot).value.link_id;
    snapshot.judgments = snapshot.judgments.filter(
      ({ value }) => !(value.target_id === target && value.status === "accepted"),
    );
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_DISPOSITION_MISSING");

    const nonAdr = clone();
    const partOf = nonAdr.links.find(({ value }) => value.relation_type === "part_of")!;
    nonAdr.judgments = nonAdr.judgments.filter(
      ({ value }) => !(value.target_id === partOf.value.link_id && value.status === "accepted"),
    );
    expect(codes(verifyProvenance(nonAdr))).not.toContain("PROVENANCE_DISPOSITION_MISSING");
  });

  test("does not accept an unrelated accepted judgment as a link disposition", () => {
    const snapshot = clone();
    const target = crossFamilyLink(snapshot).value.link_id;
    const disposition = snapshot.judgments.find(
      ({ value }) => value.target_id === target && value.status === "accepted",
    )!;
    disposition.value.judgment_type = "review_disposition";
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_DISPOSITION_MISSING");
  });

  test("binds approval to the exact accepted judgment named by human review", () => {
    const snapshot = clone();
    const decision = snapshot.humanReviews[0]!.decisions[0]!;
    const named = snapshot.judgments.find(
      ({ value }) => value.judgment_id === decision.accepted_judgment_id,
    )!;
    named.value.judgment_id = "arbitrary_matching_accepted_disposition";
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_DISPOSITION_MISSING");

    const wrongReviewer = clone();
    const reviewerDecision = wrongReviewer.humanReviews[0]!.decisions[0]!;
    wrongReviewer.judgments.find(
      ({ value }) => value.judgment_id === reviewerDecision.accepted_judgment_id,
    )!.value.reviewer = "Different Reviewer";
    expect(codes(verifyProvenance(wrongReviewer))).toContain("PROVENANCE_DISPOSITION_MISSING");
  });

  test("binds the exact proposal value, status, attribution and reciprocal supersession", () => {
    const wrongValue = clone();
    const decision = wrongValue.humanReviews[0]!.decisions[0]!;
    wrongValue.judgments.find(
      ({ value }) => value.judgment_id === decision.proposal_judgment_id,
    )!.value.value = "approved";
    expect(codes(verifyProvenance(wrongValue))).toContain("PROVENANCE_DISPOSITION_MISSING");

    const wrongStatus = clone();
    const statusDecision = wrongStatus.humanReviews[0]!.decisions[0]!;
    const statusProposal = wrongStatus.judgments.find(
      ({ value }) => value.judgment_id === statusDecision.proposal_judgment_id,
    )!;
    statusProposal.value.status = "proposed";
    delete statusProposal.value.superseded_by_judgment_id;
    expect(codes(verifyProvenance(wrongStatus))).toContain("PROVENANCE_DISPOSITION_MISSING");

    const oneWay = clone();
    const oneWayDecision = oneWay.humanReviews[0]!.decisions[0]!;
    oneWay.judgments.find(
      ({ value }) => value.judgment_id === oneWayDecision.accepted_judgment_id,
    )!.value.supersedes_judgment_ids = [];
    expect(codes(verifyProvenance(oneWay))).toContain("PROVENANCE_DISPOSITION_MISSING");
  });

  test("rejects multiple current accepted ADR 0019 dispositions", () => {
    const snapshot = clone();
    const decision = snapshot.humanReviews[0]!.decisions[0]!;
    const accepted = snapshot.judgments.find(
      ({ value }) => value.judgment_id === decision.accepted_judgment_id,
    )!;
    snapshot.judgments.push({
      ...accepted,
      value: { ...accepted.value, judgment_id: "synthetic_second_accepted_disposition" },
    });
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_DISPOSITION_AMBIGUOUS");
  });

  test("uses explicit proposal metadata for automation attribution", () => {
    const snapshot = clone();
    const proposal = snapshot.judgments.find(({ value }) =>
      value.judgment_id.endsWith("_proposal"),
    )!;
    proposal.value.reviewer = "Sara Kim";
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_AUTOMATION_ATTRIBUTION");

    const humanHistory = clone();
    const current = humanHistory.judgments.find(
      ({ value }) =>
        value.target_kind === "record" &&
        value.status === "accepted" &&
        (value.supersedes_judgment_ids?.length ?? 0) === 0,
    )!;
    const priorValue: CurrentRecordJudgment = {
      ...current.value,
      judgment_id: "synthetic_prior_human_judgment",
      reviewer: current.value.reviewer,
      status: "superseded",
      superseded_by_judgment_id: current.value.judgment_id,
    };
    delete priorValue.supersedes_judgment_ids;
    current.value.supersedes_judgment_ids = [priorValue.judgment_id];
    humanHistory.judgments.push({ ...current, value: priorValue });
    const result = verifyProvenance(humanHistory);
    expect(codes(result)).not.toContain("PROVENANCE_AUTOMATION_ATTRIBUTION");
    expect(codes(result)).not.toContain("PROVENANCE_SUPERSESSION_INVALID");
  });

  test("rejects broken supersession", () => {
    const broken = clone();
    const accepted = broken.judgments.find(
      ({ value }) => (value.supersedes_judgment_ids?.length ?? 0) > 0,
    )!;
    accepted.value.supersedes_judgment_ids = ["missing_proposal"];
    expect(codes(verifyProvenance(broken))).toContain("PROVENANCE_SUPERSESSION_INVALID");
  });

  test("rejects legacy IDs on active surfaces but permits historical preservation", () => {
    const active = clone();
    const migration = active.migrations.find(
      (item) => item.previous_id === "eu_ai_office_technical_documentation_receipt",
    )!;
    crossFamilyLink(active).value.supporting_record_ids = [migration.previous_id];
    expect(codes(verifyProvenance(active))).toContain("PROVENANCE_ACTIVE_LEGACY_ID");

    const historical = clone();
    const activeRecord = historical.records.find(
      ({ value }) => value.record_id === migration.active_id,
    )!;
    historical.records.push({
      ...activeRecord,
      value: {
        ...activeRecord.value,
        record_id: migration.previous_id,
        review_state: "superseded",
      },
    });
    const linkTemplate = crossFamilyLink(historical);
    historical.links.push({
      ...linkTemplate,
      value: {
        ...linkTemplate.value,
        link_id: "synthetic_historical_link",
        source_id: migration.previous_id,
        supporting_record_ids: [migration.previous_id],
        review_state: "superseded",
      },
    });
    const current = historical.judgments.find(
      ({ value }) => value.target_kind === "record" && value.target_id === migration.active_id,
    )!;
    const historicalJudgment: CurrentRecordJudgment = {
      ...current.value,
      judgment_id: "synthetic_historical_judgment",
      target_id: migration.previous_id,
      status: "superseded",
      superseded_by_judgment_id: current.value.judgment_id,
    };
    delete historicalJudgment.supersedes_judgment_ids;
    current.value.supersedes_judgment_ids = [historicalJudgment.judgment_id];
    historical.judgments.push({ ...current, value: historicalJudgment });
    const result = verifyProvenance(historical);
    expect(codes(result)).not.toContain("PROVENANCE_ACTIVE_LEGACY_ID");
    expect(codes(result)).not.toContain("PROVENANCE_JUDGMENT_TARGET_NOT_FOUND");
  });

  test("keeps record-ID migrations separate from institution and subject namespaces", () => {
    const snapshot = clone();
    const migration = snapshot.migrations.find(
      (item) => item.previous_id === "eu_ai_office_technical_documentation_receipt",
    )!;
    const identity = snapshot.institutionalRecords.find(
      ({ value }) => value.institutional_fact_type === "identity",
    )!;
    identity.value.institution_id = migration.previous_id;
    snapshot.records[0]!.value.subjects[0]!.subject_id = migration.previous_id;
    expect(codes(verifyProvenance(snapshot))).not.toContain("PROVENANCE_ACTIVE_LEGACY_ID");
  });

  test("permits the same record ID in an unrelated corpus namespace", () => {
    const snapshot = clone();
    const migration = snapshot.migrations.find(
      (item) => item.previous_id === "eu_ai_office_technical_documentation_receipt",
    )!;
    const current = snapshot.records.find(
      ({ value, corpus_id }) =>
        corpus_id === migration.corpus_id && value.record_id === migration.active_id,
    )!;
    snapshot.records.push({
      ...current,
      corpus_id: "synthetic.unrelated",
      value: {
        ...current.value,
        corpus_id: "synthetic.unrelated",
        record_id: migration.previous_id,
      } as typeof current.value,
    });
    expect(codes(verifyProvenance(snapshot))).not.toContain("PROVENANCE_ACTIVE_LEGACY_ID");
  });

  test("validates migration history through structured review metadata", () => {
    const snapshot = clone();
    const review = snapshot.humanReviews[0]!;
    review.approved_id_revision.previous_id = "unrelated_previous_id";
    expect(codes(verifyProvenance(snapshot))).toContain(
      "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
    );
  });

  test("reports ambiguous judgment references without imposing global uniqueness", () => {
    const snapshot = clone();
    const judgment = snapshot.judgments.find(
      ({ value }) => value.target_kind === "record" && value.status === "accepted",
    )!;
    const target = snapshot.records.find(
      ({ value }) => value.record_id === judgment.value.target_id,
    )!;
    snapshot.records.push({ ...target, file: "synthetic/duplicate-target.writ" });
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_REFERENCE_AMBIGUOUS");
  });
});

describe("integrity negative fixtures", () => {
  test("rejects manifest count drift and missing routed files", () => {
    const count = clone();
    count.manifests[0]!.value.record_counts.claims =
      (count.manifests[0]!.value.record_counts.claims ?? 0) + 1;
    expect(codes(verifyIntegrity(count, { runExternalChecks: false }))).toContain(
      "INTEGRITY_COUNT_MISMATCH",
    );

    const missing = clone();
    missing.loadIssues.push({
      gate: "integrity",
      code: "INTEGRITY_ROUTED_FILE_MISSING",
      severity: "error",
      message: "synthetic missing path",
      file: "missing.yaml",
    });
    expect(codes(verifyIntegrity(missing, { runExternalChecks: false }))).toContain(
      "INTEGRITY_ROUTED_FILE_MISSING",
    );
  });

  test("rejects dangling active links", () => {
    const snapshot = clone();
    crossFamilyLink(snapshot).value.source_id = "missing_source";
    expect(codes(verifyIntegrity(snapshot, { runExternalChecks: false }))).toContain(
      "INTEGRITY_DANGLING_REFERENCE",
    );
  });

  test("rejects checksum content and inventory drift", () => {
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
