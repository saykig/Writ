// Static reference-path collection over an IR `Expr`.
//
// The score/receipt layer needs to know which named variables (or derived
// predicates / classifications) a rule condition reads, so it can attach those
// computation proof nodes as children of the rule's `score_rule` node and thread
// their contributing evidence ids upward. This is a pure structural walk — it
// touches no environment and evaluates nothing.

import type { Expr } from "@writ/domain";

/** Collect every `ref` path reachable inside an expression, in first-seen order. */
export function refPaths(expr: Expr): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (node: Expr): void => {
    switch (node.kind) {
      case "ref":
        if (!seen.has(node.path)) {
          seen.add(node.path);
          out.push(node.path);
        }
        return;
      case "literal":
        return;
      case "unary":
        visit(node.operand);
        return;
      case "nary":
        for (const operand of node.operands) visit(operand);
        return;
      case "compare":
        visit(node.left);
        visit(node.right);
        return;
      case "call":
        for (const argument of node.arguments) visit(argument);
        return;
      case "query":
        if (node.where !== undefined) visit(node.where);
        if (node.select !== undefined) visit(node.select);
        return;
    }
  };
  visit(expr);
  return out;
}
