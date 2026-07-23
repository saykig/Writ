// CORE-005 — typed scalar expression interpreter over the canonical IR `Expr`.
//
// Two evaluation modes, mirroring the reference implementation but with exact
// decimals, unit-aware money, deterministic ISO temporal comparison, and a proof
// node emitted for every operator and leaf:
//
//   evaluateTruth(expr, env): Truth
//   evaluateValue(expr, env): { known, value?, interval? }
//
// Both propagate `unknown`/`contested` per 04_FORMAL_SEMANTICS.md §2; a type or
// unit mismatch yields `unknown` PLUS a stable `@covenant/domain` diagnostic —
// never a silent wrong comparison, never an unknown-to-false collapse.

import type { CompareOp, CountInterval, Expr, QueryExpr } from "@covenant/domain";
import { makeDiagnostic, type Diagnostic, type DiagnosticCode } from "@covenant/domain";
import { all, any, not, truth, truthName, type Truth } from "./truth.js";
import { ProofBuilder, type ProofNode } from "./proof.js";
import { resolveInScope, type Environment, type EvidenceRecord } from "./environment.js";
import {
  addDecimal,
  compareDecimal,
  formatDecimal,
  multiplyDecimal,
  parseDecimal,
  ZERO,
  type Decimal,
} from "./decimal.js";
import {
  asCountInterval,
  isMoneyValue,
  isUnitedInterval,
  isUnitedQuantity,
  toInstant,
  toTemporalInterval,
  toUnitedInterval,
} from "./values.js";
import { compareCountIntervals, compareUnitedIntervals, type OrderOp } from "./intervals.js";
import { instantAfter, instantBefore, intervalsOverlap } from "./temporal.js";
import { evaluateQuery } from "./query.js";

// --- Result shapes ----------------------------------------------------------

/** Public value-evaluation result (proof-free). */
export interface ValueEval {
  readonly known: boolean;
  readonly value?: unknown;
  readonly interval?: CountInterval;
}

/** Internal truth result carrying the emitted proof node. */
export interface TruthNode {
  readonly truth: Truth;
  readonly node: ProofNode;
}

/** Internal value result carrying the emitted proof node. */
export interface ValueNode extends ValueEval {
  readonly node: ProofNode;
}

/**
 * Mutable evaluation context threaded through a single evaluation: the frozen
 * environment, the proof builder that allocates node ids, and the accumulating
 * diagnostics. Pure w.r.t. the environment — nothing here mutates inputs.
 */
export class EvalContext {
  readonly env: Environment;
  readonly proof: ProofBuilder;
  readonly diagnostics: Diagnostic[] = [];

  constructor(env: Environment, proof?: ProofBuilder) {
    this.env = env;
    this.proof = proof ?? new ProofBuilder();
  }

  diag(
    code: DiagnosticCode,
    values: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    this.diagnostics.push(
      context === undefined
        ? makeDiagnostic(code, { values })
        : makeDiagnostic(code, { values, context }),
    );
  }

  /** Push an already-built diagnostic (used for severity overrides). */
  pushDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }
}

// --- Small helpers ----------------------------------------------------------

function truthFromValue(value: unknown): Truth | null {
  if (typeof value === "boolean") return truth(value ? "true" : "false");
  if (value === "true") return truth("true");
  if (value === "false") return truth("false");
  if (value === "unknown") return truth("unknown");
  if (value === "contested") return truth("contested");
  return null;
}

/** Whether a value should route through the exact-decimal / united path. */
function wantsUnited(value: unknown): boolean {
  return (
    isMoneyValue(value) ||
    isUnitedQuantity(value) ||
    isUnitedInterval(value) ||
    (typeof value === "string" && parseDecimal(value) !== null)
  );
}

function decimalEqual(a: unknown, b: unknown): boolean | null {
  const da =
    typeof a === "number"
      ? parseDecimal(a.toString())
      : typeof a === "string"
        ? parseDecimal(a)
        : null;
  const db =
    typeof b === "number"
      ? parseDecimal(b.toString())
      : typeof b === "string"
        ? parseDecimal(b)
        : null;
  if (da === null || db === null) return null;
  return compareDecimal(da, db) === 0;
}

