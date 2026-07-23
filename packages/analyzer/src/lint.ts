/**
 * CORE-010: non-SMT structural lints over a canonical IR commitment.
 *
 * These are methodology-quality checks that do not need the solver: unresolved
 * references, a score-decisive counting query without an action-identity policy,
 * score-decisive rules that cite neither source nor rationale, attribution
 * ambiguity for collective actors, coarse type / time-axis checks, and a
 * prose-vs-metric mismatch hook (a candidate a methodologist must confirm — the
 * analyzer never rewrites the score program). Findings use the unified catalog.
 */

import {
  makeDiagnostic,
  type CanonicalIr,
  type Commitment,
  type Diagnostic,
  type Expr,
  type Variable,
} from "@writ/domain";

/**
 * A candidate prose-vs-metric conflict. Models the human-in-the-loop pipeline:
 * a reviewer or model proposes the claim; a `conflict` status surfaces a
 * diagnostic that a methodologist must reconcile. Never mutates the program.
 */
export interface ProseClaim {
  readonly id: string;
  readonly objectId: string;
  readonly proseText: string;
  readonly metricText: string;
  readonly status: "conflict" | "consistent" | "unreviewed";
}

export interface LintOptions {
  readonly proseClaims?: readonly ProseClaim[];
}

const NUMERIC_TYPES = new Set(["int", "integer", "number", "decimal", "money", "float", "count"]);

function collectRefs(expr: Expr, out: string[] = []): string[] {
  switch (expr.kind) {
    case "ref":
      out.push(expr.path);
      break;
    case "unary":
      collectRefs(expr.operand, out);
      break;
    case "nary":
      for (const operand of expr.operands) collectRefs(operand, out);
      break;
    case "compare":
      collectRefs(expr.left, out);
      collectRefs(expr.right, out);
      break;
    case "call":
      for (const argument of expr.arguments) collectRefs(argument, out);
      break;
    case "query":
      if (expr.where) collectRefs(expr.where, out);
      if (expr.select) collectRefs(expr.select, out);
      break;
    case "literal":
      break;
  }
  return out;
}

function collectQueryOps(expr: Expr, out: string[] = []): string[] {
  switch (expr.kind) {
    case "query":
      out.push(expr.operation);
      if (expr.where) collectQueryOps(expr.where, out);
      if (expr.select) collectQueryOps(expr.select, out);
      break;
    case "unary":
      collectQueryOps(expr.operand, out);
      break;
    case "nary":
      for (const operand of expr.operands) collectQueryOps(operand, out);
      break;
    case "compare":
      collectQueryOps(expr.left, out);
      collectQueryOps(expr.right, out);
      break;
    case "call":
      for (const argument of expr.arguments) collectQueryOps(argument, out);
      break;
    default:
      break;
  }
  return out;
}

function root(path: string): string {
  return path.split(".")[0] ?? path;
}

/** All symbols a commitment declares that a score rule may reference. */
function declaredSymbols(commitment: Commitment): Set<string> {
  const symbols = new Set<string>();
  for (const variable of commitment.variables) symbols.add(variable.id);
  for (const parameter of commitment.parameters) symbols.add(parameter.id);
  for (const predicate of commitment.predicates) symbols.add(predicate.id);
  for (const dimension of commitment.dimensions ?? []) symbols.add(dimension.id);
  for (const goal of commitment.goals ?? []) symbols.add(goal.id);
  for (const partnerClass of commitment.partner_classes ?? []) symbols.add(partnerClass.id);
  return symbols;
}

/** Variable ids referenced (transitively) by the score program. */
function scoreDecisiveVariables(commitment: Commitment): Set<string> {
  const byId = new Map(commitment.variables.map((variable) => [variable.id, variable]));
  const decisive = new Set<string>();
  const frontier: string[] = [];
  for (const rule of commitment.score_program.rules) {
    for (const ref of collectRefs(rule.when)) frontier.push(root(ref));
  }
  while (frontier.length > 0) {
    const id = frontier.pop()!;
    if (decisive.has(id) || !byId.has(id)) continue;
    decisive.add(id);
    const variable = byId.get(id) as Variable;
    for (const ref of collectRefs(variable.expression)) frontier.push(root(ref));
  }
  return decisive;
}

