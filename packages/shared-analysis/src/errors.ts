export type SharedAnalysisDiagnosticCode =
  | "SHARED_ANALYSIS_INVALID"
  | "SHARED_ANALYSIS_BUNDLE_CONFLICT"
  | "SHARED_ANALYSIS_SOURCE_CONFLICT"
  | "SHARED_ANALYSIS_REFERENCE_UNRESOLVED"
  | "SHARED_ANALYSIS_ANALYSIS_NOT_FOUND"
  | "SHARED_ANALYSIS_REVISION_NOT_FOUND"
  | "SHARED_ANALYSIS_REVISION_INVALID"
  | "SHARED_ANALYSIS_DEPENDENCY_CYCLE"
  | "SHARED_ANALYSIS_REASSESSMENT_REQUIRED"
  | "SHARED_ANALYSIS_REASSESSMENT_STALE";

export class SharedAnalysisError extends Error {
  constructor(
    readonly code: SharedAnalysisDiagnosticCode,
    message: string,
    readonly detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "SharedAnalysisError";
  }
}