/** Structural equality for `eq`/`neq`/`in`, decimal-aware for numeric strings. */
function valuesEqual(a: unknown, b: unknown): boolean {
  const dec = decimalEqual(a, b);
  if (dec !== null) return dec;
  return Object.is(a, b);
}

// --- Comparison -------------------------------------------------------------

const ORDER_OPS = new Set<CompareOp>(["eq", "neq", "gt", "gte", "lt", "lte"]);

function unitedCompare(
  op: OrderOp,
  left: unknown,
  right: unknown,
  ctx: EvalContext,
  path: string,
): Truth {
  const l = toUnitedInterval(left);
  const r = toUnitedInterval(right);
  if (l === null || r === null) {
    ctx.diag("COV-LINT-TYPE", {
      path,
      expected: "decimal/money",
      actual: l === null ? "left" : "right",
    });
    return truth("unknown");
  }
  if (l.unit !== null && r.unit !== null && l.unit !== r.unit) {
    ctx.diag("COV-LINT-UNIT", { path, found: r.unit, expected: l.unit });
    return truth("unknown");
  }
  return compareUnitedIntervals(op, l, r);
}

function orderCompare(
  op: OrderOp,
  left: unknown,
  right: unknown,
  ctx: EvalContext,
  path: string,
): Truth {
  // United/exact-decimal path when either side carries money/quantity/decimal.
  if (wantsUnited(left) || wantsUnited(right)) {
    return unitedCompare(op, left, right, ctx, path);
  }
  // Numeric count-interval path (reference parity: `[5,7] >= 5` etc.).
  const l = asCountInterval(left);
  const r = asCountInterval(right);
  if (l !== null && r !== null) return compareCountIntervals(op, l, r);
  // eq/neq degrade to structural equality; ordering non-numerics is a type error.
  if (op === "eq") return truth(valuesEqual(left, right) ? "true" : "false");
  if (op === "neq") return truth(valuesEqual(left, right) ? "false" : "true");
  ctx.diag("COV-LINT-TYPE", {
    path,
    expected: "number/interval",
    actual: describe(left) + " vs " + describe(right),
  });
  return truth("unknown");
}

function temporalCompare(
  op: "before" | "after",
  left: unknown,
  right: unknown,
  ctx: EvalContext,
  path: string,
): Truth {
  const a = toInstant(left);
  const b = toInstant(right);
  if (a !== null && b !== null) {
    return truth((op === "before" ? instantBefore(a, b) : instantAfter(a, b)) ? "true" : "false");
  }
  // Interval endpoints are also acceptable (compare by interval bounds).
  const ia = toTemporalInterval(left);
  const ib = toTemporalInterval(right);
  if (ia !== null && ib !== null) {
    const earlier =
      op === "before" ? instantBefore(ia.end, ib.start) : instantAfter(ia.start, ib.end);
    return truth(earlier ? "true" : "false");
  }
  ctx.diag("COV-LINT-TIME-AXIS", { path, detail: `non-temporal operand in \`${op}\`` });
  return truth("unknown");
}

function overlapsCompare(left: unknown, right: unknown, ctx: EvalContext, path: string): Truth {
  const ia = toTemporalInterval(left);
  const ib = toTemporalInterval(right);
  if (ia !== null && ib !== null) {
    return truth(intervalsOverlap(ia, ib) ? "true" : "false");
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return truth(left.some((x) => right.some((y) => valuesEqual(x, y))) ? "true" : "false");
  }
  ctx.diag("COV-LINT-TYPE", { path, expected: "interval/set", actual: "overlaps operands" });
  return truth("unknown");
}

function betweenCompare(left: unknown, right: unknown, ctx: EvalContext, path: string): Truth {
  if (!Array.isArray(right) || right.length !== 2) {
    ctx.diag("COV-LINT-TYPE", { path, expected: "[low, high]", actual: describe(right) });
    return truth("unknown");
  }
  const lo = right[0];
  const hi = right[1];
  return all([
    orderCompare("gte", left, lo, ctx, `${path}.low`),
    orderCompare("lte", left, hi, ctx, `${path}.high`),
  ]);
}

