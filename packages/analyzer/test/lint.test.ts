import { expect, test } from "bun:test";
import type { CanonicalIr, Commitment, Expr } from "@writ/domain";
import {
  applyWaivers,
  isWellFormedWaiver,
  lintCommitment,
  runPublicationProfile,
  type Waiver,
} from "../src/index.js";

function commitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "AI_SME_ADOPTION",
    title: "t",
    subjects: ["Canada"],
    evaluation_window: {
      start: "2025-06-18",
      end: "2026-06-01",
      start_inclusive: true,
      end_inclusive: true,
    },
    evidence_policy: "open_world",
    unknown_policy: "propagate",
    parameters: [],
    action_identity: { policy: "strict_deduplicate", key_paths: ["underlying_instrument_id"] },
    predicates: [],
    classifications: [],
    variables: [{ id: "strong_count", type: "Int", expression: { kind: "literal", value: 0 } }],
    score_program: {
      rules: [
        {
          id: "full",
          priority: 10,
          result: "+1",
          when: {
            kind: "compare",
            op: "gte",
            left: { kind: "ref", path: "strong_count" },
            right: { kind: "literal", value: 5 },
          },
          rationale_id: "r1",
        },
      ],
      otherwise: { result: "-1", message: "" },
    },
    assertions: [],
    ...overrides,
  };
}

function ir(commitments: Commitment[], waivers: Waiver[] = []): CanonicalIr {
  return {
    schema_version: "1.0.0",
    language_version: "0.1",
    package: { name: "test.pkg", version: "1.0.0", content_hash: "sha256:0", imports: [] },
    commitments,
    diagnostic_waivers: waivers,
  };
}

test("an undeclared score reference is WRT-LINT-MISSING-REFERENCE at the rule", () => {
  const cmt = commitment({
    score_program: {
      rules: [
        {
          id: "full",
          priority: 10,
          result: "+1",
          when: {
            kind: "compare",
            op: "gte",
            left: { kind: "ref", path: "phantom_count" },
            right: { kind: "literal", value: 5 },
          },
          rationale_id: "r1",
        },
      ],
      otherwise: { result: "-1", message: "" },
    },
  });
  const diagnostics = lintCommitment(cmt);
  const missing = diagnostics.find((d) => d.code === "WRT-LINT-MISSING-REFERENCE");
  expect(missing).toBeDefined();
  expect(missing!.context?.reference).toBe("phantom_count");
  expect(missing!.location?.objectId).toBe("full");
});

test("a score-decisive rule with neither source nor rationale is flagged", () => {
  const cmt = commitment({
    score_program: {
      rules: [
        {
          id: "full",
          priority: 10,
          result: "+1",
          when: {
            kind: "compare",
            op: "gte",
            left: { kind: "ref", path: "strong_count" },
            right: { kind: "literal", value: 5 },
          },
        },
      ],
      otherwise: { result: "-1", message: "" },
    },
  });
  const diagnostics = lintCommitment(cmt);
  expect(diagnostics.some((d) => d.code === "WRT-LINT-SOURCE-RATIONALE")).toBe(true);
});

test("an ordering comparison against a non-numeric variable is WRT-LINT-TYPE", () => {
  const cmt = commitment({
    variables: [
      { id: "roadmap", type: "Truth", expression: { kind: "literal", value: "unknown" } },
    ],
    score_program: {
      rules: [
        {
          id: "full",
          priority: 10,
          result: "+1",
          when: {
            kind: "compare",
            op: "gte",
            left: { kind: "ref", path: "roadmap" },
            right: { kind: "literal", value: 5 },
          },
          rationale_id: "r1",
        },
      ],
      otherwise: { result: "-1", message: "" },
    },
  });
  const diagnostics = lintCommitment(cmt);
  const typeError = diagnostics.find((d) => d.code === "WRT-LINT-TYPE");
  expect(typeError).toBeDefined();
  expect(typeError!.context?.declaredType).toBe("truth");
});

test("a bare temporal `date` reference is WRT-LINT-TIME-AXIS", () => {
  const when: Expr = {
    kind: "compare",
    op: "before",
    left: { kind: "ref", path: "date" },
    right: { kind: "literal", value: "2026-01-01" },
  };
  const cmt = commitment({
    score_program: {
      rules: [{ id: "r", priority: 10, result: "-1", when, rationale_id: "r1" }],
      otherwise: { result: "0", message: "" },
    },
  });
  expect(lintCommitment(cmt).some((d) => d.code === "WRT-LINT-TIME-AXIS")).toBe(true);
});

