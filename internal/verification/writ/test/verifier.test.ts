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
  checkManifestChecksum,
  classifyRecordContract,
  findObjects,
  loadAuthorityIndex,
  loadRepository,
  parseInstitutionalMigrationDocument,
  parseMappingQueueFile,
  repositoryRoot,
  verifyIntegrity,
  verifyInteroperability,
  verifyOntology,
  verifyProvenance,
  verifySnapshot,
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

  test("every blocking invariant resolves to its declared authority without owning vocabulary", () => {
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
        expect(invariant.authority.source).toBe("adr/0020-deterministic-pre-merge-verification.md");
        expect(readFileSync(source, "utf8")).toContain("**Status:** Accepted");
      } else if (invariant.authority.kind === "core_contract") {
        expect(invariant.authority.source).toBe("packages/domain/src/judgments.ts");
        expect(invariant.authority.version).toBe("0.2.0");
      }
    }
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

describe("current repository", () => {
  test("passes all semantic gates without external drift commands", () => {
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

  test("does not require every direct part_of link to carry placement support", () => {
    const snapshot = clone();
    const partOf = snapshot.links.find(
      ({ value }) => value.relation_type === "part_of" && value.basis === "direct",
    )!;
    delete partOf.value.supporting_record_ids;
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
      ({ value }) => value.institutional_fact_type === "identity",
    )!;
    const functionTemplate = snapshot.institutionalRecords.find(
      ({ value }) => value.institutional_fact_type === "function",
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
    const forward: RecordLink = {
      ...template.value,
      link_id: "synthetic_distinct_forward",
      target_id: "synthetic_dual",
      target_kind: "institution",
    };
    const reverse: RecordLink = {
      ...template.value,
      link_id: "synthetic_distinct_reverse",
      source_id: "synthetic_dual",
      source_kind: "institutional_function",
      target_id: template.value.source_id,
      target_kind: "legal_policy_provision",
      relation_type: "derives_authority_from",
    };
    delete forward.supporting_record_ids;
    delete reverse.supporting_record_ids;
    snapshot.links.push({ ...template, value: forward }, { ...template, value: reverse });

    expect(codes(verifyOntology(snapshot))).not.toContain("ONTOLOGY_INVALID_SOURCE_KIND");
    expect(codes(verifyOntology(snapshot))).not.toContain("ONTOLOGY_INVALID_TARGET_KIND");
    expect(codes(verifyInteroperability(snapshot))).not.toContain("INTEROP_INVERSE_DUPLICATE");
  });

  test("permits active links created outside a historical queue", () => {
    const outsideQueue = clone();
    outsideQueue.queues = [];
    expect(codes(verifyInteroperability(outsideQueue))).not.toContain(
      "INTEROP_ACTIVE_SET_MISMATCH",
    );
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
