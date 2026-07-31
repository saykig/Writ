// Row and input types for the Writ evidence ledger.
//
// These mirror the SQL columns (snake_case) rather than the evaluator/domain
// types on purpose: per AGENTS.md, database types must not leak into the
// evaluator. Records the DB persists are shaped by the authoritative JSON Schemas in `schemas/`.

export type Json = unknown;
export type JsonObject = Record<string, Json>;

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------
export interface InstitutionRow {
  id: string;
  legal_name: string;
  short_name: string | null;
  jurisdiction: string | null;
  institution_type: string | null;
  canonical_uri: string | null;
  official_identifiers: JsonObject;
  created_at: Date;
}
export interface InstitutionInput {
  id: string;
  legal_name: string;
  short_name?: string | null;
  jurisdiction?: string | null;
  institution_type?: string | null;
  canonical_uri?: string | null;
  official_identifiers?: JsonObject;
}

// ---------------------------------------------------------------------------
// Documents / versions / passages
// ---------------------------------------------------------------------------
export interface DocumentRow {
  id: string;
  source_registry_id: string | null;
  canonical_uri: string;
  publisher: string | null;
  publisher_institution_id: string | null;
  jurisdiction: string | null;
  document_type: string | null;
  created_at: Date;
}
export interface DocumentInput {
  id: string;
  canonical_uri: string;
  source_registry_id?: string | null;
  publisher?: string | null;
  publisher_institution_id?: string | null;
  jurisdiction?: string | null;
  document_type?: string | null;
}

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  retrieved_at: Date;
  issued_at: Date | null;
  media_type: string;
  byte_size: string | null;
  sha256: string;
  storage_uri: string;
  warc_record_id: string | null;
  http_status: number | null;
  response_headers: JsonObject;
  extraction_status: string;
  created_at: Date;
}
export interface DocumentVersionInput {
  id: string;
  document_id: string;
  retrieved_at: string | Date;
  media_type: string;
  sha256: string;
  storage_uri: string;
  issued_at?: string | Date | null;
  byte_size?: number | bigint | null;
  warc_record_id?: string | null;
  http_status?: number | null;
  response_headers?: JsonObject;
  extraction_status?: string;
}

export interface PassageRow {
  id: string;
  document_version_id: string;
  anchor_type: string;
  page_number: number | null;
  anchor: JsonObject;
  quote: string;
  normalized_quote: string;
  anchor_hash: string;
  language: string | null;
  created_at: Date;
}
export interface PassageInput {
  id: string;
  document_version_id: string;
  anchor_type: string;
  anchor: JsonObject;
  quote: string;
  normalized_quote: string;
  anchor_hash: string;
  page_number?: number | null;
  language?: string | null;
}

// ---------------------------------------------------------------------------
// Claims (bitemporal) + evidence links
// ---------------------------------------------------------------------------
export type TruthValue = "true" | "false" | "unknown" | "contested";
export type ClaimStatus =
  | "candidate"
  | "accepted"
  | "rejected"
  | "contested"
  | "superseded"
  | "withdrawn";

export interface ClaimRow {
  id: string;
  logical_id: string;
  claim_type: string;
  subject_ref: string;
  predicate: string;
  object_value: Json;
  qualifiers: JsonObject;
  truth_value: TruthValue;
  status: ClaimStatus;
  valid_from: Date | null;
  valid_to: Date | null;
  recorded_at: Date;
  system_from: Date;
  system_to: Date | null;
  origin: string;
  created_by: string | null;
  supersedes_claim_id: string | null;
  created_at: Date;
}
export interface ClaimInput {
  id: string;
  claim_type: string;
  subject_ref: string;
  predicate: string;
  object_value: Json;
  truth_value: TruthValue;
  status: ClaimStatus;
  recorded_at: string | Date;
  origin: string;
  logical_id?: string;
  qualifiers?: JsonObject;
  valid_from?: string | Date | null;
  valid_to?: string | Date | null;
  created_by?: string | null;
  supersedes_claim_id?: string | null;
}

