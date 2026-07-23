/**
 * The real Covenant toolchain, wrapped for the studio server.
 *
 * Every function here runs the checked-in semantic packages server-side — the
 * language front end, the deterministic evaluator, the bounded score analyzer,
 * and the frozen 2025 AI-for-SMEs benchmark. Nothing is reimplemented or mocked;
 * the studio only orchestrates and shapes results for the browser.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileSource, type LanguageDiagnostic } from "@covenant/language";
import { evaluateCommitment } from "@covenant/evaluator";
import {
  enrichSnapshotForProfile,
  profilePath,
  runBenchmark,
  snapshotPath,
  type DiscrepancyLedger,
} from "@covenant/benchmark";
import type {
  CanonicalIr,
  Diagnostic,
  EvaluationReceipt,
  Evidence,
  InterpretationProfile,
} from "@covenant/domain";
import { analyzeCommitment } from "./analysis.js";

const COMMITMENT_ID = "AI_SME_ADOPTION";

/** Resolve a path inside the repository `examples/` directory. */
function examplePath(fileName: string): string {
  return fileURLToPath(new URL(`../../../examples/${fileName}`, import.meta.url));
}

// --- Examples ---------------------------------------------------------------

/** A checked-in `.covenant` methodology surfaced to the playground. */
export interface StudioExample {
  readonly id: string;
  readonly title: string;
  readonly reading: string;
  readonly outcome: "gap" | "overlap" | "clean";
  readonly note: string;
  readonly source: string;
}

interface ExampleSeed {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly reading: string;
  readonly outcome: StudioExample["outcome"];
  readonly note: string;
}

const EXAMPLE_SEEDS: readonly ExampleSeed[] = [
  {
    id: "literal",
    file: "2025-ai-sme-literal.covenant",
    title: "Literal reading",
    reading: "up to four → 1–4 strong",
    outcome: "gap",
    note: "Reads “up to four strong actions” as the range 1–4. Zero strong with several weak matches no rule: an uncovered region the score program cannot resolve.",
  },
  {
    id: "resolved",
    file: "2025-ai-sme-resolved.covenant",
    title: "Resolved reading",
    reading: "exhaustive, counter-precedence",
    outcome: "clean",
    note: "The interpretation made explicit: a total, non-overlapping score program with counteraction precedence stated as a governed parameter. No gaps, no overlaps.",
  },
  {
    id: "inclusive",
    file: "2025-ai-sme-inclusive-up-to.covenant",
    title: "Inclusive reading",
    reading: "up to four → 0–4 strong",
    outcome: "overlap",
    note: "Reads the same phrase inclusively (0–4 strong). Now the zero-strong, low-weak state is scored by two rules at once with different results: an unmarked overlap.",
  },
];

let examplesCache: readonly StudioExample[] | undefined;

/** The playground's three readings of the 2025 AI-for-SMEs scoring language. */
export function loadExamples(): readonly StudioExample[] {
  if (examplesCache === undefined) {
    examplesCache = EXAMPLE_SEEDS.map((seed) => ({
      id: seed.id,
      title: seed.title,
      reading: seed.reading,
      outcome: seed.outcome,
      note: seed.note,
      source: readFileSync(examplePath(seed.file), "utf8"),
    }));
  }
  return examplesCache;
}

// --- Compile ----------------------------------------------------------------

/** Result of compiling one source document to canonical IR. */
export interface CompileResponse {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly schemaValid: boolean;
  readonly schemaErrors: readonly { instancePath: string; message: string }[];
  readonly ir?: CanonicalIr;
}

/** Parse, link, type-check, and lower `source` to canonical IR. */
export function compile(source: string): CompileResponse {
  const result = compileSource(source, { fileName: "playground.covenant" });
  return {
    diagnostics: result.diagnostics,
    schemaValid: result.schemaValid,
    schemaErrors: result.schemaErrors,
    ...(result.ir ? { ir: result.ir } : {}),
  };
}

// --- Analyze ----------------------------------------------------------------

/** Score-analysis findings, plus the compile diagnostics that gate them. */
export interface AnalyzeResponse {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly findings: readonly Diagnostic[];
  readonly compiled: boolean;
}

/**
 * Compile `source`, then run the bounded score analysis over each commitment's
 * declared assertion domains. Findings carry the minimized witness assignment.
 */
