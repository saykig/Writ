/**
 * `@covenant/analyzer` public API.
 *
 * Two capabilities over a canonical IR:
 *   - CORE-010 non-SMT lints, typed/scoped/versioned waivers, and the
 *     publication-profile gate;
 *   - CORE-011 Z3 bounded score analysis (gap / overlap / unreachable /
 *     monotonicity) with minimized, deterministic witnesses, plus a
 *     bounded-enumeration oracle that cross-checks the Z3 lowering.
 *
 * Diagnostics come from the unified `@covenant/domain` catalog.
 */

// Four-valued truth kernel (peer re-implementation; not imported from evaluator).
export {
  truth,
  truthName,
  not,
  and,
  or,
  all,
  any,
  isDefinitelyTrue,
  isDefinitelyFalse,
  isUncertain,
  type Truth,
  type TruthName,
} from "./truth.js";

// Four-valued evaluation over a fact environment (enumeration + interval logic).
export { evaluateTruth, type Facts, type CountInterval } from "./semantics.js";

// Finite-domain plumbing.
export {
  canonicalKeys,
  enumerateAssignments,
  stableWitness,
  compareAssignments,
  modelVariable,
  modelVariables,
  type VarModel,
  type NumericVar,
  type CategoricalVar,
} from "./domains.js";

// CORE-011 — Z3 bounded score analysis and the enumeration cross-check.
export { analyzeScoreProgram, type ScoreAnalysisOptions } from "./score-analysis.js";
export { analyzeScoreProgramByEnumeration } from "./enumerate.js";

// CORE-010 — structural lints, waivers, publication profile.
export {
  lintIr,
  lintCommitment,
  lintProseMetric,
  type ProseClaim,
  type LintOptions,
} from "./lint.js";
export {
  applyWaivers,
  runPublicationProfile,
  isWellFormedWaiver,
  type Waiver,
  type WaiverContext,
  type WaivedDiagnostic,
  type ApplyWaiversResult,
  type PublicationProfileInput,
  type PublicationProfileResult,
} from "./waivers.js";

// Analyzer-local types.
export type {
  DomainValue,
  FiniteDomains,
  Assignment,
  Witness,
  MonotonicityWitness,
  MonotonicitySpec,
  ScoreAnalysis,
} from "./types.js";
