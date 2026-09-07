import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  encodedBytes,
  exactJsonBytes,
  type CaseDependency,
  type CaseSourceDocument,
  type CaseSourceReference,
  type DecisionAnalysis,
  type DecisionCase,
  type ModelMapping,
} from "../../../packages/decision-case/src/index.js";
import { sha256Bytes, sha256Utf8Text } from "../../../packages/provenance/src/index.js";

const directory = dirname(fileURLToPath(import.meta.url));
const ENGINE: DecisionCase["engine"] = {
  adapter: "writ-decision-lab-python.v1",
  repository: "https://github.com/saykig/writ-decision-lab",
  commit: "7215b53096bc487756f94f4ca87390716a14f2ee",
  semantics: "finite-linear-uncertainty.v1",
  supported_operations: ["compatibility", "decision"],
  runtime: "CPython 3.13",
  dependency: "scipy==1.17.0",
};

const SHARED_SOURCE_ID = "writ.source.synthetic-shared-failure-inputs";
const SHARED_V1 =
  [
    "Synthetic supplied mathematics for Writ shared-analysis revision integration.",
    "World order: (X,Y)=(0,0),(0,1),(1,0),(1,1), with 1 meaning failure.",
    "Shared marginal failure probabilities: P(X=1)=1/4 and P(Y=1)=1/4.",
    "Write q=P(X=1,Y=1), so p(q)=(1/2+q,1/4-q,1/4-q,q), with 0<=q<=1/4.",
    "Loss unit: one fictional loss unit.",
    "Loss table rows in world order:",
    "Action A: 1,1,1,17.",
    "Action B: 5/2,5/2,5/2,5/2.",
    "Action C: 1,5,5,5.",
    "All values are synthetic supplied mathematics, not estimates or causal effects from observations.",
  ].join("\n") + "\n";
const SHARED_V2_SOURCE_ONLY =
  [
    "Synthetic supplied mathematics for Writ shared-analysis revision integration.",
    "World order: (X,Y)=(0,0),(0,1),(1,0),(1,1), with 1 meaning failure.",
    "Shared marginal failure probabilities: P(X=1)=1/4 and P(Y=1)=1/4.",
    "Write q=P(X=1,Y=1), so p(q)=(1/2+q,1/4-q,1/4-q,q), with 0<=q<=1/4.",
    "Loss unit: one fictional loss unit.",
    "Loss table rows in world order:",
    "Action A: 1,1,1,17.",
    "Action B: 5/2,5/2,5/2,5/2.",
    "Action C: 1,5,5,5.",
    "All values are synthetic supplied mathematics, not empirical estimates or causal-effect claims from observations.",
  ].join("\n") + "\n";
const SHARED_V3_X_HALF =
  [
    "Synthetic supplied mathematics for Writ shared-analysis revision integration.",
    "World order: (X,Y)=(0,0),(0,1),(1,0),(1,1), with 1 meaning failure.",
    "Revised marginal failure probabilities: P(X=1)=1/2 and P(Y=1)=1/4.",
    "Write q=P(X=1,Y=1), so p(q)=(1/4+q,1/4-q,1/2-q,q), with 0<=q<=1/4.",
    "Loss unit: one fictional loss unit.",
    "Loss table rows in world order:",
    "Action A: 1,1,1,17.",
    "Action B: 5/2,5/2,5/2,5/2.",
    "Action C: 1,5,5,5.",
    "All values are synthetic supplied mathematics, not estimates or causal effects from observations.",
  ].join("\n") + "\n";
const ALPHA_CONTEXT =
  [
    "Analyst alpha modelling context.",
    "With the supplied fixed marginals, alpha assumes X and Y are independent, hence q=P(X=1,Y=1)=1/16.",
    "Sensitivity alpha-b instead assumes q is in [1/10,3/25].",
    "Sensitivity alpha-c instead assumes q is in [3/16,7/32].",
    "The primary and sensitivity dependence premises are alternatives, not simultaneous facts.",
  ].join("\n") + "\n";
const ALTERNATIVE_Y = "Synthetic alternative support: P(Y=1)=1/4.\n";

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sourceDocument(sourceId: string, versionId: string, text: string): CaseSourceDocument {
  return {
    source_id: sourceId,
    document_version_id: versionId,
    media_type: "text/plain",
    ...encodedBytes(textBytes(text)),
  };
}

