import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
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
const COMMISSION_BASELINE_IDS = [
  "eu_ai_office_technical_documentation_receipt",
  "eu_ai_office_training_sum_temp_function",
  "eu_ai_office_serious_incident_report_receipt",
] as const;
const APPROVED_TARGET_RENAMES = new Map<string, string>([
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
const SUPERSEDED_DRAFT_TARGET_IDS = [...APPROVED_TARGET_RENAMES.keys()];
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

  test("NIST has exactly six Stage A and nine Stage B records", () => {
    expect(nist.records).toHaveLength(15);
    expect(NIST_STAGE_B_IDS.every((id) => byId.has(id))).toBe(true);
    expect(new Set(NIST_STAGE_B_IDS).size).toBe(9);
    expect(manifest(NIST).record_counts).toEqual({
      institutional_records: 15,
      record_links: 2,
      disposition_judgments: 17,
    });
    expect(manifest(NIST).review_counts).toEqual({
      approved_records: 14,
      superseded_records: 1,
      draft_records: 0,
      approved_record_links: 2,
      accepted_disposition_judgments: 17,
      proposed_disposition_judgments: 0,
    });
  });

  test("Commission preserves three baseline records and has 20 human-approved records", () => {
    expect(commission.records).toHaveLength(20);
    for (const id of COMMISSION_BASELINE_IDS) expect(record(id).review_state).toBe("approved");
    const baselineIds = new Set<string>(COMMISSION_BASELINE_IDS);
    expect(commission.records.filter((item) => !baselineIds.has(item.record_id))).toHaveLength(17);
    expect(new Set(commission.records.map((item) => item.record_id)).size).toBe(20);
    expect(commission.records.every((item) => item.review_state === "approved")).toBe(true);
    expect(manifest(EC).record_counts).toEqual({
      institutional_records: 20,
      record_links: 4,
      disposition_judgments: 24,
    });
    expect(manifest(EC).review_counts).toEqual({
      approved_records: 20,
      draft_records: 0,
      approved_record_links: 1,
      draft_record_links: 3,
      accepted_disposition_judgments: 21,
      proposed_disposition_judgments: 3,
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
    ["nist_ai_standards_group_placement", "placement"],
    ["european_commission_identity", "identity"],
    ["eu_ai_office_identity", "identity"],
    ["eu_ai_office_placement", "placement"],
    ["european_commission_mission", "mission"],
    ["eu_ai_office_mission", "mission"],
    ["european_commission_union_law_mandate", "mandate"],
    ["eu_ai_office_gp_ai_enforcement_mandate", "mandate"],
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
    expect(record("nist_ai_standards_group_placement").parent_institution_id).toBe(
      "nist.ai_research_measurement_standards_division",
    );
    expect(record("eu_ai_office_placement").parent_institution_id).toBe(
      "european_commission.dg_connect",
    );
  });

  test("NIST holds AI measurement capacity implemented through the scoped division", () => {
    const target = record("nist_ai_measurement_capacity");
    expect(target.institution_id).toBe("nist");
    expect(target.scope.institutional_scope).toContain(
      "nist.ai_research_measurement_standards_division",
    );
    expect(target.operational_capacity?.capacity_type).toBe("organizational_unit");
    expect(target.operational_capacity?.capacity_components).toEqual([
      "ai_measurement_science",
      "testing_and_evaluation",
      "standards",
      "ai_standards_and_guidelines_group",
      "applied_ai_research_group",
    ]);
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
      item.operational_capacity !== undefined,
  );

  test("five NIST and three Commission capacities use one controlled type and direct evidence", () => {
    expect(capacities).toHaveLength(8);
    expect(capacities.filter((item) => item.corpus_id === "us.institutions.nist")).toHaveLength(5);
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
    const identity = structuredClone(record("european_commission_identity"));
    identity.institution_type = "unknown_new_type";
    expect(validate("institutional-record", identity).valid).toBe(false);
    const base = structuredClone(capacityRecord("nist_lab_network_capacity"));
    (base.operational_capacity as unknown as Record<string, unknown>).capacity_type =
      "unknown_capacity";
    expect(validate("institutional-record", base).valid).toBe(false);
    const status = structuredClone(capacityRecord("nist_lab_network_capacity"));
    (status.operational_capacity as unknown as Record<string, unknown>).status = "established";
    expect(validate("institutional-record", status).valid).toBe(false);
    const duplicate = structuredClone(capacityRecord("nist_lab_network_capacity"));
    duplicate.operational_capacity.capacity_components = [
      "engineering_laboratory",
      "engineering_laboratory",
    ];
    expect(validate("institutional-record", duplicate).valid).toBe(false);
    const quantity = structuredClone(capacityRecord("nist_lab_network_capacity"));
    quantity.operational_capacity.quantity = {
      value: 6,
      unit: "laboratory_components",
      qualifier: "exact",
    };
    expect(validate("institutional-record", quantity).valid).toBe(false);
    const qualifier = structuredClone(capacityRecord("nist_lab_network_capacity"));
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
    expect(Object.keys(audit.records).sort()).toEqual(
      capacities.map((item) => item.record_id).sort(),
    );
    for (const target of capacities) {
      const mapping = audit.records[target.record_id]!;
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
    expect(record("european_commission_identity").institution_type).toBe(
      "supranational_institution",
    );
    expect(record("nist_ai_standards_group_identity").institution_type).toBe("organizational_unit");
    expect(record("eu_ai_office_identity").institution_type).toBe("organizational_unit");
  });

  test("different institutional forms retain distinct components and ownership boundaries", () => {
    const nistLabs = capacityRecord("nist_lab_network_capacity").operational_capacity;
    const jrc = capacityRecord("european_commission_jrc_infra_capacity").operational_capacity;
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

  test("all Stage B judgments are accepted human decisions", () => {
    expect(nistJudgments).toHaveLength(17);
    expect(commissionJudgments).toHaveLength(21);
    const commissionLink = yaml<RecordLink>(
      EC,
      "relationships/eu_ai_office_european_commission_relationship.yaml",
    );
    for (const judgment of [...nistJudgments, ...commissionJudgments]) {
      expect(validate("record-judgment", judgment).valid).toBe(true);
      expect(judgment).not.toHaveProperty("supersedes_judgment_ids");
      expect(judgment).not.toHaveProperty("superseded_by_judgment_id");
      if (judgment.target_kind === "record") expect(byId.has(judgment.target_id)).toBe(true);
      else
        expect([
          "nist_department_of_commerce_relationship",
          "nist_mission_supersedes_nist_measurement_science_function",
          commissionLink.link_id,
        ]).toContain(judgment.target_id);
    }
    const stageA = nistJudgments.slice(0, 8);
    const stageB = [...nistJudgments.slice(8), ...commissionJudgments];
    expect(stageA).toHaveLength(8);
    expect(stageA.every((item) => item.status === "accepted")).toBe(true);
    expect(stageA.every((item) => item.reviewer === "Sara Kim")).toBe(true);
    expect(stageB).toHaveLength(30);
    expect(stageB.every((item) => item.status === "accepted")).toBe(true);
    expect(stageB.every((item) => item.value === "approved")).toBe(true);
    expect(stageB.every((item) => item.reviewer === "Sara Kim")).toBe(true);
    expect(stageB.every((item) => item.created_at === "2026-08-08")).toBe(true);
    expect(validateJudgmentSupersession(nistJudgments).valid).toBe(true);
    expect(validateJudgmentSupersession(commissionJudgments).valid).toBe(true);
    expect(nistJudgments.filter((item) => item.judgment_id.endsWith("_stage_b"))).toHaveLength(9);
    expect(commissionJudgments.filter((item) => item.target_kind === "record")).toHaveLength(20);
    expect(commissionJudgments.filter((item) => item.target_kind === "record_link")).toHaveLength(
      1,
    );
  });

  test("the Commission root link is inherited through direct DG CONNECT placement", () => {
    const link = yaml<RecordLink>(
      EC,
      "relationships/eu_ai_office_european_commission_relationship.yaml",
    );
    expect(validate("record-link", link).valid).toBe(true);
    expect(link).toMatchObject({
      link_id: "eu_ai_office_european_commission_relationship",
      source_id: "eu_ai_office",
      source_kind: "organizational_unit",
      target_id: "european_commission",
      target_kind: "supranational_institution",
      relation_type: "part_of",
      basis: "inherited",
      supporting_record_ids: ["eu_ai_office_placement"],
      review_state: "approved",
    });
    const source = read(EC, "relationships/eu_ai_office_european_commission_relationship.yaml");
    expect(source).not.toContain("has_part");
    expect(source).not.toContain("eu_ai_office_euro_comiss_relationship");
  });

  test("migration ledgers cover all additions without rewriting Stage A entries", () => {
    const nistMigration = yaml<MigrationLedger>(NIST, "migration.yaml");
    expect(nistMigration.entries).toHaveLength(17);
    expect(nistMigration.entries.slice(8).map((item) => item.final_object)).toEqual([
      ...NIST_STAGE_B_IDS,
    ]);
    expect(nistMigration.entries.slice(8).every((item) => item.previous_object === null)).toBe(
      true,
    );
    const ecMigration = yaml<MigrationLedger>(EC, "migration.yaml");
    expect(ecMigration.entries).toHaveLength(22);
    expect(new Set(ecMigration.entries.map((item) => item.final_object)).size).toBe(22);
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
    expect(items).toHaveLength(30);
    expect(new Set(items.map((item) => item.judgment_id))).toEqual(
      new Set([...nistJudgments.slice(8), ...commissionJudgments].map((item) => item.judgment_id)),
    );
    expect(new Set(items.map((item) => item.target_id))).toEqual(
      new Set([...nistJudgments.slice(8), ...commissionJudgments].map((item) => item.target_id)),
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
    expect(new Set(postReviewInventory.european_commission.approved_target_ids)).toEqual(
      new Set(commissionJudgments.map((item) => item.target_id)),
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
  const captures: Record<string, string> = {
    "sha256:456fb61742da7ee5e996116af634ca569955a3319429027aed083903d41bcb7d": join(
      NIST,
      "sources/captures/us-code-15-usc-272-current.html",
    ),
    "sha256:b4c06f92e650ea7762d3687419eeb51fc9a8ec506f199e1a39d15772de3e2919": join(
      NIST,
      "sources/captures/ecfr-15-cfr-part-285.xml",
    ),
    "sha256:7105b9f201a580599b1871fcb7dd9cb5c09b0dcc46bb7e9bd654a960cae65f7e": join(
      NIST,
      "sources/captures/nist-handbook-150-2020-update-1.pdf",
    ),
    "sha256:3e1c7a56c31e74b719b8366d655e0b390948125d73b49f7204a4d0d3bc7e83db": join(
      NIST,
      "sources/captures/nist-accreditation.html",
    ),
    "sha256:c1d5324f319ef5b58b4a1446113dae1425e6ae6c685130c551aec74fca61087b": join(
      NIST,
      "sources/captures/nist-laboratories.html",
    ),
    "sha256:f928e083da64fc2bf6ae582adbdb2021f62b8b9f0349f80601cecfb6bcb8e101": join(
      NIST,
      "sources/captures/nist-advanced-measurement-laboratory.html",
    ),
    "sha256:01e47437970773cf5932e2a10975034f2de636d50c313f31d429604865efea22": join(
      NIST,
      "sources/captures/nist-ai-research-measurement-standards-division.html",
    ),
    "sha256:9673a9ebb47ccf7804be898dff2c8c6238e42f508da762b06d11ba06f7a7bfb0": join(
      NIST,
      "sources/captures/nist-ai-consortium.html",
    ),
    "sha256:6479ed7c9761fb1b63f4a946d7a740d4157a7bbc2998a577ec4249b564622fca": join(
      NIST,
      "sources/captures/nist-ai-consortium-expansion-2026-05-29.html",
    ),
    "sha256:2e730cdff0b3c14eb51f1b0ce2fd67d88f4b99c51501424ed53b565dd968ac37": join(
      EC,
      "sources/captures/teu-article-13.html",
    ),
    "sha256:ee9da1327b780b2b4290b866dedceccad86793d468b36bbcc0fac594e93d2c08": join(
      EC,
      "sources/captures/teu-article-17.html",
    ),
    "sha256:ec05de3ed032bc882a25fb54d4ae239cb68fba85ee88a3d3ceb003762ebaf017": join(
      EC,
      "sources/captures/tfeu-article-258.html",
    ),
    "sha256:d78be7e77403adb1f454035bb39ac31f288fefd783e5a2b43bde80a3b38b8e71": join(
      EC,
      "sources/captures/commission-decision-c-2024-1459.pdf",
    ),
    "sha256:408360a1e92d48ee1812f81080afa3f55129fc94a4a12c04156e64258d6c1fca": join(
      EC,
      "sources/captures/european-commission-institution.html",
    ),
    "sha256:6bfc04ef05306f758e2bb02cf9c9819dc6f1d00eb271fdac27ac345e01b733df": join(
      EC,
      "sources/captures/commission-planning-proposing-law.html",
    ),
    "sha256:2bd2e3ab0f53136a316476ce0a31963b9147461930bbde5b8bf736632149e64b": join(
      EC,
      "sources/captures/commission-budget-funding.html",
    ),
    "sha256:a110ad6a4dacc47bd1a5b63d955374e3ab4fea4323547657e93f5258036fd2eb": join(
      EC,
      "sources/captures/european-ai-office.html",
    ),
    "sha256:25f2cdb0ed3773313b9a5e6d398e02346fef13bc3c80d32149ef39040e6c55c7": join(
      EC,
      "sources/captures/jrc-open-access-research-infrastructures.html",
    ),
  };

  test("every captured document and every quoted passage matches its hash", () => {
    for (const [expected, path] of Object.entries(captures)) {
      expect(sha256(readFileSync(path)), path).toBe(expected);
    }
    for (const target of allRecords) {
      for (const item of target.evidence) {
        expect(sha256(item.quote), item.passage_id).toBe(item.passage_hash);
        if (captures[item.document_hash]) {
          expect(sha256(readFileSync(captures[item.document_hash]!))).toBe(item.document_hash);
        }
      }
    }
  });

  test("publisher transport credentials are deterministically sanitized outside evidence", () => {
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

    const sources = read(NIST, "sources.writ");
    const evidence = nist.records.flatMap((target) => target.evidence);
    for (const entry of ledger.affected_files) {
      const capture = readFileSync(join(ROOT, entry.file));
      const text = capture.toString("utf8");
      expect(sha256(capture)).toBe(entry.post_sanitization_sha256);
      expect(entry.pre_sanitization_sha256).not.toBe(entry.post_sanitization_sha256);
      expect(text.split(ledger.transformation_rule.replacement)).toHaveLength(
        ledger.transformation_rule.replacement_count_per_file + 1,
      );
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
      expect(sources).toContain(`uri "${entry.source_url}";`);
      expect(sources).toContain(`retrieved ${entry.retrieved_at};`);
    }

    for (const root of [NIST, EC]) {
      const directory = join(root, "sources/captures");
      for (const file of readdirSync(directory).filter((name) => name.endsWith(".html"))) {
        const html = readFileSync(join(directory, file), "utf8");
        expect(html, file).not.toMatch(/(?:pk|sk)\.[A-Za-z0-9._-]{20,}/);
        expect(html, file).not.toMatch(
          /(?:access[_-]?token|accessToken)\s*[:=]\s*["']?(?:pk|sk)\./i,
        );
      }
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

  test("the stored statutory mandate uses the current official OLRC capture", () => {
    const target = record("nist_national_measurement_standards_mandate");
    const capture = read(NIST, "sources/captures/us-code-15-usc-272-current.html");
    expect(target.assertion.text).toContain("laws in effect on August 7, 2026");
    expect(target.uncertainties[0]?.description).toContain(
      "does not establish currency after that date",
    );
    expect(target.evidence[0]?.document_version_id).toBe("us_code.title15_usc_272.v2026_08_07");
    expect(target.evidence[0]?.passage_hash).toBe(
      "sha256:7b5d22a2d42aa1f5b42b3d1b32e4a2fca3c6640db6467adb2dd2cb3a48e8a019",
    );
    expect(capture).toContain("Text contains those laws in effect on August 7, 2026");
    expect(capture).toContain(target.evidence[0]!.quote);
    expect(read(NIST, "sources.writ")).toContain('source_version "current-through-2026-08-07"');
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
