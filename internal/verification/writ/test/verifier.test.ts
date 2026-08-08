import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtomicInstitutionalRecord, RecordLink } from "@writ/domain";

import {
  INVARIANTS,
  checkManifestChecksum,
  classifyRecordContract,
  loadAuthorityIndex,
  loadRepository,
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

  test("every blocking invariant has authority metadata without a vocabulary payload", () => {
    expect(INVARIANTS.length).toBeGreaterThan(20);
    for (const invariant of INVARIANTS) {
      expect(invariant.code).toMatch(/^[A-Z0-9_]+$/);
      expect(invariant.authority.source.length).toBeGreaterThan(0);
      expect(invariant.authority.section.length).toBeGreaterThan(0);
      expect(invariant).not.toHaveProperty("allowed_values");
      expect(invariant).not.toHaveProperty("vocabulary");
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
});

describe("current repository", () => {
  test("passes all semantic gates without external drift commands", () => {
    const result = verifySnapshot(baseline, "all", { runExternalChecks: false });
    expect(result.passed).toBe(true);
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
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

  test("rejects stored inverse links but permits active links outside a historical queue", () => {
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

    const outsideQueue = clone();
    outsideQueue.queues = [];
    expect(codes(verifyInteroperability(outsideQueue))).not.toContain(
      "INTEROP_ACTIVE_SET_MISMATCH",
    );
  });
});

describe("provenance negative fixtures", () => {
  test("rejects an approved link without an accepted disposition", () => {
    const snapshot = clone();
    const target = crossFamilyLink(snapshot).value.link_id;
    snapshot.judgments = snapshot.judgments.filter(
      ({ value }) => !(value.target_id === target && value.status === "accepted"),
    );
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_DISPOSITION_MISSING");
  });

  test("rejects human attribution on preserved automated proposal history", () => {
    const snapshot = clone();
    const proposal = snapshot.judgments.find(({ value }) =>
      value.judgment_id.endsWith("_proposal"),
    )!;
    proposal.value.reviewer = "Sara Kim";
    expect(codes(verifyProvenance(snapshot))).toContain("PROVENANCE_AUTOMATION_ATTRIBUTION");
  });

  test("rejects broken supersession and active previous IDs", () => {
    const broken = clone();
    const accepted = broken.judgments.find(
      ({ value }) => (value.supersedes_judgment_ids?.length ?? 0) > 0,
    )!;
    accepted.value.supersedes_judgment_ids = ["missing_proposal"];
    expect(codes(verifyProvenance(broken))).toContain("PROVENANCE_SUPERSESSION_INVALID");

    const migrated = clone();
    const migration = migrated.migrations.find(
      (item) => item.previous_id === "eu_ai_office_technical_documentation_receipt",
    )!;
    const template = migrated.records.find(({ value }) => value.record_id === migration.active_id)!;
    migrated.records.push({
      ...template,
      value: { ...template.value, record_id: migration.previous_id },
    });
    expect(codes(verifyProvenance(migrated))).toContain("PROVENANCE_ACTIVE_LEGACY_ID");
    expect(codes(verifyProvenance(clone()))).not.toContain("PROVENANCE_ACTIVE_LEGACY_ID");
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
