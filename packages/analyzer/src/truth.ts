/**
 * Four-valued truth as a bilattice of (supportsTrue, supportsFalse).
 *
 * This is a peer re-implementation of the reference-core truth kernel. The
 * analyzer and evaluator are peers, so this is intentionally NOT imported from
 * `@covenant/evaluator`; the four-valued semantics are encoded here directly so
 * both the bounded-enumeration oracle and the Z3 lowering share one meaning of
 * true / false / unknown / contested.
 *
 *   true      = (T, F) = supports true only
 *   false     = (F, T) = supports false only
 *   unknown   = (F, F) = supports neither
 *   contested = (T, T) = supports both
 */

export type TruthName = "true" | "false" | "unknown" | "contested";

export interface Truth {
  readonly supportsTrue: boolean;
  readonly supportsFalse: boolean;
}

const TRUE: Truth = Object.freeze({ supportsTrue: true, supportsFalse: false });
const FALSE: Truth = Object.freeze({ supportsTrue: false, supportsFalse: true });
const UNKNOWN: Truth = Object.freeze({ supportsTrue: false, supportsFalse: false });
const CONTESTED: Truth = Object.freeze({ supportsTrue: true, supportsFalse: true });

const BY_NAME: Record<TruthName, Truth> = {
  true: TRUE,
  false: FALSE,
  unknown: UNKNOWN,
  contested: CONTESTED,
};

export function truth(name: TruthName): Truth {
  return BY_NAME[name];
}

export function truthName(value: Truth): TruthName {
  if (value.supportsTrue && value.supportsFalse) return "contested";
  if (value.supportsTrue) return "true";
  if (value.supportsFalse) return "false";
  return "unknown";
}

export function not(value: Truth): Truth {
  return { supportsTrue: value.supportsFalse, supportsFalse: value.supportsTrue };
}

export function and(left: Truth, right: Truth): Truth {
  return {
    supportsTrue: left.supportsTrue && right.supportsTrue,
    supportsFalse: left.supportsFalse || right.supportsFalse,
  };
}

export function or(left: Truth, right: Truth): Truth {
  return {
    supportsTrue: left.supportsTrue || right.supportsTrue,
    supportsFalse: left.supportsFalse && right.supportsFalse,
  };
}

export function all(values: readonly Truth[]): Truth {
  return values.reduce(and, TRUE);
}

export function any(values: readonly Truth[]): Truth {
  return values.reduce(or, FALSE);
}

/** A rule is decisively selected only when its `when` is definitely true. */
export function isDefinitelyTrue(value: Truth): boolean {
  return value.supportsTrue && !value.supportsFalse;
}

/** A rule cannot fire when its `when` is definitely false. */
export function isDefinitelyFalse(value: Truth): boolean {
  return value.supportsFalse && !value.supportsTrue;
}

/** Unknown or contested: the branch is uncertain for this assignment. */
export function isUncertain(value: Truth): boolean {
  return value.supportsTrue === value.supportsFalse;
}
