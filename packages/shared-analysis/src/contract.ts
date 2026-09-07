import {
  analysisBindingHash,
  analysisById,
  assessReuse,
  encodedBytes,
  exactJsonBytes,
  exactJsonKey,
  executionBytes,
  mathematicalBytes,
  openDecisionCase,
  parseExecution,
  recheckDecisionExecution,
  runDecisionCase,
  verifyEncodedBytes,
  type CaseSourceDocument,
  type DecisionAnalysis,
  type EngineOptions,
  type LoadedDecisionCase,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import { SharedAnalysisError } from "./errors.js";
import { ScopedLineageIndex } from "./lineage-index.js";
import { assertArchive } from "./schema-validation.js";
import type {
  AnalysisAddress,
  AnalysisRevisionImpact,
  ApplicabilityAssessmentDeclaration,
  BundleImport,
  DependencyAddress,
  DerivationPath,
  LoadedSharedAnalysis,
  PortableBundleImport,
  RecipientReplay,
  RecomputedAnalysis,
  RecomputeRequest,
  RevisionDeclaration,
  RevisionImpact,
  SharedAnalysisArchive,
  SharedAnalysisInspection,
  SourceIdentity,
} from "./types.js";

const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function sourceIdentity(source: CaseSourceDocument): SourceIdentity {
  return {
    source_id: source.source_id,
    document_version_id: source.document_version_id,
    sha256: source.sha256,
  };
}

function sourceVersionKey(
  source: Pick<SourceIdentity, "source_id" | "document_version_id">,
): string {
  return exactJsonKey([source.source_id, source.document_version_id]);
}

function sourceKey(source: SourceIdentity): string {
  return exactJsonKey([source.source_id, source.document_version_id, source.sha256]);
}

function addressKey(address: AnalysisAddress): string {
  return exactJsonKey([address.bundle_id, address.analysis_id]);
}

function dependencyKey(address: DependencyAddress): string {
  return exactJsonKey([address.bundle_id, address.analysis_id, address.dependency_id]);
}

function revisionExecutionKey(value: {
  analysis: AnalysisAddress;
  revision_id: string | null;
}): string {
  return exactJsonKey([value.analysis.bundle_id, value.analysis.analysis_id, value.revision_id]);
}

function snapshot(value: SharedAnalysisArchive): LoadedSharedAnalysis {
  assertArchive(value);
  const bytes = exactJsonBytes(value);
  return deepFreeze({ value: deepFreeze(value), archive_sha256: sha256Bytes(bytes) });
}

function validatedSnapshot(value: SharedAnalysisArchive): LoadedSharedAnalysis {
  const workspace = snapshot(value);
  validateArchive(workspace);
  return workspace;
}

function decodeCase(bundle: PortableBundleImport): LoadedDecisionCase {
  return openDecisionCase(verifyEncodedBytes(bundle.case_file, `${bundle.bundle_id}.case_file`));
}

function analysisEntry(
  workspace: LoadedSharedAnalysis,
  address: AnalysisAddress,
): { bundle: PortableBundleImport; caseFile: LoadedDecisionCase; analysis: DecisionAnalysis } {
  const bundle = workspace.value.bundles.find(({ bundle_id }) => bundle_id === address.bundle_id);
  if (bundle === undefined) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_ANALYSIS_NOT_FOUND",
      `Unknown bundle ${address.bundle_id}.`,
    );
  }
  const caseFile = decodeCase(bundle);
  if (!bundle.selected_analysis_ids.includes(address.analysis_id)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_ANALYSIS_NOT_FOUND",
      `Bundle ${address.bundle_id} does not select analysis ${address.analysis_id}.`,
    );
  }
  try {
    return { bundle, caseFile, analysis: analysisById(caseFile, address.analysis_id) };
  } catch {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_ANALYSIS_NOT_FOUND",
      `Bundle ${address.bundle_id} has no analysis ${address.analysis_id}.`,
    );
  }
}

