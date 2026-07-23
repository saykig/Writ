// Four-valued interval comparison for the Covenant evaluator.
//
// Threshold comparisons over intervals are 4-valued (04_FORMAL_SEMANTICS.md §7,
// §10): an interval wholly satisfying the relation is `true`, wholly violating it
// is `false`, and one that straddles the threshold is `unknown`. This is the
// heart of "unknown never silently becomes false": an uncertain count or amount
// compared against a decisive threshold yields `unknown`, not a guess.
//
// `compareCountIntervals` is ported verbatim (semantics) from
// `reference-core/src/evaluator.ts`. `compareUnitedIntervals` lifts the same
// logic to exact decimals with an unbounded (`+infinity`) upper endpoint and a
// unit dimension.

import type { CountInterval } from "@covenant/domain";
import { truth, not, all, type Truth } from "./truth.js";
import { compareDecimal, type Decimal } from "./decimal.js";
import type { UnitedInterval } from "./values.js";

export type OrderOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

/** Four-valued comparison of two numeric count intervals (reference parity). */
export function compareCountIntervals(
  op: OrderOp,
  left: CountInterval,
  right: CountInterval,
): Truth {
  switch (op) {
    case "eq":
      if (left.min === left.max && right.min === right.max && left.min === right.min)
        return truth("true");
      if (left.max < right.min || right.max < left.min) return truth("false");
      return truth("unknown");
    case "neq":
      return not(compareCountIntervals("eq", left, right));
    case "gte":
      if (left.min >= right.max) return truth("true");
      if (left.max < right.min) return truth("false");
      return truth("unknown");
    case "gt":
      if (left.min > right.max) return truth("true");
      if (left.max <= right.min) return truth("false");
      return truth("unknown");
    case "lte":
      if (left.max <= right.min) return truth("true");
      if (left.min > right.max) return truth("false");
      return truth("unknown");
    case "lt":
      if (left.max < right.min) return truth("true");
      if (left.min >= right.max) return truth("false");
      return truth("unknown");
  }
}

/** `between`: `value` within `[lower, upper]` inclusive, 4-valued. */
export function countBetween(
  value: CountInterval,
  lower: CountInterval,
  upper: CountInterval,
): Truth {
  return all([
    compareCountIntervals("gte", value, lower),
    compareCountIntervals("lte", value, upper),
  ]);
}

// --- United (exact-decimal, possibly unbounded) intervals -------------------

const NEG_INF = Symbol("neg_inf");
const POS_INF = Symbol("pos_inf");
type Bound = Decimal | typeof NEG_INF | typeof POS_INF;

/** Compare two bounds where `null` upper endpoints are treated as `+infinity`. */
function cmpBound(a: Bound, b: Bound): -1 | 0 | 1 {
  if (a === b) return 0;
  if (a === NEG_INF || b === POS_INF) return -1;
  if (a === POS_INF || b === NEG_INF) return 1;
  return compareDecimal(a, b);
}

function lo(interval: UnitedInterval): Bound {
  return interval.min;
}
function hi(interval: UnitedInterval): Bound {
  return interval.max === null ? POS_INF : interval.max;
}

/**
 * Four-valued comparison of two united decimal intervals, mirroring
 * {@link compareCountIntervals} but exact and unit-aware. Callers MUST ensure the
 * units (currencies) match before calling — mismatched units are incomparable
 * and are handled upstream as `unknown` + a diagnostic.
 */
export function compareUnitedIntervals(
  op: OrderOp,
  left: UnitedInterval,
  right: UnitedInterval,
): Truth {
  const lMin = lo(left);
  const lMax = hi(left);
  const rMin = lo(right);
  const rMax = hi(right);
  switch (op) {
    case "eq":
      if (cmpBound(lMin, lMax) === 0 && cmpBound(rMin, rMax) === 0 && cmpBound(lMin, rMin) === 0)
        return truth("true");
      if (cmpBound(lMax, rMin) < 0 || cmpBound(rMax, lMin) < 0) return truth("false");
      return truth("unknown");
    case "neq":
      return not(compareUnitedIntervals("eq", left, right));
    case "gte":
      if (cmpBound(lMin, rMax) >= 0) return truth("true");
      if (cmpBound(lMax, rMin) < 0) return truth("false");
      return truth("unknown");
    case "gt":
      if (cmpBound(lMin, rMax) > 0) return truth("true");
      if (cmpBound(lMax, rMin) <= 0) return truth("false");
      return truth("unknown");
    case "lte":
      if (cmpBound(lMax, rMin) <= 0) return truth("true");
      if (cmpBound(lMin, rMax) > 0) return truth("false");
      return truth("unknown");
    case "lt":
      if (cmpBound(lMax, rMin) < 0) return truth("true");
      if (cmpBound(lMin, rMax) >= 0) return truth("false");
      return truth("unknown");
  }
}
