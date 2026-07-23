// Static analysis of graded measures (weighted-ordinal indices).
//
// Three properties, decided over the same declared finite domains the score
// analyzer uses (bounded enumeration is the oracle):
//
//   COV-MEASURE-WEIGHTS          component weights must be non-negative and
//                                sum to 1, or the weighted mean is ill-defined.
//   COV-MEASURE-ANCHOR-GAP       for some reachable ordinal state a component's
//                                anchors leave it uncovered (pending there).
//   COV-MEASURE-ANCHOR-OVERLAP   two anchors match the same state with different
//                                levels (an ambiguous rubric).
//   COV-MEASURE-PENDING-DECISIVE (info) the index is pending unless *all*
//                                components resolve — the "who bears the risk"
//                                statement: any one pending component blocks it.
//
// Anchor coverage is only claimed for a component whose anchors reference solely
// variables with a declared domain; otherwise nothing is asserted (the same
// honesty the score analyzer applies to out-of-domain references).

import type { Diagnostic, Expr, Measure, MeasureComponent } from "@covenant/domain";
import { makeDiagnostic } from "@covenant/domain";
import { enumerateAssignments, stableWitness } from "./domains.js";
import { evaluateTruth } from "./semantics.js";
import { isDefinitelyTrue } from "./truth.js";
import { formatWitness } from "./score-diagnostics.js";
import type { Assignment, FiniteDomains } from "./types.js";

const WEIGHT_TOLERANCE = 1e-9;

/** Collect every `ref` path an expression reads. */
function collectRefs(expr: Expr, out: Set<string>): void {
  switch (expr.kind) {
    case "ref":
      out.add(expr.path);
      return;
    case "unary":
      collectRefs(expr.operand, out);
      return;
    case "nary":
      for (const operand of expr.operands) collectRefs(operand, out);
      return;
    case "compare":
      collectRefs(expr.left, out);
      collectRefs(expr.right, out);
      return;
    case "call":
      for (const argument of expr.arguments) collectRefs(argument, out);
      return;
    case "query":
      if (expr.where) collectRefs(expr.where, out);
      if (expr.select) collectRefs(expr.select, out);
      return;
    case "literal":
      return;
  }
}

/** The sub-domain a component's anchors range over, or null if any ref is free. */
function componentDomains(
  component: MeasureComponent,
  domains: FiniteDomains,
): FiniteDomains | null {
  const refs = new Set<string>();
  for (const anchor of component.anchors) collectRefs(anchor.when, refs);
  if (refs.size === 0) return null;
  const restricted: Record<string, readonly unknown[]> = {};
  for (const ref of refs) {
    const values = (domains as Record<string, readonly unknown[]>)[ref];
    if (values === undefined) return null; // a free variable ⇒ no claim
    restricted[ref] = values;
  }
  return restricted as FiniteDomains;
}

/** Anchors decisively true under one assignment, in declaration order. */
function decisiveAnchors(component: MeasureComponent, assignment: Assignment): number[] {
  const hits: number[] = [];
  for (const anchor of component.anchors) {
    if (isDefinitelyTrue(evaluateTruth(anchor.when, assignment))) hits.push(anchor.value);
  }
  return hits;
}

/** Location for a component-scoped diagnostic. */
function componentLocation(
  objectId: string | undefined,
  measure: Measure,
  component: MeasureComponent,
) {
  const path = `${measure.id}.${component.id}`;
  return objectId !== undefined ? { objectId, path } : { path };
}

/**
 * Structural anchor coverage, used when a component's anchors reference no
 * declared-domain variable (e.g. the Gap Matrix's evidence-query anchors). It
 * cannot reason about the anchor *conditions*, but it can verify the ordinal
 * *levels*: every level `0..scale` must be declared exactly once. A missing level
 * is a gap (the component is pending there); a duplicated level is an overlap.
 */
function structuralComponentCoverage(
  measure: Measure,
  component: MeasureComponent,
  objectId: string | undefined,
): Diagnostic[] {
  const scale = measure.aggregation.scale;
  if (!Number.isInteger(scale) || scale < 1) return [];
  const counts = new Map<number, number>();
  for (const anchor of component.anchors) {
    counts.set(anchor.value, (counts.get(anchor.value) ?? 0) + 1);
  }
  const location = componentLocation(objectId, measure, component);
  const diagnostics: Diagnostic[] = [];

  let missing: number | undefined;
  for (let level = 0; level <= scale; level += 1) {
    if (!counts.has(level)) {
      missing = level;
      break;
    }
  }
  if (missing !== undefined) {
    const witness = { level: missing };
    diagnostics.push(
      makeDiagnostic("COV-MEASURE-ANCHOR-GAP", {
        values: { measure: measure.id, component: component.id, witness: formatWitness(witness) },
        location,
        witness,
        context: { measureId: measure.id, componentId: component.id, missingLevel: missing },
      }),
    );
  }

  const duplicate = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a - b)[0];
  if (duplicate !== undefined) {
    diagnostics.push(
      makeDiagnostic("COV-MEASURE-ANCHOR-OVERLAP", {
        values: {
          measure: measure.id,
          component: component.id,
          anchorA: String(duplicate),
          anchorB: String(duplicate),
          witness: `level ${duplicate} declared more than once`,
        },
        location,
        context: { measureId: measure.id, componentId: component.id, duplicateLevel: duplicate },
      }),
    );
  }
  return diagnostics;
}

