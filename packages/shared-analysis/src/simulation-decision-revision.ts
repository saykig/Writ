import _Ajv2020 from "ajv/dist/2020.js";
import {
  encodedBytes,
  exactJsonBytes,
  exactJsonKey,
  verifyEncodedBytes,
  type EncodedBytes,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import schema from "../../../schemas/analysis/simulation-decision-revision-v0.1.schema.json" with { type: "json" };
import { openDecisionEpisode, replayDecisionEpisode } from "./decision-episode.js";
import type { EpisodeActor, LoadedDecisionEpisode } from "./episode-types.js";
import {
  openSimulationDecisionComparison,
  simulationDecisionComparisonBytes,
  type LoadedSimulationDecisionComparison,
  type SimulationDecisionOption,
} from "./simulation-decision.js";
import type { TransportEngineOptions } from "./transport-types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile<SimulationDecisionRevision>(
  schema,
);

export type SimulationDecisionRevisionDiagnosticCode =
  | "SIMULATION_DECISION_REVISION_INVALID"
  | "SIMULATION_DECISION_REVISION_BINDING_MISMATCH"
  | "SIMULATION_DECISION_REVISION_INCOMPLETE";

export class SimulationDecisionRevisionError extends Error {
  constructor(
    readonly code: SimulationDecisionRevisionDiagnosticCode,
    message: string,
  ) {
    super(message);
    this.name = "SimulationDecisionRevisionError";
  }
}

export interface SimulationDecisionEpisodeReference {
  readonly episode_sha256: string;
  readonly decision_id: string;
  readonly observation_id: string;
  readonly reconsideration_id: string;
}

export interface SimulationDecisionOptionInputChange {
  readonly option_id: string;
  readonly prior_run_sha256: string;
  readonly successor_run_sha256: string;
  readonly prior_input_sha256: string;
  readonly successor_input_sha256: string;
  readonly prior_service_minutes: string;
  readonly successor_service_minutes: string;
}

export interface SimulationDecisionDisposition {
  readonly comparison_sha256: string;
  readonly episode_sha256: string;
  readonly decision_id: string;
  readonly selected_action: string;
  readonly modeled_option_id: string | null;
  readonly status:
    | "selected_recommended_modeled_option"
    | "selected_other_modeled_option"
    | "deferred_or_outside_modeled_menu";
  readonly authority_status: "supplied_not_inferred";
}

export interface SimulationDecisionRevision {
  readonly schema_version: "0.1.0";
  readonly record_kind: "simulation_decision_revision";
  readonly parent_comparison: EncodedBytes;
  readonly successor_comparison: EncodedBytes;
  readonly parent_episode: EncodedBytes;
  readonly successor_episode: EncodedBytes;
  readonly parent_reference: SimulationDecisionEpisodeReference;
  readonly successor_reference: SimulationDecisionEpisodeReference;
  readonly assumption_revision: {
    readonly assumption_id: string;
    readonly changed_field: "base_service_minutes";
    readonly prior_value: string;
    readonly successor_value: string;
    readonly unit: string;
    readonly reason: string;
    readonly declared_by: EpisodeActor;
    readonly declared_at: string;
    readonly declared_change_scope: "base_service_minutes_and_all_derived_option_inputs_only";
  };
  readonly option_input_changes: readonly SimulationDecisionOptionInputChange[];
  readonly dispositions: {
    readonly parent: SimulationDecisionDisposition;
    readonly successor: SimulationDecisionDisposition;
  };
  readonly relationship: "explicit_reconsideration_and_rerun";
  readonly evidence_kind: "model_generated_with_supplied_preferences";
  readonly native_model_effect: "unchanged";
  readonly supersession: "none_automatic";
}

export interface SimulationDecisionRevisionPins {
  readonly revisionSha256: string;
  readonly parentComparisonSha256: string;
  readonly successorComparisonSha256: string;
  readonly parentEpisodeSha256: string;
  readonly successorEpisodeSha256: string;
}

export interface SimulationDecisionRevisionDeclaration {
  readonly reason: string;
  readonly declared_by: EpisodeActor;
  readonly declared_at: string;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validUtcSecond(value: string): boolean {
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value.replace("Z", ".000Z")
  );
}

function mismatch(message: string): never {
  throw new SimulationDecisionRevisionError(
    "SIMULATION_DECISION_REVISION_BINDING_MISMATCH",
    message,
  );
}

function incomplete(message: string): never {
  throw new SimulationDecisionRevisionError("SIMULATION_DECISION_REVISION_INCOMPLETE", message);
}

