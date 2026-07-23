/**
 * Lowers score-program expressions to Z3 over finite domains, preserving the
 * four-valued semantics.
 *
 * Every expression becomes a pair of Z3 booleans `(t, f)` = (supportsTrue,
 * supportsFalse), the SMT image of the truth bilattice in `truth.ts`:
 *
 *   true=(⊤,⊥)  false=(⊥,⊤)  unknown=(⊥,⊥)  contested=(⊤,⊤)
 *   not(t,f) = (f,t)
 *   and = (∧ tᵢ, ∨ fᵢ)      or = (∨ tᵢ, ∧ fᵢ)
 *
 * A rule is *decisively true* at an assignment iff `t ∧ ¬f`; *decisively false*
 * iff `¬t ∧ f`; *uncertain* iff `t = f`. Numeric variables are Z3 Ints;
 * booleans, enums and three-valued presence are Int selectors over their
 * declared values, so a value that can be `unknown` genuinely lowers to `(⊥,⊥)`.
 */

import type { Expr } from "@writ/domain";
import type { DomainValue, FiniteDomains, Assignment } from "./types.js";
import {
  canonicalKeys,
  modelVariables,
  type CategoricalVar,
  type NumericVar,
  type VarModel,
} from "./domains.js";
import type { Z3Api, Z3Expr } from "./z3-context.js";

export interface TruthTerm {
  readonly t: Z3Expr;
  readonly f: Z3Expr;
}

interface BoundVar {
  readonly model: VarModel;
  readonly z3: Z3Expr; // an Int expression (value for numeric, selector for categorical)
}

export class ScoreLowering {
  private readonly api: Z3Api;
  private readonly domains: FiniteDomains;
  private readonly vars = new Map<string, BoundVar>();

  /**
   * `namePrefix` distinguishes the Z3 constants of a second variable copy (used
   * by the two-copy monotonicity encoding) while keeping the map keyed by the
   * original variable names, so expression lowering is unaffected.
   */
  constructor(api: Z3Api, domains: FiniteDomains, namePrefix = "") {
    this.api = api;
    this.domains = domains;
    for (const [name, model] of modelVariables(domains)) {
      this.vars.set(name, { model, z3: api.Int.const(`${namePrefix}${name}`) });
    }
  }

  private boolVal(value: boolean): Z3Expr {
    return this.api.Bool.val(value);
  }

  private truthConst(name: "true" | "false" | "unknown" | "contested"): TruthTerm {
    switch (name) {
      case "true":
        return { t: this.boolVal(true), f: this.boolVal(false) };
      case "false":
        return { t: this.boolVal(false), f: this.boolVal(true) };
      case "unknown":
        return { t: this.boolVal(false), f: this.boolVal(false) };
      case "contested":
        return { t: this.boolVal(true), f: this.boolVal(true) };
    }
  }

  private notT(x: TruthTerm): TruthTerm {
    return { t: x.f, f: x.t };
  }

  private andT(parts: TruthTerm[]): TruthTerm {
    if (parts.length === 0) return this.truthConst("true");
    return {
      t: this.api.And(...parts.map((p) => p.t)),
      f: this.api.Or(...parts.map((p) => p.f)),
    };
  }

  private orT(parts: TruthTerm[]): TruthTerm {
    if (parts.length === 0) return this.truthConst("false");
    return {
      t: this.api.Or(...parts.map((p) => p.t)),
      f: this.api.And(...parts.map((p) => p.f)),
    };
  }

  /** Constraints binding every variable to its declared finite domain. */
  domainConstraints(): Z3Expr[] {
    const constraints: Z3Expr[] = [];
    for (const key of canonicalKeys(this.domains)) {
      const bound = this.vars.get(key);
      if (!bound) continue;
      if (bound.model.kind === "numeric") {
        const values = (bound.model as NumericVar).values;
        constraints.push(this.api.Or(...values.map((v) => bound.z3.eq(v))));
      } else {
        const k = (bound.model as CategoricalVar).values.length;
        constraints.push(bound.z3.ge(0), bound.z3.lt(k));
      }
    }
    return constraints;
  }

