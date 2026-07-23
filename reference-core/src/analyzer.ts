import { evaluateTruth } from "./evaluator";
import { truthName } from "./truth";
import type {
  AnalysisDiagnostic,
  DomainValue,
  Facts,
  FiniteDomains,
  ScoreAnalysis,
  ScoreProgram,
  ScoreValue,
} from "./types";

function assignments(domains: FiniteDomains): Readonly<Record<string, DomainValue>>[] {
  const keys = Object.keys(domains).sort();
  let rows: Readonly<Record<string, DomainValue>>[] = [{}];
  for (const key of keys) {
    const values = domains[key];
    if (!values || values.length === 0) throw new Error(`Domain ${key} is empty.`);
    const next: Readonly<Record<string, DomainValue>>[] = [];
    for (const row of rows) {
      for (const value of values) next.push({ ...row, [key]: value });
    }
    rows = next;
  }
  return rows;
}

function stableWitness(
  value: Readonly<Record<string, DomainValue>>,
): Readonly<Record<string, DomainValue>> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function analyzeScoreProgram(program: ScoreProgram, domains: FiniteDomains): ScoreAnalysis {
  const rows = assignments(domains);
  const reachable = new Set<string>();
  const diagnostics: AnalysisDiagnostic[] = [];
  let firstGap: AnalysisDiagnostic | undefined;
  let firstOverlap: AnalysisDiagnostic | undefined;
  let firstUnknown: AnalysisDiagnostic | undefined;

  for (const row of rows) {
    const facts: Facts = row;
    const evaluated = program.rules.map((rule) => ({
      rule,
      truth: truthName(evaluateTruth(rule.when, facts)),
    }));
    for (const item of evaluated) if (item.truth === "true") reachable.add(item.rule.id);

    const trueRules = evaluated.filter((item) => item.truth === "true");
    const uncertain = evaluated.filter(
      (item) => item.truth === "unknown" || item.truth === "contested",
    );

    if (!firstGap && trueRules.length === 0 && uncertain.length === 0) {
      firstGap = {
        code: "COV-SCORE-GAP",
        severity: "error",
        message: "No score branch matches a bounded-domain assignment.",
        witness: stableWitness(row),
      };
    }
    if (!firstOverlap && trueRules.length > 1) {
      const results = [
        ...new Set(trueRules.map((item) => item.rule.result)),
      ].sort() as ScoreValue[];
      firstOverlap = {
        code: "COV-SCORE-OVERLAP",
        severity: results.length > 1 ? "error" : "warning",
        message: "Multiple score branches match a bounded-domain assignment.",
        witness: stableWitness(row),
        ruleIds: trueRules.map((item) => item.rule.id).sort(),
        matchedResults: results,
      };
    }
    if (!firstUnknown && uncertain.length > 0) {
      firstUnknown = {
        code: "COV-SCORE-UNKNOWN",
        severity: "warning",
        message:
          "At least one score branch is unknown or contested in a bounded-domain assignment.",
        witness: stableWitness(row),
        ruleIds: uncertain.map((item) => item.rule.id).sort(),
      };
    }
  }

  if (firstGap) diagnostics.push(firstGap);
  if (firstOverlap) diagnostics.push(firstOverlap);
  if (firstUnknown) diagnostics.push(firstUnknown);

  for (const rule of [...program.rules].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!reachable.has(rule.id)) {
      diagnostics.push({
        code: "COV-SCORE-UNREACHABLE",
        severity: "warning",
        message: `Score rule ${rule.id} is unreachable in the supplied domains.`,
        ruleIds: [rule.id],
      });
    }
  }

  return { assignmentsChecked: rows.length, diagnostics };
}
