/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export type Truth = "true" | "false" | "unknown" | "contested";

export interface Evidence {
  schema_version: "1.0.0";
  snapshot: Snapshot;
  document_versions: DocumentVersion[];
  passages: Passage[];
  claims: Claim[];
  actions: Action[];
  reviews: Review[];
}
export interface Snapshot {
  id: string;
  frozen_at: string;
  cutoff: string;
  content_hash: string;
  description?: string;
}
export interface DocumentVersion {
  id: string;
  document_id: string;
  uri: string;
  media_type: string;
  retrieved_at: string;
  issued_at?: string;
  sha256: string;
  storage_uri?: string;
  warc_record_id?: string;
  publisher?: string;
  source_tier?: number;
}
export interface Passage {
  id: string;
  document_version_id: string;
  anchor_type:
    "pdf_text" | "pdf_bbox" | "html_dom" | "json_pointer" | "table_cell" | "whole_document";
  page_number?: number;
  bounding_boxes?: [unknown, unknown, unknown, unknown][];
  dom_path?: string;
  json_pointer?: string;
  table_coordinates?: {};
  quote: string;
  normalized_quote?: string;
  anchor_hash: string;
  language?: string;
}
export interface Claim {
  id: string;
  claim_type:
    | "fact"
    | "negative_search_result"
    | "translation"
    | "entity_resolution"
    | "measurement"
    | "relationship";
  subject_ref: string;
  predicate: string;
  object: unknown;
  qualifiers?: {};
  truth_value: Truth;
  status: "candidate" | "accepted" | "rejected" | "contested" | "superseded" | "withdrawn";
  valid_time: {
    start?: string;
    end?: string;
  };
  recorded_at: string;
  created_by?: string;
  origin: "human" | "extractor" | "model" | "import";
  /**
   * @minItems 1
   */
  evidence_links: [EvidenceLink, ...EvidenceLink[]];
  supersedes_claim_id?: string;
}
export interface EvidenceLink {
  passage_id: string;
  stance: "supports" | "contradicts" | "qualifies" | "context_only";
  support_type: "direct" | "derived" | "corroborating" | "negative_search";
}
export interface Action {
  id: string;
  label: string;
  /**
   * @minItems 1
   */
  actors: [string, ...string[]];
  jurisdiction: string;
  kind: string;
  instrument_type?: string;
  announcement_time?: string;
  valid_time?: {
    start?: string;
    end?: string;
  };
  implementation_stage:
    | "proposed"
    | "announced"
    | "authorized"
    | "budgeted"
    | "funded"
    | "contracted"
    | "launched"
    | "operational"
    | "disbursing"
    | "evaluated"
    | "completed"
    | "suspended"
    | "repealed";
  beneficiaries?: string[];
  beneficiary_targeting:
    "explicit" | "materially_inclusive" | "indirect" | "general" | "absent" | "contested";
  amounts?: Money[];
  durability?: "one_off" | "fixed_term" | "recurring" | "institutionalized" | "unknown";
  attribution:
    "unilateral" | "joint" | "collective" | "implementing_partner" | "external" | "disputed";
  partner_classes?: string[];
  dimensions?: string[];
  program_family_id?: string;
  underlying_instrument_id?: string;
  relationships?: Relationship[];
  status: "candidate" | "accepted" | "rejected" | "contested" | "superseded";
  /**
   * @minItems 1
   */
  claim_ids: [string, ...string[]];
}
export interface Money {
  value: string;
  currency: string;
  bound: "exact" | "up_to" | "at_least" | "approximate";
  price_basis_date?: string;
}
export interface Relationship {
  type:
    | "announcement_of"
    | "implementation_of"
    | "funding_for"
    | "amends"
    | "supersedes"
    | "repeals"
    | "continues"
    | "part_of"
    | "duplicate_of"
    | "counteracts";
  target_id: string;
  claim_ids?: string[];
}
export interface Review {
  id: string;
  object_type: "claim" | "action" | "relationship" | "classification" | "methodology" | "receipt";
  object_id: string;
  reviewer_id: string;
  decision: "accept" | "reject" | "contest" | "request_changes" | "approve" | "withdraw";
  rationale: string;
  created_at: string;
  supersedes_review_id?: string;
  conflict_of_interest?: string;
}