function episodeReference(episode: LoadedDecisionEpisode): SimulationDecisionEpisodeReference {
  return {
    episode_sha256: episode.episode_sha256,
    decision_id: episode.value.human_decision.decision_id,
    observation_id: episode.value.observation.observation_id,
    reconsideration_id: episode.value.reconsideration.reconsideration_id,
  };
}

function optionMetadata(option: SimulationDecisionOption) {
  return {
    option_id: option.option_id,
    action_id: option.action_id,
    description: option.description,
    service_delta_minutes: option.service_delta_minutes,
    fixed_cost: option.fixed_cost,
  };
}

function buildDisposition(
  comparison: LoadedSimulationDecisionComparison,
  episode: LoadedDecisionEpisode,
): SimulationDecisionDisposition {
  const selectedAction = episode.value.human_decision.selected_action;
  const modeled = comparison.value.options.find((option) => option.action_id === selectedAction);
  const status =
    modeled === undefined
      ? "deferred_or_outside_modeled_menu"
      : comparison.value.result.preferred_option_ids.includes(modeled.option_id)
        ? "selected_recommended_modeled_option"
        : "selected_other_modeled_option";
  return {
    comparison_sha256: comparison.comparison_sha256,
    episode_sha256: episode.episode_sha256,
    decision_id: episode.value.human_decision.decision_id,
    selected_action: selectedAction,
    modeled_option_id: modeled?.option_id ?? null,
    status,
    authority_status: "supplied_not_inferred",
  };
}

function buildOptionChanges(
  parent: LoadedSimulationDecisionComparison,
  successor: LoadedSimulationDecisionComparison,
): SimulationDecisionOptionInputChange[] {
  return parent.value.options.map((prior, index) => {
    const next = successor.value.options[index]!;
    const priorLoss = parent.value.result.option_losses[index]!;
    const successorLoss = successor.value.result.option_losses[index]!;
    return {
      option_id: prior.option_id,
      prior_run_sha256: prior.run_sha256,
      successor_run_sha256: next.run_sha256,
      prior_input_sha256: prior.input_sha256,
      successor_input_sha256: next.input_sha256,
      prior_service_minutes: priorLoss.service_minutes,
      successor_service_minutes: successorLoss.service_minutes,
    };
  });
}

function parse(raw: Uint8Array): SimulationDecisionRevision {
  if (raw.length === 0 || raw.length > 70 * 1024 * 1024) {
    throw new SimulationDecisionRevisionError(
      "SIMULATION_DECISION_REVISION_INVALID",
      "Revision must contain 1 byte to 70 MiB.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new SimulationDecisionRevisionError(
      "SIMULATION_DECISION_REVISION_INVALID",
      "Revision is not valid UTF-8 JSON.",
    );
  }
  if (!validate(value) || !Buffer.from(exactJsonBytes(value)).equals(Buffer.from(raw))) {
    throw new SimulationDecisionRevisionError(
      "SIMULATION_DECISION_REVISION_INVALID",
      "Unsupported or noncanonical simulation-decision revision.",
    );
  }
  return value;
}

function verifyEpisodeReference(
  actual: SimulationDecisionEpisodeReference,
  episode: LoadedDecisionEpisode,
  label: string,
): void {
  if (exactJsonKey(actual) !== exactJsonKey(episodeReference(episode))) {
    mismatch(`${label} reference does not resolve every named event in the pinned episode.`);
  }
}