  /** A numeric Z3 term for an expression, or `undefined` if it is not numeric. */
  private lowerNumeric(expr: Expr): Z3Expr | undefined {
    switch (expr.kind) {
      case "literal":
        return typeof expr.value === "number" ? this.api.Int.val(expr.value) : undefined;
      case "ref": {
        const bound = this.vars.get(expr.path);
        return bound && bound.model.kind === "numeric" ? bound.z3 : undefined;
      }
      case "nary": {
        if (expr.op !== "add" && expr.op !== "multiply") return undefined;
        const terms = expr.operands.map((o) => this.lowerNumeric(o));
        if (terms.some((term) => term === undefined)) return undefined;
        return terms.reduce((acc, term) =>
          acc === undefined ? term : expr.op === "add" ? acc.add(term) : acc.mul(term),
        );
      }
      default:
        return undefined;
    }
  }

  private numericCompare(op: string, left: Z3Expr, right: Z3Expr): Z3Expr | undefined {
    switch (op) {
      case "eq":
        return left.eq(right);
      case "neq":
        return left.eq(right).not();
      case "gt":
        return left.gt(right);
      case "gte":
        return left.ge(right);
      case "lt":
        return left.lt(right);
      case "lte":
        return left.le(right);
      default:
        return undefined;
    }
  }

  private definite(cmp: Z3Expr): TruthTerm {
    return { t: cmp, f: cmp.not() };
  }

  /** Selector equality for a categorical `ref op literal` comparison. */
  private categoricalEq(path: string, value: DomainValue): Z3Expr | undefined {
    const bound = this.vars.get(path);
    if (!bound || bound.model.kind !== "categorical") return undefined;
    const idx = bound.model.values.findIndex((candidate) => Object.is(candidate, value));
    return idx < 0 ? this.boolVal(false) : bound.z3.eq(idx);
  }

  private literalValue(expr: Expr): DomainValue | undefined {
    if (expr.kind !== "literal") return undefined;
    const value = expr.value;
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? value
      : undefined;
  }

  private lowerCompare(expr: Extract<Expr, { kind: "compare" }>): TruthTerm {
    const { op } = expr;

    if (op === "between") {
      const lo =
        expr.right.kind === "nary" && expr.right.op === "set"
          ? this.lowerNumeric(expr.right.operands[0] as Expr)
          : undefined;
      const hi =
        expr.right.kind === "nary" && expr.right.op === "set"
          ? this.lowerNumeric(expr.right.operands[1] as Expr)
          : undefined;
      const value = this.lowerNumeric(expr.left);
      if (value && lo && hi) return this.definite(this.api.And(value.ge(lo), value.le(hi)));
      return this.truthConst("unknown");
    }

    if (op === "in") {
      const value = this.lowerNumeric(expr.left);
      if (value && expr.right.kind === "nary" && expr.right.op === "set") {
        const members = expr.right.operands.map((o) => this.lowerNumeric(o as Expr));
        if (!members.some((m) => m === undefined)) {
          return this.definite(this.api.Or(...members.map((m) => value.eq(m))));
        }
      }
      // categorical membership
      if (expr.left.kind === "ref" && expr.right.kind === "nary" && expr.right.op === "set") {
        const path = expr.left.path;
        const eqs = expr.right.operands
          .map((o) => this.literalValue(o as Expr))
          .map((v) => (v === undefined ? undefined : this.categoricalEq(path, v)));
        if (!eqs.some((e) => e === undefined)) return this.definite(this.api.Or(...eqs));
      }
      return this.truthConst("unknown");
    }

    const left = this.lowerNumeric(expr.left);
    const right = this.lowerNumeric(expr.right);
    if (left && right) {
      const cmp = this.numericCompare(op, left, right);
      if (cmp) return this.definite(cmp);
    }

    if (op === "eq" || op === "neq") {
      let eq: Z3Expr | undefined;
      if (expr.left.kind === "ref") {
        const value = this.literalValue(expr.right);
        if (value !== undefined) eq = this.categoricalEq(expr.left.path, value);
      }
      if (eq === undefined && expr.right.kind === "ref") {
        const value = this.literalValue(expr.left);
        if (value !== undefined) eq = this.categoricalEq(expr.right.path, value);
      }
      if (eq !== undefined) return op === "eq" ? this.definite(eq) : this.definite(eq.not());
    }

    return this.truthConst("unknown");
  }

