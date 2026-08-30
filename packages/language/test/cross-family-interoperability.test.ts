import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InstitutionResolutionError,
  resolveApprovedInstitutionEndpoint,
  validate,
  validateJudgmentSupersession,
  type AtomicInstitutionalRecord,
  type CurrentRecordJudgment,
  type RecordLink,
} from "@writ/domain";
import { compileSource } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const EC = join(ROOT, "corpora/institutional/eu/european-commission");
const NIST = join(ROOT, "corpora/institutional/us/nist");

const yaml = <T>(path: string): T => Bun.YAML.parse(readFileSync(path, "utf8")) as T;
const catalog = yaml<{
  native_corpora: Array<{ corpus_id: string; family: "legal_policy" | "institutional" }>;
}>(join(ROOT, "corpora/catalog.yaml"));
const corpusRoots = [EC, NIST] as const;
const manifestEntries = corpusRoots.map((root) => ({
  root,
  manifest: yaml<{
    corpus_id: string;
    family: "legal_policy" | "institutional";
    root_institution_id: string;
    record_counts: Record<string, number>;
    review_counts: Record<string, number>;
    locations: Record<string, string[]>;
  }>(join(root, "corpus.yaml")),
}));
const manifests = manifestEntries.map(({ manifest }) => manifest);
const links = manifestEntries.flatMap(({ root, manifest }) =>
  (manifest.locations.relationships ?? [])
    .filter((path) => path.startsWith("relationships/cross-family/"))
    .map((path) => yaml<RecordLink>(join(root, path))),
);
const records = corpusRoots.flatMap(
  (root) =>
    compileSource(readFileSync(join(root, "records.writ"), "utf8"), {
      fileName: join(root, "records.writ"),
    }).records,
) as AtomicInstitutionalRecord[];

const crossFamilyJudgments = manifestEntries.flatMap(({ root, manifest }) =>
  (manifest.locations.judgments ?? [])
    .filter((path) => path === "cross-family-judgments.writ")
    .flatMap(
      (path) =>
        compileSource(readFileSync(join(root, path), "utf8"), {
          fileName: join(root, path),
        }).judgments,
    ),
) as CurrentRecordJudgment[];

const resolutionInput = {
  native_corpora: catalog.native_corpora,
  manifests,
  records,
};

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? filesUnder(child) : [child];
  });
}

