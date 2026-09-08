import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { exactJsonBytes, verifyEncodedBytes } from "@writ/decision-case";

import {
  createDecisionEpisode,
  decisionEpisodeBytes,
  openDecisionEpisode,
  type DecisionEpisode,
  type DecisionEpisodeDeclaration,
  type EpisodeHumanDecision,
  type LoadedDecisionEpisode,
} from "../src/index.js";
import { ROOT } from "./fixtures.js";

const EPISODE_PATH = join(ROOT, "examples", "decision-cases", "decision-episode", "episode.json");
const ZERO_SHA256 = `sha256:${"0".repeat(64)}`;

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

function fixture(): LoadedDecisionEpisode {
  return openDecisionEpisode(new Uint8Array(readFileSync(EPISODE_PATH)));
}

function declarationFrom(
  episode: DecisionEpisode,
  humanDecision: Omit<EpisodeHumanDecision, "considered_analysis_binding_sha256">,
): DecisionEpisodeDeclaration {
  return {
    episode_id: episode.episode_id,
    authority_basis: episode.authority_basis,
    human_decision: humanDecision,
    implementation: episode.implementation,
    observation: episode.observation,
    interpretations: episode.interpretations,
    reconsideration: episode.reconsideration,
  };
}

function suppliedDecision(episode: DecisionEpisode) {
  const { considered_analysis_binding_sha256: _derived, ...supplied } = episode.human_decision;
  return supplied;
}

test("opens one exact decision episode without collapsing its provenance layers", () => {
  const episode = fixture();
  expect(episode.value.episode_kind).toBe("decision_episode");
  expect(episode.value.checked_history.revision_id).toBe("revision.x-half-v3");
  expect(episode.value.checked_history.source_bindings.length).toBeGreaterThan(0);
  expect(episode.value.checked_history.prior_execution_sha256).not.toBe(
    episode.value.checked_history.successor_execution_sha256,
  );
  expect(episode.value.human_decision.mathematical_role).toBe("considered_not_authorizing");
  expect(episode.value.authority_basis.verification_status).toBe("supplied_not_verified_by_writ");
  expect(episode.value.interpretations).toEqual([]);
  expect(episode.value.reconsideration).toEqual(
    expect.objectContaining({
      status: "reconsideration_required",
      interpretation_ids: [],
      model_effect: "none_automatic",
      next_step: "human_review",
    }),
  );
  expect(decisionEpisodeBytes(episode)).toEqual(new Uint8Array(readFileSync(EPISODE_PATH)));
});

test("requires an explicit supplied decision and never derives its action from mathematical status", () => {
  const episode = fixture();
  const transportBytes = verifyEncodedBytes(
    episode.value.checked_history.certificate_transport_record,
    "fixture transport",
  );
  const humanDecision = {
    ...suppliedDecision(episode.value),
    selected_action: "an-explicit-human-choice-not-named-by-the-model",
    rationale: "This deliberately supplied action demonstrates that Writ does not select it.",
  };
  const changed = createDecisionEpisode(
    transportBytes,
    declarationFrom(episode.value, humanDecision),
  );
  expect(changed.value.human_decision.selected_action).toBe(
    "an-explicit-human-choice-not-named-by-the-model",
  );

  const missing = structuredClone(episode.value) as unknown as Record<string, unknown>;
  delete missing.human_decision;
  expect(() => openDecisionEpisode(exactJsonBytes(missing))).toThrow(
    expect.objectContaining({ code: "DECISION_EPISODE_INVALID" }),
  );
});

test("rejects any stale identity in the exact checked-history chain", () => {
  const changed = structuredClone(fixture().value) as Mutable<DecisionEpisode>;
  changed.checked_history.shared_analysis_sha256 = ZERO_SHA256;
  expect(() => openDecisionEpisode(exactJsonBytes(changed))).toThrow(
    expect.objectContaining({ code: "DECISION_EPISODE_BINDING_MISMATCH" }),
  );
});

test("keeps causality, correctness, and model-update claims outside the observation", () => {
  const episode = fixture().value;
  for (const claim of [
    { caused_by_decision: true },
    { decision_correct: true },
    { model_update: { probability: "1/2" } },
  ]) {
    const changed = {
      ...episode,
      observation: { ...episode.observation, ...claim },
    };
    expect(() => openDecisionEpisode(exactJsonBytes(changed))).toThrow(
      expect.objectContaining({ code: "DECISION_EPISODE_INVALID" }),
    );
  }
});

test("accepts an interpretation only as a separate reviewable declaration", () => {
  const episode = fixture();
  const transportBytes = verifyEncodedBytes(
    episode.value.checked_history.certificate_transport_record,
    "fixture transport",
  );
  const interpretation = {
    interpretation_id: "interpretation.synthetic-causality.v1",
    observation_id: episode.value.observation.observation_id,
    kind: "causal_attribution" as const,
    statement: "A reviewer proposes, but Writ does not infer, a causal attribution.",
    review: {
      status: "unreviewed" as const,
      reviewer: null,
      rationale: null,
    },
  };
  const changed = createDecisionEpisode(transportBytes, {
    ...declarationFrom(episode.value, suppliedDecision(episode.value)),
    interpretations: [interpretation],
    reconsideration: {
      ...episode.value.reconsideration,
      interpretation_ids: [interpretation.interpretation_id],
    },
  });
  expect(changed.value.interpretations).toEqual([interpretation]);
  expect(changed.value.reconsideration.model_effect).toBe("none_automatic");
});

test("requires an exact, strictly ordered decision-to-reconsideration chain", () => {
  const wrongReference = structuredClone(fixture().value) as Mutable<DecisionEpisode>;
  wrongReference.observation.implementation_id = "missing-implementation";
  expect(() => openDecisionEpisode(exactJsonBytes(wrongReference))).toThrow(
    expect.objectContaining({ code: "DECISION_EPISODE_SEQUENCE_INVALID" }),
  );

  const wrongOrder = structuredClone(fixture().value) as Mutable<DecisionEpisode>;
  wrongOrder.observation.observed_at = wrongOrder.human_decision.decided_at;
  expect(() => openDecisionEpisode(exactJsonBytes(wrongOrder))).toThrow(
    expect.objectContaining({ code: "DECISION_EPISODE_SEQUENCE_INVALID" }),
  );
});
