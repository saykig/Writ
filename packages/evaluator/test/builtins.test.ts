import { describe, expect, test } from "bun:test";
import type { Expr } from "@writ/domain";
import { evaluateValue, type Environment } from "../src/index.js";

function env(facts: Record<string, unknown> = {}): Environment {
  return {
    facts,
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["id"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
  };
}

const lit = (value: unknown): Expr => ({ kind: "literal", value });
const ref = (path: string): Expr => ({ kind: "ref", path });
const call = (fn: string, ...args: Expr[]): Expr => ({
  kind: "call",
  function: fn,
  arguments: args,
});

describe("built-in numeric functions", () => {
  test("subtract on plain numbers returns a number", () => {
    expect(evaluateValue(call("subtract", lit(5), lit(3)), env())).toEqual({
      known: true,
      value: 2,
    });
  });

  test("subtract over refs (the gap = a - b case)", () => {
    const result = evaluateValue(
      call("subtract", ref("knowledge"), ref("authority")),
      env({ knowledge: 72, authority: 40 }),
    );
    expect(result).toEqual({ known: true, value: 32 });
  });

  test("subtract keeps exact decimals", () => {
    expect(evaluateValue(call("subtract", lit("1.00"), lit("0.99")), env())).toEqual({
      known: true,
      value: "0.01",
    });
  });

  test("divide is floating point; divide-by-zero is unknown, not a guess", () => {
    expect(evaluateValue(call("divide", lit(10), lit(4)), env())).toEqual({
      known: true,
      value: 2.5,
    });
    expect(evaluateValue(call("divide", lit(3), lit(0)), env()).known).toBe(false);
  });

  test("round uses round-half-up (Math.round parity)", () => {
    expect(evaluateValue(call("round", lit(2.5)), env())).toEqual({ known: true, value: 3 });
    expect(evaluateValue(call("round", lit(74.6)), env())).toEqual({ known: true, value: 75 });
    expect(evaluateValue(call("round", lit(1.2345), lit(2)), env())).toEqual({
      known: true,
      value: 1.23,
    });
  });

  test("clamp / min2 / max2 select an operand verbatim", () => {
    expect(evaluateValue(call("clamp", lit(5), lit(0), lit(4)), env())).toEqual({
      known: true,
      value: 4,
    });
    expect(evaluateValue(call("clamp", lit(-1), lit(0), lit(4)), env())).toEqual({
      known: true,
      value: 0,
    });
    expect(evaluateValue(call("clamp", lit(2), lit(0), lit(4)), env())).toEqual({
      known: true,
      value: 2,
    });
    expect(evaluateValue(call("min2", lit(3), lit(7)), env())).toEqual({ known: true, value: 3 });
    expect(evaluateValue(call("max2", lit(3), lit(7)), env())).toEqual({ known: true, value: 7 });
  });

  test("pending propagates: an unknown argument makes the result unknown (never 0)", () => {
    // `missing` is not in facts, so it resolves unknown — a pending component.
    const result = evaluateValue(call("subtract", ref("missing"), lit(3)), env({ present: 1 }));
    expect(result.known).toBe(false);
    expect(result.value).toBeUndefined();
  });

  test("wrong arity is a diagnostic-backed unknown, not a crash", () => {
    expect(evaluateValue(call("subtract", lit(1)), env()).known).toBe(false);
    expect(evaluateValue(call("clamp", lit(1), lit(0)), env()).known).toBe(false);
  });

  test("an unimplemented call name stays unknown (no guess)", () => {
    expect(evaluateValue(call("convert_currency", lit(1), lit("USD")), env()).known).toBe(false);
  });
});
