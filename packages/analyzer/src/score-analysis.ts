/**
 * CORE-011: bounded score analysis over finite domains via Z3.
 *
 * Detects, with minimized and deterministic witnesses:
 *   - WRT-SCORE-GAP          an assignment where no rule is decisively true and
 *                            `otherwise` is not a safe catch-all;
 *   - WRT-SCORE-OVERLAP      two equal-priority rules decisively true at once
 *                            (error if their results differ, warning if equal);
 *   - WRT-SCORE-UNREACHABLE  a rule decisively true in no assignment;
 *   - WRT-SCORE-MONOTONICITY a counterexample to a declared `monotonic` axis.
 *
 * Witnesses are minimized lexicographically in canonical (alphabetical) variable
 * order, which reproduces the reference enumeration's first-hit witness, and the
 * solver runs synchronously with a fixed configuration, so output is stable.
 */

import type { Diagnostic, ScoreProgram } from "@writ/domain";
import { canonicalKeys, stableWitness } from "./domains.js";
import {
  buildGap,
  buildMonotonicity,
  buildOverlap,
  buildUnreachable,
  sortDiagnostics,
  type Location,
} from "./score-diagnostics.js";
import { ScoreLowering } from "./z3-lowering.js";
import { checkOptimize, createZ3Api, type Z3Api, type Z3Expr } from "./z3-context.js";
import type { FiniteDomains, MonotonicitySpec, ScoreAnalysis } from "./types.js";

export interface ScoreAnalysisOptions {
  /** Object id (commitment / program) recorded on each diagnostic. */
  readonly objectId?: string;
  /** Monotonicity axes to check. */
  readonly monotonic?: readonly MonotonicitySpec[];
}

const RESULT_SENTINEL = -100;

function resultToInt(result: string): number {
  switch (result) {
    case "+1":
      return 1;
    case "0":
      return 0;
    case "-1":
      return -1;
    default:
      return RESULT_SENTINEL; // not_applicable / unresolved
  }
}

/** Analyze a score program over finite domains with Z3. */
export async function analyzeScoreProgram(
  program: ScoreProgram,
  domains: FiniteDomains,
  options: ScoreAnalysisOptions = {},
): Promise<ScoreAnalysis> {
  const api = await createZ3Api();
  const lowering = new ScoreLowering(api, domains);
  const domainConstraints = lowering.domainConstraints();
  const diagnostics: Diagnostic[] = [];
  const location: Location =
    options.objectId !== undefined ? { objectId: options.objectId } : undefined;

  detectGap(api, lowering, program, domainConstraints, location, diagnostics);
  detectOverlaps(api, lowering, program, domainConstraints, location, diagnostics);
  detectUnreachable(api, lowering, program, domainConstraints, location, diagnostics);
  for (const spec of options.monotonic ?? []) {
    detectMonotonicity(
      api,
      lowering,
      program,
      domains,
      domainConstraints,
      spec,
      location,
      diagnostics,
    );
  }

  const assignmentsChecked = canonicalKeys(domains).reduce(
    (product, key) => product * (domains[key]?.length ?? 0),
    1,
  );
  return { assignmentsChecked, diagnostics: sortDiagnostics(diagnostics) };
}

function detectGap(
  api: Z3Api,
  lowering: ScoreLowering,
  program: ScoreProgram,
  domainConstraints: Z3Expr[],
  location: Location,
  out: Diagnostic[],
): void {
  // A concrete `otherwise` result is a safe catch-all; only `unresolved` gaps.
  if (program.otherwise.result !== "unresolved") return;
  if (program.rules.length === 0) return;

  const optimize = new api.Optimize();
  optimize.add(...domainConstraints);
  for (const rule of program.rules) optimize.add(lowering.decisivelyFalse(rule.when));
  lowering.minimizeObjectives(optimize);

  if (checkOptimize(api, optimize) !== "sat") return;
  const witness = stableWitness(lowering.readWitness(optimize.model()));
  out.push(buildGap(witness, program.otherwise.result, location));
}

