/**
 * Analyzer-local types. IR types (`Expr`, `ScoreProgram`, `CanonicalIr`, …) come
 * from `@covenant/domain`; these describe the finite-domain analysis surface and
 * the analyzer's result shapes.
 */

import type { Diagnostic } from "@covenant/domain";

/** A concrete value a bounded-domain variable can take. */
export type DomainValue = string | number | boolean;

/** Declared finite domains for the variables a score program reads. */
export type FiniteDomains = Readonly<Record<string, readonly DomainValue[]>>;

/** A concrete point in the domain product. */
export type Assignment = Readonly<Record<string, DomainValue>>;

/** A counterexample assignment attached to a score diagnostic. */
export type Witness = Readonly<Record<string, DomainValue>>;

/** Monotonicity counterexample: two points differing only along `variable`. */
export interface MonotonicityWitness {
  readonly variable: string;
  readonly lower: Witness;
  readonly higher: Witness;
  readonly lowerScore: number;
  readonly higherScore: number;
}

/** Result of a bounded score-program analysis. */
export interface ScoreAnalysis {
  readonly assignmentsChecked: number;
  readonly diagnostics: readonly Diagnostic[];
}

/** How the monotonicity axis and its exceptions are supplied. */
export interface MonotonicitySpec {
  /** The variable along which the score must not decrease. */
  readonly variable: string;
  /** Points where monotonicity is not required (e.g. a declared counteraction). */
  readonly exceptions?: import("@covenant/domain").Expr;
}
