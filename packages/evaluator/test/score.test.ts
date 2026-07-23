import { describe, expect, test } from "bun:test";
import type { Expr, ScoreProgram } from "@writ/domain";
import { EvalContext, evaluateScore, type Environment } from "../src/index.js";

function env(facts: Record<string, unknown>): Environment {
  return {
    facts,
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["id"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
    scoreDecisive: true,
  };
}

const ref = (path: string): Expr => ({ kind: "ref", path });

function program(
  rules: readonly { id: string; priority: number; result: "-1" | "0" | "+1"; when: Expr }[],
  otherwise: ScoreProgram["otherwise"] = { result: "unresolved", message: "uncovered" },
): ScoreProgram {
  return { rules, otherwise };
}

function score(prog: ScoreProgram, facts: Record<string, unknown>) {
  return evaluateScore(prog, new EvalContext(env(facts)));
}

describe("evaluateScore — deterministic branch selection", () => {
  test("selects the unique highest-priority true branch", () => {
    const prog = program([
      { id: "full", priority: 20, result: "+1", when: ref("hi") },
      { id: "none", priority: 10, result: "-1", when: ref("lo") },
    ]);
    const outcome = score(prog, { hi: "true", lo: "true" });
    expect(outcome.result).toBe("+1");
    expect(outcome.status).toBe("supported");
    expect(outcome.matchedRuleId).toBe("full");
    // The proof root is the selection node, referencing every rule node.
    expect(outcome.diagnostics).toHaveLength(0);
  });

  test("decisive-unknown at a higher priority never drops to a lower true branch", () => {
    const prog = program([
      { id: "full", priority: 20, result: "+1", when: ref("hi") },
      { id: "none", priority: 10, result: "-1", when: ref("lo") },
    ]);
    // Higher branch unknown, lower branch definitely true.
    const outcome = score(prog, { hi: "unknown", lo: "true" });
    expect(outcome.result).toBe("unresolved");
    expect(outcome.status).toBe("incomplete");
    expect(outcome.matchedRuleId).toBeUndefined();
    expect(outcome.diagnostics.map((d) => d.code)).toContain("WRT-EVAL-DECISIVE-UNKNOWN");
  });

  test("equal-priority true branch coexisting with an unknown ⇒ decisive-unknown", () => {
    const prog = program([
      { id: "a", priority: 10, result: "+1", when: ref("a") },
      { id: "b", priority: 10, result: "0", when: ref("b") },
    ]);
    const outcome = score(prog, { a: "true", b: "unknown" });
    expect(outcome.result).toBe("unresolved");
    expect(outcome.status).toBe("incomplete");
    expect(outcome.diagnostics.map((d) => d.code)).toContain("WRT-EVAL-DECISIVE-UNKNOWN");
  });

  test("different-result overlap ⇒ ambiguous / unresolved", () => {
    const prog = program([
      { id: "a", priority: 10, result: "+1", when: ref("a") },
      { id: "b", priority: 10, result: "-1", when: ref("b") },
    ]);
    const outcome = score(prog, { a: "true", b: "true" });
    expect(outcome.result).toBe("unresolved");
    expect(outcome.status).toBe("ambiguous");
    expect(outcome.diagnostics.map((d) => d.code)).toContain("WRT-EVAL-AMBIGUOUS");
  });

  test("same-result overlap ⇒ benign notice but still selects", () => {
    const prog = program([
      { id: "a", priority: 10, result: "+1", when: ref("a") },
      { id: "b", priority: 10, result: "+1", when: ref("b") },
    ]);
    const outcome = score(prog, { a: "true", b: "true" });
    expect(outcome.result).toBe("+1");
    expect(outcome.status).toBe("supported");
    expect(outcome.matchedRuleId).toBe("a");
    expect(outcome.diagnostics.map((d) => d.code)).toContain("WRT-EVAL-SAME-RESULT-OVERLAP");
    // The overlap notice is informational, not an error.
    const notice = outcome.diagnostics.find((d) => d.code === "WRT-EVAL-SAME-RESULT-OVERLAP");
    expect(notice?.severity).toBe("info");
  });

  test("no branch true and nothing decisive ⇒ otherwise applies", () => {
    const prog = program([{ id: "a", priority: 10, result: "+1", when: ref("a") }], {
      result: "-1",
      message: "default",
    });
    const outcome = score(prog, { a: "false" });
    expect(outcome.result).toBe("-1");
    expect(outcome.status).toBe("supported");
    expect(outcome.matchedRuleId).toBeUndefined();
  });

  test("every rule emits a proof node and the selection is the root", () => {
    const prog = program([
      { id: "full", priority: 20, result: "+1", when: ref("hi") },
      { id: "none", priority: 10, result: "-1", when: ref("lo") },
    ]);
    const ctx = new EvalContext(env({ hi: "true", lo: "false" }));
    const outcome = evaluateScore(prog, ctx);
    const root = ctx.proof.nodes.find((n) => n.id === outcome.rootId);
    expect(root?.kind).toBe("selection");
    // Both score_rule nodes are present and referenced by the selection.
    const ruleNodes = ctx.proof.nodes.filter((n) => n.kind === "score_rule");
    expect(ruleNodes).toHaveLength(2);
    for (const evaluation of outcome.ruleEvaluations) {
      expect(root?.child_ids).toContain(evaluation.proofId);
    }
  });
});
