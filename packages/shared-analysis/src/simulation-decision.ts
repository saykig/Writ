import _Ajv2020 from "ajv/dist/2020.js";
import {
  encodedBytes,
  exactJsonBytes,
  exactJsonKey,
  verifyEncodedBytes,
  type EncodedBytes,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import schema from "../../../schemas/analysis/simulation-decision-v0.1.schema.json" with { type: "json" };
import { receiveExternalSimulation, type ResourceInput } from "./external-simulation.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const validate = new Ajv2020({
  strict: true,
  allErrors: true,
}).compile<SimulationDecisionComparison>(schema);

export type SimulationDecisionDiagnosticCode =
  | "SIMULATION_DECISION_INVALID"
  | "SIMULATION_DECISION_BINDING_MISMATCH"
  | "SIMULATION_DECISION_UNSUPPORTED"
  | "SIMULATION_DECISION_RESULT_REJECTED";

export class SimulationDecisionError extends Error {
  constructor(
    readonly code: SimulationDecisionDiagnosticCode,
    message: string,
  ) {
    super(message);
    this.name = "SimulationDecisionError";
  }
}

export interface SimulationDecisionQuantity {
  readonly value: string;
  readonly unit: string;
}

export interface SimulationDecisionScenario {
  readonly assumption_id: string;
  readonly base_service_minutes: string;
  readonly arrivals: readonly string[];
  readonly unit: string;
  readonly status: "supplied_not_empirically_validated";
  readonly statement: string;
}

export interface SimulationDecisionOptionClass {
  readonly declared_menu_completeness: "complete";
  readonly real_world_option_completeness: "not_established";
  readonly scope_statement: string;
}

export interface SimulationDecisionObjective {
  readonly sense: string;
  readonly output_metric: string;
  readonly output_unit: string;
  readonly loss_unit: string;
  readonly mapping: string;
  readonly wait_weight: SimulationDecisionQuantity;
  readonly preference_statement: string;
  readonly rounding: string;
  readonly tolerance: string;
}

export interface SimulationDecisionOption {
  readonly option_id: string;
  readonly action_id: string;
  readonly description: string;
  readonly service_delta_minutes: string;
  readonly fixed_cost: SimulationDecisionQuantity;
  readonly run: EncodedBytes;
  readonly run_sha256: string;
  readonly input_sha256: string;
}

export interface SimulationDecisionOptionLoss {
  readonly option_id: string;
  readonly run_sha256: string;
  readonly input_sha256: string;
  readonly service_minutes: string;
  readonly total_wait: SimulationDecisionQuantity;
  readonly weighted_wait_loss: SimulationDecisionQuantity;
  readonly fixed_cost: SimulationDecisionQuantity;
  readonly total_loss: SimulationDecisionQuantity;
}

export interface SimulationDecisionResult {
  readonly comparison_status: "unique_minimum" | "exact_tie";
  readonly preferred_option_ids: readonly string[];
  readonly option_losses: readonly SimulationDecisionOptionLoss[];
  readonly recommendation_status: "conditional_not_authorizing";
  readonly applicability_status: "not_established";
}

export interface SimulationDecisionComparison {
  readonly schema_version: "0.1.0";
  readonly artifact_kind: "simulation_decision_comparison";
  readonly profile: "simpy-resource-fifo-decision.v1";
  readonly evidence_kind: "model_generated_with_supplied_preferences";
  readonly claim: "conditional_minimum_loss_over_declared_options";
  readonly comparison_id: string;
  readonly completed_at: string;
  readonly time_status: "supplied_not_authenticated";
  readonly scenario: SimulationDecisionScenario;
  readonly option_class: SimulationDecisionOptionClass;
  readonly objective: SimulationDecisionObjective;
  readonly options: readonly SimulationDecisionOption[];
  readonly result: SimulationDecisionResult;
  readonly assurance: {
    readonly model_output_check: "fresh_exact_integer_fifo_trace";
    readonly objective_check: "fresh_exact_integer_arithmetic";
    readonly model_empirically_validated: false;
    readonly objective_empirically_identified: false;
    readonly causal_result: false;
    readonly bellman_certificate: false;
    readonly recommendation_authorizes_action: false;
  };
}

export interface SimulationDecisionOptionDeclaration {
  readonly option_id: string;
  readonly action_id: string;
  readonly description: string;
  readonly service_delta_minutes: string;
  readonly fixed_cost: SimulationDecisionQuantity;
  readonly run: Uint8Array;
}

export interface SimulationDecisionDeclaration {
  readonly comparison_id: string;
  readonly completed_at: string;
  readonly scenario: SimulationDecisionScenario;
  readonly option_class: SimulationDecisionOptionClass;
  readonly objective: SimulationDecisionObjective;
  readonly options: readonly SimulationDecisionOptionDeclaration[];
}

