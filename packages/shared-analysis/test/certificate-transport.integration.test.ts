import { expect, test } from "bun:test";
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  encodedBytes,
  exactJsonBytes,
  executionBytes,
  openDecisionCase,
  runDecisionCase,
  verifyEncodedBytes,
  type EncodedBytes,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import {
  assessRevision,
  attachDecisionExecution,
  certificateTransportRecordBytes,
  createCertificateTransportRecord,
  deriveReassessmentBasis,
  exportSharedAnalysis,
  importSharedAnalyses,
  openCertificateTransportRecord,
  produceCertificateTransport,
  reassessApplicability,
  recomputeAnalysis,
  recordRevision,
  replayCertificateTransportRecord,
  replaySharedAnalysis,
  type AnalysisAddress,
  type ApplicabilityAssessmentDeclaration,
  type CertificateTransportRecord,
  type LoadedSharedAnalysis,
  type LoadedCertificateTransportRecord,
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
const ZERO_SHA256 = `sha256:${"0".repeat(64)}`;

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

interface TransportRequestFixture {
  source: {
    subject: TransportSubjectFixture;
    certificate: { lower: string[]; upper: string[] };
  };
  target: { subject: TransportSubjectFixture };
}

interface TransportSubjectFixture {
  criterion: string;
  horizon: number;
  unit: string;
  nodes: Array<{
    history: string[][];
    terminal: string;
    actions: Array<{
      label: string;
      cost: string;
      outcomes: Array<{ observation: string; probability: string }>;
    }>;
  }>;
}

function mutableRecord(
  record: LoadedCertificateTransportRecord,
): Mutable<CertificateTransportRecord> {
  return structuredClone(record.value) as Mutable<CertificateTransportRecord>;
}

function decodedObject(bytes: EncodedBytes): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(verifyEncodedBytes(bytes, "test fixture"))) as Record<
    string,
    unknown
  >;
}

function corruptContent(bytes: Mutable<EncodedBytes>): void {
  const raw = Buffer.from(bytes.content, "base64");
  raw[0] = raw[0]! ^ 1;
  bytes.content = raw.toString("base64");
}

function replaceEvidenceAndStoredCheck(
  record: Mutable<CertificateTransportRecord>,
  evidence: Record<string, unknown>,
): void {
  record.evidence = encodedBytes(exactJsonBytes(evidence));
  const storedCheck = decodedObject(record.producer_check);
  storedCheck.evidence_sha256 = record.evidence.sha256.slice("sha256:".length);
  record.producer_check = encodedBytes(exactJsonBytes(storedCheck));
}

function replaceRequestAndStoredCheck(
  record: Mutable<CertificateTransportRecord>,
  request: Record<string, unknown>,
): void {
  record.request = encodedBytes(exactJsonBytes(request));
  const storedCheck = decodedObject(record.producer_check);
  storedCheck.request_sha256 = record.request.sha256.slice("sha256:".length);
  record.producer_check = encodedBytes(exactJsonBytes(storedCheck));
}

function changedRequest(mutator: (request: TransportRequestFixture) => void): Uint8Array {
  const request = JSON.parse(
    new TextDecoder().decode(transportRequest()),
  ) as TransportRequestFixture;
  mutator(request);
  return exactJsonBytes(request);
}

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

function assessedWorkspace(): LoadedSharedAnalysis {
  const workspace = revisedWorkspace();
  const analysis = { bundle_id: "alpha", analysis_id: "analysis-base" };
  return reassessApplicability(
    workspace,
    supportedAssessment(workspace, "revision.x-half-v3", analysis),
  );
}