function treeHash(paths: readonly string[]): string {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(relative(ROOT, path));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("approved institutional endpoint resolution", () => {
  test.each([
    ["nist", "us.institutions.nist", "nist_identity"],
    [
      "european_commission",
      "eu.institutions.european_commission",
      "european_commission_identity_v2",
    ],
    ["eu_ai_office", "eu.institutions.european_commission", "eu_ai_office_identity"],
  ])("%s resolves through exactly one approved identity", (institutionId, corpusId, recordId) => {
    expect(resolveApprovedInstitutionEndpoint(institutionId, resolutionInput)).toEqual({
      institution_id: institutionId,
      corpus_id: corpusId,
      identity_record_id: recordId,
    });
  });

  test("a root manifest without an approved identity fails deterministically", () => {
    expect(() =>
      resolveApprovedInstitutionEndpoint("unreviewed_root", {
        ...resolutionInput,
        native_corpora: [
          ...resolutionInput.native_corpora,
          { corpus_id: "test.unreviewed", family: "institutional" as const },
        ],
        manifests: [
          ...resolutionInput.manifests,
          {
            corpus_id: "test.unreviewed",
            family: "institutional" as const,
            root_institution_id: "unreviewed_root",
          },
        ],
      }),
    ).toThrow(
      new InstitutionResolutionError(
        "INSTITUTION_ENDPOINT_NOT_FOUND",
        "institutional endpoint unreviewed_root has no approved identity record",
      ),
    );
  });

  test("multiple approved identity records fail deterministically", () => {
    const nistIdentity = records.find((record) => record.record_id === "nist_identity")!;
    expect(() =>
      resolveApprovedInstitutionEndpoint("nist", {
        ...resolutionInput,
        records: [
          ...resolutionInput.records,
          { ...nistIdentity, record_id: "duplicate_nist_identity" },
        ],
      }),
    ).toThrow(
      new InstitutionResolutionError(
        "INSTITUTION_ENDPOINT_AMBIGUOUS",
        "institutional endpoint nist resolves to multiple approved identity records: duplicate_nist_identity, nist_identity",
      ),
    );
  });
});

describe("the three-link cross-family pilot", () => {
  test("uses only the approved endpoint kinds and Core semantics", () => {
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(validate("record-link", link).valid).toBe(true);
      expect(link).toMatchObject({
        source_kind: "legal_policy_claim",
        relation_type: "assigns_function_to",
        basis: "direct",
        review_state: "approved",
      });
      expect(["institution", "organizational_unit"]).toContain(link.target_kind);
      expect(
        resolveApprovedInstitutionEndpoint(link.target_id, resolutionInput).institution_id,
      ).toBe(link.target_id);
    }
  });

  test("resolves every legal-policy claim and evidence passage", () => {
    const claimDocuments = yaml<{ claims: Array<{ machine_id: string }> }>(
      join(
        ROOT,
        "corpora/legal-policy/eu/european-union/artificial-intelligence-act-2024-1689/records/claims.yaml",
      ),
    ).claims;
    const passageDocuments = yaml<{ passages: Array<{ machine_id: string }> }>(
      join(
        ROOT,
        "corpora/legal-policy/eu/european-union/artificial-intelligence-act-2024-1689/passages/passages.yaml",
      ),
    ).passages;
    const claimIds = new Set(claimDocuments.map((item) => item.machine_id));
    const passageIds = new Set(passageDocuments.map((item) => item.machine_id));
    for (const link of links) {
      expect(claimIds.has(link.source_id)).toBe(true);
      expect(link.evidence_refs.every((id) => passageIds.has(id))).toBe(true);
    }
  });

  test("preserves each automated proposal and records a separate accepted human disposition", () => {
    const supersededProposals = crossFamilyJudgments.filter(
      (judgment) => judgment.status === "superseded",
    );
    const acceptedJudgments = crossFamilyJudgments.filter(
      (judgment) => judgment.status === "accepted",
    );
    expect(crossFamilyJudgments).toHaveLength(6);
    expect(supersededProposals).toHaveLength(3);
    expect(acceptedJudgments).toHaveLength(3);
    expect(validateJudgmentSupersession(crossFamilyJudgments)).toEqual({ valid: true, issues: [] });
    expect(new Set(acceptedJudgments.map((item) => item.target_id))).toEqual(
      new Set(links.map((link) => link.link_id)),
    );
    for (const judgment of supersededProposals) {
      expect(validate("record-judgment", judgment).valid).toBe(true);
      expect(judgment).toMatchObject({
        target_kind: "record_link",
        judgment_type: "record_link_disposition",
        value: "draft",
        reviewer: "OpenAI Codex automated proposal",
        status: "superseded",
      });
      expect(judgment.reviewer).not.toBe("Sara Kim");
      expect(judgment.superseded_by_judgment_id).toBeTruthy();
    }
    for (const judgment of acceptedJudgments) {
      expect(validate("record-judgment", judgment).valid).toBe(true);
      expect(judgment).toMatchObject({
        target_kind: "record_link",
        judgment_type: "record_link_disposition",
        value: "approved",
        reviewer: "Sara Kim",
        status: "accepted",
      });
      expect(judgment.supersedes_judgment_ids).toHaveLength(1);
    }
  });

  test("stores no inverse duplicate and derives reverse traversal in memory", () => {
    const stored = new Set(links.map((link) => `${link.source_id}\0${link.target_id}`));
    for (const link of links)
      expect(stored.has(`${link.target_id}\0${link.source_id}`)).toBe(false);
    const reverseTraversal = links.map((link) => ({
      source_id: link.target_id,
      target_id: link.source_id,
      derived_from_link_id: link.link_id,
    }));
    expect(reverseTraversal).toHaveLength(3);
    expect(new Set(reverseTraversal.map((item) => item.derived_from_link_id))).toEqual(
      new Set(links.map((link) => link.link_id)),
    );
  });
});