export interface LoadedSimulationDecisionComparison {
  readonly value: SimulationDecisionComparison;
  readonly comparison_sha256: string;
  readonly received_runs: readonly ReturnType<typeof receiveExternalSimulation>[];
}

const ASSURANCE: SimulationDecisionComparison["assurance"] = {
  model_output_check: "fresh_exact_integer_fifo_trace",
  objective_check: "fresh_exact_integer_arithmetic",
  model_empirically_validated: false,
  objective_empirically_identified: false,
  causal_result: false,
  bellman_certificate: false,
  recommendation_authorizes_action: false,
};

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

function bindingMismatch(message: string): never {
  throw new SimulationDecisionError("SIMULATION_DECISION_BINDING_MISMATCH", message);
}

function unsupported(message: string): never {
  throw new SimulationDecisionError("SIMULATION_DECISION_UNSUPPORTED", message);
}

function readInputSha256(run: Uint8Array): string {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(run)) as {
      inputs?: { sha256?: unknown };
    };
    if (typeof value.inputs?.sha256 !== "string") throw new Error("missing input identity");
    return value.inputs.sha256;
  } catch {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "An option run does not expose its embedded input identity.",
    );
  }
}

function assertSupportedObjective(value: SimulationDecisionComparison): void {
  const objective = value.objective;
  if (
    value.scenario.unit !== "minute" ||
    objective.sense !== "minimize" ||
    objective.output_metric !== "total_wait" ||
    objective.output_unit !== "minute" ||
    objective.loss_unit !== "stipulated_loss_point" ||
    objective.mapping !== "total_loss=wait_weight*total_wait+fixed_cost" ||
    objective.wait_weight.unit !== "stipulated_loss_point_per_minute" ||
    objective.rounding !== "none_exact_integer_arithmetic" ||
    objective.tolerance !== "0"
  ) {
    unsupported(
      "This profile supports only exact minimization of weighted total waiting plus fixed cost in stipulated loss points.",
    );
  }
  if (value.options.some((option) => option.fixed_cost.unit !== objective.loss_unit)) {
    unsupported("Every option cost must use the declared objective loss unit.");
  }
}

function assertOrderedMenu(value: SimulationDecisionComparison): void {
  const optionIds = value.options.map((option) => option.option_id);
  const actionIds = value.options.map((option) => option.action_id);
  if (
    new Set(optionIds).size !== optionIds.length ||
    new Set(actionIds).size !== actionIds.length ||
    exactJsonKey(optionIds) !== exactJsonKey([...optionIds].sort())
  ) {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "Options must have unique option/action identities and lexical option order.",
    );
  }
}

function expectedService(scenario: SimulationDecisionScenario, option: SimulationDecisionOption) {
  const result = BigInt(scenario.base_service_minutes) + BigInt(option.service_delta_minutes);
  if (result <= 0n || result > 999_999n) {
    unsupported(
      "The base-service assumption and option delta must produce a supported service time.",
    );
  }
  return result;
}

function derive(value: SimulationDecisionComparison): {
  result: SimulationDecisionResult;
  runs: ReturnType<typeof receiveExternalSimulation>[];
} {
  assertSupportedObjective(value);
  assertOrderedMenu(value);
  const scenarioArrivals = value.scenario.arrivals.map(BigInt);
  if (
    scenarioArrivals.some((arrival, index) => index > 0 && arrival <= scenarioArrivals[index - 1]!)
  ) {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "Scenario arrivals must be strictly increasing.",
    );
  }
  const waitWeight = BigInt(value.objective.wait_weight.value);
  const runs = value.options.map((option) => {
    let runBytes: Uint8Array;
    try {
      runBytes = verifyEncodedBytes(option.run, `options.${option.option_id}.run`);
    } catch {
      bindingMismatch(`Option ${option.option_id} does not preserve its exact run bytes.`);
    }
    if (sha256Bytes(runBytes) !== option.run_sha256) {
      bindingMismatch(`Option ${option.option_id} run identity is stale.`);
    }
    const received = receiveExternalSimulation(runBytes, {
      runSha256: option.run_sha256,
      inputSha256: option.input_sha256,
    });
    const input: ResourceInput = received.input;
    if (
      input.unit !== value.scenario.unit ||
      exactJsonKey(input.arrivals) !== exactJsonKey(value.scenario.arrivals) ||
      BigInt(input.service_minutes) !== expectedService(value.scenario, option)
    ) {
      bindingMismatch(
        `Option ${option.option_id} run input does not follow the declared scenario and service mapping.`,
      );
    }
    return received;
  });
  const optionLosses = value.options.map((option, index): SimulationDecisionOptionLoss => {
    const received = runs[index]!;
    const weightedWait = BigInt(received.total_wait.value) * waitWeight;
    const fixedCost = BigInt(option.fixed_cost.value);
    return {
      option_id: option.option_id,
      run_sha256: received.run_sha256,
      input_sha256: received.input_sha256,
      service_minutes: received.input.service_minutes,
      total_wait: received.total_wait,
      weighted_wait_loss: {
        value: String(weightedWait),
        unit: value.objective.loss_unit,
      },
      fixed_cost: option.fixed_cost,
      total_loss: {
        value: String(weightedWait + fixedCost),
        unit: value.objective.loss_unit,
      },
    };
  });
  const minimum = optionLosses.reduce(
    (current, item) => {
      const loss = BigInt(item.total_loss.value);
      return current === null || loss < current ? loss : current;
    },
    null as bigint | null,
  )!;
  const preferredOptionIds = optionLosses
    .filter((item) => BigInt(item.total_loss.value) === minimum)
    .map((item) => item.option_id);
  return {
    result: {
      comparison_status: preferredOptionIds.length === 1 ? "unique_minimum" : "exact_tie",
      preferred_option_ids: preferredOptionIds,
      option_losses: optionLosses,
      recommendation_status: "conditional_not_authorizing",
      applicability_status: "not_established",
    },
    runs,
  };
}

