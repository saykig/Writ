/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export interface MethodologyInventory {
  schema_version: "1.0.0";
  id: string;
  commitment_id: string;
  chapter: {
    title: string;
    uri: string;
    report_year: number;
    page_range?: string;
    content_hash?: string;
  };
  authority?: {}[];
  /**
   * @minItems 1
   */
  subjects: [string, ...string[]];
  evaluation_window: {
    start: string;
    end: string;
  };
  commitment_text: string;
  definitions: {
    term: string;
    definition: string;
    source_passage_ids?: string[];
  }[];
  classifications: {
    label: string;
    description: string;
    examples?: string[];
    exclusions?: string[];
    source_passage_ids?: string[];
  }[];
  dimensions?: string[];
  goals?: string[];
  partner_classes?: string[];
  required_artifacts?: string[];
  temporal_conditions?: string[];
  attribution_conditions?: string[];
  identity_conditions?: string[];
  exclusions?: string[];
  score_guideline: {
    prose: string;
    normalized_branches: {
      result: "-1" | "0" | "+1" | "not_applicable";
      condition_text: string;
      source_passage_ids?: string[];
    }[];
  };
  observed_results: {
    [k: string]: "-1" | "0" | "+1" | "not_applicable";
  };
  open_questions: {
    id: string;
    question: string;
    category:
      | "rule_gap"
      | "rule_overlap"
      | "identity"
      | "attribution"
      | "time"
      | "definition"
      | "prose_metric_mismatch"
      | "evidence"
      | "other";
    blocking: boolean;
    proposed_resolution?: string;
  }[];
  review_status: "draft" | "extracted" | "reviewed" | "approved";
  reviewer_ids?: string[];
  notes?: string;
}
