import { expect, test } from "bun:test";
import type { Expr } from "@writ/domain";
import { and, evaluateTruth, not, or, truth, truthName } from "../src/index.js";

test("four-valued operators follow the bilattice", () => {
  expect(truthName(not(truth("unknown")))).toBe("unknown");
  expect(truthName(not(truth("contested")))).toBe("contested");
  expect(truthName(and(truth("contested"), truth("true")))).toBe("contested");
  expect(truthName(or(truth("contested"), truth("false")))).toBe("contested");
  expect(truthName(and(truth("true"), truth("false")))).toBe("false");
  expect(truthName(or(truth("false"), truth("false")))).toBe("false");
});

const gte5: Expr = {
  kind: "compare",
  op: "gte",
  left: { kind: "ref", path: "count" },
  right: { kind: "literal", value: 5 },
};

test("interval comparisons are three-valued around a threshold", () => {
  expect(truthName(evaluateTruth(gte5, { count: { min: 5, max: 7 } }))).toBe("true");
  expect(truthName(evaluateTruth(gte5, { count: { min: 1, max: 4 } }))).toBe("false");
  expect(truthName(evaluateTruth(gte5, { count: { min: 4, max: 6 } }))).toBe("unknown");
  expect(truthName(evaluateTruth(gte5, { count: 5 }))).toBe("true");
  expect(truthName(evaluateTruth(gte5, { count: 4 }))).toBe("false");
});

test("an unresolved reference is unknown, and unknown never collapses to false", () => {
  expect(truthName(evaluateTruth({ kind: "ref", path: "absent" }, {}))).toBe("unknown");
  const guarded: Expr = {
    kind: "nary",
    op: "and",
    operands: [
      { kind: "ref", path: "absent" },
      { kind: "literal", value: true },
    ],
  };
  expect(truthName(evaluateTruth(guarded, {}))).toBe("unknown");
});