  private refTruth(path: string): TruthTerm {
    const bound = this.vars.get(path);
    if (!bound) return this.truthConst("unknown");
    if (bound.model.kind === "numeric") return this.truthConst("unknown");
    const model = bound.model as CategoricalVar;
    const t = model.trueIndex < 0 ? this.boolVal(false) : bound.z3.eq(model.trueIndex);
    const f = model.falseIndex < 0 ? this.boolVal(false) : bound.z3.eq(model.falseIndex);
    return { t, f };
  }

  /** Lower an expression to its four-valued Z3 truth term. */
  lowerTruth(expr: Expr): TruthTerm {
    switch (expr.kind) {
      case "literal": {
        if (typeof expr.value === "boolean") return this.truthConst(expr.value ? "true" : "false");
        if (
          expr.value === "true" ||
          expr.value === "false" ||
          expr.value === "unknown" ||
          expr.value === "contested"
        ) {
          return this.truthConst(expr.value);
        }
        return this.truthConst("unknown");
      }
      case "ref":
        return this.refTruth(expr.path);
      case "unary": {
        if (expr.op === "not") return this.notT(this.lowerTruth(expr.operand));
        if (expr.op === "is_known") {
          const inner = this.lowerTruth(expr.operand);
          const known = inner.t.eq(inner.f).not();
          return { t: known, f: known.not() };
        }
        if (expr.op === "is_contested") {
          const inner = this.lowerTruth(expr.operand);
          const contested = this.api.And(inner.t, inner.f);
          return { t: contested, f: contested.not() };
        }
        return this.truthConst("unknown"); // nonempty over a non-collection
      }
      case "nary": {
        if (expr.op === "and") return this.andT(expr.operands.map((o) => this.lowerTruth(o)));
        if (expr.op === "or") return this.orT(expr.operands.map((o) => this.lowerTruth(o)));
        return this.truthConst("unknown");
      }
      case "compare":
        return this.lowerCompare(expr);
      case "call":
      case "query":
        return this.truthConst("unknown");
    }
  }

  /** `t ∧ ¬f`: the rule is decisively selected. */
  decisivelyTrue(expr: Expr): Z3Expr {
    const term = this.lowerTruth(expr);
    return this.api.And(term.t, term.f.not());
  }

  /** `¬t ∧ f`: the rule cannot fire. */
  decisivelyFalse(expr: Expr): Z3Expr {
    const term = this.lowerTruth(expr);
    return this.api.And(term.t.not(), term.f);
  }

  /** `t = f`: the rule is unknown or contested. */
  uncertain(expr: Expr): Z3Expr {
    const term = this.lowerTruth(expr);
    return term.t.eq(term.f);
  }

  /** Add lexicographic minimization objectives in canonical variable order. */
  minimizeObjectives(optimize: { minimize: (expr: Z3Expr) => number }): void {
    for (const key of canonicalKeys(this.domains)) {
      const bound = this.vars.get(key);
      if (bound) optimize.minimize(bound.z3);
    }
  }

  /** Recover the domain-valued assignment from a Z3 model. */
  readWitness(model: { eval: (expr: Z3Expr, complete?: boolean) => Z3Expr }): Assignment {
    const witness: Record<string, DomainValue> = {};
    for (const key of canonicalKeys(this.domains)) {
      const bound = this.vars.get(key);
      if (!bound) continue;
      const raw = Number(model.eval(bound.z3, true).value());
      if (bound.model.kind === "numeric") {
        witness[key] = raw;
      } else {
        const values = (bound.model as CategoricalVar).values;
        witness[key] = values[raw] as DomainValue;
      }
    }
    return witness;
  }

  /** The numeric Z3 term for a variable, for use in monotonicity coupling. */
  variableTerm(name: string): Z3Expr | undefined {
    return this.vars.get(name)?.z3;
  }
}