function portableBundle(input: BundleImport): PortableBundleImport {
  if (input.bundle_id.length === 0 || input.selected_analysis_ids.length === 0) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "Every bundle needs a non-empty ID and at least one selected analysis.",
    );
  }
  const caseFile = openDecisionCase(new Uint8Array(input.case_bytes));
  const selectedAnalysisIds = [...input.selected_analysis_ids].sort(compare);
  if (new Set(selectedAnalysisIds).size !== selectedAnalysisIds.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      `Bundle ${input.bundle_id} repeats a selected analysis.`,
    );
  }
  for (const analysisId of selectedAnalysisIds) analysisById(caseFile, analysisId);
  for (const source of input.supplemental_sources ?? []) {
    verifyEncodedBytes(source, `${input.bundle_id}.supplemental_source`);
  }
  const routeIds = input.inventory.support_routes.map(({ route_id }) => route_id);
  if (new Set(routeIds).size !== routeIds.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      `Bundle ${input.bundle_id} repeats a support route.`,
    );
  }
  if (
    new Set(input.inventory.unresolved_references).size !==
    input.inventory.unresolved_references.length
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      `Bundle ${input.bundle_id} repeats an unresolved reference.`,
    );
  }
  return {
    bundle_id: input.bundle_id,
    case_file: encodedBytes(new Uint8Array(input.case_bytes)),
    selected_analysis_ids: selectedAnalysisIds,
    inventory: {
      ...input.inventory,
      unresolved_references: [...input.inventory.unresolved_references].sort(compare),
      support_routes: [...input.inventory.support_routes]
        .map((route) => ({
          ...route,
          premise_sources: [...route.premise_sources].sort((left, right) =>
            compare(sourceKey(left), sourceKey(right)),
          ),
        }))
        .sort((left, right) => compare(left.route_id, right.route_id)),
    },
    supplemental_sources: [...(input.supplemental_sources ?? [])].sort((left, right) =>
      compare(sourceKey(sourceIdentity(left)), sourceKey(sourceIdentity(right))),
    ),
  };
}

function validateSources(bundles: readonly PortableBundleImport[]): void {
  const hashes = new Map<string, string>();
  const routeOwners = new Map<string, string>();
  for (const bundle of bundles) {
    const caseFile = decodeCase(bundle);
    const localSources = new Set<string>();
    for (const source of [...caseFile.value.source_documents, ...bundle.supplemental_sources]) {
      verifyEncodedBytes(source, `${bundle.bundle_id}.source`);
      const key = sourceVersionKey(source);
      const prior = hashes.get(key);
      if (prior !== undefined && prior !== source.sha256) {
        throw new SharedAnalysisError(
          "SHARED_ANALYSIS_SOURCE_CONFLICT",
          `Source ${source.source_id}/${source.document_version_id} has conflicting exact bytes.`,
        );
      }
      hashes.set(key, source.sha256);
      localSources.add(sourceKey(sourceIdentity(source)));
    }
    for (const route of bundle.inventory.support_routes) {
      const owner = routeOwners.get(route.route_id);
      if (owner !== undefined && owner !== bundle.bundle_id) {
        throw new SharedAnalysisError(
          "SHARED_ANALYSIS_BUNDLE_CONFLICT",
          `Support route ${route.route_id} is ambiguous across bundles ${owner} and ${bundle.bundle_id}.`,
        );
      }
      routeOwners.set(route.route_id, bundle.bundle_id);
      if (
        route.premise_sources.length === 0 ||
        route.premise_sources.some((source) => !localSources.has(sourceKey(source)))
      ) {
        throw new SharedAnalysisError(
          "SHARED_ANALYSIS_REFERENCE_UNRESOLVED",
          `Support route ${route.route_id} does not resolve every premise to exact bundle source bytes.`,
        );
      }
    }
  }
}

function validateBundles(bundles: readonly PortableBundleImport[]): void {
  const ids = bundles.map(({ bundle_id }) => bundle_id);
  if (new Set(ids).size !== ids.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_BUNDLE_CONFLICT",
      "The archive repeats a bundle ID.",
    );
  }
  if (ids.join("\0") !== [...ids].sort(compare).join("\0")) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "Bundles are not in deterministic lexical order.",
    );
  }
  for (const bundle of bundles) {
    const normalized = portableBundle({
      bundle_id: bundle.bundle_id,
      case_bytes: verifyEncodedBytes(bundle.case_file, `${bundle.bundle_id}.case_file`),
      selected_analysis_ids: bundle.selected_analysis_ids,
      inventory: bundle.inventory,
      supplemental_sources: bundle.supplemental_sources,
    });
    if (exactJsonKey(normalized) !== exactJsonKey(bundle)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_INVALID",
        `Bundle ${bundle.bundle_id} is not in deterministic portable form.`,
      );
    }
  }
  validateSources(bundles);
}