function verifyOnlyDeclaredChange(
  parent: LoadedSimulationDecisionComparison,
  successor: LoadedSimulationDecisionComparison,
  value: SimulationDecisionRevision,
): void {
  const prior = parent.value;
  const next = successor.value;
  if (
    prior.comparison_id === next.comparison_id ||
    prior.scenario.assumption_id !== next.scenario.assumption_id ||
    prior.scenario.base_service_minutes === next.scenario.base_service_minutes
  ) {
    incomplete("A distinct successor and changed base-service assumption are required.");
  }
  const priorScenarioWithoutValue = {
    ...prior.scenario,
    base_service_minutes: "<changed>",
  };
  const successorScenarioWithoutValue = {
    ...next.scenario,
    base_service_minutes: "<changed>",
  };
  if (
    exactJsonKey(priorScenarioWithoutValue) !== exactJsonKey(successorScenarioWithoutValue) ||
    exactJsonKey(prior.option_class) !== exactJsonKey(next.option_class) ||
    exactJsonKey(prior.objective) !== exactJsonKey(next.objective) ||
    exactJsonKey(prior.options.map(optionMetadata)) !==
      exactJsonKey(next.options.map(optionMetadata))
  ) {
    incomplete(
      "The revision may change only base service and the model runs derived from that assumption.",
    );
  }
  const change = value.assumption_revision;
  if (
    change.assumption_id !== prior.scenario.assumption_id ||
    change.prior_value !== prior.scenario.base_service_minutes ||
    change.successor_value !== next.scenario.base_service_minutes ||
    change.unit !== prior.scenario.unit
  ) {
    incomplete("The declared assumption revision does not match the exact comparison subjects.");
  }
  const expectedChanges = buildOptionChanges(parent, successor);
  if (exactJsonKey(value.option_input_changes) !== exactJsonKey(expectedChanges)) {
    incomplete("Every and only derived option input/run change must be declared exactly.");
  }
  for (const [index, priorRun] of parent.received_runs.entries()) {
    const successorRun = successor.received_runs[index]!;
    if (
      exactJsonKey(priorRun.input.arrivals) !== exactJsonKey(successorRun.input.arrivals) ||
      priorRun.input.unit !== successorRun.input.unit ||
      priorRun.input.service_minutes === successorRun.input.service_minutes
    ) {
      incomplete("Each option rerun must change service time only and preserve arrival inputs.");
    }
  }
}

export function openSimulationDecisionRevision(
  raw: Uint8Array,
  pins: SimulationDecisionRevisionPins,
) {
  if (sha256Bytes(raw) !== pins.revisionSha256) {
    mismatch("Revision differs from the independently supplied expected identity.");
  }
  const value = parse(raw);
  let parentComparisonBytes: Uint8Array;
  let successorComparisonBytes: Uint8Array;
  let parentEpisodeBytes: Uint8Array;
  let successorEpisodeBytes: Uint8Array;
  try {
    parentComparisonBytes = verifyEncodedBytes(value.parent_comparison, "parent_comparison");
    successorComparisonBytes = verifyEncodedBytes(
      value.successor_comparison,
      "successor_comparison",
    );
    parentEpisodeBytes = verifyEncodedBytes(value.parent_episode, "parent_episode");
    successorEpisodeBytes = verifyEncodedBytes(value.successor_episode, "successor_episode");
  } catch {
    mismatch("Embedded comparisons or episodes do not preserve their exact bytes.");
  }
  const parentComparison = openSimulationDecisionComparison(
    parentComparisonBytes,
    pins.parentComparisonSha256,
  );
  const successorComparison = openSimulationDecisionComparison(
    successorComparisonBytes,
    pins.successorComparisonSha256,
  );
  const parentEpisode = openDecisionEpisode(parentEpisodeBytes, pins.parentEpisodeSha256);
  const successorEpisode = openDecisionEpisode(successorEpisodeBytes, pins.successorEpisodeSha256);
  verifyEpisodeReference(value.parent_reference, parentEpisode, "Parent");
  verifyEpisodeReference(value.successor_reference, successorEpisode, "Successor");
  if (
    parentEpisode.episode_sha256 === successorEpisode.episode_sha256 ||
    parentEpisode.value.episode_id === successorEpisode.value.episode_id ||
    exactJsonKey(parentEpisode.value.checked_history) !==
      exactJsonKey(successorEpisode.value.checked_history)
  ) {
    incomplete(
      "This external-only profile requires distinct episodes with unchanged native mathematical history.",
    );
  }
  if (!validUtcSecond(value.assumption_revision.declared_at)) {
    throw new SimulationDecisionRevisionError(
      "SIMULATION_DECISION_REVISION_INVALID",
      "Revision time must be a real UTC calendar instant at whole-second precision.",
    );
  }
  if (!(
    parentComparison.value.completed_at < parentEpisode.value.human_decision.decided_at &&
    parentEpisode.value.reconsideration.declared_at < value.assumption_revision.declared_at &&
    value.assumption_revision.declared_at < successorComparison.value.completed_at &&
    successorComparison.value.completed_at < successorEpisode.value.human_decision.decided_at
  )) {
    incomplete(
      "Each comparison must precede its supplied decision, and the successor rerun must follow the declared reconsideration and revision.",
    );
  }
  verifyOnlyDeclaredChange(parentComparison, successorComparison, value);
  const dispositions = {
    parent: buildDisposition(parentComparison, parentEpisode),
    successor: buildDisposition(successorComparison, successorEpisode),
  };
  if (exactJsonKey(value.dispositions) !== exactJsonKey(dispositions)) {
    mismatch(
      "Comparison-to-decision dispositions do not match the supplied episode acts and checked preferences.",
    );
  }
  return deepFreeze({
    value: deepFreeze(value),
    revision_sha256: sha256Bytes(raw),
    parentComparison,
    successorComparison,
    parentEpisode,
    successorEpisode,
    ranking_change: {
      prior_status: parentComparison.value.result.comparison_status,
      prior_preferred_option_ids: parentComparison.value.result.preferred_option_ids,
      successor_status: successorComparison.value.result.comparison_status,
      successor_preferred_option_ids: successorComparison.value.result.preferred_option_ids,
    },
  });
}

