import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { encodedBytes, exactJsonBytes, verifyEncodedBytes } from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import {
  createSimulationDecisionComparison,
  openSimulationDecisionComparison,
} from "../src/simulation-decision.js";
import { ROOT } from "./fixtures.js";

const directory = join(ROOT, "examples/decision-cases/simulation-decision");
const simulationDirectory = join(ROOT, "examples/external-simulation/simpy-resource");
const parentRaw = readFileSync(join(directory, "parent-comparison.json"));
const successorRaw = readFileSync(join(directory, "successor-comparison.json"));
const pins = JSON.parse(readFileSync(join(directory, "pins.json"), "utf8"));
const readParent = () => JSON.parse(parentRaw.toString());

function receiveChanged(value: unknown) {
  const bytes = exactJsonBytes(value);
  return openSimulationDecisionComparison(bytes, sha256Bytes(bytes));
}

test("freshly checks every actual option run and exact supplied objective without authorizing adoption", () => {
  const parent = openSimulationDecisionComparison(parentRaw, pins.parentComparisonSha256);
  const successor = openSimulationDecisionComparison(successorRaw, pins.successorComparisonSha256);
  expect(parent.value.result.preferred_option_ids).toEqual(["retain"]);
  expect(parent.value.result.option_losses.map((item) => item.total_loss.value)).toEqual([
    "7",
    "2",
    "4",
  ]);
  expect(successor.value.result.preferred_option_ids).toEqual(["intensive"]);
  expect(successor.value.result.option_losses.map((item) => item.total_loss.value)).toEqual([
    "9",
    "10",
    "10",
  ]);
  expect(successor.value.result.applicability_status).toBe("not_established");
  expect(successor.value.assurance.objective_empirically_identified).toBe(false);
  expect(successor.value.assurance.recommendation_authorizes_action).toBe(false);
});

test("retains an exact tie instead of fabricating one preferred option", () => {
  const successor = JSON.parse(successorRaw.toString());
  const runs = successor.options.map((option: { run: unknown }) =>
    verifyEncodedBytes(option.run as never, "run"),
  );
  const tied = createSimulationDecisionComparison({
    comparison_id: "comparison.tie-control",
    completed_at: "2026-10-06T08:30:00Z",
    scenario: successor.scenario,
    option_class: successor.option_class,
    objective: successor.objective,
    options: successor.options.map(
      (
        option: {
          option_id: string;
          action_id: string;
          description: string;
          service_delta_minutes: string;
          fixed_cost: { value: string; unit: string };
        },
        index: number,
      ) => ({
        option_id: option.option_id,
        action_id: option.action_id,
        description: option.description,
        service_delta_minutes: option.service_delta_minutes,
        fixed_cost:
          option.option_id === "intensive"
            ? { value: "8", unit: "stipulated_loss_point" }
            : option.fixed_cost,
        run: runs[index]!,
      }),
    ),
  });
  expect(tied.value.result.comparison_status).toBe("exact_tie");
  expect(tied.value.result.preferred_option_ids).toEqual(["intensive", "retain", "streamline"]);
});

test("rejects wrong units and mapping as unsupported semantics", () => {
  for (const mutate of [
    (value: ReturnType<typeof readParent>) => {
      value.scenario.unit = "hour";
    },
    (value: ReturnType<typeof readParent>) => {
      value.objective.loss_unit = "USD";
    },
    (value: ReturnType<typeof readParent>) => {
      value.objective.mapping = "trust_retained_total";
    },
    (value: ReturnType<typeof readParent>) => {
      value.objective.tolerance = "1";
    },
  ]) {
    const value = readParent();
    mutate(value);
    expect(() => receiveChanged(value)).toThrow(
      expect.objectContaining({ code: "SIMULATION_DECISION_UNSUPPORTED" }),
    );
  }
});

test("rejects stale output and substituted option input even when comparison identity is refreshed", () => {
  const stale = readParent();
  stale.scenario.base_service_minutes = "9";
  expect(() => receiveChanged(stale)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_BINDING_MISMATCH" }),
  );

  const substituted = readParent();
  const differentRun = readFileSync(join(simulationDirectory, "run-service-3.json"));
  const parsedRun = JSON.parse(differentRun.toString());
  const retain = substituted.options.find(
    (option: { option_id: string }) => option.option_id === "retain",
  );
  retain.run = encodedBytes(differentRun);
  retain.run_sha256 = sha256Bytes(differentRun);
  retain.input_sha256 = parsedRun.inputs.sha256;
  expect(() => receiveChanged(substituted)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_BINDING_MISMATCH" }),
  );
});

test("rejects a substituted model and false optimum after all enclosing hashes are refreshed", () => {
  const substituted = readParent();
  const option = substituted.options[0];
  const run = JSON.parse(Buffer.from(verifyEncodedBytes(option.run, "run")).toString());
  run.model = encodedBytes(Buffer.from("different model\n"));
  const runBytes = exactJsonBytes(run);
  option.run = encodedBytes(runBytes);
  option.run_sha256 = sha256Bytes(runBytes);
  expect(() => receiveChanged(substituted)).toThrow();

  const falseOptimum = readParent();
  falseOptimum.result.preferred_option_ids = ["intensive"];
  expect(() => receiveChanged(falseOptimum)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_RESULT_REJECTED" }),
  );
});

test("requires the recipient's independently retained comparison identity", () => {
  expect(() => openSimulationDecisionComparison(parentRaw, `sha256:${"0".repeat(64)}`)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_BINDING_MISMATCH" }),
  );
});
