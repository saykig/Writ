import { expect, test } from "bun:test";
import type { Diagnostic } from "@writ/domain";
import { analyzeScoreProgram } from "../src/index.js";
import {
  deadRuleProgram,
  fullDomains,
  inclusiveUpToProgram,
  literalProgram,
  nonMonotonicProgram,
  resolvedProgram,
  smallAxisDomains,
} from "./programs.js";
import type { FiniteDomains } from "../src/index.js";

function byCode(diagnostics: readonly Diagnostic[], code: string): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === code);
}

function withWitness(
  diagnostics: readonly Diagnostic[],
  code: string,
  witness: Record<string, unknown>,
): Diagnostic | undefined {
  return byCode(diagnostics, code).find(
    (diagnostic) =>
      JSON.stringify(sortObject(diagnostic.witness)) === JSON.stringify(sortObject(witness)),
  );
}

function sortObject(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => [key, sortObject(inner)]),
  );
}

const counterOverlapDomains: FiniteDomains = {
  strong_count: [0, 5],
  weak_count: [0, 2, 5],
  counter_exists: [false, true],
};

test("literal 1..4 reading exposes WRT-SCORE-GAP with the strong=0 uncovered witness", async () => {
  const { diagnostics } = await analyzeScoreProgram(literalProgram, fullDomains);
  const gap = withWitness(diagnostics, "WRT-SCORE-GAP", {
    counter_exists: false,
    strong_count: 0,
    weak_count: 5,
  });
  expect(gap).toBeDefined();
  expect(gap!.severity).toBe("error");
});

test("counteraction overlap: strong=5 with a counteraction satisfies full and non-compliance", async () => {
  const { diagnostics } = await analyzeScoreProgram(literalProgram, counterOverlapDomains, {
    objectId: "AI_SME_ADOPTION",
  });
  const overlap = withWitness(diagnostics, "WRT-SCORE-OVERLAP", {
    strong_count: 5,
    weak_count: 0,
    counter_exists: true,
  });
  expect(overlap).toBeDefined();
  expect(overlap!.severity).toBe("error");
  expect(overlap!.context?.matchedResults).toEqual(["+1", "-1"]);
});

test("inclusive 0..4 reading turns the gap into a WRT-SCORE-OVERLAP at strong=0 low weak", async () => {
  const { diagnostics } = await analyzeScoreProgram(inclusiveUpToProgram(), fullDomains);
  const overlap = withWitness(diagnostics, "WRT-SCORE-OVERLAP", {
    strong_count: 0,
    weak_count: 0,
    counter_exists: false,
  });
  expect(overlap).toBeDefined();
  expect(overlap!.severity).toBe("error");
  expect(overlap!.context?.matchedResults).toEqual(["0", "-1"]);
});

test("priority-resolved program is exhaustive and non-overlapping", async () => {
  const { diagnostics } = await analyzeScoreProgram(resolvedProgram(), fullDomains);
  expect(byCode(diagnostics, "WRT-SCORE-GAP")).toHaveLength(0);
  expect(byCode(diagnostics, "WRT-SCORE-OVERLAP")).toHaveLength(0);
});

test("dead branch is reported as WRT-SCORE-UNREACHABLE", async () => {
  const { diagnostics } = await analyzeScoreProgram(deadRuleProgram(), {
    strong_count: [0, 1, 2, 3, 4, 5, 6],
  });
  const unreachable = byCode(diagnostics, "WRT-SCORE-UNREACHABLE");
  expect(unreachable).toHaveLength(1);
  expect(unreachable[0]!.context?.ruleId).toBe("dead");
  expect(byCode(diagnostics, "WRT-SCORE-GAP")).toHaveLength(0);
});

test("non-monotonic program yields a WRT-SCORE-MONOTONICITY counterexample", async () => {
  const { diagnostics } = await analyzeScoreProgram(nonMonotonicProgram(), smallAxisDomains, {
    monotonic: [{ variable: "strong_count" }],
  });
  const mono = byCode(diagnostics, "WRT-SCORE-MONOTONICITY");
  expect(mono).toHaveLength(1);
  const witness = mono[0]!.witness as {
    lower: { strong_count: number };
    higher: { strong_count: number };
    lowerScore: number;
    higherScore: number;
  };
  expect(witness.higher.strong_count).toBeGreaterThan(witness.lower.strong_count);
  expect(witness.higherScore).toBeLessThan(witness.lowerScore);
});

test("resolved program is monotonic in strong_count once the counteraction exception is respected", async () => {
  const { diagnostics } = await analyzeScoreProgram(resolvedProgram(), fullDomains, {
    monotonic: [{ variable: "strong_count", exceptions: { kind: "ref", path: "counter_exists" } }],
  });
  expect(byCode(diagnostics, "WRT-SCORE-MONOTONICITY")).toHaveLength(0);
});

test("analysis is deterministic across repeated runs", async () => {
  const first = await analyzeScoreProgram(literalProgram, fullDomains, {
    objectId: "AI_SME_ADOPTION",
  });
  const second = await analyzeScoreProgram(literalProgram, fullDomains, {
    objectId: "AI_SME_ADOPTION",
  });
  expect(JSON.stringify(second.diagnostics)).toBe(JSON.stringify(first.diagnostics));
});