/** Import exact native case bundles without promoting their local IDs to global identity. */
export function importSharedAnalyses(
  workspaceId: string,
  inputs: readonly BundleImport[],
): LoadedSharedAnalysis {
  if (workspaceId.length === 0 || inputs.length === 0) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "A non-empty workspace ID and at least one bundle are required.",
    );
  }
  const byId = new Map<string, PortableBundleImport>();
  for (const input of inputs) {
    const bundle = portableBundle(input);
    const prior = byId.get(bundle.bundle_id);
    if (prior !== undefined && exactJsonKey(prior) !== exactJsonKey(bundle)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_BUNDLE_CONFLICT",
        `Bundle ${bundle.bundle_id} has conflicting declarations.`,
      );
    }
    byId.set(bundle.bundle_id, bundle);
  }
  const bundles = [...byId.values()].sort((left, right) =>
    compare(left.bundle_id, right.bundle_id),
  );
  validateBundles(bundles);
  return validatedSnapshot({
    schema_version: "0.1.0",
    archive_kind: "shared_analysis_revision",
    workspace_id: workspaceId,
    bundles,
    revisions: [],
    applicability_assessments: [],
    executions: [],
  });
}

function selected(workspace: LoadedSharedAnalysis): Array<{
  address: AnalysisAddress;
  bundle: PortableBundleImport;
  caseFile: LoadedDecisionCase;
  analysis: DecisionAnalysis;
}> {
  return workspace.value.bundles.flatMap((bundle) => {
    const caseFile = decodeCase(bundle);
    return bundle.selected_analysis_ids.map((analysisId) => ({
      address: { bundle_id: bundle.bundle_id, analysis_id: analysisId },
      bundle,
      caseFile,
      analysis: analysisById(caseFile, analysisId),
    }));
  });
}

function baseSourceKeys(workspace: LoadedSharedAnalysis): Set<string> {
  const keys = new Set<string>();
  for (const bundle of workspace.value.bundles) {
    const caseFile = decodeCase(bundle);
    for (const source of [...caseFile.value.source_documents, ...bundle.supplemental_sources]) {
      keys.add(sourceKey(sourceIdentity(source)));
    }
  }
  return keys;
}

function authoritySourceKeys(workspace: LoadedSharedAnalysis): Set<string> {
  const keys = new Set<string>();
  const versions = new Map<string, string>();
  const add = (source: CaseSourceDocument): void => {
    verifyEncodedBytes(source, `${source.source_id}/${source.document_version_id}`);
    const version = sourceVersionKey(source);
    const prior = versions.get(version);
    if (prior !== undefined && prior !== source.sha256) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_SOURCE_CONFLICT",
        `Source ${source.source_id}/${source.document_version_id} has conflicting exact bytes.`,
      );
    }
    versions.set(version, source.sha256);
    keys.add(sourceKey(sourceIdentity(source)));
  };
  for (const bundle of workspace.value.bundles) {
    const caseFile = decodeCase(bundle);
    for (const source of [...caseFile.value.source_documents, ...bundle.supplemental_sources]) {
      add(source);
    }
  }
  for (const revision of workspace.value.revisions) {
    for (const replacement of revision.source_replacements) {
      add(replacement.to);
    }
    for (const transition of revision.transitions) {
      const successor = openDecisionCase(
        verifyEncodedBytes(transition.successor_case, `${revision.revision_id}.successor_case`),
      );
      for (const source of successor.value.source_documents) {
        add(source);
      }
    }
  }
  return keys;
}

