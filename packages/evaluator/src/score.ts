// CORE-008 (part 1) — deterministic score-branch selection with proof.
//
// Ported from `reference-core/src/evaluator.ts::evaluateScore`, with the runtime
// diagnostic codes renamed to the ADR-0011 `COV-EVAL-*` catalog and a proof
// subtree emitted for every rule plus a `selection` root. The value/status split
// of 04_FORMAL_SEMANTICS.md §12–13 is preserved:
//
//   result        ∈ { -1, 0, +1, not_applicable, unresolved }
//   result_status ∈ { supported, contested, incomplete, ambiguous, invalid }
//
// Selection procedure (§12): dedupe priorities descending; within each priority
// group partition `true` vs `unknown`/`contested`; a decisive `unknown` at or
// above a true branch ⇒ unresolved/incomplete (never drop to a lower branch);
// equal-priority differing true results ⇒ ambiguous/unresolved; equal-priority
// same-result overlap ⇒ a benign overlap notice but still selects.

import type { ScoreProgram, ScoreValue } from "@covenant/domain";
import { makeDiagnostic, type Diagnostic } from "@covenant/domain";
import { EvalContext, evalTruth } from "./interpret.js";
import { refPaths } from "./refs.js";
import { truth, truthName, type Truth, type TruthName } from "./truth.js";

export type ScoreResultValue = ScoreValue | "unresolved";
export type ScoreResultStatus = "supported" | "contested" | "incomplete" | "ambiguous" | "invalid";

/** Contribution metadata for a named variable's already-emitted proof node. */
export interface VariableContribution {
  readonly nodeId: string;
  readonly actionIds: readonly string[];
  readonly claimIds: readonly string[];
}

/** One score rule's evaluation, retained for the receipt `rule_evaluations`. */
export interface ScoreRuleEvaluation {
  readonly ruleId: string;
  readonly priority: number;
  readonly result: ScoreValue;
  readonly truth: TruthName;
  readonly proofId: string;
  readonly actionIds: readonly string[];
  readonly claimIds: readonly string[];
}