function compareValues(
  op: CompareOp,
  left: unknown,
  right: unknown,
  ctx: EvalContext,
  path: string,
): Truth {
  if (op === "between") return betweenCompare(left, right, ctx, path);
  if (ORDER_OPS.has(op)) return orderCompare(op as OrderOp, left, right, ctx, path);
  if (op === "before" || op === "after") return temporalCompare(op, left, right, ctx, path);
  if (op === "overlaps") return overlapsCompare(left, right, ctx, path);
  if (op === "in") {
    if (!Array.isArray(right)) {
      ctx.diag("COV-LINT-TYPE", { path, expected: "array", actual: describe(right) });
      return truth("unknown");
    }
    return truth(right.some((el) => valuesEqual(el, left)) ? "true" : "false");
  }
  // contains
  if (Array.isArray(left))
    return truth(left.some((el) => valuesEqual(el, right)) ? "true" : "false");
  if (typeof left === "string" && typeof right === "string")
    return truth(left.includes(right) ? "true" : "false");
  ctx.diag("COV-LINT-TYPE", { path, expected: "array/string", actual: describe(left) });
  return truth("unknown");
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// --- Truth evaluation -------------------------------------------------------

/** Evaluate `expr` to a truth value, emitting a proof subtree. */
export function evalTruth(expr: Expr, ctx: EvalContext, scope?: EvidenceRecord): TruthNode {
  switch (expr.kind) {
    case "literal": {
      const t = truthFromValue(expr.value) ?? truth("unknown");
      return {
        truth: t,
        node: ctx.proof.emit({
          kind: "literal",
          truthValue: t,
          label: "literal",
          value: expr.value,
        }),
      };
    }
    case "ref": {
      const resolved = resolveInScope(ctx.env, scope, expr.path);
      const t = resolved.known
        ? (truthFromValue(resolved.value) ?? truth("unknown"))
        : truth("unknown");
      return {
        truth: t,
        node: ctx.proof.emit({
          kind: "reference",
          truthValue: t,
          label: expr.path,
          ...(resolved.known ? { value: resolved.value } : {}),
        }),
      };
    }
    case "unary":
      return evalUnaryTruth(expr, ctx, scope);
    case "nary":
      return evalNaryTruth(expr, ctx, scope);
    case "compare": {
      const left = evalValue(expr.left, ctx, scope);
      const right = evalValue(expr.right, ctx, scope);
      let t: Truth;
      if (!left.known || !right.known) {
        t = truth("unknown");
      } else {
        t = compareValues(expr.op, left.value, right.value, ctx, `compare.${expr.op}`);
      }
      return {
        truth: t,
        node: ctx.proof.emit({
          kind: "comparison",
          truthValue: t,
          label: expr.op,
          childIds: [left.node.id, right.node.id],
        }),
      };
    }
    case "call": {
      // Calls (e.g. currency conversion) are not implemented in this slice; they
      // are `unknown` rather than a guess, and never collapse to false.
      const node = ctx.proof.emit({
        kind: "operator",
        truthValue: truth("unknown"),
        label: `call:${expr.function}`,
      });
      return { truth: truth("unknown"), node };
    }
    case "query":
      return queryTruth(expr, ctx, scope);
  }
}

function evalUnaryTruth(
  expr: Extract<Expr, { kind: "unary" }>,
  ctx: EvalContext,
  scope?: EvidenceRecord,
): TruthNode {
  if (expr.op === "not") {
    const inner = evalTruth(expr.operand, ctx, scope);
    const t = not(inner.truth);
    return {
      truth: t,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: t,
        label: "not",
        childIds: [inner.node.id],
      }),
    };
  }
  if (expr.op === "is_known") {
    const inner = evalTruth(expr.operand, ctx, scope);
    const name = truthName(inner.truth);
    const t = truth(name === "true" || name === "false" ? "true" : "false");
    return {
      truth: t,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: t,
        label: "is_known",
        childIds: [inner.node.id],
      }),
    };
  }
  if (expr.op === "is_contested") {
    const inner = evalTruth(expr.operand, ctx, scope);
    const t = truth(truthName(inner.truth) === "contested" ? "true" : "false");
    return {
      truth: t,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: t,
        label: "is_contested",
        childIds: [inner.node.id],
      }),
    };
  }
  // nonempty — operates on the operand's VALUE.
  const inner = evalValue(expr.operand, ctx, scope);
  let t: Truth;
  if (!inner.known) t = truth("unknown");
  else if (Array.isArray(inner.value) || typeof inner.value === "string")
    t = truth(inner.value.length > 0 ? "true" : "false");
  else t = truth("unknown");
  return {
    truth: t,
    node: ctx.proof.emit({
      kind: "operator",
      truthValue: t,
      label: "nonempty",
      childIds: [inner.node.id],
    }),
  };
}

