import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  encodedBytes,
  exactJsonBytes,
  executionBytes,
  openDecisionCase,
  runDecisionCase,
  type CaseSourceDocument,
} from "../../../packages/decision-case/src/index.js";
import {
  assessRevision,
  attachDecisionExecution,
  certificateTransportRecordBytes,
  createCertificateTransportRecord,
  createDecisionEpisode,
  decisionEpisodeBytes,
  deriveReassessmentBasis,
  importSharedAnalyses,
  reassessApplicability,
  recomputeAnalysis,
  recordRevision,
  type ApplicabilityAssessmentDeclaration,
  type BundleImport,
  type TransportEngineOptions,
  type LoadedDecisionEpisode,
  type RevisionDeclaration,
  type SourceIdentity,
} from "../../../packages/shared-analysis/src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SHARED_FIXTURE = join(ROOT, "examples", "decision-cases", "shared-analysis-revision");
const EPISODE_FIXTURE = join(ROOT, "examples", "decision-cases", "decision-episode");

const V1_SOURCE: SourceIdentity = {
  source_id: "writ.source.synthetic-shared-failure-inputs",
  document_version_id: "synthetic-shared-inputs.v1",
  sha256: "sha256:302fc7940f0c2e4e744320abdb76c52b7cba20c9aad6edbefdd316e225b796fa",
};

function file(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(join(SHARED_FIXTURE, relativePath)));
}

function localFile(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(join(EPISODE_FIXTURE, relativePath)));
}

function alphaImport(): BundleImport {
  return {
    bundle_id: "alpha",
    case_bytes: file("alpha.case.json"),
    selected_analysis_ids: ["analysis-base"],
    inventory: {
      scope: "synthetic shared failure decision",
      completeness: "complete",
      unresolved_references: [],
      support_routes: [],
    },
  };
}

function quantitativeRevision(): RevisionDeclaration {
  const nextSource: CaseSourceDocument = {
    source_id: "writ.source.synthetic-shared-failure-inputs",
    document_version_id: "synthetic-shared-inputs.v3-x-half",
    media_type: "text/plain",
    ...encodedBytes(file("sources/shared-v3-x-half.txt")),
  };
  return {
    revision_id: "revision.x-half-v3",
    kind: "source_revision",
    summary: "Explicitly replace X=1/4 with X=1/2 while retaining Y=1/4 and the loss rows.",
    source_replacements: [{ from: V1_SOURCE, to: nextSource }],
    withdrawn_sources: [],
    withdrawn_dependencies: [],
    withdrawn_routes: [],
    conflicting_premises: [],
    transitions: [
      {
        prior: { bundle_id: "alpha", analysis_id: "analysis-base" },
        successor_case: encodedBytes(file("revisions/quantitative/alpha.case.json")),
        successor_analysis_id: "analysis-base",
      },
    ],
  };
}

function transportRequest(): Uint8Array {
  const sourceSubject = {
    name: "transport-source",
    semantics: "finite-observable-history.v1",
    criterion: "expected-additive-total-cost",
    horizon: 1,
    unit: "loss",
    premises: ["supplied source model"],
    nodes: [
      {
        history: [],
        terminal: "0",
        actions: [
          { label: "a", cost: "1", outcomes: [] },
          { label: "b", cost: "2", outcomes: [] },
        ],
      },
    ],
  };
  return exactJsonBytes({
    schema: "certificate-transport-request.v1",
    guarantee: "expected-additive-total-cost-regret",
    source: {
      subject: sourceSubject,
      policy: { choices: [{ history: [], action: "a" }] },
      certificate: { lower: ["1"], upper: ["1"] },
    },
    target: {
      subject: {
        ...sourceSubject,
        name: "transport-target",
        premises: ["explicitly revised target model"],
        nodes: [
          {
            history: [],
            terminal: "0",
            actions: [
              { label: "a", cost: "1", outcomes: [] },
              { label: "b", cost: "0", outcomes: [] },
            ],
          },
        ],
      },
      policy: { choices: [{ history: [], action: "a" }] },
    },
    correspondence: [{ source_history: [], target_history: [] }],
  });
}

