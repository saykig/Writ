import { describe, expect, test } from "bun:test";
import type { Expr, Measure } from "@covenant/domain";
import { analyzeMeasureByEnumeration } from "../src/measure-analysis.js";
import type { FiniteDomains } from "../src/types.js";

const ref = (path: string): Expr => ({ kind: "ref", path });
const lit = (value: unknown): Expr => ({ kind: "literal", value });
const eq = (path: string, value: number): Expr => ({
  kind: "compare",
  op: "eq",
  left: ref(path),
  right: lit(value),
});
const gte = (path: string, value: number): Expr => ({
  kind: "compare",
  op: "gte",
  left: ref(path),
  right: lit(value),
});

const LEVEL_DOMAIN: FiniteDomains = { level: [0, 1, 2, 3, 4] } as FiniteDomains;

function measure(anchors: { value: number; when: Expr }[], weight = 1): Measure {
  return {
    id: "knowledge",
    components: [{ id: "operational_control", weight, anchors }],
    aggregation: { strategy: "weighted_ordinal_percent", scale: 4 },
  };
}

const codes = (m: Measure, d: FiniteDomains = LEVEL_DOMAIN) =>
  analyzeMeasureByEnumeration(m, d, { objectId: "FIELD" }).map((x) => x.code);

describe("graded-measure analysis", () => {
  test("a clean five-anchor rubric reports only pending-decisiveness (info)", () => {
    const clean = measure([0, 1, 2, 3, 4].map((v) => ({ value: v, when: eq("level", v) })));
    expect(codes(clean)).toEqual(["COV-MEASURE-PENDING-DECISIVE"]);
  });

  test("a missing anchor is an anchor gap, with the uncovered state as witness", () => {
    const withGap = measure([0, 1, 2, 3].map((v) => ({ value: v, when: eq("level", v) })));
    const found = analyzeMeasureByEnumeration(withGap, LEVEL_DOMAIN, { objectId: "FIELD" });
    const gap = found.find((d) => d.code === "COV-MEASURE-ANCHOR-GAP");
    expect(gap).toBeDefined();
    expect(gap?.witness).toEqual({ level: 4 });
  });

  test("two anchors matching the same state is an anchor overlap", () => {
    const withOverlap = measure([
      { value: 0, when: eq("level", 0) },
      { value: 1, when: eq("level", 1) },
      { value: 3, when: gte("level", 2) },
      { value: 4, when: gte("level", 3) },
    ]);
    expect(codes(withOverlap)).toContain("COV-MEASURE-ANCHOR-OVERLAP");
  });

  test("weights that do not sum to 1 are reported", () => {
    const badWeights: Measure = {
      id: "knowledge",
      components: [
        {
          id: "a",
          weight: 0.3,
          anchors: [0, 1, 2, 3, 4].map((v) => ({ value: v, when: eq("level", v) })),
        },
        {
          id: "b",
          weight: 0.3,
          anchors: [0, 1, 2, 3, 4].map((v) => ({ value: v, when: eq("level2", v) })),
        },
      ],
      aggregation: { strategy: "weighted_ordinal_percent", scale: 4 },
    };
    const domains = { level: [0, 1, 2, 3, 4], level2: [0, 1, 2, 3, 4] } as FiniteDomains;
    expect(codes(badWeights, domains)).toContain("COV-MEASURE-WEIGHTS");
  });

  test("query-driven anchors get a structural level check (a complete 0..4 is clean)", () => {
    // No declared domain, but all five ordinal levels are present exactly once.
    const complete = measure([0, 1, 2, 3, 4].map((v) => ({ value: v, when: eq("undeclared", v) })));
    expect(codes(complete)).toEqual(["COV-MEASURE-PENDING-DECISIVE"]);
  });

  test("a missing ordinal level is caught even without a declared domain (the Gap Matrix case)", () => {
    const missing = measure([0, 1, 2, 3].map((v) => ({ value: v, when: eq("undeclared", v) })));
    const found = analyzeMeasureByEnumeration(missing, {} as FiniteDomains, { objectId: "FIELD" });
    const gap = found.find((d) => d.code === "COV-MEASURE-ANCHOR-GAP");
    expect(gap).toBeDefined();
    expect(gap?.witness).toEqual({ level: 4 });
  });

  test("a duplicated ordinal level is caught structurally", () => {
    const dup = measure([
      { value: 0, when: eq("undeclared", 0) },
      { value: 1, when: eq("undeclared", 1) },
      { value: 2, when: eq("undeclared", 2) },
      { value: 3, when: eq("undeclared", 3) },
      { value: 4, when: eq("undeclared", 4) },
      { value: 4, when: eq("undeclared", 40) },
    ]);
    expect(codes(dup, {} as FiniteDomains)).toContain("COV-MEASURE-ANCHOR-OVERLAP");
  });
});
