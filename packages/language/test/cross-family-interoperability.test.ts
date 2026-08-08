import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InstitutionResolutionError,
  resolveApprovedInstitutionEndpoint,
  validate,
  type AtomicInstitutionalRecord,
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
  manifest.locations.relationships
    .filter((path) => path.startsWith("relationships/cross-family/"))
    .map((path) => yaml<RecordLink>(join(root, path))),
);
const records = corpusRoots.flatMap(
  (root) =>
    compileSource(readFileSync(join(root, "records.writ"), "utf8"), {
      fileName: join(root, "records.writ"),
    }).records,
) as AtomicInstitutionalRecord[];

interface ProposedRecordLinkJudgment {
  target_id: string;
  target_kind: string;
  judgment_type: string;
  value: unknown;
  reviewer: string;
  status: string;
}

const proposedJudgments = manifestEntries.flatMap(({ root, manifest }) =>
  manifest.locations.judgments
    .filter((path) => path === "cross-family-judgments.writ")
    .flatMap(
      (path) =>
        compileSource(readFileSync(join(root, path), "utf8"), {
          fileName: join(root, path),
        }).judgments,
    ),
) as ProposedRecordLinkJudgment[];

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
    ["european_commission", "eu.institutions.european_commission", "european_commission_identity"],
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
        review_state: "draft",
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

  test("has one proposed disposition per draft link and no human attribution", () => {
    expect(proposedJudgments).toHaveLength(3);
    expect(new Set(proposedJudgments.map((item) => item.target_id))).toEqual(
      new Set(links.map((link) => link.link_id)),
    );
    for (const judgment of proposedJudgments) {
      expect(validate("record-judgment", judgment).valid).toBe(true);
      expect(judgment).toMatchObject({
        target_kind: "record_link",
        judgment_type: "record_link_disposition",
        value: "draft",
        reviewer: "OpenAI Codex automated proposal",
        status: "proposed",
      });
      expect(judgment.reviewer).not.toBe("Sara Kim");
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
    active_link_ids: string[];
    mappings: Array<{
      mapping_status: "active_candidate" | "unresolved";
      proposed_basis: "direct" | "inherited" | "inferred" | null;
      basis?: string;
      mapping_id: string;
      legal_policy_record_id: string | null;
      proposed_relation: string;
      target_institutional_id: string;
    }>;
  }>(join(ROOT, "docs/migrations/cross-family-interoperability/mapping-queue.yaml"));

  test("keeps mapping status separate from proposed evidence basis", () => {
    expect(new Set(queue.active_link_ids)).toEqual(new Set(links.map((link) => link.link_id)));
    expect(
      queue.mappings.filter((item) => item.mapping_status === "active_candidate"),
    ).toHaveLength(3);
    expect(queue.mappings.some((item) => item.mapping_status === "unresolved")).toBe(true);
    for (const mapping of queue.mappings) {
      expect(mapping).not.toHaveProperty("basis");
      expect(mapping.proposed_basis).not.toBe("unresolved");
    }
  });

  test("loads the manifest relationships and keeps unresolved mappings queue-only", () => {
    const activeIds = new Set(links.map((link) => link.link_id));
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

  test("changes only draft-link and proposed-judgment counts", () => {
    const commission = manifests.find(
      (manifest) => manifest.corpus_id === "eu.institutions.european_commission",
    )!;
    const nist = manifests.find((manifest) => manifest.corpus_id === "us.institutions.nist")!;
    expect(commission.record_counts).toMatchObject({
      institutional_records: 20,
      record_links: 4,
      disposition_judgments: 24,
    });
    expect(commission.review_counts).toMatchObject({
      approved_records: 20,
      approved_record_links: 1,
      draft_record_links: 3,
      accepted_disposition_judgments: 21,
      proposed_disposition_judgments: 3,
    });
    expect(nist.record_counts).toMatchObject({
      institutional_records: 15,
      record_links: 2,
      disposition_judgments: 17,
    });
    expect(nist.review_counts).toMatchObject({
      approved_records: 14,
      superseded_records: 1,
      approved_record_links: 2,
      accepted_disposition_judgments: 17,
      proposed_disposition_judgments: 0,
    });
  });

  test("preserves legal-policy and reviewed institutional bytes", () => {
    const legalPolicyFiles = filesUnder(join(ROOT, "corpora/legal-policy"));
    expect(legalPolicyFiles).toHaveLength(138);
    expect(treeHash(legalPolicyFiles)).toBe(
      "362adc02793a0dd125ce9adf9bf15a5e37c00c648797bc4b01210b577820c72e",
    );
    expect(fileHash(join(NIST, "records.writ"))).toBe(
      "4175b725d2dc0212a218626165cf7a639727667d7c9c872acc2a77107a76a632",
    );
    expect(fileHash(join(NIST, "judgments.writ"))).toBe(
      "1d661df564dbb640b8d83a11ec3f50fc24cb10b692ae3f28d3bcc19a94f0b4c1",
    );
    expect(fileHash(join(EC, "records.writ"))).toBe(
      "8d139e2d50b6c9237fe05132a09edde189fe3134a956c95da57b806b4289dc3d",
    );
    expect(fileHash(join(EC, "judgments.writ"))).toBe(
      "e23481a97107b66d8a6c981270815b3fc560c6b4c158a64fbf611272c96fed1e",
    );
  });
});
