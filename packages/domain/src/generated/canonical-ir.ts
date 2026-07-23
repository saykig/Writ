/* eslint-disable */
/**
 * This file was automatically generated from the vendored JSON Schema.
 * Do not edit by hand. Regenerate with `bun run generate` in packages/domain.
 */

export type Identifier = string;
export type Expr =
  LiteralExpr | RefExpr | UnaryExpr | NaryExpr | CompareExpr | CallExpr | QueryExpr;

export interface CanonicalIr {
  schema_version: "1.0.0";
  language_version: string;
  package: Package;
  sources?: Source[];
  types?: TypeDecl[];
  /**
   * @minItems 1
   */
  commitments: [Commitment, ...Commitment[]];
  source_map?: {};
  diagnostic_waivers?: Waiver[];
}
export interface Package {
  name: string;
  version: string;
  content_hash: string;
  imports: {
    name: string;
    version: string;
    content_hash: string;
  }[];
}
export interface Source {
  id: Identifier;
  uri: string;
  sha256?: string;
  media_type?: string;
  retrieved_at?: string;
}
export interface TypeDecl {
  id: Identifier;
  kind: "enum" | "concept" | "entity" | "alias";
  values?: string[];
  base?: string;
  metadata?: {};
}
export interface Commitment {
  id: Identifier;
  title: string;
  summit_id?: string;
  authority_passage_ids?: string[];
  adopted_at?: string;
  /**
   * @minItems 1
   */
  subjects: [string, ...string[]];
  evaluation_window: Interval;
  issue_areas?: string[];
  evidence_policy: "open_world" | "closed_world";
  unknown_policy: "propagate" | "explicit_rules_only" | "treat_false" | "treat_true";
  dimensions?: NamedElement[];
  goals?: NamedElement[];
  partner_classes?: NamedElement[];
  parameters: Parameter[];
  action_identity: ActionIdentity;
  predicates: Predicate[];
  classifications: ClassificationBlock[];
  variables: Variable[];
  score_program: ScoreProgram;
  assertions: Assertion[];
  rationales?: Rationale[];
  measures?: Measure[];
}
export interface Interval {
  start: string;
  end: string;
  start_inclusive: boolean;
  end_inclusive: boolean;
}
export interface NamedElement {
  id: Identifier;
  name: string;
  source_passage_ids?: string[];
}
export interface Parameter {
  id: Identifier;
  type: string;
  default: unknown;
  allowed?: unknown[];
  source_passage_ids?: string[];
}
export interface ActionIdentity {
  policy: "review_required" | "strict_deduplicate" | "strict_separate" | "propagate_uncertainty";
  /**
   * @minItems 1
   */
  key_paths: [string, ...string[]];
}
export interface Predicate {
  id: Identifier;
  parameters: {
    name: string;
    type: string;
  }[];
  rules: DeriveRule[];
}
export interface DeriveRule {
  id: Identifier;
  conclusion: "true" | "false" | "unknown" | "contested";
  when: Expr;
  priority?: number;
  source_passage_ids?: string[];
  rationale_id?: string;
}
export interface LiteralExpr {
  kind: "literal";
  value: unknown;
}
export interface RefExpr {
  kind: "ref";
  path: string;
}
export interface UnaryExpr {
  kind: "unary";
  op: "not" | "is_known" | "is_contested" | "nonempty";
  operand: Expr;
}
export interface NaryExpr {
  kind: "nary";
  op: "and" | "or" | "set" | "add" | "multiply";
  operands: Expr[];
}
export interface CompareExpr {
  kind: "compare";
  op:
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
  left: Expr;
  right: Expr;
}
export interface CallExpr {
  kind: "call";
  function: string;
  arguments: Expr[];
}
export interface QueryExpr {
  kind: "query";
  operation:
    "count" | "count_distinct" | "exists" | "forall" | "sum" | "ratio" | "coverage" | "min" | "max";
  collection: string;
  where?: Expr;
  distinct_by?: string;
  select?: Expr;
}
export interface ClassificationBlock {
  id: Identifier;
  mode: "exclusive" | "multi_label";
  rules: ClassificationRule[];
  otherwise_label?: string;
  otherwise_safe_under_open_world?: boolean;
}
export interface ClassificationRule {
  id: Identifier;
  label: string;
  priority: number;
  when: Expr;
  source_passage_ids?: string[];
  rationale_id?: string;
}
export interface Variable {
  id: Identifier;
  type: string;
  expression: Expr;
}
export interface ScoreProgram {
  /**
   * @minItems 1
   */
  rules: [ScoreRule, ...ScoreRule[]];
  otherwise: {
    result: "unresolved" | "not_applicable" | "-1" | "0" | "+1";
    message: string;
  };
}
export interface ScoreRule {
  id: Identifier;
  priority: number;
  result: "-1" | "0" | "+1" | "not_applicable";
  when: Expr;
  source_passage_ids?: string[];
  rationale_id?: string;
  intentional_overlap?: boolean;
}
export interface Assertion {
  id: Identifier;
  kind:
    | "exhaustive"
    | "non_overlapping"
    | "monotonic"
    | "no_unanchored_claims"
    | "all_score_inputs_reviewed"
    | "custom";
  domains?: Domain[];
  expression?: Expr;
  exceptions?: Expr;
}
export interface Domain {
  variable: string;
  values:
    | unknown[]
    | {
        min: number;
        max: number;
      };
}
export interface Rationale {
  id: Identifier;
  text: string;
  source_passage_ids?: string[];
}
export interface Measure {
  id: Identifier;
  title?: string;
  /**
   * @minItems 1
   */
  components: [MeasureComponent, ...MeasureComponent[]];
  aggregation: {
    strategy: "weighted_ordinal_percent";
    scale: number;
  };
  source_passage_ids?: string[];
  rationale_id?: string;
}
export interface MeasureComponent {
  id: Identifier;
  weight: number;
  /**
   * @minItems 1
   */
  anchors: [AnchorRule, ...AnchorRule[]];
  source_passage_ids?: string[];
  rationale_id?: string;
}
export interface AnchorRule {
  value: number;
  when: Expr;
  source_passage_ids?: string[];
  rationale_id?: string;
}
export interface Waiver {
  diagnostic_code: string;
  object_id: string;
  rationale: string;
  approved_by: string;
  expires_at?: string;
}
