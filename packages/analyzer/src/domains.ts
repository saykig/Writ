/**
 * Finite-domain plumbing shared by the enumeration oracle and the Z3 lowering:
 * a canonical variable order, the domain-product enumeration, stable witnesses,
 * and a per-variable model (numeric vs categorical) used to build Z3 terms.
 */

import type { Assignment, DomainValue, FiniteDomains, Witness } from "./types.js";

/** Variables in a fixed, deterministic order (alphabetical by name). */
export function canonicalKeys(domains: FiniteDomains): string[] {
  return Object.keys(domains).sort((a, b) => a.localeCompare(b));
}

/**
 * The full domain product, enumerated so the alphabetically-first variable is
 * the outermost (slowest-varying) loop and each variable's values keep their
 * declared order. The first assignment satisfying a predicate is therefore the
 * lexicographically-minimal witness under {@link compareAssignments}, matching
 * the deterministic minimum the Z3 optimizer converges to.
 */
export function enumerateAssignments(domains: FiniteDomains): Assignment[] {
  const keys = canonicalKeys(domains);
  let rows: Assignment[] = [{}];
  for (const key of keys) {
    const values = domains[key];
    if (!values || values.length === 0) throw new Error(`Domain '${key}' is empty.`);
    const next: Assignment[] = [];
    for (const row of rows) {
      for (const value of values) next.push({ ...row, [key]: value });
    }
    rows = next;
  }
  return rows;
}

/** A witness with keys sorted alphabetically for stable serialization. */
export function stableWitness(assignment: Assignment): Witness {
  return Object.fromEntries(
    Object.entries(assignment).sort(([left], [right]) => left.localeCompare(right)),
  );
}

/** Per-variable index of a value within its declared domain (its rank). */
export function domainIndex(domains: FiniteDomains, key: string, value: DomainValue): number {
  const values = domains[key] ?? [];
  return values.findIndex((candidate) => Object.is(candidate, value));
}

/**
 * Lexicographic order on assignments: compare variables in alphabetical order,
 * each by its rank in its declared domain. Lower rank wins.
 */
export function compareAssignments(domains: FiniteDomains, a: Assignment, b: Assignment): number {
  for (const key of canonicalKeys(domains)) {
    const ra = domainIndex(domains, key, a[key] as DomainValue);
    const rb = domainIndex(domains, key, b[key] as DomainValue);
    if (ra !== rb) return ra - rb;
  }
  return 0;
}

/** A numeric variable is represented directly as a Z3 Int. */
export interface NumericVar {
  readonly kind: "numeric";
  readonly name: string;
  readonly values: readonly number[];
}

/**
 * A categorical variable (booleans, enums, three-valued presence) is represented
 * as a Z3 Int selector in `[0, values.length)`; index `i` denotes `values[i]`.
 * The optional indices let the lowering treat the variable as a truth value.
 */
export interface CategoricalVar {
  readonly kind: "categorical";
  readonly name: string;
  readonly values: readonly DomainValue[];
  readonly trueIndex: number;
  readonly falseIndex: number;
  readonly unknownIndex: number;
}

export type VarModel = NumericVar | CategoricalVar;

export function modelVariable(name: string, values: readonly DomainValue[]): VarModel {
  if (values.length > 0 && values.every((value) => typeof value === "number")) {
    return { kind: "numeric", name, values: values as readonly number[] };
  }
  const index = (predicate: (value: DomainValue) => boolean): number => values.findIndex(predicate);
  return {
    kind: "categorical",
    name,
    values,
    trueIndex: index((value) => value === true || value === "true"),
    falseIndex: index((value) => value === false || value === "false"),
    unknownIndex: index((value) => value === "unknown"),
  };
}

export function modelVariables(domains: FiniteDomains): Map<string, VarModel> {
  const models = new Map<string, VarModel>();
  for (const key of canonicalKeys(domains)) {
    models.set(key, modelVariable(key, domains[key] ?? []));
  }
  return models;
}
