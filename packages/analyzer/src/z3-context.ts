/**
 * Z3 bootstrap and a synchronous check bridge.
 *
 * Two Bun-specific hazards shape this module:
 *
 *   1. `z3-solver`'s high-level `check()` dispatches the blocking solve onto an
 *      Emscripten pthread worker (via `async_call`); that worker path aborts
 *      under Bun's `worker_threads`. We instead drive the solve through the
 *      synchronous C export `Z3_optimize_check`, which runs on the main thread.
 *   2. Z3's general SMT solver (`Z3_solver_check`) still spawns an internal
 *      worker thread for non-trivial Boolean structure, which also aborts under
 *      Bun. The optimization engine (`Z3_optimize_check`) does not, so ALL
 *      checks — satisfiability and minimization alike — are routed through an
 *      `Optimize` instance. A plain `Solver` is never used.
 *
 * The solve is deterministic (fixed config, no randomness, single-threaded),
 * which is exactly what the analysis requires.
 */

import { init } from "z3-solver";

// The high-level z3 surface is broad and generically typed; we keep a narrow
// local view and treat expressions opaquely as `Z3Expr`.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Z3Expr = any;

export interface Z3Api {
  readonly ctx: any;
  readonly Int: any;
  readonly Bool: any;
  readonly If: any;
  readonly And: (...args: Z3Expr[]) => Z3Expr;
  readonly Or: (...args: Z3Expr[]) => Z3Expr;
  readonly Not: (arg: Z3Expr) => Z3Expr;
  readonly Optimize: new () => any;
  readonly em: any;
}

export type CheckResult = "sat" | "unsat" | "unknown";

let z3Promise: Promise<any> | undefined;

/** Initialize Z3 once (WASM load is expensive) and cache the module. */
async function loadZ3(): Promise<any> {
  if (!z3Promise) z3Promise = init();
  return z3Promise;
}

let contextCounter = 0;

/** A fresh, isolated Z3 context with the high-level constructors we use. */
export async function createZ3Api(): Promise<Z3Api> {
  const z3 = await loadZ3();
  const ctx = new z3.Context(`writ-analyzer-${contextCounter++}`);
  return {
    ctx,
    Int: ctx.Int,
    Bool: ctx.Bool,
    If: ctx.If,
    And: (...args: Z3Expr[]) => ctx.And(...args),
    Or: (...args: Z3Expr[]) => ctx.Or(...args),
    Not: (arg: Z3Expr) => ctx.Not(arg),
    Optimize: ctx.Optimize,
    em: z3.em,
  };
}

function lbool(value: number): CheckResult {
  if (value === 1) return "sat";
  if (value === -1) return "unsat";
  return "unknown";
}

/** Synchronous `Z3_optimize_check` with no assumptions — no pthread worker. */
export function checkOptimize(api: Z3Api, optimize: any): CheckResult {
  return lbool(api.em._Z3_optimize_check(api.ctx.ptr, optimize.ptr, 0, 0));
}

/** Read an integer from a model. */
export function modelInt(model: any, expr: Z3Expr): number {
  return Number(model.eval(expr, true).value());
}
/* eslint-enable @typescript-eslint/no-explicit-any */
