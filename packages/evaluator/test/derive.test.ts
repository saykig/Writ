import { describe, expect, test } from "bun:test";
import type { Expr, Predicate } from "@covenant/domain";
import { derivePredicate, EvalContext, type Environment } from "../src/index.js";

function env(facts: Record<string, unknown>): Environment {
  return {
    facts,
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["id"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
  };
}

const ref = (path: string): Expr => ({ kind: "ref", path });

function predicate(rules: Predicate["rules"]): Predicate {
  return { id: "p", parameters: [], rules };
}

function derive(rules: Predicate["rules"], facts: Record<string, unknown>) {
  return derivePredicate(predicate(rules), new EvalContext(env(facts)));
}

describe("derivePredicate — §5 support union", () => {
  test("a firing true-concluding rule yields true", () => {
    const derived = derive([{ id: "r1", conclusion: "true", when: ref("a") }], { a: "true" });
    expect(derived.truth).toBe("true");
  });

  test("a firing false-concluding rule yields false", () => {
    const derived = derive([{ id: "r1", conclusion: "false", when: ref("a") }], { a: "true" });
    expect(derived.truth).toBe("false");
  });

  test("true-support AND false-support ⇒ contested", () => {
    const derived = derive(
      [
        { id: "r_true", conclusion: "true", when: ref("a") },
        { id: "r_false", conclusion: "false", when: ref("b") },
      ],
      { a: "true", b: "true" },
    );
    expect(derived.truth).toBe("contested");
  });

  test("no rule fires ⇒ unknown (never silently false)", () => {
    const derived = derive([{ id: "r1", conclusion: "true", when: ref("a") }], { a: "unknown" });
    expect(derived.truth).toBe("unknown");
  });

  test("an unknown condition contributes no support", () => {
    const derived = derive(
      [
        { id: "r_true", conclusion: "true", when: ref("a") },
        { id: "r_false", conclusion: "false", when: ref("b") },
      ],
      { a: "true", b: "unknown" }, // false-support rule does not fire
    );
    expect(derived.truth).toBe("true");
  });

  test("emits an aggregate predicate proof node over per-rule instances", () => {
    const ctx = new EvalContext(env({ a: "true", b: "false" }));
    const derived = derivePredicate(
      predicate([
        { id: "r1", conclusion: "true", when: ref("a") },
        { id: "r2", conclusion: "true", when: ref("b") },
      ]),
      ctx,
    );
    const aggregate = ctx.proof.nodes.find((n) => n.id === derived.nodeId);
    expect(aggregate?.kind).toBe("predicate");
    // Two per-rule instance nodes are referenced as children.
    expect(aggregate?.child_ids).toHaveLength(2);
  });
});