/** The full outcome of evaluating a score program over the environment. */
export interface ScoreOutcome {
  readonly result: ScoreResultValue;
  readonly status: ScoreResultStatus;
  readonly matchedRuleId?: string;
  readonly ruleEvaluations: readonly ScoreRuleEvaluation[];
  readonly qualifyingActionIds: readonly string[];
  readonly qualifyingClaimIds: readonly string[];
  readonly rootId: string;
  readonly diagnostics: readonly Diagnostic[];
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Evaluate a score program over `ctx`'s environment. `variableContributions`
 * maps a variable id to its already-emitted computation node, so each rule's
 * `score_rule` node can reference the variable nodes it read and thread their
 * contributing evidence ids upward (per-rule and then to the selection).
 */
export function evaluateScore(
  program: ScoreProgram,
  ctx: EvalContext,
  variableContributions: ReadonlyMap<string, VariableContribution> = new Map(),
): ScoreOutcome {
  const evaluations: ScoreRuleEvaluation[] = [];
  const ruleNodeIds: string[] = [];

  for (const rule of program.rules) {
    const when = evalTruth(rule.when, ctx);
    const used = refPaths(rule.when).filter((path) => variableContributions.has(path));
    const usedContribs = used.map((path) => variableContributions.get(path)!);
    const actionIds = dedupe(usedContribs.flatMap((contrib) => [...contrib.actionIds]));
    const claimIds = dedupe(usedContribs.flatMap((contrib) => [...contrib.claimIds]));
    const childIds = [when.node.id, ...usedContribs.map((contrib) => contrib.nodeId)];

    const node = ctx.proof.emit({
      kind: "score_rule",
      truthValue: when.truth,
      label: rule.id,
      ruleId: rule.id,
      childIds,
      metadata: { priority: rule.priority, result: rule.result },
      ...(actionIds.length > 0 ? { actionIds } : {}),
      ...(claimIds.length > 0 ? { claimIds } : {}),
      ...(rule.source_passage_ids !== undefined ? { passageIds: rule.source_passage_ids } : {}),
    });
    ruleNodeIds.push(node.id);
    evaluations.push({
      ruleId: rule.id,
      priority: rule.priority,
      result: rule.result,
      truth: truthName(when.truth),
      proofId: node.id,
      actionIds,
      claimIds,
    });
  }

  const selection = selectBranch(program, evaluations);

  const rootTruth: Truth =
    selection.status === "supported"
      ? truth("true")
      : selection.status === "contested"
        ? truth("contested")
        : truth("unknown");
  const matched =
    selection.matchedRuleId !== undefined
      ? evaluations.find((evaluation) => evaluation.ruleId === selection.matchedRuleId)
      : undefined;

  const root = ctx.proof.emit({
    kind: "selection",
    truthValue: rootTruth,
    label:
      selection.matchedRuleId !== undefined
        ? `Selected unique highest-priority true score branch \`${selection.matchedRuleId}\``
        : `Score unresolved (${selection.status})`,
    childIds: ruleNodeIds,
    value: selection.result,
    metadata: { status: selection.status },
    ...(selection.matchedRuleId !== undefined ? { ruleId: selection.matchedRuleId } : {}),
    ...(matched && matched.actionIds.length > 0 ? { actionIds: [...matched.actionIds] } : {}),
    ...(matched && matched.claimIds.length > 0 ? { claimIds: [...matched.claimIds] } : {}),
  });

  return {
    result: selection.result,
    status: selection.status,
    ...(selection.matchedRuleId !== undefined ? { matchedRuleId: selection.matchedRuleId } : {}),
    ruleEvaluations: evaluations,
    qualifyingActionIds: matched ? [...matched.actionIds] : [],
    qualifyingClaimIds: matched ? [...matched.claimIds] : [],
    rootId: root.id,
    diagnostics: selection.diagnostics,
  };
}

interface Selection {
  readonly result: ScoreResultValue;
  readonly status: ScoreResultStatus;
  readonly matchedRuleId?: string;
  readonly diagnostics: Diagnostic[];
}

function selectBranch(
  program: ScoreProgram,
  evaluations: readonly ScoreRuleEvaluation[],
): Selection {
  const diagnostics: Diagnostic[] = [];
  const priorities = [...new Set(evaluations.map((evaluation) => evaluation.priority))].sort(
    (a, b) => b - a,
  );

  for (const priority of priorities) {
    const group = evaluations.filter((evaluation) => evaluation.priority === priority);
    const trueRules = group.filter((evaluation) => evaluation.truth === "true");
    const uncertainRules = group.filter(
      (evaluation) => evaluation.truth === "unknown" || evaluation.truth === "contested",
    );

    if (trueRules.length > 0) {
      // A true branch coexists with an equal-priority uncertain branch that could
      // have changed the result: unresolved, never a guess.
      if (uncertainRules.length > 0) {
        diagnostics.push(
          makeDiagnostic("COV-EVAL-DECISIVE-UNKNOWN", {
            values: { path: `priority ${priority}` },
            context: {
              priority,
              trueRuleIds: trueRules.map((rule) => rule.ruleId),
              uncertainRuleIds: uncertainRules.map((rule) => rule.ruleId),
            },
          }),
        );
        return { result: "unresolved", status: "incomplete", diagnostics };
      }
      const distinctResults = dedupe(trueRules.map((rule) => rule.result));
      if (distinctResults.length > 1) {
        diagnostics.push(
          makeDiagnostic("COV-EVAL-AMBIGUOUS", {
            values: { path: `priority ${priority}` },
            context: {
              priority,
              ruleIds: trueRules.map((rule) => rule.ruleId),
              results: distinctResults,
            },
          }),
        );
        return { result: "unresolved", status: "ambiguous", diagnostics };
      }
      if (trueRules.length > 1) {
        const [ruleA, ruleB] = trueRules;
        diagnostics.push(
          makeDiagnostic("COV-EVAL-SAME-RESULT-OVERLAP", {
            values: {
              ruleA: ruleA?.ruleId ?? "",
              ruleB: ruleB?.ruleId ?? "",
              result: distinctResults[0] ?? "",
            },
            context: { priority, ruleIds: trueRules.map((rule) => rule.ruleId) },
          }),
        );
      }
      const selected = trueRules[0];
      if (!selected) throw new Error("Invariant violation: expected a selected score rule.");
      return {
        result: selected.result,
        status: "supported",
        matchedRuleId: selected.ruleId,
        diagnostics,
      };
    }

    // No true branch at this priority, but an uncertain one that could change the
    // result: stop here — descending to a lower branch would be an unsafe guess.
    if (uncertainRules.length > 0) {
      diagnostics.push(
        makeDiagnostic("COV-EVAL-DECISIVE-UNKNOWN", {
          values: { path: `priority ${priority}` },
          context: {
            priority,
            uncertainRuleIds: uncertainRules.map((rule) => rule.ruleId),
          },
        }),
      );
      return { result: "unresolved", status: "incomplete", diagnostics };
    }
  }

  // No rule matched and nothing decisive is uncertain: apply `otherwise`.
  const result = program.otherwise.result;
  return {
    result,
    status: result === "unresolved" ? "incomplete" : "supported",
    diagnostics,
  };
}