describe("mapping queue and preservation gates", () => {
  const queue = yaml<{
    status: string;
    human_review_artifact: string;
    active_link_ids: string[];
    mappings: Array<{
      mapping_status: "active_approved" | "unresolved";
      proposed_basis: "direct" | "inherited" | "inferred" | null;
      basis?: string;
      mapping_id: string;
      legal_policy_record_id: string | null;
      proposed_relation: string;
      target_institutional_id: string;
      human_review_required: boolean;
    }>;
  }>(join(ROOT, "docs/migrations/cross-family-interoperability/mapping-queue.yaml"));
  const humanReview = yaml<{
    reviewer: string;
    review_type: string;
    review_date: string;
    status: string;
    approved_id_revision: {
      previous_approved_id: string;
      active_id: string;
      substantive_content_changed: boolean;
    };
    decisions: Array<{
      link_id: string;
      decision: string;
      relation: string;
      basis: string;
      reviewer: string;
      accepted_judgment_id: string;
    }>;
    unresolved_mappings: { count: number; disposition: string };
  }>(join(ROOT, "docs/migrations/cross-family-interoperability/human-review.yaml"));

  test("keeps mapping status separate from proposed evidence basis", () => {
    expect(new Set(queue.active_link_ids)).toEqual(new Set(links.map((link) => link.link_id)));
    expect(queue.mappings.filter((item) => item.mapping_status === "active_approved")).toHaveLength(
      3,
    );
    expect(queue.mappings.some((item) => item.mapping_status === "unresolved")).toBe(true);
    for (const mapping of queue.mappings) {
      expect(mapping).not.toHaveProperty("basis");
      expect(mapping.proposed_basis).not.toBe("unresolved");
    }
    expect(
      queue.mappings
        .filter((item) => item.mapping_status === "active_approved")
        .every((item) => item.human_review_required === false),
    ).toBe(true);
  });

  test("records the completed human review separately from the automated proposal", () => {
    expect(queue.status).toBe("human_review_complete");
    expect(humanReview).toMatchObject({
      reviewer: "Sara Kim",
      review_type: "human",
      review_date: "2026-08-08",
      status: "complete",
      approved_id_revision: {
        previous_approved_id: "eu_ai_office_technical_documentation_receipt",
        active_id: "eu_ai_office_tech_doc_receipt",
        substantive_content_changed: false,
      },
      unresolved_mappings: { count: 14, disposition: "queue_only" },
    });
    expect(humanReview.decisions).toHaveLength(3);
    expect(new Set(humanReview.decisions.map((decision) => decision.link_id))).toEqual(
      new Set(links.map((link) => link.link_id)),
    );
    for (const decision of humanReview.decisions)
      expect(decision).toMatchObject({
        decision: "approve",
        relation: "assigns_function_to",
        basis: "direct",
        reviewer: "Sara Kim",
      });
  });

  test("loads the manifest relationships and keeps unresolved mappings queue-only", () => {
    const activeIds = new Set(links.map((link) => link.link_id));
    expect(queue.mappings.filter((item) => item.mapping_status === "unresolved")).toHaveLength(14);
    expect(activeIds).toEqual(new Set(queue.active_link_ids));
    expect(activeIds).toEqual(
      new Set([
        "eu_ai_act_art_53_1_a_assigns_function_to_eu_ai_office",
        "eu_ai_act_art_53_1_d_assigns_function_to_eu_ai_office",
        "eu_ai_act_art_55_1_c_assigns_function_to_eu_ai_office",
      ]),
    );

    const activeSignatures = new Set(
      links.map((link) => `${link.source_id}\0${link.relation_type}\0${link.target_id}`),
    );
    for (const mapping of queue.mappings.filter((item) => item.mapping_status === "unresolved")) {
      expect(activeIds.has(mapping.mapping_id)).toBe(false);
      expect(
        activeSignatures.has(
          `${mapping.legal_policy_record_id}\0${mapping.proposed_relation}\0${mapping.target_institutional_id}`,
        ),
      ).toBe(false);
    }
  });

  test("records the approved-link, accepted-judgment and superseded-history counts", () => {
    const commission = manifests.find(
      (manifest) => manifest.corpus_id === "eu.institutions.european_commission",
    )!;
    const nist = manifests.find((manifest) => manifest.corpus_id === "us.institutions.nist")!;
    expect(commission.record_counts).toMatchObject({
      institutional_records: 24,
      record_links: 9,
      disposition_judgments: 36,
    });
    expect(commission.review_counts).toMatchObject({
      approved_records: 20,
      superseded_records: 4,
      approved_record_links: 8,
      draft_record_links: 0,
      accepted_disposition_judgments: 28,
      proposed_disposition_judgments: 0,
      superseded_disposition_judgments: 8,
    });
    expect(nist.record_counts).toMatchObject({
      institutional_records: 19,
      record_links: 6,
      disposition_judgments: 25,
    });
    expect(nist.review_counts).toMatchObject({
      approved_records: 14,
      superseded_records: 5,
      approved_record_links: 6,
      accepted_disposition_judgments: 21,
      proposed_disposition_judgments: 0,
      superseded_disposition_judgments: 4,
    });
  });

  test("preserves legal-policy, NIST, and reviewed Commission bytes", () => {
    const legalPolicyFiles = filesUnder(join(ROOT, "corpora/legal-policy"));
    expect(legalPolicyFiles).toHaveLength(138);
    expect(treeHash(legalPolicyFiles)).toBe(
      "362adc02793a0dd125ce9adf9bf15a5e37c00c648797bc4b01210b577820c72e",
    );
    expect(fileHash(join(NIST, "records.writ"))).toBe(
      "eaac05647504763ff1098e06bc840fb8e4efa43598cac4b1dd6738f6698eb31f",
    );
    expect(fileHash(join(NIST, "judgments.writ"))).toBe(
      "a2c63c4be16836edcddc66cdc353c6975cad211936a6107c52d3e317a9a50e21",
    );
    expect(fileHash(join(EC, "records.writ"))).toBe(
      "05cd96bb274e27d8eb455ab4aea3d37368088a56591144fc7bf3227331d36a11",
    );
    expect(fileHash(join(EC, "judgments.writ"))).toBe(
      "bfa7bfc50e58548e5ddeb9f352837c57bfde53a041cfa22d189a20e988e111ec",
    );
  });

  test("keeps the pre-migration identifier out of active records and supporting references", () => {
    const historicalId = "eu_ai_office_technical_documentation_receipt";
    const activeId = "eu_ai_office_tech_doc_receipt";
    expect(records.some((record) => record.record_id === historicalId)).toBe(false);
    expect(links.some((link) => (link.supporting_record_ids ?? []).includes(historicalId))).toBe(
      false,
    );
    expect(records.some((record) => record.record_id === activeId)).toBe(true);
  });
});
