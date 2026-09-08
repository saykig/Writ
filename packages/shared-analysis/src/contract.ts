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
  type CaseDependency,
  type CaseSourceReference,
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
  ReassessmentBasis,
  RecomputedAnalysis,
  RecomputeRequest,
  RevisionDeclaration,
  RevisionImpact,
  SharedAnalysisArchive,
  SharedAnalysisInspection,
  ScopedSupportRoute,
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

function routeKey(address: { bundle_id: string; route_id: string }): string {
  return exactJsonKey([address.bundle_id, address.route_id]);
}

function digest(value: unknown): string {
  return sha256Bytes(exactJsonBytes(value));
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
  for (const route of input.inventory.support_routes) {
    if (
      route.analysis_ids.length === 0 ||
      new Set(route.analysis_ids).size !== route.analysis_ids.length ||
      route.analysis_ids.some((analysisId) => !selectedAnalysisIds.includes(analysisId))
    ) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REFERENCE_UNRESOLVED",
        `Support route ${route.route_id} must name one or more selected analyses in bundle ${input.bundle_id}.`,
      );
    }
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
          analysis_ids: [...route.analysis_ids].sort(compare),
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

function referencedMaterial(
  caseFile: LoadedDecisionCase,
  analysis: DecisionAnalysis,
): { references: CaseSourceReference[]; sources: CaseSourceDocument[] } {
  const referenceIds = new Set(analysis.dependencies.flatMap(({ reference_ids }) => reference_ids));
  const references = caseFile.value.source_references
    .filter(({ reference_id }) => referenceIds.has(reference_id))
    .sort((left, right) => compare(left.reference_id, right.reference_id));
  const versions = new Set(
    references.map(({ source_id, document_version_id }) =>
      sourceVersionKey({ source_id, document_version_id }),
    ),
  );
  const sources = caseFile.value.source_documents
    .filter((source) => versions.has(sourceVersionKey(source)))
    .sort((left, right) =>
      compare(sourceKey(sourceIdentity(left)), sourceKey(sourceIdentity(right))),
    );
  return { references, sources };
}

function analysisContext(analysis: DecisionAnalysis): Readonly<Record<string, unknown>> {
  return {
    analysis_id: analysis.analysis_id,
    applicability: analysis.applicability,
    change: analysis.change,
    intended_use: analysis.intended_use,
    kind: analysis.kind,
    previous_analysis_id: analysis.previous_analysis_id,
    prohibited_uses: analysis.prohibited_uses,
    question: analysis.question,
    unit: analysis.unit,
  };
}

function analysisProjection(
  caseFile: LoadedDecisionCase,
  analysis: DecisionAnalysis,
): Readonly<Record<string, unknown>> {
  const material = referencedMaterial(caseFile, analysis);
  return {
    case_id: caseFile.value.case_id,
    engine: caseFile.value.engine,
    context: analysisContext(analysis),
    mathematical_subject: analysis.mathematical_subject,
    dependencies: analysis.dependencies,
    model_mappings: analysis.model_mappings,
    references: material.references,
    sources: material.sources,
  };
}

function comparisonProjection(
  caseFile: LoadedDecisionCase,
  analysis: DecisionAnalysis,
): Readonly<Record<string, unknown>> {
  const material = referencedMaterial(caseFile, analysis);
  const dependencyFingerprints = semanticDependencyFingerprints(caseFile, analysis);
  return {
    engine: {
      ...caseFile.value.engine,
      supported_operations: [...caseFile.value.engine.supported_operations].sort(compare),
    },
    use: useProjection(analysis),
    mathematical_subject: analysis.mathematical_subject,
    dependencies: [...dependencyFingerprints.values()].sort(compare),
    model_mappings: analysis.model_mappings
      .map((mapping) => ({
        target: mapping.target,
        dependencies: mapping.dependency_ids
          .map((dependencyId) => dependencyFingerprints.get(dependencyId)!)
          .sort(compare),
      }))
      .sort((left, right) => compare(exactJsonKey(left), exactJsonKey(right))),
    references: material.references
      .map(referenceProjection)
      .sort((left, right) => compare(exactJsonKey(left), exactJsonKey(right))),
    sources: material.sources,
  };
}

function useProjection(analysis: DecisionAnalysis): Readonly<Record<string, unknown>> {
  return {
    intended_use: analysis.intended_use,
    prohibited_uses: analysis.prohibited_uses,
    question: analysis.question,
    unit: analysis.unit,
  };
}

