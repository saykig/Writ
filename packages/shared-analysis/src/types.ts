import type {
  CaseSourceDocument,
  DecisionExecution,
  EncodedBytes,
  EngineOptions,
} from "@writ/decision-case";

export type InventoryCompleteness = "complete" | "partial" | "unknown";

export interface AnalysisAddress {
  readonly bundle_id: string;
  readonly analysis_id: string;
}

export interface DependencyAddress extends AnalysisAddress {
  readonly dependency_id: string;
}

export interface SourceIdentity {
  readonly source_id: string;
  readonly document_version_id: string;
  readonly sha256: string;
}

export interface SupportRoute {
  readonly route_id: string;
  readonly statement_id: string;
  readonly statement_scope: string;
  readonly premise_sources: readonly SourceIdentity[];
}

export interface DependencyInventoryDeclaration {
  readonly scope: string;
  readonly completeness: InventoryCompleteness;
  readonly unresolved_references: readonly string[];
  readonly support_routes: readonly SupportRoute[];
}

export interface BundleImport {
  readonly bundle_id: string;
  readonly case_bytes: Uint8Array;
  readonly selected_analysis_ids: readonly string[];
  readonly inventory: DependencyInventoryDeclaration;
  readonly supplemental_sources?: readonly CaseSourceDocument[];
}

export interface PortableBundleImport {
  readonly bundle_id: string;
  readonly case_file: EncodedBytes;
  readonly selected_analysis_ids: readonly string[];
  readonly inventory: DependencyInventoryDeclaration;
  readonly supplemental_sources: readonly CaseSourceDocument[];
}

export interface AnalysisTransition {
  readonly prior: AnalysisAddress;
  readonly successor_case: EncodedBytes;
  readonly successor_analysis_id: string;
}

export interface ConflictingPremise {
  readonly statement_id: string;
  readonly statement_scope: string;
  readonly description: string;
  readonly source: SourceIdentity;
}

export interface RevisionDeclaration {
  readonly revision_id: string;
  readonly kind:
    "source_revision" | "source_withdrawal" | "assumption_withdrawal" | "metadata_change";
  readonly summary: string;
  readonly source_replacements: readonly {
    readonly from: SourceIdentity;
    readonly to: CaseSourceDocument;
  }[];
  readonly withdrawn_sources: readonly SourceIdentity[];
  readonly withdrawn_dependencies: readonly DependencyAddress[];
  readonly withdrawn_routes: readonly string[];
  readonly conflicting_premises: readonly ConflictingPremise[];
  readonly transitions: readonly AnalysisTransition[];
}

export interface ApplicabilityAssessmentDeclaration {
  readonly assessment_id: string;
  readonly revision_id: string;
  readonly analysis: AnalysisAddress;
  readonly basis_sha256: string;
  readonly status: "supported" | "needs_reassessment" | "unknown" | "contested";
  readonly rationale: string;
  readonly source_bindings: readonly SourceIdentity[];
  readonly assumption_dependencies: readonly DependencyAddress[];
  readonly mapping_sha256: string;
  readonly context_sha256: string;
}

export interface PortableExecution {
  readonly analysis: AnalysisAddress;
  readonly revision_id: string | null;
  readonly execution: EncodedBytes;
}

export interface SharedAnalysisArchive {
  readonly schema_version: "0.1.0";
  readonly archive_kind: "shared_analysis_revision";
  readonly workspace_id: string;
  readonly bundles: readonly PortableBundleImport[];
  readonly revisions: readonly RevisionDeclaration[];
  readonly applicability_assessments: readonly ApplicabilityAssessmentDeclaration[];
  readonly executions: readonly PortableExecution[];
}

export interface LoadedSharedAnalysis {
  readonly value: SharedAnalysisArchive;
  readonly archive_sha256: string;
}

export interface SharedSourceInspection {
  readonly identity: SourceIdentity;
  readonly bundles: readonly string[];
}

export interface AnalysisDifference {
  readonly left: AnalysisAddress;
  readonly right: AnalysisAddress;
  readonly shared_sources: readonly SourceIdentity[];
  readonly distinct_assumptions: readonly DependencyAddress[];
  readonly mathematical_subject_equal: boolean;
  readonly status: "different_models" | "same_declared_model" | "not_established";
}

export interface SharedAnalysisInspection {
  readonly analyses: readonly AnalysisAddress[];
  readonly shared_sources: readonly SharedSourceInspection[];
  readonly differences: readonly AnalysisDifference[];
  readonly unresolved_references: readonly { bundle_id: string; references: readonly string[] }[];
}

export interface DerivationPath {
  readonly analysis: AnalysisAddress;
  readonly nodes: readonly string[];
}

export interface AnalysisRevisionImpact {
  readonly analysis: AnalysisAddress;
  readonly status: "affected" | "unaffected" | "not_established";
  readonly direct_dependencies: readonly string[];
  readonly derivation_paths: readonly DerivationPath[];
  readonly original_mathematical_check_valid: boolean;
  readonly mathematical_check_reusable: boolean;
  readonly applicability_requires_reassessment: boolean;
  readonly surviving_support_routes: readonly string[];
  readonly withdrawn_support_routes: readonly string[];
  readonly visible_conflicts: readonly ConflictingPremise[];
  readonly unresolved_references: readonly string[];
}

export interface RevisionImpact {
  readonly revision_id: string;
  readonly basis_sha256: string;
  readonly inventory_scope: readonly {
    bundle_id: string;
    completeness: InventoryCompleteness;
  }[];
  readonly impacts: readonly AnalysisRevisionImpact[];
}

export interface RecomputeRequest {
  readonly revision_id: string;
  readonly prior: AnalysisAddress;
  readonly successor_analysis_id: string;
  readonly applicability_assessment_id: string;
}

export interface RecomputedAnalysis {
  readonly workspace: LoadedSharedAnalysis;
  readonly execution: DecisionExecution;
}

export interface RecipientReplay {
  readonly archive_sha256: string;
  readonly revision_impacts: readonly RevisionImpact[];
  readonly freshly_checked: readonly {
    analysis: AnalysisAddress;
    mathematical_status: string;
  }[];
}

export type ReplayOptions = EngineOptions;
