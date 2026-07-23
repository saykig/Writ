// Filesystem locations of the benchmark data artifacts (deliverables).
//
// All paths resolve against the repository `benchmark/2025-ai-sme/` data
// directory, independent of the current working directory.

import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** Absolute path to `benchmark/2025-ai-sme/`. */
export const BENCHMARK_DIR = fileURLToPath(
  new URL("../../../benchmark/2025-ai-sme/", import.meta.url),
);

export const SOURCES_PATH = join(BENCHMARK_DIR, "sources.json");
export const INVENTORY_PATH = join(BENCHMARK_DIR, "methodology-inventory.json");
export const LEDGER_PATH = join(BENCHMARK_DIR, "discrepancy-ledger.json");
export const EVIDENCE_DIR = join(BENCHMARK_DIR, "evidence");
export const PROFILES_DIR = join(BENCHMARK_DIR, "profiles");

/** Path to a member's evidence snapshot, e.g. `evidence/canada.snapshot.json`. */
export const snapshotPath = (memberId: string): string =>
  join(EVIDENCE_DIR, `${memberId}.snapshot.json`);

/** Path to an interpretation profile, e.g. `profiles/published.profile.json`. */
export const profilePath = (name: string): string => join(PROFILES_DIR, `${name}.profile.json`);
