import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executionBytes, openDecisionCase, runDecisionCase } from "@writ/decision-case";

import {
  assessRevision,
  attachDecisionExecution,
  deriveReassessmentBasis,
  exportSharedAnalysis,
  importSharedAnalyses,
  reassessApplicability,
  recomputeAnalysis,
  recordRevision,
  replaySharedAnalysis,
  type AnalysisAddress,
  type ApplicabilityAssessmentDeclaration,
  type LoadedSharedAnalysis,
} from "../src/index.js";
import {
  alphaImport,
  betaImport,
  fixture,
  quantitativeRevision,
  ROOT,
  withdrawalRevision,
} from "./fixtures.js";

const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const pythonExecutable = process.env.WRIT_DECISION_LAB_PYTHON;
const integrationRequired = process.env.WRIT_REQUIRE_SHARED_ANALYSIS_INTEGRATION === "1";

if (integrationRequired && (engineRoot === undefined || pythonExecutable === undefined)) {
  throw new Error(
    "Shared-analysis integration prerequisites are required: set WRIT_DECISION_LAB_ROOT and WRIT_DECISION_LAB_PYTHON.",
  );
}

const integration = engineRoot !== undefined && pythonExecutable !== undefined ? test : test.skip;
const options = { engineRoot: engineRoot!, pythonExecutable: pythonExecutable! };

function assessment(
  workspace: LoadedSharedAnalysis,
  revisionId: string,
  analysis: AnalysisAddress,
): ApplicabilityAssessmentDeclaration {
  const basis = deriveReassessmentBasis(workspace, revisionId, analysis);
  return {
    assessment_id: `assessment.${revisionId}.${analysis.bundle_id}`,
    revision_id: revisionId,
    analysis,
    basis_sha256: basis.basis_sha256,
    status: "supported",
    rationale:
      "The exact synthetic successor basis is explicitly declared applicable for this bounded test.",
    source_bindings: basis.source_bindings,
    assumption_dependencies: basis.assumption_dependencies,
  };
}