function createValidTransportRecord(
  workspace: LoadedSharedAnalysis = assessedWorkspace(),
): LoadedCertificateTransportRecord {
  return createCertificateTransportRecord(
    workspace,
    {
      revision_id: "revision.x-half-v3",
      analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
      applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
    },
    {
      changed_request_fields: ["$.target.subject.nodes[0].actions[1].cost"],
      rationale:
        "The supported revised model basis is explicitly mapped to the changed target sequential cost declaration.",
    },
    transportRequest(),
    engineOptions,
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
    expect.objectContaining({
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
      expect.objectContaining({
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
    expect.objectContaining({
      code: "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
    }),
  );
});

test("refuses a descriptive field as the mapping for an otherwise substantive request", () => {
  const workspace = assessedWorkspace();
  expect(() =>
    createCertificateTransportRecord(
      workspace,
      {
        revision_id: "revision.x-half-v3",
        analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
        applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
      },
      {
        changed_request_fields: ["$.target.subject.name"],
        rationale: "A descriptive name must not stand in for the actual mathematical change.",
      },
      transportRequest(),
      { engineRoot: "/not-used" },
    ),
  ).toThrow(expect.objectContaining({ code: "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID" }));
});

test("refuses wrong revision, analysis, or assessment scope before invoking transport", () => {
  const workspace = assessedWorkspace();
  const modelBinding = {
    changed_request_fields: ["$.target.subject.nodes[0].actions[1].cost"],
    rationale: "The revised premise changes the target sequential cost declaration.",
  };
  for (const binding of [
    {
      revision_id: "missing-revision",
      analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
      applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
    },
    {
      revision_id: "revision.x-half-v3",
      analysis: { bundle_id: "alpha", analysis_id: "missing-analysis" },
      applicability_assessment_id: "assessment.revision.x-half-v3.alpha",
    },
    {
      revision_id: "revision.x-half-v3",
      analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
      applicability_assessment_id: "missing-assessment",
    },
  ]) {
    expect(() =>
      createCertificateTransportRecord(workspace, binding, modelBinding, transportRequest(), {
        engineRoot: "/not-used",
      }),
    ).toThrow();
  }
});

integration(
  "preserves the old result, gates stale applicability, transports a successor, and replays checker-only",
  () => {
    const analysis = { bundle_id: "alpha", analysis_id: "analysis-base" };
    const baseCase = openDecisionCase(alphaImport.case_bytes);
    const baseExecution = runDecisionCase(baseCase, "analysis-base", engineOptions);

    let workspace = importSharedAnalyses("certificate-transport-story", [alphaImport]);
    workspace = attachDecisionExecution(workspace, analysis, executionBytes(baseExecution));
    expect(verifyEncodedBytes(workspace.value.bundles[0]!.case_file, "original case")).toEqual(
      alphaImport.case_bytes,
    );
    expect(baseExecution.applicability.status).toBe("supported");
    expect(baseExecution.human_review).toEqual({ disposition: "unreviewed", reviewer: null });
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
      expect.objectContaining({
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

    const transportRecord = createValidTransportRecord(workspace);

    const recipientRoot = mkdtempSync(join(tmpdir(), "writ-certificate-transport-recipient-"));
    try {
      const checkOnlyPython = join(recipientRoot, "check-only-python");
      writeFileSync(
        checkOnlyPython,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "recipient replay attempted producer solve" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );

      const embeddedArchive = verifyEncodedBytes(
        transportRecord.value.shared_analysis,
        "embedded shared analysis",
      );
      expect(embeddedArchive).toEqual(exportSharedAnalysis(workspace));
      const sharedReplay = replaySharedAnalysis(embeddedArchive, {
        engineRoot: engineRoot!,
        pythonExecutable: checkOnlyPython,
      });
      expect(sharedReplay.freshly_checked).toHaveLength(2);
      expect(sharedReplay.freshly_checked.map(({ revision_id }) => revision_id)).toEqual([
        null,
        "revision.x-half-v3",
      ]);

      const replay = replayCertificateTransportRecord(
        certificateTransportRecordBytes(transportRecord),
        {
          engineRoot: engineRoot!,
          pythonExecutable: checkOnlyPython,
        },
      );
      expect(replay.source_certificate_bytes_preserved).toBe(true);
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

integration("refuses unsupported structural transport and exact adapter source drift", () => {
  const unsupported = [
    changedRequest((request) => {
      request.target.subject.nodes[0]!.actions.pop();
    }),
    changedRequest((request) => {
      request.target.subject.horizon = 2;
    }),
    changedRequest((request) => {
      request.target.subject.unit = "different-loss-unit";
    }),
    changedRequest((request) => {
      request.target.subject.criterion = "unsupported-criterion";
    }),
    changedRequest((request) => {
      request.target.subject.nodes[0]!.actions[0]!.outcomes = [
        { observation: "x", probability: "1" },
      ];
      request.target.subject.nodes.push({
        history: [["a", "x"]],
        terminal: "0",
        actions: [],
      });
    }),
  ];
  for (const request of unsupported) {
    expect(() => produceCertificateTransport(request, engineOptions)).toThrow(
      expect.objectContaining({ code: "SHARED_ANALYSIS_TRANSPORT_PROTOCOL_ERROR" }),
    );
  }

  const driftRoot = mkdtempSync(join(tmpdir(), "writ-certificate-transport-drift-"));
  try {
    cpSync(engineRoot!, driftRoot, { recursive: true });
    appendFileSync(
      join(driftRoot, "src", "writ_decision_lab", "transport", "checker.py"),
      "\n# deliberate source drift\n",
    );
    expect(() =>
      produceCertificateTransport(transportRequest(), {
        engineRoot: driftRoot,
        pythonExecutable: pythonExecutable!,
      }),
    ).toThrow(expect.objectContaining({ code: "SHARED_ANALYSIS_TRANSPORT_ENGINE_PIN_MISMATCH" }));
  } finally {
    rmSync(driftRoot, { recursive: true, force: true });
  }
});

integration(
  "rejects forged bindings and derives every certificate status from checker-only replay",
  () => {
    const record = createValidTransportRecord();
    const rejectionCases: Array<Mutable<CertificateTransportRecord>> = [];

    for (const field of [
      "reassessment_basis_sha256",
      "revision_impact_sha256",
      "prior_analysis_sha256",
      "target_analysis_sha256",
    ] as const) {
      const changed = mutableRecord(record);
      changed.binding[field] = ZERO_SHA256;
      rejectionCases.push(changed);
    }
    const wrongRevision = mutableRecord(record);
    wrongRevision.binding.revision_id = "missing-revision";
    rejectionCases.push(wrongRevision);
    const wrongAnalysis = mutableRecord(record);
    wrongAnalysis.binding.analysis.analysis_id = "missing-analysis";
    rejectionCases.push(wrongAnalysis);
    const wrongAssessment = mutableRecord(record);
    wrongAssessment.binding.applicability_assessment_id = "missing-assessment";
    rejectionCases.push(wrongAssessment);
    const wrongCommit = mutableRecord(record);
    (wrongCommit.decision_lab as { commit: string }).commit = "0".repeat(40);
    rejectionCases.push(wrongCommit);

    for (const changed of rejectionCases) {
      expect(() => openCertificateTransportRecord(exactJsonBytes(changed))).toThrow();
    }
    expect(() =>
      openCertificateTransportRecord(
        exactJsonBytes({ ...mutableRecord(record), authority_to_act: true }),
      ),
    ).toThrow();

    for (const field of ["request", "evidence", "producer_check"] as const) {
      const changed = mutableRecord(record);
      corruptContent(changed[field]);
      expect(() => openCertificateTransportRecord(exactJsonBytes(changed))).toThrow();
    }

    const changedSourceCertificate = mutableRecord(record);
    const changedSourceRequest = decodedObject(
      changedSourceCertificate.request,
    ) as unknown as TransportRequestFixture;
    changedSourceRequest.source.certificate.lower[0] = "2";
    replaceRequestAndStoredCheck(
      changedSourceCertificate,
      changedSourceRequest as unknown as Record<string, unknown>,
    );
    expect(() =>
      openCertificateTransportRecord(exactJsonBytes(changedSourceCertificate)),
    ).toThrow();

    const changedTargetCertificate = mutableRecord(record);
    const changedTargetEvidence = decodedObject(changedTargetCertificate.evidence);
    (changedTargetEvidence.certificate as { lower: string[] }).lower[0] = "2";
    replaceEvidenceAndStoredCheck(changedTargetCertificate, changedTargetEvidence);
    expect(() =>
      openCertificateTransportRecord(exactJsonBytes(changedTargetCertificate)),
    ).toThrow();

    const recipientRoot = mkdtempSync(join(tmpdir(), "writ-certificate-status-recipient-"));
    try {
      const checkOnlyPython = join(recipientRoot, "check-only-python");
      writeFileSync(
        checkOnlyPython,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "recipient replay attempted producer solve" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );
      const recipientOptions = { engineRoot: engineRoot!, pythonExecutable: checkOnlyPython };

      const invalidProvenance = mutableRecord(record);
      const invalidProvenanceEvidence = decodedObject(invalidProvenance.evidence);
      (invalidProvenanceEvidence.alpha as string[])[0] = "0";
      replaceEvidenceAndStoredCheck(invalidProvenance, invalidProvenanceEvidence);
      const provenanceReplay = replayCertificateTransportRecord(
        exactJsonBytes(invalidProvenance),
        recipientOptions,
      );
      expect(provenanceReplay.fresh_check_matches_producer_check).toBe(false);
      expect(provenanceReplay.source_certificate_status).toBe("checked");
      expect(provenanceReplay.target_certificate_status).toBe("checked");
      expect(provenanceReplay.transport_status).toBe("rejected");
      expect(provenanceReplay.mathematical_status).toBe("rejected");
      expect(provenanceReplay.bounds).toEqual({
        optimum_lower: "0",
        policy_upper: "1",
        regret_upper: "1",
      });

      const invalidTarget = mutableRecord(record);
      const invalidTargetEvidence = decodedObject(invalidTarget.evidence);
      (invalidTargetEvidence.certificate as { lower: string[] }).lower[0] = "2";
      invalidTarget.binding.transport_target_certificate_sha256 = sha256Bytes(
        exactJsonBytes(invalidTargetEvidence.certificate),
      );
      replaceEvidenceAndStoredCheck(invalidTarget, invalidTargetEvidence);
      const targetReplay = replayCertificateTransportRecord(
        exactJsonBytes(invalidTarget),
        recipientOptions,
      );
      expect(targetReplay.fresh_check_matches_producer_check).toBe(false);
      expect(targetReplay.source_certificate_status).toBe("not_checked");
      expect(targetReplay.target_certificate_status).toBe("rejected");
      expect(targetReplay.transport_status).toBe("not_checked");
    } finally {
      rmSync(recipientRoot, { recursive: true, force: true });
    }
  },
);

integration(
  "preserves source certificate bytes without claiming validity and freshly rejects an invalid archived source certificate",
  () => {
    const invalidSource = mutableRecord(createValidTransportRecord());
    const invalidSourceRequest = decodedObject(
      invalidSource.request,
    ) as unknown as TransportRequestFixture;
    invalidSourceRequest.source.certificate.lower[0] = "2";
    invalidSource.binding.transport_source_certificate_sha256 = sha256Bytes(
      exactJsonBytes(invalidSourceRequest.source.certificate),
    );
    replaceRequestAndStoredCheck(
      invalidSource,
      invalidSourceRequest as unknown as Record<string, unknown>,
    );

    const recipientRoot = mkdtempSync(join(tmpdir(), "writ-certificate-source-recipient-"));
    try {
      const checkOnlyPython = join(recipientRoot, "check-only-python");
      writeFileSync(
        checkOnlyPython,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "recipient replay attempted producer solve" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );
      const replay = replayCertificateTransportRecord(exactJsonBytes(invalidSource), {
        engineRoot: engineRoot!,
        pythonExecutable: checkOnlyPython,
      });

      expect(replay.source_certificate_bytes_preserved).toBe(true);
      expect("historical_source_guarantee_preserved" in replay).toBe(false);
      expect(replay.fresh_check_matches_producer_check).toBe(false);
      expect(replay.source_certificate_status).toBe("rejected");
      expect(replay.target_certificate_status).toBe("checked");
      expect(replay.transport_status).toBe("rejected");
      expect(replay.mathematical_status).toBe("rejected");
    } finally {
      rmSync(recipientRoot, { recursive: true, force: true });
    }
  },
);
