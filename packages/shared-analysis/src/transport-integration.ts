import {
  encodedBytes,
  exactJsonBytes,
  exactJsonKey,
  verifyEncodedBytes,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import {
  assessRevision,
  deriveReassessmentBasis,
  exportSharedAnalysis,
  openSharedAnalysis,
} from "./contract.js";
import { SharedAnalysisError } from "./errors.js";
import {
  checkCertificateTransportBytes,
  parseTransportCheck,
  produceCertificateTransport,
} from "./transport-engine.js";
import { assertCertificateTransportRecord } from "./transport-schema-validation.js";
import {
  CERTIFICATE_TRANSPORT_RECORD_KIND,
  CERTIFICATE_TRANSPORT_RECORD_SCHEMA_VERSION,
  DECISION_LAB_TRANSPORT_COMMIT,
  DECISION_LAB_TRANSPORT_GUARANTEE,
  DECISION_LAB_TRANSPORT_INTERFACE,
  type CertificateTransportModelBinding,
  type CertificateTransportRecord,
  type CertificateTransportReplay,
  type LoadedCertificateTransportRecord,
  type TransportEngineOptions,
} from "./transport-types.js";
import type { AnalysisAddress, LoadedSharedAnalysis } from "./types.js";

const MAX_RECORD_BYTES = 12 * 1024 * 1024;
const REQUEST_PATH = /^\$\.target(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[[0-9]+\]))+$/;

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

function addressKey(address: AnalysisAddress): string {
  return exactJsonKey([address.bundle_id, address.analysis_id]);
}

function shaWithoutPrefix(value: string): string {
  return value.startsWith("sha256:") ? value.slice("sha256:".length) : "";
}

function parseJsonObject(bytes: Uint8Array, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      `${label} is not valid UTF-8 JSON.`,
    );
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      `${label} root must be an object.`,
    );
  }
  return value as Record<string, unknown>;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      `${label} must be an object.`,
    );
  }
  return value as Record<string, unknown>;
}

function parseCanonicalRecord(bytes: Uint8Array): CertificateTransportRecord {
  if (bytes.length === 0 || bytes.length > MAX_RECORD_BYTES) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      `Certificate transport record must contain 1 to ${MAX_RECORD_BYTES} bytes.`,
    );
  }
  const value = parseJsonObject(bytes, "Certificate transport record");
  assertCertificateTransportRecord(value);
  if (Buffer.from(exactJsonBytes(value)).compare(Buffer.from(bytes)) !== 0) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Certificate transport record is not deterministic exact JSON.",
    );
  }
  return value;
}

function mathematicalSubjectProjection(subject: Record<string, unknown>): Record<string, unknown> {
  const { name: _name, premises: _premises, ...mathematical } = subject;
  return mathematical;
}

function requestComponents(requestBytes: Uint8Array): {
  request: Record<string, unknown>;
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  sourceSubject: Record<string, unknown>;
  targetSubject: Record<string, unknown>;
  sourcePolicy: Record<string, unknown>;
  targetPolicy: Record<string, unknown>;
  sourceCertificate: Record<string, unknown>;
} {
  const request = parseJsonObject(requestBytes, "Certificate transport request");
  const source = requireObject(request.source, "Certificate transport source");
  const target = requireObject(request.target, "Certificate transport target");
  return {
    request,
    source,
    target,
    sourceSubject: requireObject(source.subject, "Certificate transport source subject"),
    targetSubject: requireObject(target.subject, "Certificate transport target subject"),
    sourcePolicy: requireObject(source.policy, "Certificate transport source policy"),
    targetPolicy: requireObject(target.policy, "Certificate transport target policy"),
    sourceCertificate: requireObject(
      source.certificate,
      "Certificate transport source certificate",
    ),
  };
}