function referenceProjection(reference: CaseSourceReference): Readonly<Record<string, unknown>> {
  const { reference_id: _localReferenceId, ...semanticReference } = reference;
  return semanticReference;
}

function semanticDependencyFingerprints(
  caseFile: LoadedDecisionCase,
  analysis: DecisionAnalysis,
): Map<string, string> {
  const dependencies = new Map(
    analysis.dependencies.map((dependency) => [dependency.dependency_id, dependency]),
  );
  const references = new Map(
    caseFile.value.source_references.map((reference) => [reference.reference_id, reference]),
  );
  const fingerprints = new Map<string, string>();
  const fingerprint = (dependencyId: string): string => {
    const prior = fingerprints.get(dependencyId);
    if (prior !== undefined) return prior;
    const dependency = dependencies.get(dependencyId)!;
    const value = exactJsonKey({
      role: dependency.role,
      kind: dependency.kind,
      description: dependency.description,
      rationale: dependency.rationale,
      depends_on: dependency.depends_on.map(fingerprint).sort(compare),
      references: dependency.reference_ids
        .map((referenceId) => referenceProjection(references.get(referenceId)!))
        .sort((left, right) => compare(exactJsonKey(left), exactJsonKey(right))),
    });
    fingerprints.set(dependencyId, value);
    return value;
  };
  for (const dependency of analysis.dependencies) fingerprint(dependency.dependency_id);
  return fingerprints;
}

function modellingChoices(analysis: DecisionAnalysis): CaseDependency[] {
  return analysis.dependencies.filter(
    ({ role, kind }) => role === "model_construction" && kind === "modelling_choice",
  );
}

function mathematicalSubjects(analysis: DecisionAnalysis): CaseDependency[] {
  return analysis.dependencies.filter(
    ({ role, kind }) => role === "model_construction" && kind === "mathematical_subject",
  );
}

function checkedUses(analysis: DecisionAnalysis): CaseDependency[] {
  return analysis.dependencies.filter(
    ({ role, kind }) => role === "checked_mathematical_use" && kind === "checked_use",
  );
}

