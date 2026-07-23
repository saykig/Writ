/**
 * The real Covenant toolchain, wrapped for the site's server layer.
 *
 * Every function runs the checked-in semantic packages server-side — the
 * language front end, the deterministic evaluator, the bounded score analyzer,
 * and the frozen 2025 AI-for-SMEs benchmark data. Nothing is reimplemented; the
 * site only orchestrates and shapes results. Repo data is read via `repo.ts`.
 */

import { compileSource, type LanguageDiagnostic } from "@covenant/language";
import { evaluateCommitment, verifyReceipt } from "@covenant/evaluator";
import { enrichSnapshotForProfile, type DiscrepancyLedger } from "@covenant/benchmark";
import type {
  CanonicalIr,
  Diagnostic,
  EvaluationReceipt,
  Evidence,
  InterpretationProfile,
} from "@covenant/domain";
import { analyzeCommitment } from "./analysis.js";
import { BENCH_DIR, readRepoJson, readRepoText, repoFileExists } from "./repo.js";

const COMMITMENT_ID = "AI_SME_ADOPTION";
const PROFILE_NAMES = new Set(["published", "generous"]);

// --- Examples ---------------------------------------------------------------

export interface StudioExample {
  readonly id: string;
  readonly title: string;
  readonly reading: string;
  readonly outcome: "gap" | "overlap" | "clean";
  readonly note: string;
  readonly source: string;
}

const EXAMPLE_SEEDS = [
  {
    id: "literal",
    file: "2025-ai-sme-literal.covenant",
    title: "Literal reading",
    reading: "up to four → 1–4 strong",
    outcome: "gap" as const,
    note: "Reads “up to four strong actions” as the range 1–4. Zero strong with several weak matches no rule: an uncovered region the score program cannot resolve.",
  },
  {
    id: "resolved",
    file: "2025-ai-sme-resolved.covenant",
    title: "Resolved reading",
    reading: "exhaustive, counter-precedence",
    outcome: "clean" as const,
    note: "The interpretation made explicit: a total, non-overlapping score program with counteraction precedence stated as a governed parameter. No gaps, no overlaps.",
  },
  {
    id: "inclusive",
    file: "2025-ai-sme-inclusive-up-to.covenant",
    title: "Inclusive reading",
    reading: "up to four → 0–4 strong",
    outcome: "overlap" as const,
    note: "Reads the same phrase inclusively (0–4 strong). Now the zero-strong, low-weak state is scored by two rules at once with different results: an unmarked overlap.",
  },
];

let examplesCache: readonly StudioExample[] | undefined;

export function loadExamples(): readonly StudioExample[] {
  if (examplesCache === undefined) {
    examplesCache = EXAMPLE_SEEDS.map((seed) => ({
      id: seed.id,
      title: seed.title,
      reading: seed.reading,
      outcome: seed.outcome,
      note: seed.note,
      source: readRepoText(`examples/${seed.file}`),
    }));
  }
  return examplesCache;
}

export function exampleSource(id: string): string | undefined {
  return loadExamples().find((example) => example.id === id)?.source;
}

// --- Compile ----------------------------------------------------------------

export interface CompileResponse {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly schemaValid: boolean;
  readonly schemaErrors: readonly { instancePath: string; message: string }[];
  readonly ir?: CanonicalIr;
}

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

export interface AnalyzeResponse {
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly findings: readonly Diagnostic[];
  readonly compiled: boolean;
}

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

export interface EvaluateResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly diagnostics?: readonly LanguageDiagnostic[];
  readonly member?: string;
  readonly profile?: string;
  readonly receipt?: EvaluationReceipt;
}

function snapshotRel(member: string): string {
  return `${BENCH_DIR}/evidence/${member}.snapshot.json`;
}
function profileRel(name: string): string {
  return `${BENCH_DIR}/profiles/${name}.profile.json`;
}

function loadSnapshotAndProfile(
  member: string,
  profileKey: string,
): { snapshot: Evidence; profile: InterpretationProfile } | undefined {
  if (!repoFileExists(snapshotRel(member))) return undefined;
  const snapshot = readRepoJson<Evidence>(snapshotRel(member));
  const profile = readRepoJson<InterpretationProfile>(profileRel(profileKey));
  return { snapshot, profile };
}