function evalNaryTruth(
  expr: Extract<Expr, { kind: "nary" }>,
  ctx: EvalContext,
  scope?: EvidenceRecord,
): TruthNode {
  if (expr.op === "and" || expr.op === "or") {
    const children = expr.operands.map((operand) => evalTruth(operand, ctx, scope));
    const truths = children.map((child) => child.truth);
    const t = expr.op === "and" ? all(truths) : any(truths);
    return {
      truth: t,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: t,
        label: expr.op,
        childIds: children.map((c) => c.node.id),
      }),
    };
  }
  // set/add/multiply are value operators; in a truth position they are unknown.
  const value = evalNaryValue(expr, ctx, scope);
  return { truth: truth("unknown"), node: value.node };
}

// --- Value evaluation -------------------------------------------------------

/** Evaluate `expr` to a value, emitting a proof subtree. */
export function evalValue(expr: Expr, ctx: EvalContext, scope?: EvidenceRecord): ValueNode {
  switch (expr.kind) {
    case "literal":
      return {
        known: true,
        value: expr.value,
        node: ctx.proof.emit({
          kind: "literal",
          truthValue: truth("unknown"),
          label: "literal",
          value: expr.value,
        }),
      };
    case "ref": {
      const resolved = resolveInScope(ctx.env, scope, expr.path);
      return {
        known: resolved.known,
        ...(resolved.known ? { value: resolved.value } : {}),
        node: ctx.proof.emit({
          kind: "reference",
          truthValue: resolved.known
            ? (truthFromValue(resolved.value) ?? truth("unknown"))
            : truth("unknown"),
          label: expr.path,
          ...(resolved.known ? { value: resolved.value } : {}),
        }),
      };
    }
    case "nary":
      return evalNaryValue(expr, ctx, scope);
    case "unary":
    case "compare": {
      // Truth-typed expressions: their value is the truth NAME (reference parity).
      const t = evalTruth(expr, ctx, scope);
      return { known: true, value: truthName(t.truth), node: t.node };
    }
    case "call": {
      const node = ctx.proof.emit({
        kind: "operator",
        truthValue: truth("unknown"),
        label: `call:${expr.function}`,
      });
      return { known: false, node };
    }
    case "query":
      return queryValue(expr, ctx, scope);
  }
}

function evalNaryValue(
  expr: Extract<Expr, { kind: "nary" }>,
  ctx: EvalContext,
  scope?: EvidenceRecord,
): ValueNode {
  if (expr.op === "and" || expr.op === "or") {
    const t = evalNaryTruth(expr, ctx, scope);
    return { known: true, value: truthName(t.truth), node: t.node };
  }
  const items = expr.operands.map((operand) => evalValue(operand, ctx, scope));
  const childIds = items.map((item) => item.node.id);
  if (expr.op === "set") {
    if (items.some((item) => !item.known))
      return {
        known: false,
        node: ctx.proof.emit({
          kind: "operator",
          truthValue: truth("unknown"),
          label: "set",
          childIds,
        }),
      };
    const value = items.map((item) => item.value);
    return {
      known: true,
      value,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: truth("unknown"),
        label: "set",
        value,
        childIds,
      }),
    };
  }
  // add / multiply over numbers or exact decimals (never over money records —
  // use the query `sum` for money so currency/bounds are respected).
  if (items.some((item) => !item.known))
    return {
      known: false,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: truth("unknown"),
        label: expr.op,
        childIds,
      }),
    };
  const rawValues = items.map((item) => item.value);
  if (rawValues.some((value) => isMoneyValue(value) || isUnitedQuantity(value))) {
    ctx.diag("COV-LINT-TYPE", {
      path: `nary.${expr.op}`,
      expected: "number/decimal",
      actual: "money/quantity",
    });
    return {
      known: false,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: truth("unknown"),
        label: expr.op,
        childIds,
      }),
    };
  }
  const arithmetic = arith(expr.op, rawValues);
  if (arithmetic === null) {
    ctx.diag("COV-LINT-TYPE", {
      path: `nary.${expr.op}`,
      expected: "number/decimal",
      actual: "non-numeric",
    });
    return {
      known: false,
      node: ctx.proof.emit({
        kind: "operator",
        truthValue: truth("unknown"),
        label: expr.op,
        childIds,
      }),
    };
  }
  return {
    known: true,
    value: arithmetic,
    node: ctx.proof.emit({
      kind: "operator",
      truthValue: truth("unknown"),
      label: expr.op,
      value: arithmetic,
      childIds,
    }),
  };
}