function unmatchedAssumptions<T extends { fingerprint: string }>(
  candidates: readonly T[],
  other: readonly T[],
): T[] {
  const remaining = new Map<string, number>();
  for (const { fingerprint } of other) {
    remaining.set(fingerprint, (remaining.get(fingerprint) ?? 0) + 1);
  }
  return candidates.filter(({ fingerprint }) => {
    const count = remaining.get(fingerprint) ?? 0;
    if (count === 0) return true;
    remaining.set(fingerprint, count - 1);
    return false;
  });
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
      const assumptions = (entry: typeof left) => {
        const fingerprints = semanticDependencyFingerprints(entry.caseFile, entry.analysis);
        return modellingChoices(entry.analysis).map((dependency) => ({
          address: { ...entry.address, dependency_id: dependency.dependency_id },
          fingerprint: fingerprints.get(dependency.dependency_id)!,
        }));
      };
      const leftAssumptions = assumptions(left);
      const rightAssumptions = assumptions(right);
      const distinct = [
        ...unmatchedAssumptions(leftAssumptions, rightAssumptions).map(({ address }) => address),
        ...unmatchedAssumptions(rightAssumptions, leftAssumptions).map(({ address }) => address),
      ].sort((a, b) => compare(dependencyKey(a), dependencyKey(b)));
      const subjectEqual =
        left.analysis.mathematical_subject.problem.sha256 ===
          right.analysis.mathematical_subject.problem.sha256 &&
        left.analysis.mathematical_subject.query.sha256 ===
          right.analysis.mathematical_subject.query.sha256;
      const contextEqual =
        exactJsonKey(useProjection(left.analysis)) === exactJsonKey(useProjection(right.analysis));
      const declaredModelEqual =
        exactJsonKey(comparisonProjection(left.caseFile, left.analysis)) ===
        exactJsonKey(comparisonProjection(right.caseFile, right.analysis));
      differences.push({
        left: left.address,
        right: right.address,
        shared_sources: common,
        distinct_assumptions: distinct,
        mathematical_subject_equal: subjectEqual,
        declared_context_equal: contextEqual,
        status:
          common.length === 0
            ? ("not_established" as const)
            : declaredModelEqual
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
  const substantiveCount =
    revision.source_replacements.length +
    revision.withdrawn_sources.length +
    revision.withdrawn_dependencies.length +
    revision.withdrawn_routes.length +
    revision.conflicting_premises.length +
    revision.transitions.length;
  if (
    (revision.kind === "metadata_change" && substantiveCount !== 0) ||
    (revision.kind !== "metadata_change" && substantiveCount === 0)
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      revision.kind === "metadata_change"
        ? `Metadata revision ${revision.revision_id} cannot declare substantive source, dependency, route, conflict, or subject changes.`
        : `Substantive revision ${revision.revision_id} must declare at least one exact change.`,
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
  const withdrawnRoutes = new Set<string>();
  for (const route of revision.withdrawn_routes) {
    const key = exactJsonKey([route.bundle_id, route.route_id]);
    const bundle = workspace.value.bundles.find(({ bundle_id }) => bundle_id === route.bundle_id);
    if (
      bundle === undefined ||
      !bundle.inventory.support_routes.some(({ route_id }) => route_id === route.route_id) ||
      withdrawnRoutes.has(key)
    ) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_REVISION_INVALID",
        `Revision ${revision.revision_id} repeats or withdraws an unknown scoped support route.`,
      );
    }
    withdrawnRoutes.add(key);
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

function scopedRoute(
  bundleId: string,
  route: PortableBundleImport["inventory"]["support_routes"][number],
): ScopedSupportRoute {
  return {
    bundle_id: bundleId,
    route_id: route.route_id,
    statement_id: route.statement_id,
    statement_scope: route.statement_scope,
  };
}

function relevantSupportRoutes(
  bundle: PortableBundleImport,
  analysisId: string,
): PortableBundleImport["inventory"]["support_routes"] {
  return bundle.inventory.support_routes.filter(({ analysis_ids }) =>
    analysis_ids.includes(analysisId),
  );
}

function storedCheckEvidence(
  workspace: LoadedSharedAnalysis,
  analysis: AnalysisAddress,
  revisionId: string | null,
): AnalysisRevisionImpact["original_check_evidence"] {
  const portable = workspace.value.executions.find(
    (candidate) =>
      addressKey(candidate.analysis) === addressKey(analysis) &&
      candidate.revision_id === revisionId,
  );
  return portable === undefined
    ? { status: "absent", execution_sha256: null }
    : {
        status: "stored_candidate_unverified",
        execution_sha256: portable.execution.sha256,
      };
}

function reassessmentBasis(
  workspace: LoadedSharedAnalysis,
  revisionId: string,
  address: AnalysisAddress,
): ReassessmentBasis {
  const revision = workspace.value.revisions.find(({ revision_id }) => revision_id === revisionId);
  if (revision === undefined) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_NOT_FOUND",
      `Unknown revision ${revisionId}.`,
    );
  }
  const entry = analysisEntry(workspace, address);
  const transition = revision.transitions.find(
    ({ prior }) => addressKey(prior) === addressKey(address),
  );
  const targetCase =
    transition === undefined
      ? entry.caseFile
      : openDecisionCase(
          verifyEncodedBytes(transition.successor_case, `${revisionId}.successor_case`),
        );
  const targetAnalysis =
    transition === undefined
      ? entry.analysis
      : analysisById(targetCase, transition.successor_analysis_id);
  const priorMaterial = referencedMaterial(entry.caseFile, entry.analysis);
  const targetMaterial = referencedMaterial(targetCase, targetAnalysis);
  const routes = relevantSupportRoutes(entry.bundle, entry.analysis.analysis_id);
  const explicitWithdrawals = new Set(revision.withdrawn_routes.map(routeKey));
  const changedSourceKeys = new Set([
    ...revision.source_replacements.map(({ from }) => sourceKey(from)),
    ...revision.withdrawn_sources.map(sourceKey),
  ]);
  const removedRoutes = routes.filter(
    (route) =>
      explicitWithdrawals.has(
        routeKey({ bundle_id: entry.bundle.bundle_id, route_id: route.route_id }),
      ) || route.premise_sources.some((source) => changedSourceKeys.has(sourceKey(source))),
  );
  const removedRouteKeys = new Set(removedRoutes.map(({ route_id }) => route_id));
  const survivingRoutes = routes.filter(({ route_id }) => !removedRouteKeys.has(route_id));
  const priorSourceKeys = new Set([
    ...priorMaterial.sources.map((source) => sourceKey(sourceIdentity(source))),
    ...routes.flatMap(({ premise_sources }) => premise_sources.map(sourceKey)),
  ]);
  const relevantReplacements = revision.source_replacements.filter(({ from }) =>
    priorSourceKeys.has(sourceKey(from)),
  );
  const relevantWithdrawals = revision.withdrawn_sources.filter((source) =>
    priorSourceKeys.has(sourceKey(source)),
  );
  const relevantDependencies = revision.withdrawn_dependencies.filter(
    (dependency) => addressKey(dependency) === addressKey(address),
  );
  const routeStatements = new Set(
    routes.map(({ statement_id, statement_scope }) =>
      exactJsonKey([statement_id, statement_scope]),
    ),
  );
  const relevantConflicts = revision.conflicting_premises.filter(
    ({ statement_id, statement_scope }) =>
      routeStatements.has(exactJsonKey([statement_id, statement_scope])),
  );
  const sources = new Map<string, SourceIdentity>();
  for (const source of targetMaterial.sources) {
    const identity = sourceIdentity(source);
    sources.set(sourceKey(identity), identity);
  }
  for (const route of survivingRoutes) {
    for (const source of route.premise_sources) sources.set(sourceKey(source), source);
  }
  for (const replacement of relevantReplacements) {
    sources.delete(sourceKey(replacement.from));
    const identity = sourceIdentity(replacement.to);
    sources.set(sourceKey(identity), identity);
  }
  for (const source of relevantWithdrawals) sources.delete(sourceKey(source));
  const sourceBindings = [...sources.values()].sort((left, right) =>
    compare(sourceKey(left), sourceKey(right)),
  );
  const withdrawnDependencyIds = new Set(
    relevantDependencies.map(({ dependency_id }) => dependency_id),
  );
  const assumptionDependencies = modellingChoices(targetAnalysis)
    .filter(({ dependency_id }) => !withdrawnDependencyIds.has(dependency_id))
    .map(({ dependency_id }) => ({
      bundle_id: address.bundle_id,
      analysis_id: targetAnalysis.analysis_id,
      dependency_id,
    }))
    .sort((left, right) => compare(dependencyKey(left), dependencyKey(right)));
  const scopedRoutes = survivingRoutes
    .map((route) => scopedRoute(address.bundle_id, route))
    .sort((left, right) => compare(routeKey(left), routeKey(right)));
  const priorProjection = analysisProjection(entry.caseFile, entry.analysis);
  const targetProjection = analysisProjection(targetCase, targetAnalysis);
  const revisionEffect = {
    revision_id: revision.revision_id,
    kind: revision.kind,
    source_replacements: relevantReplacements,
    withdrawn_sources: relevantWithdrawals,
    withdrawn_dependencies: relevantDependencies,
    withdrawn_routes: removedRoutes.map((route) => ({
      bundle_id: address.bundle_id,
      route_id: route.route_id,
      statement_id: route.statement_id,
      statement_scope: route.statement_scope,
    })),
    conflicting_premises: relevantConflicts,
    transition:
      transition === undefined
        ? null
        : {
            prior: transition.prior,
            successor_case_id: targetCase.value.case_id,
            successor_analysis_id: transition.successor_analysis_id,
            successor_analysis_sha256: digest(targetProjection),
          },
  };
  const basisWithoutIdentity = {
    revision_id: revision.revision_id,
    analysis: address,
    target:
      transition === undefined ? ("original_analysis" as const) : ("declared_successor" as const),
    target_analysis_id: targetAnalysis.analysis_id,
    dependency_scope: {
      scope: entry.bundle.inventory.scope,
      completeness: entry.bundle.inventory.completeness,
      unresolved_references: [...entry.bundle.inventory.unresolved_references],
    },
    mathematical_subject: {
      problem_sha256: targetAnalysis.mathematical_subject.problem.sha256,
      query_sha256: targetAnalysis.mathematical_subject.query.sha256,
    },
    intended_use: targetAnalysis.intended_use,
    unit: targetAnalysis.unit,
    source_bindings: sourceBindings,
    source_references: targetMaterial.references,
    assumption_dependencies: assumptionDependencies,
    support_routes: scopedRoutes,
    prior_analysis_sha256: digest(priorProjection),
    target_analysis_sha256: digest(targetProjection),
    mapping_sha256: digest(targetAnalysis.model_mappings),
    context_sha256: digest(analysisContext(targetAnalysis)),
    derivation_sha256: digest({
      dependencies: targetAnalysis.dependencies,
      model_mappings: targetAnalysis.model_mappings,
      support_routes: scopedRoutes,
    }),
    revision_effect_sha256: digest(revisionEffect),
  };
  return deepFreeze({
    ...basisWithoutIdentity,
    basis_sha256: digest(basisWithoutIdentity),
  });
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
  const impacts: AnalysisRevisionImpact[] = selected(workspace).map((entry) => {
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
    const relevantRoutes = relevantSupportRoutes(entry.bundle, entry.analysis.analysis_id);
    const withdrawnSourceKeys = new Set(changedSources.map(sourceKey));
    const explicitWithdrawals = new Set(revision.withdrawn_routes.map(routeKey));
    const withdrawnRoutes = relevantRoutes
      .filter(
        (route) =>
          explicitWithdrawals.has(
            routeKey({ bundle_id: entry.bundle.bundle_id, route_id: route.route_id }),
          ) || route.premise_sources.some((source) => withdrawnSourceKeys.has(sourceKey(source))),
      )
      .map((route) => scopedRoute(entry.bundle.bundle_id, route))
      .sort((left, right) => compare(routeKey(left), routeKey(right)));
    const withdrawnRouteKeys = new Set(withdrawnRoutes.map(routeKey));
    const withdrawnStatements = new Set(
      withdrawnRoutes.map(({ statement_id, statement_scope }) =>
        exactJsonKey([statement_id, statement_scope]),
      ),
    );
    const survivingRoutes = relevantRoutes
      .filter(
        (route) =>
          !withdrawnRouteKeys.has(
            routeKey({ bundle_id: entry.bundle.bundle_id, route_id: route.route_id }),
          ) && withdrawnStatements.has(exactJsonKey([route.statement_id, route.statement_scope])),
      )
      .map((route) => scopedRoute(entry.bundle.bundle_id, route))
      .sort((left, right) => compare(routeKey(left), routeKey(right)));
    const relevantStatements = new Set(
      relevantRoutes.map(({ statement_id, statement_scope }) =>
        exactJsonKey([statement_id, statement_scope]),
      ),
    );
    const visibleConflicts = revision.conflicting_premises.filter(
      ({ statement_id, statement_scope }) =>
        relevantStatements.has(exactJsonKey([statement_id, statement_scope])),
    );
    const affected =
      direct.size > 0 ||
      transition !== undefined ||
      withdrawnRoutes.length > 0 ||
      visibleConflicts.length > 0;
    const status =
      revision.kind === "metadata_change"
        ? ("unaffected" as const)
        : affected
          ? ("affected" as const)
          : entry.bundle.inventory.completeness === "complete"
            ? ("unaffected" as const)
            : ("not_established" as const);
    let successorSubjectStatus: AnalysisRevisionImpact["successor_subject_status"];
    if (transition !== undefined) {
      const next = openDecisionCase(
        verifyEncodedBytes(transition.successor_case, `${revisionId}.successor_case`),
      );
      successorSubjectStatus = assessReuse(
        entry.caseFile,
        entry.address.analysis_id,
        next,
        transition.successor_analysis_id,
      ).mathematical_subject_changed
        ? "changed_subject"
        : "identical_subject";
    } else {
      successorSubjectStatus =
        status === "affected" || status === "not_established"
          ? "not_established"
          : "not_applicable";
    }
    const checkedUseIds = checkedUses(entry.analysis).map(({ dependency_id }) => dependency_id);
    const subjectIds = mathematicalSubjects(entry.analysis).map(
      ({ dependency_id }) => dependency_id,
    );
    const derivationPaths: DerivationPath[] = [...direct].sort(compare).flatMap((dependencyId) => {
      const toCheckedUse = checkedUseIds.flatMap((checkedUseId) =>
        lineage.paths(dependencyId, checkedUseId),
      );
      const paths =
        toCheckedUse.length > 0
          ? toCheckedUse
          : subjectIds.flatMap((subjectId) => lineage.paths(dependencyId, subjectId));
      return (paths.length > 0 ? paths : [[dependencyId]]).map((nodes) => ({
        analysis: entry.address,
        nodes,
      }));
    });
    const uniquePaths = new Map(
      derivationPaths.map((path) => [exactJsonKey([path.analysis, path.nodes]), path]),
    );
    const basis = reassessmentBasis(workspace, revisionId, entry.address);
    return {
      analysis: entry.address,
      status,
      direct_dependencies: [...direct].sort(compare),
      derivation_paths: [...uniquePaths.values()].sort((left, right) =>
        compare(exactJsonKey(left.nodes), exactJsonKey(right.nodes)),
      ),
      original_subject_status: "preserved",
      original_check_evidence: storedCheckEvidence(workspace, entry.address, null),
      successor_subject_status: successorSubjectStatus,
      successor_check_evidence:
        transition === undefined
          ? { status: "absent", execution_sha256: null }
          : storedCheckEvidence(workspace, entry.address, revisionId),
      applicability_requires_reassessment: status !== "unaffected",
      reassessment_basis_sha256: basis.basis_sha256,
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
  const impactSha256 = digest({ revision, inventory_scope: inventoryScope, impacts });
  return deepFreeze({
    revision_id: revisionId,
    impact_sha256: impactSha256,
    inventory_scope: inventoryScope,
    impacts,
  });
}

function validateAssessment(
  workspace: LoadedSharedAnalysis,
  assessment: ApplicabilityAssessmentDeclaration,
): void {
  const impact = revisionImpact(workspace, assessment.revision_id);
  const basis = reassessmentBasis(workspace, assessment.revision_id, assessment.analysis);
  if (assessment.basis_sha256 !== basis.basis_sha256) {
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
  if (
    exactJsonKey(assessment.source_bindings) !== exactJsonKey(basis.source_bindings) ||
    exactJsonKey(assessment.assumption_dependencies) !== exactJsonKey(basis.assumption_dependencies)
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REASSESSMENT_STALE",
      `Assessment ${assessment.assessment_id} does not bind the exact derived source and assumption basis.`,
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
    const basis = reassessmentBasis(workspace, portable.revision_id, portable.analysis);
    const supported = workspace.value.applicability_assessments.some(
      (assessment) =>
        assessment.revision_id === portable.revision_id &&
        addressKey(assessment.analysis) === addressKey(portable.analysis) &&
        assessment.basis_sha256 === basis.basis_sha256 &&
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

function appendExecution(
  workspace: LoadedSharedAnalysis,
  portable: SharedAnalysisArchive["executions"][number],
): LoadedSharedAnalysis {
  validateExecution(workspace, portable);
  const byKey = new Map(
    workspace.value.executions.map((item) => [revisionExecutionKey(item), item]),
  );
  const key = revisionExecutionKey(portable);
  const prior = byKey.get(key);
  if (prior !== undefined) {
    if (exactJsonKey(prior) === exactJsonKey(portable)) return workspace;
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REVISION_INVALID",
      "The archive already contains different execution bytes for this analysis revision.",
    );
  }
  byKey.set(key, portable);
  return validatedSnapshot({
    ...workspace.value,
    executions: [...byKey.values()].sort(
      (left, right) =>
        compare(left.analysis.bundle_id, right.analysis.bundle_id) ||
        compare(left.analysis.analysis_id, right.analysis.analysis_id) ||
        compare(left.revision_id ?? "", right.revision_id ?? ""),
    ),
  });
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

/** Derive the exact, reviewable source/assumption/model basis for one reassessment. */
export function deriveReassessmentBasis(
  workspace: LoadedSharedAnalysis,
  revisionId: string,
  analysis: AnalysisAddress,
): ReassessmentBasis {
  assertLoaded(workspace);
  return reassessmentBasis(workspace, revisionId, analysis);
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

/** Attach an existing exact execution to its imported original analysis for recipient replay. */
export function attachDecisionExecution(
  workspace: LoadedSharedAnalysis,
  analysis: AnalysisAddress,
  rawExecution: Uint8Array,
): LoadedSharedAnalysis {
  assertLoaded(workspace);
  return appendExecution(workspace, {
    analysis,
    revision_id: null,
    execution: encodedBytes(new Uint8Array(rawExecution)),
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
  const basis = reassessmentBasis(workspace, request.revision_id, request.prior).basis_sha256;
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
  return {
    workspace: appendExecution(workspace, portable),
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
      revision_id: portable.revision_id,
      execution_sha256: portable.execution.sha256,
      case_sha256: execution.case_sha256,
      analysis_sha256: execution.analysis_sha256,
      problem_sha256: execution.problem_sha256,
      query_sha256: execution.query_sha256,
      candidate_sha256: execution.candidate_result.sha256,
      mathematical_status: checked.status,
    };
  });
  return deepFreeze({
    archive_sha256: workspace.archive_sha256,
    revision_impacts: revisionImpacts,
    freshly_checked: freshlyChecked,
  });
}
