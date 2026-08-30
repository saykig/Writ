import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validate,
  validateJudgmentSupersession,
  type CurrentRecordJudgment,
  type InstitutionalOperationalCapacity,
  type RecordLink,
  type WritRecord,
} from "@writ/domain";
import { compileSource, formatText } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const NIST = join(ROOT, "corpora/institutional/us/nist");
const EC = join(ROOT, "corpora/institutional/eu/european-commission");
const read = (root: string, path: string): string => readFileSync(join(root, path), "utf8");
const yaml = <T>(root: string, path: string): T => Bun.YAML.parse(read(root, path)) as T;
const compile = (root: string, path: string) =>
  compileSource(read(root, path), { fileName: join(root, path) });

const nist = compile(NIST, "records.writ");
const commission = compile(EC, "records.writ");
const nistJudgments = compile(NIST, "judgments.writ").judgments as CurrentRecordJudgment[];
const commissionJudgments = compile(EC, "judgments.writ").judgments as CurrentRecordJudgment[];
interface TestRecord extends WritRecord {
  [key: string]: unknown;
  institution_id?: string;
  institution_type?: string;
  institutional_fact_type?: string;
  parent_institution_id?: string;
  mission?: unknown;
  mandate?: unknown;
  function?: unknown;
  decision_right?: unknown;
  operational_capacity?: InstitutionalOperationalCapacity;
}

interface CorpusManifest {
  status: string;
  record_counts: Record<string, number>;
  review_counts: Record<string, number>;
}

interface MigrationEntry {
  previous_object: string | null;
  final_object: string;
}

interface MigrationLedger {
  entries: MigrationEntry[];
}

interface CapacityAuditSupport {
  value?: string;
  passage: string;
  exact_fragment: string;
}

interface CapacityEvidenceAudit {
  records: Record<
    string,
    {
      status: CapacityAuditSupport;
      capacity_type: CapacityAuditSupport;
      capacity_components: Record<string, CapacityAuditSupport>;
    }
  >;
}

interface ReviewQueue {
  queue_id: string;
  status: string;
  human_approval_artifact_found: boolean;
  human_review_artifact: string;
  schema_queues: Record<
    string,
    Array<{
      target_id: string;
      judgment_id: string;
      evidence_passages: string[];
      source_currency?: string;
      proposed_holder?: string;
      implementing_unit_in_scope?: string;
    }>
  >;
  omitted_candidates: Array<{ target_id: string; status: string; human_decision: string }>;
}

interface HumanReview {
  reviewer: string;
  review_type: string;
  review_date: string;
  queue_id: string;
  status: string;
  summary: {
    active_targets_reviewed: number;
    active_targets_approved: number;
    omitted_candidates_approved_for_omission: number;
  };
  approved_revisions: {
    id_renames: Array<{ previous_draft_id: string; approved_id: string }>;
    nist_ai_measurement_capacity: {
      institution_id: string;
      institutional_scope_includes: string;
      capacity_type: string;
      capacity_components: string[];
    };
  };
  decisions: Array<{
    target_id: string;
    judgment_id: string;
    evidence_passages: string[];
    reviewed_components: string[];
    human_decision: string;
  }>;
  omission_decision: { target_id: string; human_decision: string };
  olrc_source_verification: {
    direct_retrieval_result: string;
    stored_capture_sha256: string;
    selected_passage_sha256: string;
    verification: {
      substantive_olrc_content_byte_identical: boolean;
      selected_passage_byte_identical: boolean;
    };
  };
}

interface SanitizationLedger {
  transformation_rule: { replacement: string; replacement_count_per_file: number };
  verification: {
    all_non_document_hash_record_content_identical: boolean;
    all_evidence_quotations_byte_identical: boolean;
    selected_evidence_intersections: number;
  };
  affected_files: Array<{
    file: string;
    source_url: string;
    retrieved_at: string;
    pre_sanitization_sha256: string;
    post_sanitization_sha256: string;
    selected_evidence_passages: string[];
    selected_evidence_passage_hashes: Record<string, string>;
    selected_evidence_intersected_redaction: boolean;
    evidence_quotations_byte_identical: boolean;
    substantive_source_content_unchanged: boolean;
  }>;
}

interface StructuredSourceMetadata {
  sourceId: string;
  documentVersionId: string;
  uri: string;
  mediaType: string;
  retrievedAt: string;
  documentHash: string;
  sourceVersion: string;
  sourceDate: string;
}

function structuredSources(root: string): Map<string, StructuredSourceMetadata> {
  const text = read(root, "sources.writ");
  const result = new Map<string, StructuredSourceMetadata>();
  const documentVersions = new Map(
    [...text.matchAll(/concept\s+\S+\s*\{([\s\S]*?)\}/g)]
      .map((match) => match[1]!)
      .filter((block) => block.includes("document_version_id"))
      .map((block) => {
        const sourceId = /source_id\s+([^;]+);/.exec(block)?.[1]?.trim();
        const documentVersionId = /document_version_id\s+([^;]+);/.exec(block)?.[1]?.trim();
        if (!sourceId || !documentVersionId) {
          throw new Error("Incomplete structured document-version identity");
        }
        return [sourceId, documentVersionId] as const;
      }),
  );
  const pairs = text.matchAll(/source\s+\S+\s*\{([\s\S]*?)\}\s*concept\s+\S+\s*\{([\s\S]*?)\}/g);
  const quoted = (block: string, key: string): string => {
    const value = new RegExp(`${key}\\s+"([^"]+)";`).exec(block)?.[1];
    if (!value) throw new Error(`Missing ${key} in structured source metadata`);
    return value;
  };
  const bare = (block: string, key: string): string => {
    const value = new RegExp(`${key}\\s+([^;]+);`).exec(block)?.[1]?.trim();
    if (!value) throw new Error(`Missing ${key} in structured source metadata`);
    return value;
  };
  for (const pair of pairs) {
    const source = pair[1]!;
    const concept = pair[2]!;
    const sourceId = bare(concept, "source_id");
    const metadata: StructuredSourceMetadata = {
      sourceId,
      documentVersionId: documentVersions.get(sourceId) ?? "",
      uri: quoted(source, "uri"),
      mediaType: quoted(source, "media_type"),
      retrievedAt: bare(source, "retrieved"),
      documentHash: quoted(source, "sha256"),
      sourceVersion: quoted(concept, "source_version"),
      sourceDate: bare(concept, "source_date"),
    };
    if (result.has(metadata.sourceId)) throw new Error(`Duplicate source ${metadata.sourceId}`);
    result.set(metadata.sourceId, metadata);
  }
  return result;
}

const allRecords = [...nist.records, ...commission.records] as TestRecord[];
const byId = new Map(allRecords.map((record) => [record.record_id, record]));
const manifest = (root: string) => yaml<CorpusManifest>(root, "corpus.yaml");

const NIST_STAGE_B_IDS = [
  "nist_national_measurement_standards_mandate",
  "nist_nvlap_lab_decision_right",
  "nist_ai_standards_group_identity",
  "nist_ai_standards_group_placement",
  "nist_lab_network_capacity",
  "nist_aml_facility_capacity",
  "nist_nvlap_accred_capacity",
  "nist_ai_measurement_capacity",
  "nist_ai_consortium_capacity",
] as const;
const NIST_LAB_NETWORK_CURRENT_ID = "nist_lab_network_capacity_v2";
const NIST_FOLLOW_UP_SUCCESSOR_IDS = [
  NIST_LAB_NETWORK_CURRENT_ID,
  "nist_ai_standards_group_placement_v2",
  "nist_aml_facility_capacity_v2",
  "nist_ai_measurement_function",
] as const;
const NIST_FOLLOW_UP_LINK_IDS = [
  "nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity",
  "nist_ai_standards_group_placement_v2_supersedes_nist_ai_standards_group_placement",
  "nist_aml_facility_capacity_v2_supersedes_nist_aml_facility_capacity",
  "nist_ai_measurement_function_supersedes_nist_ai_measurement_capacity",
] as const;
const COMMISSION_FOLLOW_UP_SUCCESSOR_IDS = [
  "european_commission_identity_v2",
  "eu_ai_office_placement_v2",
  "european_commission_jrc_infra_capacity_v2",
  "eu_ai_office_gp_ai_enforcement_mandate_v2",
] as const;
const COMMISSION_FOLLOW_UP_LINK_IDS = [
  "european_commission_identity_v2_supersedes_european_commission_identity",
  "eu_ai_office_placement_v2_supersedes_eu_ai_office_placement",
  "european_commission_jrc_infra_capacity_v2_supersedes_european_commission_jrc_infra_capacity",
  "eu_ai_office_gp_ai_enforcement_mandate_v2_supersedes_eu_ai_office_gp_ai_enforcement_mandate",
] as const;
const COMMISSION_BASELINE_IDS = [
  "eu_ai_office_tech_doc_receipt",
  "eu_ai_office_training_sum_temp_function",
  "eu_ai_office_serious_incident_report_receipt",
] as const;
const POST_REVIEW_TARGET_RENAMES = new Map<string, string>([
  ["eu_ai_office_technical_documentation_receipt", "eu_ai_office_tech_doc_receipt"],
]);
const STAGE_B_APPROVED_TARGET_RENAMES = new Map<string, string>([
  ["eu_ai_office_training_summary_template_function", "eu_ai_office_training_sum_temp_function"],
  ["european_commission_budget_management_function", "european_commission_budget_mgmt_function"],
  ["european_commission_reasoned_opinion_function", "european_commission_reasoned_op_function"],
  [
    "european_commission_cjeu_referral_decision_right",
    "european_commission_cjeu_refer_decision_right",
  ],
  ["nist_laboratory_network_capacity", "nist_lab_network_capacity"],
  ["nist_nvlap_accreditation_capacity", "nist_nvlap_accred_capacity"],
]);
const APPROVED_TARGET_RENAMES = new Map<string, string>([
  ...POST_REVIEW_TARGET_RENAMES,
  ...STAGE_B_APPROVED_TARGET_RENAMES,
]);
const SUPERSEDED_DRAFT_TARGET_IDS = [...STAGE_B_APPROVED_TARGET_RENAMES.keys()];
const EXCLUDED = [
  "nist_workforce_capacity",
  "nist_budget_capacity",
  "nist_ai_budget_capacity",
  "nist_facilities_degraded_capacity",
  "nist_operational_status",
  "nist_ai_standards_group_mission",
  "nist_director_internal_supervision_decision_right",
  "nist_director_public_bulletin_issuance_decision_right",
  "european_commission_placement",
  "european_commission_workforce_capacity",
  "european_commission_budget_capacity",
  "european_commission_generic_operational_status",
  "eu_ai_office_workforce_capacity",
  "jrc_facility_condition_capacity",
  "dg_connect_identity",
  "dg_connect_placement",
  "eu_ai_office_model_eval_capacity",
  "european_commission_reasoned_opinion_decision_right",
] as const;