/** Derive shared source identity and model disagreement from the portable evidence. */
export function inspectSharedAnalyses(workspace: LoadedSharedAnalysis): SharedAnalysisInspection {
  assertLoaded(workspace);
  const entries = selected(workspace);
  const sourceBundles = new Map<string, { identity: SourceIdentity; bundles: Set<string> }>();
  for (const entry of entries) {
    for (const source of entry.caseFile.value.source_documents) {
      const identity = sourceIdentity(source);
      const key = sourceKey(identity);
      const value = sourceBundles.get(key) ?? { identity, bundles: new Set<string>() };
      value.bundles.add(entry.address.bundle_id);
      sourceBundles.set(key, value);
    }
  }
  const sharedSources = [...sourceBundles.values()]
    .filter(({ bundles }) => bundles.size > 1)
    .map(({ identity, bundles }) => ({ identity, bundles: [...bundles].sort(compare) }))
    .sort((left, right) => compare(sourceKey(left.identity), sourceKey(right.identity)));
  const differences = [];
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex]!;
      const right = entries[rightIndex]!;
      const leftSources = new Map(
        left.caseFile.value.source_documents.map((source) => [
          sourceKey(sourceIdentity(source)),
          sourceIdentity(source),
        ]),
      );
      const common = right.caseFile.value.source_documents
        .map(sourceIdentity)
        .filter((identity) => leftSources.has(sourceKey(identity)))
        .sort((a, b) => compare(sourceKey(a), sourceKey(b)));
      const assumptions = (entry: typeof left): DependencyAddress[] =>
        entry.analysis.dependencies
          .filter(
            ({ kind, dependency_id }) =>
              kind === "modelling_choice" && dependency_id !== "choice.exact-family",
          )
          .map(({ dependency_id }) => ({ ...entry.address, dependency_id }));
      const leftAssumptions = assumptions(left);
      const rightAssumptions = assumptions(right);
      const leftIds = new Set(leftAssumptions.map(({ dependency_id }) => dependency_id));
      const rightIds = new Set(rightAssumptions.map(({ dependency_id }) => dependency_id));
      const distinct = [
        ...leftAssumptions.filter(({ dependency_id }) => !rightIds.has(dependency_id)),
        ...rightAssumptions.filter(({ dependency_id }) => !leftIds.has(dependency_id)),
      ].sort((a, b) => compare(dependencyKey(a), dependencyKey(b)));
      const subjectEqual =
        left.analysis.mathematical_subject.problem.sha256 ===
          right.analysis.mathematical_subject.problem.sha256 &&
        left.analysis.mathematical_subject.query.sha256 ===
          right.analysis.mathematical_subject.query.sha256;
      differences.push({
        left: left.address,
        right: right.address,
        shared_sources: common,
        distinct_assumptions: distinct,
        mathematical_subject_equal: subjectEqual,
        status:
          common.length === 0
            ? ("not_established" as const)
            : distinct.length === 0 && subjectEqual
              ? ("same_declared_model" as const)
              : ("different_models" as const),
      });
    }
  }
  return deepFreeze({
    analyses: entries.map(({ address }) => address),
    shared_sources: sharedSources,
    differences,
    unresolved_references: entries
      .filter(({ bundle }) => bundle.inventory.unresolved_references.length > 0)
      .map(({ address, bundle }) => ({
        bundle_id: address.bundle_id,
        references: bundle.inventory.unresolved_references,
      })),
  });
}

function validateRevision(workspace: LoadedSharedAnalysis, revision: RevisionDeclaration): void {
  if (revision.revision_id.length === 0) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "Revision ID must be non-empty.",
    );
  }
  const baseSources = baseSourceKeys(workspace);
  const replacements = new Set<string>();
  for (const replacement of revision.source_replacements) {
    verifyEncodedBytes(replacement.to, `${revision.revision_id}.source_replacement`);
    const from = sourceKey(replacement.from);
    if (!baseSources.has(from) || replacements.has(from)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision ${revision.revision_id} repeats or cannot resolve an exact source replacement.`,
      );
    }
    replacements.add(from);
  }
  for (const source of revision.withdrawn_sources) {
    if (!baseSources.has(sourceKey(source))) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision ${revision.revision_id} withdraws unavailable exact source bytes.`,
      );
    }
  }
  const withdrawnDependencies = new Set<string>();
  for (const dependency of revision.withdrawn_dependencies) {
    const entry = analysisEntry(workspace, dependency);
    if (
      !entry.analysis.dependencies.some(
        ({ dependency_id }) => dependency_id === dependency.dependency_id,
      )
    ) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision names missing dependency ${dependency.dependency_id}.`,
      );
    }
    const key = dependencyKey(dependency);
    if (withdrawnDependencies.has(key)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision repeats withdrawn dependency ${dependency.dependency_id}.`,
      );
    }
    withdrawnDependencies.add(key);
  }
  const routes = new Set(
    workspace.value.bundles.flatMap(({ inventory }) =>
      inventory.support_routes.map(({ route_id }) => route_id),
    ),
  );
  if (revision.withdrawn_routes.some((routeId) => !routes.has(routeId))) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      `Revision ${revision.revision_id} withdraws an unknown support route.`,
    );
  }
  const transitions = new Set<string>();
  for (const transition of revision.transitions) {
    if (workspace.value.bundles.some(({ bundle_id }) => bundle_id === transition.prior.bundle_id)) {
      analysisEntry(workspace, transition.prior);
    }
    const key = addressKey(transition.prior);
    if (transitions.has(key)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision repeats transition for ${transition.prior.bundle_id}/${transition.prior.analysis_id}.`,
      );
    }
    transitions.add(key);
    const next = openDecisionCase(
      verifyEncodedBytes(transition.successor_case, `${revision.revision_id}.successor_case`),
    );
    analysisById(next, transition.successor_analysis_id);
    const priorBundle = workspace.value.bundles.find(
      ({ bundle_id }) => bundle_id === transition.prior.bundle_id,
    );
    if (priorBundle !== undefined && next.value.case_id !== decodeCase(priorBundle).value.case_id) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision ${revision.revision_id} changes native case identity.`,
      );
    }
  }
}

