// CORE-008 (part 3) — the top-level commitment evaluator.
//
// `evaluateCommitment` is the single deterministic entry point that turns frozen
// inputs (compiled IR, evidence snapshot, interpretation profile, temporal
// bounds) into a schema-valid, content-addressed evaluation receipt. It composes
// the pipeline of 04_FORMAL_SEMANTICS.md:
//
//   §3  build the fact environment from the snapshot, filtering score-eligible
//       evidence (accepted + recorded ≤ cutoff + reviewed) BEFORE constructing
//       the collections the query engine ranges over;
//   §5  derive predicates → fold into the facts;
//   §6  run classifications → fold labels into the facts;
//       evaluate declared variables → fold their values into the facts;
//   §12 select the score branch with the deterministic procedure;
//   §16 canonicalize + hash into a receipt whose `dependencies` bind the five
//       named content hashes and whose `canonical_hash` is self-describing.
//
// Every stage shares one `ProofBuilder`, so the emitted nodes form a single proof
// DAG with globally unique ids rooted at the score selection. No wall-clock,
// randomness, or network — two runs on identical inputs produce byte-identical
// canonical JSON and an identical `canonical_hash`.

import type { CanonicalIr, Commitment, Evidence, InterpretationProfile } from "@covenant/domain";
import type { Diagnostic } from "@covenant/domain";
import {
  evaluatorBuildHash,
  evidenceSnapshotHash,
  interpretationProfileHash,
  methodologyBundleHash,
} from "@covenant/provenance";
import { ProofBuilder } from "./proof.js";
import { EvalContext, evalValue } from "./interpret.js";
import type { Environment, EvidenceRecord } from "./environment.js";
import { compareInstant, parseInstant } from "./temporal.js";
import { derivePredicate } from "./derive.js";
import { classifyBlock } from "./classify.js";
import { evaluateScore, type VariableContribution } from "./score.js";
import { finalizeReceipt, toReceiptDiagnostic, toReceiptProofNode } from "./receipt.js";
import type { EvaluationReceipt } from "@covenant/domain";

/** Descriptor of the evaluator binary that produced a receipt (hashed as-is). */
export const DEFAULT_EVALUATOR_BUILD = Object.freeze({
  name: "@covenant/evaluator",
  version: "0.1.0",
});

/** Placeholder profile identity used when no interpretation profile is supplied. */
const DEFAULT_PROFILE_SENTINEL = Object.freeze({ id: "none", version: "0.0.0" });

/** Inputs to a single deterministic commitment evaluation. */
export interface EvaluateCommitmentOptions {
  /** The compiled canonical IR (the frozen methodology bundle). */
  readonly ir: CanonicalIr;
  /** Which commitment to evaluate; defaults to the IR's first commitment. */
  readonly commitmentId?: string;
  /** The frozen evidence snapshot document. */
  readonly snapshot: Evidence;
  /** The subject (jurisdiction / party) being scored. */
  readonly subject: string;
  /** The interpretation profile (parameters + decisions), if any. */
  readonly profile?: InterpretationProfile;
  /** Evaluation instant (ISO-8601). Defaults to the snapshot's `frozen_at`. */
  readonly as_of?: string;
  /** Knowledge cutoff (ISO-8601). Defaults to the snapshot's `cutoff`. */
  readonly cutoff?: string;
  /** Evaluator build descriptor; hashed into `dependencies.evaluator_build_hash`. */
  readonly evaluatorBuild?: unknown;
}

