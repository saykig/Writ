/** Canonical compiled types for native Writ records and analytical judgments. */

/** Extensible family identifier; family schemas narrow this with a literal type. */
export type RecordFamily = string;
export type AssertionMode =
  | "requires"
  | "permits"
  | "prohibits"
  | "defines"
  | "authorizes"
  | "assigns"
  | "performs"
  | "states"
  | "observes";
export type EvidenceBasis = "direct" | "inferred" | "inherited";
export type UncertaintyType = "unknown" | "contested" | "ambiguous" | "incomplete_evidence";
export type RecordReviewState = "draft" | "reviewed" | "approved" | "superseded" | "withdrawn";

export interface RecordEvidenceReference {
  source_id: string;
  document_version_id: string;
  passage_id: string;
  locator: string;
  quote: string;
  passage_hash: string;
  document_hash: string;
  basis: EvidenceBasis;
}

export interface RecordSubject {
  subject_id: string;
  subject_type: string;
  label?: string;
  role?: string;
}

export interface RecordScope {
  jurisdictions: string[];
  institutional_scope: string[];
  temporal_scope: { from?: string; until?: string };
  conditions: string[];
}

export interface WritRecord {
  schema_version: "0.1.0" | "0.2.0";
  record_id: string;
  corpus_id: string;
  record_version: string;
  family: RecordFamily;
  title: string;
  subjects: RecordSubject[];
  assertion: { mode: AssertionMode; text: string };
  topics: string[];
  scope: RecordScope;
  evidence: RecordEvidenceReference[];
  uncertainties: Array<{ type: UncertaintyType; description: string }>;
  provenance: { created_by: string; created_at: string };
  review_state: RecordReviewState;
}

export interface LegalPolicyRecord extends WritRecord {
  family: "legal_policy";
  instrument_type:
    | "constitution"
    | "constitutional_amendment"
    | "statute"
    | "regulation"
    | "executive_order"
    | "agency_policy"
    | "guidance"
    | "code"
    | "other"
    | "unknown";
  jurisdiction_level:
    "federal" | "state" | "territorial" | "district" | "institution_specific" | "unknown";
  force: "binding" | "nonbinding" | "voluntary" | "proposed" | "unknown";
  adoption_status: "adopted" | "proposed" | "rescinded" | "superseded" | "unknown";
  applicability_status:
    | "generally_applicable"
    | "market_wide"
    | "provider_specific"
    | "government_use"
    | "procurement"
    | "institution_specific"
    | "not_yet_applicable"
    | "unknown";
  enforcement_status:
    | "judicial"
    | "administrative"
    | "contractual"
    | "oversight"
    | "self_executing"
    | "none_specified"
    | "unknown";
  official_citation: string;
  provision_identifier: string;
  jurisdictions?: string[];
  responsible_authorities?: string[];
  effective_from?: string;
  effective_until?: string;
  exceptions?: string[];
  compliance_pathway?: string;
  parent_instrument_id?: string;
  related_provision_ids?: string[];
  source_metadata?: {
    dataset_name: string;
    dataset_snapshot: string;
    source_row_identifier: string;
    source_url: string | null;
    jurisdiction: string;
    title: string;
    chapter: string | null;
    section_number: string | null;
    section_title: string | null;
    original_text: string;
    last_amended_year: number | null;
    row_hash: string;
  };
}

export type InstitutionalFunction =
  | "standards_development"
  | "measurement_science"
  | "technical_guidance"
  | "research"
  | "evaluation"
  | "coordination"
  | "oversight"
  | "grant_administration"
  | "procurement_support"
  | "other";
export type InstitutionalRelationType =
  | "part_of"
  | "oversees"
  | "supports"
  | "advises"
  | "coordinates_with"
  | "reports_to"
  | "implements_for";

export interface InstitutionalMandate {
  status: "established" | "unknown" | "contested";
  text?: string;
  authority_source_ids?: string[];
  evidence_refs?: string[];
}

export interface InstitutionalMission {
  text: string;
  source_ids?: string[];
  evidence_refs?: string[];
}

export interface LegacyInstitutionalRecord extends WritRecord {
  schema_version: "0.1.0";
  family: "institutional";
  institution_id: string;
  institution_type:
    | "government_department"
    | "federal_agency"
    | "independent_agency"
    | "advisory_body"
    | "regulator"
    | "standards_body"
    | "research_body"
    | "interagency_body"
    | "organizational_unit"
    | "other"
    | "unknown";
  mandate: InstitutionalMandate;
  mission?: InstitutionalMission;
  jurisdictions: string[];
  functions: InstitutionalFunction[];
  operational_capacity: {
    status: "established" | "partial" | "unknown" | "contested";
    dimensions: string[];
    evidence_refs: string[];
  };
  decision_rights?: string[];
  parent_institution_id?: string;
  subunit_ids?: string[];
  oversight_relationships?: Array<{ type: InstitutionalRelationType; target_id: string }>;
  institutional_relationships?: Array<{ type: InstitutionalRelationType; target_id: string }>;
  applicable_period?: { from?: string; until?: string };
}

