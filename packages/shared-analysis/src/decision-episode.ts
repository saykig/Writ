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
  openSharedAnalysis,
  replaySharedAnalysis,
} from "./contract.js";
import { DecisionEpisodeError } from "./episode-errors.js";
import { assertDecisionEpisode } from "./episode-schema-validation.js";
import {
  DECISION_EPISODE_KIND,
  DECISION_EPISODE_SCHEMA_VERSION,
  type DecisionEpisode,
  type DecisionEpisodeCheckedHistory,
  type DecisionEpisodeDeclaration,
  type DecisionEpisodeReplay,
  type DecisionEpisodeReplayOptions,
  type LoadedDecisionEpisode,
} from "./episode-types.js";
import {
  certificateTransportRecordBytes,
  openCertificateTransportRecord,
  replayCertificateTransportRecord,
} from "./transport-integration.js";
import type { AnalysisAddress } from "./types.js";

const MAX_EPISODE_BYTES = 20 * 1024 * 1024;

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

function digest(value: unknown): string {
  return sha256Bytes(exactJsonBytes(value));
}

function addressKey(address: AnalysisAddress): string {
  return exactJsonKey([address.bundle_id, address.analysis_id]);
}

function historyFromTransport(rawTransportRecord: Uint8Array): DecisionEpisodeCheckedHistory {
  const transport = openCertificateTransportRecord(new Uint8Array(rawTransportRecord));
  const transportBytes = certificateTransportRecordBytes(transport);
  const sharedAnalysisBytes = verifyEncodedBytes(
    transport.value.shared_analysis,
    "checked_history.certificate_transport_record.shared_analysis",
  );
  const workspace = openSharedAnalysis(sharedAnalysisBytes);
  const binding = transport.value.binding;
  const basis = deriveReassessmentBasis(workspace, binding.revision_id, binding.analysis);
  const impact = assessRevision(workspace, binding.revision_id);
  const prior = workspace.value.executions.find(
    (execution) =>
      addressKey(execution.analysis) === addressKey(binding.analysis) &&
      execution.revision_id === null,
  );
  const successor = workspace.value.executions.find(
    (execution) =>
      addressKey(execution.analysis) === addressKey(binding.analysis) &&
      execution.revision_id === binding.revision_id,
  );
  if (prior === undefined || successor === undefined) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_BINDING_MISMATCH",
      "A decision episode requires exact preserved original and successor executions for its checked transition.",
    );
  }
  if (
    workspace.archive_sha256 !== binding.shared_analysis_sha256 ||
    basis.basis_sha256 !== binding.reassessment_basis_sha256 ||
    impact.impact_sha256 !== binding.revision_impact_sha256
  ) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_BINDING_MISMATCH",
      "The transport record does not resolve to its exact shared-analysis revision and reassessment basis.",
    );
  }
  const historyWithoutIdentity = {
    certificate_transport_record: encodedBytes(transportBytes),
    certificate_transport_record_sha256: transport.record_sha256,
    shared_analysis_sha256: workspace.archive_sha256,
    revision_id: binding.revision_id,
    analysis: binding.analysis,
    applicability_assessment_id: binding.applicability_assessment_id,
    reassessment_basis_sha256: basis.basis_sha256,
    revision_impact_sha256: impact.impact_sha256,
    source_bindings: basis.source_bindings,
    assumption_dependencies: basis.assumption_dependencies,
    target_problem_sha256: basis.mathematical_subject.problem_sha256,
    target_query_sha256: basis.mathematical_subject.query_sha256,
    prior_execution_sha256: prior.execution.sha256,
    successor_execution_sha256: successor.execution.sha256,
    source_certificate_sha256: binding.transport_source_certificate_sha256,
    target_certificate_sha256: binding.transport_target_certificate_sha256,
  };
  return deepFreeze({
    binding_sha256: digest(historyWithoutIdentity),
    ...historyWithoutIdentity,
  });
}

