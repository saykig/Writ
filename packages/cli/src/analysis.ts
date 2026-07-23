/**
 * Shared analysis helpers for the language CLI: turning a compiled commitment's
 * declared assertion domains into finite domains for the analyzer, running the
 * deterministic (Z3-free) bounded score analysis, and executing `scenario`
 * blocks as analyzer/evaluator assertions.
 *
 * The bounded-enumeration analyzer is used (not the Z3 pass) so `analyze`/`test`
 * stay deterministic and dependency-light under the Bun runner; the two passes
 * agree on the seeded programs by construction.
 */

import type { Assertion, Commitment, Expr } from "@writ/domain";
import {
  analyzeMeasures,
  analyzeScoreProgramByEnumeration,
  evaluateTruth,
  isDefinitelyTrue,
  type FiniteDomains,
} from "@writ/analyzer";
import type { Diagnostic } from "@writ/domain";
import type { Expression, Scenario } from "@writ/language";

type DomainValue = string | number | boolean;

/** Expand an assertion domain (range or explicit set) into concrete values. */
function domainValues(
  values: Assertion["domains"] extends undefined ? never : unknown,
): DomainValue[] {
  if (Array.isArray(values)) {
    return values as DomainValue[];
  }
  const range = values as { min: number; max: number };
  const out: number[] = [];
  for (let n = range.min; n <= range.max; n += 1) out.push(n);
  return out;
}

/** Finite domains for a commitment, unioned across all its assertion domains. */
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
  return domains;
}

/** Monotonicity axes declared by a commitment's `monotonic` assertions. */
export function monotonicSpecs(commitment: Commitment): { variable: string; exceptions?: Expr }[] {
  const specs: { variable: string; exceptions?: Expr }[] = [];
  for (const assertion of commitment.assertions) {
    if (assertion.kind !== "monotonic") continue;
    const variable = assertion.domains?.[0]?.variable;
    if (!variable) continue;
    specs.push(
      assertion.exceptions ? { variable, exceptions: assertion.exceptions } : { variable },
    );
  }
  return specs;
}

/** Collect every `ref` path an expression depends on (query internals included). */
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
      // A raw query depends on evidence, not the enumerable domain: mark it so.
      out.add(`$query:${expr.collection}`);
      if (expr.where) collectRefPaths(expr.where, out);
      if (expr.select) collectRefPaths(expr.select, out);
      return;
    case "literal":
      return;
  }
}

/** Run the bounded score analysis for one commitment over its declared domains. */
export function analyzeCommitment(commitment: Commitment): Diagnostic[] {
  const domains = domainsFromCommitment(commitment);
  const domainsUsable =
    Object.keys(domains).length > 0 &&
    !Object.values(domains).some((values) => values.length === 0);

  // Score-program analysis (only when the axis domains are enumerable).
  let scoreDiagnostics: Diagnostic[] = [];
  if (domainsUsable) {
    const { diagnostics } = analyzeScoreProgramByEnumeration(commitment.score_program, domains, {
      objectId: commitment.id,
      monotonic: monotonicSpecs(commitment),
    });
    // Suppress false-positive unreachability: a rule is only provably dead when
    // its reachability is decidable over the enumerated domain. If its `when`
    // depends on a variable outside that domain (e.g. a derived predicate whose
    // truth the static analysis cannot determine), we cannot conclude it is dead.
    const domainKeys = new Set(Object.keys(domains));
    const rulesById = new Map(commitment.score_program.rules.map((rule) => [rule.id, rule]));
    scoreDiagnostics = diagnostics.filter((diagnostic) => {
      if (diagnostic.code !== "WRT-SCORE-UNREACHABLE") return true;
      const ruleId = (diagnostic.context as { ruleId?: string } | undefined)?.ruleId;
      const rule = ruleId ? rulesById.get(ruleId) : undefined;
      if (!rule) return true;
      const refs = new Set<string>();
      collectRefPaths(rule.when, refs);
      return [...refs].every((path) => domainKeys.has(path));
    });
  }

  // Static graded-measure analysis (weights, per-component anchor coverage over
  // declared domains, pending-decisiveness) — independent of the score program.
  const measureDiagnostics = analyzeMeasures(commitment.measures ?? [], domains, {
    objectId: commitment.id,
  });

  return [...scoreDiagnostics, ...measureDiagnostics];
}

// --- Scenario execution -----------------------------------------------------

/** The concrete value carried by a scenario `given` literal. */
export function literalValue(node: Expression): DomainValue | string {
  switch (node.$type) {
    case "NumberLiteral":
      return node.value;
    case "BooleanLiteral":
      return node.value === "true";
    case "TruthLiteral":
      return node.value;
    case "StringLiteral":
      return node.value;
    case "DateLiteral":
      return node.value;
    case "ReferenceExpression":
      return node.path;
    default:
      return "";
  }
}

/** Outcome of running one `scenario` block. */
export interface ScenarioResult {
  readonly scenario: string;
  readonly commitment: string;
  readonly kind: "diagnostic" | "result";
  readonly expected: string;
  readonly actual: string;
  readonly pass: boolean;
}

/** First decisively-true rule's result (priority desc, then declaration order). */
function resolveScoreResult(commitment: Commitment, facts: Record<string, unknown>): string {
  const ordered = commitment.score_program.rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => b.rule.priority - a.rule.priority || a.index - b.index);
  for (const { rule } of ordered) {
    if (isDefinitelyTrue(evaluateTruth(rule.when, facts))) return rule.result;
  }
  return commitment.score_program.otherwise.result;
}

/**
 * Run one scenario against its commitment. A `expect diagnostic` scenario asks
 * whether the analyzer reports the given code at the scenario point (its `given`
 * assignments pinned as singleton domains); a `expect result` scenario resolves
 * the score deterministically at that point.
 */
export function runScenario(scenario: Scenario, commitment: Commitment): ScenarioResult {
  const facts: Record<string, unknown> = {};
  const domains: Record<string, DomainValue[]> = {};
  for (const given of scenario.givens) {
    const value = literalValue(given.value) as DomainValue;
    facts[given.path] = value;
    domains[given.path] = [value];
  }

  if (scenario.expect.diagnostic) {
    const expected = scenario.expect.diagnostic;
    const { diagnostics } = analyzeScoreProgramByEnumeration(commitment.score_program, domains, {
      objectId: commitment.id,
    });
    const codes = diagnostics.map((d) => d.code as string);
    return {
      scenario: scenario.name,
      commitment: commitment.id,
      kind: "diagnostic",
      expected,
      actual: codes.join(",") || "(none)",
      pass: codes.includes(expected),
    };
  }

  const expected = scenario.expect.result ?? "";
  const actual = resolveScoreResult(commitment, facts);
  return {
    scenario: scenario.name,
    commitment: commitment.id,
    kind: "result",
    expected,
    actual,
    pass: actual === expected,
  };
}
