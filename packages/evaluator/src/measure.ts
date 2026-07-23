// Graded-measure evaluation — weighted-ordinal indices with pending propagation.
//
// A measure aggregates rubric *components*, each scored by selecting one ordinal
// *anchor* (an integer level 0..scale). Selection is deterministic and never
// guesses: a component resolves to an anchor value only when exactly one anchor
// is decisively true and no anchor is uncertain; otherwise it is *pending* (a
// typed unknown, never a silent 0). Pending propagates — if any component is
// pending the whole index is pending, matching a reference engine's "if some
// score is null, return null".
//
// The `weighted_ordinal_percent` aggregation computes `round(100 * Σ wᵢ·sᵢ/scale)`
// in IEEE-754 with round-half-up (`Math.round`), so it reproduces float-scoring
// reference engines byte-for-byte. Because only reviewed, eligible evidence feeds
// the anchors (evaluate.ts §3), a non-pending index is also a *publishable* one:
// `public = pending ? null : internal`.

import type { Measure, MeasureComponent } from "@covenant/domain";
import { EvalContext, evalTruth } from "./interpret.js";
import { truth, truthName } from "./truth.js";

const WEIGHT_TOLERANCE = 1e-9;

/** One component's resolved anchor (or pending), retained for the receipt. */
export interface ComponentResult {
  readonly id: string;
  readonly weight: number;
  readonly score: number | null;
  readonly pending: boolean;
  readonly nodeId: string;
}

/** A measure's full outcome: the index, its publish gate, and per-component detail. */
export interface MeasureResult {
  readonly id: string;
  readonly strategy: string;
  readonly scale: number;
  readonly internal: number | null;
  readonly public: number | null;
  readonly pending: boolean;
  readonly components: readonly ComponentResult[];
  readonly rootId: string;
}

/** Select a component's ordinal anchor, or mark it pending (never guess). */
function selectComponent(component: MeasureComponent, ctx: EvalContext): ComponentResult {
  const evaluated = component.anchors.map((anchor) => ({
    anchor,
    truth: evalTruth(anchor.when, ctx),
  }));
  const childIds = evaluated.map((entry) => entry.truth.node.id);
  const decisive = evaluated.filter((entry) => truthName(entry.truth.truth) === "true");
  const uncertain = evaluated.filter((entry) => {
    const name = truthName(entry.truth.truth);
    return name === "unknown" || name === "contested";
  });

  // Resolve only when exactly one anchor is decisively true and none is uncertain.
  // Zero/multiple decisive anchors (a rubric gap or overlap) or any uncertain
  // anchor makes the component pending — the analyzer reports the static defect.
  const resolved =
    decisive.length === 1 && uncertain.length === 0 ? decisive[0]!.anchor : undefined;
  const score = resolved ? resolved.value : null;
  const pending = resolved === undefined;

  const node = ctx.proof.emit({
    kind: "operator",
    truthValue: pending ? truth("unknown") : truth("true"),
    label: `component:${component.id}`,
    childIds,
    ...(score !== null ? { value: score } : {}),
    metadata: { weight: component.weight, anchor: score, pending },
  });

  return { id: component.id, weight: component.weight, score, pending, nodeId: node.id };
}

/** `round(100 * Σ wᵢ·sᵢ / scale)`; null if any component is pending. */
function aggregate(measure: Measure, components: readonly ComponentResult[]): number | null {
  if (components.some((component) => component.pending)) return null;
  const scale = measure.aggregation.scale;
  const weighted = components.reduce(
    (sum, component) => sum + component.weight * ((component.score as number) / scale),
    0,
  );
  return Math.round(100 * weighted);
}

/**
 * Evaluate a measure over the current environment. Emits a proof subtree
 * (component nodes under a measure root) and returns the index plus per-component
 * detail. A weight-sum deviation from 1 is a diagnostic, not a thrown error.
 */
export function evaluateMeasure(measure: Measure, ctx: EvalContext): MeasureResult {
  const components = measure.components.map((component) => selectComponent(component, ctx));

  const weightSum = measure.components.reduce((sum, component) => sum + component.weight, 0);
  if (Math.abs(weightSum - 1) > WEIGHT_TOLERANCE) {
    ctx.diag("COV-LINT-TYPE", {
      path: `measure.${measure.id}`,
      expected: "weights summing to 1",
      actual: String(weightSum),
    });
  }

  const internal = aggregate(measure, components);
  const pending = internal === null;

  const root = ctx.proof.emit({
    kind: "operator",
    truthValue: pending ? truth("unknown") : truth("true"),
    label: `measure:${measure.id}`,
    childIds: components.map((component) => component.nodeId),
    ...(internal !== null ? { value: internal } : {}),
    metadata: { strategy: measure.aggregation.strategy, scale: measure.aggregation.scale, pending },
  });

  return {
    id: measure.id,
    strategy: measure.aggregation.strategy,
    scale: measure.aggregation.scale,
    internal,
    public: pending ? null : internal,
    pending,
    components,
    rootId: root.id,
  };
}