integration("runs, revises, recomputes, exports and freshly replays both analyses", () => {
  const alphaBase = runDecisionCase(
    openDecisionCase(alphaImport.case_bytes),
    "analysis-base",
    options,
  );
  const betaBase = runDecisionCase(
    openDecisionCase(betaImport.case_bytes),
    "analysis-base",
    options,
  );
  expect(alphaBase.mathematical_check.result).toEqual(
    expect.objectContaining({
      status: "uniformly_strictly_optimal",
      conclusion: expect.objectContaining({
        common_minimizers: ["A"],
        strictly_optimal: ["A"],
      }),
    }),
  );
  expect(betaBase.mathematical_check.result).toEqual(
    expect.objectContaining({
      status: "model_dependent",
      family_kind: "exact_family",
      conclusion: expect.objectContaining({ common_minimizers: [], strictly_optimal: [] }),
    }),
  );

  let workspace = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
  workspace = attachDecisionExecution(
    workspace,
    { bundle_id: "alpha", analysis_id: "analysis-base" },
    executionBytes(alphaBase),
  );
  expect(
    attachDecisionExecution(
      workspace,
      { bundle_id: "alpha", analysis_id: "analysis-base" },
      executionBytes(alphaBase),
    ),
  ).toBe(workspace);
  expect(() =>
    attachDecisionExecution(
      workspace,
      { bundle_id: "alpha", analysis_id: "analysis-base" },
      executionBytes(betaBase),
    ),
  ).toThrow();
  workspace = attachDecisionExecution(
    workspace,
    { bundle_id: "beta", analysis_id: "analysis-base" },
    executionBytes(betaBase),
  );
  workspace = recordRevision(workspace, quantitativeRevision());
  for (const bundleId of ["alpha", "beta"]) {
    workspace = reassessApplicability(
      workspace,
      assessment(workspace, "revision.x-half-v3", {
        bundle_id: bundleId,
        analysis_id: "analysis-base",
      }),
    );
  }
  const alpha = recomputeAnalysis(
    workspace,
    {
      revision_id: "revision.x-half-v3",
      prior: { bundle_id: "alpha", analysis_id: "analysis-base" },
      successor_analysis_id: "analysis-base",
      applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
    },
    options,
  );
  workspace = alpha.workspace;
  expect(alpha.execution.mathematical_check.result).toEqual(
    expect.objectContaining({
      status: "uniformly_strictly_optimal",
      conclusion: expect.objectContaining({ common_minimizers: ["B"], strictly_optimal: ["B"] }),
    }),
  );
  const beta = recomputeAnalysis(
    workspace,
    {
      revision_id: "revision.x-half-v3",
      prior: { bundle_id: "beta", analysis_id: "analysis-base" },
      successor_analysis_id: "analysis-base",
      applicability_assessment_id: "assessment.revision.x-half-v3.beta",
    },
    options,
  );
  workspace = beta.workspace;
  expect(beta.execution.mathematical_check.result).toEqual(
    expect.objectContaining({ status: "model_dependent", family_kind: "exact_family" }),
  );

  workspace = recordRevision(workspace, withdrawalRevision());
  workspace = reassessApplicability(
    workspace,
    assessment(workspace, "revision.alpha-withdraw-independence", {
      bundle_id: "alpha",
      analysis_id: "analysis-base",
    }),
  );
  const withdrawn = recomputeAnalysis(
    workspace,
    {
      revision_id: "revision.alpha-withdraw-independence",
      prior: { bundle_id: "alpha", analysis_id: "analysis-base" },
      successor_analysis_id: "analysis-base",
      applicability_assessment_id: "assessment.revision.alpha-withdraw-independence.alpha",
    },
    options,
  );
  workspace = withdrawn.workspace;
  expect(withdrawn.execution.mathematical_check.result.status).toBe("model_dependent");

  const quantitativeAlphaImpact = assessRevision(workspace, "revision.x-half-v3").impacts.find(
    ({ analysis }) => analysis.bundle_id === "alpha",
  )!;
  expect(quantitativeAlphaImpact.original_check_evidence).toEqual({
    status: "stored_candidate_unverified",
    execution_sha256: workspace.value.executions.find(
      ({ analysis, revision_id }) => analysis.bundle_id === "alpha" && revision_id === null,
    )!.execution.sha256,
  });
  expect(quantitativeAlphaImpact.successor_check_evidence).toEqual({
    status: "stored_candidate_unverified",
    execution_sha256: workspace.value.executions.find(
      ({ analysis, revision_id }) =>
        analysis.bundle_id === "alpha" && revision_id === "revision.x-half-v3",
    )!.execution.sha256,
  });

  const archive = exportSharedAnalysis(workspace);
  const replay = replaySharedAnalysis(archive, options);
  const expectedExecutions = [
    alphaBase,
    withdrawn.execution,
    alpha.execution,
    betaBase,
    beta.execution,
  ];
  const expectedAddresses = [
    { bundle_id: "alpha", analysis_id: "analysis-base", revision_id: null },
    {
      bundle_id: "alpha",
      analysis_id: "analysis-base",
      revision_id: "revision.alpha-withdraw-independence",
    },
    {
      bundle_id: "alpha",
      analysis_id: "analysis-base",
      revision_id: "revision.x-half-v3",
    },
    { bundle_id: "beta", analysis_id: "analysis-base", revision_id: null },
    {
      bundle_id: "beta",
      analysis_id: "analysis-base",
      revision_id: "revision.x-half-v3",
    },
  ] as const;
  expect(replay.freshly_checked).toEqual(
    expectedExecutions.map((execution, index) => ({
      analysis: {
        bundle_id: expectedAddresses[index]!.bundle_id,
        analysis_id: expectedAddresses[index]!.analysis_id,
      },
      revision_id: expectedAddresses[index]!.revision_id,
      execution_sha256: workspace.value.executions[index]!.execution.sha256,
      case_sha256: execution.case_sha256,
      analysis_sha256: execution.analysis_sha256,
      problem_sha256: execution.problem_sha256,
      query_sha256: execution.query_sha256,
      candidate_sha256: execution.candidate_result.sha256,
      mathematical_status: execution.mathematical_check.result.status,
    })),
  );

  const recipientRoot = mkdtempSync(join(tmpdir(), "writ-shared-recipient-"));
  try {
    const archivePath = join(recipientRoot, "shared-analysis.json");
    writeFileSync(archivePath, archive);
    const checkOnlyPython = join(recipientRoot, "check-only-python");
    writeFileSync(
      checkOnlyPython,
      '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "replay attempted solve" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
      { mode: 0o700 },
    );
    expect(
      replaySharedAnalysis(archive, {
        engineRoot: engineRoot!,
        pythonExecutable: checkOnlyPython,
      }).freshly_checked,
    ).toEqual(replay.freshly_checked);
    const result = Bun.spawnSync(
      [
        process.execPath,
        join(ROOT, "packages", "shared-analysis", "bin", "writ-shared-analysis.ts"),
        "replay",
        "--archive",
        archivePath,
        "--engine-root",
        engineRoot!,
        "--python",
        pythonExecutable!,
      ],
      { cwd: recipientRoot, env: process.env, stdout: "pipe", stderr: "pipe" },
    );
    expect(new TextDecoder().decode(result.stderr)).toBe("");
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(new TextDecoder().decode(result.stdout)) as {
      archive_sha256: string;
      freshly_checked: unknown[];
    };
    expect(output.archive_sha256).toBe(replay.archive_sha256);
    expect(output.freshly_checked).toHaveLength(5);
    expect(readFileSync(archivePath)).toEqual(Buffer.from(archive));
  } finally {
    rmSync(recipientRoot, { recursive: true, force: true });
  }
});

integration("retains the PR 43 interpretation controls under the pinned checker", () => {
  for (const bundle of ["alpha", "beta"] as const) {
    const caseFile = openDecisionCase(fixture(`${bundle}.case.json`));
    expect(runDecisionCase(caseFile, "control-q-b", options).mathematical_check.result.status).toBe(
      "uniformly_strictly_optimal",
    );
    expect(runDecisionCase(caseFile, "control-q-c", options).mathematical_check.result.status).toBe(
      "uniformly_strictly_optimal",
    );
    expect(
      runDecisionCase(caseFile, "control-q-conjunction", options).mathematical_check.result.status,
    ).toBe("incompatible");
  }
});
