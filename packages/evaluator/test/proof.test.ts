import { describe, expect, test } from "bun:test";
import { ProofBuilder, proofNode, truth } from "../src/index.js";

describe("proofNode (pure constructor)", () => {
  test("stores the truth name, defaults child_ids to [], omits absent label", () => {
    const node = proofNode({ id: "x", kind: "literal", truthValue: truth("contested") });
    expect(node.id).toBe("x");
    expect(node.kind).toBe("literal");
    expect(node.truth_value).toBe("contested");
    expect(node.child_ids).toEqual([]);
    expect(node.label).toBeUndefined();
  });

  test("carries an explicit label and children", () => {
    const node = proofNode({
      id: "y",
      kind: "operator",
      truthValue: truth("true"),
      childIds: ["a", "b"],
      label: "and",
    });
    expect(node.label).toBe("and");
    expect(node.child_ids).toEqual(["a", "b"]);
  });
});

describe("ProofBuilder operator nodes", () => {
  test("and node lists both children and carries the correct truth_value", () => {
    // contested and false = false (04_FORMAL_SEMANTICS.md §2.2)
    const b = new ProofBuilder();
    const left = b.literal(truth("contested"), "L");
    const right = b.literal(truth("false"), "R");
    const node = b.and(left, right);

    expect(node.kind).toBe("operator");
    expect(node.label).toBe("and");
    expect(node.child_ids).toEqual([left.id, right.id]);
    expect(node.truth_value).toBe("false");
  });

  test("or node lists both children and carries the correct truth_value", () => {
    // contested or false = contested (§2.3)
    const b = new ProofBuilder();
    const left = b.literal(truth("contested"), "L");
    const right = b.literal(truth("false"), "R");
    const node = b.or(left, right);

    expect(node.kind).toBe("operator");
    expect(node.label).toBe("or");
    expect(node.child_ids).toEqual([left.id, right.id]);
    expect(node.truth_value).toBe("contested");
  });

  test("not node references its single child and carries the correct truth_value", () => {
    // not unknown = unknown (§2.1)
    const b = new ProofBuilder();
    const child = b.literal(truth("unknown"), "U");
    const node = b.not(child);

    expect(node.kind).toBe("operator");
    expect(node.label).toBe("not");
    expect(node.child_ids).toEqual([child.id]);
    expect(node.truth_value).toBe("unknown");
  });

  test("operator truth values track the kernel (e.g. unknown and true = unknown)", () => {
    const b = new ProofBuilder();
    const u = b.literal(truth("unknown"), "u");
    const t = b.literal(truth("true"), "t");
    expect(b.and(u, t).truth_value).toBe("unknown");
    expect(b.or(u, t).truth_value).toBe("true");
  });
});

describe("ProofBuilder id scheme", () => {
  test("assigns sequential ids in creation order", () => {
    const b = new ProofBuilder();
    const a = b.literal(truth("true"), "a");
    const c = b.literal(truth("false"), "c");
    const node = b.and(a, c);
    expect(a.id).toBe("n0");
    expect(c.id).toBe("n1");
    expect(node.id).toBe("n2");
  });

  test("is deterministic: identical call sequences yield identical ids", () => {
    const build = () => {
      const b = new ProofBuilder();
      const l = b.literal(truth("true"), "l");
      const r = b.literal(truth("contested"), "r");
      return b.or(l, r);
    };
    const first = build();
    const second = build();
    expect(first.id).toBe(second.id);
    expect(first.child_ids).toEqual(second.child_ids);
    expect(first.truth_value).toBe(second.truth_value);
  });

  test("honors a custom prefix", () => {
    const b = new ProofBuilder({ prefix: "p" });
    expect(b.literal(truth("true"), "a").id).toBe("p0");
  });

  test("nodes accumulates every created node in order", () => {
    const b = new ProofBuilder();
    const l = b.literal(truth("true"), "l");
    const r = b.literal(truth("false"), "r");
    const root = b.and(l, r);
    expect(b.nodes).toEqual([l, r, root]);
  });
});