function requireSubstantiveTransportRequest(requestBytes: Uint8Array): Record<string, unknown> {
  const components = requestComponents(requestBytes);
  const subjectChanged =
    exactJsonKey(mathematicalSubjectProjection(components.sourceSubject)) !==
    exactJsonKey(mathematicalSubjectProjection(components.targetSubject));
  const policyChanged =
    exactJsonKey(components.sourcePolicy) !== exactJsonKey(components.targetPolicy);
  if (!subjectChanged && !policyChanged) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "This integration requires a substantive target model or policy revision, not a label-only or no-op transport.",
    );
  }
  return components.request;
}

function pathTokens(path: string): Array<string | number> {
  if (!REQUEST_PATH.test(path)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      `Transport changed-request field ${path} is not a supported exact target path.`,
    );
  }
  const tokens: Array<string | number> = ["target"];
  const rest = path.slice("$.target".length);
  const matcher = /\.([A-Za-z_][A-Za-z0-9_]*)|\[([0-9]+)\]/g;
  for (const match of rest.matchAll(matcher)) {
    tokens.push(match[1] ?? Number(match[2]));
  }
  return tokens;
}

function lookup(root: unknown, tokens: readonly (string | number)[]): unknown {
  let current = root;
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(current) || token >= current.length) return undefined;
      current = current[token];
    } else {
      if (current === null || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[token];
    }
  }
  return current;
}

function supportContext(
  workspace: LoadedSharedAnalysis,
  revisionId: string,
  analysis: AnalysisAddress,
  applicabilityAssessmentId: string,
) {
  const impact = assessRevision(workspace, revisionId);
  const scoped = impact.impacts.find(
    (candidate) => addressKey(candidate.analysis) === addressKey(analysis),
  );
  if (
    scoped === undefined ||
    scoped.status !== "affected" ||
    !scoped.applicability_requires_reassessment ||
    scoped.successor_subject_status !== "changed_subject"
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Certificate transport requires an affected analysis with a declared changed successor subject.",
    );
  }
  const basis = deriveReassessmentBasis(workspace, revisionId, analysis);
  const assessment = workspace.value.applicability_assessments.find(
    ({ assessment_id }) => assessment_id === applicabilityAssessmentId,
  );
  if (
    assessment === undefined ||
    assessment.revision_id !== revisionId ||
    addressKey(assessment.analysis) !== addressKey(analysis) ||
    assessment.basis_sha256 !== basis.basis_sha256 ||
    assessment.status !== "supported"
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_REASSESSMENT_REQUIRED",
      "A current supported applicability reassessment is required before transporting a successor guarantee.",
    );
  }
  return { impact, basis };
}

function normalizedModelBinding(
  declaration: CertificateTransportModelBinding,
  request: Record<string, unknown>,
): CertificateTransportModelBinding {
  if (
    declaration.rationale.trim().length === 0 ||
    declaration.changed_request_fields.length === 0
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Transport model binding needs a rationale and at least one explicitly changed request field.",
    );
  }
  const fields = [...declaration.changed_request_fields];
  if (fields.some((field) => field.length === 0) || new Set(fields).size !== fields.length) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Transport changed-request fields must be non-empty and unique.",
    );
  }
  for (const field of fields) {
    const targetTokens = pathTokens(field);
    const sourceTokens = ["source", ...targetTokens.slice(1)];
    const targetValue = lookup(request, targetTokens);
    const sourceValue = lookup(request, sourceTokens);
    if (targetValue === undefined || sourceValue === undefined) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
        `Transport changed-request field ${field} does not resolve on both source and target declarations.`,
      );
    }
    if (exactJsonKey(targetValue) === exactJsonKey(sourceValue)) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
        `Transport changed-request field ${field} does not identify an actual source/target change.`,
      );
    }
  }
  return {
    changed_request_fields: fields.sort(compare),
    rationale: declaration.rationale,
  };
}

function certificateIdentities(
  requestBytes: Uint8Array,
  evidenceBytes: Uint8Array,
): { source: string; target: string } {
  const { sourceCertificate } = requestComponents(requestBytes);
  const evidence = parseJsonObject(evidenceBytes, "Certificate transport evidence");
  const targetCertificate = requireObject(
    evidence.certificate,
    "Certificate transport target certificate",
  );
  return {
    source: sha256Bytes(exactJsonBytes(sourceCertificate)),
    target: sha256Bytes(exactJsonBytes(targetCertificate)),
  };
}

