// `@covenant/benchmark` — the 2025 G7 AI-for-SMEs benchmark.
//
// Reproduces the published per-member scores from a frozen evidence snapshot and
// the resolved methodology, and records the interpretation-sensitive cells in a
// governed discrepancy ledger.

export { MEMBERS, type MemberSeed, type ActionSeed, type Classification } from "./members.js";

export {
  buildMemberSnapshot,
  enrichSnapshotForProfile,
  buildSourceManifest,
  sourceDocumentVersion,
  generalMeasureChoice,
  instrumentId,
  SOURCE_SHA256,
  SOURCE_URI,
  CUTOFF,
  FROZEN_AT,
  INTERPRETATION_TAG,
  RUBRIC_PREDICATE,
  GENERAL_MEASURE_DECISION_ID,
  METHODOLOGY_PASSAGES,
} from "./evidence.js";

export {
  compileResolvedCovenant,
  resolvedIr,
  resolvedCommitment,
  resolvedBundleHash,
  methodologyVersionId,
  RESOLVED_COVENANT_PATH,
} from "./methodology.js";

export { buildProfile, sensitiveInstrumentIds, type ProfileKind } from "./profiles.js";

export { buildMethodologyInventory } from "./inventory.js";

export { generateArtifacts } from "./generate.js";

export { replicate, recomputeContentHash, type Check } from "./replicate.js";

export {
  runBenchmark,
  writeDiscrepancyLedger,
  type BenchmarkRun,
  type DiscrepancyLedger,
  type LedgerCell,
  type SensitivityEntry,
} from "./run.js";

export {
  BENCHMARK_DIR,
  SOURCES_PATH,
  INVENTORY_PATH,
  LEDGER_PATH,
  EVIDENCE_DIR,
  PROFILES_DIR,
  snapshotPath,
  profilePath,
} from "./paths.js";