function isMissingIdentity(commitment: Commitment): boolean {
  const identity = commitment.action_identity as Commitment["action_identity"] | null | undefined;
  return identity == null || identity.key_paths.length === 0;
}

/** Lint one commitment. */
export function lintCommitment(commitment: Commitment): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const symbols = declaredSymbols(commitment);
  const decisive = scoreDecisiveVariables(commitment);

  // Unresolved references in score-decisive rules.
  commitment.score_program.rules.forEach((rule, index) => {
    const seen = new Set<string>();
    for (const ref of collectRefs(rule.when)) {
      const symbol = root(ref);
      if (symbols.has(symbol) || seen.has(symbol)) continue;
      seen.add(symbol);
      diagnostics.push(
        makeDiagnostic("WRT-LINT-MISSING-REFERENCE", {
          values: { reference: symbol, path: `score_program/rules/${index}/when` },
          location: {
            objectId: rule.id,
            path: `/commitments/${commitment.id}/score_program/rules/${index}/when`,
          },
          context: { reference: symbol },
        }),
      );
    }
  });

  // Score-decisive counting query without an action-identity policy.
  const countingVar = commitment.variables.find(
    (variable) =>
      decisive.has(variable.id) &&
      collectQueryOps(variable.expression).some((op) => op === "count" || op === "count_distinct"),
  );
  if (countingVar && isMissingIdentity(commitment)) {
    diagnostics.push(
      makeDiagnostic("WRT-IDENTITY-MISSING", {
        values: { path: countingVar.id, objectId: commitment.id },
        location: {
          objectId: commitment.id,
          path: `/commitments/${commitment.id}/action_identity`,
        },
        context: { variable: countingVar.id },
      }),
    );
  }

  // Score-decisive rule that cites neither source nor rationale.
  for (const rule of commitment.score_program.rules) {
    const hasSource = (rule.source_passage_ids?.length ?? 0) > 0;
    const hasRationale = rule.rationale_id !== undefined && rule.rationale_id !== "";
    if (!hasSource && !hasRationale) {
      diagnostics.push(
        makeDiagnostic("WRT-LINT-SOURCE-RATIONALE", {
          values: { rationaleId: rule.id },
          location: { objectId: rule.id, path: `/commitments/${commitment.id}/score_program` },
          context: { ruleId: rule.id },
        }),
      );
    }
  }

  // Coarse type check: an ordering comparison against a non-numeric variable.
  const typeById = new Map(commitment.variables.map((v) => [v.id, v.type.toLowerCase()]));
  commitment.score_program.rules.forEach((rule, index) => {
    for (const finding of orderingTypeErrors(rule.when, typeById)) {
      diagnostics.push(
        makeDiagnostic("WRT-LINT-TYPE", {
          values: {
            path: `score_program/rules/${index}/when`,
            expected: "numeric",
            actual: finding.type,
          },
          location: {
            objectId: rule.id,
            path: `/commitments/${commitment.id}/score_program/rules/${index}/when`,
          },
          context: { variable: finding.variable, declaredType: finding.type },
        }),
      );
    }
  });

  // Coarse time-axis check: an ambiguous bare `date` in a temporal comparison.
  commitment.score_program.rules.forEach((rule, index) => {
    if (temporalDateAmbiguity(rule.when)) {
      diagnostics.push(
        makeDiagnostic("WRT-LINT-TIME-AXIS", {
          values: {
            path: `score_program/rules/${index}/when`,
            detail: "bare `date` has no declared axis",
          },
          location: {
            objectId: rule.id,
            path: `/commitments/${commitment.id}/score_program/rules/${index}/when`,
          },
        }),
      );
    }
  });

  // Attribution ambiguity: a collective actor and its members both scored, with
  // no rationale addressing attribution.
  diagnostics.push(...attributionFindings(commitment));

  return diagnostics;
}