export function analyze(source: string): AnalyzeResponse {
  const result = compileSource(source, { fileName: "playground.covenant" });
  const findings: Diagnostic[] = [];
  if (result.ir) {
    for (const commitment of result.ir.commitments) {
      findings.push(...analyzeCommitment(commitment));
    }
  }
  return {
    diagnostics: result.diagnostics,
    findings,
    compiled: result.ir !== undefined,
  };
}

// --- Evaluate ---------------------------------------------------------------

/** Outcome of evaluating a compiled methodology against one member snapshot. */
export interface EvaluateResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly diagnostics?: readonly LanguageDiagnostic[];
  readonly member?: string;
  readonly profile?: string;
  readonly receipt?: EvaluationReceipt;
}

const PROFILE_NAMES = new Set(["published", "generous"]);

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Compile `source` and evaluate its first commitment against `member`'s frozen
 * evidence snapshot under the named interpretation profile (default published),
 * returning the deterministic, content-addressed receipt.
 */
export function evaluate(
  source: string,
  member: string,
  profileName: string = "published",
): EvaluateResponse {
  const compiled = compileSource(source, { fileName: "playground.covenant" });
  if (compiled.ir === undefined) {
    return {
      ok: false,
      error: "Source did not compile to IR; fix the diagnostics before evaluating.",
      diagnostics: compiled.diagnostics,
    };
  }
  const profileKey = PROFILE_NAMES.has(profileName) ? profileName : "published";

  let snapshot: Evidence;
  let profile: InterpretationProfile;
  try {
    snapshot = loadJson<Evidence>(snapshotPath(member));
    profile = loadJson<InterpretationProfile>(profilePath(profileKey));
  } catch {
    return { ok: false, error: `No evidence snapshot for member "${member}".` };
  }

  const hasCommitment = compiled.ir.commitments.some((c) => c.id === COMMITMENT_ID);
  try {
    const receipt = evaluateCommitment({
      ir: compiled.ir,
      ...(hasCommitment ? { commitmentId: COMMITMENT_ID } : {}),
      snapshot: enrichSnapshotForProfile(snapshot, profile),
      subject: member,
      profile,
    });
    return { ok: true, member, profile: profileKey, receipt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Evaluation failed.",
    };
  }
}

// --- Benchmark --------------------------------------------------------------

/** One member's reproduced cell, enriched with per-profile detail. */
export interface BenchmarkCell {
  readonly member: string;
  readonly published: string;
  readonly computed: string;
  readonly generous: string;
  readonly match: boolean;
  readonly flips: boolean;
  readonly sensitive: boolean;
  readonly qualifying: number;
  readonly note: string;
}

/** The full benchmark payload: the governed ledger plus a per-member matrix. */
export interface BenchmarkResponse {
  readonly commitmentId: string;
  readonly methodologyVersionId: string;
  readonly summary: DiscrepancyLedger["summary"];
  readonly cells: readonly BenchmarkCell[];
}

let benchmarkCache: BenchmarkResponse | undefined;

/** Reproduce all eight member scores from frozen evidence (memoized). */
export function benchmark(): BenchmarkResponse {
  if (benchmarkCache !== undefined) return benchmarkCache;

  const run = runBenchmark();
  const sensitivityByMember = new Map(
    run.ledger.interpretation_sensitivity.map((entry) => [entry.member, entry]),
  );

  const cells: BenchmarkCell[] = run.ledger.cells.map((cell) => {
    const sensitivity = sensitivityByMember.get(cell.member);
    const receipt = run.receipts.get(cell.member);
    return {
      member: cell.member,
      published: cell.published,
      computed: cell.computed,
      generous: sensitivity?.generous_profile_result ?? cell.computed,
      match: cell.match,
      flips: sensitivity?.flips ?? false,
      sensitive: cell.category === "implicit_analyst_interpretation",
      qualifying: receipt?.qualifying_action_ids?.length ?? 0,
      note: cell.note,
    };
  });

  benchmarkCache = {
    commitmentId: run.ledger.commitment_id,
    methodologyVersionId: run.ledger.methodology_version_id,
    summary: run.ledger.summary,
    cells,
  };
  return benchmarkCache;
}
