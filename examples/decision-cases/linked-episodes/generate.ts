import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodedBytes, verifyEncodedBytes } from "../../../packages/decision-case/src/index.js";
import { sha256Bytes } from "../../../packages/provenance/src/index.js";
import {
  openDecisionEpisode,
  createDecisionEpisode,
  decisionEpisodeBytes,
  createLinkedEpisodeRevision,
  receiveExternalSimulation,
} from "../../../packages/shared-analysis/src/index.js";

const root = join(import.meta.dir, "../../..");
const base = openDecisionEpisode(
  readFileSync(join(root, "examples/decision-cases/decision-episode/episode.json")),
);
const transport = verifyEncodedBytes(
  base.value.checked_history.certificate_transport_record,
  "retained native history",
);
const directory = process.argv[2];
if (!directory) throw new Error("Supply a new existing output directory; files are creation-only.");
const runs = [1, 2].map((n) =>
  readFileSync(join(root, `examples/external-simulation/simpy-resource/run-${n}.json`)),
);
const episodes = runs.map((run, i) => {
  const n = i + 1;
  const day = i === 0 ? 1 : 6;
  const inputSha = JSON.parse(run.toString()).inputs.sha256 as string;
  const received = receiveExternalSimulation(run, {
    runSha256: sha256Bytes(run),
    inputSha256: inputSha,
  });
  const value = base.value;
  // This is a new supplied synthetic story, not an edit of the retained original episode.
  return createDecisionEpisode(transport, {
    episode_id: `episode.charging-planning.${n}`,
    authority_basis: value.authority_basis,
    human_decision: {
      ...value.human_decision,
      decision_id: `decision.charging.${n}`,
      decided_at: `2026-10-0${day}T09:00:00Z`,
      selected_action: "commission-simulation-only",
      rationale: `Synthetic board commissions a ${received.input.service_minutes}-minute service scenario. Native A/B loss history is separately considered; no queue-time-to-loss conversion or deployment authority is inferred.`,
    },
    implementation: {
      ...value.implementation,
      implementation_id: `implementation.charging.${n}`,
      decision_id: `decision.charging.${n}`,
      implemented_at: `2026-10-0${day + 1}T09:00:00Z`,
      implemented_action: "simulation-only",
      description:
        "Supplied synthetic execution record, not deployment or observed station performance.",
      record: encodedBytes(
        Buffer.from(
          `Synthetic commission: run pinned SimPy scenario ${n}; no real-world implementation claimed.\n`,
        ),
      ),
    },
    observation: {
      ...value.observation,
      observation_id: `observation.charging.${n}`,
      implementation_id: `implementation.charging.${n}`,
      observed_at: `2026-10-0${day + 2}T09:00:00Z`,
      description: `Model-generated scenario output: total simulated waiting ${received.total_wait.value} minutes. This is not measured station performance.`,
      record: encodedBytes(run),
    },
    interpretations: [],
    reconsideration: {
      ...value.reconsideration,
      reconsideration_id: `reconsideration.charging.${n}`,
      observation_id: `observation.charging.${n}`,
      declared_at: `2026-10-0${day + 3}T09:00:00Z`,
      interpretation_ids: [],
      rationale:
        n === 1
          ? "Synthetic board asks for a slower-service stress scenario; five-minute service is unvalidated."
          : "Synthetic board requests real service-time evidence before any deployment; neither simulation validates the model.",
    },
  });
});
const parent = episodes[0]!;
const successor = episodes[1]!;
const first = JSON.parse(runs[0]!.toString());
const second = JSON.parse(runs[1]!.toString());
const link = createLinkedEpisodeRevision(
  decisionEpisodeBytes(parent),
  decisionEpisodeBytes(successor),
  {
    parent_reference: {
      episode_sha256: parent.episode_sha256,
      observation_id: parent.value.observation.observation_id,
      reconsideration_id: parent.value.reconsideration.reconsideration_id,
    },
    external_revision: {
      prior_run_sha256: sha256Bytes(runs[0]!),
      successor_run_sha256: sha256Bytes(runs[1]!),
      prior_input_sha256: first.inputs.sha256,
      successor_input_sha256: second.inputs.sha256,
      changed_field: "service_minutes",
      prior_value: "5",
      successor_value: "9",
      reason:
        "Declared stress-test revision of unvalidated service duration; a model rerun, not a new empirical observation or causal effect.",
      declared_by: parent.value.reconsideration.declared_by,
      declared_at: "2026-10-05T09:00:00Z",
    },
    relationship: "explicit_reconsideration",
    evidence_kind: "model_generated",
    native_model_effect: "unchanged",
    supersession: "none_automatic",
  },
);
const artifacts = {
  "parent.json": decisionEpisodeBytes(parent),
  "successor.json": decisionEpisodeBytes(successor),
  "link.json": link,
};
for (const [name, bytes] of Object.entries(artifacts))
  writeFileSync(join(directory, name), bytes, { flag: "wx" });
writeFileSync(
  join(directory, "pins.json"),
  JSON.stringify(
    {
      linkSha256: sha256Bytes(link),
      parentSha256: parent.episode_sha256,
      successorSha256: successor.episode_sha256,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
