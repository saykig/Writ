/**
 * Score programs and domains used across the analyzer tests.
 *
 * The literal program is loaded from the checked-in flagship IR example (read
 * only); the inclusive-up-to, resolved, dead-rule and non-monotonic programs are
 * built here as IR `ScoreProgram` values, mirroring the reference-core fixtures.
 */

import { readFileSync } from "node:fs";
import type { CanonicalIr, Expr, ScoreProgram } from "@writ/domain";
import type { FiniteDomains } from "../src/index.js";

const lit = (value: unknown): Expr => ({ kind: "literal", value });
const ref = (path: string): Expr => ({ kind: "ref", path });
const cmp = (op: "eq" | "gt" | "gte" | "lt" | "lte", left: Expr, right: Expr): Expr => ({
  kind: "compare",
  op,
  left,
  right,
});
const and = (...operands: Expr[]): Expr => ({ kind: "nary", op: "and", operands });
const or = (...operands: Expr[]): Expr => ({ kind: "nary", op: "or", operands });
const notE = (operand: Expr): Expr => ({ kind: "unary", op: "not", operand });

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;
}

export const literalIr = readJson<CanonicalIr>("../../../examples/2025-ai-sme-literal.ir.json");

export const literalProgram: ScoreProgram = literalIr.commitments[0]!.score_program;

export function inclusiveUpToProgram(): ScoreProgram {
  return {
    rules: [
      { id: "full", priority: 10, result: "+1", when: cmp("gte", ref("strong_count"), lit(5)) },
      {
        id: "partial_inclusive",
        priority: 10,
        result: "0",
        when: or(
          and(cmp("gte", ref("strong_count"), lit(0)), cmp("lte", ref("strong_count"), lit(4))),
          and(cmp("gte", ref("weak_count"), lit(3)), cmp("lte", ref("weak_count"), lit(4))),
        ),
      },
      {
        id: "none",
        priority: 10,
        result: "-1",
        when: or(
          ref("counter_exists"),
          and(cmp("eq", ref("strong_count"), lit(0)), cmp("lte", ref("weak_count"), lit(2))),
        ),
      },
    ],
    otherwise: { result: "unresolved", message: "Uncovered state." },
  };
}

export function resolvedProgram(): ScoreProgram {
  return {
    rules: [
      { id: "counter", priority: 30, result: "-1", when: ref("counter_exists") },
      {
        id: "full",
        priority: 20,
        result: "+1",
        when: and(notE(ref("counter_exists")), cmp("gte", ref("strong_count"), lit(5))),
      },
      {
        id: "partial",
        priority: 20,
        result: "0",
        when: and(
          notE(ref("counter_exists")),
          or(
            and(cmp("gte", ref("strong_count"), lit(1)), cmp("lte", ref("strong_count"), lit(4))),
            and(cmp("eq", ref("strong_count"), lit(0)), cmp("gte", ref("weak_count"), lit(3))),
          ),
        ),
      },
      {
        id: "none",
        priority: 20,
        result: "-1",
        when: and(
          notE(ref("counter_exists")),
          cmp("eq", ref("strong_count"), lit(0)),
          cmp("lte", ref("weak_count"), lit(2)),
        ),
      },
    ],
    otherwise: { result: "unresolved", message: "Evidence incomplete." },
  };
}

/** A program with a contradictory (dead) branch; concrete `otherwise`, no gap. */
export function deadRuleProgram(): ScoreProgram {
  return {
    rules: [
      { id: "alive", priority: 10, result: "+1", when: cmp("gte", ref("strong_count"), lit(5)) },
      {
        id: "dead",
        priority: 10,
        result: "0",
        when: and(cmp("gte", ref("strong_count"), lit(5)), cmp("lte", ref("strong_count"), lit(2))),
      },
    ],
    otherwise: { result: "-1", message: "Below full compliance." },
  };
}

/** A program that is non-monotonic in `strong_count`. */
export function nonMonotonicProgram(): ScoreProgram {
  return {
    rules: [
      { id: "hi", priority: 10, result: "+1", when: cmp("eq", ref("strong_count"), lit(1)) },
      { id: "lo", priority: 10, result: "-1", when: cmp("eq", ref("strong_count"), lit(2)) },
    ],
    otherwise: { result: "0", message: "Default." },
  };
}

const range = (n: number): number[] => Array.from({ length: n + 1 }, (_, index) => index);

export const fullDomains: FiniteDomains = {
  strong_count: range(6),
  weak_count: range(6),
  counter_exists: [false, true],
};

export const smallAxisDomains: FiniteDomains = {
  strong_count: range(3),
};