function validateLoadedRecord(value: CertificateTransportRecord): LoadedCertificateTransportRecord {
  const sharedAnalysisBytes = verifyEncodedBytes(value.shared_analysis, "shared_analysis");
  const requestBytes = verifyEncodedBytes(value.request, "request");
  const evidenceBytes = verifyEncodedBytes(value.evidence, "evidence");
  const producerCheckBytes = verifyEncodedBytes(value.producer_check, "producer_check");
  if (value.binding.shared_analysis_sha256 !== sha256Bytes(sharedAnalysisBytes)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Transport binding does not identify the embedded shared-analysis archive.",
    );
  }
  if (
    exactJsonKey(value.model_binding.changed_request_fields) !==
    exactJsonKey([...value.model_binding.changed_request_fields].sort(compare))
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Transport changed-request fields are not in deterministic lexical order.",
    );
  }
  const request = requireSubstantiveTransportRequest(requestBytes);
  normalizedModelBinding(value.model_binding, request);
  const certificates = certificateIdentities(requestBytes, evidenceBytes);
  if (
    value.binding.transport_source_certificate_sha256 !== certificates.source ||
    value.binding.transport_target_certificate_sha256 !== certificates.target
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Transport record does not identify the exact preserved source and successor certificates.",
    );
  }
  const workspace = openSharedAnalysis(sharedAnalysisBytes);
  if (workspace.archive_sha256 !== value.binding.shared_analysis_sha256) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Embedded shared-analysis archive identity disagrees with the transport binding.",
    );
  }
  const { impact, basis } = supportContext(
    workspace,
    value.binding.revision_id,
    value.binding.analysis,
    value.binding.applicability_assessment_id,
  );
  if (
    value.binding.revision_impact_sha256 !== impact.impact_sha256 ||
    value.binding.reassessment_basis_sha256 !== basis.basis_sha256 ||
    value.binding.prior_analysis_sha256 !== basis.prior_analysis_sha256 ||
    value.binding.target_analysis_sha256 !== basis.target_analysis_sha256
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Transport record is stale against the exact shared-analysis revision/reassessment basis.",
    );
  }
  const producerCheck = parseTransportCheck(producerCheckBytes);
  if (
    producerCheck.request_sha256 !== shaWithoutPrefix(value.request.sha256) ||
    producerCheck.evidence_sha256 !== shaWithoutPrefix(value.evidence.sha256) ||
    producerCheck.status !== "checked" ||
    producerCheck.target_certificate_status !== "checked" ||
    producerCheck.transport_status !== "checked"
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_CHECK_FAILED",
      "Stored producer-time check does not claim a fully checked target-and-transport warrant.",
    );
  }
  const bytes = exactJsonBytes(value);
  return deepFreeze({ value: deepFreeze(value), record_sha256: sha256Bytes(bytes) });
}

