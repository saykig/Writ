import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  encodedBytes,
  exactJsonBytes,
  type CaseDependency,
  type CaseSourceReference,
  type DecisionAnalysis,
  type DecisionCase,
  type ModelMapping,
} from "../../packages/decision-case/src/index.js";
import { sha256Bytes, sha256Utf8Text } from "../../packages/provenance/src/index.js";

const directory = dirname(fileURLToPath(import.meta.url));
const sourceText =
  [
    "Synthetic supplied mathematics for Writ decision-case integration.",
    "World order: (A fails, B fails) = (0,0), (0,1), (1,0), (1,1).",
    "Base A bounds: [1/5,2/5].",
    "B bounds: [1/20,1/10].",
    "Base failure penalty L=4.",
    "Revision 1 failure penalty L=10.",
    "Revision 2 A bounds: [3/5,4/5].",
    "Loss rule choose A: 1 + L * indicator(A fails).",
    "Loss rule choose B: 3 + L * indicator(B fails).",
    "Joint dependence: no independence assumption is supplied; dependence is unrestricted subject to marginals.",
    "Units: fictional cost units.",
    "All values are synthetic supplied mathematics, not estimates or causal effects from observations.",
  ].join("\n") + "\n";
const sourceBytes = new TextEncoder().encode(sourceText);
const documentHash = sha256Bytes(sourceBytes);

const referenceQuotes = {
  "ref.synthetic-status":
    "All values are synthetic supplied mathematics, not estimates or causal effects from observations.",
  "ref.states": "World order: (A fails, B fails) = (0,0), (0,1), (1,0), (1,1).",
  "ref.a-base": "Base A bounds: [1/5,2/5].",
  "ref.b": "B bounds: [1/20,1/10].",
  "ref.l4": "Base failure penalty L=4.",
  "ref.l10": "Revision 1 failure penalty L=10.",
  "ref.a-revised": "Revision 2 A bounds: [3/5,4/5].",
  "ref.loss-a": "Loss rule choose A: 1 + L * indicator(A fails).",
  "ref.loss-b": "Loss rule choose B: 3 + L * indicator(B fails).",
  "ref.dependence":
    "Joint dependence: no independence assumption is supplied; dependence is unrestricted subject to marginals.",
  "ref.unit": "Units: fictional cost units.",
} as const;

function reference(referenceId: keyof typeof referenceQuotes): CaseSourceReference {
  const quote = referenceQuotes[referenceId];
  const quoteBytes = new TextEncoder().encode(quote);
  const start = Buffer.from(sourceBytes).indexOf(Buffer.from(quoteBytes));
  if (start < 0) throw new Error(`Missing fixture quote ${referenceId}.`);
  return {
    reference_id: referenceId,
    source_id: "writ.source.synthetic-failure-choice",
    document_version_id: "synthetic-parameters.v1",
    passage_id: `writ.passage.${referenceId.slice(4)}`,
    locator: `byte:${start}-${start + quoteBytes.length}`,
    quote,
    passage_hash: sha256Utf8Text(quote),
    document_hash: documentHash,
    byte_span: { start, end: start + quoteBytes.length },
  };
}

function problem(aLower: string, aUpper: string, simultaneous = false): Uint8Array {
  const inequalities = [
    { label: "a_lower", coefficients: ["0", "0", "-1", "-1"], rhs: `-${aLower}` },
    { label: "a_upper", coefficients: ["0", "0", "1", "1"], rhs: aUpper },
    { label: "b_lower", coefficients: ["0", "-1", "0", "-1"], rhs: "-1/20" },
    { label: "b_upper", coefficients: ["0", "1", "0", "1"], rhs: "1/10" },
  ];
  if (simultaneous) {
    inequalities.push(
      { label: "a_revised_lower", coefficients: ["0", "0", "-1", "-1"], rhs: "-3/5" },
      { label: "a_revised_upper", coefficients: ["0", "0", "1", "1"], rhs: "4/5" },
    );
  }
  return exactJsonBytes({
    semantics: "finite-linear-uncertainty.v1",
    family_kind: "exact_family",
    family_label: simultaneous
      ? "simultaneous_disjoint_a_bounds"
      : `unrestricted_joint_a_${aLower}_${aUpper}`,
    states: ["A=0,B=0", "A=0,B=1", "A=1,B=0", "A=1,B=1"],
    normalization: "exact_one",
    equalities: [],
    inequalities,
  });
}

function decisionQuery(penalty: 4 | 10): Uint8Array {
  const text = String(penalty);
  return exactJsonBytes({
    semantics: "finite-linear-uncertainty.v1",
    operation: "decision",
    label: `choose_a_or_b_l_${text}`,
    actions: [
      { label: "choose_a", losses: ["1", "1", String(1 + penalty), String(1 + penalty)] },
      { label: "choose_b", losses: ["3", String(3 + penalty), "3", String(3 + penalty)] },
    ],
  });
}

const compatibilityQuery = exactJsonBytes({
  semantics: "finite-linear-uncertainty.v1",
  operation: "compatibility",
  label: "simultaneous_disjoint_a_bounds",
});