function sourceReference(
  source: CaseSourceDocument,
  text: string,
  referenceId: string,
  quote: string,
): CaseSourceReference {
  const bytes = textBytes(text);
  const quoteBytes = textBytes(quote);
  const start = Buffer.from(bytes).indexOf(Buffer.from(quoteBytes));
  if (start < 0) throw new Error(`Missing quote for ${referenceId}.`);
  return {
    reference_id: referenceId,
    source_id: source.source_id,
    document_version_id: source.document_version_id,
    passage_id: `writ.passage.${referenceId.replaceAll(".", "-")}`,
    locator: `byte:${start}-${start + quoteBytes.length}`,
    quote,
    passage_hash: sha256Utf8Text(quote),
    document_hash: source.sha256,
    byte_span: { start, end: start + quoteBytes.length },
  };
}

function problem(
  familyLabel: string,
  xMarginal: "1/4" | "1/2",
  dependence:
    | { kind: "independence"; q: "1/16" | "1/8" }
    | { kind: "unrestricted" }
    | { kind: "range"; label: "b" | "c" | "both" },
): Uint8Array {
  const equalities = [
    { coefficients: ["0", "0", "1", "1"], label: "x_marginal", rhs: xMarginal },
    { coefficients: ["0", "1", "0", "1"], label: "y_marginal", rhs: "1/4" },
  ];
  const inequalities: Array<{ coefficients: string[]; label: string; rhs: string }> = [];
  if (dependence.kind === "independence") {
    equalities.push({
      coefficients: ["0", "0", "0", "1"],
      label: "q_independence",
      rhs: dependence.q,
    });
  } else if (dependence.kind === "unrestricted") {
    inequalities.push(
      { coefficients: ["0", "0", "0", "-1"], label: "q_lower", rhs: "0" },
      { coefficients: ["0", "0", "0", "1"], label: "q_upper", rhs: "1/4" },
    );
  } else {
    if (dependence.label === "b" || dependence.label === "both") {
      inequalities.push(
        { coefficients: ["0", "0", "0", "-1"], label: "q_b_lower", rhs: "-1/10" },
        { coefficients: ["0", "0", "0", "1"], label: "q_b_upper", rhs: "3/25" },
      );
    }
    if (dependence.label === "c" || dependence.label === "both") {
      inequalities.push(
        { coefficients: ["0", "0", "0", "-1"], label: "q_c_lower", rhs: "-3/16" },
        { coefficients: ["0", "0", "0", "1"], label: "q_c_upper", rhs: "7/32" },
      );
    }
  }
  return exactJsonBytes({
    equalities,
    family_kind: "exact_family",
    family_label: familyLabel,
    inequalities,
    normalization: "exact_one",
    semantics: "finite-linear-uncertainty.v1",
    states: ["X=0,Y=0", "X=0,Y=1", "X=1,Y=0", "X=1,Y=1"],
  });
}

const DECISION_QUERY = exactJsonBytes({
  actions: [
    { label: "A", losses: ["1", "1", "1", "17"] },
    { label: "B", losses: ["5/2", "5/2", "5/2", "5/2"] },
    { label: "C", losses: ["1", "5", "5", "5"] },
  ],
  label: "choose_a_b_or_c",
  operation: "decision",
  semantics: "finite-linear-uncertainty.v1",
});

const COMPATIBILITY_QUERY = exactJsonBytes({
  label: "simultaneous_disjoint_q_intervals",
  operation: "compatibility",
  semantics: "finite-linear-uncertainty.v1",
});

interface AnalysisInput {
  readonly id: string;
  readonly previous?: string | null;
  readonly problem: Uint8Array;
  readonly query: Uint8Array;
  readonly operation: "decision" | "compatibility";
  readonly choice: "independence" | "unrestricted" | "range-b" | "range-c" | "range-both";
  readonly applicability: "supported" | "needs_reassessment";
  readonly changed?: readonly string[];
}

