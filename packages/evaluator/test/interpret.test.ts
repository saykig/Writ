import { describe, expect, test } from "bun:test";
import type { CompareOp, Expr } from "@writ/domain";
import {
  compareCountIntervals,
  evaluate,
  evaluateTruth,
  evaluateValue,
  truthName,
  type Environment,
} from "../src/index.js";

function env(overrides: Partial<Environment> = {}): Environment {
  return {
    facts: {},
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["id"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
    ...overrides,
  };
}

const lit = (value: unknown): Expr => ({ kind: "literal", value });
const ref = (path: string): Expr => ({ kind: "ref", path });
const cmp = (op: CompareOp, left: Expr, right: Expr): Expr => ({
  kind: "compare",
  op,
  left,
  right,
});

describe("reference interval parity (04_FORMAL_SEMANTICS.md §7)", () => {
  test("[5,7] >= 5 = true, [1,4] >= 5 = false, [4,6] >= 5 = unknown (direct)", () => {
    expect(truthName(compareCountIntervals("gte", { min: 5, max: 7 }, { min: 5, max: 5 }))).toBe(
      "true",
    );
    expect(truthName(compareCountIntervals("gte", { min: 1, max: 4 }, { min: 5, max: 5 }))).toBe(
      "false",
    );
    expect(truthName(compareCountIntervals("gte", { min: 4, max: 6 }, { min: 5, max: 5 }))).toBe(
      "unknown",
    );
  });

  test("same three cases via the compare interpreter over interval literals", () => {
    const ge5 = (interval: { min: number; max: number }) =>
      truthName(evaluateTruth(cmp("gte", lit(interval), lit(5)), env()));
    expect(ge5({ min: 5, max: 7 })).toBe("true");
    expect(ge5({ min: 1, max: 4 })).toBe("false");
    expect(ge5({ min: 4, max: 6 })).toBe("unknown");
  });
});

describe("truth of literals and references", () => {
  test("boolean and TruthName literals map to truth values", () => {
    expect(truthName(evaluateTruth(lit(true), env()))).toBe("true");
    expect(truthName(evaluateTruth(lit("contested"), env()))).toBe("contested");
    expect(truthName(evaluateTruth(lit(42), env()))).toBe("unknown");
  });

  test("a missing reference is unknown, never false", () => {
    expect(truthName(evaluateTruth(ref("absent"), env()))).toBe("unknown");
  });

  test("dotted + nested reference resolution", () => {
    const e = env({ facts: { subject: { jurisdiction: "CA" }, "flat.key": "true" } });
    expect(evaluateValue(ref("subject.jurisdiction"), e).value).toBe("CA");
    expect(truthName(evaluateTruth(ref("flat.key"), e))).toBe("true");
  });
});

describe("unknown / contested propagation", () => {
  test("comparison with an unknown operand is unknown (not false)", () => {
    expect(truthName(evaluateTruth(cmp("eq", ref("absent"), lit(3)), env()))).toBe("unknown");
  });

  test("and/or follow the four-valued kernel", () => {
    const and: Expr = { kind: "nary", op: "and", operands: [lit(true), ref("absent")] };
    const or: Expr = { kind: "nary", op: "or", operands: [lit(true), ref("absent")] };
    expect(truthName(evaluateTruth(and, env()))).toBe("unknown");
    expect(truthName(evaluateTruth(or, env()))).toBe("true");
  });

  test("is_known / is_contested / not", () => {
    const isKnown: Expr = { kind: "unary", op: "is_known", operand: ref("absent") };
    const isContested: Expr = { kind: "unary", op: "is_contested", operand: lit("contested") };
    const notExpr: Expr = { kind: "unary", op: "not", operand: lit("unknown") };
    expect(truthName(evaluateTruth(isKnown, env()))).toBe("false");
    expect(truthName(evaluateTruth(isContested, env()))).toBe("true");
    expect(truthName(evaluateTruth(notExpr, env()))).toBe("unknown");
  });
});

describe("exact-decimal & money comparison", () => {
  test("10.00 > 9.999 via decimal strings", () => {
    expect(truthName(evaluateTruth(cmp("gt", lit("10.00"), lit("9.999")), env()))).toBe("true");
  });

  test("number vs decimal string compares exactly", () => {
    expect(truthName(evaluateTruth(cmp("gte", lit("10.00"), lit(10)), env()))).toBe("true");
  });

  test("money with matching currency compares by amount", () => {
    const usd = (v: string): unknown => ({ value: v, currency: "USD", bound: "exact" });
    expect(truthName(evaluateTruth(cmp("gt", lit(usd("100")), lit(usd("90"))), env()))).toBe(
      "true",
    );
  });

  test("currency mismatch yields unknown + WRT-LINT-UNIT (never a silent compare)", () => {
    const expr = cmp(
      "gt",
      lit({ value: "100", currency: "USD", bound: "exact" }),
      lit({ value: "90", currency: "CAD", bound: "exact" }),
    );
    const result = evaluate(expr, env());
    expect(truthName(result.truth)).toBe("unknown");
    expect(result.diagnostics.map((d) => d.code)).toContain("WRT-LINT-UNIT");
  });

  test("up_to bound becomes an interval and can straddle a threshold", () => {
    // up_to USD 300 -> [0, 300]; compared to >= 100 straddles -> unknown.
    const upTo = lit({ value: "300", currency: "USD", bound: "up_to" });
    expect(truthName(evaluateTruth(cmp("gte", upTo, lit(100)), env()))).toBe("unknown");
    // >= 0 is always true across [0,300].
    expect(truthName(evaluateTruth(cmp("gte", upTo, lit(0)), env()))).toBe("true");
  });
});

describe("type mismatch yields unknown + diagnostic", () => {
  test("ordering a non-numeric string is a type error, not false", () => {
    const result = evaluate(cmp("gt", lit("abc"), lit(5)), env());
    expect(truthName(result.truth)).toBe("unknown");
    expect(result.diagnostics.map((d) => d.code)).toContain("WRT-LINT-TYPE");
  });
});

describe("temporal comparison", () => {
  test("before / after over ISO instants", () => {
    expect(
      truthName(evaluateTruth(cmp("before", lit("2020-01-01"), lit("2021-01-01")), env())),
    ).toBe("true");
    expect(
      truthName(evaluateTruth(cmp("after", lit("2020-01-01"), lit("2021-01-01")), env())),
    ).toBe("false");
  });

  test("overlaps over interval records", () => {
    const a = lit({ start: "2026-01-01T00:00:00Z", end: "2026-06-01T00:00:00Z" });
    const b = lit({ start: "2026-05-01T00:00:00Z", end: "2026-12-01T00:00:00Z" });
    expect(truthName(evaluateTruth(cmp("overlaps", a, b), env()))).toBe("true");
  });
});

describe("value expressions", () => {
  test("set builds an array; nonempty checks it", () => {
    const set: Expr = { kind: "nary", op: "set", operands: [lit(1), lit(2)] };
    expect(evaluateValue(set, env()).value).toEqual([1, 2]);
    expect(truthName(evaluateTruth({ kind: "unary", op: "nonempty", operand: set }, env()))).toBe(
      "true",
    );
    const empty: Expr = { kind: "nary", op: "set", operands: [] };
    expect(truthName(evaluateTruth({ kind: "unary", op: "nonempty", operand: empty }, env()))).toBe(
      "false",
    );
  });

  test("add over plain numbers stays numeric; over decimals stays exact", () => {
    const addNums: Expr = { kind: "nary", op: "add", operands: [lit(1), lit(2), lit(3)] };
    expect(evaluateValue(addNums, env()).value).toBe(6);
    const addDec: Expr = { kind: "nary", op: "add", operands: [lit("0.1"), lit("0.2")] };
    expect(evaluateValue(addDec, env()).value).toBe("0.3");
  });
});

describe("proof emission", () => {
  test("every evaluation yields a proof DAG rooted at the top expression", () => {
    const result = evaluate(cmp("gte", lit({ min: 4, max: 6 }), lit(5)), env());
    expect(result.nodes.length).toBeGreaterThan(0);
    const root = result.nodes.find((n) => n.id === result.rootId);
    expect(root?.kind).toBe("comparison");
    expect(root?.truth_value).toBe("unknown");
    // children (the two operand leaves) are present.
    expect(root?.child_ids.length).toBe(2);
  });
});
