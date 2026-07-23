// Four-valued (Belnap-style) truth kernel for the Writ evaluator.
//
// A truth value is a pair of independent support flags — support for truth and
// support for falsity — per `docs/plan/04_FORMAL_SEMANTICS.md` §2:
//
//   true       = (1, 0)  support for truth, none for falsity
//   false      = (0, 1)  no support for truth, support for falsity
//   unknown    = (0, 0)  no support either way (absence of evidence)
//   contested  = (1, 1)  support for both (conflicting evidence)
//
// The representation deliberately distinguishes lack of evidence (`unknown`)
// from conflicting evidence (`contested`). Per invariant, `unknown` is never
// silently collapsed to `false`. There are NO nullable booleans here.
//
// Every function in this module is pure and side-effect free.

export type TruthName = "true" | "false" | "unknown" | "contested";

export interface Truth {
  readonly supportsTrue: boolean;
  readonly supportsFalse: boolean;
}

const VALUES: Record<TruthName, Truth> = {
  true: Object.freeze({ supportsTrue: true, supportsFalse: false }),
  false: Object.freeze({ supportsTrue: false, supportsFalse: true }),
  unknown: Object.freeze({ supportsTrue: false, supportsFalse: false }),
  contested: Object.freeze({ supportsTrue: true, supportsFalse: true }),
};

/** The canonical, frozen `Truth` for a named value. */
export function truth(name: TruthName): Truth {
  return VALUES[name];
}

/** Collapse a support pair to its canonical four-valued name. */
export function truthName(value: Truth): TruthName {
  if (value.supportsTrue && value.supportsFalse) return "contested";
  if (value.supportsTrue) return "true";
  if (value.supportsFalse) return "false";
  return "unknown";
}

/** Negation swaps the two support flags: `not (t, f) = (f, t)`. */
export function not(value: Truth): Truth {
  return {
    supportsTrue: value.supportsFalse,
    supportsFalse: value.supportsTrue,
  };
}

/**
 * Conjunction: truth support is conjoined, false support is disjoined.
 *
 *   truth_support = a.truth_support AND b.truth_support
 *   false_support = a.false_support OR  b.false_support
 */
export function and(left: Truth, right: Truth): Truth {
  return {
    supportsTrue: left.supportsTrue && right.supportsTrue,
    supportsFalse: left.supportsFalse || right.supportsFalse,
  };
}

/**
 * Disjunction: truth support is disjoined, false support is conjoined.
 *
 *   truth_support = a.truth_support OR  b.truth_support
 *   false_support = a.false_support AND b.false_support
 */
export function or(left: Truth, right: Truth): Truth {
  return {
    supportsTrue: left.supportsTrue || right.supportsTrue,
    supportsFalse: left.supportsFalse && right.supportsFalse,
  };
}

/**
 * Universal quantifier over a finite set: the conjunction of its members.
 * Folds with identity `true`, so an empty set is vacuously `true`.
 */
export function all(values: readonly Truth[]): Truth {
  return values.reduce(and, truth("true"));
}

/**
 * Existential quantifier over a finite set: the disjunction of its members.
 * Folds with identity `false`, so an empty set is `false`.
 */
export function any(values: readonly Truth[]): Truth {
  return values.reduce(or, truth("false"));
}

/** True only for the exact value `true` — never for `unknown` or `contested`. */
export function isDefinitelyTrue(value: Truth): boolean {
  return truthName(value) === "true";
}

/** True only for the exact value `false` — never for `unknown` or `contested`. */
export function isDefinitelyFalse(value: Truth): boolean {
  return truthName(value) === "false";
}
