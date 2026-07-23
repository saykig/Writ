/**
 * Ergonomic, hand-authored TypeScript types for the Writ canonical IR.
 *
 * These mirror `specs/canonical-ir.schema.json` (the interchange authority) field
 * for field, using the same snake_case keys as schema-valid IR JSON so a parsed,
 * validated IR document is directly assignable to these types with no renaming.
 * The `json-schema-to-typescript` output in `./generated` is derived from the same
 * schema; these types are the discriminated-union-friendly form the evaluator and
 * analyzer pattern-match on. Keep them in lockstep with the schema — a change to
 * one is a change to the other.
 */

export type TruthName = "true" | "false" | "unknown" | "contested";

/** Runtime interval-valued count: [definitely, definitely-or-possibly]. */
export interface CountInterval {
  readonly min: number;
  readonly max: number;
}

// ---- Expressions (canonical-ir.schema.json #/$defs/expr) -------------------

export type UnaryOp = "not" | "is_known" | "is_contested" | "nonempty";
export type NaryOp = "and" | "or" | "set" | "add" | "multiply";
export type CompareOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "between"
  | "overlaps"
  | "before"
  | "after"
  | "contains";
export type QueryOperation =
  "count" | "count_distinct" | "exists" | "forall" | "sum" | "ratio" | "coverage" | "min" | "max";

export interface LiteralExpr {
  readonly kind: "literal";
  readonly value: unknown;
}
export interface RefExpr {
  readonly kind: "ref";
  readonly path: string;
}
export interface UnaryExpr {
  readonly kind: "unary";
  readonly op: UnaryOp;
  readonly operand: Expr;
}
export interface NaryExpr {
  readonly kind: "nary";
  readonly op: NaryOp;
  readonly operands: readonly Expr[];
}
export interface CompareExpr {
  readonly kind: "compare";
  readonly op: CompareOp;
  readonly left: Expr;
  readonly right: Expr;
}
export interface CallExpr {
  readonly kind: "call";
  readonly function: string;
  readonly arguments: readonly Expr[];
}
export interface QueryExpr {
  readonly kind: "query";
  readonly operation: QueryOperation;
  readonly collection: string;
  readonly where?: Expr;
  readonly distinct_by?: string;
  readonly select?: Expr;
}

export type Expr =
  LiteralExpr | RefExpr | UnaryExpr | NaryExpr | CompareExpr | CallExpr | QueryExpr;

// ---- Score program (canonical-ir.schema.json #/$defs/scoreProgram) ---------

export type ScoreValue = "-1" | "0" | "+1" | "not_applicable";
export type OtherwiseResult = "unresolved" | "not_applicable" | "-1" | "0" | "+1";

export interface ScoreRule {
  readonly id: string;
  readonly priority: number;
  readonly result: ScoreValue;
  readonly when: Expr;
  readonly source_passage_ids?: readonly string[];
  readonly rationale_id?: string;
  readonly intentional_overlap?: boolean;
}

export interface ScoreProgram {
  readonly rules: readonly ScoreRule[];
  readonly otherwise: {
    readonly result: OtherwiseResult;
    readonly message: string;
  };
}

// ---- Measures (weighted-ordinal graded indices) ----------------------------

/** One ordinal anchor of a rubric component: the integer level and its guard. */
export interface AnchorRule {
  readonly value: number;
  readonly when: Expr;
  readonly source_passage_ids?: readonly string[];
  readonly rationale_id?: string;
}

/**
 * A weighted rubric component whose ordinal score is a single selected anchor
 * (`0..scale`). If the anchors are ambiguous or none is decisively true the
 * component is *pending* (a typed unknown), never a silent zero.
 */
export interface MeasureComponent {
  readonly id: string;
  readonly weight: number;
  readonly anchors: readonly AnchorRule[];
  readonly source_passage_ids?: readonly string[];
  readonly rationale_id?: string;
}

/**
 * Aggregation strategy for a measure. `weighted_ordinal_percent` computes
 * `round(100 * Σ wᵢ·sᵢ / scale)` in IEEE-754 with round-half-up, so it
 * reproduces reference engines that score in floating point.
 */
export interface MeasureAggregation {
  readonly strategy: "weighted_ordinal_percent";
  readonly scale: number;
}

/**
 * A named graded measure: a weighted aggregation of ordinal rubric components.
 * The index is *pending* when any component is pending, and *public* only when
 * every contributing component is reviewed. Its numeric value is folded into the
 * fact environment under the measure id, so derived quantities (e.g.
 * `gap = subtract(a, b)`) and tier classifications can reference it.
 */
export interface Measure {
  readonly id: string;
  readonly title?: string;
  readonly components: readonly MeasureComponent[];
  readonly aggregation: MeasureAggregation;
  readonly source_passage_ids?: readonly string[];
  readonly rationale_id?: string;
}