function record(id: string): TestRecord {
  const value = byId.get(id);
  expect(value, `${id} must resolve`).toBeDefined();
  return value as TestRecord;
}

function capacityRecord(
  id: string,
): TestRecord & { operational_capacity: InstitutionalOperationalCapacity } {
  const value = record(id);
  expect(value.operational_capacity, `${id} must carry operational capacity`).toBeDefined();
  return value as TestRecord & { operational_capacity: InstitutionalOperationalCapacity };
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

describe("Stage B production inventories", () => {
  test("both corpora compile and validate under one active contract", () => {
    for (const result of [nist, commission]) {
      expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
      expect(result.schemaValid).toBe(true);
      for (const target of result.records) {
        expect(validate("institutional-record", target).valid).toBe(true);
      }
    }
  });

  test("NIST preserves six Stage A and nine Stage B records plus reviewed successors", () => {
    expect(nist.records).toHaveLength(19);
    expect(NIST_STAGE_B_IDS.every((id) => byId.has(id))).toBe(true);
    expect(new Set(NIST_STAGE_B_IDS).size).toBe(9);
    expect(NIST_FOLLOW_UP_SUCCESSOR_IDS.every((id) => byId.has(id))).toBe(true);
    expect(manifest(NIST).record_counts).toEqual({
      institutional_records: 19,
      record_links: 6,
      disposition_judgments: 25,
    });
    expect(manifest(NIST).review_counts).toEqual({
      approved_records: 14,
      superseded_records: 5,
      draft_records: 0,
      approved_record_links: 6,
      accepted_disposition_judgments: 21,
      proposed_disposition_judgments: 0,
      superseded_disposition_judgments: 4,
    });
  });

  test("the lab-network correction changes only identity, assertion, provenance, and review state", () => {
    const historical = capacityRecord("nist_lab_network_capacity");
    const current = capacityRecord(NIST_LAB_NETWORK_CURRENT_ID);
    const {
      record_id: historicalId,
      assertion: historicalAssertion,
      provenance: historicalProvenance,
      review_state: historicalReviewState,
      ...historicalStable
    } = historical;
    const {
      record_id: currentId,
      assertion: currentAssertion,
      provenance: currentProvenance,
      review_state: currentReviewState,
      ...currentStable
    } = current;

    expect(historicalId).toBe("nist_lab_network_capacity");
    expect(historicalAssertion.text).toBe(
      "NIST conducts its principal research through six laboratory components and associated user facilities.",
    );
    expect(historicalProvenance).toEqual({
      created_by: "OpenAI Codex automated proposal",
      created_at: "2026-08-05",
    });
    expect(historicalReviewState).toBe("superseded");
    expect(currentId).toBe(NIST_LAB_NETWORK_CURRENT_ID);
    expect(currentAssertion).toEqual({
      mode: "observes",
      text: "NIST conducts its research through six laboratory components and associated user facilities.",
    });
    expect(currentProvenance).toEqual({
      created_by: "OpenAI Codex implementation of approved human review",
      created_at: "2026-08-29",
    });
    expect(currentReviewState).toBe("approved");
    expect(currentStable).toEqual(historicalStable);

    const link = yaml<RecordLink>(
      NIST,
      "relationships/nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity.yaml",
    );
    expect(link).toMatchObject({
      source_id: NIST_LAB_NETWORK_CURRENT_ID,
      target_id: "nist_lab_network_capacity",
      source_kind: "record",
      target_kind: "record",
      relation_type: "supersedes",
      evidence_refs: ["nist.laboratories.six_labs"],
      review_state: "approved",
    });
    expect(validate("record-link", link).valid).toBe(true);
  });

  test("the placement successor preserves the claim while exposing inferred support", () => {
    const historical = record("nist_ai_standards_group_placement");
    const current = record("nist_ai_standards_group_placement_v2");
    const {
      record_id: historicalId,
      evidence: historicalEvidence,
      provenance: historicalProvenance,
      review_state: historicalReviewState,
      ...historicalStable
    } = historical;
    const {
      record_id: currentId,
      evidence: currentEvidence,
      provenance: currentProvenance,
      review_state: currentReviewState,
      ...currentStable
    } = current;
    const withoutBasis = (items: typeof historicalEvidence) =>
      items.map(({ basis: _basis, ...item }) => item);

    expect(historicalId).toBe("nist_ai_standards_group_placement");
    expect(currentId).toBe("nist_ai_standards_group_placement_v2");
    expect(historicalReviewState).toBe("superseded");
    expect(currentReviewState).toBe("approved");
    expect(currentStable).toEqual(historicalStable);
    expect(withoutBasis(currentEvidence)).toEqual(withoutBasis(historicalEvidence));
    expect(historicalEvidence.map((item) => item.basis)).toEqual(["direct", "direct"]);
    expect(currentEvidence.map((item) => item.basis)).toEqual(["inferred", "inferred"]);
    expect(historicalProvenance).toEqual({
      created_by: "OpenAI Codex automated proposal",
      created_at: "2026-08-05",
    });
    expect(currentProvenance).toEqual({
      created_by: "OpenAI Codex implementation of approved human review",
      created_at: "2026-08-29",
    });
  });

  test("the AML successor changes only its identity, assertion, provenance, and review state", () => {
    const historical = capacityRecord("nist_aml_facility_capacity");
    const current = capacityRecord("nist_aml_facility_capacity_v2");
    const {
      record_id: historicalId,
      assertion: historicalAssertion,
      provenance: historicalProvenance,
      review_state: historicalReviewState,
      ...historicalStable
    } = historical;
    const {
      record_id: currentId,
      assertion: currentAssertion,
      provenance: currentProvenance,
      review_state: currentReviewState,
      ...currentStable
    } = current;

    expect(historicalId).toBe("nist_aml_facility_capacity");
    expect(historicalAssertion.text).toContain("NIST maintains");
    expect(historicalReviewState).toBe("superseded");
    expect(currentId).toBe("nist_aml_facility_capacity_v2");
    expect(currentAssertion).toEqual({
      mode: "observes",
      text: "The Advanced Measurement Laboratory complex features laboratories with electromagnetic shielding, vibration isolation, and environmental control of temperature, humidity, and air quality, together with two underground metrology wings, two above-ground physical-sciences wings, and an above-ground cleanroom wing.",
    });
    expect(currentAssertion.text).not.toContain("maintains");
    expect(currentReviewState).toBe("approved");
    expect(currentStable).toEqual(historicalStable);
    expect(historicalProvenance).toEqual({
      created_by: "OpenAI Codex automated proposal",
      created_at: "2026-08-05",
    });
    expect(currentProvenance).toEqual({
      created_by: "OpenAI Codex implementation of approved human review",
      created_at: "2026-08-29",
    });
  });

  test("the AI measurement successor is one directly supported atomic function", () => {
    const historical = capacityRecord("nist_ai_measurement_capacity");
    const current = record("nist_ai_measurement_function");

    expect(historical.review_state).toBe("superseded");
    expect(historical.evidence.map((item) => item.passage_id)).toEqual([
      "nist.ai_division.capacity",
      "nist.ai_division.groups",
    ]);
    expect(current).toMatchObject({
      record_id: "nist_ai_measurement_function",
      review_state: "approved",
      institution_id: "nist.ai_research_measurement_standards_division",
      institutional_fact_type: "function",
      function: "measurement_science",
      assertion: {
        mode: "performs",
        text: "The AI Research, Measurement, and Standards Division advances measurement science related to AI, testing and evaluation, and standards.",
      },
    });
    expect(current.operational_capacity).toBeUndefined();
    expect(current.evidence).toEqual([historical.evidence[0]!]);
    expect(current.evidence[0]?.basis).toBe("direct");
    expect(current.uncertainties).toEqual(historical.uncertainties);
    expect(current.scope.institutional_scope).toEqual([
      "nist",
      "nist.ai_research_measurement_standards_division",
    ]);
    expect(current.assertion.text).not.toContain("AI Standards and Guidelines Group");
    expect(current.assertion.text).not.toContain("Applied AI Research Group");
    expect(record("nist_ai_standards_group_identity").evidence[0]).toEqual(historical.evidence[1]!);
  });

  test("Commission preserves its history and has 20 active human-approved records", () => {
    expect(commission.records).toHaveLength(24);
    for (const id of COMMISSION_BASELINE_IDS) expect(record(id).review_state).toBe("approved");
    const baselineIds = new Set<string>(COMMISSION_BASELINE_IDS);
    expect(commission.records.filter((item) => !baselineIds.has(item.record_id))).toHaveLength(21);
    expect(new Set(commission.records.map((item) => item.record_id)).size).toBe(24);
    expect(commission.records.filter((item) => item.review_state === "approved")).toHaveLength(20);
    expect(commission.records.filter((item) => item.review_state === "superseded")).toHaveLength(4);
    expect(COMMISSION_FOLLOW_UP_SUCCESSOR_IDS.every((id) => byId.has(id))).toBe(true);
    expect(manifest(EC).record_counts).toEqual({
      institutional_records: 24,
      record_links: 9,
      disposition_judgments: 36,
    });
    expect(manifest(EC).review_counts).toEqual({
      approved_records: 20,
      superseded_records: 4,
      draft_records: 0,
      approved_record_links: 8,
      draft_record_links: 0,
      accepted_disposition_judgments: 28,
      proposed_disposition_judgments: 0,
      superseded_disposition_judgments: 8,
    });
  });

  test("the Commission identity successor uses a self-sufficient exact source version", () => {
    const historical = record("european_commission_identity");
    const current = record("european_commission_identity_v2");
    expect(historical.review_state).toBe("superseded");
    expect(historical.evidence[0]).toMatchObject({
      source_id: "eu.teu_article_13",
      document_version_id: "eu.teu_article_13.v2026_08_05",
      passage_id: "eu.teu_article_13.commission",
      document_hash: "sha256:2e730cdff0b3c14eb51f1b0ce2fd67d88f4b99c51501424ed53b565dd968ac37",
    });
    expect(current).toMatchObject({
      review_state: "approved",
      institutional_fact_type: "identity",
      institution_id: "european_commission",
      institution_type: "supranational_institution",
      assertion: {
        mode: "defines",
        text: "The European Commission is an institution of the European Union.",
      },
    });
    expect(current.evidence).toHaveLength(1);
    expect(current.evidence[0]).toMatchObject({
      source_id: "eu.teu_article_13.official_html",
      document_version_id:
        "eu.teu_article_13.official_html.sha256_69e5c3f35d1539aadd39189b6166aa263b6c481d7f5c98e76f5b3bf16cee3222",
      passage_id: "eu.teu_article_13.official_html.institutional_list",
      document_hash: "sha256:69e5c3f35d1539aadd39189b6166aa263b6c481d7f5c98e76f5b3bf16cee3222",
      basis: "direct",
    });
    expect(current.evidence[0]!.quote).toContain("The Union's institutions shall be:");
    expect(current.evidence[0]!.quote).toContain("- the European Commission");
    expect(current.provenance).toEqual({
      created_by: "OpenAI Codex implementation of approved human review",
      created_at: "2026-08-30",
    });
  });

  test("the AI Office placement successor states only the direct DG CONNECT placement", () => {
    const historical = record("eu_ai_office_placement");
    const current = record("eu_ai_office_placement_v2");
    expect(historical.review_state).toBe("superseded");
    expect(current).toMatchObject({
      review_state: "approved",
      institutional_fact_type: "placement",
      institution_id: "eu_ai_office",
      parent_institution_id: "european_commission.dg_connect",
      assertion: {
        mode: "states",
        text: "The European Artificial Intelligence Office is part of the administrative structure of the Directorate-General for Communication Networks, Content and Technology.",
      },
    });
    expect(current.assertion.text).not.toContain("European Commission’s");
    expect(current.assertion.text).not.toContain("Communications Networks");
    expect(current.evidence[0]).toEqual(historical.evidence[0]);
    expect(current.evidence[1]).toMatchObject({
      passage_id: "eu.commission_decision_c_2024_1459.recital_6",
      basis: "direct",
    });
  });

  test("the JRC capacity successor changes the holder without changing its machinery", () => {
    const historical = capacityRecord("european_commission_jrc_infra_capacity");
    const current = capacityRecord("european_commission_jrc_infra_capacity_v2");
    expect(historical.review_state).toBe("superseded");
    expect(current.review_state).toBe("approved");
    expect(current.institution_id).toBe("european_commission.joint_research_centre");
    expect(current.subjects).toEqual([
      {
        subject_id: "european_commission.joint_research_centre",
        subject_type: "organizational_unit",
        role: "infrastructure maintainer",
      },
    ]);
    expect(current.scope.institutional_scope).toEqual([
      "european_commission.joint_research_centre",
    ]);
    expect(current.evidence).toEqual(historical.evidence);
    expect(current.operational_capacity).toEqual(historical.operational_capacity);
    expect(current.assertion.text).toContain("The Joint Research Centre maintains");
    expect(current.assertion.text).not.toContain("European Commission maintains");
  });

  test("the GPAI mandate successor removes only the uncited authority source", () => {
    const historical = record("eu_ai_office_gp_ai_enforcement_mandate");
    const current = record("eu_ai_office_gp_ai_enforcement_mandate_v2");
    expect(historical.review_state).toBe("superseded");
    expect(current.review_state).toBe("approved");
    expect(current.assertion).toEqual(historical.assertion);
    expect(current.evidence).toEqual(historical.evidence);
    expect(current.uncertainties).toEqual(historical.uncertainties);
    const { authority_source_ids: _historicalAuthoritySources, ...historicalMandate } =
      historical.mandate as Record<string, unknown>;
    expect(current.mandate).toEqual({
      ...historicalMandate,
      authority_source_ids: ["eu_ai_act_2024_1689"],
    });
  });

  test("both corpus workflow states remain draft", () => {
    expect(manifest(NIST).status).toBe("draft");
    expect(manifest(EC).status).toBe("draft");
  });
});

describe("atomic institutional distinctions", () => {
  const expected = new Map<string, string>([
    ["nist_national_measurement_standards_mandate", "mandate"],
    ["nist_nvlap_lab_decision_right", "decision_right"],
    ["nist_ai_standards_group_identity", "identity"],
    ["nist_ai_standards_group_placement_v2", "placement"],
    ["nist_ai_measurement_function", "function"],
    ["european_commission_identity_v2", "identity"],
    ["eu_ai_office_identity", "identity"],
    ["eu_ai_office_placement_v2", "placement"],
    ["european_commission_mission", "mission"],
    ["eu_ai_office_mission", "mission"],
    ["european_commission_union_law_mandate", "mandate"],
    ["eu_ai_office_gp_ai_enforcement_mandate_v2", "mandate"],
    ["european_commission_legislative_proposal_function", "function"],
    ["european_commission_budget_mgmt_function", "function"],
    ["eu_ai_office_model_eval_function", "function"],
    ["european_commission_reasoned_op_function", "function"],
    ["european_commission_cjeu_refer_decision_right", "decision_right"],
    ["european_commission_gp_ai_fine_decision_right", "decision_right"],
    ["eu_ai_office_model_eval_decision_right", "decision_right"],
  ]);
  const payloads = [
    "institution_type",
    "parent_institution_id",
    "mission",
    "mandate",
    "function",
    "decision_right",
    "operational_capacity",
    "record_link",
  ];
  const allowed: Record<string, string> = {
    identity: "institution_type",
    placement: "parent_institution_id",
    mission: "mission",
    mandate: "mandate",
    function: "function",
    decision_right: "decision_right",
    operational_capacity: "operational_capacity",
  };

  test("every reviewed fact carries only its fact-specific payload", () => {
    for (const [id, factType] of expected) {
      const target = record(id);
      expect(target.institutional_fact_type).toBe(factType);
      for (const payload of payloads) {
        expect(target[payload] !== undefined, `${id}:${payload}`).toBe(
          payload === allowed[factType],
        );
      }
    }
  });

  test("decision rights attach directly to an institution without holder hierarchy", () => {
    const rights = allRecords.filter((item) => item.institutional_fact_type === "decision_right");
    expect(rights).toHaveLength(4);
    for (const target of rights) {
      expect(target.institution_id).toBeTruthy();
      expect(target).not.toHaveProperty("holder_id");
      expect(target).not.toHaveProperty("holder_kind");
      expect(JSON.stringify(target)).not.toContain("nist.director");
    }
  });

  test("model evaluation function and right remain while unsupported capacity is omitted", () => {
    expect(record("eu_ai_office_model_eval_function").institutional_fact_type).toBe("function");
    expect(record("eu_ai_office_model_eval_decision_right").institutional_fact_type).toBe(
      "decision_right",
    );
    expect(byId.has("eu_ai_office_model_eval_capacity")).toBe(false);
  });

  test("placement payloads name the directly evidenced immediate parent", () => {
    expect(record("nist_ai_standards_group_placement_v2").parent_institution_id).toBe(
      "nist.ai_research_measurement_standards_division",
    );
    expect(record("eu_ai_office_placement_v2").parent_institution_id).toBe(
      "european_commission.dg_connect",
    );
  });

  test("NIST AI measurement work remains a function rather than capacity", () => {
    const target = record("nist_ai_measurement_function");
    expect(target.institution_id).toBe("nist.ai_research_measurement_standards_division");
    expect(target.scope.institutional_scope).toEqual([
      "nist",
      "nist.ai_research_measurement_standards_division",
    ]);
    expect(target.function).toBe("measurement_science");
    expect(target.operational_capacity).toBeUndefined();
  });

  test("Article 258 mandatory modality is preserved as a human-approved function", () => {
    const target = record("european_commission_reasoned_op_function");
    expect(target.institutional_fact_type).toBe("function");
    expect(target.assertion.text).toContain("requires the Commission to deliver");
    expect(target.evidence[0]?.quote).toContain("it shall deliver a reasoned opinion");
  });

  test("the NVLAP determination and program machinery remain separate", () => {
    expect(record("nist_nvlap_lab_decision_right").decision_right).toBeDefined();
    expect(record("nist_nvlap_lab_decision_right").operational_capacity).toBeUndefined();
    expect(record("nist_nvlap_accred_capacity").operational_capacity).toBeDefined();
    expect(record("nist_nvlap_accred_capacity").decision_right).toBeUndefined();
  });

  test("all excluded records and intermediate profiles are absent", () => {
    for (const id of EXCLUDED) expect(byId.has(id)).toBe(false);
    expect(allRecords.some((item) => item.record_id.includes("director"))).toBe(false);
    expect(
      allRecords.some(
        (item) => item.record_id.startsWith("itl_") || item.record_id.startsWith("dg_connect"),
      ),
    ).toBe(false);
  });
});

describe("operational-capacity contract", () => {
  const capacities = allRecords.filter(
    (item): item is TestRecord & { operational_capacity: InstitutionalOperationalCapacity } =>
      item.institutional_fact_type === "operational_capacity" &&
      item.operational_capacity !== undefined &&
      item.review_state !== "superseded",
  );

  test("four NIST and three Commission capacities use one controlled type and direct evidence", () => {
    expect(capacities).toHaveLength(7);
    expect(capacities.filter((item) => item.corpus_id === "us.institutions.nist")).toHaveLength(4);
    expect(
      capacities.filter((item) => item.corpus_id === "eu.institutions.european_commission"),
    ).toHaveLength(3);
    for (const target of capacities) {
      expect(typeof target.operational_capacity.capacity_type).toBe("string");
      expect(target.operational_capacity.status).toBe("active");
      expect(target.operational_capacity.evidence_refs.length).toBeGreaterThan(0);
      expect(target.evidence.every((item) => item.basis === "direct")).toBe(true);
      expect(target.uncertainties.length).toBeGreaterThan(0);
      expect(target.mission).toBeUndefined();
      expect(target.mandate).toBeUndefined();
      expect(target.decision_right).toBeUndefined();
    }
  });

  test("unknown vocabulary, duplicate components, and unqualified quantities fail", () => {
    const identity = structuredClone(record("european_commission_identity_v2"));
    identity.institution_type = "unknown_new_type";
    expect(validate("institutional-record", identity).valid).toBe(false);
    const base = structuredClone(capacityRecord(NIST_LAB_NETWORK_CURRENT_ID));
    (base.operational_capacity as unknown as Record<string, unknown>).capacity_type =
      "unknown_capacity";
    expect(validate("institutional-record", base).valid).toBe(false);
    const status = structuredClone(capacityRecord(NIST_LAB_NETWORK_CURRENT_ID));
    (status.operational_capacity as unknown as Record<string, unknown>).status = "established";
    expect(validate("institutional-record", status).valid).toBe(false);
    const duplicate = structuredClone(capacityRecord(NIST_LAB_NETWORK_CURRENT_ID));
    duplicate.operational_capacity.capacity_components = [
      "engineering_laboratory",
      "engineering_laboratory",
    ];
    expect(validate("institutional-record", duplicate).valid).toBe(false);
    const quantity = structuredClone(capacityRecord(NIST_LAB_NETWORK_CURRENT_ID));
    quantity.operational_capacity.quantity = {
      value: 6,
      unit: "laboratory_components",
      qualifier: "exact",
    };
    expect(validate("institutional-record", quantity).valid).toBe(false);
    const qualifier = structuredClone(capacityRecord(NIST_LAB_NETWORK_CURRENT_ID));
    qualifier.operational_capacity.as_of_date = "2026-08-05";
    qualifier.operational_capacity.quantity = {
      value: 6,
      unit: "laboratory_components",
      qualifier: "exact",
    };
    (qualifier.operational_capacity.quantity as unknown as Record<string, unknown>).qualifier =
      "at_least";
    expect(validate("institutional-record", qualifier).valid).toBe(false);
  });

  test("every populated capacity field and component has exact cited passage support", () => {
    const audit = yaml<CapacityEvidenceAudit>(
      ROOT,
      "docs/migrations/institutional-stage-b/capacity-evidence-audit.yaml",
    );
    const auditRecordId = (recordId: string) => {
      if (recordId === NIST_LAB_NETWORK_CURRENT_ID) return "nist_lab_network_capacity";
      if (recordId === "nist_aml_facility_capacity_v2") return "nist_aml_facility_capacity";
      if (recordId === "european_commission_jrc_infra_capacity_v2")
        return "european_commission_jrc_infra_capacity";
      return recordId;
    };
    expect(Object.keys(audit.records).sort()).toEqual(
      [
        ...capacities.map((item) => auditRecordId(item.record_id)),
        "nist_ai_measurement_capacity",
      ].sort(),
    );
    for (const target of capacities) {
      const mapping = audit.records[auditRecordId(target.record_id)]!;
      const evidence = new Map(target.evidence.map((item) => [item.passage_id, item.quote]));
      expect(mapping.status.value).toBe(target.operational_capacity.status);
      expect(mapping.capacity_type.value).toBe(target.operational_capacity.capacity_type);
      for (const support of [mapping.status, mapping.capacity_type]) {
        expect(target.operational_capacity.evidence_refs).toContain(support.passage);
        expect(evidence.get(support.passage), `${target.record_id}:${support.passage}`).toContain(
          support.exact_fragment,
        );
      }
      expect(Object.keys(mapping.capacity_components).sort()).toEqual(
        [...(target.operational_capacity.capacity_components ?? [])].sort(),
      );
      for (const [component, support] of Object.entries(mapping.capacity_components)) {
        expect(target.operational_capacity.evidence_refs, component).toContain(support.passage);
        expect(evidence.get(support.passage), `${target.record_id}:${component}`).toContain(
          support.exact_fragment,
        );
      }
      expect(target.operational_capacity.as_of_date).toBeUndefined();
      expect(target.operational_capacity.quantity).toBeUndefined();
    }
  });

  test("a stated function and its evidence cannot stand in for a capacity payload", () => {
    const functionOnly = structuredClone(record("eu_ai_office_model_eval_function"));
    functionOnly.institutional_fact_type = "operational_capacity";
    delete functionOnly.function;
    expect(validate("institutional-record", functionOnly).valid).toBe(false);
  });

  test("federal, supranational, and organizational-unit types remain distinct", () => {
    expect(record("nist_identity").institution_type).toBe("federal_agency");
    expect(record("european_commission_identity_v2").institution_type).toBe(
      "supranational_institution",
    );
    expect(record("nist_ai_standards_group_identity").institution_type).toBe("organizational_unit");
    expect(record("eu_ai_office_identity").institution_type).toBe("organizational_unit");
  });

  test("different institutional forms retain distinct components and ownership boundaries", () => {
    const nistLabs = capacityRecord(NIST_LAB_NETWORK_CURRENT_ID).operational_capacity;
    const jrc = capacityRecord("european_commission_jrc_infra_capacity_v2").operational_capacity;
    expect(nistLabs.capacity_type).toBe(jrc.capacity_type);
    expect(nistLabs.capacity_components).not.toEqual(jrc.capacity_components);
    expect(record("nist_ai_consortium_capacity").uncertainties[0]!.description).toContain(
      "not resources owned",
    );
    expect(record("eu_ai_office_cooperation_capacity").uncertainties[0]!.description).toContain(
      "not resources owned",
    );
  });

  test("the production capacity syntax formats and round-trips without loss", () => {
    for (const root of [NIST, EC]) {
      const source = read(root, "records.writ");
      const formatted = formatText(source);
      expect(formatText(formatted)).toBe(formatted);
      const first = compileSource(source);
      const second = compileSource(formatted);
      expect(second.records).toEqual(first.records);
      expect(second.schemaValid).toBe(true);
    }
  });
});

describe("review preservation, judgments, links, and migrations", () => {
  test("the three Commission baseline records retain content and provenance across approval", () => {
    const inventory = JSON.parse(
      readFileSync(
        join(ROOT, "docs/migrations/institutional-stage-b/pre-implementation-inventory.json"),
        "utf8",
      ),
    );
    for (const prior of inventory.european_commission_baseline.records) {
      const current = record(APPROVED_TARGET_RENAMES.get(prior.record_id) ?? prior.record_id);
      expect(current.assertion).toEqual(prior.assertion);
      expect(current.provenance).toEqual(prior.provenance);
      expect(prior.review_state).toBe("draft");
      expect(current.review_state).toBe("approved");
      const source = read(EC, "records.writ");
      expect(source).toContain(prior.evidence);
      expect(source).toContain(prior.subjects);
      expect(source).toContain(prior.scope);
    }
  });

  test("judgments preserve all superseded decisions and approve each reviewed successor", () => {
    expect(nistJudgments).toHaveLength(25);
    expect(commissionJudgments).toHaveLength(30);
    const commissionLinkIds = [
      "eu_ai_office_european_commission_relationship",
      "eu_ai_office_european_commission_relationship_v2",
      ...COMMISSION_FOLLOW_UP_LINK_IDS,
    ];
    for (const judgment of [...nistJudgments, ...commissionJudgments]) {
      expect(validate("record-judgment", judgment).valid).toBe(true);
      if (judgment.target_kind === "record") expect(byId.has(judgment.target_id)).toBe(true);
      else
        expect([
          "nist_department_of_commerce_relationship",
          ...NIST_FOLLOW_UP_LINK_IDS,
          "nist_mission_supersedes_nist_measurement_science_function",
          ...commissionLinkIds,
        ]).toContain(judgment.target_id);
    }

    const chains = [
      {
        originalJudgment: "judgment_nist_lab_network_capacity_stage_b",
        originalRecord: "nist_lab_network_capacity",
        correctionJudgment: "judgment_nist_lab_network_capacity_v2_human_review",
        correctionRecord: NIST_LAB_NETWORK_CURRENT_ID,
        linkJudgment: "judgment_nist_lab_network_capacity_v2_supersession_link_human_review",
        link: "nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity",
        rationale:
          "The cited passage establishes six NIST labs and user facilities but does not establish that they are NIST’s principal or primary facilities.",
      },
      {
        originalJudgment: "judgment_nist_ai_standards_group_placement_stage_b",
        originalRecord: "nist_ai_standards_group_placement",
        correctionJudgment: "judgment_nist_ai_standards_group_placement_v2_human_review",
        correctionRecord: "nist_ai_standards_group_placement_v2",
        linkJudgment:
          "judgment_nist_ai_standards_group_placement_v2_supersession_link_human_review",
        link: "nist_ai_standards_group_placement_v2_supersedes_nist_ai_standards_group_placement",
        rationale:
          "The placement is supported by combining the passage that places the AI Research, Measurement, and Standards Division in ITL with the passage stating that the Division’s efforts are carried out by the AI Standards and Guidelines Group; no single selected passage directly states the full placement.",
      },
      {
        originalJudgment: "judgment_nist_aml_facility_capacity_stage_b",
        originalRecord: "nist_aml_facility_capacity",
        correctionJudgment: "judgment_nist_aml_facility_capacity_v2_human_review",
        correctionRecord: "nist_aml_facility_capacity_v2",
        linkJudgment: "judgment_nist_aml_facility_capacity_v2_supersession_link_human_review",
        link: "nist_aml_facility_capacity_v2_supersedes_nist_aml_facility_capacity",
        rationale:
          "The cited passage directly establishes the Advanced Measurement Laboratory complex’s physical features and measurement infrastructure, but does not require the stronger wording “NIST maintains.” Utilization, uptime, maintenance condition, and full operational availability remain unknown.",
      },
      {
        originalJudgment: "judgment_nist_ai_measurement_capacity_stage_b",
        originalRecord: "nist_ai_measurement_capacity",
        correctionJudgment: "judgment_nist_ai_measurement_function_human_review",
        correctionRecord: "nist_ai_measurement_function",
        linkJudgment: "judgment_nist_ai_measurement_function_supersession_link_human_review",
        link: "nist_ai_measurement_function_supersedes_nist_ai_measurement_capacity",
        rationale:
          "Human review finds the operational-capacity classification too strong. The cited passage directly establishes only the Division’s stated work in AI measurement science, testing and evaluation, and standards; it does not establish technical machinery, resources, throughput, or operational availability.",
      },
    ];
    for (const chain of chains) {
      const original = nistJudgments.find((item) => item.judgment_id === chain.originalJudgment)!;
      const correction = nistJudgments.find(
        (item) => item.judgment_id === chain.correctionJudgment,
      )!;
      const correctionLink = nistJudgments.find((item) => item.judgment_id === chain.linkJudgment)!;
      expect(original).toMatchObject({
        target_id: chain.originalRecord,
        value: "approved",
        status: "superseded",
        superseded_by_judgment_id: correction.judgment_id,
      });
      expect(correction).toMatchObject({
        target_id: chain.correctionRecord,
        value: "approved",
        status: "accepted",
        reviewer: "Sara Kim",
        created_at: "2026-08-29",
        supersedes_judgment_ids: [original.judgment_id],
      });
      expect(correction.rationale).toBe(chain.rationale);
      expect(correctionLink).toMatchObject({
        target_id: chain.link,
        value: "approved",
        status: "accepted",
        reviewer: "Sara Kim",
        created_at: "2026-08-29",
      });
    }

    const commissionChains = [
      {
        originalJudgment: "judgment_european_commission_identity_review",
        originalRecord: "european_commission_identity",
        correctionJudgment: "judgment_european_commission_identity_v2_human_review",
        correctionRecord: "european_commission_identity_v2",
        linkJudgment: "judgment_european_commission_identity_v2_supersession_link_human_review",
        link: "european_commission_identity_v2_supersedes_european_commission_identity",
      },
      {
        originalJudgment: "judgment_eu_ai_office_placement_review",
        originalRecord: "eu_ai_office_placement",
        correctionJudgment: "judgment_eu_ai_office_placement_v2_human_review",
        correctionRecord: "eu_ai_office_placement_v2",
        linkJudgment: "judgment_eu_ai_office_placement_v2_supersession_link_human_review",
        link: "eu_ai_office_placement_v2_supersedes_eu_ai_office_placement",
      },
      {
        originalJudgment: "judgment_european_commission_jrc_infra_capacity_review",
        originalRecord: "european_commission_jrc_infra_capacity",
        correctionJudgment: "judgment_european_commission_jrc_infra_capacity_v2_human_review",
        correctionRecord: "european_commission_jrc_infra_capacity_v2",
        linkJudgment:
          "judgment_european_commission_jrc_infra_capacity_v2_supersession_link_human_review",
        link: "european_commission_jrc_infra_capacity_v2_supersedes_european_commission_jrc_infra_capacity",
      },
      {
        originalJudgment: "judgment_eu_ai_office_gp_ai_enforcement_mandate_review",
        originalRecord: "eu_ai_office_gp_ai_enforcement_mandate",
        correctionJudgment: "judgment_eu_ai_office_gp_ai_enforcement_mandate_v2_human_review",
        correctionRecord: "eu_ai_office_gp_ai_enforcement_mandate_v2",
        linkJudgment:
          "judgment_eu_ai_office_gp_ai_enforcement_mandate_v2_supersession_link_human_review",
        link: "eu_ai_office_gp_ai_enforcement_mandate_v2_supersedes_eu_ai_office_gp_ai_enforcement_mandate",
      },
    ];
    for (const chain of commissionChains) {
      const original = commissionJudgments.find(
        (item) => item.judgment_id === chain.originalJudgment,
      )!;
      const correction = commissionJudgments.find(
        (item) => item.judgment_id === chain.correctionJudgment,
      )!;
      const correctionLink = commissionJudgments.find(
        (item) => item.judgment_id === chain.linkJudgment,
      )!;
      expect(original).toMatchObject({
        target_id: chain.originalRecord,
        value: "approved",
        status: "superseded",
        superseded_by_judgment_id: correction.judgment_id,
      });
      expect(correction).toMatchObject({
        target_id: chain.correctionRecord,
        value: "approved",
        status: "accepted",
        reviewer: "Sara Kim",
        created_at: "2026-08-30",
        supersedes_judgment_ids: [original.judgment_id],
      });
      expect(correctionLink).toMatchObject({
        target_id: chain.link,
        value: "approved",
        status: "accepted",
        reviewer: "Sara Kim",
        created_at: "2026-08-30",
      });
    }

    const historicalRootLinkJudgment = commissionJudgments.find(
      (item) =>
        item.judgment_id === "judgment_eu_ai_office_european_commission_relationship_review",
    )!;
    const currentRootLinkJudgment = commissionJudgments.find(
      (item) =>
        item.judgment_id ===
        "judgment_eu_ai_office_european_commission_relationship_v2_human_review",
    )!;
    expect(historicalRootLinkJudgment).toMatchObject({
      target_id: "eu_ai_office_european_commission_relationship",
      status: "superseded",
      superseded_by_judgment_id: currentRootLinkJudgment.judgment_id,
    });
    expect(currentRootLinkJudgment).toMatchObject({
      target_id: "eu_ai_office_european_commission_relationship_v2",
      value: "approved",
      status: "accepted",
      reviewer: "Sara Kim",
      created_at: "2026-08-30",
      supersedes_judgment_ids: [historicalRootLinkJudgment.judgment_id],
    });

    const chainJudgments = new Set(
      [...chains, ...commissionChains].flatMap((chain) => [
        chain.originalJudgment,
        chain.correctionJudgment,
      ]),
    );
    chainJudgments.add(historicalRootLinkJudgment.judgment_id);
    chainJudgments.add(currentRootLinkJudgment.judgment_id);
    for (const judgment of [...nistJudgments, ...commissionJudgments]) {
      if (chainJudgments.has(judgment.judgment_id)) continue;
      expect(judgment).not.toHaveProperty("supersedes_judgment_ids");
      expect(judgment).not.toHaveProperty("superseded_by_judgment_id");
    }

    const stageA = nistJudgments.slice(0, 8);
    const originalStageB = nistJudgments.slice(8, 17);
    expect(stageA).toHaveLength(8);
    expect(stageA.every((item) => item.status === "accepted")).toBe(true);
    expect(stageA.every((item) => item.reviewer === "Sara Kim")).toBe(true);
    expect(originalStageB).toHaveLength(9);
    expect(originalStageB.every((item) => item.value === "approved")).toBe(true);
    expect(originalStageB.every((item) => item.reviewer === "Sara Kim")).toBe(true);
    expect(originalStageB.every((item) => item.created_at === "2026-08-08")).toBe(true);
    expect(originalStageB.filter((item) => item.status === "accepted")).toHaveLength(5);
    expect(originalStageB.filter((item) => item.status === "superseded")).toHaveLength(4);
    const originalCommissionReview = commissionJudgments.filter(
      (item) => item.created_at === "2026-08-08",
    );
    const commissionFollowUp = commissionJudgments.filter(
      (item) => item.created_at === "2026-08-30",
    );
    expect(originalCommissionReview).toHaveLength(21);
    expect(originalCommissionReview.every((item) => item.value === "approved")).toBe(true);
    expect(originalCommissionReview.filter((item) => item.status === "accepted")).toHaveLength(16);
    expect(originalCommissionReview.filter((item) => item.status === "superseded")).toHaveLength(5);
    expect(commissionFollowUp).toHaveLength(9);
    expect(commissionFollowUp.every((item) => item.status === "accepted")).toBe(true);
    expect(commissionFollowUp.every((item) => item.value === "approved")).toBe(true);
    expect(commissionJudgments.every((item) => item.reviewer === "Sara Kim")).toBe(true);
    expect(validateJudgmentSupersession(nistJudgments).valid).toBe(true);
    expect(validateJudgmentSupersession(commissionJudgments).valid).toBe(true);
    expect(nistJudgments.filter((item) => item.judgment_id.endsWith("_stage_b"))).toHaveLength(9);
    expect(commissionJudgments.filter((item) => item.target_kind === "record")).toHaveLength(24);
    expect(commissionJudgments.filter((item) => item.target_kind === "record_link")).toHaveLength(
      6,
    );
  });

  test("the Commission root link successor cites the exact direct transition", () => {
    const historical = yaml<RecordLink>(
      EC,
      "relationships/eu_ai_office_european_commission_relationship.yaml",
    );
    const current = yaml<RecordLink>(
      EC,
      "relationships/eu_ai_office_european_commission_relationship_v2.yaml",
    );
    expect(validate("record-link", historical).valid).toBe(true);
    expect(historical).toMatchObject({
      link_id: "eu_ai_office_european_commission_relationship",
      basis: "inherited",
      supporting_record_ids: ["eu_ai_office_placement"],
      review_state: "superseded",
    });
    expect(validate("record-link", current).valid).toBe(true);
    expect(current).toMatchObject({
      link_id: "eu_ai_office_european_commission_relationship_v2",
      source_id: "eu_ai_office",
      source_kind: "organizational_unit",
      target_id: "european_commission",
      target_kind: "supranational_institution",
      relation_type: "part_of",
      basis: "direct",
      evidence_refs: [
        "eu.commission_decision_c_2024_1459.recital_6",
        "eu.commission_decision_c_2024_1459.article_1",
      ],
      supporting_record_ids: ["eu_ai_office_placement_v2"],
      review_state: "approved",
    });
    for (const path of [
      "relationships/eu_ai_office_european_commission_relationship.yaml",
      "relationships/eu_ai_office_european_commission_relationship_v2.yaml",
    ]) {
      const source = read(EC, path);
      expect(source).not.toContain("has_part");
      expect(source).not.toContain("eu_ai_office_euro_comiss_relationship");
    }
  });

  test("migration ledgers cover all additions without rewriting Stage A entries", () => {
    const nistMigration = yaml<MigrationLedger>(NIST, "migration.yaml");
    expect(nistMigration.entries).toHaveLength(25);
    expect(nistMigration.entries.slice(8, 17).map((item) => item.final_object)).toEqual([
      ...NIST_STAGE_B_IDS,
    ]);
    expect(nistMigration.entries.slice(8, 17).every((item) => item.previous_object === null)).toBe(
      true,
    );
    expect(nistMigration.entries.slice(17).map((item) => item.final_object)).toEqual([
      NIST_LAB_NETWORK_CURRENT_ID,
      "nist_lab_network_capacity_v2_supersedes_nist_lab_network_capacity",
      "nist_ai_standards_group_placement_v2",
      "nist_ai_standards_group_placement_v2_supersedes_nist_ai_standards_group_placement",
      "nist_aml_facility_capacity_v2",
      "nist_aml_facility_capacity_v2_supersedes_nist_aml_facility_capacity",
      "nist_ai_measurement_function",
      "nist_ai_measurement_function_supersedes_nist_ai_measurement_capacity",
    ]);
    const ecMigration = yaml<MigrationLedger>(EC, "migration.yaml");
    expect(ecMigration.entries).toHaveLength(31);
    expect(new Set(ecMigration.entries.map((item) => item.final_object)).size).toBe(31);
    expect(ecMigration.entries.slice(22).map((item) => item.final_object)).toEqual([
      "european_commission_identity_v2",
      "european_commission_identity_v2_supersedes_european_commission_identity",
      "eu_ai_office_placement_v2",
      "eu_ai_office_placement_v2_supersedes_eu_ai_office_placement",
      "european_commission_jrc_infra_capacity_v2",
      "european_commission_jrc_infra_capacity_v2_supersedes_european_commission_jrc_infra_capacity",
      "eu_ai_office_gp_ai_enforcement_mandate_v2",
      "eu_ai_office_gp_ai_enforcement_mandate_v2_supersedes_eu_ai_office_gp_ai_enforcement_mandate",
      "eu_ai_office_european_commission_relationship_v2",
    ]);
  });

  test("the completed queue and durable artifact cover every Stage B human decision", () => {
    const queue = yaml<ReviewQueue>(
      ROOT,
      "docs/migrations/institutional-stage-b/review-queue.yaml",
    );
    expect(queue.queue_id).toBe("institutional-stage-b-review-queue-v1");
    expect(queue.status).toBe("completed_human_review");
    expect(queue.human_approval_artifact_found).toBe(true);
    expect(queue.human_review_artifact).toBe(
      "docs/migrations/institutional-stage-b/human-review.yaml",
    );
    const items = Object.values(queue.schema_queues).flat();
    const originalCommissionJudgments = commissionJudgments.filter(
      (item) => item.created_at === "2026-08-08",
    );
    expect(items).toHaveLength(30);
    expect(new Set(items.map((item) => item.judgment_id))).toEqual(
      new Set(
        [...nistJudgments.slice(8, 17), ...originalCommissionJudgments].map(
          (item) => item.judgment_id,
        ),
      ),
    );
    expect(
      new Set(
        items.map((item) => POST_REVIEW_TARGET_RENAMES.get(item.target_id) ?? item.target_id),
      ),
    ).toEqual(
      new Set(
        [...nistJudgments.slice(8, 17), ...originalCommissionJudgments].map(
          (item) => item.target_id,
        ),
      ),
    );
    expect(
      items.find((item) => item.target_id === "nist_national_measurement_standards_mandate"),
    ).toMatchObject({ source_currency: "current_official_olrc_through_2026_08_07" });
    expect(items.find((item) => item.target_id === "nist_ai_measurement_capacity")).toMatchObject({
      proposed_holder: "nist",
      implementing_unit_in_scope: "nist.ai_research_measurement_standards_division",
    });
    expect(
      queue.omitted_candidates.find(
        (item) => item.target_id === "eu_ai_office_model_eval_capacity",
      ),
    ).toMatchObject({ status: "omission_approved", human_decision: "approve_omission" });

    const review = yaml<HumanReview>(
      ROOT,
      "docs/migrations/institutional-stage-b/human-review.yaml",
    );
    expect(review).toMatchObject({
      reviewer: "Sara Kim",
      review_type: "human",
      review_date: "2026-08-08",
      queue_id: "institutional-stage-b-review-queue-v1",
      status: "complete",
      summary: {
        active_targets_reviewed: 30,
        active_targets_approved: 30,
        omitted_candidates_approved_for_omission: 1,
      },
    });
    expect(review.decisions).toHaveLength(30);
    expect(new Set(review.decisions.map((item) => item.target_id))).toEqual(
      new Set(items.map((item) => item.target_id)),
    );
    expect(review.decisions.every((item) => item.human_decision === "approve")).toBe(true);
    expect(
      review.decisions.every(
        (item) =>
          item.reviewed_components.includes("evidence_passages") &&
          item.reviewed_components.includes("uncertainties") &&
          item.reviewed_components.includes("proposed_disposition"),
      ),
    ).toBe(true);
    expect(review.omission_decision).toMatchObject({
      target_id: "eu_ai_office_model_eval_capacity",
      human_decision: "approve_omission",
    });
    expect(review.approved_revisions.nist_ai_measurement_capacity).toMatchObject({
      institution_id: "nist",
      institutional_scope_includes: "nist.ai_research_measurement_standards_division",
      capacity_type: "organizational_unit",
    });
    expect(review.olrc_source_verification).toMatchObject({
      direct_retrieval_result: "connection_timeout",
      stored_capture_sha256:
        "sha256:456fb61742da7ee5e996116af634ca569955a3319429027aed083903d41bcb7d",
      selected_passage_sha256:
        "sha256:7b5d22a2d42aa1f5b42b3d1b32e4a2fca3c6640db6467adb2dd2cb3a48e8a019",
      verification: {
        substantive_olrc_content_byte_identical: true,
        selected_passage_byte_identical: true,
      },
    });

    const postReviewInventory = JSON.parse(
      readFileSync(
        join(ROOT, "docs/migrations/institutional-stage-b/post-human-review-inventory.json"),
        "utf8",
      ),
    );
    expect(postReviewInventory.nist.stage_b_approved_target_ids).toEqual(NIST_STAGE_B_IDS);
    const commissionJudgmentIds = new Set(
      commissionJudgments.map((judgment) => judgment.judgment_id),
    );
    expect(new Set(postReviewInventory.european_commission.approved_target_ids)).toEqual(
      new Set(
        review.decisions
          .filter((item) => commissionJudgmentIds.has(item.judgment_id))
          .map((item) => item.target_id),
      ),
    );
    expect(postReviewInventory.review_totals).toEqual({
      active_targets_reviewed: 30,
      active_targets_approved: 30,
      approved_omissions: 1,
      proposed_disposition_judgments: 0,
    });
  });

  test("superseded draft IDs cannot remain active Stage B targets", () => {
    const activeTargets = new Set([
      ...NIST_STAGE_B_IDS,
      ...commissionJudgments.map((item) => item.target_id),
    ]);
    const queue = yaml<ReviewQueue>(
      ROOT,
      "docs/migrations/institutional-stage-b/review-queue.yaml",
    );
    const queueTargets = new Set(
      Object.values(queue.schema_queues)
        .flat()
        .map((item) => item.target_id),
    );
    for (const oldId of SUPERSEDED_DRAFT_TARGET_IDS) {
      expect(activeTargets.has(oldId), oldId).toBe(false);
      expect(queueTargets.has(oldId), oldId).toBe(false);
    }
  });

  test("preserves the Stage B identifier in snapshots but excludes it from active objects", () => {
    const historicalId = "eu_ai_office_technical_documentation_receipt";
    const activeId = "eu_ai_office_tech_doc_receipt";
    const queue = yaml<ReviewQueue>(
      ROOT,
      "docs/migrations/institutional-stage-b/review-queue.yaml",
    );
    const review = yaml<HumanReview>(
      ROOT,
      "docs/migrations/institutional-stage-b/human-review.yaml",
    );
    const inventory = JSON.parse(
      readFileSync(
        join(ROOT, "docs/migrations/institutional-stage-b/post-human-review-inventory.json"),
        "utf8",
      ),
    );
    const queueTargets = Object.values(queue.schema_queues)
      .flat()
      .map((item) => item.target_id);
    const reviewTargets = review.decisions.map((item) => item.target_id);
    const inventoryTargets = inventory.european_commission.approved_target_ids as string[];

    expect(queueTargets).toContain(historicalId);
    expect(reviewTargets).toContain(historicalId);
    expect(inventoryTargets).toContain(historicalId);
    expect(queueTargets).not.toContain(activeId);
    expect(reviewTargets).not.toContain(activeId);
    expect(inventoryTargets).not.toContain(activeId);

    expect(byId.has(historicalId)).toBe(false);
    expect(byId.has(activeId)).toBe(true);
    expect(commissionJudgments.some((judgment) => judgment.target_id === historicalId)).toBe(false);
    expect(commissionJudgments.some((judgment) => judgment.target_id === activeId)).toBe(true);

    const migration = yaml<{
      post_review_id_renames: Array<{
        previous_approved_id: string;
        active_id: string;
        approved_by: string;
        approved_at: string;
        review_artifact: string;
      }>;
    }>(EC, "migration.yaml");
    expect(migration.post_review_id_renames).toContainEqual({
      previous_approved_id: historicalId,
      active_id: activeId,
      approved_by: "Sara Kim",
      approved_at: "2026-08-08",
      review_artifact: "docs/migrations/cross-family-interoperability/human-review.yaml",
    });
  });

  test("machine-readable interoperability matrix covers all atomic schemas conservatively", () => {
    const matrix = JSON.parse(
      readFileSync(
        join(ROOT, "docs/migrations/institutional-stage-b/interoperability-matrix.json"),
        "utf8",
      ),
    );
    expect(matrix.assessment_status).toBe("structural_pass_bounded_semantic_review_complete");
    expect(matrix.interpretation.full_interoperability_claimed).toBe(false);
    expect(matrix.atomic_schemas.map((item: { fact_type: string }) => item.fact_type)).toEqual([
      "identity",
      "placement",
      "relationship",
      "mission",
      "mandate",
      "function",
      "decision_right",
      "operational_capacity",
    ]);
    for (const item of matrix.atomic_schemas) {
      expect(item.shared_schema_definition).toBeTruthy();
      expect(item.nist_example).toBeTruthy();
      expect(item.commission_example).toBeTruthy();
      expect(item.source_authority_types.length).toBeGreaterThan(0);
      expect(item.mapping_rationale).toBeTruthy();
      expect(item.equivalent_concepts.length).toBeGreaterThan(0);
      expect(item.analogous_only.length).toBeGreaterThan(0);
      expect(item.differences_to_preserve.length).toBeGreaterThan(0);
      expect(item.uncertainty).toBeTruthy();
      expect(typeof item.schema_passed_without_revision).toBe("boolean");
      expect(Array.isArray(item.schema_limitations)).toBe(true);
    }
  });
});

describe("source and repository boundaries", () => {
  const retainedSourceArtifacts: Record<string, string> = {
    "sha256:b4c06f92e650ea7762d3687419eeb51fc9a8ec506f199e1a39d15772de3e2919": join(
      NIST,
      "sources/captures/ecfr-15-cfr-part-285.xml",
    ),
    "sha256:7105b9f201a580599b1871fcb7dd9cb5c09b0dcc46bb7e9bd654a960cae65f7e": join(
      NIST,
      "sources/captures/nist-handbook-150-2020-update-1.pdf",
    ),
    "sha256:d78be7e77403adb1f454035bb39ac31f288fefd783e5a2b43bde80a3b38b8e71": join(
      EC,
      "sources/captures/commission-decision-c-2024-1459.pdf",
    ),
  };

  test("structured source metadata and exact evidence remain complete without raw HTML", () => {
    const sources = new Map([...structuredSources(NIST), ...structuredSources(EC)]);
    const aiAct = yaml<{
      sources: Array<{
        uri: string;
        media_type: string;
        retrieved_at: string;
        sha256: string;
      }>;
    }>(
      ROOT,
      "corpora/legal-policy/eu/european-union/artificial-intelligence-act-2024-1689/sources/sources.yaml",
    ).sources[0]!;
    sources.set("eu_ai_act_2024_1689", {
      sourceId: "eu_ai_act_2024_1689",
      documentVersionId: "dv_eu_ai_act_2024_1689",
      uri: aiAct.uri,
      mediaType: aiAct.media_type,
      retrievedAt: aiAct.retrieved_at,
      documentHash: aiAct.sha256,
      sourceVersion: "Regulation (EU) 2024/1689",
      sourceDate: "2024-07-12",
    });

    for (const metadata of sources.values()) {
      expect(() => new URL(metadata.uri), metadata.sourceId).not.toThrow();
      expect(metadata.mediaType, metadata.sourceId).toBeTruthy();
      expect(metadata.retrievedAt, metadata.sourceId).toBeTruthy();
      expect(metadata.sourceVersion, metadata.sourceId).toBeTruthy();
      expect(metadata.sourceDate, metadata.sourceId).toBeTruthy();
      expect(metadata.documentHash, metadata.sourceId).toMatch(/^sha256:[0-9a-f]{64}$/);
    }

    for (const [expected, path] of Object.entries(retainedSourceArtifacts)) {
      expect(sha256(readFileSync(path)), path).toBe(expected);
    }
    for (const target of allRecords) {
      expect(target.review_state, target.record_id).toBeTruthy();
      expect(target.provenance, target.record_id).toBeTruthy();
      for (const item of target.evidence) {
        const metadata = sources.get(item.source_id);
        expect(metadata, `${target.record_id}:${item.source_id}`).toBeDefined();
        expect(item.document_version_id, item.passage_id).toBeTruthy();
        expect(item.document_version_id, item.passage_id).toBe(metadata!.documentVersionId);
        expect(item.locator, item.passage_id).toBeTruthy();
        expect(item.quote, item.passage_id).toBeTruthy();
        expect(["direct", "inferred", "inherited"]).toContain(item.basis);
        expect(sha256(item.quote), item.passage_id).toBe(item.passage_hash);
        expect(item.document_hash, item.passage_id).toBe(metadata!.documentHash);
      }
    }
  });

  test("the corrected Article 13 passage uses a distinct exact source-version identity", () => {
    const sources = structuredSources(EC);
    const historical = sources.get("eu.teu_article_13")!;
    const current = sources.get("eu.teu_article_13.official_html")!;
    expect(historical).toMatchObject({
      documentVersionId: "eu.teu_article_13.v2026_08_05",
      documentHash: "sha256:2e730cdff0b3c14eb51f1b0ce2fd67d88f4b99c51501424ed53b565dd968ac37",
    });
    expect(current).toEqual({
      sourceId: "eu.teu_article_13.official_html",
      documentVersionId:
        "eu.teu_article_13.official_html.sha256_69e5c3f35d1539aadd39189b6166aa263b6c481d7f5c98e76f5b3bf16cee3222",
      uri: "https://publications.europa.eu/resource/celex/12012M013.ENG.html",
      mediaType: "text/html",
      retrievedAt: "2026-08-30T01:11:18-04:00",
      documentHash: "sha256:69e5c3f35d1539aadd39189b6166aa263b6c481d7f5c98e76f5b3bf16cee3222",
      sourceVersion: "official-journal-2012-10-26-english-html-retrieved-2026-08-30",
      sourceDate: "2012-10-26",
    });
    expect(current.documentHash).not.toBe(historical.documentHash);
  });

  test("sanitization provenance remains verifiable after raw HTML retirement", () => {
    const ledger = JSON.parse(
      readFileSync(
        join(ROOT, "docs/migrations/institutional-stage-b/source-sanitization-ledger.json"),
        "utf8",
      ),
    ) as SanitizationLedger;
    expect(ledger.affected_files).toHaveLength(6);
    expect(ledger.transformation_rule.replacement).toBe("[REDACTED_PUBLISHER_MAPBOX_TOKEN]");
    expect(ledger.verification).toMatchObject({
      all_non_document_hash_record_content_identical: true,
      all_evidence_quotations_byte_identical: true,
      selected_evidence_intersections: 0,
    });

    const sources = structuredSources(NIST);
    const evidence = nist.records.flatMap((target) => target.evidence);
    for (const entry of ledger.affected_files) {
      expect(existsSync(join(ROOT, entry.file)), entry.file).toBe(false);
      expect(entry.pre_sanitization_sha256).not.toBe(entry.post_sanitization_sha256);
      expect(entry.selected_evidence_intersected_redaction).toBe(false);
      expect(entry.evidence_quotations_byte_identical).toBe(true);
      expect(entry.substantive_source_content_unchanged).toBe(true);
      expect(Object.keys(entry.selected_evidence_passage_hashes).sort()).toEqual(
        [...entry.selected_evidence_passages].sort(),
      );
      for (const [passageId, expectedHash] of Object.entries(
        entry.selected_evidence_passage_hashes,
      )) {
        const references = evidence.filter((item) => item.passage_id === passageId);
        expect(references.length, passageId).toBeGreaterThan(0);
        for (const reference of references) {
          expect(reference.passage_hash).toBe(expectedHash);
          expect(sha256(reference.quote)).toBe(expectedHash);
        }
      }
      const source = [...sources.values()].find(({ uri }) => uri === entry.source_url);
      expect(source, entry.source_url).toBeDefined();
      expect(source!.retrievedAt).toBe(entry.retrieved_at);
      expect(source!.documentHash).toBe(entry.post_sanitization_sha256);
    }

    for (const root of [NIST, EC]) {
      const directory = join(root, "sources/captures");
      expect(readdirSync(directory).filter((name) => name.endsWith(".html"))).toEqual([]);
    }
  });

  test("shared AI Act source and passage registries remain byte-stable", () => {
    const aiAct = join(
      ROOT,
      "corpora/legal-policy/eu/european-union/artificial-intelligence-act-2024-1689",
    );
    expect(sha256(readFileSync(join(aiAct, "sources/sources.yaml")))).toBe(
      "sha256:cff778809423fbaf6e428565a7bc56df1dca583c3de91c1fdce2a09c8cf2aa72",
    );
    expect(sha256(readFileSync(join(aiAct, "passages/passages.yaml")))).toBe(
      "sha256:a4493f8821a66184708fcb6003a8293693a2061d38763b7f0e8b779db4c2608f",
    );
  });

  test("the statutory mandate pins the reviewed current OLRC source version", () => {
    const target = record("nist_national_measurement_standards_mandate");
    expect(target.assertion.text).toContain("laws in effect on August 7, 2026");
    expect(target.uncertainties[0]?.description).toContain(
      "does not establish currency after that date",
    );
    expect(target.evidence[0]?.document_version_id).toBe("us_code.title15_usc_272.v2026_08_07");
    expect(target.evidence[0]?.passage_hash).toBe(
      "sha256:7b5d22a2d42aa1f5b42b3d1b32e4a2fca3c6640db6467adb2dd2cb3a48e8a019",
    );
    expect(target.evidence[0]?.document_hash).toBe(
      "sha256:456fb61742da7ee5e996116af634ca569955a3319429027aed083903d41bcb7d",
    );
    const sources = read(NIST, "sources.writ");
    expect(sources).toContain('uri "https://uscode.house.gov/view.xhtml?edition=prelim');
    expect(sources).toContain("retrieved 2026-08-08T00:36:14-04:00");
    expect(sources).toContain('source_version "current-through-2026-08-07"');
    const migration = read(NIST, "migration.yaml");
    expect(migration).toContain("current_statutory_source_version:");
    expect(migration).toContain(
      "raw_capture_retention: not_tracked_after_structured_evidence_audit",
    );
  });

  test("unpublished typo-bearing identifiers have no remaining tracked reference", () => {
    for (const path of [
      "corpora/institutional/eu/european-commission/corpus.yaml",
      "corpora/institutional/eu/european-commission/migration.yaml",
      "corpora/institutional/eu/european-commission/judgments.writ",
      "docs/migrations/institutional-stage-b/implementation-report.md",
    ]) {
      expect(read(ROOT, path)).not.toContain("eu_ai_office_euro_comiss_relationship");
    }
  });

  test("the pre-implementation inventory proves no production capacity was invalidated", () => {
    const inventory = read(
      ROOT,
      "docs/migrations/institutional-stage-b/pre-implementation-inventory.json",
    );
    const parsed = JSON.parse(inventory);
    expect(parsed.nist_stage_a.records).toHaveLength(6);
    expect(parsed.european_commission_baseline.records).toHaveLength(3);
    expect(inventory).not.toContain('"institutional_fact_type": "operational_capacity"');
  });
});
