import { expect, test } from "bun:test";
import { analyzeScoreProgram, analyzeScoreProgramByEnumeration } from "../src/index.js";
import type { FiniteDomains, MonotonicitySpec, ScoreAnalysisOptions } from "../src/index.js";
import {
  deadRuleProgram,
  fullDomains,
  inclusiveUpToProgram,
  literalProgram,
  nonMonotonicProgram,
  resolvedProgram,
  smallAxisDomains,
} from "./programs.js";
import type { ScoreProgram } from "@writ/domain";

const counterOverlapDomains: FiniteDomains = {
  strong_count: [0, 5],
  weak_count: [0, 2, 5],
  counter_exists: [false, true],
};

const cases: {
  name: string;
  program: ScoreProgram;
  domains: FiniteDomains;
  options?: ScoreAnalysisOptions;
}[] = [
  { name: "literal / full domain", program: literalProgram, domains: fullDomains },
  {
    name: "literal / counter-overlap domain",
    program: literalProgram,
    domains: counterOverlapDomains,
  },
  { name: "inclusive-up-to / full domain", program: inclusiveUpToProgram(), domains: fullDomains },
  { name: "resolved / full domain", program: resolvedProgram(), domains: fullDomains },
  {
    name: "dead-rule",
    program: deadRuleProgram(),
    domains: { strong_count: [0, 1, 2, 3, 4, 5, 6] },
  },
  {
    name: "non-monotonic",
    program: nonMonotonicProgram(),
    domains: smallAxisDomains,
    options: { monotonic: [{ variable: "strong_count" } satisfies MonotonicitySpec] },
  },
  {
    name: "resolved / monotonic with exception",
    program: resolvedProgram(),
    domains: fullDomains,
    options: {
      monotonic: [
        { variable: "strong_count", exceptions: { kind: "ref", path: "counter_exists" } },
      ],
    },
  },
];

for (const testCase of cases) {
  test(`Z3 and bounded enumeration agree: ${testCase.name}`, async () => {
    const z3 = await analyzeScoreProgram(
      testCase.program,
      testCase.domains,
      testCase.options ?? {},
    );
    const enumerated = analyzeScoreProgramByEnumeration(
      testCase.program,
      testCase.domains,
      testCase.options ?? {},
    );
    expect(JSON.stringify(z3.diagnostics)).toBe(JSON.stringify(enumerated.diagnostics));
  });
}
