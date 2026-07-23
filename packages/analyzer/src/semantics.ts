/**
 * A slim four-valued evaluator over a concrete fact environment.
 *
 * This mirrors the reference-core evaluator's `evaluateTruth` for the expression
 * subset the analyzer reasons about, including interval-valued counts so that a
 * threshold crossing (e.g. a count known only to be in `[4, 6]` compared against
 * `>= 5`) yields `unknown` rather than a forced boolean. It powers the
 * bounded-enumeration oracle and stands in for the evaluator (which the analyzer
 * must not import).
 */

import type { Expr } from "@writ/domain";
import { all, any, not, truth, truthName, type Truth, type TruthName } from "./truth.js";

export interface CountInterval {
  readonly min: number;
  readonly max: number;
}

export type Facts = Readonly<Record<string, unknown>>;

interface ValueResult {
  readonly known: boolean;
  readonly value?: unknown;
}

function own(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function resolvePath(facts: Facts, path: string): ValueResult {
  if (own(facts, path)) return { known: true, value: facts[path] };
  const parts = path.split(".");
  let current: unknown = facts;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !own(current, part)) {
      return { known: false };
    }
    current = (current as Record<string, unknown>)[part];
  }
  return { known: true, value: current };
}

function isTruthName(value: unknown): value is TruthName {
  return value === "true" || value === "false" || value === "unknown" || value === "contested";
}

function isCountInterval(value: unknown): value is CountInterval {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.min === "number" &&
    typeof candidate.max === "number" &&
    candidate.min <= candidate.max
  );
}

function asInterval(value: unknown): CountInterval | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return { min: value, max: value };
  return isCountInterval(value) ? value : undefined;
}

function valueOf(expr: Expr, facts: Facts): ValueResult {
  switch (expr.kind) {
    case "literal":
      return { known: true, value: expr.value };
    case "ref":
      return resolvePath(facts, expr.path);
    case "nary": {
      if (expr.op === "set") {
        const items = expr.operands.map((item) => valueOf(item, facts));
        if (items.some((item) => !item.known)) return { known: false };
        return { known: true, value: items.map((item) => item.value) };
      }
      if (expr.op === "add" || expr.op === "multiply") {
        const items = expr.operands.map((item) => valueOf(item, facts));
        if (items.some((item) => !item.known || typeof item.value !== "number")) {
          return { known: false };
        }
        const numbers = items.map((item) => item.value as number);
        const result =
          expr.op === "add"
            ? numbers.reduce((sum, n) => sum + n, 0)
            : numbers.reduce((product, n) => product * n, 1);
        return { known: true, value: result };
      }
      return { known: true, value: truthName(evaluateTruth(expr, facts)) };
    }
    case "unary":
    case "compare":
      return { known: true, value: truthName(evaluateTruth(expr, facts)) };
    case "call":
    case "query":
      return { known: false };
  }
}

function compareIntervals(
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
  left: CountInterval,
  right: CountInterval,
): Truth {
  switch (op) {
    case "eq":
      if (left.min === left.max && right.min === right.max && left.min === right.min) {
        return truth("true");
      }
      if (left.max < right.min || right.max < left.min) return truth("false");
      return truth("unknown");
    case "neq":
      return not(compareIntervals("eq", left, right));
    case "gte":
      if (left.min >= right.max) return truth("true");
      if (left.max < right.min) return truth("false");
      return truth("unknown");
    case "gt":
      if (left.min > right.max) return truth("true");
      if (left.max <= right.min) return truth("false");
      return truth("unknown");
    case "lte":
      if (left.max <= right.min) return truth("true");
      if (left.min > right.max) return truth("false");
      return truth("unknown");
    case "lt":
      if (left.max < right.min) return truth("true");
      if (left.min >= right.max) return truth("false");
      return truth("unknown");
  }
}

function compareExact(op: string, left: unknown, right: unknown): Truth {
  switch (op) {
    case "eq":
      return truth(Object.is(left, right) ? "true" : "false");
    case "neq":
      return truth(Object.is(left, right) ? "false" : "true");
    case "in":
      return truth(
        Array.isArray(right) && right.some((item) => Object.is(item, left)) ? "true" : "false",
      );
    case "contains": {
      if (Array.isArray(left)) {
        return truth(left.some((item) => Object.is(item, right)) ? "true" : "false");
      }
      if (typeof left === "string" && typeof right === "string") {
        return truth(left.includes(right) ? "true" : "false");
      }
      return truth("unknown");
    }
    default:
      return truth("unknown");
  }
}

function compare(op: string, left: unknown, right: unknown): Truth {
  if (op === "between") {
    if (!Array.isArray(right) || right.length !== 2) return truth("unknown");
    const value = asInterval(left);
    const lower = asInterval(right[0]);
    const upper = asInterval(right[1]);
    if (!value || !lower || !upper) return truth("unknown");
    return all([compareIntervals("gte", value, lower), compareIntervals("lte", value, upper)]);
  }
  if (op === "eq" || op === "neq" || op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    const l = asInterval(left);
    const r = asInterval(right);
    if (l && r) return compareIntervals(op, l, r);
  }
  return compareExact(op, left, right);
}

export function evaluateTruth(expr: Expr, facts: Facts): Truth {
  switch (expr.kind) {
    case "literal": {
      if (typeof expr.value === "boolean") return truth(expr.value ? "true" : "false");
      if (isTruthName(expr.value)) return truth(expr.value);
      return truth("unknown");
    }
    case "ref": {
      const resolved = resolvePath(facts, expr.path);
      if (!resolved.known) return truth("unknown");
      if (typeof resolved.value === "boolean") return truth(resolved.value ? "true" : "false");
      if (isTruthName(resolved.value)) return truth(resolved.value);
      return truth("unknown");
    }
    case "unary": {
      if (expr.op === "not") return not(evaluateTruth(expr.operand, facts));
      if (expr.op === "is_known") {
        const name = truthName(evaluateTruth(expr.operand, facts));
        return truth(name === "true" || name === "false" ? "true" : "false");
      }
      if (expr.op === "is_contested") {
        return truth(
          truthName(evaluateTruth(expr.operand, facts)) === "contested" ? "true" : "false",
        );
      }
      const value = valueOf(expr.operand, facts);
      if (!value.known) return truth("unknown");
      if (Array.isArray(value.value) || typeof value.value === "string") {
        return truth(value.value.length > 0 ? "true" : "false");
      }
      return truth("unknown");
    }
    case "nary": {
      if (expr.op === "and") return all(expr.operands.map((o) => evaluateTruth(o, facts)));
      if (expr.op === "or") return any(expr.operands.map((o) => evaluateTruth(o, facts)));
      return truth("unknown");
    }
    case "compare": {
      const left = valueOf(expr.left, facts);
      const right = valueOf(expr.right, facts);
      if (!left.known || !right.known) return truth("unknown");
      return compare(expr.op, left.value, right.value);
    }
    case "call":
    case "query":
      return truth("unknown");
  }
}
