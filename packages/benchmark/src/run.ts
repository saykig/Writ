// The benchmark runner.
//
// Compiles the resolved writ to IR, then for each of the eight subjects
// loads its frozen evidence snapshot, enriches it under an interpretation
// profile, and calls `evaluateCommitment` to obtain a receipt. The published
// profile reproduces the published cell; the generous profile records
// interpretation-sensitivity. The per-cell comparison is written to
// `internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/discrepancy-ledger.json`.
//
// Scores are produced by `evaluateCommitment` over the anchored evidence — never
// hardcoded here. This module only compares and records.

import { readFileSync, writeFileSync } from "node:fs";
import { evaluateCommitment } from "@writ/evaluator";
import type {
  EvaluationReceipt,
  Evidence,
  InterpretationProfile,
  MethodologyInventory,
} from "@writ/domain";
import { resolvedIr, methodologyVersionId } from "./methodology.js";
import { projectSnapshotForProfile, type ClassificationProjectionDiagnostic } from "./evidence.js";
import {
  G7_JUDGMENTS_PATH,
  INVENTORY_PATH,
  LEDGER_PATH,
  profilePath,
  snapshotPath,
} from "./paths.js";

const COMMITMENT_ID = "AI_SME_ADOPTION";
const BENCHMARK_REFERENCE = "2025-ai-sme";

/** A published/computed score cell in the discrepancy ledger. */
export interface LedgerCell {
  readonly member: string;
  readonly published: "-1" | "0" | "+1";
  readonly computed: "-1" | "0" | "+1" | "unresolved" | "not_applicable";
  readonly match: boolean;
  readonly category: "implicit_analyst_interpretation" | "none";
  readonly note: string;
}

/** How a cell moves when the generous interpretation is applied instead. */
export interface SensitivityEntry {
  readonly member: string;
  readonly published_profile_result: string;
  readonly generous_profile_result: string;
  readonly flips: boolean;
  readonly note: string;
}

/** The governed discrepancy ledger written to disk. */
export interface DiscrepancyLedger {
  readonly schema_version: "1.0.0";
  readonly benchmark_reference: string;
  readonly commitment_id: string;
  readonly methodology_version_id: string;
  readonly profile: string;
  readonly generated_note: string;
  readonly summary: {
    readonly cells: number;
    readonly matches: number;
    readonly mismatches: number;
    readonly interpretation_sensitive_cells: number;
  };
  readonly cells: readonly LedgerCell[];
  readonly interpretation_sensitivity: readonly SensitivityEntry[];
}

/** The full outcome of a benchmark run (in-memory; nothing written). */
export interface BenchmarkRun {
  readonly ledger: DiscrepancyLedger;
  /** Published-profile receipts, keyed by subject id. */
  readonly receipts: ReadonlyMap<string, EvaluationReceipt>;
  /** Generous-profile receipts, keyed by subject id. */
  readonly generousReceipts: ReadonlyMap<string, EvaluationReceipt>;
  /** Explicit classification-projection diagnostics, keyed by subject id. */
  readonly classificationDiagnostics: ReadonlyMap<
    string,
    readonly ClassificationProjectionDiagnostic[]
  >;
}

