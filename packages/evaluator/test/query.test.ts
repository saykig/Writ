import { describe, expect, test } from "bun:test";
import type { ActionIdentityPolicy, CountInterval, Expr, QueryExpr } from "@writ/domain";
import {
  EvalContext,
  evaluate,
  evaluateQuery,
  truthName,
  type Environment,
  type EvidenceRecord,
} from "../src/index.js";

function env(overrides: Partial<Environment> = {}): Environment {
  return {
    facts: {},
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["pid"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
    ...overrides,
  };
}

// `where`: element is a member when its `strong` field is the TruthName "true".
const whereStrong: Expr = { kind: "ref", path: "strong" };

function q(
  operation: QueryExpr["operation"],
  collection: string,
  extra: Partial<QueryExpr> = {},
): QueryExpr {
  return { kind: "query", operation, collection, ...extra };
}

function runQuery(expr: QueryExpr, e: Environment) {
  const ctx = new EvalContext(e);
  return { result: evaluateQuery(expr, ctx), diagnostics: ctx.diagnostics };
}

// Action fixtures: id, program-family identity `pid`, membership `strong`.
const A = { id: "a", pid: "P1", strong: "true" } satisfies EvidenceRecord;
const B = { id: "b", pid: "P1", strong: "true" } satisfies EvidenceRecord; // dup of A by pid
const C = { id: "c", pid: "P2", strong: "true" } satisfies EvidenceRecord;
const D = { id: "d", strong: "true" } satisfies EvidenceRecord; // unknown identity (no pid)
const E = { id: "e", pid: "P3", strong: "unknown" } satisfies EvidenceRecord; // possible member

describe("count (raw membership interval — unknown widens max only, §7)", () => {
  test("definite members set min; unknown-membership widens max, not min", () => {
    const e = env({ collections: { actions: [A, C, E] } });
    const { result } = runQuery(q("count", "actions", { where: whereStrong }), e);
    // A, C are members (min 2); E is possible (max 3).
    expect(result.countInterval).toEqual({ min: 2, max: 3 });
  });

  test("a false member is excluded from both bounds", () => {
    const e = env({ collections: { actions: [A, { id: "x", pid: "PX", strong: "false" }] } });
    const { result } = runQuery(q("count", "actions", { where: whereStrong }), e);
    expect(result.countInterval).toEqual({ min: 1, max: 1 });
  });
});

describe("count_distinct under identity policies (§8)", () => {
  const members = [A, B, C, D]; // known keys {P1, P2}, one unknown-identity (D)

  function distinctInterval(
    policy: ActionIdentityPolicy,
    records: EvidenceRecord[],
  ): CountInterval {
    const e = env({
      collections: { actions: records },
      actionIdentity: { policy, key_paths: ["pid"] },
    });
    const { result } = runQuery(q("count_distinct", "actions", { where: whereStrong }), e);
    return result.countInterval as CountInterval;
  }

  test("strict_deduplicate merges possible duplicates -> lowest count", () => {
    // distinct known keys {P1,P2} = 2; unknown D merges in -> [2,2].
    expect(distinctInterval("strict_deduplicate", members)).toEqual({ min: 2, max: 2 });
  });

  test("strict_separate counts all -> highest count", () => {
    // {P1,P2} + D separate = 3 -> [3,3].
    expect(distinctInterval("strict_separate", members)).toEqual({ min: 3, max: 3 });
  });

  test("propagate_uncertainty yields [merged, separate]", () => {
    expect(distinctInterval("propagate_uncertainty", members)).toEqual({ min: 2, max: 3 });
  });

  test("membership + identity uncertainty compose (E possible, P3 new key)", () => {
    const withPossible = [A, B, C, D, E];
    expect(distinctInterval("strict_deduplicate", withPossible)).toEqual({ min: 2, max: 3 });
    expect(distinctInterval("strict_separate", withPossible)).toEqual({ min: 3, max: 4 });
    expect(distinctInterval("propagate_uncertainty", withPossible)).toEqual({ min: 2, max: 4 });
  });
});

describe("review_required blocks a score-decisive possible duplicate (§8)", () => {
  test("blocking error emitted when decisive and identity is ambiguous", () => {
    const e = env({
      collections: { actions: [A, B, C, D] },
      actionIdentity: { policy: "review_required", key_paths: ["pid"] },
      scoreDecisive: true,
    });
    const { result, diagnostics } = runQuery(
      q("count_distinct", "actions", { where: whereStrong }),
      e,
    );
    expect(result.blocking).toBe(true);
    const identity = diagnostics.find((d) => d.code === "WRT-LINT-IDENTITY");
    expect(identity?.severity).toBe("error");
  });

  test("no block when not score-decisive (falls back to the propagate interval)", () => {
    const e = env({
      collections: { actions: [A, B, C, D] },
      actionIdentity: { policy: "review_required", key_paths: ["pid"] },
      scoreDecisive: false,
    });
    const { result, diagnostics } = runQuery(
      q("count_distinct", "actions", { where: whereStrong }),
      e,
    );
    expect(result.blocking).toBeUndefined();
    expect(result.countInterval).toEqual({ min: 2, max: 3 });
    expect(diagnostics.some((d) => d.code === "WRT-LINT-IDENTITY")).toBe(false);
  });

  test("no block when identity is certain (all keys known, distinct)", () => {
    const e = env({
      collections: { actions: [A, C] },
      actionIdentity: { policy: "review_required", key_paths: ["pid"] },
      scoreDecisive: true,
    });
    const { result } = runQuery(q("count_distinct", "actions", { where: whereStrong }), e);
    expect(result.blocking).toBeUndefined();
    expect(result.countInterval).toEqual({ min: 2, max: 2 });
  });
});

describe("threshold comparison over a count interval is 4-valued", () => {
  function countGte(threshold: number, records: EvidenceRecord[], policy: ActionIdentityPolicy) {
    const e = env({
      collections: { actions: records },
      actionIdentity: { policy, key_paths: ["pid"] },
    });
    const compareExpr: Expr = {
      kind: "compare",
      op: "gte",
      left: q("count_distinct", "actions", { where: whereStrong }),
      right: { kind: "literal", value: threshold },
    };
    return truthName(evaluate(compareExpr, e).truth);
  }

  test("interval straddling the threshold is unknown, not false", () => {
    // propagate over [A,B,C,D,E] -> [2,4].
    const recs = [A, B, C, D, E];
    expect(countGte(2, recs, "propagate_uncertainty")).toBe("true"); // 2..4 >= 2
    expect(countGte(5, recs, "propagate_uncertainty")).toBe("false"); // 2..4 >= 5
    expect(countGte(3, recs, "propagate_uncertainty")).toBe("unknown"); // straddles
  });
});

describe("exists / forall (empty quantifier semantics)", () => {
  test("exists is any(where); forall is all(where)", () => {
    const e = env({ collections: { actions: [A, E] } });
    expect(
      truthName(runQuery(q("exists", "actions", { where: whereStrong }), e).result.truth),
    ).toBe("true");
    // forall: A true, E unknown -> unknown.
    expect(
      truthName(runQuery(q("forall", "actions", { where: whereStrong }), e).result.truth),
    ).toBe("unknown");
  });

  test("empty collection: exists=false, forall=true", () => {
    const e = env({ collections: { actions: [] } });
    expect(
      truthName(runQuery(q("exists", "actions", { where: whereStrong }), e).result.truth),
    ).toBe("false");
    expect(
      truthName(runQuery(q("forall", "actions", { where: whereStrong }), e).result.truth),
    ).toBe("true");
  });
});

describe("sum over money -> exact-decimal interval (§10)", () => {
  const money = (v: string, bound = "exact") => ({ value: v, currency: "USD", bound });
  const selectAmount: Expr = { kind: "ref", path: "amt" };

  test("definite members sum exactly; scale preserved", () => {
    const recs = [
      { id: "a", strong: "true", amt: money("100.00") },
      { id: "b", strong: "true", amt: money("250.50") },
    ];
    const e = env({ collections: { actions: recs } });
    const { result } = runQuery(
      q("sum", "actions", { where: whereStrong, select: selectAmount }),
      e,
    );
    expect(result.value).toMatchObject({ unit: "USD" });
    const node = result.node;
    expect(node.value_interval).toEqual({ min: "350.50", max: "350.50" });
  });

  test("a possible member contributes [0, value] (min unaffected)", () => {
    const recs = [
      { id: "a", strong: "true", amt: money("200.00") },
      { id: "b", strong: "unknown", amt: money("100.00") },
    ];
    const e = env({ collections: { actions: recs } });
    const { result } = runQuery(
      q("sum", "actions", { where: whereStrong, select: selectAmount }),
      e,
    );
    expect(result.node.value_interval).toEqual({ min: "200.00", max: "300.00" });
  });

  test("currency mismatch -> unknown + WRT-LINT-UNIT", () => {
    const recs = [
      { id: "a", strong: "true", amt: { value: "100", currency: "USD", bound: "exact" } },
      { id: "b", strong: "true", amt: { value: "100", currency: "CAD", bound: "exact" } },
    ];
    const e = env({ collections: { actions: recs } });
    const { result, diagnostics } = runQuery(
      q("sum", "actions", { where: whereStrong, select: selectAmount }),
      e,
    );
    expect(result.known).toBe(false);
    expect(diagnostics.map((d) => d.code)).toContain("WRT-LINT-UNIT");
  });

  test("at_least bound makes the max unbounded (+infinity)", () => {
    const recs = [{ id: "a", strong: "true", amt: money("50", "at_least") }];
    const e = env({ collections: { actions: recs } });
    const { result } = runQuery(
      q("sum", "actions", { where: whereStrong, select: selectAmount }),
      e,
    );
    expect(result.node.value_interval).toEqual({ min: "50", max: null });
  });
});

describe("coverage over a declared versioned set (§11)", () => {
  const declaredSets = { partner_classes: ["p1", "p2", "p3", "p4", "p5"] };
  const idIn = (values: string[]): Expr => ({
    kind: "compare",
    op: "in",
    left: { kind: "ref", path: "id" },
    right: { kind: "literal", value: values },
  });

  test("definite coverage counts covered classes; 'at least 5' is false at 3", () => {
    const e = env({ declaredSets });
    const { result } = runQuery(
      q("coverage", "partner_classes", { where: idIn(["p1", "p2", "p3"]) }),
      e,
    );
    expect(result.countInterval).toEqual({ min: 3, max: 3 }); // covered 3, none possible, of 5
  });

  test("mixed definite + unknown membership -> [min, max]", () => {
    // p1,p2 definite; p3 unknown (in ['p3'] AND missing-ref); p4,p5 false.
    const where: Expr = {
      kind: "nary",
      op: "or",
      operands: [
        idIn(["p1", "p2"]),
        { kind: "nary", op: "and", operands: [idIn(["p3"]), { kind: "ref", path: "missing" }] },
      ],
    };
    const e = env({ declaredSets });
    const { result } = runQuery(q("coverage", "partner_classes", { where }), e);
    expect(result.countInterval).toEqual({ min: 2, max: 3 });
  });
});

describe("proof nodes expose value_interval for count/aggregation (§7)", () => {
  test("count_distinct node carries value_interval", () => {
    const e = env({
      collections: { actions: [A, B, C, D] },
      actionIdentity: { policy: "propagate_uncertainty", key_paths: ["pid"] },
    });
    const { result } = runQuery(q("count_distinct", "actions", { where: whereStrong }), e);
    expect(result.node.value_interval).toEqual({ min: 2, max: 3 });
    expect(result.node.kind).toBe("query");
  });
});
