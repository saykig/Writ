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
  schema_version: "0.1.0";
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

export interface InstitutionalRecord extends WritRecord {
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
  | "adjudication";

export interface RecordJudgment {
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