/** Append an explicit supplied event. Version labels and prose never imply a revision. */
export function recordRevision(
  workspace: LoadedSharedAnalysis,
  revision: RevisionDeclaration,
): LoadedSharedAnalysis {
  assertLoaded(workspace);
  validateRevision(workspace, revision);
  const prior = workspace.value.revisions.find(
    ({ revision_id }) => revision_id === revision.revision_id,
  );
  if (prior !== undefined) {
    if (exactJsonKey(prior) === exactJsonKey(revision)) return workspace;
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      `Revision ${revision.revision_id} has conflicting declarations.`,
    );
  }
  return validatedSnapshot({
    ...workspace.value,
    revisions: [...workspace.value.revisions, revision].sort((left, right) =>
      compare(left.revision_id, right.revision_id),
    ),
  });
}

function lineageIndex(analysis: DecisionAnalysis): ScopedLineageIndex {
  const index = new ScopedLineageIndex();
  for (const dependency of analysis.dependencies) {
    index.addNode(dependency.dependency_id, dependency);
  }
  for (const dependency of analysis.dependencies) {
    for (const parent of dependency.depends_on) {
      index.addEdge(parent, dependency.dependency_id);
    }
  }
  index.assertAcyclic();
  return index;
}

function referencedSourceDependencies(
  caseFile: LoadedDecisionCase,
  analysis: DecisionAnalysis,
  sources: readonly SourceIdentity[],
): string[] {
  const keys = new Set(sources.map(sourceKey));
  const references = new Set(
    caseFile.value.source_references
      .filter((reference) =>
        keys.has(
          sourceKey({
            source_id: reference.source_id,
            document_version_id: reference.document_version_id,
            sha256: reference.document_hash,
          }),
        ),
      )
      .map(({ reference_id }) => reference_id),
  );
  return analysis.dependencies
    .filter(({ reference_ids }) => reference_ids.some((id) => references.has(id)))
    .map(({ dependency_id }) => dependency_id);
}

function revisionImpact(workspace: LoadedSharedAnalysis, revisionId: string): RevisionImpact {
  const revision = workspace.value.revisions.find(({ revision_id }) => revision_id === revisionId);
  if (revision === undefined) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_NOT_FOUND",
      `Unknown revision ${revisionId}.`,
    );
  }
  const changedSources = [
    ...revision.source_replacements.map(({ from }) => from),
    ...revision.withdrawn_sources,
  ];
  const impactsWithoutBasis: AnalysisRevisionImpact[] = selected(workspace).map((entry) => {
    const lineage = lineageIndex(entry.analysis);
    const transition = revision.transitions.find(
      ({ prior }) => addressKey(prior) === addressKey(entry.address),
    );
    const direct = new Set(
      referencedSourceDependencies(entry.caseFile, entry.analysis, changedSources),
    );
    for (const dependency of revision.withdrawn_dependencies) {
      if (addressKey(dependency) === addressKey(entry.address))
        direct.add(dependency.dependency_id);
    }
    const withdrawnSourceKeys = new Set(changedSources.map(sourceKey));
    const withdrawnRoutes = entry.bundle.inventory.support_routes
      .filter(
        (route) =>
          revision.withdrawn_routes.includes(route.route_id) ||
          route.premise_sources.some((source) => withdrawnSourceKeys.has(sourceKey(source))),
      )
      .map(({ route_id }) => route_id)
      .sort(compare);
    const survivingRoutes = entry.bundle.inventory.support_routes
      .filter(({ route_id }) => !withdrawnRoutes.includes(route_id))
      .map(({ route_id }) => route_id)
      .sort(compare);
    const visibleConflicts = revision.conflicting_premises.filter(
      ({ statement_scope }) => statement_scope === entry.bundle.inventory.scope,
    );
    const affected =
      direct.size > 0 ||
      transition !== undefined ||
      withdrawnRoutes.length > 0 ||
      visibleConflicts.length > 0;
    const status = affected
      ? ("affected" as const)
      : entry.bundle.inventory.completeness === "complete"
        ? ("unaffected" as const)
        : ("not_established" as const);
    let mathematicalCheckReusable = true;
    if (transition !== undefined) {
      const next = openDecisionCase(
        verifyEncodedBytes(transition.successor_case, `${revisionId}.successor_case`),
      );
      mathematicalCheckReusable = assessReuse(
        entry.caseFile,
        entry.address.analysis_id,
        next,
        transition.successor_analysis_id,
      ).mathematical_check_reusable;
    } else if (
      revision.withdrawn_dependencies.some(
        (dependency) =>
          addressKey(dependency) === addressKey(entry.address) &&
          (lineage.reaches(dependency.dependency_id, "subject.problem") ||
            lineage.reaches(dependency.dependency_id, "subject.query")),
      )
    ) {
      mathematicalCheckReusable = false;
    }
    const derivationPaths: DerivationPath[] = [...direct]
      .sort(compare)
      .flatMap((dependencyId) =>
        (lineage.paths(dependencyId, "use.checked").length > 0
          ? lineage.paths(dependencyId, "use.checked")
          : [[dependencyId]]
        ).map((nodes) => ({ analysis: entry.address, nodes })),
      );
    return {
      analysis: entry.address,
      status,
      direct_dependencies: [...direct].sort(compare),
      derivation_paths: derivationPaths,
      original_mathematical_check_valid: true,
      mathematical_check_reusable: mathematicalCheckReusable,
      applicability_requires_reassessment:
        revision.kind !== "metadata_change" && status !== "unaffected",
      surviving_support_routes: survivingRoutes,
      withdrawn_support_routes: withdrawnRoutes,
      visible_conflicts: visibleConflicts,
      unresolved_references: [...entry.bundle.inventory.unresolved_references],
    };
  });
  const inventoryScope = workspace.value.bundles.map(({ bundle_id, inventory }) => ({
    bundle_id,
    completeness: inventory.completeness,
  }));
  const basis = sha256Bytes(
    exactJsonBytes({ revision, inventory_scope: inventoryScope, impacts: impactsWithoutBasis }),
  );
  return deepFreeze({
    revision_id: revisionId,
    basis_sha256: basis,
    inventory_scope: inventoryScope,
    impacts: impactsWithoutBasis,
  });
}