function dependencies(
  input: AnalysisInput,
  sharedReferenceIds: readonly string[],
): CaseDependency[] {
  const sourceDependencies = [
    ["source.synthetic", "ref.synthetic-status"],
    ["source.states", "ref.states"],
    ["source.marginals", "ref.marginals"],
    ["source.parameterization", "ref.parameterization"],
    ["source.unit", "ref.unit"],
    ["source.loss-a", "ref.loss-a"],
    ["source.loss-b", "ref.loss-b"],
    ["source.loss-c", "ref.loss-c"],
  ].map(([dependency_id, reference_id]) => ({
    dependency_id: dependency_id!,
    role: "source_support" as const,
    kind: "synthetic_supplied_value" as const,
    description: `Exact supplied fixture content for ${dependency_id}.`,
    rationale: "The source explicitly marks the fixture content as synthetic supplied mathematics.",
    depends_on: [],
    reference_ids: [reference_id!],
  }));
  const choiceReference = sharedReferenceIds.includes("ref.alpha-independence")
    ? ["ref.alpha-independence"]
    : [];
  const choiceId = `choice.${input.choice}`;
  return [
    ...sourceDependencies,
    {
      dependency_id: "choice.exact-family",
      role: "model_construction",
      kind: "modelling_choice",
      description: "Treat the declared finite linear constraints as the complete model family.",
      rationale: "The fixture declares no omitted mathematical constraint.",
      depends_on: ["source.synthetic"],
      reference_ids: [],
    },
    {
      dependency_id: choiceId,
      role: "model_construction",
      kind: "modelling_choice",
      description: `The separately authored ${input.choice} dependence premise.`,
      rationale:
        input.choice === "independence"
          ? "The fixed marginals make q=PX*PY a linear constant here; no uncertain-marginal generalization is made."
          : "The dependence premise is explicit and is not inferred from shared source identity.",
      depends_on: [],
      reference_ids: input.choice === "independence" ? choiceReference : [],
    },
    {
      dependency_id: "transform.joint-family",
      role: "model_construction",
      kind: "deterministic_transformation",
      description: "Expand the supplied marginals and explicit dependence premise into exact rows.",
      rationale: "Every coefficient and rational right-hand side is supplied or derived exactly.",
      depends_on: ["source.states", "source.marginals", "source.parameterization", choiceId],
      reference_ids: [],
    },
    {
      dependency_id: "transform.loss-rows",
      role: "model_construction",
      kind: "deterministic_transformation",
      description: "Preserve the three supplied action loss rows in declared world order.",
      rationale: "No optimization result is authored by this transformation.",
      depends_on: ["source.states", "source.loss-a", "source.loss-b", "source.loss-c"],
      reference_ids: [],
    },
    {
      dependency_id: "subject.problem",
      role: "model_construction",
      kind: "mathematical_subject",
      description: "The exact byte-bound finite linear family supplied to the checker.",
      rationale: "It preserves the family, state order, rows and exact rational strings.",
      depends_on: ["choice.exact-family", "transform.joint-family"],
      reference_ids: [],
    },
    {
      dependency_id: "subject.query",
      role: "model_construction",
      kind: "mathematical_subject",
      description: "The exact byte-bound requested operation.",
      rationale: "The operation, loss unit and any action rows remain explicit.",
      depends_on:
        input.operation === "decision"
          ? ["subject.problem", "transform.loss-rows", "source.unit"]
          : ["subject.problem", "source.unit"],
      reference_ids: [],
    },
    {
      dependency_id: "use.checked",
      role: "checked_mathematical_use",
      kind: "checked_use",
      description: "A recipient may use only a fresh exact check for this subject.",
      rationale: "A stored solver status or success flag is not authoritative.",
      depends_on: ["subject.problem", "subject.query"],
      reference_ids: [],
    },
  ];
}

function mappings(input: AnalysisInput): ModelMapping[] {
  const parsed = JSON.parse(new TextDecoder().decode(input.problem)) as {
    equalities: Array<{ label: string }>;
    inequalities: Array<{ label: string }>;
  };
  return [
    { target: "problem.family_kind", dependency_ids: ["choice.exact-family"] },
    { target: "problem.states", dependency_ids: ["source.states"] },
    ...parsed.equalities.map(({ label }) => ({
      target: `problem.equalities:${label}`,
      dependency_ids: ["transform.joint-family"],
    })),
    ...parsed.inequalities.map(({ label }) => ({
      target: `problem.inequalities:${label}`,
      dependency_ids: ["transform.joint-family"],
    })),
    { target: "query.operation", dependency_ids: ["subject.query"] },
    { target: "query.unit", dependency_ids: ["source.unit"] },
    ...(input.operation === "decision"
      ? ["A", "B", "C"].map((label) => ({
          target: `query.action:${label}`,
          dependency_ids: ["transform.loss-rows"],
        }))
      : []),
  ];
}

