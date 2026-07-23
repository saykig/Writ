/**
 * Typed, scoped, versioned/expiring waivers and the publication-profile gate.
 *
 * A waiver is a signed decision, not a config flag: it names a diagnostic code
 * and an object id (its scope), an approver and rationale (its type), and an
 * expiry and/or methodology version (its versioning). A waiver applies only to a
 * diagnostic with the same code and object, only while unexpired, and only for
 * the matching methodology version. Expiry is evaluated against an explicit
 * `asOf` date — never the wall clock — keeping the gate deterministic.
 *
 * The publication profile lints the IR (plus any supplied score-analysis
 * findings), applies waivers, and fails if any unwaived error remains.
 */

import type { CanonicalIr, Diagnostic } from "@covenant/domain";
import { lintIr, type ProseClaim } from "./lint.js";

/** A signed waiver. Structurally compatible with the IR `Waiver` type. */
export interface Waiver {
  readonly diagnostic_code: string;
  readonly object_id: string;
  readonly rationale: string;
  readonly approved_by: string;
  readonly expires_at?: string;
  readonly methodology_version?: string;
}

export interface WaiverContext {
  /** ISO date the run is evaluated as of; required to evaluate expiry. */
  readonly asOf?: string;
  /** The methodology version being published (for version-scoped waivers). */
  readonly methodologyVersion?: string;
}

export interface WaivedDiagnostic {
  readonly diagnostic: Diagnostic;
  readonly waiver: Waiver;
}

export interface ApplyWaiversResult {
  readonly active: Diagnostic[];
  readonly waived: WaivedDiagnostic[];
}

/** A waiver is well-formed when it carries its identifying and signing fields. */
export function isWellFormedWaiver(waiver: Waiver): boolean {
  return (
    typeof waiver.diagnostic_code === "string" &&
    waiver.diagnostic_code.length > 0 &&
    typeof waiver.object_id === "string" &&
    waiver.object_id.length > 0 &&
    typeof waiver.approved_by === "string" &&
    waiver.approved_by.length > 0 &&
    typeof waiver.rationale === "string" &&
    waiver.rationale.length > 0
  );
}

function waiverIsExpired(waiver: Waiver, context: WaiverContext): boolean {
  return (
    waiver.expires_at !== undefined &&
    context.asOf !== undefined &&
    context.asOf > waiver.expires_at
  );
}

function waiverApplies(diagnostic: Diagnostic, waiver: Waiver, context: WaiverContext): boolean {
  if (!isWellFormedWaiver(waiver)) return false;
  if (diagnostic.code !== waiver.diagnostic_code) return false;
  if (diagnostic.location?.objectId !== waiver.object_id) return false;
  if (
    waiver.methodology_version !== undefined &&
    context.methodologyVersion !== undefined &&
    waiver.methodology_version !== context.methodologyVersion
  ) {
    return false;
  }
  if (waiverIsExpired(waiver, context)) return false;
  return true;
}

/** Partition diagnostics into those still active and those waived. */
export function applyWaivers(
  diagnostics: readonly Diagnostic[],
  waivers: readonly Waiver[],
  context: WaiverContext = {},
): ApplyWaiversResult {
  const active: Diagnostic[] = [];
  const waived: WaivedDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const waiver = waivers.find((candidate) => waiverApplies(diagnostic, candidate, context));
    if (waiver) waived.push({ diagnostic, waiver });
    else active.push(diagnostic);
  }
  return { active, waived };
}

export interface PublicationProfileInput {
  readonly ir: CanonicalIr;
  /** ISO date; required to enforce waiver expiry. */
  readonly asOf?: string;
  /** Interpretation-profile waivers, merged with `ir.diagnostic_waivers`. */
  readonly profileWaivers?: readonly Waiver[];
  readonly proseClaims?: readonly ProseClaim[];
  /** Additional findings to gate on (e.g. Z3 score-analysis diagnostics). */
  readonly additionalDiagnostics?: readonly Diagnostic[];
}

export interface PublicationProfileResult {
  /** True when no unwaived error remains. */
  readonly ok: boolean;
  readonly active: Diagnostic[];
  readonly waived: WaivedDiagnostic[];
  readonly unwaivedErrors: Diagnostic[];
}

/**
 * Run the publication profile: lint, gate on score-analysis findings, apply
 * waivers, and fail on any unwaived error.
 */
export function runPublicationProfile(input: PublicationProfileInput): PublicationProfileResult {
  const waivers: Waiver[] = [
    ...(input.ir.diagnostic_waivers ?? []),
    ...(input.profileWaivers ?? []),
  ];
  const context: WaiverContext = {
    ...(input.asOf !== undefined ? { asOf: input.asOf } : {}),
    methodologyVersion: input.ir.package.version,
  };
  const raw: Diagnostic[] = [
    ...lintIr(input.ir, input.proseClaims ? { proseClaims: input.proseClaims } : {}),
    ...(input.additionalDiagnostics ?? []),
  ];
  const { active, waived } = applyWaivers(raw, waivers, context);
  const unwaivedErrors = active.filter((diagnostic) => diagnostic.severity === "error");
  return { ok: unwaivedErrors.length === 0, active, waived, unwaivedErrors };
}
