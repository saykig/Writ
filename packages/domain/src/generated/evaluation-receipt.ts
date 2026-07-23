/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export type Truth = "true" | "false" | "unknown" | "contested";

export interface EvaluationReceipt {
  schema_version: "1.0.0";
  id: string;
  run: Run;
  result: "-1" | "0" | "+1" | "not_applicable" | "unresolved";
  result_status: "supported" | "contested" | "incomplete" | "ambiguous" | "invalid";
  confidence?: {
    value?: string;
    method?: string;
    factors?: {}[];
  };
  matched_rule_id?: string;
  rule_evaluations: RuleEvaluation[];
  proof: Proof;
  qualifying_action_ids?: string[];
  excluded_actions?: {
    action_id: string;
    reason: string;
    proof_id?: string;
  }[];
  unresolved_claim_ids?: string[];
  contested_claim_ids?: string[];
  diagnostics?: {
    code: string;
    severity: "error" | "warning" | "info";
    message: string;
    context?: {};
  }[];
  dependencies: Dependencies;
  canonical_hash: string;
  signature?: {};
  measures?: {
    id: string;
    strategy: string;
    scale: number;
    internal_score: number | null;
    public_score: number | null;
    pending: boolean;
    proof_id: string;
    components: {
      id: string;
      weight: number;
      score: number | null;
      pending: boolean;
    }[];
  }[];
}
export interface Run {
  commitment_version_id: string;
  subject_id: string;
  interpretation_profile_id: string;
  as_of: string;
  cutoff: string;
  started_at?: string;
  completed_at?: string;
}
export interface RuleEvaluation {
  rule_id: string;
  priority: number;
  result: "-1" | "0" | "+1" | "not_applicable";
  truth_value: Truth;
  proof_id: string;
}
export interface Proof {
  root_id: string;
  nodes: ProofNode[];
}
export interface ProofNode {
  id: string;
  kind:
    | "literal"
    | "reference"
    | "operator"
    | "comparison"
    | "query"
    | "predicate"
    | "classification"
    | "score_rule"
    | "selection"
    | "diagnostic";
  label: string;
  truth_value: Truth;
  value?: unknown;
  value_interval?: {
    min?: unknown;
    max?: unknown;
  };
  rule_id?: string;
  claim_ids?: string[];
  action_ids?: string[];
  passage_ids?: string[];
  child_ids: string[];
  metadata?: {};
}
export interface Dependencies {
  methodology_bundle_hash: string;
  evidence_snapshot_hash: string;
  interpretation_profile_hash: string;
  evaluator_build_hash: string;
  source_snapshot_ids: string[];
  claim_ids?: string[];
  action_ids?: string[];
}
