// Runtime value model for the Writ evaluator's value layer.
//
// Expression operands resolve to heterogeneous runtime values: plain scalars,
// count intervals `{min,max}`, money records `{value,currency,bound}` (evidence
// schema `#/$defs/money`), united quantities `{value,unit}`, and ISO temporal
// strings / interval records. This module provides the type guards and the
// coercions that let the interpreter and query engine treat those values
// exactly and unit-aware, per 04_FORMAL_SEMANTICS.md §9–11.

import type { CountInterval } from "@writ/domain";
import {
  ZERO,
  addDecimal,
  parseDecimal,
  decimalFromNumber,
  negateDecimal,
  type Decimal,
} from "./decimal.js";
import { parseInstant, type Instant, type TemporalInterval } from "./temporal.js";

/** Money bounds from the evidence schema. */
export type MoneyBound = "exact" | "up_to" | "at_least" | "approximate";

/** A money value: exact-decimal string + ISO-4217 currency + a bound. */
export interface MoneyValue {
  readonly value: string;
  readonly currency: string;
  readonly bound: MoneyBound;
  readonly price_basis_date?: string;
}

/** A generic united quantity: exact-decimal string + a unit label. */
export interface UnitedQuantity {
  readonly value: string;
  readonly unit: string;
}

/**
 * A closed decimal interval carrying its unit (currency for money). `max: null`
 * denotes `+infinity` (an unbounded `at_least` amount). The `unit` is the
 * comparison dimension: two intervals with different units are incomparable.
 */
export interface UnitedInterval {
  readonly unit: string | null;
  readonly min: Decimal;
  readonly max: Decimal | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Type guard for an evidence money record. */
export function isMoneyValue(value: unknown): value is MoneyValue {
  if (!isObject(value)) return false;
  return (
    typeof value.value === "string" &&
    typeof value.currency === "string" &&
    (value.bound === "exact" ||
      value.bound === "up_to" ||
      value.bound === "at_least" ||
      value.bound === "approximate")
  );
}

/** Type guard for a `{value, unit}` quantity. */
export function isUnitedQuantity(value: unknown): value is UnitedQuantity {
  if (!isObject(value)) return false;
  return (
    typeof value.value === "string" && typeof value.unit === "string" && !("currency" in value)
  );
}

function isDecimal(value: unknown): value is Decimal {
  return isObject(value) && typeof value.unscaled === "bigint" && typeof value.scale === "number";
}

/** Type guard for an already-computed {@link UnitedInterval} (e.g. a money sum). */
export function isUnitedInterval(value: unknown): value is UnitedInterval {
  if (!isObject(value)) return false;
  return (
    "unit" in value &&
    (value.unit === null || typeof value.unit === "string") &&
    isDecimal(value.min) &&
    (value.max === null || isDecimal(value.max))
  );
}

/** Type guard for a numeric count interval `{min,max}` (finite numbers). */
export function isCountInterval(value: unknown): value is CountInterval {
  if (!isObject(value)) return false;
  return (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min <= value.max
  );
}

/** Coerce a number or count interval to a {@link CountInterval}; else `null`. */
export function asCountInterval(value: unknown): CountInterval | null {
  if (typeof value === "number" && Number.isFinite(value)) return { min: value, max: value };
  return isCountInterval(value) ? value : null;
}

/**
 * Convert a money value to a united decimal interval, honoring its bound
 * (§10): `exact X -> [X,X]`, `up_to X -> [0,X]` (or `[X,0]` when X<0),
 * `at_least X -> [X, +inf)`, `approximate X -> [X - u, X + u]` where `u` is a
 * configured uncertainty (default 0, i.e. treated as a point when unconfigured
 * — never silently widened). Returns `null` if the value string is malformed.
 */
export function moneyToInterval(
  money: MoneyValue,
  approximateUncertainty?: Decimal,
): UnitedInterval | null {
  const amount = parseDecimal(money.value);
  if (amount === null) return null;
  switch (money.bound) {
    case "exact":
      return { unit: money.currency, min: amount, max: amount };
    case "up_to":
      return amount.unscaled < 0n
        ? { unit: money.currency, min: amount, max: ZERO }
        : { unit: money.currency, min: ZERO, max: amount };
    case "at_least":
      return { unit: money.currency, min: amount, max: null };
    case "approximate": {
      const u = approximateUncertainty ?? ZERO;
      return {
        unit: money.currency,
        min: addDecimal(amount, negateDecimal(u)),
        max: addDecimal(amount, u),
      };
    }
  }
}

/** Convert any numeric/decimal/money value into a united interval, or `null`. */
export function toUnitedInterval(value: unknown): UnitedInterval | null {
  if (isUnitedInterval(value)) return value;
  if (isMoneyValue(value)) return moneyToInterval(value);
  if (isUnitedQuantity(value)) {
    const amount = parseDecimal(value.value);
    return amount === null ? null : { unit: value.unit, min: amount, max: amount };
  }
  if (typeof value === "string") {
    const amount = parseDecimal(value);
    return amount === null ? null : { unit: null, min: amount, max: amount };
  }
  if (typeof value === "number") {
    const amount = decimalFromNumber(value);
    return amount === null ? null : { unit: null, min: amount, max: amount };
  }
  return null;
}

/** Type guard for a temporal interval record `{start, end}` of ISO strings. */
export function isTemporalIntervalLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  return typeof value.start === "string" && typeof value.end === "string";
}

/** Coerce a value to a temporal interval; an ISO instant becomes a point. */
export function toTemporalInterval(value: unknown): TemporalInterval | null {
  if (typeof value === "string") {
    const instant = parseInstant(value);
    return instant === null ? null : { start: instant, end: instant };
  }
  if (isObject(value) && typeof value.start === "string" && typeof value.end === "string") {
    const start = parseInstant(value.start);
    const end = parseInstant(value.end);
    if (start === null || end === null) return null;
    return { start, end };
  }
  return null;
}

/** Coerce a value to a single temporal instant, or `null`. */
export function toInstant(value: unknown): Instant | null {
  return typeof value === "string" ? parseInstant(value) : null;
}