function detectOverlaps(
  api: Z3Api,
  lowering: ScoreLowering,
  program: ScoreProgram,
  domainConstraints: Z3Expr[],
  location: Location,
  out: Diagnostic[],
): void {
  const priorities = [...new Set(program.rules.map((rule) => rule.priority))].sort((a, b) => b - a);
  for (const priority of priorities) {
    const group = program.rules
      .map((rule, index) => ({ rule, index }))
      .filter((entry) => entry.rule.priority === priority);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const optimize = new api.Optimize();
        optimize.add(...domainConstraints);
        optimize.add(lowering.decisivelyTrue(a.rule.when));
        optimize.add(lowering.decisivelyTrue(b.rule.when));
        lowering.minimizeObjectives(optimize);
        if (checkOptimize(api, optimize) !== "sat") continue;
        const witness = stableWitness(lowering.readWitness(optimize.model()));
        out.push(buildOverlap(a.rule, b.rule, priority, witness, location));
      }
    }
  }
}

function detectUnreachable(
  api: Z3Api,
  lowering: ScoreLowering,
  program: ScoreProgram,
  domainConstraints: Z3Expr[],
  location: Location,
  out: Diagnostic[],
): void {
  for (const rule of [...program.rules].sort((a, b) => a.id.localeCompare(b.id))) {
    // A plain Solver would spawn a Bun-incompatible worker; use Optimize for the
    // pure satisfiability check as well (no objectives needed).
    const optimize = new api.Optimize();
    optimize.add(...domainConstraints);
    optimize.add(lowering.decisivelyTrue(rule.when));
    if (checkOptimize(api, optimize) === "unsat") out.push(buildUnreachable(rule, location));
  }
}

/** Nested If over rules in (priority desc, declaration order): the selected score. */
function selectedScore(api: Z3Api, lowering: ScoreLowering, program: ScoreProgram): Z3Expr {
  const ordered = program.rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => b.rule.priority - a.rule.priority || a.index - b.index);
  let expr: Z3Expr = api.Int.val(resultToInt(program.otherwise.result));
  for (let i = ordered.length - 1; i >= 0; i--) {
    const entry = ordered[i]!;
    expr = api.If(lowering.decisivelyTrue(entry.rule.when), resultToInt(entry.rule.result), expr);
  }
  return expr;
}

function detectMonotonicity(
  api: Z3Api,
  lowering: ScoreLowering,
  program: ScoreProgram,
  domains: FiniteDomains,
  domainConstraintsA: Z3Expr[],
  spec: MonotonicitySpec,
  location: Location,
  out: Diagnostic[],
): void {
  const loweringB = new ScoreLowering(api, domains, "mono_b__");
  const scoreA = selectedScore(api, lowering, program);
  const scoreB = selectedScore(api, loweringB, program);

  const optimize = new api.Optimize();
  optimize.add(...domainConstraintsA);
  optimize.add(...loweringB.domainConstraints());

  // Couple every non-axis variable; raise the axis in copy B.
  for (const key of canonicalKeys(domains)) {
    const a = lowering.variableTerm(key);
    const b = loweringB.variableTerm(key);
    if (!a || !b) continue;
    if (key === spec.variable) optimize.add(b.gt(a));
    else optimize.add(a.eq(b));
  }

  // Both endpoints must resolve to a concrete score (exclude sentinels).
  optimize.add(scoreA.ge(-1), scoreA.le(1), scoreB.ge(-1), scoreB.le(1));
  // The violation: a higher axis value yields a strictly lower score.
  optimize.add(scoreB.lt(scoreA));
  // Respect declared exceptions (e.g. a counteraction) at both endpoints.
  if (spec.exceptions) {
    optimize.add(lowering.decisivelyTrue(spec.exceptions).not());
    optimize.add(loweringB.decisivelyTrue(spec.exceptions).not());
  }

  lowering.minimizeObjectives(optimize);
  loweringB.minimizeObjectives(optimize);

  if (checkOptimize(api, optimize) !== "sat") return;
  const model = optimize.model();
  const lower = stableWitness(lowering.readWitness(model));
  const higher = stableWitness(loweringB.readWitness(model));
  const lowerScore = Number(model.eval(scoreA, true).value());
  const higherScore = Number(model.eval(scoreB, true).value());
  out.push(buildMonotonicity(spec.variable, lower, higher, lowerScore, higherScore, location));
}
