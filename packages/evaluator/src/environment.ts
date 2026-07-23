// The fact environment the evaluator runs over.
//
// The evaluator is a total, deterministic function of frozen inputs
// (04_FORMAL_SEMANTICS.md §1). `Environment` is the concrete, in-memory shape of
// those inputs for a single commitment evaluation. The score/receipt layer
// (CORE-008) constructs one from an evidence snapshot + compiled bundle +
// interpretation profile; the interpreter (CORE-005) and query engine (CORE-006)
// read from it but never mutate it.
//
// -----------------------------------------------------------------------------
// Environment shape (for CORE-008 to build from an evidence snapshot):
//
//   facts          Dotted-path-resolvable scalar facts about the subject and any
//                  pre-derived predicate/variable values, e.g.
//                    { "subject.jurisdiction": "CA", "strong_action": "true" }
//                  Nested objects are also resolvable: { subject: { id: "s1" } }
//                  reachable as ref path "subject.id".
//
//   collections    Named arrays of evidence records the query engine ranges over.
//                  Keyed by collection name used in `query.collection`, typically
//                  "actions" and "claims". Each record is an opaque
//                  `Readonly<Record<string, unknown>>` mirroring the evidence
//                  schema `action` / `claim` shape (amounts[], program_family_id,
//                  implementation_stage, attribution, relationships[], status,
//                  truth_value, ...). The evaluator resolves paths into records
//                  dynamically, so evidence API types never leak in as evaluator
//                  types (AGENTS.md: one-way dependency).
//
//   actionIdentity The commitment's identity policy: { policy, key_paths }. Drives
//                  count deduplication and the `review_required` blocking rule.
//
//   temporal       { as_of, cutoff } ISO-8601 instants. `cutoff` bounds knowledge
//                  state; `as_of` is the evaluation instant. Callers should filter
//                  score-eligible records by cutoff BEFORE building `collections`
//                  (evidence inclusion, §3) — the engine treats the collections as
//                  the already-frozen, score-eligible set.
//
//   declaredSets   Optional named, versioned element sets for coverage denominators
//                  (§11), e.g. { partner_classes: ["p1","p2","p3","p4","p5"] }.
//
//   parameters     Optional interpretation-profile parameter values (§15), e.g. an
//                  `approximate` money uncertainty. Available to callers; the core
//                  engine reads only what it needs.
//
//   scoreDecisive  Whether this evaluation is score-decisive. Governs the
//                  `review_required` identity policy: a possible-duplicate count is
//                  only *blocked* when it is score-decisive (§8). Defaults to true
//                  (the safe production default) when unset.
// -----------------------------------------------------------------------------

import type { ActionIdentity } from "@writ/domain";

/** A single evidence record (action/claim); resolved into by dotted path. */
export type EvidenceRecord = Readonly<Record<string, unknown>>;

/** Dotted-path-resolvable scalar facts about the subject and pre-derived values. */
export type ScalarFacts = Readonly<Record<string, unknown>>;

/** Temporal context: knowledge cutoff and the evaluation instant. */
export interface TemporalContext {
  readonly as_of: string;
  readonly cutoff: string;
}

/** The frozen input environment for one commitment evaluation. */
export interface Environment {
  readonly facts: ScalarFacts;
  readonly collections: Readonly<Record<string, readonly EvidenceRecord[]>>;
  readonly actionIdentity: ActionIdentity;
  readonly temporal: TemporalContext;
  readonly declaredSets?: Readonly<Record<string, readonly string[]>>;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly scoreDecisive?: boolean;
}

/** The outcome of resolving a dotted path: known + value, or not known. */
export interface Resolved {
  readonly known: boolean;
  readonly value?: unknown;
}

const NOT_KNOWN: Resolved = { known: false };

function own(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Resolve a dotted path against a root object. A whole-path own-key match wins
 * first (so keys that themselves contain dots resolve), otherwise the path is
 * split and walked segment by segment. Array elements are addressed by numeric
 * segment (`amounts.0.value`). Returns `{known:false}` the moment a segment is
 * missing — absence is unknown, never a silent value.
 */
export function resolvePath(root: unknown, path: string): Resolved {
  if (typeof root === "object" && root !== null && own(root, path)) {
    return { known: true, value: (root as Record<string, unknown>)[path] };
  }
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !own(current, part)) {
      return NOT_KNOWN;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return { known: true, value: current };
}

/**
 * Resolve a ref path in evaluation scope: an active element scope (a query body's
 * current record) is consulted first, and the environment facts are the fallback.
 * This binds the element "as the ref scope" inside `where`/`select`/`distinct_by`
 * while still allowing predicates to reference environment-level thresholds.
 */
export function resolveInScope(
  env: Environment,
  scope: EvidenceRecord | undefined,
  path: string,
): Resolved {
  if (scope !== undefined) {
    const scoped = resolvePath(scope, path);
    if (scoped.known) return scoped;
  }
  return resolvePath(env.facts, path);
}
