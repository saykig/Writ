/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export interface Discrepancy {
  schema_version: "1.0.0";
  id: string;
  benchmark_reference: string;
  commitment_id: string;
  subject_id: string;
  published_result: "-1" | "0" | "+1" | "not_applicable";
  computed_result: "-1" | "0" | "+1" | "not_applicable" | "unresolved";
  category:
    | "missing_evidence"
    | "implicit_interpretation"
    | "rule_gap"
    | "rule_overlap"
    | "prose_metric_mismatch"
    | "action_identity_ambiguity"
    | "attribution_ambiguity"
    | "temporal_ambiguity"
    | "extraction_error"
    | "published_data_inconsistency"
    | "implementation_defect";
  summary: string;
  details?: string;
  blocking: boolean;
  resolution_status: "open" | "under_review" | "resolved" | "accepted_difference";
  linked_rule_ids?: string[];
  linked_claim_ids?: string[];
  review_ids?: string[];
}
