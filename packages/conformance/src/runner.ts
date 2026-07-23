/**
 * Canonical runner for the Writ core conformance suite (task CORE-012).
 *
 * The corpus at `conformance/cases/**` is pure, implementation-independent data.
 * This runner is one consumer of it: it loads every case, dispatches on `kind`
 * to the real `@writ/*` semantic APIs, and compares the produced value to the
 * case's `expected` by structural deep-equality. An alternate evaluator can reuse
 * `loadCases` / `runCase` / `runAll` by swapping the dispatch table for its own
 * engine; the case data and the pass/fail contract are unchanged.
 *
 * The runner is pure: no wall-clock, no randomness. Every operation is a total
 * function of the frozen case input.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  EvalContext,
  all,
  and,
  any,
  classifyBlock,
  compareCountIntervals,
  evaluate,
  evaluateCommitment,
  evaluateQuery,
  evaluateScore,
  evaluateTruth,
  not,
  or,
  truth,
  truthName,
  verifyReceipt,
  type Environment,
  type EvidenceRecord,
} from "@writ/evaluator";
import { analyzeScoreProgram, type FiniteDomains } from "@writ/analyzer";
import {
  canonicalJson,
  methodologyBundleHash,
  receiptHash,
  sha256Canonical,
} from "@writ/provenance";
import {
  validate,
  type ActionIdentity,
  type CanonicalIr,
  type ClassificationBlock,
  type Diagnostic,
  type Evidence,
  type Expr,
  type QueryExpr,
  type ScoreProgram,
  type TruthName,
} from "@writ/domain";

/** The ten semantic areas of the conformance corpus (04_FORMAL_SEMANTICS.md §19). */
export const AREAS = [
  "truth",
  "expressions",
  "temporal",
  "quantities",
  "identity",
  "classification",
  "scoring",
  "proofs",
  "canonicalization",
  "diagnostics",
] as const;

export type Area = (typeof AREAS)[number];

/** A single declarative conformance case (see conformance/README.md). */
export interface ConformanceCase {
  readonly id: string;
  readonly area: Area;
  readonly kind: string;
  readonly description: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly expected: unknown;
}

/** The outcome of running one case against an engine. */
export interface RunResult {
  readonly id: string;
  readonly area: string;
  readonly kind: string;
  readonly passed: boolean;
  readonly actual: unknown;
  readonly expected: unknown;
  /** Present when the case threw (a broken invariant or an engine error). */
  readonly error?: string;
}

// --- Loading -----------------------------------------------------------------

/** Absolute path to the corpus `cases/` directory (repo-root `conformance/`). */
export function casesDir(): string {
  return fileURLToPath(new URL("../../../conformance/cases", import.meta.url));
}

/**
 * Load every case from a corpus directory (recursively). A file holds either a
 * single case object or an array of case objects. Cases are returned sorted by
 * `id` so a run is deterministic and order-independent.
 */
export function loadCases(dir: string = casesDir()): ConformanceCase[] {
  const entries = readdirSync(dir, { recursive: true }) as string[];
  const cases: ConformanceCase[] = [];
  for (const rel of entries) {
    if (!rel.endsWith(".json")) continue;
    const parsed: unknown = JSON.parse(readFileSync(join(dir, rel), "utf8"));
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of list) cases.push(item as ConformanceCase);
  }
  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

// --- Structural comparison ---------------------------------------------------