/** Compile `source` and evaluate its AI-SME commitment against a member snapshot. */
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
  const loaded = loadSnapshotAndProfile(member, profileKey);
  if (!loaded) return { ok: false, error: `No evidence snapshot for member "${member}".` };

  const hasCommitment = compiled.ir.commitments.some((c) => c.id === COMMITMENT_ID);
  try {
    const receipt = evaluateCommitment({
      ir: compiled.ir,
      ...(hasCommitment ? { commitmentId: COMMITMENT_ID } : {}),
      snapshot: enrichSnapshotForProfile(loaded.snapshot, loaded.profile),
      subject: member,
      profile: loaded.profile,
    });
    return { ok: true, member, profile: profileKey, receipt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Evaluation failed." };
  }
}

/** Verify a receipt's content hash (tamper detection). */
export function verify(receipt: EvaluationReceipt): {
  valid: boolean;
  expected: string;
  actual: string;
} {
  return verifyReceipt(receipt);
}

// --- Benchmark --------------------------------------------------------------

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

export interface BenchmarkResponse {
  readonly commitmentId: string;
  readonly methodologyVersionId: string;
  readonly summary: DiscrepancyLedger["summary"];
  readonly cells: readonly BenchmarkCell[];
}

let resolvedIrCache: CanonicalIr | undefined;
function resolvedIr(): CanonicalIr {
  if (resolvedIrCache === undefined) {
    const source = readRepoText("examples/2025-ai-sme-resolved.covenant");
    const compiled = compileSource(source, { fileName: "2025-ai-sme-resolved.covenant" });
    if (!compiled.ir) throw new Error("Resolved methodology failed to compile.");
    resolvedIrCache = compiled.ir;
  }
  return resolvedIrCache;
}

/** Evaluate the resolved methodology against a member under a profile (real receipt). */
export function evaluateMember(
  member: string,
  profileKey = "published",
): EvaluationReceipt | undefined {
  const loaded = loadSnapshotAndProfile(
    member,
    PROFILE_NAMES.has(profileKey) ? profileKey : "published",
  );
  if (!loaded) return undefined;
  return evaluateCommitment({
    ir: resolvedIr(),
    commitmentId: COMMITMENT_ID,
    snapshot: enrichSnapshotForProfile(loaded.snapshot, loaded.profile),
    subject: member,
    profile: loaded.profile,
  });
}

export function benchmarkLedger(): DiscrepancyLedger {
  return readRepoJson<DiscrepancyLedger>(`${BENCH_DIR}/discrepancy-ledger.json`);
}

let benchmarkCache: BenchmarkResponse | undefined;

export function benchmark(): BenchmarkResponse {
  if (benchmarkCache !== undefined) return benchmarkCache;
  const ledger = benchmarkLedger();
  const sensitivityByMember = new Map(
    ledger.interpretation_sensitivity.map((entry) => [entry.member, entry]),
  );
  const cells: BenchmarkCell[] = ledger.cells.map((cell) => {
    const sensitivity = sensitivityByMember.get(cell.member);
    let qualifying = 0;
    try {
      qualifying = evaluateMember(cell.member, "published")?.qualifying_action_ids?.length ?? 0;
    } catch {
      qualifying = 0;
    }
    return {
      member: cell.member,
      published: cell.published,
      computed: cell.computed,
      generous: sensitivity?.generous_profile_result ?? cell.computed,
      match: cell.match,
      flips: sensitivity?.flips ?? false,
      sensitive: cell.category === "implicit_analyst_interpretation",
      qualifying,
      note: cell.note,
    };
  });
  benchmarkCache = {
    commitmentId: ledger.commitment_id,
    methodologyVersionId: ledger.methodology_version_id,
    summary: ledger.summary,
    cells,
  };
  return benchmarkCache;
}

/** A member's frozen evidence snapshot (for the benchmark drill-down). */
export function memberSnapshot(member: string): Evidence | undefined {
  if (!repoFileExists(snapshotRel(member))) return undefined;
  return readRepoJson<Evidence>(snapshotRel(member));
}
