import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { exactJsonBytes, type DecisionCase } from "@writ/decision-case";

import {
  assessRevision,
  attachDecisionExecution,
  deriveReassessmentBasis,
  exportSharedAnalysis,
  importSharedAnalyses,
  inspectSharedAnalyses,
  openSharedAnalysis,
  reassessApplicability,
  recordRevision,
  SharedAnalysisError,
  type AnalysisAddress,
  type BundleImport,
  type LoadedSharedAnalysis,
  type RevisionDeclaration,
} from "../src/index.js";
import {
  alphaImport,
  betaImport,
  ROOT,
  sourceOnlyRevision,
  unaffectedImport,
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

function caseValue(input: BundleImport): DecisionCase {
  return JSON.parse(new TextDecoder().decode(input.case_bytes)) as DecisionCase;
}

function changedCase(input: BundleImport, update: (value: DecisionCase) => void): BundleImport {
  const value = caseValue(input);
  update(value);
  return { ...input, case_bytes: exactJsonBytes(value) };
}

function withoutTransition(revisionId: string): RevisionDeclaration {
  return {
    ...sourceOnlyRevision(),
    revision_id: revisionId,
    transitions: [],
  };
}

function supportedAssessment(
  workspace: LoadedSharedAnalysis,
  revisionId: string,
  analysis: AnalysisAddress,
) {
  const basis = deriveReassessmentBasis(workspace, revisionId, analysis);
  return {
    assessment_id: `assessment.${revisionId}.${analysis.bundle_id}`,
    revision_id: revisionId,
    analysis,
    basis_sha256: basis.basis_sha256,
    status: "supported" as const,
    rationale: "The reviewer explicitly accepts this exact bounded basis for the test.",
    source_bindings: basis.source_bindings,
    assumption_dependencies: basis.assumption_dependencies,
  };
}

describe("shared-analysis semantic hardening", () => {
  test("derives reassessment identity from mappings, context and assumption contents", () => {
    const address = { bundle_id: "alpha", analysis_id: "analysis-base" };
    const revision = withoutTransition("revision.source-only-without-successor");
    const original = recordRevision(importSharedAnalyses("one", [alphaImport]), revision);
    const originalBasis = deriveReassessmentBasis(original, revision.revision_id, address);
    const originalAssessment = supportedAssessment(original, revision.revision_id, address);
    expect(
      reassessApplicability(original, originalAssessment).value.applicability_assessments,
    ).toEqual([originalAssessment]);

    const mappingChanged = changedCase(alphaImport, (value) => {
      const mapping = value.analyses[0]!.model_mappings.find(
        ({ target }) => target === "problem.family_kind",
      )!;
      (mapping as unknown as { dependency_ids: string[] }).dependency_ids = ["source.synthetic"];
    });
    const unitChanged = changedCase(alphaImport, (value) => {
      (value.analyses[0] as { unit: string }).unit = "different_declared_loss_unit";
    });
    const assumptionChanged = changedCase(alphaImport, (value) => {
      const assumption = value.analyses[0]!.dependencies.find(
        ({ dependency_id }) => dependency_id === "choice.independence",
      )!;
      (assumption as { rationale: string }).rationale =
        "A substantively different declared rationale under the same local identifier.";
    });

    for (const changed of [mappingChanged, unitChanged, assumptionChanged]) {
      const workspace = recordRevision(importSharedAnalyses("one", [changed]), revision);
      const basis = deriveReassessmentBasis(workspace, revision.revision_id, address);
      expect(basis.basis_sha256).not.toBe(originalBasis.basis_sha256);
      expectCode(
        () => reassessApplicability(workspace, originalAssessment),
        "SHARED_ANALYSIS_REASSESSMENT_STALE",
      );
      expect(
        reassessApplicability(
          workspace,
          supportedAssessment(workspace, revision.revision_id, address),
        ).value.applicability_assessments,
      ).toHaveLength(1);
    }
  });

  test("excludes display, workspace and unrelated bundle content from the scoped basis", () => {
    const address = { bundle_id: "alpha", analysis_id: "analysis-base" };
    const revision = withoutTransition("revision.scoped-basis");
    const original = recordRevision(importSharedAnalyses("one", [alphaImport]), revision);
    const displayChanged = changedCase(alphaImport, (value) => {
      (value as { title: string }).title = "A different display title";
    });
    const displayWorkspace = recordRevision(
      importSharedAnalyses("different-workspace-label", [displayChanged]),
      revision,
    );
    const unrelatedWorkspace = recordRevision(
      importSharedAnalyses("one", [alphaImport, unaffectedImport]),
      revision,
    );
    const expected = deriveReassessmentBasis(original, revision.revision_id, address);
    expect(
      deriveReassessmentBasis(displayWorkspace, revision.revision_id, address).basis_sha256,
    ).toBe(expected.basis_sha256);
    expect(
      deriveReassessmentBasis(unrelatedWorkspace, revision.revision_id, address).basis_sha256,
    ).toBe(expected.basis_sha256);
  });

  test("removes unchecked mapping/context declarations from the portable contract", () => {
    const revision = sourceOnlyRevision();
    const address = { bundle_id: "alpha", analysis_id: "analysis-base" };
    let workspace = recordRevision(importSharedAnalyses("one", [alphaImport]), {
      ...revision,
      transitions: [revision.transitions[0]!],
    });
    workspace = reassessApplicability(
      workspace,
      supportedAssessment(workspace, revision.revision_id, address),
    );
    const value = JSON.parse(new TextDecoder().decode(exportSharedAnalysis(workspace))) as {
      applicability_assessments: Record<string, unknown>[];
    };
    value.applicability_assessments[0]!.mapping_sha256 = `sha256:${"0".repeat(64)}`;
    value.applicability_assessments[0]!.context_sha256 = `sha256:${"1".repeat(64)}`;
    expectCode(() => openSharedAnalysis(exactJsonBytes(value)), "SHARED_ANALYSIS_INVALID");
  });

  test("uses typed dependency roles after every local dependency ID is renamed", () => {
    const renamed = changedCase(alphaImport, (value) => {
      const analysis = value.analyses[0]!;
      const rename = new Map(
        analysis.dependencies.map(({ dependency_id }) => [
          dependency_id,
          `renamed.${dependency_id}`,
        ]),
      );
      (
        analysis as { dependencies: DecisionCase["analyses"][number]["dependencies"] }
      ).dependencies = analysis.dependencies.map((dependency) => ({
        ...dependency,
        dependency_id: rename.get(dependency.dependency_id)!,
        depends_on: dependency.depends_on.map((id) => rename.get(id)!),
      }));
      (
        analysis as { model_mappings: DecisionCase["analyses"][number]["model_mappings"] }
      ).model_mappings = analysis.model_mappings.map((mapping) => ({
        ...mapping,
        dependency_ids: mapping.dependency_ids.map((id) => rename.get(id)!),
      }));
      (analysis.change as unknown as { changed_dependencies: string[] }).changed_dependencies =
        analysis.change.changed_dependencies.map((id) => rename.get(id)!);
      (
        analysis.applicability as unknown as { changed_dependencies: string[] }
      ).changed_dependencies = analysis.applicability.changed_dependencies.map((id) =>
        rename.get(id)!,
      );
    });
    const originalRevision = {
      ...withdrawalRevision(),
      revision_id: "revision.original-id-withdrawal",
      transitions: [],
    };
    const renamedRevision = {
      ...originalRevision,
      revision_id: "revision.renamed-id-withdrawal",
      withdrawn_dependencies: [
        {
          bundle_id: "alpha",
          analysis_id: "analysis-base",
          dependency_id: "renamed.choice.independence",
        },
      ],
    };
    const before = assessRevision(
      recordRevision(importSharedAnalyses("one", [alphaImport]), originalRevision),
      originalRevision.revision_id,
    ).impacts[0]!;
    const after = assessRevision(
      recordRevision(importSharedAnalyses("one", [renamed]), renamedRevision),
      renamedRevision.revision_id,
    ).impacts[0]!;
    expect(after.status).toBe(before.status);
    expect(after.successor_subject_status).toBe("not_established");
    expect(after.direct_dependencies).toEqual(["renamed.choice.independence"]);
    expect(
      after.derivation_paths.map(({ nodes }) => nodes.map((id) => id.replace(/^renamed\./, ""))),
    ).toEqual(before.derivation_paths.map(({ nodes }) => [...nodes]));
    expect(after.derivation_paths.some(({ nodes }) => nodes.includes("renamed.use.checked"))).toBe(
      true,
    );
  });

  test("compares exact assumption declarations and context rather than local labels", () => {
    const second = changedCase(alphaImport, (value) => {
      const assumption = value.analyses[0]!.dependencies.find(
        ({ dependency_id }) => dependency_id === "choice.independence",
      )!;
      (assumption as { description: string }).description =
        "A different assumption with the same case-local identifier.";
    });
    const inspection = inspectSharedAnalyses(
      importSharedAnalyses("one", [alphaImport, { ...second, bundle_id: "second" }]),
    );
    expect(inspection.differences[0]).toEqual(
      expect.objectContaining({
        mathematical_subject_equal: true,
        declared_context_equal: true,
        status: "different_models",
        distinct_assumptions: [
          {
            bundle_id: "alpha",
            analysis_id: "analysis-base",
            dependency_id: "choice.independence",
          },
          {
            bundle_id: "second",
            analysis_id: "analysis-base",
            dependency_id: "choice.independence",
          },
        ],
      }),
    );

    const differentUnit = changedCase(alphaImport, (value) => {
      (value.analyses[0] as { unit: string }).unit = "different_declared_loss_unit";
    });
    expect(
      inspectSharedAnalyses(
        importSharedAnalyses("one", [alphaImport, { ...differentUnit, bundle_id: "unit" }]),
      ).differences[0],
    ).toEqual(
      expect.objectContaining({
        mathematical_subject_equal: true,
        declared_context_equal: false,
        status: "different_models",
      }),
    );
  });

  test("ignores bundle-local analysis IDs and lifecycle bookkeeping in model comparison", () => {
    const renamed = changedCase(alphaImport, (value) => {
      (value.analyses[0] as { analysis_id: string }).analysis_id = "local-analysis-copy";
    });
    const lifecycleChanged = changedCase(alphaImport, (value) => {
      const analysis = value.analyses[0]!;
      (analysis as { kind: "interpretation_control" }).kind = "interpretation_control";
      (analysis as { previous_analysis_id: string }).previous_analysis_id = "control-q-b";
      (
        analysis as unknown as { applicability: DecisionCase["analyses"][number]["applicability"] }
      ).applicability = {
        status: "contested",
        rationale: "Different current applicability bookkeeping for the same declared model.",
        changed_dependencies: ["choice.independence"],
      };
      (analysis as unknown as { change: DecisionCase["analyses"][number]["change"] }).change = {
        summary: "Different local revision history for the same declared model.",
        changed_dependencies: ["choice.independence"],
      };
      (
        analysis as unknown as { human_review: DecisionCase["analyses"][number]["human_review"] }
      ).human_review = { disposition: "proposed", reviewer: null };
    });
    const inspection = inspectSharedAnalyses(
      importSharedAnalyses("one", [
        alphaImport,
        {
          ...renamed,
          bundle_id: "renamed",
          selected_analysis_ids: ["local-analysis-copy"],
        },
        { ...lifecycleChanged, bundle_id: "lifecycle" },
      ]),
    );
    for (const difference of inspection.differences) {
      expect(difference).toEqual(
        expect.objectContaining({
          mathematical_subject_equal: true,
          declared_context_equal: true,
          distinct_assumptions: [],
          status: "same_declared_model",
        }),
      );
    }
  });

  test("rejects an existing execution that is not bound to the imported analysis", () => {
    const workspace = importSharedAnalyses("one", [alphaImport]);
    expectCode(
      () =>
        attachDecisionExecution(
          workspace,
          { bundle_id: "alpha", analysis_id: "analysis-base" },
          new Uint8Array(
            readFileSync(
              join(
                ROOT,
                "examples",
                "decision-cases",
                "failure-choice",
                "executions",
                "revision-0.execution.json",
              ),
            ),
          ),
        ),
      "SHARED_ANALYSIS_REVISION_INVALID",
    );
  });

  test("scopes colliding route IDs and alternatives to bundle, analysis and statement", () => {
    const twin = { ...betaImport, bundle_id: "twin" };
    const workspace = importSharedAnalyses("one", [betaImport, twin]);
    const revision: RevisionDeclaration = {
      revision_id: "revision.scoped-route",
      kind: "source_withdrawal",
      summary: "Withdraw one bundle-local route only.",
      source_replacements: [],
      withdrawn_sources: [],
      withdrawn_dependencies: [],
      withdrawn_routes: [{ bundle_id: "beta", route_id: "route-y-shared" }],
      conflicting_premises: [],
      transitions: [],
    };
    const impact = assessRevision(recordRevision(workspace, revision), revision.revision_id);
    expect(impact.impacts.find(({ analysis }) => analysis.bundle_id === "beta")).toEqual(
      expect.objectContaining({
        status: "affected",
        withdrawn_support_routes: [
          expect.objectContaining({ bundle_id: "beta", route_id: "route-y-shared" }),
        ],
      }),
    );
    expect(impact.impacts.find(({ analysis }) => analysis.bundle_id === "twin")!.status).toBe(
      "unaffected",
    );

    const differentStatement = {
      ...betaImport,
      inventory: {
        ...betaImport.inventory,
        support_routes: betaImport.inventory.support_routes.map((route) =>
          route.route_id === "route-y-alternative"
            ? { ...route, statement_id: "statement.different" }
            : route,
        ),
      },
    };
    const statementImpact = assessRevision(
      recordRevision(importSharedAnalyses("two", [differentStatement]), revision),
      revision.revision_id,
    ).impacts[0]!;
    expect(statementImpact.surviving_support_routes).toEqual([]);
  });

  test("rejects substantive metadata labels and reports absent evidence conservatively", () => {
    const disguised = { ...sourceOnlyRevision(), kind: "metadata_change" as const };
    expectCode(
      () => recordRevision(importSharedAnalyses("one", [alphaImport]), disguised),
      "SHARED_ANALYSIS_REVISION_INVALID",
    );
    const impact = assessRevision(
      recordRevision(
        importSharedAnalyses("one", [alphaImport]),
        withoutTransition("revision.no-successor"),
      ),
      "revision.no-successor",
    ).impacts[0]!;
    expect(impact).toEqual(
      expect.objectContaining({
        original_subject_status: "preserved",
        original_check_evidence: { status: "absent", execution_sha256: null },
        successor_subject_status: "not_established",
        successor_check_evidence: { status: "absent", execution_sha256: null },
      }),
    );
  });
});