function parseComparison(raw: Uint8Array): SimulationDecisionComparison {
  if (raw.length === 0 || raw.length > 12 * 1024 * 1024) {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "Comparison must contain 1 byte to 12 MiB.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "Comparison is not valid UTF-8 JSON.",
    );
  }
  if (!validate(value) || !Buffer.from(exactJsonBytes(value)).equals(Buffer.from(raw))) {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "Unsupported or noncanonical simulation-decision contract.",
    );
  }
  return value;
}

export function openSimulationDecisionComparison(
  raw: Uint8Array,
  expectedComparisonSha256: string,
): LoadedSimulationDecisionComparison {
  if (sha256Bytes(raw) !== expectedComparisonSha256) {
    bindingMismatch("Comparison differs from the independently supplied expected identity.");
  }
  const value = parseComparison(raw);
  if (!validUtcSecond(value.completed_at)) {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_INVALID",
      "Comparison time must be a real UTC calendar instant at whole-second precision.",
    );
  }
  const expected = derive(value);
  if (
    exactJsonKey(value.result) !== exactJsonKey(expected.result) ||
    exactJsonKey(value.assurance) !== exactJsonKey(ASSURANCE)
  ) {
    throw new SimulationDecisionError(
      "SIMULATION_DECISION_RESULT_REJECTED",
      "The retained option losses, conditional preference or assurance labels are false.",
    );
  }
  return deepFreeze({
    value: deepFreeze(value),
    comparison_sha256: sha256Bytes(raw),
    received_runs: expected.runs,
  });
}

export function createSimulationDecisionComparison(
  declaration: SimulationDecisionDeclaration,
): LoadedSimulationDecisionComparison {
  const options: SimulationDecisionOption[] = declaration.options
    .map((option) => ({
      option_id: option.option_id,
      action_id: option.action_id,
      description: option.description,
      service_delta_minutes: option.service_delta_minutes,
      fixed_cost: option.fixed_cost,
      run: encodedBytes(option.run),
      run_sha256: sha256Bytes(option.run),
      input_sha256: readInputSha256(option.run),
    }))
    .sort((left, right) => left.option_id.localeCompare(right.option_id));
  const partial = {
    schema_version: "0.1.0" as const,
    artifact_kind: "simulation_decision_comparison" as const,
    profile: "simpy-resource-fifo-decision.v1" as const,
    evidence_kind: "model_generated_with_supplied_preferences" as const,
    claim: "conditional_minimum_loss_over_declared_options" as const,
    comparison_id: declaration.comparison_id,
    completed_at: declaration.completed_at,
    time_status: "supplied_not_authenticated" as const,
    scenario: declaration.scenario,
    option_class: declaration.option_class,
    objective: declaration.objective,
    options,
    result: {} as SimulationDecisionResult,
    assurance: ASSURANCE,
  };
  const result = derive(partial).result;
  const value: SimulationDecisionComparison = { ...partial, result };
  const bytes = exactJsonBytes(value);
  return openSimulationDecisionComparison(bytes, sha256Bytes(bytes));
}

export function simulationDecisionComparisonBytes(
  comparison: LoadedSimulationDecisionComparison,
): Uint8Array {
  const bytes = exactJsonBytes(comparison.value);
  if (sha256Bytes(bytes) !== comparison.comparison_sha256) {
    bindingMismatch("Loaded comparison identity does not match its exact value.");
  }
  openSimulationDecisionComparison(bytes, comparison.comparison_sha256);
  return bytes;
}
