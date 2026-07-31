/**
 * Bounded-enumeration score analysis — the cross-check oracle for the Z3 pass.
 *
 * This walks the full domain product and applies the four-valued semantics in
 * `semantics.ts`. It emits diagnostics
 * through the same builders the Z3 analysis uses, so on the seeded fixtures the
 * two passes must produce identical output. Its purpose is to guard the Z3
 * lowering, not to be fast.
 */

import type { Diagnostic, Expr, ScoreProgram } from "@writ/domain";
import { canonicalKeys, enumerateAssignments, stableWitness } from "./domains.js";
import { evaluateTruth } from "./semantics.js";
import { isDefinitelyFalse, isDefinitelyTrue } from "./truth.js";
import {
  buildGap,
  buildMonotonicity,
  buildOverlap,
  buildUnreachable,
  sortDiagnostics,
  type Location,
} from "./score-diagnostics.js";
import type { Assignment, FiniteDomains, MonotonicitySpec, ScoreAnalysis } from "./types.js";
import type { ScoreAnalysisOptions } from "./score-analysis.js";

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
      return RESULT_SENTINEL;
  }
}

function decisivelyTrue(when: Expr, facts: Assignment): boolean {
  return isDefinitelyTrue(evaluateTruth(when, facts));
}

function decisivelyFalse(when: Expr, facts: Assignment): boolean {
  return isDefinitelyFalse(evaluateTruth(when, facts));
}

/** First decisively-true rule in (priority desc, declaration order); else otherwise. */
function resolveScore(program: ScoreProgram, facts: Assignment): number {
  const ordered = program.rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => b.rule.priority - a.rule.priority || a.index - b.index);
  for (const { rule } of ordered) {
    if (decisivelyTrue(rule.when, facts)) return resultToInt(rule.result);
  }
  return resultToInt(program.otherwise.result);
}

export function analyzeScoreProgramByEnumeration(
  program: ScoreProgram,
  domains: FiniteDomains,
  options: ScoreAnalysisOptions = {},
): ScoreAnalysis {
  const rows = enumerateAssignments(domains);
  const diagnostics: Diagnostic[] = [];
  const location: Location =
    options.objectId !== undefined ? { objectId: options.objectId } : undefined;

  detectGap(program, rows, location, diagnostics);
  detectOverlaps(program, rows, location, diagnostics);
  detectUnreachable(program, rows, location, diagnostics);
  for (const spec of options.monotonic ?? []) {
    detectMonotonicity(program, domains, spec, location, diagnostics);
  }

  return { assignmentsChecked: rows.length, diagnostics: sortDiagnostics(diagnostics) };
}

function detectGap(
  program: ScoreProgram,
  rows: Assignment[],
  location: Location,
  out: Diagnostic[],
): void {
  if (program.otherwise.result !== "unresolved") return;
  if (program.rules.length === 0) return;
  for (const row of rows) {
    if (program.rules.every((rule) => decisivelyFalse(rule.when, row))) {
      out.push(buildGap(stableWitness(row), program.otherwise.result, location));
      return;
    }
  }
}

function detectOverlaps(
  program: ScoreProgram,
  rows: Assignment[],
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
        const row = rows.find(
          (candidate) =>
            decisivelyTrue(a.rule.when, candidate) && decisivelyTrue(b.rule.when, candidate),
        );
        if (row) out.push(buildOverlap(a.rule, b.rule, priority, stableWitness(row), location));
      }
    }
  }
}

function detectUnreachable(
  program: ScoreProgram,
  rows: Assignment[],
  location: Location,
  out: Diagnostic[],
): void {
  for (const rule of [...program.rules].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!rows.some((row) => decisivelyTrue(rule.when, row)))
      out.push(buildUnreachable(rule, location));
  }
}

function detectMonotonicity(
  program: ScoreProgram,
  domains: FiniteDomains,
  spec: MonotonicitySpec,
  location: Location,
  out: Diagnostic[],
): void {
  const axisValues = domains[spec.variable];
  if (!axisValues || axisValues.length === 0) return;
  const baseDomains: Record<string, readonly (string | number | boolean)[]> = {};
  for (const key of canonicalKeys(domains)) {
    if (key !== spec.variable) baseDomains[key] = domains[key]!;
  }
  const bases = enumerateAssignments(baseDomains);
  const excused = (facts: Assignment): boolean =>
    spec.exceptions !== undefined && decisivelyTrue(spec.exceptions, facts);

  for (const base of bases) {
    for (let ia = 0; ia < axisValues.length; ia++) {
      const lower: Assignment = { ...base, [spec.variable]: axisValues[ia]! };
      const lowerScore = resolveScore(program, lower);
      if (lowerScore < -1 || lowerScore > 1 || excused(lower)) continue;
      for (let ib = ia + 1; ib < axisValues.length; ib++) {
        const higher: Assignment = { ...base, [spec.variable]: axisValues[ib]! };
        const higherScore = resolveScore(program, higher);
        if (higherScore < -1 || higherScore > 1 || excused(higher)) continue;
        if (higherScore < lowerScore) {
          out.push(
            buildMonotonicity(
              spec.variable,
              stableWitness(lower),
              stableWitness(higher),
              lowerScore,
              higherScore,
              location,
            ),
          );
          return;
        }
      }
    }
  }
}