export function buildDecisionEpisodeStory(
  options: TransportEngineOptions,
): LoadedDecisionEpisode {
  const analysis = { bundle_id: "alpha", analysis_id: "analysis-base" };
  const originalCase = openDecisionCase(alphaImport().case_bytes);
  const originalExecution = runDecisionCase(originalCase, analysis.analysis_id, options);
  let workspace = importSharedAnalyses("synthetic-decision-episode", [alphaImport()]);
  workspace = attachDecisionExecution(workspace, analysis, executionBytes(originalExecution));
  workspace = recordRevision(workspace, quantitativeRevision());
  const staleImpact = assessRevision(workspace, "revision.x-half-v3").impacts[0];
  if (
    staleImpact?.status !== "affected" ||
    staleImpact.applicability_requires_reassessment !== true ||
    staleImpact.successor_subject_status !== "changed_subject"
  ) {
    throw new Error("The episode fixture did not reach the required stale-applicability state.");
  }
  const basis = deriveReassessmentBasis(workspace, "revision.x-half-v3", analysis);
  const assessment: ApplicabilityAssessmentDeclaration = {
    assessment_id: "assessment.revision.x-half-v3.alpha",
    revision_id: "revision.x-half-v3",
    analysis,
    basis_sha256: basis.basis_sha256,
    status: "supported",
    rationale:
      "The exact revised synthetic basis is explicitly accepted as applicable for this bounded episode.",
    source_bindings: basis.source_bindings,
    assumption_dependencies: basis.assumption_dependencies,
  };
  workspace = reassessApplicability(workspace, assessment);
  workspace = recomputeAnalysis(
    workspace,
    {
      revision_id: "revision.x-half-v3",
      prior: analysis,
      successor_analysis_id: "analysis-base",
      applicability_assessment_id: assessment.assessment_id,
    },
    options,
  ).workspace;
  const transport = createCertificateTransportRecord(
    workspace,
    {
      revision_id: "revision.x-half-v3",
      analysis,
      applicability_assessment_id: assessment.assessment_id,
    },
    {
      changed_request_fields: ["$.target.subject.nodes[0].actions[1].cost"],
      rationale:
        "A reviewed modelling premise maps the revised basis to this exact changed transport-request cost; Writ does not infer its empirical truth.",
    },
    transportRequest(),
    options,
  );
  return createDecisionEpisode(certificateTransportRecordBytes(transport), {
    episode_id: "decision-episode.synthetic-failure-choice.v1",
    authority_basis: {
      authority_basis_id: "authority.synthetic-failure-review-board.v1",
      authority_holder: {
        actor_type: "institution",
        actor_id: "synthetic.failure-review-board",
      },
      basis_statement:
        "The supplied synthetic charter assigns this exercise decision to the Failure Review Board.",
      artifact: encodedBytes(localFile("authority-basis.txt")),
      verification_status: "supplied_not_verified_by_writ",
    },
    human_decision: {
      decision_id: "decision.synthetic-failure-choice.v1",
      decided_by: {
        actor_type: "institution",
        actor_id: "synthetic.failure-review-board",
      },
      decided_at: "2026-09-08T12:00:00Z",
      selected_action: "A",
      rationale:
        "The board explicitly selected A after considering the checked successor and transported certificate; mathematical status did not make the decision.",
      authority_basis_id: "authority.synthetic-failure-review-board.v1",
      mathematical_role: "considered_not_authorizing",
    },
    implementation: {
      implementation_id: "implementation.synthetic-failure-choice.v1",
      decision_id: "decision.synthetic-failure-choice.v1",
      implemented_by: {
        actor_type: "institution",
        actor_id: "synthetic.failure-review-board",
      },
      implemented_at: "2026-09-08T13:00:00Z",
      implemented_action: "A",
      description: "The supplied implementation record says action A was implemented.",
      record: encodedBytes(localFile("implementation-record.txt")),
    },
    observation: {
      observation_id: "observation.synthetic-loss.v1",
      implementation_id: "implementation.synthetic-failure-choice.v1",
      observed_by: { actor_type: "human", actor_id: "synthetic.observer" },
      observed_at: "2026-09-09T12:00:00Z",
      description:
        "A supplied follow-up record reports an observed loss of 1 unit after implementation.",
      record: encodedBytes(localFile("observation-record.txt")),
    },
    interpretations: [],
    reconsideration: {
      reconsideration_id: "reconsideration.synthetic-failure-choice.v1",
      observation_id: "observation.synthetic-loss.v1",
      declared_by: {
        actor_type: "institution",
        actor_id: "synthetic.failure-review-board",
      },
      declared_at: "2026-09-10T12:00:00Z",
      status: "reconsideration_required",
      rationale:
        "The board explicitly requests reconsideration after the observation without asserting causality, correctness, or a model update.",
      interpretation_ids: [],
      model_effect: "none_automatic",
      next_step: "human_review",
    },
  });
}

function option(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === undefined || value.startsWith("--")) throw new Error(`Missing ${name}.`);
  return value;
}

function main(args: readonly string[]): void {
  const output = option(args, "--out");
  if (existsSync(output)) throw new Error(`Refusing to overwrite ${output}.`);
  const engineRoot = option(args, "--engine-root");
  const pythonIndex = args.indexOf("--python");
  const pythonExecutable = pythonIndex >= 0 ? option(args, "--python") : undefined;
  const episode = buildDecisionEpisodeStory(
    pythonExecutable === undefined ? { engineRoot } : { engineRoot, pythonExecutable },
  );
  writeFileSync(output, decisionEpisodeBytes(episode), { flag: "wx" });
  console.log(JSON.stringify({ episode_sha256: episode.episode_sha256, output }));
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