function validateAssessment(
  workspace: LoadedSharedAnalysis,
  assessment: ApplicabilityAssessmentDeclaration,
): void {
  const entry = analysisEntry(workspace, assessment.analysis);
  const impact = revisionImpact(workspace, assessment.revision_id);
  if (assessment.basis_sha256 !== impact.basis_sha256) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REASSESSMENT_STALE",
      `Assessment ${assessment.assessment_id} is not bound to the current revision impact.`,
    );
  }
  const scopedImpact = impact.impacts.find(
    ({ analysis }) => addressKey(analysis) === addressKey(assessment.analysis),
  );
  if (scopedImpact === undefined || scopedImpact.status === "unaffected") {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      `Assessment ${assessment.assessment_id} is not scoped to an affected or unresolved analysis.`,
    );
  }
  const authority = authoritySourceKeys(workspace);
  const bindings = assessment.source_bindings.map(sourceKey);
  if (
    new Set(bindings).size !== bindings.length ||
    bindings.some((binding) => !authority.has(binding))
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REFERENCE_UNRESOLVED",
      `Assessment ${assessment.assessment_id} repeats or binds unavailable exact source bytes.`,
    );
  }
  const dependencies = assessment.assumption_dependencies.map(dependencyKey);
  if (new Set(dependencies).size !== dependencies.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      `Assessment ${assessment.assessment_id} repeats an assumption dependency.`,
    );
  }
  for (const dependency of assessment.assumption_dependencies) {
    const dependencyEntry = analysisEntry(workspace, dependency);
    if (
      !dependencyEntry.analysis.dependencies.some(
        ({ dependency_id }) => dependency_id === dependency.dependency_id,
      )
    ) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Assessment ${assessment.assessment_id} names a missing assumption dependency.`,
      );
    }
  }
  const revision = workspace.value.revisions.find(
    ({ revision_id }) => revision_id === assessment.revision_id,
  )!;
  const requiredSuccessors = revision.source_replacements
    .filter(
      ({ from }) => referencedSourceDependencies(entry.caseFile, entry.analysis, [from]).length > 0,
    )
    .map(({ to }) => sourceKey(sourceIdentity(to)));
  const bound = new Set(bindings);
  if (requiredSuccessors.some((successor) => !bound.has(successor))) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REASSESSMENT_STALE",
      `Assessment ${assessment.assessment_id} omits a revised exact source binding.`,
    );
  }
}

function caseAndAnalysisForExecution(
  workspace: LoadedSharedAnalysis,
  portable: SharedAnalysisArchive["executions"][number],
): { caseFile: LoadedDecisionCase; analysis: DecisionAnalysis } {
  if (portable.revision_id === null) {
    const entry = analysisEntry(workspace, portable.analysis);
    return { caseFile: entry.caseFile, analysis: entry.analysis };
  }
  const revision = workspace.value.revisions.find(
    ({ revision_id }) => revision_id === portable.revision_id,
  );
  const transition = revision?.transitions.find(
    ({ prior }) => addressKey(prior) === addressKey(portable.analysis),
  );
  if (transition === undefined) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "Portable execution has no declared successor subject.",
    );
  }
  const caseFile = openDecisionCase(
    verifyEncodedBytes(transition.successor_case, `${portable.revision_id}.successor_case`),
  );
  return { caseFile, analysis: analysisById(caseFile, transition.successor_analysis_id) };
}

function validateExecution(
  workspace: LoadedSharedAnalysis,
  portable: SharedAnalysisArchive["executions"][number],
): void {
  const { caseFile, analysis } = caseAndAnalysisForExecution(workspace, portable);
  const execution = parseExecution(verifyEncodedBytes(portable.execution, "execution"));
  const subject = mathematicalBytes(analysis);
  if (
    execution.case_id !== caseFile.value.case_id ||
    execution.case_sha256 !== caseFile.case_sha256 ||
    execution.analysis_id !== analysis.analysis_id ||
    execution.analysis_sha256 !== analysisBindingHash(caseFile, analysis) ||
    execution.problem_sha256 !== sha256Bytes(subject.problem) ||
    execution.query_sha256 !== sha256Bytes(subject.query) ||
    exactJsonKey(execution.engine) !== exactJsonKey(caseFile.value.engine)
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "Stored execution is not bound to its declared exact analysis subject.",
    );
  }
  if (portable.revision_id !== null) {
    const impact = revisionImpact(workspace, portable.revision_id);
    const supported = workspace.value.applicability_assessments.some(
      (assessment) =>
        assessment.revision_id === portable.revision_id &&
        addressKey(assessment.analysis) === addressKey(portable.analysis) &&
        assessment.basis_sha256 === impact.basis_sha256 &&
        assessment.status === "supported",
    );
    if (!supported) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REASSESSMENT_REQUIRED",
        "Stored recomputation lacks a current supported applicability assessment.",
      );
    }
  }
}

function validateArchive(workspace: LoadedSharedAnalysis): void {
  validateBundles(workspace.value.bundles);
  authoritySourceKeys(workspace);
  const revisionIds = workspace.value.revisions.map(({ revision_id }) => revision_id);
  if (new Set(revisionIds).size !== revisionIds.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "The archive repeats a revision ID.",
    );
  }
  for (const revision of workspace.value.revisions) validateRevision(workspace, revision);
  const assessmentIds = workspace.value.applicability_assessments.map(
    ({ assessment_id }) => assessment_id,
  );
  if (new Set(assessmentIds).size !== assessmentIds.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "The archive repeats an applicability assessment ID.",
    );
  }
  for (const assessment of workspace.value.applicability_assessments) {
    validateAssessment(workspace, assessment);
  }
  const executions = new Set<string>();
  for (const execution of workspace.value.executions) {
    const key = revisionExecutionKey(execution);
    if (executions.has(key)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_INVALID",
        "The archive repeats an execution for one analysis revision.",
      );
    }
    executions.add(key);
    validateExecution(workspace, execution);
  }
}

function assertLoaded(workspace: LoadedSharedAnalysis): void {
  assertArchive(workspace.value);
  if (workspace.archive_sha256 !== sha256Bytes(exactJsonBytes(workspace.value))) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "Loaded archive identity does not match its exact portable value.",
    );
  }
  validateArchive(workspace);
}

/** Explain direct and downstream effects under the declared bounded inventory. */
export function assessRevision(
  workspace: LoadedSharedAnalysis,
  revisionId: string,
): RevisionImpact {
  assertLoaded(workspace);
  return revisionImpact(workspace, revisionId);
}

/** Record a declaration bound to the exact revision, sources, mappings and context. */
export function reassessApplicability(
  workspace: LoadedSharedAnalysis,
  assessment: ApplicabilityAssessmentDeclaration,
): LoadedSharedAnalysis {
  assertLoaded(workspace);
  validateAssessment(workspace, assessment);
  const prior = workspace.value.applicability_assessments.find(
    ({ assessment_id }) => assessment_id === assessment.assessment_id,
  );
  if (prior !== undefined) {
    if (exactJsonKey(prior) === exactJsonKey(assessment)) return workspace;
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REASSESSMENT_STALE",
      `Assessment ${assessment.assessment_id} has conflicting declarations.`,
    );
  }
  return validatedSnapshot({
    ...workspace.value,
    applicability_assessments: [...workspace.value.applicability_assessments, assessment].sort(
      (left, right) => compare(left.assessment_id, right.assessment_id),
    ),
  });
}

/** Solve and freshly check a declared successor; calculation cannot create applicability. */
export function recomputeAnalysis(
  workspace: LoadedSharedAnalysis,
  request: RecomputeRequest,
  options: EngineOptions,
): RecomputedAnalysis {
  assertLoaded(workspace);
  const revision = workspace.value.revisions.find(
    ({ revision_id }) => revision_id === request.revision_id,
  );
  if (revision === undefined) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_NOT_FOUND",
      `Unknown revision ${request.revision_id}.`,
    );
  }
  const transition = revision.transitions.find(
    ({ prior, successor_analysis_id }) =>
      addressKey(prior) === addressKey(request.prior) &&
      successor_analysis_id === request.successor_analysis_id,
  );
  if (transition === undefined) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "The requested successor is not declared by the revision.",
    );
  }
  const assessment = workspace.value.applicability_assessments.find(
    ({ assessment_id }) => assessment_id === request.applicability_assessment_id,
  );
  const basis = assessRevision(workspace, request.revision_id).basis_sha256;
  if (
    assessment === undefined ||
    assessment.revision_id !== request.revision_id ||
    addressKey(assessment.analysis) !== addressKey(request.prior) ||
    assessment.basis_sha256 !== basis ||
    assessment.status !== "supported"
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REASSESSMENT_REQUIRED",
      "A current supported applicability declaration is required before recomputation.",
    );
  }
  const successor = openDecisionCase(
    verifyEncodedBytes(transition.successor_case, `${request.revision_id}.successor_case`),
  );
  const execution = runDecisionCase(successor, request.successor_analysis_id, options);
  const portable = {
    analysis: request.prior,
    revision_id: request.revision_id,
    execution: encodedBytes(executionBytes(execution)),
  };
  const byKey = new Map(
    workspace.value.executions.map((item) => [revisionExecutionKey(item), item]),
  );
  const key = revisionExecutionKey(portable);
  const prior = byKey.get(key);
  if (prior !== undefined && exactJsonKey(prior) !== exactJsonKey(portable)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "Repeated recomputation produced conflicting portable execution bytes.",
    );
  }
  byKey.set(key, portable);
  return {
    workspace: validatedSnapshot({
      ...workspace.value,
      executions: [...byKey.values()].sort(
        (left, right) =>
          compare(left.analysis.bundle_id, right.analysis.bundle_id) ||
          compare(left.analysis.analysis_id, right.analysis.analysis_id) ||
          compare(left.revision_id ?? "", right.revision_id ?? ""),
      ),
    }),
    execution,
  };
}

/** Exact portable bytes containing evidence and declarations, never a cached derived graph. */
export function exportSharedAnalysis(workspace: LoadedSharedAnalysis): Uint8Array {
  assertLoaded(workspace);
  return exactJsonBytes(workspace.value);
}

/** Open and fully validate an exported shared-analysis archive. */
export function openSharedAnalysis(bytes: Uint8Array): LoadedSharedAnalysis {
  if (bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      `Archive must contain 1 to ${MAX_ARCHIVE_BYTES} bytes.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)));
  } catch {
    throw new SharedAnalysisError("SHARED_ANALYSIS_INVALID", "Archive is not valid UTF-8 JSON.");
  }
  assertArchive(parsed);
  let canonical: Uint8Array;
  try {
    canonical = exactJsonBytes(parsed);
  } catch {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "Archive cannot be represented as deterministic exact JSON.",
    );
  }
  if (!bytesEqual(canonical, bytes)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_INVALID",
      "Archive is not the deterministic exact-JSON representation.",
    );
  }
  return validatedSnapshot(parsed);
}

/** Reconstruct revision effects and freshly check each preserved candidate against exact bytes. */
export function replaySharedAnalysis(bytes: Uint8Array, options: EngineOptions): RecipientReplay {
  const workspace = openSharedAnalysis(bytes);
  const revisionImpacts = workspace.value.revisions.map(({ revision_id }) =>
    revisionImpact(workspace, revision_id),
  );
  const freshlyChecked = workspace.value.executions.map((portable) => {
    const { caseFile, analysis } = caseAndAnalysisForExecution(workspace, portable);
    const execution = parseExecution(verifyEncodedBytes(portable.execution, "execution"));
    const checked = recheckDecisionExecution(caseFile, execution, analysis.analysis_id, options);
    return {
      analysis: portable.analysis,
      mathematical_status: checked.status,
    };
  });
  return deepFreeze({
    archive_sha256: workspace.archive_sha256,
    revision_impacts: revisionImpacts,
    freshly_checked: freshlyChecked,
  });
}
