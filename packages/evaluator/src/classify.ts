// CORE-007 — classification engine (04_FORMAL_SEMANTICS.md §6).
//
// A classification block assigns labels by evaluating each label rule's `when`
// condition. Two modes:
//
//   exclusive   Select the unique highest-priority `true` label. Equal-priority
//               distinct true labels ⇒ ambiguity (no label). A decisive
//               `contested` label ⇒ contested. `otherwise_label` is applied only
//               when it is explicitly safe under open-world semantics; an
//               `unknown` label never triggers a default (unknown is never
//               silently treated as false). Lower-priority true labels are still
//               recorded in the proof tree.
//
//   multi_label Collect every `true` label; `unknown`/`contested` labels are
//               preserved separately, not folded into the selected set.
//
// The engine evaluates over an environment scope (subject-level facts by
// default, or a supplied record for per-action classification), emitting a
// `classification` proof node whose children are every rule instance — matched
// and unmatched alike.

import type { ClassificationBlock } from "@writ/domain";
import { makeDiagnostic, type Diagnostic } from "@writ/domain";
import { EvalContext, evalTruth } from "./interpret.js";
import type { EvidenceRecord } from "./environment.js";
import { truth, truthName, type Truth, type TruthName } from "./truth.js";

/** Per-rule classification outcome retained for the proof and diagnostics. */
export interface ClassificationRuleOutcome {
  readonly ruleId: string;
  readonly label: string;
  readonly priority: number;
  readonly truth: TruthName;
  readonly proofId: string;
}

/** The result of evaluating a classification block over a scope. */
export interface ClassificationResult {
  readonly blockId: string;
  readonly mode: "exclusive" | "multi_label";
  /** Exclusive: the selected label, or `null` when none is safely selected. */
  readonly label: string | null;
  /** Multi-label: every `true` label, in rule order. */
  readonly labels: readonly string[];
  /** Labels whose rule was `unknown`, preserved rather than defaulted. */
  readonly unknownLabels: readonly string[];
  /** Labels whose rule was `contested`. */
  readonly contestedLabels: readonly string[];
  readonly status: "supported" | "ambiguous" | "contested" | "incomplete" | "unclassified";
  readonly ruleOutcomes: readonly ClassificationRuleOutcome[];
  readonly nodeId: string;
  readonly diagnostics: readonly Diagnostic[];
}

function selectionTruth(status: ClassificationResult["status"]): Truth {
  if (status === "supported") return truth("true");
  if (status === "contested") return truth("contested");
  return truth("unknown");
}

/**
 * Evaluate a classification block over `ctx`'s environment, optionally scoped to
 * a specific record (e.g. one action). Pure and deterministic.
 */
export function classifyBlock(
  block: ClassificationBlock,
  ctx: EvalContext,
  scope?: EvidenceRecord,
): ClassificationResult {
  const outcomes: ClassificationRuleOutcome[] = [];
  const childIds: string[] = [];

  for (const rule of block.rules) {
    const when = evalTruth(rule.when, ctx, scope);
    const node = ctx.proof.emit({
      kind: "classification",
      truthValue: when.truth,
      label: `${block.id}:${rule.label}`,
      ruleId: rule.id,
      childIds: [when.node.id],
      metadata: { label: rule.label, priority: rule.priority },
      ...(rule.source_passage_ids !== undefined ? { passageIds: rule.source_passage_ids } : {}),
    });
    childIds.push(node.id);
    outcomes.push({
      ruleId: rule.id,
      label: rule.label,
      priority: rule.priority,
      truth: truthName(when.truth),
      proofId: node.id,
    });
  }

  const decided =
    block.mode === "multi_label"
      ? classifyMultiLabel(block, outcomes)
      : classifyExclusive(block, outcomes);

  const aggregate = ctx.proof.emit({
    kind: "classification",
    truthValue: selectionTruth(decided.status),
    label: block.id,
    childIds,
    value: block.mode === "multi_label" ? decided.labels : decided.label,
    metadata: { mode: block.mode, status: decided.status },
  });

  return {
    ...decided,
    blockId: block.id,
    mode: block.mode,
    ruleOutcomes: outcomes,
    nodeId: aggregate.id,
  };
}

type Decided = Omit<ClassificationResult, "blockId" | "mode" | "ruleOutcomes" | "nodeId">;

function classifyExclusive(
  block: ClassificationBlock,
  outcomes: readonly ClassificationRuleOutcome[],
): Decided {
  const diagnostics: Diagnostic[] = [];
  const trueOutcomes = outcomes.filter((outcome) => outcome.truth === "true");
  const unknownLabels = outcomes.filter((o) => o.truth === "unknown").map((o) => o.label);
  const contestedLabels = outcomes.filter((o) => o.truth === "contested").map((o) => o.label);

  if (trueOutcomes.length > 0) {
    const topPriority = Math.max(...trueOutcomes.map((outcome) => outcome.priority));
    const top = trueOutcomes.filter((outcome) => outcome.priority === topPriority);
    const distinctLabels = [...new Set(top.map((outcome) => outcome.label))];
    if (distinctLabels.length > 1) {
      diagnostics.push(
        makeDiagnostic("WRT-EVAL-AMBIGUOUS", {
          values: { path: block.id },
          context: {
            classification: block.id,
            priority: topPriority,
            labels: distinctLabels,
            ruleIds: top.map((outcome) => outcome.ruleId),
          },
        }),
      );
      return {
        label: null,
        labels: [],
        unknownLabels,
        contestedLabels,
        status: "ambiguous",
        diagnostics,
      };
    }
    return {
      label: distinctLabels[0] ?? null,
      labels: distinctLabels[0] !== undefined ? [distinctLabels[0]] : [],
      unknownLabels,
      contestedLabels,
      status: "supported",
      diagnostics,
    };
  }

  // No true label. A decisive contested label makes the classification contested.
  if (contestedLabels.length > 0) {
    return {
      label: null,
      labels: [],
      unknownLabels,
      contestedLabels,
      status: "contested",
      diagnostics,
    };
  }

  // No true, no contested. `otherwise` applies only when explicitly safe under
  // open-world semantics; an outstanding `unknown` label otherwise blocks it.
  if (block.otherwise_label !== undefined && block.otherwise_safe_under_open_world === true) {
    return {
      label: block.otherwise_label,
      labels: [block.otherwise_label],
      unknownLabels,
      contestedLabels,
      status: "supported",
      diagnostics,
    };
  }

  return {
    label: null,
    labels: [],
    unknownLabels,
    contestedLabels,
    status: unknownLabels.length > 0 ? "incomplete" : "unclassified",
    diagnostics,
  };
}

function classifyMultiLabel(
  _block: ClassificationBlock,
  outcomes: readonly ClassificationRuleOutcome[],
): Decided {
  const labels = outcomes.filter((o) => o.truth === "true").map((o) => o.label);
  const unknownLabels = outcomes.filter((o) => o.truth === "unknown").map((o) => o.label);
  const contestedLabels = outcomes.filter((o) => o.truth === "contested").map((o) => o.label);
  return {
    label: null,
    labels,
    unknownLabels,
    contestedLabels,
    status:
      labels.length > 0 ? "supported" : unknownLabels.length > 0 ? "incomplete" : "unclassified",
    diagnostics: [],
  };
}