test("a collective actor scored with its members and no attribution policy is flagged", () => {
  const cmt = commitment({ subjects: ["EuropeanUnion", "France", "Germany"] });
  expect(lintCommitment(cmt).some((d) => d.code === "WRT-LINT-ATTRIBUTION")).toBe(true);

  const withRationale = commitment({
    subjects: ["EuropeanUnion", "France"],
    rationales: [{ id: "a", text: "EU actions are attributed to members proportionally." }],
  });
  expect(lintCommitment(withRationale).some((d) => d.code === "WRT-LINT-ATTRIBUTION")).toBe(false);
});

// ---- Waivers --------------------------------------------------------------

test("waivers are typed, scoped, and version/expiry aware", () => {
  const wellFormed: Waiver = {
    diagnostic_code: "WRT-LINT-SOURCE-RATIONALE",
    object_id: "full",
    rationale: "Rule text is self-evidently sourced from the chapter heading.",
    approved_by: "methodologist:landre",
    expires_at: "2026-12-31",
    methodology_version: "1.0.0",
  };
  expect(isWellFormedWaiver(wellFormed)).toBe(true);
  expect(isWellFormedWaiver({ ...wellFormed, approved_by: "" })).toBe(false);

  const cmt = commitment({
    score_program: {
      rules: [{ id: "full", priority: 10, result: "+1", when: { kind: "literal", value: true } }],
      otherwise: { result: "-1", message: "" },
    },
  });
  const diagnostics = lintCommitment(cmt);
  expect(diagnostics.some((d) => d.code === "WRT-LINT-SOURCE-RATIONALE")).toBe(true);

  const context = { asOf: "2026-07-23", methodologyVersion: "1.0.0" };
  expect(
    applyWaivers(diagnostics, [wellFormed], context).active.some(
      (d) => d.code === "WRT-LINT-SOURCE-RATIONALE",
    ),
  ).toBe(false);

  // Expired waiver no longer applies.
  const expired = applyWaivers(diagnostics, [{ ...wellFormed, expires_at: "2026-01-01" }], context);
  expect(expired.active.some((d) => d.code === "WRT-LINT-SOURCE-RATIONALE")).toBe(true);

  // Wrong methodology version no longer applies.
  const versioned = applyWaivers(
    diagnostics,
    [{ ...wellFormed, methodology_version: "2.0.0" }],
    context,
  );
  expect(versioned.active.some((d) => d.code === "WRT-LINT-SOURCE-RATIONALE")).toBe(true);

  // Wrong object scope no longer applies.
  const misscoped = applyWaivers(diagnostics, [{ ...wellFormed, object_id: "other" }], context);
  expect(misscoped.active.some((d) => d.code === "WRT-LINT-SOURCE-RATIONALE")).toBe(true);
});

test("publication profile fails on unwaived errors and passes once waived", () => {
  const cmt = commitment({
    action_identity: { policy: "review_required", key_paths: [] },
    variables: [
      {
        id: "strong_count",
        type: "Int",
        expression: { kind: "query", operation: "count_distinct", collection: "actions" },
      },
    ],
  });

  const failing = runPublicationProfile({ ir: ir([cmt]), asOf: "2026-07-23" });
  expect(failing.ok).toBe(false);
  expect(failing.unwaivedErrors.some((d) => d.code === "WRT-IDENTITY-MISSING")).toBe(true);

  const waiver: Waiver = {
    diagnostic_code: "WRT-IDENTITY-MISSING",
    object_id: "AI_SME_ADOPTION",
    rationale: "Historical import; identity policy tracked in follow-up.",
    approved_by: "methodologist:landre",
    expires_at: "2026-12-31",
  };
  const passing = runPublicationProfile({ ir: ir([cmt], [waiver]), asOf: "2026-07-23" });
  expect(passing.ok).toBe(true);
  expect(passing.waived.some((w) => w.diagnostic.code === "WRT-IDENTITY-MISSING")).toBe(true);

  // A prior-to-expiry run with additional score-analysis errors still fails.
  const withScoreError = runPublicationProfile({
    ir: ir([cmt], [waiver]),
    asOf: "2026-07-23",
    additionalDiagnostics: [
      {
        code: "WRT-SCORE-GAP",
        severity: "error",
        message: "gap",
        location: { objectId: "AI_SME_ADOPTION" },
      },
    ],
  });
  expect(withScoreError.ok).toBe(false);
});