/** Exact-or-numeric `add`/`multiply`; returns a number, a decimal string, or null. */
function arith(op: "add" | "multiply", values: readonly unknown[]): number | string | null {
  const allPlainNumbers = values.every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  if (allPlainNumbers) {
    const numbers = values as readonly number[];
    return op === "add"
      ? numbers.reduce((sum, n) => sum + n, 0)
      : numbers.reduce((product, n) => product * n, 1);
  }
  // Decimal path: every operand must be a decimal string or a finite number.
  const decimals = values.map((value) =>
    typeof value === "number" && Number.isFinite(value)
      ? parseDecimal(value.toString())
      : typeof value === "string"
        ? parseDecimal(value)
        : null,
  );
  if (decimals.some((d) => d === null)) return null;
  const nonNull = decimals as Decimal[];
  return op === "add" ? formatSum(nonNull) : formatProduct(nonNull);
}

function formatSum(ds: readonly Decimal[]): string {
  return formatDecimal(ds.reduce<Decimal>((acc, d) => addDecimal(acc, d), ZERO));
}
function formatProduct(ds: readonly Decimal[]): string {
  return formatDecimal(
    ds.reduce<Decimal>((acc, d) => multiplyDecimal(acc, d), { unscaled: 1n, scale: 0 }),
  );
}

// --- Query delegation (CORE-006) --------------------------------------------

function queryTruth(expr: QueryExpr, ctx: EvalContext, scope?: EvidenceRecord): TruthNode {
  const result = evaluateQuery(expr, ctx, scope);
  return { truth: result.truth, node: result.node };
}

function queryValue(expr: QueryExpr, ctx: EvalContext, scope?: EvidenceRecord): ValueNode {
  const result = evaluateQuery(expr, ctx, scope);
  const base: ValueNode = {
    known: result.known,
    node: result.node,
    ...(result.value !== undefined ? { value: result.value } : {}),
    ...(result.countInterval !== undefined ? { interval: result.countInterval } : {}),
  };
  return base;
}

// --- Public API -------------------------------------------------------------

/** Evaluate an expression to a four-valued truth over the environment. */
export function evaluateTruth(expr: Expr, env: Environment): Truth {
  return evalTruth(expr, new EvalContext(env)).truth;
}

/** Evaluate an expression to a value `{ known, value?, interval? }`. */
export function evaluateValue(expr: Expr, env: Environment): ValueEval {
  const result = evalValue(expr, new EvalContext(env));
  const out: ValueEval = {
    known: result.known,
    ...(result.value !== undefined ? { value: result.value } : {}),
    ...(result.interval !== undefined ? { interval: result.interval } : {}),
  };
  return out;
}

/** Full evaluation result: truth, proof DAG, and diagnostics. */
export interface Evaluation {
  readonly truth: Truth;
  readonly rootId: string;
  readonly nodes: readonly ProofNode[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Evaluate an expression in truth position and return the full proof DAG and any
 * diagnostics. This is the entry point the score/receipt layer (CORE-008) uses
 * per score-rule `when`.
 */
export function evaluate(expr: Expr, env: Environment): Evaluation {
  const ctx = new EvalContext(env);
  const result = evalTruth(expr, ctx);
  return {
    truth: result.truth,
    rootId: result.node.id,
    nodes: ctx.proof.nodes,
    diagnostics: ctx.diagnostics,
  };
}