function verifyDeclarationBytes(episode: DecisionEpisode): void {
  for (const [name, bytes] of [
    ["authority_basis.artifact", episode.authority_basis.artifact],
    ["implementation.record", episode.implementation.record],
    ["observation.record", episode.observation.record],
  ] as const) {
    try {
      verifyEncodedBytes(bytes, name);
    } catch {
      throw new DecisionEpisodeError(
        "DECISION_EPISODE_BINDING_MISMATCH",
        `${name} does not preserve the exact declared bytes.`,
      );
    }
  }
}

function validateSequence(episode: DecisionEpisode): void {
  if (
    episode.human_decision.authority_basis_id !== episode.authority_basis.authority_basis_id ||
    episode.human_decision.considered_analysis_binding_sha256 !==
      episode.checked_history.binding_sha256 ||
    episode.implementation.decision_id !== episode.human_decision.decision_id ||
    episode.observation.implementation_id !== episode.implementation.implementation_id ||
    episode.reconsideration.observation_id !== episode.observation.observation_id
  ) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_SEQUENCE_INVALID",
      "Decision, authority, implementation, observation, and reconsideration references must form one exact episode chain.",
    );
  }
  if (!(
    episode.human_decision.decided_at < episode.implementation.implemented_at &&
    episode.implementation.implemented_at < episode.observation.observed_at &&
    episode.observation.observed_at < episode.reconsideration.declared_at
  )) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_SEQUENCE_INVALID",
      "Decision, implementation, observation, and reconsideration times must be strictly ordered.",
    );
  }
  const interpretationIds = episode.interpretations.map(
    ({ interpretation_id }) => interpretation_id,
  );
  if (
    new Set(interpretationIds).size !== interpretationIds.length ||
    exactJsonKey(interpretationIds) !== exactJsonKey([...interpretationIds].sort(compare)) ||
    episode.interpretations.some(
      ({ observation_id }) => observation_id !== episode.observation.observation_id,
    )
  ) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_SEQUENCE_INVALID",
      "Observation interpretations must be uniquely identified, lexically ordered, and scoped to this episode observation.",
    );
  }
  const declaredInterpretations = new Set(interpretationIds);
  if (
    exactJsonKey(episode.reconsideration.interpretation_ids) !==
      exactJsonKey([...episode.reconsideration.interpretation_ids].sort(compare)) ||
    episode.reconsideration.interpretation_ids.some(
      (interpretationId) => !declaredInterpretations.has(interpretationId),
    )
  ) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_SEQUENCE_INVALID",
      "Reconsideration may reference only declared, lexically ordered observation interpretations.",
    );
  }
}

function validateLoaded(value: DecisionEpisode): LoadedDecisionEpisode {
  assertDecisionEpisode(value);
  let expectedHistory: DecisionEpisodeCheckedHistory;
  try {
    expectedHistory = historyFromTransport(
      verifyEncodedBytes(
        value.checked_history.certificate_transport_record,
        "checked_history.certificate_transport_record",
      ),
    );
  } catch (error) {
    if (error instanceof DecisionEpisodeError) throw error;
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_BINDING_MISMATCH",
      "The episode does not contain a valid exact certificate-transport record.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (exactJsonKey(expectedHistory) !== exactJsonKey(value.checked_history)) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_BINDING_MISMATCH",
      "The episode checked-history declaration does not match the exact embedded Writ artifacts.",
    );
  }
  verifyDeclarationBytes(value);
  validateSequence(value);
  const bytes = exactJsonBytes(value);
  return deepFreeze({ value: deepFreeze(value), episode_sha256: sha256Bytes(bytes) });
}

/**
 * Bind one supplied human decision episode to an existing exact PR #51 checked transition.
 * The decision and later declarations are required inputs; no mathematical result selects them.
 */
export function createDecisionEpisode(
  rawTransportRecord: Uint8Array,
  declaration: DecisionEpisodeDeclaration,
): LoadedDecisionEpisode {
  const checkedHistory = historyFromTransport(rawTransportRecord);
  const value: DecisionEpisode = {
    schema_version: DECISION_EPISODE_SCHEMA_VERSION,
    episode_kind: DECISION_EPISODE_KIND,
    episode_id: declaration.episode_id,
    checked_history: checkedHistory,
    authority_basis: declaration.authority_basis,
    human_decision: {
      ...declaration.human_decision,
      considered_analysis_binding_sha256: checkedHistory.binding_sha256,
    },
    implementation: declaration.implementation,
    observation: declaration.observation,
    interpretations: [...declaration.interpretations].sort((left, right) =>
      compare(left.interpretation_id, right.interpretation_id),
    ),
    reconsideration: {
      ...declaration.reconsideration,
      interpretation_ids: [...declaration.reconsideration.interpretation_ids].sort(compare),
    },
  };
  return validateLoaded(value);
}