// ---- Predicates, classification, variables ---------------------------------

export interface PredicateParameter {
  readonly name: string;
  readonly type: string;
}
export interface DeriveRule {
  readonly id: string;
  readonly conclusion: TruthName;
  readonly when: Expr;
  readonly priority?: number;
  readonly source_passage_ids?: readonly string[];
  readonly rationale_id?: string;
}
export interface Predicate {
  readonly id: string;
  readonly parameters: readonly PredicateParameter[];
  readonly rules: readonly DeriveRule[];
}

export interface ClassificationRule {
  readonly id: string;
  readonly label: string;
  readonly priority: number;
  readonly when: Expr;
  readonly source_passage_ids?: readonly string[];
  readonly rationale_id?: string;
}
export interface ClassificationBlock {
  readonly id: string;
  readonly mode: "exclusive" | "multi_label";
  readonly rules: readonly ClassificationRule[];
  readonly otherwise_label?: string;
  readonly otherwise_safe_under_open_world?: boolean;
}

export interface Variable {
  readonly id: string;
  readonly type: string;
  readonly expression: Expr;
}

// ---- Commitment structure --------------------------------------------------

export interface Interval {
  readonly start: string;
  readonly end: string;
  readonly start_inclusive: boolean;
  readonly end_inclusive: boolean;
}

export type ActionIdentityPolicy =
  "review_required" | "strict_deduplicate" | "strict_separate" | "propagate_uncertainty";
export interface ActionIdentity {
  readonly policy: ActionIdentityPolicy;
  readonly key_paths: readonly string[];
}

export interface NamedElement {
  readonly id: string;
  readonly name: string;
  readonly source_passage_ids?: readonly string[];
}

export interface Parameter {
  readonly id: string;
  readonly type: string;
  readonly default: unknown;
  readonly allowed?: readonly unknown[];
  readonly source_passage_ids?: readonly string[];
}

export type AssertionKind =
  | "exhaustive"
  | "non_overlapping"
  | "monotonic"
  | "no_unanchored_claims"
  | "all_score_inputs_reviewed"
  | "custom";
export interface AssertionDomain {
  readonly variable: string;
  readonly values: readonly unknown[] | { readonly min: number; readonly max: number };
}
export interface Assertion {
  readonly id: string;
  readonly kind: AssertionKind;
  readonly domains?: readonly AssertionDomain[];
  readonly expression?: Expr;
  readonly exceptions?: Expr;
}

export interface Rationale {
  readonly id: string;
  readonly text: string;
  readonly source_passage_ids?: readonly string[];
}

export interface Commitment {
  readonly id: string;
  readonly title: string;
  readonly summit_id?: string;
  readonly authority_passage_ids?: readonly string[];
  readonly adopted_at?: string;
  readonly subjects: readonly string[];
  readonly evaluation_window: Interval;
  readonly issue_areas?: readonly string[];
  readonly evidence_policy: "open_world" | "closed_world";
  readonly unknown_policy: "propagate" | "explicit_rules_only" | "treat_false" | "treat_true";
  readonly dimensions?: readonly NamedElement[];
  readonly goals?: readonly NamedElement[];
  readonly partner_classes?: readonly NamedElement[];
  readonly parameters: readonly Parameter[];
  readonly action_identity: ActionIdentity;
  readonly predicates: readonly Predicate[];
  readonly classifications: readonly ClassificationBlock[];
  readonly variables: readonly Variable[];
  readonly measures?: readonly Measure[];
  readonly score_program: ScoreProgram;
  readonly assertions: readonly Assertion[];
  readonly rationales?: readonly Rationale[];
}

// ---- Package + root --------------------------------------------------------

export interface ImportRef {
  readonly name: string;
  readonly version: string;
  readonly content_hash: string;
}
export interface PackageHeader {
  readonly name: string;
  readonly version: string;
  readonly content_hash: string;
  readonly imports: readonly ImportRef[];
}

export interface Source {
  readonly id: string;
  readonly uri: string;
  readonly sha256?: string;
  readonly media_type?: string;
  readonly retrieved_at?: string;
}

export interface TypeDecl {
  readonly id: string;
  readonly kind: "enum" | "concept" | "entity" | "alias";
  readonly values?: readonly string[];
  readonly base?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Waiver {
  readonly diagnostic_code: string;
  readonly object_id: string;
  readonly rationale: string;
  readonly approved_by: string;
  readonly expires_at?: string;
}

export interface CanonicalIr {
  readonly schema_version: "1.0.0";
  readonly language_version: string;
  readonly package: PackageHeader;
  readonly sources?: readonly Source[];
  readonly types?: readonly TypeDecl[];
  readonly commitments: readonly Commitment[];
  readonly source_map?: Readonly<Record<string, unknown>>;
  readonly diagnostic_waivers?: readonly Waiver[];
}
