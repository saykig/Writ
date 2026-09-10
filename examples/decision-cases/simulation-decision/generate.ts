import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { encodedBytes, verifyEncodedBytes } from "../../../packages/decision-case/src/index.js";
import { sha256Bytes } from "../../../packages/provenance/src/index.js";
import {
  createDecisionEpisode,
  createSimulationDecisionComparison,
  createSimulationDecisionRevision,
  decisionEpisodeBytes,
  openDecisionEpisode,
  simulationDecisionComparisonBytes,
  type SimulationDecisionOptionDeclaration,
} from "../../../packages/shared-analysis/src/index.js";

const root = join(import.meta.dir, "../../..");
const outputDirectory = process.argv[2];
if (!outputDirectory) {
  throw new Error("Supply a new existing output directory; files are creation-only.");
}

const base = openDecisionEpisode(
  readFileSync(join(root, "examples/decision-cases/decision-episode/episode.json")),
);
const transport = verifyEncodedBytes(
  base.value.checked_history.certificate_transport_record,
  "retained native history",
);
const simulationDirectory = join(root, "examples/external-simulation/simpy-resource");
const runsByService = new Map(
  [
    ["1", "run-service-1.json"],
    ["3", "run-service-3.json"],
    ["5", "run-1.json"],
    ["7", "run-service-7.json"],
    ["9", "run-2.json"],
  ].map(([service, file]) => [service, readFileSync(join(simulationDirectory, file!))]),
);

const optionTemplates = [
  {
    option_id: "intensive",
    action_id: "use_intensive_process",
    description:
      "Apply the supplied intensive-process assumption, four minutes below base service.",
    service_delta_minutes: "-4",
    fixed_cost: { value: "7", unit: "stipulated_loss_point" },
  },
  {
    option_id: "retain",
    action_id: "retain_current_process",
    description: "Retain the supplied base-service process.",
    service_delta_minutes: "0",
    fixed_cost: { value: "0", unit: "stipulated_loss_point" },
  },
  {
    option_id: "streamline",
    action_id: "use_streamlined_process",
    description:
      "Apply the supplied streamlined-process assumption, two minutes below base service.",
    service_delta_minutes: "-2",
    fixed_cost: { value: "4", unit: "stipulated_loss_point" },
  },
] as const;

function comparison(baseService: string, comparisonId: string, completedAt: string) {
  const options: SimulationDecisionOptionDeclaration[] = optionTemplates.map((option) => {
    const service = String(BigInt(baseService) + BigInt(option.service_delta_minutes));
    const run = runsByService.get(service);
    if (run === undefined) throw new Error(`Missing retained actual run for service ${service}.`);
    return { ...option, run };
  });
  return createSimulationDecisionComparison({
    comparison_id: comparisonId,
    completed_at: completedAt,
    scenario: {
      assumption_id: "assumption.synthetic.base-service-duration",
      base_service_minutes: baseService,
      arrivals: ["0", "2", "4", "6"],
      unit: "minute",
      status: "supplied_not_empirically_validated",
      statement:
        "Synthetic constant base service duration; option deltas are supplied intervention mappings, not estimated causal effects.",
    },
    option_class: {
      declared_menu_completeness: "complete",
      real_world_option_completeness: "not_established",
      scope_statement:
        "Exactly retain, streamline and intensive for this synthetic two-server FIFO menu; no claim covers other capacities, schedules or real policies.",
    },
    objective: {
      sense: "minimize",
      output_metric: "total_wait",
      output_unit: "minute",
      loss_unit: "stipulated_loss_point",
      mapping: "total_loss=wait_weight*total_wait+fixed_cost",
      wait_weight: { value: "1", unit: "stipulated_loss_point_per_minute" },
      preference_statement:
        "For this synthetic comparison only, one total simulated waiting minute counts as one stipulated loss point; fixed option burdens are 0, 4 and 7 stipulated loss points.",
      rounding: "none_exact_integer_arithmetic",
      tolerance: "0",
    },
    options,
  });
}

const parentComparison = comparison(
  "5",
  "comparison.synthetic-charging.base-service-5",
  "2026-10-01T08:00:00Z",
);
const successorComparison = comparison(
  "9",
  "comparison.synthetic-charging.base-service-9",
  "2026-10-06T08:00:00Z",
);