export function decisionEpisodeBytes(episode: LoadedDecisionEpisode): Uint8Array {
  const bytes = exactJsonBytes(episode.value);
  if (episode.episode_sha256 !== sha256Bytes(bytes)) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_BINDING_MISMATCH",
      "Loaded episode identity does not match its exact value.",
    );
  }
  validateLoaded(episode.value);
  return bytes;
}

export function openDecisionEpisode(bytes: Uint8Array): LoadedDecisionEpisode {
  if (bytes.length === 0 || bytes.length > MAX_EPISODE_BYTES) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_INVALID",
      `Episode must contain 1 to ${MAX_EPISODE_BYTES} bytes.`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)));
  } catch {
    throw new DecisionEpisodeError("DECISION_EPISODE_INVALID", "Episode is not valid UTF-8 JSON.");
  }
  assertDecisionEpisode(value);
  if (Buffer.from(exactJsonBytes(value)).compare(Buffer.from(bytes)) !== 0) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_INVALID",
      "Episode is not the deterministic exact-JSON representation.",
    );
  }
  return validateLoaded(value);
}

/** Freshly replay every mathematical artifact while preserving human declarations as declarations. */
export function replayDecisionEpisode(
  bytes: Uint8Array,
  options: DecisionEpisodeReplayOptions,
): DecisionEpisodeReplay {
  const episode = openDecisionEpisode(bytes);
  const transportBytes = verifyEncodedBytes(
    episode.value.checked_history.certificate_transport_record,
    "checked_history.certificate_transport_record",
  );
  const transport = openCertificateTransportRecord(transportBytes);
  const sharedAnalysisBytes = verifyEncodedBytes(
    transport.value.shared_analysis,
    "certificate_transport_record.shared_analysis",
  );
  const sharedReplay = replaySharedAnalysis(sharedAnalysisBytes, options);
  const transportReplay = replayCertificateTransportRecord(transportBytes, options);
  const originalChecked = sharedReplay.freshly_checked.some(
    (checked) =>
      addressKey(checked.analysis) === addressKey(episode.value.checked_history.analysis) &&
      checked.revision_id === null &&
      checked.execution_sha256 === episode.value.checked_history.prior_execution_sha256,
  );
  const successorChecked = sharedReplay.freshly_checked.some(
    (checked) =>
      addressKey(checked.analysis) === addressKey(episode.value.checked_history.analysis) &&
      checked.revision_id === episode.value.checked_history.revision_id &&
      checked.execution_sha256 === episode.value.checked_history.successor_execution_sha256,
  );
  if (!originalChecked || !successorChecked) {
    throw new DecisionEpisodeError(
      "DECISION_EPISODE_REPLAY_INCOMPLETE",
      "Fresh recipient replay did not recheck both exact episode executions.",
    );
  }
  return deepFreeze({
    episode_sha256: episode.episode_sha256,
    checked_history_binding_sha256: episode.value.checked_history.binding_sha256,
    fresh_checks: {
      shared_analysis: sharedReplay,
      certificate_transport: transportReplay,
    },
    preserved_declarations: {
      authority_basis_sha256: digest(episode.value.authority_basis),
      human_decision_sha256: digest(episode.value.human_decision),
      implementation_sha256: digest(episode.value.implementation),
      observation_sha256: digest(episode.value.observation),
      interpretation_sha256s: episode.value.interpretations.map((interpretation) => ({
        interpretation_id: interpretation.interpretation_id,
        sha256: digest(interpretation),
        review_status: interpretation.review.status,
      })),
      reconsideration_sha256: digest(episode.value.reconsideration),
    },
    automatic_inferences: {
      decision_from_mathematics: false,
      causality_from_observation: false,
      decision_correctness_from_observation: false,
      model_update_from_observation: false,
    },
  });
}
