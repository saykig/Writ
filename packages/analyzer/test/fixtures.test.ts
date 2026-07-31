import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Commitment, Diagnostic, ScoreProgram } from "@writ/domain";
import {
  analyzeScoreProgram,
  evaluateTruth,
  lintCommitment,
  lintProseMetric,
  truthName,
  type FiniteDomains,
  type ProseClaim,
} from "../src/index.js";
import { inclusiveUpToProgram, literalIr, literalProgram } from "./programs.js";

function readFixture<T>(name: string): T {
  const directory = name.startsWith("ai-sme")
    ? "compatibility/g7-ai-sme/analyzer"
    : "language/diagnostics";
  return JSON.parse(
    readFileSync(
      new URL(`../../../internal/verification/fixtures/${directory}/${name}`, import.meta.url),
      "utf8",
    ),
  ) as T;
}

interface ScoreFixture {
  readonly id: string;
  readonly program: string;
  readonly domains: FiniteDomains;
  readonly expect: readonly {
    code: string;
    witness?: Record<string, unknown>;
    matched_results?: string[];
  }[];
}

const PROGRAMS: Record<string, ScoreProgram> = {
  "2025-ai-sme-literal": literalProgram,
  "2025-ai-sme-inclusive-up-to": inclusiveUpToProgram(),
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([key, inner]) => [key, canonical(inner)]),
  );
}

function matching(
  diagnostics: readonly Diagnostic[],
  code: string,
  witness?: Record<string, unknown>,
): Diagnostic | undefined {
  return diagnostics.find(
    (diagnostic) =>
      diagnostic.code === code && (witness === undefined || deepEqual(diagnostic.witness, witness)),
  );
}

for (const fixtureName of [
  "ai-sme-gap.json",
  "ai-sme-counter-overlap.json",
  "ai-sme-inclusive-up-to-overlap.json",
]) {
  test(`score fixture ${fixtureName} produces its exact diagnostic`, async () => {
    const fixture = readFixture<ScoreFixture>(fixtureName);
    const program = PROGRAMS[fixture.program];
    expect(program).toBeDefined();
    const { diagnostics } = await analyzeScoreProgram(program!, fixture.domains, {
      objectId: "AI_SME_ADOPTION",
    });
    for (const expected of fixture.expect) {
      const found = matching(diagnostics, expected.code, expected.witness);
      expect(found).toBeDefined();
      if (expected.matched_results) {
        expect(found!.context?.matchedResults).toEqual(expected.matched_results);
      }
    }
  });
}

// ---- Lint fixtures --------------------------------------------------------

function commitmentBase(): Commitment {
  return {
    id: "AI_SME_ADOPTION",
    title: "Sustain investments in AI adoption programs for SMEs",
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
    action_identity: { policy: "review_required", key_paths: ["underlying_instrument_id"] },
    predicates: [],
    classifications: [],
    variables: [],
    score_program: { rules: [], otherwise: { result: "unresolved", message: "" } },
    assertions: [],
  };
}

test("missing-action-identity fixture: a score-decisive count with no identity policy errors", () => {
  const fixture = readFixture<{ expect: { code: string; severity: string }[] }>(
    "missing-action-identity.json",
  );
  const expectedCode = fixture.expect[0]!.code;

  const commitment: Commitment = {
    ...commitmentBase(),
    action_identity: { policy: "review_required", key_paths: [] }, // no usable identity keys
    variables: [
      {
        id: "strong_count",
        type: "Int",
        expression: {
          kind: "query",
          operation: "count_distinct",
          collection: "actions",
          where: {
            kind: "compare",
            op: "eq",
            left: { kind: "ref", path: "classification" },
            right: { kind: "literal", value: "strong" },
          },
        },
      },
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
            left: { kind: "ref", path: "strong_count" },
            right: { kind: "literal", value: 5 },
          },
        },
      ],
      otherwise: { result: "-1", message: "" },
    },
  };

  const diagnostics = lintCommitment(commitment);
  const identity = diagnostics.find((diagnostic) => diagnostic.code === expectedCode);
  expect(expectedCode).toBe("WRT-IDENTITY-MISSING");
  expect(identity).toBeDefined();
  expect(identity!.severity).toBe("error");
  expect(identity!.location?.objectId).toBe("AI_SME_ADOPTION");
});

test("a declared action-identity policy with key paths suppresses WRT-IDENTITY-MISSING", () => {
  const commitment: Commitment = {
    ...commitmentBase(),
    variables: [
      {
        id: "strong_count",
        type: "Int",
        expression: { kind: "query", operation: "count_distinct", collection: "actions" },
      },
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
            left: { kind: "ref", path: "strong_count" },
            right: { kind: "literal", value: 5 },
          },
        },
      ],
      otherwise: { result: "-1", message: "" },
    },
  };
  const diagnostics = lintCommitment(commitment);
  expect(diagnostics.some((diagnostic) => diagnostic.code === "WRT-IDENTITY-MISSING")).toBe(false);
});

test("transnational prose/metric fixture surfaces WRT-PROSE-METRIC-MISMATCH", () => {
  const fixture = readFixture<{
    commitment: string;
    inputs: { guideline_text: string; metric_text: string };
    expect: { code: string; severity: string }[];
  }>("transnational-prose-mismatch.json");

  const claim: ProseClaim = {
    id: "transnational-crime-full-compliance",
    objectId: fixture.commitment,
    proseText: fixture.inputs.guideline_text,
    metricText: fixture.inputs.metric_text,
    status: "conflict",
  };
  const diagnostics = lintProseMetric([claim]);
  const mismatch = diagnostics.find((diagnostic) => diagnostic.code === fixture.expect[0]!.code);
  expect(fixture.expect[0]!.code).toBe("WRT-PROSE-METRIC-MISMATCH");
  expect(mismatch).toBeDefined();
  expect(mismatch!.severity).toBe("error");
  expect(mismatch!.location?.objectId).toBe("TRANSNATIONAL_CRIME");
});

test("consistent prose claims raise nothing", () => {
  expect(
    lintProseMetric([
      { id: "c", objectId: "X", proseText: "a", metricText: "a", status: "consistent" },
      { id: "u", objectId: "X", proseText: "a", metricText: "b", status: "unreviewed" },
    ]),
  ).toHaveLength(0);
});

test("unknown-threshold fixture: an interval crossing the threshold is unknown", () => {
  const fixture = readFixture<{
    count_interval: { min: number; max: number };
    expected_truth: string;
  }>("unknown-threshold.json");

  const expr = {
    kind: "compare" as const,
    op: "gte" as const,
    left: { kind: "ref" as const, path: "strong_count" },
    right: { kind: "literal" as const, value: 5 },
  };
  const result: string = truthName(evaluateTruth(expr, { strong_count: fixture.count_interval }));
  expect(result).toBe(fixture.expected_truth);
});

// Guard: the flagship literal IR still resolves all score references.
test("flagship literal IR has no unresolved score references", () => {
  const diagnostics = lintCommitment(literalIr.commitments[0]!);
  expect(diagnostics.some((diagnostic) => diagnostic.code === "WRT-LINT-MISSING-REFERENCE")).toBe(
    false,
  );
});