export function createCertificateTransportRecord(
  workspace: LoadedSharedAnalysis,
  binding: {
    readonly revision_id: string;
    readonly analysis: AnalysisAddress;
    readonly applicability_assessment_id: string;
  },
  modelBinding: CertificateTransportModelBinding,
  requestBytes: Uint8Array,
  options: TransportEngineOptions,
): LoadedCertificateTransportRecord {
  const { impact, basis } = supportContext(
    workspace,
    binding.revision_id,
    binding.analysis,
    binding.applicability_assessment_id,
  );
  const request = requireSubstantiveTransportRequest(requestBytes);
  const normalizedBinding = normalizedModelBinding(modelBinding, request);
  const evidenceBytes = produceCertificateTransport(requestBytes, options);
  const producerCheckBytes = checkCertificateTransportBytes(requestBytes, evidenceBytes, options);
  const producerCheck = parseTransportCheck(producerCheckBytes);
  if (
    producerCheck.status !== "checked" ||
    producerCheck.target_certificate_status !== "checked" ||
    producerCheck.transport_status !== "checked"
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_CHECK_FAILED",
      "Transport producer did not yield a fully checked successor warrant.",
      { check: producerCheck },
    );
  }
  const certificates = certificateIdentities(requestBytes, evidenceBytes);
  const sharedAnalysisBytes = exportSharedAnalysis(workspace);
  const value: CertificateTransportRecord = {
    schema_version: CERTIFICATE_TRANSPORT_RECORD_SCHEMA_VERSION,
    record_kind: CERTIFICATE_TRANSPORT_RECORD_KIND,
    decision_lab: {
      commit: DECISION_LAB_TRANSPORT_COMMIT,
      interface: DECISION_LAB_TRANSPORT_INTERFACE,
      guarantee: DECISION_LAB_TRANSPORT_GUARANTEE,
    },
    binding: {
      shared_analysis_sha256: sha256Bytes(sharedAnalysisBytes),
      revision_id: binding.revision_id,
      analysis: binding.analysis,
      applicability_assessment_id: binding.applicability_assessment_id,
      reassessment_basis_sha256: basis.basis_sha256,
      revision_impact_sha256: impact.impact_sha256,
      prior_analysis_sha256: basis.prior_analysis_sha256,
      target_analysis_sha256: basis.target_analysis_sha256,
      transport_source_certificate_sha256: certificates.source,
      transport_target_certificate_sha256: certificates.target,
    },
    model_binding: normalizedBinding,
    shared_analysis: encodedBytes(sharedAnalysisBytes),
    request: encodedBytes(new Uint8Array(requestBytes)),
    evidence: encodedBytes(evidenceBytes),
    producer_check: encodedBytes(producerCheckBytes),
  };
  assertCertificateTransportRecord(value);
  return validateLoadedRecord(value);
}

export function certificateTransportRecordBytes(
  record: LoadedCertificateTransportRecord,
): Uint8Array {
  if (record.record_sha256 !== sha256Bytes(exactJsonBytes(record.value))) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_BINDING_INVALID",
      "Loaded certificate transport record identity does not match its exact value.",
    );
  }
  return exactJsonBytes(record.value);
}

export function openCertificateTransportRecord(
  bytes: Uint8Array,
): LoadedCertificateTransportRecord {
  return validateLoadedRecord(parseCanonicalRecord(new Uint8Array(bytes)));
}

export function replayCertificateTransportRecord(
  bytes: Uint8Array,
  options: TransportEngineOptions,
): CertificateTransportReplay {
  const loaded = openCertificateTransportRecord(bytes);
  const request = verifyEncodedBytes(loaded.value.request, "request");
  const evidence = verifyEncodedBytes(loaded.value.evidence, "evidence");
  const producerCheck = verifyEncodedBytes(loaded.value.producer_check, "producer_check");
  const freshCheckBytes = checkCertificateTransportBytes(request, evidence, options);
  const fresh = parseTransportCheck(freshCheckBytes);
  return deepFreeze({
    record_sha256: loaded.record_sha256,
    shared_analysis_sha256: loaded.value.binding.shared_analysis_sha256,
    revision_id: loaded.value.binding.revision_id,
    analysis: loaded.value.binding.analysis,
    revision_impact_sha256: loaded.value.binding.revision_impact_sha256,
    reassessment_basis_sha256: loaded.value.binding.reassessment_basis_sha256,
    source_certificate_sha256: loaded.value.binding.transport_source_certificate_sha256,
    target_certificate_sha256: loaded.value.binding.transport_target_certificate_sha256,
    historical_source_guarantee_preserved: true,
    source_certificate_status: "checked",
    fresh_check_matches_producer_check:
      Buffer.from(freshCheckBytes).compare(Buffer.from(producerCheck)) === 0,
    target_certificate_status: fresh.target_certificate_status,
    transport_status: fresh.transport_status,
    mathematical_status: fresh.status,
    bounds: fresh.bounds,
  });
}