export type InstitutionalFactType =
  | "identity"
  | "placement"
  | "relationship"
  | "mission"
  | "mandate"
  | "function"
  | "decision_right"
  | "operational_capacity";

interface AtomicInstitutionalBase extends WritRecord {
  schema_version: "0.2.0";
  family: "institutional";
  institution_id: string;
  institutional_fact_type: InstitutionalFactType;
  institution_type?: LegacyInstitutionalRecord["institution_type"];
  parent_institution_id?: string;
  record_link?: RecordLinkPayload;
  mission?: InstitutionalMission;
  mandate?: InstitutionalMandate;
  function?: string;
  decision_right?: InstitutionalMandate;
  operational_capacity?: LegacyInstitutionalRecord["operational_capacity"];
}

export type AtomicInstitutionalRecord = AtomicInstitutionalBase &
  (
    | {
        institutional_fact_type: "identity";
        institution_type: LegacyInstitutionalRecord["institution_type"];
      }
    | { institutional_fact_type: "placement"; parent_institution_id: string }
    | { institutional_fact_type: "relationship"; record_link: RecordLinkPayload }
    | { institutional_fact_type: "mission"; mission: InstitutionalMission }
    | { institutional_fact_type: "mandate"; mandate: InstitutionalMandate }
    | { institutional_fact_type: "function"; function: string }
    | { institutional_fact_type: "decision_right"; decision_right: InstitutionalMandate }
    | {
        institutional_fact_type: "operational_capacity";
        operational_capacity: LegacyInstitutionalRecord["operational_capacity"];
      }
  );

export type InstitutionalRecord = LegacyInstitutionalRecord | AtomicInstitutionalRecord;

export type JudgmentType =
  | "passage_selection"
  | "record_family_classification"
  | "subject_identification"
  | "scope_interpretation"
  | "topic_classification"
  | "legal_status_determination"
  | "institutional_role_determination"
  | "operational_capacity_determination"
  | "direct_or_inferred"
  | "disagreement"
  | "adjudication"
  | "review_disposition"
  | "record_link_disposition";

export interface LegacyRecordJudgment {
  schema_version: "0.1.0";
  judgment_id: string;
  target_record_id: string;
  judgment_type: JudgmentType;
  value: unknown;
  rationale: string;
  evidence_refs: string[];
  reviewer: string;
  status: "proposed" | "accepted" | "contested" | "superseded";
  created_at: string;
  family_context?: RecordFamily;
  supersedes?: string;
  related_judgment_ids?: string[];
}

export interface CurrentRecordJudgment {
  schema_version: "0.2.0";
  judgment_id: string;
  target_kind: "record" | "record_link";
  target_id: string;
  judgment_type: JudgmentType;
  value: unknown;
  rationale: string;
  evidence_refs: string[];
  reviewer: string;
  status: "proposed" | "accepted" | "contested" | "superseded";
  created_at: string;
  family_context?: RecordFamily;
  /** Older judgments this one replaced. Only a judgment that was accepted can carry it. */
  supersedes_judgment_ids?: string[];
  /** The newer judgment that replaced this one. Required when `status` is `superseded`. */
  superseded_by_judgment_id?: string;
  related_judgment_ids?: string[];
}

export type RecordJudgment = LegacyRecordJudgment | CurrentRecordJudgment;

export type RecordLinkRelation =
  | "issued_by"
  | "administered_by"
  | "implemented_by"
  | "enforced_by"
  | "establishes"
  | "authorizes"
  | "assigns_function_to"
  | "derives_authority_from"
  | "part_of"
  | "oversees"
  | "applies_to"
  | "supersedes";

export interface RecordLinkPayload {
  link_id: string;
  source_id: string;
  source_kind: string;
  target_id: string;
  target_kind: string;
  relation_type: RecordLinkRelation;
  basis: EvidenceBasis;
  evidence_refs: string[];
  /**
   * Records that already assert the fact this link rests on, cited instead of
   * restated. The link is still reviewed on its own; a supporting record's review
   * approval does not transfer to it.
   */
  supporting_record_ids?: string[];
}

export interface RecordLink extends RecordLinkPayload {
  schema_version: "1.0.0";
  owning_corpus_id: string;
  uncertainties: Array<{ type: UncertaintyType; description: string }>;
  provenance: { created_by: string; created_at: string };
  review_state: RecordReviewState;
}

export interface CorpusManifest {
  schema_version: "1.0.0";
  corpus_id: string;
  title: string;
  family: "legal_policy" | "institutional";
  jurisdiction: string;
  corpus_version: string;
  [key: string]: unknown;
}

export interface CorpusCatalog {
  schema_version: "1.0.0";
  implemented_native_families: ["legal_policy", "institutional"];
  corpora: Array<{
    corpus_id: string;
    family: "legal_policy" | "institutional";
    jurisdiction: string;
    status: string;
    path: string;
    manifest: string;
  }>;
}
