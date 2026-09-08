import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  exactJsonBytes,
  executionBytes,
  openDecisionCase,
  runDecisionCase,
} from "@writ/decision-case";

import {
  assessRevision,
  attachDecisionExecution,
  certificateTransportRecordBytes,
  createCertificateTransportRecord,
  deriveReassessmentBasis,
  exportSharedAnalysis,
  importSharedAnalyses,
  reassessApplicability,
  recomputeAnalysis,
  recordRevision,
  replayCertificateTransportRecord,
  replaySharedAnalysis,
  SharedAnalysisError,
  type AnalysisAddress,
  type ApplicabilityAssessmentDeclaration,
  type LoadedSharedAnalysis,
} from "../src/index.js";
import { alphaImport, quantitativeRevision } from "./fixtures.js";

const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const pythonExecutable = process.env.WRIT_DECISION_LAB_PYTHON;
const integrationRequired = process.env.WRIT_REQUIRE_CERTIFICATE_TRANSPORT_INTEGRATION === "1";

if (integrationRequired && (engineRoot === undefined || pythonExecutable === undefined)) {
  throw new Error(
    "Certificate-transport integration prerequisites are required: set WRIT_DECISION_LAB_ROOT and WRIT_DECISION_LAB_PYTHON.",
  );
}

const integration = engineRoot !== undefined && pythonExecutable !== undefined ? test : test.skip;
const engineOptions = { engineRoot: engineRoot!, pythonExecutable: pythonExecutable! };

function supportedAssessment(
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
      "The exact revised synthetic basis is explicitly accepted for this bounded integration test.",
    source_bindings: basis.source_bindings,
    assumption_dependencies: basis.assumption_dependencies,
  };
}

function transportRequest(change: "model" | "none" | "labels" = "model"): Uint8Array {
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
  const targetSubject =
    change === "model"
      ? {
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
        }
      : change === "labels"
        ? {
            ...sourceSubject,
            name: "renamed-target",
            premises: ["different descriptive premise label only"],
          }
        : sourceSubject;
  const selectedPolicy = { choices: [{ history: [], action: "a" }] };
  return exactJsonBytes({
    schema: "certificate-transport-request.v1",
    guarantee: "expected-additive-total-cost-regret",
    source: {
      subject: sourceSubject,
      policy: selectedPolicy,
      certificate: { lower: ["1"], upper: ["1"] },
    },
    target: { subject: targetSubject, policy: selectedPolicy },
    correspondence: [{ source_history: [], target_history: [] }],
  });
}

function revisedWorkspace(): LoadedSharedAnalysis {
  return recordRevision(
    importSharedAnalyses("certificate-transport-story", [alphaImport]),
    quantitativeRevision(),
  );
}

test("refuses transport before the shared-analysis applicability reassessment", () => {
  const workspace = revisedWorkspace();
  expect(() =>
    createCertificateTransportRecord(
      workspace,
      {
        revision_id: "revision.x-half-v3",
        analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
        applicability_assessment_id: "missing-assessment",
      },
      {
        changed_request_fields: ["$.target.subject.nodes[0].actions[1].cost"],
        rationale: "The revised premise changes the target sequential cost declaration.",
      },
      transportRequest(),
      { engineRoot: "/not-used" },
    ),
  ).toThrow(
    expect.objectContaining<Partial<SharedAnalysisError>>({
      code: "SHARED_ANALYSIS_REASSESSMENT_REQUIRED",
    }),
  );
});

