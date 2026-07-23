import { describe, expect, test } from "bun:test";
import type { ClassificationBlock, Expr } from "@covenant/domain";
import { classifyBlock, EvalContext, type Environment } from "../src/index.js";

function env(facts: Record<string, unknown>): Environment {
  return {
    facts,
    collections: {},
    actionIdentity: { policy: "strict_separate", key_paths: ["id"] },
    temporal: { as_of: "2026-07-22T00:00:00Z", cutoff: "2026-07-22T00:00:00Z" },
  };
}

const ref = (path: string): Expr => ({ kind: "ref", path });

function block(
  overrides: Partial<ClassificationBlock> & Pick<ClassificationBlock, "rules">,
): ClassificationBlock {
  return {
    id: "class",
    mode: "exclusive",
    ...overrides,
  } as ClassificationBlock;
}

function run(b: ClassificationBlock, facts: Record<string, unknown>) {
  return classifyBlock(b, new EvalContext(env(facts)));
}

describe("classifyBlock — exclusive", () => {
  test("selects the unique highest-priority true label", () => {
    const b = block({
      rules: [
        { id: "r_strong", label: "strong", priority: 20, when: ref("is_strong") },
        { id: "r_weak", label: "weak", priority: 10, when: ref("is_weak") },
      ],
    });
    const result = run(b, { is_strong: "true", is_weak: "true" });
    expect(result.label).toBe("strong");
    expect(result.status).toBe("supported");
    expect(result.diagnostics).toHaveLength(0);
    // The lower-priority true label is still recorded in the proof.
    const weakNode = result.ruleOutcomes.find((o) => o.label === "weak");
    expect(weakNode?.truth).toBe("true");
  });

  test("equal-priority conflicting true labels ⇒ ambiguity, no label", () => {
    const b = block({
      rules: [
        { id: "r_a", label: "a", priority: 10, when: ref("a") },
        { id: "r_b", label: "b", priority: 10, when: ref("b") },
      ],
    });
    const result = run(b, { a: "true", b: "true" });
    expect(result.label).toBeNull();
    expect(result.status).toBe("ambiguous");
    expect(result.diagnostics.map((d) => d.code)).toContain("COV-EVAL-AMBIGUOUS");
  });

  test("unknown label does NOT trigger the otherwise default when unsafe", () => {
    const b = block({
      otherwise_label: "none",
      otherwise_safe_under_open_world: false,
      rules: [{ id: "r_a", label: "a", priority: 10, when: ref("a") }],
    });
    const result = run(b, { a: "unknown" });
    expect(result.label).toBeNull();
    expect(result.status).toBe("incomplete");
    expect(result.unknownLabels).toContain("a");
  });

  test("otherwise applies only when explicitly safe under open world", () => {
    const b = block({
      otherwise_label: "none",
      otherwise_safe_under_open_world: true,
      rules: [{ id: "r_a", label: "a", priority: 10, when: ref("a") }],
    });
    expect(run(b, { a: "false" }).label).toBe("none");
    // Even with a lingering unknown, an explicitly-safe otherwise still applies
    // only when no label is true and none is contested.
    expect(run(b, { a: "false" }).status).toBe("supported");
  });

  test("a decisive contested label ⇒ contested, no label", () => {
    const b = block({
      rules: [{ id: "r_a", label: "a", priority: 10, when: ref("a") }],
    });
    const result = run(b, { a: "contested" });
    expect(result.status).toBe("contested");
    expect(result.label).toBeNull();
    expect(result.contestedLabels).toContain("a");
  });
});

describe("classifyBlock — multi_label", () => {
  test("collects every true label and preserves unknown/contested separately", () => {
    const b = block({
      mode: "multi_label",
      rules: [
        { id: "r_a", label: "a", priority: 10, when: ref("a") },
        { id: "r_b", label: "b", priority: 10, when: ref("b") },
        { id: "r_c", label: "c", priority: 10, when: ref("c") },
        { id: "r_d", label: "d", priority: 10, when: ref("d") },
      ],
    });
    const result = run(b, { a: "true", b: "true", c: "unknown", d: "contested" });
    expect(result.labels).toEqual(["a", "b"]);
    expect(result.unknownLabels).toEqual(["c"]);
    expect(result.contestedLabels).toEqual(["d"]);
    expect(result.status).toBe("supported");
  });
});