function episode(suffix: "parent" | "successor", comparisonSha256: string, selectedAction: string) {
  const parent = suffix === "parent";
  const day = parent ? 1 : 6;
  const value = base.value;
  return createDecisionEpisode(transport, {
    episode_id: `episode.synthetic-charging-decision.${suffix}`,
    authority_basis: value.authority_basis,
    human_decision: {
      ...value.human_decision,
      decision_id: `decision.synthetic-charging.${suffix}`,
      decided_at: `2026-10-0${day}T09:00:00Z`,
      selected_action: selectedAction,
      rationale: parent
        ? `Supplied synthetic choice to retain the current process after considering comparison ${comparisonSha256}; the comparison does not authorize the choice.`
        : `Supplied synthetic choice to seek empirical service evidence rather than adopt the conditionally preferred modeled option from ${comparisonSha256}.`,
    },
    implementation: {
      ...value.implementation,
      implementation_id: `implementation.synthetic-charging.${suffix}`,
      decision_id: `decision.synthetic-charging.${suffix}`,
      implemented_at: `2026-10-0${day + 1}T09:00:00Z`,
      implemented_action: selectedAction,
      description:
        "Synthetic supplied implementation declaration only; no charging-station deployment or measurement is claimed.",
      record: encodedBytes(
        Buffer.from(
          `Synthetic declaration: ${selectedAction}. No real deployment or empirical observation.\n`,
        ),
      ),
    },
    observation: {
      ...value.observation,
      observation_id: `observation.synthetic-charging.${suffix}`,
      implementation_id: `implementation.synthetic-charging.${suffix}`,
      observed_at: `2026-10-0${day + 2}T09:00:00Z`,
      description:
        "No empirical outcome is supplied; the separately bound comparison remains model-generated.",
      record: encodedBytes(
        Buffer.from("Synthetic record: empirical applicability remains not established.\n"),
      ),
    },
    interpretations: [],
    reconsideration: {
      ...value.reconsideration,
      reconsideration_id: `reconsideration.synthetic-charging.${suffix}`,
      observation_id: `observation.synthetic-charging.${suffix}`,
      declared_at: `2026-10-0${day + 3}T09:00:00Z`,
      interpretation_ids: [],
      rationale: parent
        ? "Re-run every declared option after revising the unvalidated base service duration from five to nine minutes."
        : "Obtain empirical service-time and implementation-burden evidence before considering real adoption.",
    },
  });
}

const parentEpisode = episode(
  "parent",
  parentComparison.comparison_sha256,
  "retain_current_process",
);
const successorEpisode = episode(
  "successor",
  successorComparison.comparison_sha256,
  "seek_empirical_service_evidence",
);
const revision = createSimulationDecisionRevision(
  parentComparison,
  successorComparison,
  parentEpisode,
  successorEpisode,
  {
    reason:
      "Stress the supplied base-service assumption; this is a model revision and rerun, not an observed before/after causal effect.",
    declared_by: parentEpisode.value.reconsideration.declared_by,
    declared_at: "2026-10-05T09:00:00Z",
  },
);

const artifacts = {
  "parent-comparison.json": simulationDecisionComparisonBytes(parentComparison),
  "successor-comparison.json": simulationDecisionComparisonBytes(successorComparison),
  "parent-episode.json": decisionEpisodeBytes(parentEpisode),
  "successor-episode.json": decisionEpisodeBytes(successorEpisode),
  "revision.json": revision,
};
for (const [name, bytes] of Object.entries(artifacts)) {
  writeFileSync(join(outputDirectory, name), bytes, { flag: "wx" });
}
writeFileSync(
  join(outputDirectory, "pins.json"),
  `${JSON.stringify(
    {
      revisionSha256: sha256Bytes(revision),
      parentComparisonSha256: parentComparison.comparison_sha256,
      successorComparisonSha256: successorComparison.comparison_sha256,
      parentEpisodeSha256: parentEpisode.episode_sha256,
      successorEpisodeSha256: successorEpisode.episode_sha256,
    },
    null,
    2,
  )}\n`,
  { flag: "wx" },
);
