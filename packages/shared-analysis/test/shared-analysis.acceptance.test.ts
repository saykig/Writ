import { describe, expect, test } from "bun:test";

import { exactJsonBytes } from "@writ/decision-case";

import {
  assessRevision,
  deriveReassessmentBasis,
  exportSharedAnalysis,
  importSharedAnalyses,
  inspectSharedAnalyses,
  openSharedAnalysis,
  reassessApplicability,
  recordRevision,
  SharedAnalysisError,
} from "../src/index.js";
import {
  alphaImport,
  betaImport,
  conflictingCaseBytes,
  partialImport,
  quantitativeRevision,
  sourceOnlyRevision,
  unaffectedImport,
  V1_SOURCE,
  withdrawalRevision,
} from "./fixtures.js";

function expectCode(action: () => unknown, code: SharedAnalysisError["code"]): void {
  try {
    action();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(SharedAnalysisError);
    expect((error as SharedAnalysisError).code).toBe(code);
  }
}

describe("shared-analysis behavioral contract", () => {
  test("imports separately authored cases with scoped local IDs and explicit disagreement", () => {
    const workspace = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
    const inspection = inspectSharedAnalyses(workspace);
    expect(inspection.analyses).toEqual([
      { bundle_id: "alpha", analysis_id: "analysis-base" },
      { bundle_id: "beta", analysis_id: "analysis-base" },
    ]);
    expect(inspection.shared_sources).toEqual([
      { identity: V1_SOURCE, bundles: ["alpha", "beta"] },
    ]);
    expect(inspection.differences).toEqual([
      expect.objectContaining({
        left: { bundle_id: "alpha", analysis_id: "analysis-base" },
        right: { bundle_id: "beta", analysis_id: "analysis-base" },
        status: "different_models",
        mathematical_subject_equal: false,
        distinct_assumptions: [
          {
            bundle_id: "alpha",
            analysis_id: "analysis-base",
            dependency_id: "choice.independence",
          },
          {
            bundle_id: "beta",
            analysis_id: "analysis-base",
            dependency_id: "choice.unrestricted",
          },
        ],
      }),
    ]);
  });

  test("is deterministic across import order and idempotent for exact repeat imports", () => {
    const forward = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
    const reverse = importSharedAnalyses("synthetic-shared-revision", [betaImport, alphaImport]);
    const repeated = importSharedAnalyses("synthetic-shared-revision", [
      alphaImport,
      betaImport,
      betaImport,
    ]);
    expect(exportSharedAnalysis(reverse)).toEqual(exportSharedAnalysis(forward));
    expect(exportSharedAnalysis(repeated)).toEqual(exportSharedAnalysis(forward));
    expect(openSharedAnalysis(exportSharedAnalysis(forward)).archive_sha256).toBe(
      forward.archive_sha256,
    );
  });

  test("fails closed on bundle conflicts and authoritative source/version byte conflicts", () => {
    expectCode(
      () =>
        importSharedAnalyses("synthetic-shared-revision", [
          alphaImport,
          { ...alphaImport, case_bytes: betaImport.case_bytes },
        ]),
      "SHARED_ANALYSIS_BUNDLE_CONFLICT",
    );
    expectCode(
      () =>
        importSharedAnalyses("synthetic-shared-revision", [
          alphaImport,
          { ...betaImport, case_bytes: conflictingCaseBytes() },
        ]),
      "SHARED_ANALYSIS_SOURCE_CONFLICT",
    );
  });

  test("distinguishes source-only applicability reassessment from recomputation", () => {
    const initial = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
    const revised = recordRevision(initial, sourceOnlyRevision());
    const impact = assessRevision(revised, "revision.source-only-v2");
    expect(impact.impacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
          status: "affected",
          original_check_evidence: { status: "absent", execution_sha256: null },
          successor_subject_status: "identical_subject",
          applicability_requires_reassessment: true,
        }),
        expect.objectContaining({
          analysis: { bundle_id: "beta", analysis_id: "analysis-base" },
          status: "affected",
          original_check_evidence: { status: "absent", execution_sha256: null },
          successor_subject_status: "identical_subject",
          applicability_requires_reassessment: true,
        }),
      ]),
    );
    const basis = deriveReassessmentBasis(revised, impact.revision_id, {
      bundle_id: "alpha",
      analysis_id: "analysis-base",
    });
    const assessment = {
      assessment_id: "assessment.alpha.source-only-v2",
      revision_id: impact.revision_id,
      analysis: { bundle_id: "alpha", analysis_id: "analysis-base" },
      basis_sha256: basis.basis_sha256,
      status: "supported" as const,
      rationale:
        "The supplied synthetic values remain applicable under the explicitly rebound v2 source.",
      source_bindings: basis.source_bindings,
      assumption_dependencies: basis.assumption_dependencies,
    };
    expectCode(
      () => reassessApplicability(revised, { ...assessment, source_bindings: [] }),
      "SHARED_ANALYSIS_REASSESSMENT_STALE",
    );
    expectCode(
      () =>
        reassessApplicability(revised, {
          ...assessment,
          source_bindings: [
            {
              source_id: "writ.source.not-supplied",
              document_version_id: "not-supplied.v1",
              sha256: `sha256:${"0".repeat(64)}`,
            },
          ],
        }),
      "SHARED_ANALYSIS_REFERENCE_UNRESOLVED",
    );
    const reassessed = reassessApplicability(revised, assessment);
    expect(reassessed.value.applicability_assessments).toContainEqual(assessment);
    expectCode(
      () =>
        reassessApplicability(revised, { ...assessment, basis_sha256: `sha256:${"0".repeat(64)}` }),
      "SHARED_ANALYSIS_REASSESSMENT_STALE",
    );
  });

  test("traces quantitative source effects without treating unchanged query bytes as a fresh result", () => {
    const initial = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
    const revised = recordRevision(initial, quantitativeRevision());
    const impact = assessRevision(revised, "revision.x-half-v3");
    for (const item of impact.impacts) {
      expect(item.status).toBe("affected");
      expect(item.original_check_evidence).toEqual({ status: "absent", execution_sha256: null });
      expect(item.successor_subject_status).toBe("changed_subject");
      expect(item.applicability_requires_reassessment).toBe(true);
      expect(item.direct_dependencies).toContain("source.marginals");
      expect(item.derivation_paths.some(({ nodes }) => nodes.includes("subject.problem"))).toBe(
        true,
      );
    }
  });

  test("withdraws alpha independence without rewriting its earlier conditional result", () => {
    const initial = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
    const revised = recordRevision(initial, withdrawalRevision());
    const impact = assessRevision(revised, "revision.alpha-withdraw-independence");
    const alpha = impact.impacts.find(({ analysis }) => analysis.bundle_id === "alpha")!;
    const beta = impact.impacts.find(({ analysis }) => analysis.bundle_id === "beta")!;
    expect(alpha).toEqual(
      expect.objectContaining({
        status: "affected",
        original_check_evidence: { status: "absent", execution_sha256: null },
        successor_subject_status: "changed_subject",
        applicability_requires_reassessment: true,
      }),
    );
    expect(alpha.direct_dependencies).toContain("choice.independence");
    expect(beta.status).toBe("unaffected");
  });

  test("keeps complete alternative routes disjunctive and conflicting premises visible", () => {
    const initial = importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]);
    const oneWithdrawn = recordRevision(initial, {
      revision_id: "revision.route-one-withdrawn",
      kind: "source_withdrawal",
      summary: "Withdraw only the shared-source route for the scoped Y marginal statement.",
      source_replacements: [],
      withdrawn_sources: [V1_SOURCE],
      withdrawn_dependencies: [],
      withdrawn_routes: [{ bundle_id: "beta", route_id: "route-y-shared" }],
      conflicting_premises: [
        {
          statement_id: "statement.y-quarter",
          statement_scope: "synthetic shared failure decision",
          description: "A separately supplied conflicting premise states P(Y=1)=1/3.",
          source: {
            source_id: "writ.source.synthetic-y-conflict",
            document_version_id: "synthetic-y-conflict.v1",
            sha256: `sha256:${"1".repeat(64)}`,
          },
        },
      ],
      transitions: [],
    });
    const impact = assessRevision(oneWithdrawn, "revision.route-one-withdrawn");
    const beta = impact.impacts.find(({ analysis }) => analysis.bundle_id === "beta")!;
    expect(beta.surviving_support_routes).toEqual([
      {
        bundle_id: "beta",
        route_id: "route-y-alternative",
        statement_id: "statement.y-quarter",
        statement_scope: "synthetic shared failure decision",
      },
    ]);
    expect(beta.withdrawn_support_routes).toEqual([
      {
        bundle_id: "beta",
        route_id: "route-y-shared",
        statement_id: "statement.y-quarter",
        statement_scope: "synthetic shared failure decision",
      },
    ]);
    expect(beta.visible_conflicts).toHaveLength(1);
    expect(beta.applicability_requires_reassessment).toBe(true);

    const bothWithdrawn = recordRevision(initial, {
      ...oneWithdrawn.value.revisions[0]!,
      revision_id: "revision.both-routes-withdrawn",
      withdrawn_sources: [
        V1_SOURCE,
        {
          source_id: "writ.source.synthetic-y-route-2",
          document_version_id: "synthetic-y-route-2.v1",
          sha256: "sha256:608f3918ec2ef93a371aea85d3be0b0a29a66617af4e879ffefa5be515123271",
        },
      ],
      withdrawn_routes: [
        { bundle_id: "beta", route_id: "route-y-shared" },
        { bundle_id: "beta", route_id: "route-y-alternative" },
      ],
    });
    const noRoute = assessRevision(bothWithdrawn, "revision.both-routes-withdrawn").impacts.find(
      ({ analysis }) => analysis.bundle_id === "beta",
    )!;
    expect(noRoute.surviving_support_routes).toEqual([]);
    expect(noRoute.applicability_requires_reassessment).toBe(true);
  });

  test("claims unaffected only for a complete supplied inventory", () => {
    const initial = importSharedAnalyses("synthetic-shared-revision", [
      alphaImport,
      unaffectedImport,
      partialImport,
    ]);
    const impact = assessRevision(
      recordRevision(initial, sourceOnlyRevision()),
      "revision.source-only-v2",
    );
    expect(impact.impacts.find(({ analysis }) => analysis.bundle_id === "unaffected")).toEqual(
      expect.objectContaining({ status: "unaffected", unresolved_references: [] }),
    );
    expect(impact.impacts.find(({ analysis }) => analysis.bundle_id === "partial")).toEqual(
      expect.objectContaining({
        status: "not_established",
        unresolved_references: ["external:omitted-ancestry"],
      }),
    );
  });

  test("metadata changes do not become changed theorems", () => {
    const initial = importSharedAnalyses("synthetic-shared-revision", [alphaImport]);
    const revised = recordRevision(initial, {
      revision_id: "revision.display-title",
      kind: "metadata_change",
      summary: "Change a display title only.",
      source_replacements: [],
      withdrawn_sources: [],
      withdrawn_dependencies: [],
      withdrawn_routes: [],
      conflicting_premises: [],
      transitions: [],
    });
    const impact = assessRevision(revised, "revision.display-title").impacts[0]!;
    expect(impact).toEqual(
      expect.objectContaining({
        status: "unaffected",
        successor_subject_status: "not_applicable",
        applicability_requires_reassessment: false,
      }),
    );
  });

  test("the portable archive is exact JSON and contains no derived cache authority", () => {
    const workspace = recordRevision(
      importSharedAnalyses("synthetic-shared-revision", [alphaImport, betaImport]),
      quantitativeRevision(),
    );
    const raw = exportSharedAnalysis(workspace);
    expect(raw).toEqual(exactJsonBytes(workspace.value));
    const json = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
    expect(json).not.toHaveProperty("graph");
    expect(json).not.toHaveProperty("revision_impacts");
    expect(json).not.toHaveProperty("shared_sources");

    expectCode(
      () => openSharedAnalysis(new TextEncoder().encode(`${new TextDecoder().decode(raw)}\n`)),
      "SHARED_ANALYSIS_INVALID",
    );
    expectCode(
      () => openSharedAnalysis(exactJsonBytes({ ...workspace.value, unexpected: true })),
      "SHARED_ANALYSIS_INVALID",
    );
    expectCode(
      () =>
        inspectSharedAnalyses({
          ...workspace,
          archive_sha256: `sha256:${"0".repeat(64)}`,
        }),
      "SHARED_ANALYSIS_INVALID",
    );
  });
});
