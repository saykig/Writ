import {
  sha256Bytes,
  sha256Utf8Text,
  verifyEvidenceReferences,
  type DeclaredTextReference,
  type SourceVersionDeclaration,
} from "@writ/provenance";

import { DecisionCaseError } from "./errors.js";
import { decodeBase64Exact, exactJsonBytes, verifyEncodedBytes } from "./identity.js";
import type {
  CaseDependency,
  DecisionAnalysis,
  DecisionCase,
  LoadedDecisionCase,
  MathematicalOperation,
  ReuseAssessment,
} from "./types.js";

const EXPECTED_COMMIT = "7215b53096bc487756f94f4ca87390716a14f2ee";
const OPERATIONS = new Set<MathematicalOperation>(["compatibility", "decision"]);

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} must be a non-empty string.`);
  }
  sha256Utf8Text(value);
  return value;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} must be an array.`);
  }
  return value;
}

function jsonObject(bytes: Uint8Array, field: string): Record<string, unknown> {
  try {
    return object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), field);
  } catch (error) {
    if (error instanceof DecisionCaseError) throw error;
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} is not valid UTF-8 JSON.`);
  }
}

function uniqueIds(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new DecisionCaseError("DECISION_CASE_INVALID", `${field} contains duplicate IDs.`);
  }
}

function validateDependencies(
  dependencies: readonly CaseDependency[],
  referenceIds: ReadonlySet<string>,
): void {
  const ids = dependencies.map((item) => string(item.dependency_id, "dependency_id"));
  uniqueIds(ids, "dependencies");
  const known = new Set(ids);
  for (const dependency of dependencies) {
    if (
      !["source_support", "model_construction", "checked_mathematical_use"].includes(
        dependency.role,
      ) ||
      ![
        "synthetic_supplied_value",
        "deterministic_transformation",
        "modelling_choice",
        "mathematical_subject",
        "checked_use",
      ].includes(dependency.kind)
    ) {
      throw new DecisionCaseError(
        "DECISION_CASE_DEPENDENCY_INVALID",
        `Dependency ${dependency.dependency_id} has an unsupported role or kind.`,
      );
    }
    string(dependency.description, `${dependency.dependency_id}.description`);
    string(dependency.rationale, `${dependency.dependency_id}.rationale`);
    for (const parent of dependency.depends_on) {
      if (!known.has(parent)) {
        throw new DecisionCaseError(
          "DECISION_CASE_DEPENDENCY_INVALID",
          `Dependency ${dependency.dependency_id} names missing parent ${parent}.`,
        );
      }
    }
    for (const referenceId of dependency.reference_ids) {
      if (!referenceIds.has(referenceId)) {
        throw new DecisionCaseError(
          "DECISION_CASE_DEPENDENCY_INVALID",
          `Dependency ${dependency.dependency_id} names missing reference ${referenceId}.`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(dependencies.map((item) => [item.dependency_id, item]));
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      throw new DecisionCaseError(
        "DECISION_CASE_DEPENDENCY_CYCLE",
        `Dependency cycle reaches ${id}.`,
      );
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of byId.get(id)!.depends_on) visit(parent);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

function expectedMappingTargets(
  problem: Record<string, unknown>,
  query: Record<string, unknown>,
): Set<string> {
  const targets = new Set([
    "problem.family_kind",
    "problem.states",
    "query.operation",
    "query.unit",
  ]);
  for (const collection of ["equalities", "inequalities"] as const) {
    for (const [index, rawRow] of array(problem[collection], `problem.${collection}`).entries()) {
      const row = object(rawRow, `problem.${collection}[${index}]`);
      targets.add(
        `problem.${collection}:${string(row.label, `problem.${collection}[${index}].label`)}`,
      );
    }
  }
  if (query.operation === "decision") {
    for (const [index, rawAction] of array(query.actions, "query.actions").entries()) {
      const action = object(rawAction, `query.actions[${index}]`);
      targets.add(`query.action:${string(action.label, `query.actions[${index}].label`)}`);
    }
  }
  return targets;
}

function validateAnalysis(
  analysis: DecisionAnalysis,
  supportedOperations: ReadonlySet<MathematicalOperation>,
  referenceIds: ReadonlySet<string>,
): void {
  string(analysis.analysis_id, "analysis_id");
  string(analysis.question, `${analysis.analysis_id}.question`);
  string(analysis.unit, `${analysis.analysis_id}.unit`);
  const problemBytes = verifyEncodedBytes(
    analysis.mathematical_subject.problem,
    `${analysis.analysis_id}.problem`,
  );
  const queryBytes = verifyEncodedBytes(
    analysis.mathematical_subject.query,
    `${analysis.analysis_id}.query`,
  );
  const problem = jsonObject(problemBytes, `${analysis.analysis_id}.problem`);
  const query = jsonObject(queryBytes, `${analysis.analysis_id}.query`);
  if (
    problem.semantics !== "finite-linear-uncertainty.v1" ||
    query.semantics !== "finite-linear-uncertainty.v1"
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_UNSUPPORTED_SEMANTICS",
      `Analysis ${analysis.analysis_id} does not use finite-linear-uncertainty.v1.`,
    );
  }
  if (
    typeof query.operation !== "string" ||
    !OPERATIONS.has(query.operation as MathematicalOperation)
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_UNSUPPORTED_OPERATION",
      `Analysis ${analysis.analysis_id} requests unsupported operation ${String(query.operation)}.`,
    );
  }
  if (!supportedOperations.has(query.operation as MathematicalOperation)) {
    throw new DecisionCaseError(
      "DECISION_CASE_UNSUPPORTED_OPERATION",
      `Analysis ${analysis.analysis_id} requests an operation absent from the pinned adapter contract.`,
    );
  }
  if (
    (query.operation === "decision" && analysis.intended_use !== "static_expected_loss_decision") ||
    (query.operation === "compatibility" && analysis.intended_use !== "compatibility_check")
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      `Analysis ${analysis.analysis_id} has an operation/use mismatch.`,
    );
  }
  validateDependencies(analysis.dependencies, referenceIds);
  const dependencyIds = new Set(analysis.dependencies.map(({ dependency_id }) => dependency_id));
  const actualTargets = new Set<string>();
  for (const mapping of analysis.model_mappings) {
    const target = string(mapping.target, `${analysis.analysis_id}.model_mappings.target`);
    if (actualTargets.has(target)) {
      throw new DecisionCaseError(
        "DECISION_CASE_MODEL_INPUT_UNDECLARED",
        `Analysis ${analysis.analysis_id} repeats model mapping ${target}.`,
      );
    }
    actualTargets.add(target);
    if (
      mapping.dependency_ids.length === 0 ||
      mapping.dependency_ids.some((id) => !dependencyIds.has(id))
    ) {
      throw new DecisionCaseError(
        "DECISION_CASE_MODEL_INPUT_UNDECLARED",
        `Analysis ${analysis.analysis_id} has an unresolved model mapping for ${target}.`,
      );
    }
  }
  const expectedTargets = expectedMappingTargets(problem, query);
  const missing = [...expectedTargets].filter((target) => !actualTargets.has(target)).sort();
  const extra = [...actualTargets].filter((target) => !expectedTargets.has(target)).sort();
  if (missing.length > 0 || extra.length > 0) {
    throw new DecisionCaseError(
      "DECISION_CASE_MODEL_INPUT_UNDECLARED",
      `Analysis ${analysis.analysis_id} model mappings do not exactly cover its subject.`,
      { missing, extra },
    );
  }
  if (
    analysis.human_review.disposition === "accepted" &&
    (analysis.human_review.reviewer === null || analysis.human_review.reviewer.length === 0)
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      `Analysis ${analysis.analysis_id} cannot claim acceptance without a reviewer.`,
    );
  }
  if (analysis.human_review.disposition !== "accepted" && analysis.human_review.reviewer !== null) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      `Analysis ${analysis.analysis_id} cannot attach a reviewer to ${analysis.human_review.disposition}.`,
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function openDecisionCaseUnchecked(rawBytes: Uint8Array): LoadedDecisionCase {
  const snapshot = new Uint8Array(rawBytes);
  const value = jsonObject(snapshot, "case") as unknown as DecisionCase;
  if (
    value.engine === null ||
    typeof value.engine !== "object" ||
    Array.isArray(value.engine) ||
    !Array.isArray(value.engine.supported_operations) ||
    !Array.isArray(value.source_documents) ||
    value.source_documents.length === 0 ||
    !Array.isArray(value.source_references) ||
    value.source_references.length === 0 ||
    !Array.isArray(value.analyses) ||
    value.analyses.length === 0 ||
    value.interpretation_control === null ||
    typeof value.interpretation_control !== "object" ||
    !Array.isArray(value.interpretation_control.alternative_scenarios)
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      "Decision case is missing a required portable runtime structure.",
    );
  }
  if (
    value.schema_version !== "0.1.0" ||
    value.case_kind !== "derived_decision_case" ||
    value.engine?.adapter !== "writ-decision-lab-python.v1" ||
    value.engine.repository !== "https://github.com/saykig/writ-decision-lab" ||
    value.engine.commit !== EXPECTED_COMMIT ||
    value.engine.semantics !== "finite-linear-uncertainty.v1" ||
    value.engine.runtime !== "CPython 3.13" ||
    value.engine.dependency !== "scipy==1.17.0"
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_UNSUPPORTED_SEMANTICS",
      "Decision case does not declare the exact supported schema and pinned engine contract.",
    );
  }
  string(value.case_id, "case_id");
  string(value.title, "title");
  const supportedOperations = new Set(value.engine.supported_operations);
  if (
    supportedOperations.size !== value.engine.supported_operations.length ||
    [...supportedOperations].some((operation) => !OPERATIONS.has(operation))
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_UNSUPPORTED_OPERATION",
      "Decision case declares an unsupported adapter operation.",
    );
  }

  const authority: SourceVersionDeclaration[] = [];
  const sourceByKey = new Map<string, Uint8Array>();
  const sourceIds: string[] = [];
  for (const [index, source] of value.source_documents.entries()) {
    const sourceId = string(source.source_id, `source_documents[${index}].source_id`);
    const versionId = string(
      source.document_version_id,
      `source_documents[${index}].document_version_id`,
    );
    const bytes = verifyEncodedBytes(source, `source_documents[${index}]`);
    const key = `${sourceId}\u0000${versionId}`;
    sourceIds.push(key);
    sourceByKey.set(key, bytes);
    authority.push({
      source_id: sourceId,
      document_version_id: versionId,
      document_hash: source.sha256,
    });
  }
  uniqueIds(sourceIds, "source_documents");

  const referenceIds = new Set<string>();
  const declaredReferences: DeclaredTextReference[] = [];
  for (const [index, reference] of value.source_references.entries()) {
    const referenceId = string(reference.reference_id, `source_references[${index}].reference_id`);
    if (referenceIds.has(referenceId)) {
      throw new DecisionCaseError(
        "DECISION_CASE_INVALID",
        `Duplicate reference ID ${referenceId}.`,
      );
    }
    referenceIds.add(referenceId);
    const bytes = sourceByKey.get(`${reference.source_id}\u0000${reference.document_version_id}`);
    if (bytes === undefined || reference.document_hash !== sha256Bytes(bytes)) {
      throw new DecisionCaseError(
        "DECISION_CASE_EVIDENCE_SOURCE_MISMATCH",
        `Reference ${referenceId} does not resolve to its exact source bytes.`,
      );
    }
    const { start, end } = reference.byte_span;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > bytes.length
    ) {
      throw new DecisionCaseError(
        "DECISION_CASE_EVIDENCE_SPAN_MISMATCH",
        `Reference ${referenceId} has an invalid byte span.`,
      );
    }
    const quoteBytes = new TextEncoder().encode(reference.quote);
    const selected = bytes.slice(start, end);
    if (!Buffer.from(selected).equals(Buffer.from(quoteBytes))) {
      throw new DecisionCaseError(
        "DECISION_CASE_EVIDENCE_SPAN_MISMATCH",
        `Reference ${referenceId} quote does not occur at its declared exact byte span.`,
      );
    }
    declaredReferences.push(reference);
  }
  const referenceDiagnostics = verifyEvidenceReferences(declaredReferences, authority);
  if (referenceDiagnostics.length > 0) {
    throw new DecisionCaseError(
      "DECISION_CASE_EVIDENCE_SOURCE_MISMATCH",
      "One or more declared references fail Writ provenance verification.",
      { diagnostics: referenceDiagnostics },
    );
  }

  const analysisIds = value.analyses.map(({ analysis_id }) => analysis_id);
  uniqueIds(analysisIds, "analyses");
  const analyses = new Set(analysisIds);
  for (const analysis of value.analyses) {
    validateAnalysis(analysis, supportedOperations, referenceIds);
    if (analysis.previous_analysis_id !== null && !analyses.has(analysis.previous_analysis_id)) {
      throw new DecisionCaseError(
        "DECISION_CASE_INVALID",
        `Analysis ${analysis.analysis_id} has a missing predecessor.`,
      );
    }
    const dependencyIds = new Set(analysis.dependencies.map(({ dependency_id }) => dependency_id));
    for (const changed of [
      ...analysis.change.changed_dependencies,
      ...analysis.applicability.changed_dependencies,
    ]) {
      if (!dependencyIds.has(changed)) {
        throw new DecisionCaseError(
          "DECISION_CASE_DEPENDENCY_INVALID",
          `Analysis ${analysis.analysis_id} names unknown changed dependency ${changed}.`,
        );
      }
    }
  }
  for (const id of [
    ...value.interpretation_control.alternative_scenarios,
    value.interpretation_control.simultaneous_constraints,
  ]) {
    if (!analyses.has(id)) {
      throw new DecisionCaseError(
        "DECISION_CASE_INVALID",
        `Interpretation control names missing analysis ${id}.`,
      );
    }
  }

  return deepFreeze({
    value: deepFreeze(value),
    raw_base64: Buffer.from(snapshot).toString("base64"),
    case_sha256: sha256Bytes(snapshot),
  });
}

/** Parse a portable case and collapse malformed runtime shapes into the stable invalid-case code. */
export function openDecisionCase(rawBytes: Uint8Array): LoadedDecisionCase {
  try {
    return openDecisionCaseUnchecked(rawBytes);
  } catch (error) {
    if (error instanceof DecisionCaseError) throw error;
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      "Decision case does not satisfy the portable runtime contract.",
    );
  }
}

export function exportDecisionCase(caseFile: LoadedDecisionCase): Uint8Array {
  return decodeBase64Exact(caseFile.raw_base64, "case.raw_base64");
}

export function analysisById(caseFile: LoadedDecisionCase, analysisId: string): DecisionAnalysis {
  const analysis = caseFile.value.analyses.find((item) => item.analysis_id === analysisId);
  if (analysis === undefined) {
    throw new DecisionCaseError(
      "DECISION_CASE_ANALYSIS_NOT_FOUND",
      `Decision case has no analysis ${analysisId}.`,
    );
  }
  return analysis;
}

export function mathematicalBytes(analysis: DecisionAnalysis): {
  problem: Uint8Array;
  query: Uint8Array;
} {
  return {
    problem: decodeBase64Exact(analysis.mathematical_subject.problem.content, "problem.content"),
    query: decodeBase64Exact(analysis.mathematical_subject.query.content, "query.content"),
  };
}

/** Bind the selected analysis and its referenced sources without coupling it to unrelated case content. */
export function analysisBindingHash(
  caseFile: LoadedDecisionCase,
  analysis: DecisionAnalysis,
): string {
  const referenceIds = new Set(analysis.dependencies.flatMap(({ reference_ids }) => reference_ids));
  const compare = (left: string, right: string): number =>
    left < right ? -1 : left > right ? 1 : 0;
  const references = caseFile.value.source_references
    .filter(({ reference_id }) => referenceIds.has(reference_id))
    .sort((left, right) => compare(left.reference_id, right.reference_id));
  const sourceKeys = new Set(
    references.map(
      ({ source_id, document_version_id }) => `${source_id}\u0000${document_version_id}`,
    ),
  );
  const sources = caseFile.value.source_documents
    .filter(({ source_id, document_version_id }) =>
      sourceKeys.has(`${source_id}\u0000${document_version_id}`),
    )
    .sort((left, right) =>
      compare(
        `${left.source_id}\u0000${left.document_version_id}`,
        `${right.source_id}\u0000${right.document_version_id}`,
      ),
    );
  return sha256Bytes(
    exactJsonBytes({ analysis, engine: caseFile.value.engine, references, sources }),
  );
}

export function assessReuse(
  priorCase: LoadedDecisionCase,
  priorAnalysisId: string,
  nextCase: LoadedDecisionCase,
  nextAnalysisId: string,
): ReuseAssessment {
  const prior = analysisById(priorCase, priorAnalysisId);
  const next = analysisById(nextCase, nextAnalysisId);
  const subjectChanged =
    prior.mathematical_subject.problem.sha256 !== next.mathematical_subject.problem.sha256 ||
    prior.mathematical_subject.query.sha256 !== next.mathematical_subject.query.sha256;
  const referenceFingerprint = (caseFile: LoadedDecisionCase, referenceId: string): string => {
    const reference = caseFile.value.source_references.find(
      ({ reference_id }) => reference_id === referenceId,
    )!;
    return [
      reference.reference_id,
      reference.source_id,
      reference.document_version_id,
      reference.document_hash,
      reference.passage_hash,
      String(reference.byte_span.start),
      String(reference.byte_span.end),
    ].join("\u0000");
  };
  const applicabilityFingerprints = (
    caseFile: LoadedDecisionCase,
    analysis: DecisionAnalysis,
  ): Map<string, string> =>
    new Map(
      analysis.dependencies
        .filter(({ role }) => role !== "checked_mathematical_use")
        .map((dependency) => [
          dependency.dependency_id,
          [
            dependency.role,
            dependency.kind,
            dependency.description,
            dependency.rationale,
            ...dependency.depends_on.slice().sort(),
            ...dependency.reference_ids.map((id) => referenceFingerprint(caseFile, id)).sort(),
          ].join("\u0001"),
        ]),
    );
  const priorSupport = applicabilityFingerprints(priorCase, prior);
  const nextSupport = applicabilityFingerprints(nextCase, next);
  const applicabilityChanged =
    priorSupport.size !== nextSupport.size ||
    [...priorSupport.keys()].some((id) => priorSupport.get(id) !== nextSupport.get(id));
  const changedSupportDependencies = [...new Set([...priorSupport.keys(), ...nextSupport.keys()])]
    .filter((id) => priorSupport.get(id) !== nextSupport.get(id))
    .sort();
  const changedDependencies = [
    ...new Set([...next.change.changed_dependencies, ...changedSupportDependencies]),
  ].sort();
  return deepFreeze({
    prior_analysis_id: priorAnalysisId,
    next_analysis_id: nextAnalysisId,
    mathematical_subject_changed: subjectChanged,
    applicability_changed: applicabilityChanged,
    changed_dependencies: changedDependencies,
    mathematical_check_reusable: !subjectChanged,
    applicability_requires_reassessment:
      applicabilityChanged || next.applicability.status !== "supported",
  });
}