/** Deep structural equality: objects order-insensitive, arrays order-sensitive. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((element, index) => deepEqual(element, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length) return false;
    if (!ka.every((key, index) => key === kb[index])) return false;
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    return ka.every((key) => deepEqual(ao[key], bo[key]));
  }
  return false;
}

// --- Helpers -----------------------------------------------------------------

const FROZEN_INSTANT = "2025-06-01T00:00:00Z";

/** Build a typed evaluation environment from a case input's environment fields. */
function buildEnv(input: Readonly<Record<string, unknown>>): Environment {
  const facts = (input.facts as Readonly<Record<string, unknown>>) ?? {};
  const collections =
    (input.collections as Readonly<Record<string, readonly EvidenceRecord[]>>) ?? {};
  const identity =
    (input.identity as ActionIdentity | undefined) ??
    ({ policy: "strict_separate", key_paths: ["id"] } as ActionIdentity);
  const temporal = (input.temporal as { as_of: string; cutoff: string } | undefined) ?? {
    as_of: FROZEN_INSTANT,
    cutoff: FROZEN_INSTANT,
  };
  const base: Environment = { facts, collections, actionIdentity: identity, temporal };
  const declaredSets = input.declaredSets as
    Readonly<Record<string, readonly string[]>> | undefined;
  const scoreDecisive = input.scoreDecisive as boolean | undefined;
  return {
    ...base,
    ...(declaredSets !== undefined ? { declaredSets } : {}),
    ...(scoreDecisive !== undefined ? { scoreDecisive } : {}),
  };
}