function analysis(input: AnalysisInput, referenceIds: readonly string[]): DecisionAnalysis {
  const allDependencies = dependencies(input, referenceIds);
  const dependencyIds = new Set(allDependencies.map(({ dependency_id }) => dependency_id));
  const changed = (input.changed ?? []).filter((dependencyId) => dependencyIds.has(dependencyId));
  return {
    analysis_id: input.id,
    kind: input.id.startsWith("control-") ? "interpretation_control" : "revision",
    previous_analysis_id: input.previous ?? null,
    question:
      input.operation === "decision"
        ? "Which supplied action minimizes expected fictional loss in every joint model permitted by this analyst's declared assumptions?"
        : "Are the two explicitly alternative q-range premises jointly compatible?",
    intended_use:
      input.operation === "decision" ? "static_expected_loss_decision" : "compatibility_check",
    prohibited_uses: [
      "empirical_estimate",
      "causal_effect",
      "sequential_policy",
      "safety_certificate",
      "authority_to_act",
    ],
    unit: "fictional_loss_unit",
    mathematical_subject: {
      problem: encodedBytes(input.problem),
      query: encodedBytes(input.query),
    },
    dependencies: allDependencies,
    model_mappings: mappings(input),
    change: {
      summary:
        changed.length === 0
          ? "Initial separately authored analysis or interpretation control."
          : "Explicit successor under the supplied revision declaration.",
      changed_dependencies: changed,
    },
    applicability: {
      status: input.applicability,
      rationale:
        input.applicability === "supported"
          ? "Conditionally supported only under the supplied synthetic values and explicit modelling premises."
          : "The source, mapping or context basis changed and requires an explicit new declaration.",
      changed_dependencies: changed,
    },
    human_review: { disposition: "unreviewed", reviewer: null },
  };
}

function makeCase(
  author: "alpha" | "beta",
  sharedText: string,
  sharedVersion: string,
  baseProblem: Uint8Array,
  baseChoice: AnalysisInput["choice"],
  baseApplicability: AnalysisInput["applicability"],
  changed: readonly string[] = [],
): Uint8Array {
  const shared = sourceDocument(SHARED_SOURCE_ID, sharedVersion, sharedText);
  const sources: CaseSourceDocument[] = [shared];
  const references: CaseSourceReference[] = [];
  const quotes = {
    "ref.synthetic-status": sharedText.trimEnd().split("\n").at(-1)!,
    "ref.states": "World order: (X,Y)=(0,0),(0,1),(1,0),(1,1), with 1 meaning failure.",
    "ref.marginals": sharedText.includes("Revised marginal")
      ? "Revised marginal failure probabilities: P(X=1)=1/2 and P(Y=1)=1/4."
      : "Shared marginal failure probabilities: P(X=1)=1/4 and P(Y=1)=1/4.",
    "ref.parameterization": sharedText.includes("1/4+q")
      ? "Write q=P(X=1,Y=1), so p(q)=(1/4+q,1/4-q,1/2-q,q), with 0<=q<=1/4."
      : "Write q=P(X=1,Y=1), so p(q)=(1/2+q,1/4-q,1/4-q,q), with 0<=q<=1/4.",
    "ref.unit": "Loss unit: one fictional loss unit.",
    "ref.loss-a": "Action A: 1,1,1,17.",
    "ref.loss-b": "Action B: 5/2,5/2,5/2,5/2.",
    "ref.loss-c": "Action C: 1,5,5,5.",
  } as const;
  for (const [id, quote] of Object.entries(quotes)) {
    references.push(sourceReference(shared, sharedText, id, quote));
  }
  if (author === "alpha") {
    const context = sourceDocument(
      "writ.source.alpha-model-context",
      "alpha-model-context.v1",
      ALPHA_CONTEXT,
    );
    sources.push(context);
    references.push(
      sourceReference(
        context,
        ALPHA_CONTEXT,
        "ref.alpha-independence",
        "With the supplied fixed marginals, alpha assumes X and Y are independent, hence q=P(X=1,Y=1)=1/16.",
      ),
    );
  }
  const referenceIds = references.map(({ reference_id }) => reference_id);
  const base: AnalysisInput = {
    id: "analysis-base",
    problem: baseProblem,
    query: DECISION_QUERY,
    operation: "decision",
    choice: baseChoice,
    applicability: baseApplicability,
    changed,
  };
  const controlB: AnalysisInput = {
    id: "control-q-b",
    problem: problem(`${author}_q_b`, sharedText.includes("1/2 and") ? "1/2" : "1/4", {
      kind: "range",
      label: "b",
    }),
    query: DECISION_QUERY,
    operation: "decision",
    choice: "range-b",
    applicability: baseApplicability,
    changed,
  };
  const controlC: AnalysisInput = {
    id: "control-q-c",
    problem: problem(`${author}_q_c`, sharedText.includes("1/2 and") ? "1/2" : "1/4", {
      kind: "range",
      label: "c",
    }),
    query: DECISION_QUERY,
    operation: "decision",
    choice: "range-c",
    applicability: baseApplicability,
    changed,
  };
  const conjunction: AnalysisInput = {
    id: "control-q-conjunction",
    problem: problem(`${author}_q_conjunction`, sharedText.includes("1/2 and") ? "1/2" : "1/4", {
      kind: "range",
      label: "both",
    }),
    query: COMPATIBILITY_QUERY,
    operation: "compatibility",
    choice: "range-both",
    applicability: baseApplicability,
    changed,
  };
  const value: DecisionCase = {
    schema_version: "0.1.0",
    case_id: `writ.case.shared-analysis.${author}`,
    title: `Separately authored shared-analysis fixture: ${author}`,
    case_kind: "derived_decision_case",
    engine: ENGINE,
    source_documents: sources,
    source_references: references,
    analyses: [base, controlB, controlC, conjunction].map((item) => analysis(item, referenceIds)),
    interpretation_control: {
      alternative_scenarios: ["control-q-b", "control-q-c"],
      simultaneous_constraints: "control-q-conjunction",
    },
  };
  return exactJsonBytes(value);
}

