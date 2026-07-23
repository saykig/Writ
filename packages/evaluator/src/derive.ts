// Predicate derivation (04_FORMAL_SEMANTICS.md §5).
//
// A predicate's truth is the union of its supporting and contradicting derive
// rules, evaluated over the fact environment:
//
//   truth_support = OR of rule instances concluding `true`  whose `when` holds
//   false_support = OR of rule instances concluding `false` whose `when` holds
//
// Both supported ⇒ `contested`; neither ⇒ `unknown`. A rule "fires" only when
// its `when` condition is definitely `true` — an `unknown`/`false`/`contested`
// condition contributes no support (unknown is never silently promoted). Every
// derived predicate emits a `predicate` proof node whose children are the
// per-rule instance nodes, so the derivation is fully auditable and each
// predicate ref resolves during downstream variable/score evaluation.

import type { Predicate } from "@writ/domain";
import { EvalContext, evalTruth } from "./interpret.js";
import { truthName, type Truth, type TruthName } from "./truth.js";

/** The derived truth of one predicate plus the id of its aggregate proof node. */
export interface DerivedPredicate {
  readonly predicateId: string;
  readonly truth: TruthName;
  readonly nodeId: string;
}

/**
 * Derive a single predicate to a four-valued truth over `ctx`'s environment,
 * emitting a proof subtree. Ground (zero-argument) predicates are evaluated
 * directly; parameterized predicates are evaluated with their parameters bound
 * from the environment facts, if present.
 */
export function derivePredicate(predicate: Predicate, ctx: EvalContext): DerivedPredicate {
  let supportsTrue = false;
  let supportsFalse = false;
  const childIds: string[] = [];
  const passageIds = new Set<string>();

  for (const rule of predicate.rules) {
    const when = evalTruth(rule.when, ctx);
    const fires = truthName(when.truth) === "true";
    if (fires) {
      if (rule.conclusion === "true" || rule.conclusion === "contested") supportsTrue = true;
      if (rule.conclusion === "false" || rule.conclusion === "contested") supportsFalse = true;
    }
    for (const passage of rule.source_passage_ids ?? []) passageIds.add(passage);
    const ruleNode = ctx.proof.emit({
      kind: "predicate",
      truthValue: when.truth,
      label: `${predicate.id}:${rule.id}⇒${rule.conclusion}`,
      ruleId: rule.id,
      childIds: [when.node.id],
      metadata: { fires, conclusion: rule.conclusion },
      ...(rule.source_passage_ids !== undefined ? { passageIds: rule.source_passage_ids } : {}),
    });
    childIds.push(ruleNode.id);
  }

  const combined: Truth = { supportsTrue, supportsFalse };
  const aggregate = ctx.proof.emit({
    kind: "predicate",
    truthValue: combined,
    label: predicate.id,
    childIds,
    ...(passageIds.size > 0 ? { passageIds: [...passageIds] } : {}),
  });

  return { predicateId: predicate.id, truth: truthName(combined), nodeId: aggregate.id };
}

/**
 * Derive every predicate in declaration order. Returns the derived truths so the
 * caller can fold them into the fact environment (`facts[predicate.id]`) before
 * evaluating classifications, variables, and the score program.
 */
export function derivePredicates(
  predicates: readonly Predicate[],
  ctx: EvalContext,
): DerivedPredicate[] {
  return predicates.map((predicate) => derivePredicate(predicate, ctx));
}
