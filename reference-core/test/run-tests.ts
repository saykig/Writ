import {
  analyzeScoreProgram,
  evaluateScore,
  evaluateTruth,
  truth,
  truthName,
  and,
  or,
  not,
  type Expr,
  type ScoreProgram,
} from "../src";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, received ${a}`);
}

const lit = (value: unknown): Expr => ({ kind: "literal", value });
const ref = (path: string): Expr => ({ kind: "ref", path });
const cmp = (
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between",
  left: Expr,
  right: Expr,
): Expr => ({ kind: "compare", op, left, right });
const nary = (op: "and" | "or", ...operands: Expr[]): Expr => ({ kind: "nary", op, operands });
const unary = (op: "not", operand: Expr): Expr => ({ kind: "unary", op, operand });

function aiLiteralProgram(): ScoreProgram {
  return {
    rules: [
      { id: "full", priority: 10, result: "+1", when: cmp("gte", ref("strong_count"), lit(5)) },
      {
        id: "partial",
        priority: 10,
        result: "0",
        when: nary(
          "or",
          nary(
            "and",
            cmp("gte", ref("strong_count"), lit(1)),
            cmp("lte", ref("strong_count"), lit(4)),
          ),
          nary(
            "and",
            cmp("eq", ref("strong_count"), lit(0)),
            cmp("gte", ref("weak_count"), lit(3)),
            cmp("lte", ref("weak_count"), lit(4)),
          ),
        ),
      },
      {
        id: "none",
        priority: 10,
        result: "-1",
        when: nary(
          "or",
          ref("counter_exists"),
          nary(
            "and",
            cmp("eq", ref("strong_count"), lit(0)),
            cmp("lte", ref("weak_count"), lit(2)),
          ),
        ),
      },
    ],
    otherwise: { result: "unresolved", message: "Uncovered state." },
  };
}

function aiInclusiveUpToProgram(): ScoreProgram {
  return {
    rules: [
      { id: "full", priority: 10, result: "+1", when: cmp("gte", ref("strong_count"), lit(5)) },
      {
        id: "partial_inclusive",
        priority: 10,
        result: "0",
        when: nary(
          "or",
          nary(
            "and",
            cmp("gte", ref("strong_count"), lit(0)),
            cmp("lte", ref("strong_count"), lit(4)),
          ),
          nary("and", cmp("gte", ref("weak_count"), lit(3)), cmp("lte", ref("weak_count"), lit(4))),
        ),
      },
      {
        id: "none",
        priority: 10,
        result: "-1",
        when: nary(
          "or",
          ref("counter_exists"),
          nary(
            "and",
            cmp("eq", ref("strong_count"), lit(0)),
            cmp("lte", ref("weak_count"), lit(2)),
          ),
        ),
      },
    ],
    otherwise: { result: "unresolved", message: "Uncovered state." },
  };
}

function aiResolvedProgram(): ScoreProgram {
  return {
    rules: [
      { id: "counter", priority: 30, result: "-1", when: ref("counter_exists") },
      {
        id: "full",
        priority: 20,
        result: "+1",
        when: nary(
          "and",
          unary("not", ref("counter_exists")),
          cmp("gte", ref("strong_count"), lit(5)),
        ),
      },
      {
        id: "partial",
        priority: 20,
        result: "0",
        when: nary(
          "and",
          unary("not", ref("counter_exists")),
          nary(
            "or",
            nary(
              "and",
              cmp("gte", ref("strong_count"), lit(1)),
              cmp("lte", ref("strong_count"), lit(4)),
            ),
            nary(
              "and",
              cmp("eq", ref("strong_count"), lit(0)),
              cmp("gte", ref("weak_count"), lit(3)),
            ),
          ),
        ),
      },
      {
        id: "none",
        priority: 20,
        result: "-1",
        when: nary(
          "and",
          unary("not", ref("counter_exists")),
          cmp("eq", ref("strong_count"), lit(0)),
          cmp("lte", ref("weak_count"), lit(2)),
        ),
      },
    ],
    otherwise: { result: "unresolved", message: "Evidence incomplete." },
  };
}

function run(): void {
  equal(truthName(not(truth("unknown"))), "unknown", "not unknown");
  equal(truthName(not(truth("contested"))), "contested", "not contested");
  equal(truthName(and(truth("contested"), truth("true"))), "contested", "contested and true");
  equal(truthName(or(truth("contested"), truth("false"))), "contested", "contested or false");

  equal(
    truthName(evaluateTruth(cmp("gte", ref("count"), lit(5)), { count: { min: 5, max: 7 } })),
    "true",
    "interval definitely above threshold",
  );
  equal(
    truthName(evaluateTruth(cmp("gte", ref("count"), lit(5)), { count: { min: 1, max: 4 } })),
    "false",
    "interval definitely below threshold",
  );
  equal(
    truthName(evaluateTruth(cmp("gte", ref("count"), lit(5)), { count: { min: 4, max: 6 } })),
    "unknown",
    "interval crosses threshold",
  );

  const literal = aiLiteralProgram();
  const gapEvaluation = evaluateScore(literal, {
    strong_count: 0,
    weak_count: 5,
    counter_exists: false,
  });
  equal(gapEvaluation.result, "unresolved", "literal gap remains unresolved");

  const overlapEvaluation = evaluateScore(literal, {
    strong_count: 5,
    weak_count: 0,
    counter_exists: true,
  });
  equal(overlapEvaluation.result, "unresolved", "different-result overlap remains unresolved");
  assert(
    overlapEvaluation.diagnostics.some((item) => item.code === "COV-SCORE-AMBIGUOUS"),
    "expected ambiguity diagnostic",
  );

  const domains = {
    strong_count: [0, 1, 2, 3, 4, 5, 6],
    weak_count: [0, 1, 2, 3, 4, 5, 6],
    counter_exists: [false, true],
  } as const;
  const literalAnalysis = analyzeScoreProgram(literal, domains);
  const gap = literalAnalysis.diagnostics.find((item) => item.code === "COV-SCORE-GAP");
  const overlap = literalAnalysis.diagnostics.find((item) => item.code === "COV-SCORE-OVERLAP");
  assert(gap, "expected score gap");
  assert(overlap, "expected score overlap");
  equal(
    gap.witness,
    { counter_exists: false, strong_count: 0, weak_count: 5 },
    "minimal deterministic gap witness",
  );

  const inclusiveAnalysis = analyzeScoreProgram(aiInclusiveUpToProgram(), domains);
  const inclusiveOverlap = inclusiveAnalysis.diagnostics.find(
    (item) => item.code === "COV-SCORE-OVERLAP",
  );
  assert(inclusiveOverlap, "expected overlap for inclusive zero-to-four reading");
  equal(
    inclusiveOverlap.witness,
    { counter_exists: false, strong_count: 0, weak_count: 0 },
    "inclusive up-to overlap witness",
  );

  const resolved = aiResolvedProgram();
  const resolvedAnalysis = analyzeScoreProgram(resolved, domains);
  assert(
    !resolvedAnalysis.diagnostics.some((item) => item.code === "COV-SCORE-GAP"),
    "resolved program should be exhaustive",
  );
  assert(
    !resolvedAnalysis.diagnostics.some((item) => item.code === "COV-SCORE-OVERLAP"),
    "resolved program should be non-overlapping",
  );
  equal(
    evaluateScore(resolved, { strong_count: 5, weak_count: 0, counter_exists: false }).result,
    "+1",
    "resolved full compliance",
  );
  equal(
    evaluateScore(resolved, { strong_count: 0, weak_count: 6, counter_exists: false }).result,
    "0",
    "resolved many weak actions",
  );
  equal(
    evaluateScore(resolved, { strong_count: 7, weak_count: 0, counter_exists: true }).result,
    "-1",
    "counteraction precedence",
  );

  console.log(
    `ok: Covenant reference core (${literalAnalysis.assignmentsChecked} bounded assignments checked)`,
  );
}

run();