test("refuses no-op and label-only transports after a supported reassessment", () => {
  let workspace = revisedWorkspace();
  const analysis = { bundle_id: "alpha", analysis_id: "analysis-base" };
  workspace = reassessApplicability(
    workspace,
    supportedAssessment(workspace, "revision.x-half-v3", analysis),
  );
  for (const request of [transportRequest("none"), transportRequest("labels")]) {
    expect(() =>
      createCertificateTransportRecord(
        workspace,
        {
          revision_id: "revision.x-half-v3",
          analysis,
          applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
        },
        {
          changed_request_fields: ["$.target.subject.name"],
          rationale: "A descriptive-only change must not count as a transported model revision.",
        },
        request,
        { engineRoot: "/not-used" },
      ),
    ).toThrow(
      expect.objectContaining<Partial<SharedAnalysisError>>({
        code: "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      }),
    );
  }
});

test("requires every declared transport field to identify an actual source/target change", () => {
  let workspace = revisedWorkspace();
  const analysis = { bundle_id: "alpha", analysis_id: "analysis-base" };
  workspace = reassessApplicability(
    workspace,
    supportedAssessment(workspace, "revision.x-half-v3", analysis),
  );
  expect(() =>
    createCertificateTransportRecord(
      workspace,
      {
        revision_id: "revision.x-half-v3",
        analysis,
        applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
      },
      {
        changed_request_fields: ["$.target.subject.nodes[0].actions[0].cost"],
        rationale: "This path is intentionally unchanged and must fail the binding check.",
      },
      transportRequest(),
      { engineRoot: "/not-used" },
    ),
  ).toThrow(
    expect.objectContaining<Partial<SharedAnalysisError>>({
      code: "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
    }),
  );
});

integration(
  "preserves the old result, gates stale applicability, transports a successor, and replays checker-only",
  () => {
    const analysis = { bundle_id: "alpha", analysis_id: "analysis-base" };
    const baseCase = openDecisionCase(alphaImport.case_bytes);
    const baseExecution = runDecisionCase(baseCase, "analysis-base", engineOptions);

    let workspace = importSharedAnalyses("certificate-transport-story", [alphaImport]);
    workspace = attachDecisionExecution(workspace, analysis, executionBytes(baseExecution));
    workspace = recordRevision(workspace, quantitativeRevision());

    const impactBefore = assessRevision(workspace, "revision.x-half-v3").impacts[0]!;
    expect(impactBefore.status).toBe("affected");
    expect(impactBefore.applicability_requires_reassessment).toBe(true);
    expect(impactBefore.successor_subject_status).toBe("changed_subject");

    expect(() =>
      createCertificateTransportRecord(
        workspace,
        {
          revision_id: "revision.x-half-v3",
          analysis,
          applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
        },
        {
          changed_request_fields: ["$.target.subject.nodes[0].actions[1].cost"],
          rationale:
            "The revised synthetic model basis changes the declared target sequential cost.",
        },
        transportRequest(),
        engineOptions,
      ),
    ).toThrow(
      expect.objectContaining<Partial<SharedAnalysisError>>({
        code: "SHARED_ANALYSIS_REASSESSMENT_REQUIRED",
      }),
    );

    workspace = reassessApplicability(
      workspace,
      supportedAssessment(workspace, "revision.x-half-v3", analysis),
    );
    const recomputed = recomputeAnalysis(
      workspace,
      {
        revision_id: "revision.x-half-v3",
        prior: analysis,
        successor_analysis_id: "analysis-base",
        applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
      },
      engineOptions,
    );
    workspace = recomputed.workspace;

    const transportRecord = createCertificateTransportRecord(
      workspace,
      {
        revision_id: "revision.x-half-v3",
        analysis,
        applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
      },
      {
        changed_request_fields: ["$.target.subject.nodes[0].actions[1].cost"],
        rationale:
          "The supported revised model basis is explicitly mapped to the changed target sequential cost declaration; Writ does not infer that mapping from prose.",
      },
      transportRequest(),
      engineOptions,
    );

    const recipientRoot = mkdtempSync(join(tmpdir(), "writ-certificate-transport-recipient-"));
    try {
      const checkOnlyPython = join(recipientRoot, "check-only-python");
      writeFileSync(
        checkOnlyPython,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "recipient replay attempted producer solve" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );

      const sharedReplay = replaySharedAnalysis(exportSharedAnalysis(workspace), {
        engineRoot: engineRoot!,
        pythonExecutable: checkOnlyPython,
      });
      expect(sharedReplay.freshly_checked).toHaveLength(2);

      const replay = replayCertificateTransportRecord(
        certificateTransportRecordBytes(transportRecord),
        {
          engineRoot: engineRoot!,
          pythonExecutable: checkOnlyPython,
        },
      );
      expect(replay.historical_source_guarantee_preserved).toBe(true);
      expect(replay.source_certificate_status).toBe("checked");
      expect(replay.source_certificate_sha256).toBe(
        transportRecord.value.binding.transport_source_certificate_sha256,
      );
      expect(replay.target_certificate_sha256).toBe(
        transportRecord.value.binding.transport_target_certificate_sha256,
      );
      expect(replay.fresh_check_matches_producer_check).toBe(true);
      expect(replay.mathematical_status).toBe("checked");
      expect(replay.target_certificate_status).toBe("checked");
      expect(replay.transport_status).toBe("checked");
      expect(replay.bounds).toEqual({
        optimum_lower: "0",
        policy_upper: "1",
        regret_upper: "1",
      });
    } finally {
      rmSync(recipientRoot, { recursive: true, force: true });
    }
  },
);
