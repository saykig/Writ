/**
 * Bounded score analysis for a compiled commitment — a self-contained mirror of
 * `packages/cli/src/analysis.ts` `analyzeCommitment`. Uses the deterministic,
 * Z3-free bounded-enumeration pass (`analyzeScoreProgramByEnumeration`) so it is
 * pure TS with no solver/Bun dependency, safe on the Node runtime.
 */

import { analyzeScoreProgramByEnumeration, type FiniteDomains } from "@covenant/analyzer";
import type { Assertion, Commitment, Diagnostic, Expr } from "@covenant/domain";

type DomainValue = string | number | boolean;

function domainValues(values: unknown): DomainValue[] {
  if (Array.isArray(values)) {
    return values as DomainValue[];
  }
  const range = values as { min: number; max: number };
  const out: number[] = [];
  for (let n = range.min; n <= range.max; n += 1) out.push(n);
  return out;
}

export function domainsFromCommitment(commitment: Commitment): FiniteDomains {
  const domains: Record<string, DomainValue[]> = {};
  for (const assertion of commitment.assertions) {
    for (const domain of assertion.domains ?? []) {
      const values = domainValues(domain.values);
      const existing = domains[domain.variable];
      if (existing) {
        for (const value of values) {
          if (!existing.some((v) => Object.is(v, value))) existing.push(value);
        }
      } else {
        domains[domain.variable] = [...values];
      }
    }
  }
  return domains as FiniteDomains;
}

function monotonicSpecs(commitment: Commitment): { variable: string; exceptions?: Expr }[] {
  const specs: { variable: string; exceptions?: Expr }[] = [];
  for (const assertion of commitment.assertions as readonly Assertion[]) {
    if (assertion.kind !== "monotonic") continue;
    const variable = assertion.domains?.[0]?.variable;
    if (!variable) continue;
    specs.push(
      assertion.exceptions ? { variable, exceptions: assertion.exceptions } : { variable },
    );
  }
  return specs;
}

function collectRefPaths(expr: Expr, out: Set<string>): void {
  switch (expr.kind) {
    case "ref":
      out.add(expr.path);
      return;
    case "unary":
      collectRefPaths(expr.operand, out);
      return;
    case "nary":
      for (const operand of expr.operands) collectRefPaths(operand, out);
      return;
    case "compare":
      collectRefPaths(expr.left, out);
      collectRefPaths(expr.right, out);
      return;
    case "call":
      for (const argument of expr.arguments) collectRefPaths(argument, out);
      return;
    case "query":
      out.add(`$query:${expr.collection}`);
      if (expr.where) collectRefPaths(expr.where, out);
      if (expr.select) collectRefPaths(expr.select, out);
      return;
    case "literal":
      return;
  }
}

/**
 * Run the bounded score analysis for one commitment over its declared domains.
 * Suppresses false-positive `COV-SCORE-UNREACHABLE`: a rule is only provably
 * dead when its reachability is decidable over the enumerated domain.
 */
export function analyzeCommitment(commitment: Commitment): Diagnostic[] {
  const domains = domainsFromCommitment(commitment);
  const domainRecord = domains as Record<string, DomainValue[]>;
  if (Object.values(domainRecord).some((values) => values.length === 0)) {
    return [];
  }
  if (Object.keys(domainRecord).length === 0) {
    return [];
  }

  const { diagnostics } = analyzeScoreProgramByEnumeration(commitment.score_program, domains, {
    objectId: commitment.id,
    monotonic: monotonicSpecs(commitment),
  });

  const domainKeys = new Set(Object.keys(domainRecord));
  const rulesById = new Map(commitment.score_program.rules.map((rule) => [rule.id, rule]));
  return diagnostics.filter((diagnostic) => {
    if (diagnostic.code !== "COV-SCORE-UNREACHABLE") return true;
    const ruleId = (diagnostic.context as { ruleId?: string } | undefined)?.ruleId;
    const rule = ruleId ? rulesById.get(ruleId) : undefined;
    if (!rule) return true;
    const refs = new Set<string>();
    collectRefPaths(rule.when, refs);
    return [...refs].every((path) => domainKeys.has(path));
  });
}
