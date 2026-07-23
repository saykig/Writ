import { describe, expect, test } from "bun:test";
import type { CompareOp, Expr, Measure } from "@writ/domain";
import { EvalContext, evaluateMeasure, type Environment } from "../src/index.js";

function env(facts: Record<string, unknown> = {}): Environment {
  return {
    facts,
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["id"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
  };
}

const ref = (path: string): Expr => ({ kind: "ref", path });
const lit = (value: unknown): Expr => ({ kind: "literal", value });
const cmp = (op: CompareOp, left: Expr, right: Expr): Expr => ({
  kind: "compare",
  op,
  left,
  right,
});

/** A five-anchor ordinal component keyed on an integer `<id>_level` fact. */
function component(id: string, weight: number) {
  return {
    id,
    weight,
    anchors: [0, 1, 2, 3, 4].map((value) => ({
      value,
      when: cmp("eq", ref(`${id}_level`), lit(value)),
    })),
  };
}

function measure(id: string, weights: number[]): Measure {
  return {
    id,
    components: weights.map((w, i) => component(`c${i}`, w)),
    aggregation: { strategy: "weighted_ordinal_percent", scale: 4 },
  };
}

function run(m: Measure, facts: Record<string, unknown>) {
  return evaluateMeasure(m, new EvalContext(env(facts)));
}

describe("weighted-ordinal measure", () => {
  test("reproduces round(100 * Σ w·s/4): two components 0.5/0.5", () => {
    // 0.5·3/4 + 0.5·4/4 = 0.375 + 0.5 = 0.875 → round(87.5) = 88
    const r = run(measure("m", [0.5, 0.5]), { c0_level: 3, c1_level: 4 });
    expect(r.internal).toBe(88);
    expect(r.public).toBe(88);
    expect(r.pending).toBe(false);
    expect(r.components.map((c) => c.score)).toEqual([3, 4]);
  });

  test("five equal-weight components all at anchor 3 → 75", () => {
    const r = run(measure("m", [0.2, 0.2, 0.2, 0.2, 0.2]), {
      c0_level: 3,
      c1_level: 3,
      c2_level: 3,
      c3_level: 3,
      c4_level: 3,
    });
    expect(r.internal).toBe(75);
  });

  test("a pending component makes the index pending (null, not 0) and unpublishable", () => {
    // c1_level is absent → no anchor fires → component pending → index pending.
    const r = run(measure("m", [0.5, 0.5]), { c0_level: 4 });
    expect(r.internal).toBeNull();
    expect(r.public).toBeNull();
    expect(r.pending).toBe(true);
    expect(r.components.find((c) => c.id === "c1")?.pending).toBe(true);
    expect(r.components.find((c) => c.id === "c0")?.score).toBe(4);
  });

  test("all zeros aggregate to 0 (distinct from pending)", () => {
    const r = run(measure("m", [0.5, 0.5]), { c0_level: 0, c1_level: 0 });
    expect(r.internal).toBe(0);
    expect(r.pending).toBe(false);
  });
});