interface SourceReportedJudgment {
  readonly subject_ref: string;
  readonly reported_value: "-1" | "0" | "+1";
  readonly origin: "source_reported";
  readonly writ_derived: false;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Run the benchmark end-to-end over the frozen artifacts (pure; no writes). */
export function runBenchmark(): BenchmarkRun {
  const ir = resolvedIr();
  const inventory = loadJson<MethodologyInventory>(INVENTORY_PATH);
  const published = loadJson<InterpretationProfile>(profilePath("published"));
  const generous = loadJson<InterpretationProfile>(profilePath("generous"));
  const sourceJudgments = new Map(
    loadJson<SourceReportedJudgment[]>(G7_JUDGMENTS_PATH).map((judgment) => [
      judgment.subject_ref.replace(/^actor-/, ""),
      judgment,
    ]),
  );

  const receipts = new Map<string, EvaluationReceipt>();
  const generousReceipts = new Map<string, EvaluationReceipt>();
  const cells: LedgerCell[] = [];
  const sensitivity: SensitivityEntry[] = [];
  const classificationDiagnostics = new Map<
    string,
    readonly ClassificationProjectionDiagnostic[]
  >();

  for (const subject of inventory.subjects) {
    const snapshot = loadJson<Evidence>(snapshotPath(subject));
    const sourceJudgment = sourceJudgments.get(subject);
    if (sourceJudgment === undefined) {
      throw new Error(`G7 corpus has no source-reported judgment for "${subject}".`);
    }
    const publishedCell = sourceJudgment.reported_value;

    const publishedProjection = projectSnapshotForProfile(snapshot, published);
    const generousProjection = projectSnapshotForProfile(snapshot, generous);
    const receipt = evaluateCommitment({
      ir,
      commitmentId: COMMITMENT_ID,
      snapshot: publishedProjection.snapshot,
      subject,
      profile: published,
    });
    const generousReceipt = evaluateCommitment({
      ir,
      commitmentId: COMMITMENT_ID,
      snapshot: generousProjection.snapshot,
      subject,
      profile: generous,
    });
    receipts.set(subject, receipt);
    generousReceipts.set(subject, generousReceipt);
    classificationDiagnostics.set(subject, publishedProjection.diagnostics);

    const computed = receipt.result as LedgerCell["computed"];
    const generousResult = generousReceipt.result;
    const match = computed === publishedCell;
    const sensitive = generousResult !== computed;

    cells.push({
      member: subject,
      published: publishedCell,
      computed,
      match,
      category: sensitive ? "implicit_analyst_interpretation" : "none",
      note: sensitive
        ? `Match depends on reading general non-SME AI measures as weak; the generous reading yields ${generousResult}.`
        : `Computed from ${countStrong(receipt)} distinct strong actions; interpretation-independent.`,
    });

    sensitivity.push({
      member: subject,
      published_profile_result: computed,
      generous_profile_result: generousResult,
      flips: sensitive,
      note: sensitive
        ? `Flips ${computed} → ${generousResult} when general AI measures are read as strong.`
        : "Stable across the published and generous readings.",
    });
  }

  const matches = cells.filter((cell) => cell.match).length;
  const ledger: DiscrepancyLedger = {
    schema_version: "1.0.0",
    benchmark_reference: BENCHMARK_REFERENCE,
    commitment_id: COMMITMENT_ID,
    methodology_version_id: methodologyVersionId(),
    profile: "published",
    generated_note:
      "Every computed cell is produced by evaluateCommitment over reviewed, page-anchored evidence under the published profile. Sensitivity records the generous reading.",
    summary: {
      cells: cells.length,
      matches,
      mismatches: cells.length - matches,
      interpretation_sensitive_cells: cells.filter(
        (cell) => cell.category === "implicit_analyst_interpretation",
      ).length,
    },
    cells,
    interpretation_sensitivity: sensitivity,
  };

  return { ledger, receipts, generousReceipts, classificationDiagnostics };
}

/** Number of distinct strong actions a receipt's qualifying set implies. */
function countStrong(receipt: EvaluationReceipt): number {
  return (receipt.qualifying_action_ids ?? []).length;
}

/** Run the benchmark and write the discrepancy ledger to disk. */
export function writeDiscrepancyLedger(): DiscrepancyLedger {
  const { ledger } = runBenchmark();
  writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  return ledger;
}

if (import.meta.main) {
  const ledger = writeDiscrepancyLedger();
  const line = ledger.cells
    .map(
      (cell) =>
        `${cell.member}: published ${cell.published} / computed ${cell.computed} ${cell.match ? "✓" : "✗"}`,
    )
    .join("\n");
  process.stdout.write(`${line}\nWrote ${LEDGER_PATH}\n`);
}