const paths = {
  alpha: makeCase(
    "alpha",
    SHARED_V1,
    "synthetic-shared-inputs.v1",
    problem("alpha_fixed_marginals_independence", "1/4", {
      kind: "independence",
      q: "1/16",
    }),
    "independence",
    "supported",
  ),
  beta: makeCase(
    "beta",
    SHARED_V1,
    "synthetic-shared-inputs.v1",
    problem("beta_unspecified_dependence_q_0_1_4", "1/4", { kind: "unrestricted" }),
    "unrestricted",
    "supported",
  ),
  alphaSourceOnly: makeCase(
    "alpha",
    SHARED_V2_SOURCE_ONLY,
    "synthetic-shared-inputs.v2-source-only",
    problem("alpha_fixed_marginals_independence", "1/4", {
      kind: "independence",
      q: "1/16",
    }),
    "independence",
    "needs_reassessment",
    ["source.synthetic"],
  ),
  betaSourceOnly: makeCase(
    "beta",
    SHARED_V2_SOURCE_ONLY,
    "synthetic-shared-inputs.v2-source-only",
    problem("beta_unspecified_dependence_q_0_1_4", "1/4", { kind: "unrestricted" }),
    "unrestricted",
    "needs_reassessment",
    ["source.synthetic"],
  ),
  alphaQuantitative: makeCase(
    "alpha",
    SHARED_V3_X_HALF,
    "synthetic-shared-inputs.v3-x-half",
    problem("alpha_revised_x_half_independence", "1/2", { kind: "independence", q: "1/8" }),
    "independence",
    "needs_reassessment",
    ["source.marginals", "source.parameterization", "transform.joint-family", "subject.problem"],
  ),
  betaQuantitative: makeCase(
    "beta",
    SHARED_V3_X_HALF,
    "synthetic-shared-inputs.v3-x-half",
    problem("beta_unspecified_dependence_x_1_2_y_1_4", "1/2", { kind: "unrestricted" }),
    "unrestricted",
    "needs_reassessment",
    ["source.marginals", "source.parameterization", "transform.joint-family", "subject.problem"],
  ),
  alphaWithdrawal: makeCase(
    "alpha",
    SHARED_V3_X_HALF,
    "synthetic-shared-inputs.v3-x-half",
    problem("fixed_marginals_x_1_2_y_1_4_unspecified_dependence", "1/2", {
      kind: "unrestricted",
    }),
    "unrestricted",
    "needs_reassessment",
    ["choice.unrestricted", "transform.joint-family", "subject.problem"],
  ),
};

const outputs: Readonly<Record<string, Uint8Array>> = {
  "alpha.case.json": paths.alpha,
  "beta.case.json": paths.beta,
  "revisions/source-only/alpha.case.json": paths.alphaSourceOnly,
  "revisions/source-only/beta.case.json": paths.betaSourceOnly,
  "revisions/quantitative/alpha.case.json": paths.alphaQuantitative,
  "revisions/quantitative/beta.case.json": paths.betaQuantitative,
  "revisions/independence-withdrawn/alpha.case.json": paths.alphaWithdrawal,
  "sources/shared-v1.txt": textBytes(SHARED_V1),
  "sources/shared-v2-source-only.txt": textBytes(SHARED_V2_SOURCE_ONLY),
  "sources/shared-v3-x-half.txt": textBytes(SHARED_V3_X_HALF),
  "sources/alpha-context-v1.txt": textBytes(ALPHA_CONTEXT),
  "sources/alternative-y-v1.txt": textBytes(ALTERNATIVE_Y),
};

for (const [relativePath, bytes] of Object.entries(outputs)) {
  const target = join(directory, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}

writeFileSync(
  join(directory, "fixture-hashes.json"),
  exactJsonBytes(
    Object.fromEntries(
      Object.entries(outputs).map(([relativePath, bytes]) => [relativePath, sha256Bytes(bytes)]),
    ),
  ),
);
