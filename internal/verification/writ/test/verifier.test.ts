import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CURRENT_WORKFLOW_REGISTRATIONS,
  ExactContractAdapterRegistry,
  INSTITUTIONAL_RECORD_SCHEMA,
  INVARIANTS,
  LEGACY_LEGAL_POLICY_RECORD_SCHEMA,
  LEGAL_POLICY_RECORD_SCHEMA,
  classifyRecordContract,
  gateResult,
  loadAuthorityIndex,
  loadRepository,
  renderVerificationJson,
  renderVerificationText,
  repositoryRoot,
  runVerification,
  verificationWorkspace,
  verifyIntegrity,
  verifyInteroperability,
  verifyOntology,
  verifyProvenance,
  verifySnapshot,
  type RepositorySnapshot,
} from "../src/index.js";

const ROOT = repositoryRoot(import.meta.dir);
const loaded = loadRepository(ROOT);
const baseline = loaded.snapshot;

const clone = (): RepositorySnapshot => structuredClone(baseline);
const codes = (result: { issues: Array<{ code: string }> }): string[] =>
  result.issues.map(({ code }) => code);

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

  test("has no active workflow registration for retired ADR-0019 artifacts", () => {
    expect(CURRENT_WORKFLOW_REGISTRATIONS).toEqual([]);
    expect(baseline.workflowStates).toEqual({});
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
    expect(renderVerificationJson(result)).toBe(renderVerificationJson(result));
    expect(renderVerificationText(result)).toContain("VERIFICATION RESULT: PASS");
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

  test("detects manifest count drift", () => {
    const snapshot = clone();
    snapshot.manifests[0]!.value.record_counts.institutional_records = 999;
    expect(codes(verifyIntegrity(snapshot, { runExternalChecks: false }))).toContain(
      "INTEGRITY_COUNT_MISMATCH",
    );
  });
});