function dependencies(
  aReference: "ref.a-base" | "ref.a-revised",
  penaltyReference: "ref.l4" | "ref.l10",
  simultaneous = false,
): CaseDependency[] {
  const supplied: CaseDependency[] = [
    ["source.synthetic", "ref.synthetic-status"],
    ["source.states", "ref.states"],
    ["source.a-bounds", aReference],
    ["source.b-bounds", "ref.b"],
    ["source.penalty", penaltyReference],
    ["source.loss-a", "ref.loss-a"],
    ["source.loss-b", "ref.loss-b"],
    ["source.unit", "ref.unit"],
  ].map(([dependency_id, reference_id]) => ({
    dependency_id: dependency_id!,
    role: "source_support",
    kind: "synthetic_supplied_value",
    description: `Exact supplied fixture content for ${dependency_id}.`,
    rationale: "The source explicitly labels these values as synthetic supplied mathematics.",
    depends_on: [],
    reference_ids: [reference_id!],
  }));
  if (simultaneous) {
    supplied.push({
      dependency_id: "source.a-revised-bounds",
      role: "source_support",
      kind: "synthetic_supplied_value",
      description: "The second disjoint A-bound interval.",
      rationale: "The interpretation control jointly asserts both explicit synthetic intervals.",
      depends_on: [],
      reference_ids: ["ref.a-revised"],
    });
  }
  return [
    ...supplied,
    {
      dependency_id: "choice.exact-family",
      role: "model_construction",
      kind: "modelling_choice",
      description:
        "Treat the listed finite linear constraints as the complete mathematical family.",
      rationale: "The synthetic fixture declares no omitted original constraint.",
      depends_on: ["source.synthetic"],
      reference_ids: [],
    },
    {
      dependency_id: "choice.unrestricted-dependence",
      role: "model_construction",
      kind: "modelling_choice",
      description: "Leave A/B joint dependence unrestricted apart from the supplied marginals.",
      rationale: "No independence assumption is supplied or warranted.",
      depends_on: [],
      reference_ids: ["ref.dependence"],
    },
    {
      dependency_id: "transform.marginal-rows",
      role: "model_construction",
      kind: "deterministic_transformation",
      description:
        "Expand the A and B marginal intervals into signed finite-state inequality rows.",
      rationale:
        "Each row is the exact linear expansion of a supplied bound in the declared state order.",
      depends_on: simultaneous
        ? ["source.states", "source.a-bounds", "source.a-revised-bounds", "source.b-bounds"]
        : ["source.states", "source.a-bounds", "source.b-bounds"],
      reference_ids: [],
    },
    {
      dependency_id: "transform.loss-rows",
      role: "model_construction",
      kind: "deterministic_transformation",
      description: "Evaluate each declared loss rule at each ordered failure state.",
      rationale: "The integer loss rows follow by exact substitution of the supplied penalty.",
      depends_on: ["source.states", "source.penalty", "source.loss-a", "source.loss-b"],
      reference_ids: [],
    },
    {
      dependency_id: "subject.problem",
      role: "model_construction",
      kind: "mathematical_subject",
      description: "The exact byte-bound finite linear family supplied to the engine.",
      rationale:
        "It preserves state order, rational strings, family kind, and every constraint row.",
      depends_on: [
        "choice.exact-family",
        "choice.unrestricted-dependence",
        "transform.marginal-rows",
      ],
      reference_ids: [],
    },
    {
      dependency_id: "subject.query",
      role: "model_construction",
      kind: "mathematical_subject",
      description: simultaneous
        ? "The exact byte-bound compatibility query."
        : "The exact byte-bound static expected-loss query and fictional unit.",
      rationale: "The requested operation and all losses remain part of the mathematical subject.",
      depends_on: simultaneous
        ? ["subject.problem"]
        : ["subject.problem", "transform.loss-rows", "source.unit"],
      reference_ids: [],
    },
    {
      dependency_id: "use.checked",
      role: "checked_mathematical_use",
      kind: "checked_use",
      description:
        "A recipient may use only a fresh exact check against this problem/query subject.",
      rationale:
        "A stored status, hash, solver exit code, or check from another revision is insufficient.",
      depends_on: ["subject.problem", "subject.query"],
      reference_ids: [],
    },
  ];
}

function mappings(
  problemBytes: Uint8Array,
  operation: "decision" | "compatibility",
): ModelMapping[] {
  const parsed = JSON.parse(new TextDecoder().decode(problemBytes)) as {
    inequalities: Array<{ label: string }>;
  };
  return [
    { target: "problem.family_kind", dependency_ids: ["choice.exact-family"] },
    { target: "problem.states", dependency_ids: ["source.states"] },
    ...parsed.inequalities.map(({ label }) => ({
      target: `problem.inequalities:${label}`,
      dependency_ids: ["transform.marginal-rows"],
    })),
    { target: "query.operation", dependency_ids: ["subject.query"] },
    { target: "query.unit", dependency_ids: ["source.unit"] },
    ...(operation === "decision"
      ? [
          { target: "query.action:choose_a", dependency_ids: ["transform.loss-rows"] },
          { target: "query.action:choose_b", dependency_ids: ["transform.loss-rows"] },
        ]
      : []),
  ];
}

