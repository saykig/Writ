export type MathematicalOperation = "compatibility" | "decision";
export type IntendedUse = "static_expected_loss_decision" | "compatibility_check";

export interface EncodedBytes {
  readonly encoding: "base64";
  readonly content: string;
  readonly sha256: string;
}

export interface CaseSourceDocument extends EncodedBytes {
  readonly source_id: string;
  readonly document_version_id: string;
  readonly media_type: "text/plain";
}

export interface CaseSourceReference {
  readonly reference_id: string;
  readonly source_id: string;
  readonly document_version_id: string;
  readonly passage_id: string;
  readonly locator: string;
  readonly quote: string;
  readonly passage_hash: string;
  readonly document_hash: string;
  readonly byte_span: {
    readonly start: number;
    readonly end: number;
  };
}

export type DependencyRole = "source_support" | "model_construction" | "checked_mathematical_use";

export type DependencyKind =
  | "synthetic_supplied_value"
  | "deterministic_transformation"
  | "modelling_choice"
  | "mathematical_subject"
  | "checked_use";

export interface CaseDependency {
  readonly dependency_id: string;
  readonly role: DependencyRole;
  readonly kind: DependencyKind;
  readonly description: string;
  readonly rationale: string;
  readonly depends_on: readonly string[];
  readonly reference_ids: readonly string[];
}

export interface ModelMapping {
  readonly target: string;
  readonly dependency_ids: readonly string[];
}

export interface DecisionAnalysis {
  readonly analysis_id: string;
  readonly kind: "revision" | "interpretation_control";
  readonly previous_analysis_id: string | null;
  readonly question: string;
  readonly intended_use: IntendedUse;
  readonly prohibited_uses: readonly string[];
  readonly unit: string;
  readonly mathematical_subject: {
    readonly problem: EncodedBytes;
    readonly query: EncodedBytes;
  };
  readonly dependencies: readonly CaseDependency[];
  readonly model_mappings: readonly ModelMapping[];
  readonly change: {
    readonly summary: string;
    readonly changed_dependencies: readonly string[];
  };
  readonly applicability: {
    readonly status: "supported" | "needs_reassessment" | "unknown" | "contested";
    readonly rationale: string;
    readonly changed_dependencies: readonly string[];
  };
  readonly human_review: {
    readonly disposition: "unreviewed" | "proposed" | "accepted" | "rejected";
    readonly reviewer: string | null;
  };
}

export interface DecisionCase {
  readonly schema_version: "0.1.0";
  readonly case_id: string;
  readonly title: string;
  readonly case_kind: "derived_decision_case";
  readonly engine: {
    readonly adapter: "writ-decision-lab-python.v1";
    readonly repository: "https://github.com/saykig/writ-decision-lab";
    readonly commit: string;
    readonly semantics: "finite-linear-uncertainty.v1";
    readonly supported_operations: readonly MathematicalOperation[];
    readonly runtime: "CPython 3.13";
    readonly dependency: "scipy==1.17.0";
  };
  readonly source_documents: readonly CaseSourceDocument[];
  readonly source_references: readonly CaseSourceReference[];
  readonly analyses: readonly DecisionAnalysis[];
  readonly interpretation_control: {
    readonly alternative_scenarios: readonly string[];
    readonly simultaneous_constraints: string;
  };
}

export interface LoadedDecisionCase {
  readonly value: DecisionCase;
  readonly raw_base64: string;
  readonly case_sha256: string;
}

export interface CheckedProjection {
  readonly operation: MathematicalOperation;
  readonly status: string;
  readonly family_kind: "exact_family" | "outer_enclosure";
  readonly model_sha256: string;
  readonly query_sha256: string;
  readonly conclusion: Readonly<Record<string, unknown>>;
}

export interface DecisionExecution {
  readonly schema_version: "0.1.0";
  readonly case_id: string;
  readonly case_sha256: string;
  readonly analysis_id: string;
  readonly engine: DecisionCase["engine"];
  readonly problem_sha256: string;
  readonly query_sha256: string;
  readonly candidate_result: EncodedBytes;
  readonly mathematical_check: {
    readonly status: "freshly_checked";
    readonly result: CheckedProjection;
  };
  readonly applicability: DecisionAnalysis["applicability"];
  readonly human_review: DecisionAnalysis["human_review"];
}

export interface ReuseAssessment {
  readonly prior_analysis_id: string;
  readonly next_analysis_id: string;
  readonly mathematical_subject_changed: boolean;
  readonly applicability_changed: boolean;
  readonly changed_dependencies: readonly string[];
  readonly mathematical_check_reusable: boolean;
  readonly applicability_requires_reassessment: boolean;
}

export interface ConsumedDecision {
  readonly functional: boolean;
  readonly mathematical_status: string;
  readonly family_kind: "exact_family" | "outer_enclosure";
  readonly conclusion: Readonly<Record<string, unknown>> | null;
  readonly applicability: DecisionAnalysis["applicability"];
  readonly human_review: DecisionAnalysis["human_review"];
  readonly use: IntendedUse;
}