/** Evaluate a commitment and return a schema-valid, hashed evaluation receipt. */
export function evaluateCommitment(options: EvaluateCommitmentOptions): EvaluationReceipt {
  const { ir, snapshot, subject, profile } = options;
  const commitment = selectCommitment(ir, options.commitmentId);
  const cutoff = options.cutoff ?? snapshot.snapshot.cutoff;
  const as_of = options.as_of ?? snapshot.snapshot.frozen_at ?? cutoff;

  // --- §3 evidence eligibility (BEFORE building collections) ----------------
  const reviews = (snapshot.reviews ?? []) as unknown as EvidenceRecord[];
  const eligibleClaims = snapshot.claims.filter((claim) =>
    claimEligible(claim as unknown as EvidenceRecord, cutoff, reviews),
  );
  const eligibleClaimIds = new Set(eligibleClaims.map((claim) => String(claim.id)));
  const eligibleActions = snapshot.actions.filter((action) =>
    actionEligible(action as unknown as EvidenceRecord, cutoff, eligibleClaimIds, reviews),
  );

  const collections: Record<string, readonly EvidenceRecord[]> = {
    actions: eligibleActions as unknown as EvidenceRecord[],
    claims: eligibleClaims as unknown as EvidenceRecord[],
  };

  const profileParameters: Record<string, unknown> =
    profile?.parameters !== undefined ? { ...(profile.parameters as Record<string, unknown>) } : {};

  const declaredSets = buildDeclaredSets(commitment);
  const baseFacts = buildBaseFacts(commitment, subject, profileParameters);

  // --- Shared proof + diagnostics across every stage ------------------------
  const proof = new ProofBuilder();
  const diagnostics: Diagnostic[] = [];
  let facts: Record<string, unknown> = { ...baseFacts };

  const envOf = (currentFacts: Record<string, unknown>): Environment => ({
    facts: currentFacts,
    collections,
    actionIdentity: commitment.action_identity,
    temporal: { as_of, cutoff },
    declaredSets,
    parameters: profileParameters,
    scoreDecisive: true,
  });

  const runStage = <T>(fn: (ctx: EvalContext) => T): T => {
    const ctx = new EvalContext(envOf(facts), proof);
    const value = fn(ctx);
    diagnostics.push(...ctx.diagnostics);
    return value;
  };

  // --- §5 predicate derivation ----------------------------------------------
  for (const predicate of commitment.predicates) {
    const derived = runStage((ctx) => derivePredicate(predicate, ctx));
    facts = { ...facts, [predicate.id]: derived.truth };
  }

  // --- §6 classification ----------------------------------------------------
  for (const block of commitment.classifications) {
    const result = runStage((ctx) => classifyBlock(block, ctx));
    diagnostics.push(...result.diagnostics);
    facts = {
      ...facts,
      [block.id]: block.mode === "multi_label" ? result.labels : result.label,
    };
  }

  // --- variables ------------------------------------------------------------
  const variableContribs = new Map<string, VariableContribution>();
  for (const variable of commitment.variables) {
    const res = runStage((ctx) => evalValue(variable.expression, ctx));
    if (res.known && res.value !== undefined) {
      facts = { ...facts, [variable.id]: res.value };
    }
    variableContribs.set(variable.id, {
      nodeId: res.node.id,
      actionIds: res.node.action_ids ?? [],
      claimIds: res.node.claim_ids ?? [],
    });
  }

  // --- §12 score selection --------------------------------------------------
  const outcome = runStage((ctx) => evaluateScore(commitment.score_program, ctx, variableContribs));
  diagnostics.push(...outcome.diagnostics);

  // --- §16 receipt assembly + canonical hash --------------------------------
  const commitmentVersionId = `${ir.package.name}@${ir.package.version}`;
  const interpretationProfileId =
    profile !== undefined ? `${profile.id}@${profile.version}` : "none@0.0.0";

  const unresolvedClaimIds = eligibleClaims
    .filter((claim) => claim.truth_value === "unknown")
    .map((claim) => String(claim.id));
  const contestedClaimIds = eligibleClaims
    .filter((claim) => claim.truth_value === "contested")
    .map((claim) => String(claim.id));

  const receiptNoHash: Record<string, unknown> = {
    schema_version: "1.0.0",
    id: `receipt:${commitmentVersionId}:${subject}:${cutoff}`,
    run: {
      commitment_version_id: commitmentVersionId,
      subject_id: subject,
      interpretation_profile_id: interpretationProfileId,
      as_of,
      cutoff,
    },
    result: outcome.result,
    result_status: outcome.status,
    ...(outcome.matchedRuleId !== undefined ? { matched_rule_id: outcome.matchedRuleId } : {}),
    rule_evaluations: outcome.ruleEvaluations.map((evaluation) => ({
      rule_id: evaluation.ruleId,
      priority: evaluation.priority,
      result: evaluation.result,
      truth_value: evaluation.truth,
      proof_id: evaluation.proofId,
    })),
    proof: {
      root_id: outcome.rootId,
      nodes: proof.nodes.map(toReceiptProofNode),
    },
    qualifying_action_ids: [...outcome.qualifyingActionIds],
    ...(unresolvedClaimIds.length > 0 ? { unresolved_claim_ids: unresolvedClaimIds } : {}),
    ...(contestedClaimIds.length > 0 ? { contested_claim_ids: contestedClaimIds } : {}),
    ...(diagnostics.length > 0 ? { diagnostics: diagnostics.map(toReceiptDiagnostic) } : {}),
    dependencies: {
      methodology_bundle_hash: methodologyBundleHash(ir),
      evidence_snapshot_hash: evidenceSnapshotHash(snapshot),
      interpretation_profile_hash: interpretationProfileHash(profile ?? DEFAULT_PROFILE_SENTINEL),
      evaluator_build_hash: evaluatorBuildHash(options.evaluatorBuild ?? DEFAULT_EVALUATOR_BUILD),
      source_snapshot_ids: [snapshot.snapshot.id],
      claim_ids: [...eligibleClaimIds],
      action_ids: eligibleActions.map((action) => String(action.id)),
    },
  };

  return finalizeReceipt(receiptNoHash);
}