interface TypeError {
  readonly variable: string;
  readonly type: string;
}

const ORDERING_OPS = new Set(["gt", "gte", "lt", "lte", "between"]);

function orderingTypeErrors(
  expr: Expr,
  typeById: Map<string, string>,
  out: TypeError[] = [],
): TypeError[] {
  if (expr.kind === "compare") {
    if (ORDERING_OPS.has(expr.op)) {
      for (const side of [expr.left, expr.right]) {
        if (side.kind === "ref") {
          const type = typeById.get(root(side.path));
          if (type !== undefined && !NUMERIC_TYPES.has(type)) {
            out.push({ variable: root(side.path), type });
          }
        }
      }
    }
    orderingTypeErrors(expr.left, typeById, out);
    orderingTypeErrors(expr.right, typeById, out);
  } else if (expr.kind === "unary") {
    orderingTypeErrors(expr.operand, typeById, out);
  } else if (expr.kind === "nary") {
    for (const operand of expr.operands) orderingTypeErrors(operand, typeById, out);
  }
  return out;
}

function temporalDateAmbiguity(expr: Expr): boolean {
  if (expr.kind === "compare") {
    if (expr.op === "before" || expr.op === "after") {
      for (const side of [expr.left, expr.right]) {
        if (side.kind === "ref" && (side.path === "date" || side.path.endsWith(".date")))
          return true;
      }
    }
    return temporalDateAmbiguity(expr.left) || temporalDateAmbiguity(expr.right);
  }
  if (expr.kind === "unary") return temporalDateAmbiguity(expr.operand);
  if (expr.kind === "nary") return expr.operands.some(temporalDateAmbiguity);
  return false;
}

const COLLECTIVE_MEMBERS: Record<string, readonly string[]> = {
  EuropeanUnion: [
    "France",
    "Germany",
    "Italy",
    "Austria",
    "Belgium",
    "Netherlands",
    "Spain",
    "Poland",
  ],
};

function attributionFindings(commitment: Commitment): Diagnostic[] {
  const subjects = new Set(commitment.subjects);
  const rationaleMentionsAttribution = (commitment.rationales ?? []).some((rationale) =>
    /attribut/i.test(rationale.text),
  );
  const findings: Diagnostic[] = [];
  for (const [collective, members] of Object.entries(COLLECTIVE_MEMBERS)) {
    if (
      subjects.has(collective) &&
      members.some((member) => subjects.has(member)) &&
      !rationaleMentionsAttribution
    ) {
      findings.push(
        makeDiagnostic("WRT-LINT-ATTRIBUTION", {
          values: {
            path: `subjects`,
            detail: `${collective} and its members are scored without an attribution policy`,
          },
          location: { objectId: commitment.id, path: `/commitments/${commitment.id}/subjects` },
          context: { collective },
        }),
      );
    }
  }
  return findings;
}

/** Prose-vs-metric mismatch hook: surface confirmed candidate conflicts. */
export function lintProseMetric(claims: readonly ProseClaim[]): Diagnostic[] {
  return claims
    .filter((claim) => claim.status === "conflict")
    .map((claim) =>
      makeDiagnostic("WRT-PROSE-METRIC-MISMATCH", {
        values: { claimId: claim.id, objectId: claim.objectId },
        location: { objectId: claim.objectId },
        context: { claimId: claim.id, prose: claim.proseText, metric: claim.metricText },
      }),
    );
}

/** Lint an entire canonical IR document. */
export function lintIr(ir: CanonicalIr, options: LintOptions = {}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const commitment of ir.commitments) diagnostics.push(...lintCommitment(commitment));
  if (options.proseClaims) diagnostics.push(...lintProseMetric(options.proseClaims));
  return diagnostics;
}
