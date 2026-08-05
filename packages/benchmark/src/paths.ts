// Filesystem locations for the independent G7 political corpus and the
// historical evaluator benchmark that consumes it.

import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT_REL = `${"../".repeat(3)}`;
const REPOSITORY_ROOT = fileURLToPath(new URL(ROOT_REL, import.meta.url));

export const G7_CORPUS_DIR = join(REPOSITORY_ROOT, "archive/compatibility/g7/2025-ai-sme");
export const BENCHMARK_DIR = join(
  REPOSITORY_ROOT,
  "internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction",
);

export const G7_SOURCE_MANIFEST_PATH = join(G7_CORPUS_DIR, "sources/source-manifest.json");
export const G7_ACTORS_PATH = join(G7_CORPUS_DIR, "records/actors.json");
export const G7_ACTIONS_PATH = join(G7_CORPUS_DIR, "records/actions.json");
export const G7_JUDGMENTS_PATH = join(G7_CORPUS_DIR, "records/published-judgments.json");
export const ASSIGNMENTS_PATH = join(BENCHMARK_DIR, "assignments.json");
export const INVENTORY_PATH = join(BENCHMARK_DIR, "methodology-inventory.json");
export const LEDGER_PATH = join(BENCHMARK_DIR, "discrepancy-ledger.json");
export const EVIDENCE_DIR = join(BENCHMARK_DIR, "evidence");
export const PROFILES_DIR = join(BENCHMARK_DIR, "profiles");

/** Backward-compatible alias for the source manifest used by older callers. */
export const SOURCES_PATH = G7_SOURCE_MANIFEST_PATH;

export const snapshotPath = (memberId: string): string =>
  join(EVIDENCE_DIR, `${memberId}.snapshot.json`);

export const profilePath = (name: string): string => join(PROFILES_DIR, `${name}.profile.json`);