// --- Commitment + environment construction ----------------------------------

function selectCommitment(ir: CanonicalIr, commitmentId: string | undefined): Commitment {
  if (commitmentId !== undefined) {
    const found = ir.commitments.find((commitment) => commitment.id === commitmentId);
    if (found === undefined) {
      throw new Error(`Commitment "${commitmentId}" not found in IR package ${ir.package.name}.`);
    }
    return found;
  }
  const first = ir.commitments[0];
  if (first === undefined) {
    throw new Error(`IR package ${ir.package.name} declares no commitments.`);
  }
  return first;
}

function buildBaseFacts(
  commitment: Commitment,
  subject: string,
  profileParameters: Record<string, unknown>,
): Record<string, unknown> {
  const facts: Record<string, unknown> = {
    subject: { id: subject, jurisdiction: subject, name: subject },
  };
  for (const parameter of commitment.parameters) {
    facts[parameter.id] =
      parameter.id in profileParameters ? profileParameters[parameter.id] : parameter.default;
  }
  return facts;
}

function buildDeclaredSets(commitment: Commitment): Record<string, readonly string[]> {
  const sets: Record<string, readonly string[]> = {};
  if (commitment.partner_classes !== undefined) {
    sets.partner_classes = commitment.partner_classes.map((element) => element.id);
  }
  if (commitment.goals !== undefined) {
    sets.goals = commitment.goals.map((element) => element.id);
  }
  if (commitment.dimensions !== undefined) {
    sets.dimensions = commitment.dimensions.map((element) => element.id);
  }
  return sets;
}

// --- §3 eligibility ----------------------------------------------------------

function withinCutoff(instant: unknown, cutoff: string): boolean {
  if (typeof instant !== "string") return false;
  const at = parseInstant(instant);
  const bound = parseInstant(cutoff);
  if (at === null || bound === null) return false;
  return compareInstant(at, bound) <= 0;
}

const POSITIVE_DECISIONS = new Set(["accept", "approve"]);
const NEGATIVE_DECISIONS = new Set(["reject", "contest", "request_changes", "withdraw"]);

function reviewsSatisfied(
  objectId: string,
  objectType: string,
  reviews: readonly EvidenceRecord[],
): boolean {
  let positive = false;
  let negative = false;
  for (const review of reviews) {
    if (review.object_id !== objectId || review.object_type !== objectType) continue;
    const decision = String(review.decision);
    if (POSITIVE_DECISIONS.has(decision)) positive = true;
    if (NEGATIVE_DECISIONS.has(decision)) negative = true;
  }
  return positive && !negative;
}

/** A claim is score-eligible: accepted, recorded on-or-before cutoff, and reviewed. */
export function claimEligible(
  claim: EvidenceRecord,
  cutoff: string,
  reviews: readonly EvidenceRecord[],
): boolean {
  if (claim.status !== "accepted") return false;
  if (!withinCutoff(claim.recorded_at, cutoff)) return false;
  return reviewsSatisfied(String(claim.id), "claim", reviews);
}

/**
 * An action is score-eligible: accepted, announced/valid on-or-before cutoff, and
 * reviewed — either directly (an accept/approve action review) or transitively
 * through at least one eligible supporting claim.
 */
export function actionEligible(
  action: EvidenceRecord,
  cutoff: string,
  eligibleClaimIds: ReadonlySet<string>,
  reviews: readonly EvidenceRecord[],
): boolean {
  if (action.status !== "accepted") return false;
  const timeMarker = pickTimeMarker(action);
  if (timeMarker !== undefined && !withinCutoff(timeMarker, cutoff)) return false;
  if (reviewsSatisfied(String(action.id), "action", reviews)) return true;
  const claimIds = Array.isArray(action.claim_ids) ? action.claim_ids : [];
  return claimIds.some((claimId) => eligibleClaimIds.has(String(claimId)));
}

function pickTimeMarker(action: EvidenceRecord): string | undefined {
  if (typeof action.announcement_time === "string") return action.announcement_time;
  const validTime = action.valid_time;
  if (
    typeof validTime === "object" &&
    validTime !== null &&
    typeof (validTime as Record<string, unknown>).start === "string"
  ) {
    return (validTime as Record<string, unknown>).start as string;
  }
  return undefined;
}
