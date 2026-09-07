import type { EngineOptions } from "@writ/decision-case";

import { SharedAnalysisError } from "./errors.js";
import type {
  ApplicabilityAssessmentDeclaration,
  BundleImport,
  LoadedSharedAnalysis,
  RecipientReplay,
  RecomputedAnalysis,
  RecomputeRequest,
  RevisionDeclaration,
  RevisionImpact,
  SharedAnalysisInspection,
} from "./types.js";

function pending(): never {
  throw new SharedAnalysisError(
    "SHARED_ANALYSIS_NOT_IMPLEMENTED",
    "The common shared-analysis contract is intentionally unimplemented on the comparison base.",
  );
}

/** Import exact native case bundles without promoting their local IDs to global identity. */
export function importSharedAnalyses(
  _workspaceId: string,
  _bundles: readonly BundleImport[],
): LoadedSharedAnalysis {
  return pending();
}

/** Derive shared source identity and model disagreement from the portable evidence. */
export function inspectSharedAnalyses(_workspace: LoadedSharedAnalysis): SharedAnalysisInspection {
  return pending();
}

/** Append an explicit supplied event. Version labels and prose never imply a revision. */
export function recordRevision(
  _workspace: LoadedSharedAnalysis,
  _revision: RevisionDeclaration,
): LoadedSharedAnalysis {
  return pending();
}

/** Explain direct and downstream effects under the declared bounded inventory. */
export function assessRevision(
  _workspace: LoadedSharedAnalysis,
  _revisionId: string,
): RevisionImpact {
  return pending();
}

/** Record a declaration bound to the exact revision, sources, mappings and context. */
export function reassessApplicability(
  _workspace: LoadedSharedAnalysis,
  _assessment: ApplicabilityAssessmentDeclaration,
): LoadedSharedAnalysis {
  return pending();
}

/** Solve and freshly check a declared successor; calculation cannot create applicability. */
export function recomputeAnalysis(
  _workspace: LoadedSharedAnalysis,
  _request: RecomputeRequest,
  _options: EngineOptions,
): RecomputedAnalysis {
  return pending();
}

/** Exact portable bytes containing evidence and declarations, never a cached derived graph. */
export function exportSharedAnalysis(_workspace: LoadedSharedAnalysis): Uint8Array {
  return pending();
}

/** Open and fully validate an exported shared-analysis archive. */
export function openSharedAnalysis(_bytes: Uint8Array): LoadedSharedAnalysis {
  return pending();
}

/** Reconstruct revision effects and freshly check stored numerical candidates. */
export function replaySharedAnalysis(_bytes: Uint8Array, _options: EngineOptions): RecipientReplay {
  return pending();
}
