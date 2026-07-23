import { describe, expect, test } from "bun:test";
import {
  addDecimal,
  compareDecimal,
  formatDecimal,
  multiplyDecimal,
  parseDecimal,
  subtractDecimal,
  type Decimal,
} from "../src/index.js";

function d(s: string): Decimal {
  const parsed = parseDecimal(s);
  if (parsed === null) throw new Error(`bad decimal ${s}`);
  return parsed;
}

describe("parseDecimal", () => {
  test("accepts integers, decimals, and signs; rejects junk", () => {
    expect(parseDecimal("0")).not.toBeNull();
    expect(parseDecimal("-12.50")).not.toBeNull();
    expect(parseDecimal("300000000")).not.toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("1.2.3")).toBeNull();
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("1e9")).toBeNull();
  });
});

describe("compareDecimal — exact, scale-independent, no floating point", () => {
  test("10.00 vs 9.999 is strictly greater (boundary case)", () => {
    expect(compareDecimal(d("10.00"), d("9.999"))).toBe(1);
    expect(compareDecimal(d("9.999"), d("10.00"))).toBe(-1);
  });

  test("10.00 equals 10 equals 10.000 regardless of trailing zeros", () => {
    expect(compareDecimal(d("10.00"), d("10"))).toBe(0);
    expect(compareDecimal(d("10"), d("10.000"))).toBe(0);
  });

  test("large values keep full precision (no float rounding at 2^53+)", () => {
    // 9007199254740993 is not representable as an IEEE-754 double.
    expect(compareDecimal(d("9007199254740993"), d("9007199254740992"))).toBe(1);
  });

  test("negative ordering", () => {
    expect(compareDecimal(d("-0.01"), d("0"))).toBe(-1);
    expect(compareDecimal(d("-5"), d("-5.0"))).toBe(0);
  });
});

describe("exact arithmetic avoids binary-float error", () => {
  test("0.1 + 0.2 = 0.3 exactly", () => {
    expect(formatDecimal(addDecimal(d("0.1"), d("0.2")))).toBe("0.3");
  });

  test("money sum preserves 2dp scale", () => {
    expect(formatDecimal(addDecimal(d("100.00"), d("250.50")))).toBe("350.50");
  });

  test("subtract and multiply are exact", () => {
    expect(formatDecimal(subtractDecimal(d("1.00"), d("0.99")))).toBe("0.01");
    expect(formatDecimal(multiplyDecimal(d("1.5"), d("2")))).toBe("3.0");
  });
});
