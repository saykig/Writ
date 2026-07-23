// Exact decimal arithmetic for the Writ evaluator.
//
// Money and quantities are decimal STRINGS with units (04_FORMAL_SEMANTICS.md
// §10, AGENTS.md invariant 9: exact decimals + explicit units). This module
// implements exact decimal comparison and arithmetic by scaling to BigInt — no
// IEEE-754 floating point anywhere, so `10.00` and `10.000` compare equal and
// large sums never lose precision. Every function is pure and deterministic.
//
// A `Decimal` is `unscaled / 10^scale`, with the sign carried by `unscaled` and
// `scale` a non-negative integer count of fractional digits.

/** An exact decimal: value = `unscaled / 10^scale`, `scale >= 0`. */
export interface Decimal {
  readonly unscaled: bigint;
  readonly scale: number;
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** 10^n as a BigInt (n >= 0). */
function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/**
 * Parse a canonical decimal string (`-?\d+(\.\d+)?`) into a {@link Decimal}.
 * Returns `null` for any non-conforming input (never throws, never guesses).
 */
export function parseDecimal(input: string): Decimal | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!DECIMAL_PATTERN.test(text)) return null;
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const dot = unsigned.indexOf(".");
  if (dot === -1) {
    return { unscaled: (negative ? -1n : 1n) * BigInt(unsigned), scale: 0 };
  }
  const intPart = unsigned.slice(0, dot);
  const fracPart = unsigned.slice(dot + 1);
  const digits = `${intPart}${fracPart}`;
  const magnitude = BigInt(digits === "" ? "0" : digits);
  return { unscaled: (negative ? -1n : 1n) * magnitude, scale: fracPart.length };
}

/** Coerce a JS number to a {@link Decimal} exactly via its decimal string. */
export function decimalFromNumber(value: number): Decimal | null {
  if (!Number.isFinite(value)) return null;
  // `toString` avoids exponent notation for the finite integer/decimal range we
  // encounter (counts, small quantities). Reject exponential forms defensively.
  const text = value.toString();
  if (text.includes("e") || text.includes("E")) return null;
  return parseDecimal(text);
}

/** The exact zero. */
export const ZERO: Decimal = { unscaled: 0n, scale: 0 };

/** Align two decimals to a common scale, returning their unscaled BigInts. */
function align(a: Decimal, b: Decimal): { au: bigint; bu: bigint; scale: number } {
  const scale = Math.max(a.scale, b.scale);
  const au = a.unscaled * pow10(scale - a.scale);
  const bu = b.unscaled * pow10(scale - b.scale);
  return { au, bu, scale };
}

/** Three-way comparison: -1 if a<b, 0 if equal, 1 if a>b. Exact. */
export function compareDecimal(a: Decimal, b: Decimal): -1 | 0 | 1 {
  const { au, bu } = align(a, b);
  if (au < bu) return -1;
  if (au > bu) return 1;
  return 0;
}

/** Exact addition. */
export function addDecimal(a: Decimal, b: Decimal): Decimal {
  const { au, bu, scale } = align(a, b);
  return { unscaled: au + bu, scale };
}

/** Exact negation. */
export function negateDecimal(a: Decimal): Decimal {
  return { unscaled: -a.unscaled, scale: a.scale };
}

/** Exact subtraction (`a - b`). */
export function subtractDecimal(a: Decimal, b: Decimal): Decimal {
  return addDecimal(a, negateDecimal(b));
}

/** Exact multiplication. */
export function multiplyDecimal(a: Decimal, b: Decimal): Decimal {
  return { unscaled: a.unscaled * b.unscaled, scale: a.scale + b.scale };
}

/** The smaller of two decimals (returns `a` on a tie). */
export function minDecimal(a: Decimal, b: Decimal): Decimal {
  return compareDecimal(a, b) <= 0 ? a : b;
}

/** The larger of two decimals (returns `a` on a tie). */
export function maxDecimal(a: Decimal, b: Decimal): Decimal {
  return compareDecimal(a, b) >= 0 ? a : b;
}

/** Sign of a decimal: -1, 0, or 1. */
export function signDecimal(a: Decimal): -1 | 0 | 1 {
  if (a.unscaled < 0n) return -1;
  if (a.unscaled > 0n) return 1;
  return 0;
}

/**
 * Render a decimal to its canonical string, preserving `scale` (so a 2-dp money
 * value stays `"10.00"`). Equal values with different scales format differently
 * but compare equal via {@link compareDecimal}; this preserves significant
 * fractional precision for receipts.
 */
export function formatDecimal(a: Decimal): string {
  if (a.scale === 0) return a.unscaled.toString();
  const negative = a.unscaled < 0n;
  const digits = (negative ? -a.unscaled : a.unscaled).toString().padStart(a.scale + 1, "0");
  const cut = digits.length - a.scale;
  const intPart = digits.slice(0, cut);
  const fracPart = digits.slice(cut);
  return `${negative ? "-" : ""}${intPart}.${fracPart}`;
}