function analyzeComponentCoverage(
  measure: Measure,
  component: MeasureComponent,
  domains: FiniteDomains,
  objectId: string | undefined,
): Diagnostic[] {
  const sub = componentDomains(component, domains);
  // No declared domain (e.g. evidence-query anchors) — fall back to the
  // structural level-completeness check rather than claiming nothing.
  if (sub === null) return structuralComponentCoverage(measure, component, objectId);
  const rows = enumerateAssignments(sub);

  let gap: Assignment | undefined;
  let overlap: { assignment: Assignment; levels: number[] } | undefined;
  for (const row of rows) {
    const hits = decisiveAnchors(component, row);
    if (hits.length === 0 && gap === undefined) gap = row;
    if (hits.length > 1 && overlap === undefined) overlap = { assignment: row, levels: hits };
    if (gap !== undefined && overlap !== undefined) break;
  }

  const location =
    objectId !== undefined
      ? { objectId, path: `${measure.id}.${component.id}` }
      : { path: `${measure.id}.${component.id}` };
  const diagnostics: Diagnostic[] = [];
  if (gap !== undefined) {
    const witness = stableWitness(gap);
    diagnostics.push(
      makeDiagnostic("COV-MEASURE-ANCHOR-GAP", {
        values: { measure: measure.id, component: component.id, witness: formatWitness(witness) },
        location,
        witness,
        context: { measureId: measure.id, componentId: component.id },
      }),
    );
  }
  if (overlap !== undefined) {
    const witness = stableWitness(overlap.assignment);
    const [anchorA, anchorB] = overlap.levels;
    diagnostics.push(
      makeDiagnostic("COV-MEASURE-ANCHOR-OVERLAP", {
        values: {
          measure: measure.id,
          component: component.id,
          anchorA: String(anchorA),
          anchorB: String(anchorB),
          witness: formatWitness(witness),
        },
        location,
        witness,
        context: { measureId: measure.id, componentId: component.id, levels: overlap.levels },
      }),
    );
  }
  return diagnostics;
}

/** Options for {@link analyzeMeasureByEnumeration}. */
export interface MeasureAnalysisOptions {
  /** Governed object id (the commitment) for diagnostic locations. */
  objectId?: string;
}

/**
 * Analyze one measure over its declared finite domains. Returns weight, anchor
 * coverage, and pending-decisiveness diagnostics (empty when the rubric is clean
 * and its weights are well-formed — a clean measure is a valid, reportable
 * result).
 */
export function analyzeMeasureByEnumeration(
  measure: Measure,
  domains: FiniteDomains,
  options: MeasureAnalysisOptions = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const location =
    options.objectId !== undefined
      ? { objectId: options.objectId, path: measure.id }
      : { path: measure.id };

  // Weights: non-negative and summing to 1.
  const weightSum = measure.components.reduce((sum, component) => sum + component.weight, 0);
  if (
    Math.abs(weightSum - 1) > WEIGHT_TOLERANCE ||
    measure.components.some((component) => component.weight < 0)
  ) {
    diagnostics.push(
      makeDiagnostic("COV-MEASURE-WEIGHTS", {
        values: { measure: measure.id, sum: String(weightSum) },
        location,
      }),
    );
  }

  // Anchor coverage, per component.
  for (const component of measure.components) {
    diagnostics.push(...analyzeComponentCoverage(measure, component, domains, options.objectId));
  }

  // Pending-decisiveness: for weighted_ordinal_percent the index is all-or-nothing.
  if (measure.components.length > 0) {
    diagnostics.push(
      makeDiagnostic("COV-MEASURE-PENDING-DECISIVE", {
        values: {
          measure: measure.id,
          count: String(measure.components.length),
          components: measure.components.map((component) => component.id).join(", "),
        },
        location,
        context: { componentIds: measure.components.map((component) => component.id) },
      }),
    );
  }

  return diagnostics;
}

/** Analyze every measure on a commitment; `domains` is shared across measures. */
export function analyzeMeasures(
  measures: readonly Measure[],
  domains: FiniteDomains,
  options: MeasureAnalysisOptions = {},
): Diagnostic[] {
  return measures.flatMap((measure) => analyzeMeasureByEnumeration(measure, domains, options));
}
