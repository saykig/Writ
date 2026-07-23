import type { TruthName } from "./truth";

export interface CountInterval {
  readonly min: number;
  readonly max: number;
}

export type FactValue = unknown;
export type Facts = Readonly<Record<string, FactValue>>;

export type Expr =
  | { readonly kind: "literal"; readonly value: unknown }
  | { readonly kind: "ref"; readonly path: string }
  | {
      readonly kind: "unary";
      readonly op: "not" | "is_known" | "is_contested" | "nonempty";
      readonly operand: Expr;
    }
  | {
      readonly kind: "nary";
      readonly op: "and" | "or" | "set" | "add" | "multiply";
      readonly operands: readonly Expr[];
    }
  | {
      readonly kind: "compare";
      readonly op:
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
      readonly left: Expr;
      readonly right: Expr;
    }
  | { readonly kind: "call"; readonly function: string; readonly arguments: readonly Expr[] }
  | {
      readonly kind: "query";
      readonly operation: string;
      readonly collection: string;
      readonly where?: Expr;
      readonly distinct_by?: string;
      readonly select?: Expr;
    };

export type ScoreValue = "-1" | "0" | "+1" | "not_applicable";

export interface ScoreRule {
  readonly id: string;
  readonly priority: number;
  readonly result: ScoreValue;
  readonly when: Expr;
  readonly intentionalOverlap?: boolean;
}

export interface ScoreProgram {
  readonly rules: readonly ScoreRule[];
  readonly otherwise: {
    readonly result: ScoreValue | "unresolved";
    readonly message: string;
  };
}

export interface RuleEvaluation {
  readonly ruleId: string;
  readonly priority: number;
  readonly result: ScoreValue;
  readonly truth: TruthName;
}

export interface EvaluationDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface ScoreEvaluation {
  readonly result: ScoreValue | "unresolved";
  readonly status: "supported" | "ambiguous" | "incomplete";
  readonly matchedRuleId?: string;
  readonly ruleEvaluations: readonly RuleEvaluation[];
  readonly diagnostics: readonly EvaluationDiagnostic[];
}

export type DomainValue = string | number | boolean;
export type FiniteDomains = Readonly<Record<string, readonly DomainValue[]>>;

export interface AnalysisDiagnostic {
  readonly code:
    "WRT-SCORE-GAP" | "WRT-SCORE-OVERLAP" | "WRT-SCORE-UNREACHABLE" | "WRT-SCORE-UNKNOWN";
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly witness?: Readonly<Record<string, DomainValue>>;
  readonly ruleIds?: readonly string[];
  readonly matchedResults?: readonly ScoreValue[];
}

export interface ScoreAnalysis {
  readonly assignmentsChecked: number;
  readonly diagnostics: readonly AnalysisDiagnostic[];
}
