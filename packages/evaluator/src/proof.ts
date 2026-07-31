// Minimal proof-node model for the evaluator kernel.
//
// This is a Phase-1 seed aligned to the `proofNode` shape in
// `schemas/analysis/evaluation-receipt.schema.json`. It records how a derived truth value
// was reached: leaf nodes for literals/operands and operator nodes (`not`,
// `and`, `or`) referencing their child node ids. It will later be unified with
// the proof types in `@writ/domain`; until then this package depends on
// nothing.
//
// The pure truth kernel (`./truth`) stays side-effect free. Id allocation lives
// only in `ProofBuilder`, keeping the two layers separate.

import type { Truth, TruthName } from "./truth.js";
import { and, not, or, truth, truthName } from "./truth.js";

/** Node kinds mirrored from the evaluation-receipt schema's `proofNode.kind`. */
export type ProofKind =
  | "literal"
  | "reference"
  | "operator"
  | "comparison"
  | "query"
  | "predicate"
  | "classification"
  | "score_rule"
  | "selection"
  | "diagnostic";

/** An interval value carried on a proof node (`value_interval` in the receipt). */
export interface ProofValueInterval {
  readonly min: unknown;
  readonly max: unknown;
}

/**
 * A single node in a proof DAG. Field names match the receipt schema
 * (`evaluation-receipt.schema.json` `#/$defs/proofNode`) so a collection of these
 * serializes directly into `proof.nodes[]`. Beyond the Phase-1 truth fields, a
 * node may carry the concrete `value` it evaluated to, a `value_interval` (which
 * count/aggregation nodes MUST populate, §7), and the evidence ids it rests on.
 */
export interface ProofNode {
  readonly id: string;
  readonly kind: ProofKind;
  readonly truth_value: TruthName;
  readonly child_ids: readonly string[];
  readonly label?: string;
  readonly value?: unknown;
  readonly value_interval?: ProofValueInterval;
  readonly rule_id?: string;
  readonly action_ids?: readonly string[];
  readonly claim_ids?: readonly string[];
  readonly passage_ids?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ProofNodeInit {
  readonly id: string;
  readonly kind: ProofKind;
  readonly truthValue: Truth;
  readonly childIds?: readonly string[];
  readonly label?: string;
  readonly value?: unknown;
  readonly valueInterval?: ProofValueInterval;
  readonly ruleId?: string;
  readonly actionIds?: readonly string[];
  readonly claimIds?: readonly string[];
  readonly passageIds?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Pure constructor: build a `ProofNode` from an explicit id, kind, support-pair
 * truth value, and optional children/value/interval/evidence. Does no id
 * allocation. Optional fields are OMITTED (not set to `undefined`) so the node
 * stays schema-clean under `exactOptionalPropertyTypes`.
 */
export function proofNode(init: ProofNodeInit): ProofNode {
  let node: ProofNode = {
    id: init.id,
    kind: init.kind,
    truth_value: truthName(init.truthValue),
    child_ids: init.childIds ?? [],
  };
  if (init.label !== undefined) node = { ...node, label: init.label };
  if (init.value !== undefined) node = { ...node, value: init.value };
  if (init.valueInterval !== undefined) node = { ...node, value_interval: init.valueInterval };
  if (init.ruleId !== undefined) node = { ...node, rule_id: init.ruleId };
  if (init.actionIds !== undefined) node = { ...node, action_ids: init.actionIds };
  if (init.claimIds !== undefined) node = { ...node, claim_ids: init.claimIds };
  if (init.passageIds !== undefined) node = { ...node, passage_ids: init.passageIds };
  if (init.metadata !== undefined) node = { ...node, metadata: init.metadata };
  return node;
}

export interface ProofBuilderOptions {
  /** Id prefix; ids are `${prefix}${n}` for a monotonically increasing `n`. */
  readonly prefix?: string;
}

/**
 * Deterministic id scheme + proof-emitting layer over the pure truth kernel.
 *
 * Each builder assigns ids `n0`, `n1`, … in creation order, so a given sequence
 * of calls always yields the same ids and truth values — reproducible proofs
 * without any global or wall-clock state. Operator nodes recompute their truth
 * value from their children via the kernel, so the recorded value can never
 * drift from the operator's semantics.
 */
export class ProofBuilder {
  private readonly prefix: string;
  private counter = 0;
  private readonly created: ProofNode[] = [];

  constructor(options: ProofBuilderOptions = {}) {
    this.prefix = options.prefix ?? "n";
  }

  /** All nodes created by this builder, in creation order. */
  get nodes(): readonly ProofNode[] {
    return this.created;
  }

  private nextId(): string {
    const id = `${this.prefix}${this.counter}`;
    this.counter += 1;
    return id;
  }

  private register(node: ProofNode): ProofNode {
    this.created.push(node);
    return node;
  }

  /**
   * Allocate an id and register a node from an init without an `id`. This is the
   * general entry point the interpreter and query engine use to emit comparison,
   * reference, query, and n-ary operator nodes with values/intervals attached.
   */
  emit(init: Omit<ProofNodeInit, "id">): ProofNode {
    return this.register(proofNode({ ...init, id: this.nextId() }));
  }

  /** A leaf `literal` node carrying a fixed truth value. */
  literal(value: Truth, label: string): ProofNode {
    return this.register(
      proofNode({ id: this.nextId(), kind: "literal", truthValue: value, label }),
    );
  }

  /** A generic leaf node (e.g. `reference`, `comparison`, `predicate`). */
  leaf(kind: ProofKind, value: Truth, label: string): ProofNode {
    return this.register(proofNode({ id: this.nextId(), kind, truthValue: value, label }));
  }

  /** An operator node for `not`, referencing its single child. */
  not(child: ProofNode, label = "not"): ProofNode {
    const value = not(truth(child.truth_value));
    return this.register(
      proofNode({
        id: this.nextId(),
        kind: "operator",
        truthValue: value,
        childIds: [child.id],
        label,
      }),
    );
  }

  /** An operator node for `and`, referencing both children. */
  and(left: ProofNode, right: ProofNode, label = "and"): ProofNode {
    const value = and(truth(left.truth_value), truth(right.truth_value));
    return this.register(
      proofNode({
        id: this.nextId(),
        kind: "operator",
        truthValue: value,
        childIds: [left.id, right.id],
        label,
      }),
    );
  }

  /** An operator node for `or`, referencing both children. */
  or(left: ProofNode, right: ProofNode, label = "or"): ProofNode {
    const value = or(truth(left.truth_value), truth(right.truth_value));
    return this.register(
      proofNode({
        id: this.nextId(),
        kind: "operator",
        truthValue: value,
        childIds: [left.id, right.id],
        label,
      }),
    );
  }
}
