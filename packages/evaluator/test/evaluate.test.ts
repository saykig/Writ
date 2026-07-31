import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "@writ/provenance";
import {
  validate,
  type CanonicalIr,
  type Evidence,
  type InterpretationProfile,
} from "@writ/domain";
import { actionEligible, claimEligible, evaluateCommitment, verifyReceipt } from "../src/index.js";

function loadExample<T>(name: string): T {
  const path = fileURLToPath(
    new URL(
      `../../../internal/verification/fixtures/compatibility/g7-ai-sme/schemas/${name}`,
      import.meta.url,
    ),
  );
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const ir = loadExample<CanonicalIr>("2025-ai-sme-literal.ir.json");
const evidence = loadExample<Evidence>("2025-ai-sme.sample-evidence.json");
const profile = loadExample<InterpretationProfile>("2025-ai-sme.sample-profile.json");

describe("evaluateCommitment — AI-for-SMEs literal example", () => {
  test("evaluates end-to-end to a schema-valid receipt", () => {
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    const result = validate("evaluation-receipt", receipt);
    expect(result.valid).toBe(true);
  });

  test("the literal IR is under-determined by the evidence ⇒ unresolved/incomplete", () => {
    // The literal IR reads a per-action `classification` field the evidence never
    // provides, so every count's membership is unknown. Unknown is never silently
    // treated as false, so the score is unresolved rather than dropping a branch.
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    expect(receipt.result).toBe("unresolved");
    expect(receipt.result_status).toBe("incomplete");
    expect(receipt.matched_rule_id).toBeUndefined();
    expect((receipt.diagnostics ?? []).map((d) => d.code)).toContain("WRT-EVAL-DECISIVE-UNKNOWN");
  });

  test("the proof root is the score selection node", () => {
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    const root = receipt.proof.nodes.find((node) => node.id === receipt.proof.root_id);
    expect(root?.kind).toBe("selection");
    // Every declared score rule has a rule evaluation whose proof node is a child
    // of the selection root.
    expect(receipt.rule_evaluations.map((r) => r.rule_id).sort()).toEqual([
      "full",
      "none",
      "partial",
    ]);
    for (const evaluation of receipt.rule_evaluations) {
      expect(root?.child_ids).toContain(evaluation.proof_id);
    }
  });

  test("dependencies carry the five named hashes and source snapshot id", () => {
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    const deps = receipt.dependencies;
    for (const hash of [
      deps.methodology_bundle_hash,
      deps.evidence_snapshot_hash,
      deps.interpretation_profile_hash,
      deps.evaluator_build_hash,
    ]) {
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(deps.source_snapshot_ids).toEqual(["snapshot-canada-ai-sme-2025-10-31"]);
    expect(receipt.canonical_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("is byte-identical and hash-stable across two runs", () => {
    const a = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    const b = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(a.canonical_hash).toBe(b.canonical_hash);
  });

  test("the receipt's canonical hash verifies", () => {
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    expect(verifyReceipt(receipt).valid).toBe(true);
  });
});

// --- Enriched evidence: a fully-determined +1 outcome ------------------------

function strongAction(index: number): Record<string, unknown> {
  return {
    id: `action-${index}`,
    label: `Strong action ${index}`,
    actors: ["Canada"],
    jurisdiction: "Canada",
    kind: "compute_subsidy",
    implementation_stage: "funded",
    beneficiary_targeting: "explicit",
    attribution: "unilateral",
    status: "accepted",
    announcement_time: "2025-06-25T00:00:00Z",
    classification: "strong",
    program_family_id: "fam",
    underlying_instrument_id: `instrument-${index}`,
    claim_ids: [],
  };
}

function enrichedEvidence(actions: Record<string, unknown>[]): Evidence {
  return {
    schema_version: "1.0.0",
    snapshot: {
      id: "snapshot-enriched",
      frozen_at: "2025-10-31T23:59:59Z",
      cutoff: "2025-10-31T23:59:59Z",
      content_hash: "sha256:" + "0".repeat(64),
    },
    document_versions: [],
    passages: [],
    claims: [],
    actions,
    reviews: actions.map((action) => ({
      id: `review-${action.id as string}`,
      object_type: "action",
      object_id: action.id as string,
      reviewer_id: "reviewer",
      decision: "accept",
      rationale: "reviewed",
      created_at: "2025-10-31T13:00:00Z",
    })),
  } as unknown as Evidence;
}

describe("evaluateCommitment — enriched, fully-determined evidence", () => {
  test("five distinct strong actions ⇒ +1 supported, selecting `full`", () => {
    const actions = [0, 1, 2, 3, 4].map(strongAction);
    const receipt = evaluateCommitment({
      ir,
      snapshot: enrichedEvidence(actions),
      subject: "Canada",
      profile,
    });
    expect(receipt.result).toBe("+1");
    expect(receipt.result_status).toBe("supported");
    expect(receipt.matched_rule_id).toBe("full");
    expect(validate("evaluation-receipt", receipt).valid).toBe(true);
    // The qualifying actions trace up from the count_distinct node the `full`
    // branch read.
    expect((receipt.qualifying_action_ids ?? []).sort()).toEqual([
      "action-0",
      "action-1",
      "action-2",
      "action-3",
      "action-4",
    ]);
  });

  test("ineligible (non-accepted) actions are filtered before counting", () => {
    const accepted = [0, 1, 2, 3, 4].map(strongAction);
    const candidate = { ...strongAction(5), status: "candidate" };
    const receipt = evaluateCommitment({
      ir,
      snapshot: enrichedEvidence([...accepted, candidate]),
      subject: "Canada",
      profile,
    });
    // The candidate action never enters the environment, so the count is 5, the
    // outcome is still +1, and the dependency action set excludes it.
    expect(receipt.result).toBe("+1");
    expect(receipt.dependencies.action_ids).not.toContain("action-5");
    expect(receipt.dependencies.action_ids).toHaveLength(5);
  });
});

// --- Eligibility unit checks (§3) -------------------------------------------

describe("§3 evidence eligibility", () => {
  const cutoff = "2025-10-31T23:59:59Z";
  const acceptReview = {
    id: "rev",
    object_type: "claim",
    object_id: "c1",
    reviewer_id: "r",
    decision: "accept",
    rationale: "ok",
    created_at: "2025-10-01T00:00:00Z",
  };
  const claim = {
    id: "c1",
    status: "accepted",
    recorded_at: "2025-10-01T00:00:00Z",
    truth_value: "true",
  };

  test("accepted + within cutoff + reviewed ⇒ eligible", () => {
    expect(claimEligible(claim, cutoff, [acceptReview])).toBe(true);
  });

  test("a non-accepted claim is ineligible", () => {
    expect(claimEligible({ ...claim, status: "candidate" }, cutoff, [acceptReview])).toBe(false);
  });

  test("a claim recorded after cutoff is ineligible", () => {
    expect(
      claimEligible({ ...claim, recorded_at: "2025-12-01T00:00:00Z" }, cutoff, [acceptReview]),
    ).toBe(false);
  });

  test("an unreviewed claim is ineligible", () => {
    expect(claimEligible(claim, cutoff, [])).toBe(false);
  });

  test("a rejecting review overrides an accepting one", () => {
    const reject = { ...acceptReview, id: "rev2", decision: "reject" };
    expect(claimEligible(claim, cutoff, [acceptReview, reject])).toBe(false);
  });

  test("an action is eligible transitively through an eligible claim", () => {
    const action = {
      id: "a1",
      status: "accepted",
      announcement_time: "2025-06-25T00:00:00Z",
      claim_ids: ["c1"],
    };
    expect(actionEligible(action, cutoff, new Set(["c1"]), [])).toBe(true);
    expect(actionEligible(action, cutoff, new Set<string>(), [])).toBe(false);
  });
});

// --- Tamper evidence ---------------------------------------------------------

describe("verifyReceipt — tamper detection", () => {
  test("mutating any semantic field flips verification to tampered", () => {
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    expect(verifyReceipt(receipt).valid).toBe(true);

    for (const mutate of [
      (r: Record<string, unknown>) => (r.result = "+1"),
      (r: Record<string, unknown>) => (r.result_status = "supported"),
      (r: Record<string, unknown>) => ((r.run as Record<string, unknown>).subject_id = "France"),
    ]) {
      const clone = JSON.parse(JSON.stringify(receipt)) as Record<string, unknown>;
      mutate(clone);
      expect(verifyReceipt(clone as never).valid).toBe(false);
    }
  });

  test("the stored hash equals a recomputation of the untouched receipt", () => {
    const receipt = evaluateCommitment({ ir, snapshot: evidence, subject: "Canada", profile });
    const check = verifyReceipt(receipt);
    expect(check.expected).toBe(check.actual);
    expect(check.actual).toBe(receipt.canonical_hash);
  });
});
