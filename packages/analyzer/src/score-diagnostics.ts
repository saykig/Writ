/**
 * Diagnostic builders shared by the Z3 analysis and the bounded-enumeration
 * oracle. Sharing them guarantees the two passes emit byte-identical diagnostics
 * given the same witnesses, so the cross-check test genuinely guards the Z3
 * lowering rather than comparing two independently-formatted shapes.
 */

import { makeDiagnostic, type Diagnostic, type ScoreRule } from "@writ/domain";
import type { Witness } from "./types.js";

export type Location = { readonly objectId: string } | undefined;

export function formatWitness(witness: Witness): string {
  return Object.entries(witness)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

export function buildGap(witness: Witness, otherwise: string, location: Location): Diagnostic {
  return makeDiagnostic("WRT-SCORE-GAP", {
    values: { witness: formatWitness(witness) },
    ...(location ? { location } : {}),
    witness,
    context: { otherwise },
  });
}

export function buildOverlap(
  ruleA: ScoreRule,
  ruleB: ScoreRule,
  priority: number,
  witness: Witness,
  location: Location,
): Diagnostic {
  const matchedResults = [...new Set([ruleA.result, ruleB.result])];
  const differ = matchedResults.length > 1;
  const diagnostic = makeDiagnostic("WRT-SCORE-OVERLAP", {
    values: { ruleA: ruleA.id, ruleB: ruleB.id, witness: formatWitness(witness) },
    ...(location ? { location } : {}),
    witness,
    context: {
      priority,
      ruleIds: [ruleA.id, ruleB.id].sort((x, y) => x.localeCompare(y)),
      matchedResults,
    },
  });
  // Same-result overlaps are benign: downgrade error → warning.
  return differ ? diagnostic : { ...diagnostic, severity: "warning" };
}

export function buildUnreachable(rule: ScoreRule, location: Location): Diagnostic {
  return makeDiagnostic("WRT-SCORE-UNREACHABLE", {
    values: { rule: rule.id },
    ...(location ? { location } : {}),
    context: { ruleId: rule.id },
  });
}

export function buildMonotonicity(
  variable: string,
  lower: Witness,
  higher: Witness,
  lowerScore: number,
  higherScore: number,
  location: Location,
): Diagnostic {
  return makeDiagnostic("WRT-SCORE-MONOTONICITY", {
    values: { variable, witness: formatWitness(lower) },
    ...(location ? { location } : {}),
    witness: { variable, lower, higher, lowerScore, higherScore },
    context: { variable, lowerScore, higherScore },
  });
}

function diagnosticSortKey(diagnostic: Diagnostic): string {
  return JSON.stringify([
    diagnostic.code,
    diagnostic.severity,
    diagnostic.witness ?? null,
    diagnostic.context ?? null,
  ]);
}

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => diagnosticSortKey(a).localeCompare(diagnosticSortKey(b)));
}