export function createSimulationDecisionRevision(
  parentComparison: LoadedSimulationDecisionComparison,
  successorComparison: LoadedSimulationDecisionComparison,
  parentEpisode: LoadedDecisionEpisode,
  successorEpisode: LoadedDecisionEpisode,
  declaration: SimulationDecisionRevisionDeclaration,
): Uint8Array {
  const value: SimulationDecisionRevision = {
    schema_version: "0.1.0",
    record_kind: "simulation_decision_revision",
    parent_comparison: encodedBytes(simulationDecisionComparisonBytes(parentComparison)),
    successor_comparison: encodedBytes(simulationDecisionComparisonBytes(successorComparison)),
    parent_episode: encodedBytes(exactJsonBytes(parentEpisode.value)),
    successor_episode: encodedBytes(exactJsonBytes(successorEpisode.value)),
    parent_reference: episodeReference(parentEpisode),
    successor_reference: episodeReference(successorEpisode),
    assumption_revision: {
      assumption_id: parentComparison.value.scenario.assumption_id,
      changed_field: "base_service_minutes",
      prior_value: parentComparison.value.scenario.base_service_minutes,
      successor_value: successorComparison.value.scenario.base_service_minutes,
      unit: parentComparison.value.scenario.unit,
      reason: declaration.reason,
      declared_by: declaration.declared_by,
      declared_at: declaration.declared_at,
      declared_change_scope: "base_service_minutes_and_all_derived_option_inputs_only",
    },
    option_input_changes: buildOptionChanges(parentComparison, successorComparison),
    dispositions: {
      parent: buildDisposition(parentComparison, parentEpisode),
      successor: buildDisposition(successorComparison, successorEpisode),
    },
    relationship: "explicit_reconsideration_and_rerun",
    evidence_kind: "model_generated_with_supplied_preferences",
    native_model_effect: "unchanged",
    supersession: "none_automatic",
  };
  const bytes = exactJsonBytes(value);
  openSimulationDecisionRevision(bytes, {
    revisionSha256: sha256Bytes(bytes),
    parentComparisonSha256: parentComparison.comparison_sha256,
    successorComparisonSha256: successorComparison.comparison_sha256,
    parentEpisodeSha256: parentEpisode.episode_sha256,
    successorEpisodeSha256: successorEpisode.episode_sha256,
  });
  return bytes;
}

/** Fresh native receiving and exact comparison checking; neither producer is invoked. */
export function replaySimulationDecisionRevision(
  raw: Uint8Array,
  pins: SimulationDecisionRevisionPins,
  options: TransportEngineOptions,
) {
  const opened = openSimulationDecisionRevision(raw, pins);
  const parentNative = replayDecisionEpisode(
    verifyEncodedBytes(opened.value.parent_episode, "parent_episode"),
    { ...options, expectedEpisodeSha256: pins.parentEpisodeSha256 },
  );
  const successorNative = replayDecisionEpisode(
    verifyEncodedBytes(opened.value.successor_episode, "successor_episode"),
    { ...options, expectedEpisodeSha256: pins.successorEpisodeSha256 },
  );
  return deepFreeze({
    revision_sha256: opened.revision_sha256,
    ranking_change: opened.ranking_change,
    model_and_objective_checks: {
      parent: opened.parentComparison.value.assurance,
      successor: opened.successorComparison.value.assurance,
    },
    native_checks: { parent: parentNative, successor: successorNative },
    preserved_human_dispositions: opened.value.dispositions,
    applicability: {
      parent: opened.parentComparison.value.result.applicability_status,
      successor: opened.successorComparison.value.result.applicability_status,
    },
    supersession: "none_automatic" as const,
    automatic_inferences: {
      empirical_validity: false,
      causal_effect: false,
      decision_from_recommendation: false,
      authority_from_recommendation: false,
      native_model_update: false,
    },
  });
}
