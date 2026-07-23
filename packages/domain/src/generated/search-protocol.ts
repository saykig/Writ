/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export interface SearchProtocol {
  schema_version: "1.0.0";
  id: string;
  commitment_id: string;
  subject_id: string;
  evaluation_window: {
    start: string;
    end: string;
  };
  cutoff: string;
  /**
   * @minItems 1
   */
  source_registry_ids: [string, ...string[]];
  /**
   * @minItems 1
   */
  queries: [
    {
      query: string;
      language?: string;
      executed_at: string;
      source_registry_id: string;
      result_count: number;
      cursor_or_page_range?: string;
      notes?: string;
    },
    ...{
      query: string;
      language?: string;
      executed_at: string;
      source_registry_id: string;
      result_count: number;
      cursor_or_page_range?: string;
      notes?: string;
    }[],
  ];
  /**
   * @minItems 1
   */
  languages: [string, ...string[]];
  coverage_assessment: {
    status: "sufficient" | "insufficient" | "contested";
    known_gaps: string[];
    rationale: string;
  };
  result: "no_qualifying_action_found" | "qualifying_action_found" | "inconclusive";
  candidate_action_ids?: string[];
  negative_claim_id?: string;
  review: {
    reviewer_id: string;
    decision: "accept" | "reject" | "contest" | "request_changes";
    rationale: string;
    reviewed_at: string;
  };
  content_hash?: string;
}