function analysis(
  analysisId: string,
  previousAnalysisId: string | null,
  problemBytes: Uint8Array,
  queryBytes: Uint8Array,
  aReference: "ref.a-base" | "ref.a-revised",
  penaltyReference: "ref.l4" | "ref.l10",
  changeSummary: string,
  changedDependencies: string[],
): DecisionAnalysis {
  return {
    analysis_id: analysisId,
    kind: "revision",
    previous_analysis_id: previousAnalysisId,
    question:
      "Which supplied action minimizes expected fictional cost in every compatible joint model?",
    intended_use: "static_expected_loss_decision",
    prohibited_uses: [
      "conditional_decision",
      "sequential_policy",
      "causal_effect",
      "safety_certificate",
      "authority_to_act",
    ],
    unit: "fictional_cost_unit",
    mathematical_subject: { problem: encodedBytes(problemBytes), query: encodedBytes(queryBytes) },
    dependencies: dependencies(aReference, penaltyReference),
    model_mappings: mappings(problemBytes, "decision"),
    change: { summary: changeSummary, changed_dependencies: changedDependencies },
    applicability: {
      status: "supported",
      rationale:
        "Every input is explicit synthetic supplied mathematics, a declared modelling choice, or a documented deterministic transformation.",
      changed_dependencies: [],
    },
    human_review: { disposition: "unreviewed", reviewer: null },
  };
}

const baseProblem = problem("1/5", "2/5");
const revisedProblem = problem("3/5", "4/5");
const conjunctionProblem = problem("1/5", "2/5", true);
const sourceReferences = (Object.keys(referenceQuotes) as Array<keyof typeof referenceQuotes>).map(
  reference,
);

const conjunction: DecisionAnalysis = {
  analysis_id: "control-simultaneous-a-bounds",
  kind: "interpretation_control",
  previous_analysis_id: null,
  question: "Are both disjoint A-bound intervals jointly compatible when asserted simultaneously?",
  intended_use: "compatibility_check",
  prohibited_uses: [
    "alternative_scenario_averaging",
    "conditional_decision",
    "sequential_policy",
    "causal_effect",
    "authority_to_act",
  ],
  unit: "fictional_cost_unit",
  mathematical_subject: {
    problem: encodedBytes(conjunctionProblem),
    query: encodedBytes(compatibilityQuery),
  },
  dependencies: dependencies("ref.a-base", "ref.l10", true),
  model_mappings: mappings(conjunctionProblem, "compatibility"),
  change: {
    summary: "Assert the two explicitly disjoint A-bound intervals as simultaneous constraints.",
    changed_dependencies: ["source.a-bounds", "source.a-revised-bounds", "transform.marginal-rows"],
  },
  applicability: {
    status: "supported",
    rationale:
      "This is an explicit interpretation control, not an unnoticed intersection of alternatives.",
    changed_dependencies: [],
  },
  human_review: { disposition: "unreviewed", reviewer: null },
};

const caseFile: DecisionCase = {
  schema_version: "0.1.0",
  case_id: "writ.case.synthetic-failure-choice",
  title: "Synthetic two-action failure-cost decision",
  case_kind: "derived_decision_case",
  engine: {
    adapter: "writ-decision-lab-python.v1",
    repository: "https://github.com/saykig/writ-decision-lab",
    commit: "7215b53096bc487756f94f4ca87390716a14f2ee",
    semantics: "finite-linear-uncertainty.v1",
    supported_operations: ["decision", "compatibility"],
    runtime: "CPython 3.13",
    dependency: "scipy==1.17.0",
  },
  source_documents: [
    {
      source_id: "writ.source.synthetic-failure-choice",
      document_version_id: "synthetic-parameters.v1",
      media_type: "text/plain",
      ...encodedBytes(sourceBytes),
    },
  ],
  source_references: sourceReferences,
  analyses: [
    analysis(
      "revision-0",
      null,
      baseProblem,
      decisionQuery(4),
      "ref.a-base",
      "ref.l4",
      "Initial supplied problem.",
      [],
    ),
    analysis(
      "revision-1",
      "revision-0",
      baseProblem,
      decisionQuery(10),
      "ref.a-base",
      "ref.l10",
      "Change only the supplied failure penalty from 4 to 10.",
      ["source.penalty", "transform.loss-rows", "subject.query", "use.checked"],
    ),
    analysis(
      "revision-2",
      "revision-1",
      revisedProblem,
      decisionQuery(10),
      "ref.a-revised",
      "ref.l10",
      "Replace only A's supplied failure bounds with [3/5,4/5].",
      ["source.a-bounds", "transform.marginal-rows", "subject.problem", "use.checked"],
    ),
    conjunction,
  ],
  interpretation_control: {
    alternative_scenarios: ["revision-1", "revision-2"],
    simultaneous_constraints: "control-simultaneous-a-bounds",
  },
};

mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "synthetic-failure-choice.case.json"), exactJsonBytes(caseFile));
