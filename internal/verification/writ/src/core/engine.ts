import {
  gateResult,
  type VerificationGate,
  type VerificationGateResult,
  type VerificationIssue,
  type WritVerificationResult,
} from "../types.js";

export type VerificationSelection = VerificationGate | "all";
export type VerificationRunner<TTarget> = (target: TTarget) => VerificationGateResult;

export interface VerificationHarness<TTarget> {
  order: readonly VerificationGate[];
  runners: Readonly<Record<VerificationGate, VerificationRunner<TTarget>>>;
  loadIssues(target: TTarget): readonly VerificationIssue[];
}

/** Stable family-agnostic orchestration for scoped verification rule packs. */
export function runVerification<TTarget>(
  target: TTarget,
  selection: VerificationSelection,
  harness: VerificationHarness<TTarget>,
): WritVerificationResult {
  const order = selection === "all" ? harness.order : [selection];
  const gates = order.map((gate) => harness.runners[gate](target));
  const loadIssues = harness.loadIssues(target);
  if (selection !== "all" && selection !== "integrity" && loadIssues.length > 0) {
    gates.push(gateResult("integrity", [...loadIssues]));
  }
  return { passed: gates.every((gate) => gate.passed), gates };
}