/** The sorted, de-duplicated set of diagnostic codes a run produced. */
function sortedCodes(diagnostics: readonly Diagnostic[]): string[] {
  return [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Project analyzer diagnostics to `{code, severity, witness?}`, sorted stably. */
function normalizeAnalysis(diagnostics: readonly Diagnostic[]): unknown[] {
  return diagnostics
    .map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      ...(diagnostic.witness !== undefined ? { witness: diagnostic.witness } : {}),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function hashByAlgorithm(input: Readonly<Record<string, unknown>>): string {
  const algorithm = input.algorithm as string | undefined;
  switch (algorithm) {
    case "receipt":
      return receiptHash(input.value);
    case "methodologyBundle":
      return methodologyBundleHash(input.value);
    case undefined:
    case "sha256Canonical":
      return sha256Canonical(input.value);
    default:
      throw new Error(`Unknown hash algorithm: ${algorithm}`);
  }
}

/**
 * Evaluate a commitment and enforce the receipt invariants (§16): schema-valid,
 * hash-verifiable, and byte-identical across two independent runs. Any breach
 * throws, failing the case. Returns the fields the case's `expected` pins.
 */
function runReceipt(input: Readonly<Record<string, unknown>>): {
  result: string;
  result_status: string;
  matched_rule_id: string | null;
} {
  const options = {
    ir: input.ir as CanonicalIr,
    snapshot: input.snapshot as Evidence,
    subject: input.subject as string,
    ...(input.commitmentId !== undefined ? { commitmentId: input.commitmentId as string } : {}),
    ...(input.as_of !== undefined ? { as_of: input.as_of as string } : {}),
    ...(input.cutoff !== undefined ? { cutoff: input.cutoff as string } : {}),
  };

  const receipt = evaluateCommitment(options);

  const validation = validate("evaluation-receipt", receipt);
  if (!validation.valid) {
    throw new Error(`Receipt is not schema-valid: ${JSON.stringify(validation.errors)}`);
  }

  const verified = verifyReceipt(receipt);
  if (!verified.valid) {
    throw new Error(
      `Receipt hash does not verify (expected ${verified.expected}, carried ${verified.actual}).`,
    );
  }

  const replay = evaluateCommitment(options);
  if (canonicalJson(receipt) !== canonicalJson(replay)) {
    throw new Error("Receipt canonical JSON is not byte-identical across two runs.");
  }
  if (receipt.canonical_hash !== replay.canonical_hash) {
    throw new Error("Receipt canonical_hash differs across two runs.");
  }

  const record = receipt as unknown as Record<string, unknown>;
  return {
    result: String(record.result),
    result_status: String(record.result_status),
    matched_rule_id:
      typeof record.matched_rule_id === "string" ? (record.matched_rule_id as string) : null,
  };
}

// --- Dispatch ----------------------------------------------------------------

/**
 * Run one case's operation and return the produced value. Dispatches on `kind`
 * to the canonical `@writ/*` APIs. Exported so an alternate engine can be
 * cross-checked by comparing its dispatch to this one over the same corpus.
 */
export async function produce(caseData: ConformanceCase): Promise<unknown> {
  const input = caseData.input;
  switch (caseData.kind) {
    case "truth.not":
      return truthName(not(truth(input.value as TruthName)));
    case "truth.and":
      return truthName(and(truth(input.left as TruthName), truth(input.right as TruthName)));
    case "truth.or":
      return truthName(or(truth(input.left as TruthName), truth(input.right as TruthName)));
    case "truth.all":
      return truthName(all((input.values as TruthName[]).map((name) => truth(name))));
    case "truth.any":
      return truthName(any((input.values as TruthName[]).map((name) => truth(name))));

    case "expr.evaluateTruth":
      return truthName(evaluateTruth(input.expr as Expr, buildEnv(input)));
    case "expr.evaluate": {
      const result = evaluate(input.expr as Expr, buildEnv(input));
      return { truth: truthName(result.truth), diagnostics: sortedCodes(result.diagnostics) };
    }
    case "compare.interval":
      return truthName(
        compareCountIntervals(
          input.op as "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
          input.left as { min: number; max: number },
          input.right as { min: number; max: number },
        ),
      );

    case "count.interval": {
      const ctx = new EvalContext(buildEnv(input));
      const result = evaluateQuery(input.query as QueryExpr, ctx);
      return {
        interval: result.countInterval ?? null,
        blocking: result.blocking ?? false,
        diagnostics: sortedCodes(ctx.diagnostics),
      };
    }

    case "classify.evaluate": {
      const ctx = new EvalContext(buildEnv(input));
      const result = classifyBlock(
        input.block as ClassificationBlock,
        ctx,
        input.record as EvidenceRecord | undefined,
      );
      return {
        label: result.label,
        labels: [...result.labels],
        unknownLabels: [...result.unknownLabels],
        contestedLabels: [...result.contestedLabels],
        status: result.status,
        diagnostics: sortedCodes(result.diagnostics),
      };
    }

    case "score.evaluate": {
      const ctx = new EvalContext(buildEnv({ facts: input.facts }));
      const outcome = evaluateScore(input.program as ScoreProgram, ctx);
      return {
        result: outcome.result,
        status: outcome.status,
        matchedRuleId: outcome.matchedRuleId ?? null,
        diagnostics: sortedCodes(outcome.diagnostics),
      };
    }

    case "score.analyze": {
      const objectId = input.objectId as string | undefined;
      const analysis = await analyzeScoreProgram(
        input.program as ScoreProgram,
        input.domains as FiniteDomains,
        objectId !== undefined ? { objectId } : {},
      );
      return normalizeAnalysis(analysis.diagnostics);
    }

    case "canonicalize":
      return canonicalJson(input.value, input.options as { dropFields?: string[] } | undefined);
    case "hash":
      return hashByAlgorithm(input);

    case "receipt.evaluate":
      return runReceipt(input);

    default:
      throw new Error(`Unknown case kind: ${caseData.kind}`);
  }
}

// --- Public run API ----------------------------------------------------------

/** Run a single case and compare the produced value to `expected`. */
export async function runCase(caseData: ConformanceCase): Promise<RunResult> {
  try {
    const actual = await produce(caseData);
    return {
      id: caseData.id,
      area: caseData.area,
      kind: caseData.kind,
      passed: deepEqual(actual, caseData.expected),
      actual,
      expected: caseData.expected,
    };
  } catch (error) {
    return {
      id: caseData.id,
      area: caseData.area,
      kind: caseData.kind,
      passed: false,
      actual: undefined,
      expected: caseData.expected,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Run the whole corpus (or a supplied subset) and return every result. */
export async function runAll(cases: ConformanceCase[] = loadCases()): Promise<RunResult[]> {
  const results: RunResult[] = [];
  for (const caseData of cases) {
    results.push(await runCase(caseData));
  }
  return results;
}