export type EvidenceStance = "supports" | "contradicts" | "qualifies" | "context_only";
export type SupportType = "direct" | "derived" | "corroborating" | "negative_search";
export interface EvidenceLinkInput {
  claim_id: string;
  passage_id: string;
  stance: EvidenceStance;
  support_type: SupportType;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export type ActionStatus = "candidate" | "accepted" | "rejected" | "contested" | "superseded";

export interface ActionRow {
  id: string;
  logical_id: string;
  label: string;
  actors: Json;
  jurisdiction: string;
  kind: string;
  instrument_type: string | null;
  implementation_stage: string;
  beneficiary_targeting: string;
  durability: string | null;
  attribution: string;
  announcement_time: Date | null;
  valid_from: Date | null;
  valid_to: Date | null;
  program_family_id: string | null;
  underlying_instrument_id: string | null;
  status: ActionStatus;
  structured_body: JsonObject;
  system_from: Date;
  system_to: Date | null;
  created_at: Date;
}
export interface ActionInput {
  id: string;
  label: string;
  jurisdiction: string;
  kind: string;
  implementation_stage: string;
  beneficiary_targeting: string;
  attribution: string;
  status: ActionStatus;
  actors?: Json;
  logical_id?: string;
  instrument_type?: string | null;
  durability?: string | null;
  announcement_time?: string | Date | null;
  valid_from?: string | Date | null;
  valid_to?: string | Date | null;
  program_family_id?: string | null;
  underlying_instrument_id?: string | null;
  structured_body?: JsonObject;
}

export interface ActionRelationshipInput {
  source_action_id: string;
  relationship_type: string;
  target_action_id: string;
  supporting_claim_ids?: string[];
  status?: string;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export interface ReviewInput {
  id: string;
  object_type: string;
  object_id: string;
  reviewer_id: string;
  decision: string;
  rationale: string;
  created_at: string | Date;
  conflict_of_interest?: string | null;
  supersedes_review_id?: string | null;
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------
export interface EvidenceSnapshotRow {
  id: string;
  frozen_at: Date;
  cutoff: Date;
  content_hash: string;
  description: string | null;
  created_by: string;
  created_at: Date;
}
export interface EvidenceSnapshotInput {
  id: string;
  frozen_at: string | Date;
  cutoff: string | Date;
  content_hash: string;
  created_by: string;
  description?: string | null;
  document_version_ids?: string[];
}

// ---------------------------------------------------------------------------
// Evaluation runs / receipts / discrepancies
// ---------------------------------------------------------------------------
export interface EvaluationRunInput {
  id: string;
  methodology_bundle_id: string;
  interpretation_profile_id: string;
  evidence_snapshot_id: string;
  commitment_id: string;
  subject_id: string;
  as_of: string | Date;
  cutoff: string | Date;
  evaluator_build_hash: string;
  status?: string;
  started_at?: string | Date | null;
  completed_at?: string | Date | null;
}

export type ReceiptResult = "-1" | "0" | "+1" | "not_applicable" | "unresolved";
export type ReceiptStatus = "supported" | "contested" | "incomplete" | "ambiguous" | "invalid";
export interface ReceiptInput {
  id: string;
  evaluation_run_id: string;
  result: ReceiptResult;
  result_status: ReceiptStatus;
  receipt: JsonObject;
  canonical_hash: string;
  signature?: JsonObject | null;
}

export interface DiscrepancyInput {
  id: string;
  benchmark_reference: string;
  commitment_id: string;
  subject_id: string;
  published_result: string;
  computed_result: string;
  category: string;
  summary: string;
  blocking: boolean;
  resolution_status: string;
  details?: string | null;
  linked_objects?: JsonObject;
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------
export type ReleaseStatus = "draft" | "candidate" | "published" | "withdrawn";
export interface ReleaseRow {
  id: string;
  name: string;
  version: string;
  methodology_bundle_ids: Json;
  evidence_snapshot_ids: Json;
  receipt_ids: Json;
  manifest: JsonObject;
  canonical_hash: string;
  signature: JsonObject | null;
  status: ReleaseStatus;
  created_by: string;
  created_at: Date;
  published_at: Date | null;
}
export interface ReleaseInput {
  id: string;
  name: string;
  version: string;
  methodology_bundle_ids: string[];
  evidence_snapshot_ids: string[];
  receipt_ids: string[];
  manifest: JsonObject;
  canonical_hash: string;
  created_by: string;
  status?: ReleaseStatus;
  signature?: JsonObject | null;
  published_at?: string | Date | null;
}

// ---------------------------------------------------------------------------
// Audit events (append-only)
// ---------------------------------------------------------------------------
export interface AuditEventInput {
  actor_id: string;
  event_type: string;
  object_type: string;
  object_id: string;
  event_hash: string;
  payload: JsonObject;
  prior_hash?: string | null;
  occurred_at?: string | Date;
}
export interface AuditEventRow {
  sequence: string;
  occurred_at: Date;
  actor_id: string;
  event_type: string;
  object_type: string;
  object_id: string;
  prior_hash: string | null;
  event_hash: string;
  payload: JsonObject;
}
