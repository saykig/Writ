import _Ajv2020 from "ajv/dist/2020.js";
import {
  encodedBytes,
  exactJsonBytes,
  exactJsonKey,
  verifyEncodedBytes,
  type EncodedBytes,
} from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";
import schema from "../../../schemas/analysis/linked-episode-revision-v0.1.schema.json" with { type: "json" };
import { openDecisionEpisode, replayDecisionEpisode } from "./decision-episode.js";
import { receiveExternalSimulation } from "./external-simulation.js";
import type { EpisodeActor } from "./episode-types.js";
import type { TransportEngineOptions } from "./transport-types.js";

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile<LinkedEpisodeRevision>(
  schema,
);

export class LinkedEpisodeError extends Error {
  constructor(
    readonly code:
      | "LINKED_EPISODE_INVALID"
      | "LINKED_EPISODE_BINDING_MISMATCH"
      | "LINKED_EPISODE_REVISION_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "LinkedEpisodeError";
  }
}
export interface LinkedEpisodeRevision {
  readonly schema_version: "0.1.0";
  readonly record_kind: "linked_episode_revision";
  readonly parent_episode: EncodedBytes;
  readonly successor_episode: EncodedBytes;
  readonly parent_reference: {
    readonly episode_sha256: string;
    readonly observation_id: string;
    readonly reconsideration_id: string;
  };
  readonly external_revision: {
    readonly prior_run_sha256: string;
    readonly successor_run_sha256: string;
    readonly prior_input_sha256: string;
    readonly successor_input_sha256: string;
    readonly changed_field: "service_minutes";
    readonly prior_value: string;
    readonly successor_value: string;
    readonly reason: string;
    readonly declared_by: EpisodeActor;
    readonly declared_at: string;
  };
  readonly relationship: "explicit_reconsideration";
  readonly evidence_kind: "model_generated";
  readonly native_model_effect: "unchanged";
  readonly supersession: "none_automatic";
}
export interface LinkedEpisodePins {
  readonly linkSha256: string;
  readonly parentSha256: string;
  readonly successorSha256: string;
}
export type LinkedEpisodeDeclaration = Omit<
  LinkedEpisodeRevision,
  "schema_version" | "record_kind" | "parent_episode" | "successor_episode"
>;
function mismatch(message: string): never {
  throw new LinkedEpisodeError("LINKED_EPISODE_BINDING_MISMATCH", message);
}
function revisionError(message: string): never {
  throw new LinkedEpisodeError("LINKED_EPISODE_REVISION_INVALID", message);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** Resolves the pair and checks external traces. Native mathematical checks require replay. */
export function openLinkedEpisodeRevision(raw: Uint8Array, pins: LinkedEpisodePins) {
  if (raw.length === 0 || raw.length > 50 * 1024 * 1024 || sha256Bytes(raw) !== pins.linkSha256)
    mismatch("Wrong expected link identity or size.");
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new LinkedEpisodeError("LINKED_EPISODE_INVALID", "Invalid link JSON.");
  }
  if (!validate(value) || !Buffer.from(exactJsonBytes(value)).equals(Buffer.from(raw)))
    throw new LinkedEpisodeError(
      "LINKED_EPISODE_INVALID",
      "Unsupported or noncanonical linked episode contract.",
    );
  const parentBytes = verifyEncodedBytes(value.parent_episode, "parent_episode");
  const successorBytes = verifyEncodedBytes(value.successor_episode, "successor_episode");
  const parent = openDecisionEpisode(parentBytes, pins.parentSha256);
  const successor = openDecisionEpisode(successorBytes, pins.successorSha256);
  const ref = value.parent_reference;
  if (
    ref.episode_sha256 !== parent.episode_sha256 ||
    ref.observation_id !== parent.value.observation.observation_id ||
    ref.reconsideration_id !== parent.value.reconsideration.reconsideration_id
  )
    mismatch(
      "Parent reference does not resolve the pinned episode observation and reconsideration.",
    );
  if (
    parent.episode_sha256 === successor.episode_sha256 ||
    parent.value.episode_id === successor.value.episode_id
  )
    revisionError("A distinct successor episode is required.");
  if (exactJsonKey(parent.value.checked_history) !== exactJsonKey(successor.value.checked_history))
    revisionError(
      "This external-only revision cannot alter or transfer the native mathematical history.",
    );
  const change = value.external_revision;
  const timestamp = Date.parse(change.declared_at);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== change.declared_at.replace("Z", ".000Z") ||
    !(
      parent.value.reconsideration.declared_at < change.declared_at &&
      change.declared_at < successor.value.human_decision.decided_at
    )
  )
    revisionError(
      "External revision must follow parent reconsideration and precede the successor decision at real UTC instants.",
    );
  // The observation's exact record IS the labelled simulation envelope, not an untyped
  // measured-outcome claim. Even standalone extraction preserves its model-generated label.
  const priorRun = receiveExternalSimulation(
    verifyEncodedBytes(parent.value.observation.record, "parent observation"),
    {
      runSha256: change.prior_run_sha256,
      inputSha256: change.prior_input_sha256,
    },
  );
  const successorRun = receiveExternalSimulation(
    verifyEncodedBytes(successor.value.observation.record, "successor observation"),
    {
      runSha256: change.successor_run_sha256,
      inputSha256: change.successor_input_sha256,
    },
  );
  if (
    change.prior_value !== priorRun.input.service_minutes ||
    change.successor_value !== successorRun.input.service_minutes ||
    change.prior_value === change.successor_value ||
    exactJsonKey(priorRun.input.arrivals) !== exactJsonKey(successorRun.input.arrivals)
  )
    revisionError("The declared service-time change must be the complete actual input diff.");
  return freeze({
    value,
    link_sha256: sha256Bytes(raw),
    parent,
    successor,
    priorRun,
    successorRun,
  });
}

export function createLinkedEpisodeRevision(
  parent: Uint8Array,
  successor: Uint8Array,
  declaration: LinkedEpisodeDeclaration,
): Uint8Array {
  const value: LinkedEpisodeRevision = {
    schema_version: "0.1.0",
    record_kind: "linked_episode_revision",
    parent_episode: encodedBytes(parent),
    successor_episode: encodedBytes(successor),
    ...declaration,
  };
  const bytes = exactJsonBytes(value);
  openLinkedEpisodeRevision(bytes, {
    linkSha256: sha256Bytes(bytes),
    parentSha256: declaration.parent_reference.episode_sha256,
    successorSha256: sha256Bytes(successor),
  });
  return bytes;
}

/** Producer-disabled native receiving remains separate from external trace agreement. */
export function replayLinkedEpisodeRevision(
  raw: Uint8Array,
  pins: LinkedEpisodePins,
  options: TransportEngineOptions,
) {
  const opened = openLinkedEpisodeRevision(raw, pins);
  const parent = replayDecisionEpisode(verifyEncodedBytes(opened.value.parent_episode, "parent"), {
    ...options,
    expectedEpisodeSha256: pins.parentSha256,
  });
  const successor = replayDecisionEpisode(
    verifyEncodedBytes(opened.value.successor_episode, "successor"),
    { ...options, expectedEpisodeSha256: pins.successorSha256 },
  );
  return freeze({
    link_sha256: opened.link_sha256,
    parent_reference: opened.value.parent_reference,
    external_revision: opened.value.external_revision,
    native_checks: { parent, successor },
    external_checks: {
      parent: {
        run_sha256: opened.priorRun.run_sha256,
        total_wait: opened.priorRun.total_wait,
        assurance: opened.priorRun.assurance,
      },
      successor: {
        run_sha256: opened.successorRun.run_sha256,
        total_wait: opened.successorRun.total_wait,
        assurance: opened.successorRun.assurance,
      },
    },
    relationship: "explicit_reconsideration" as const,
    supersession: "none_automatic" as const,
    automatic_inferences: {
      causality: false,
      authority: false,
      empirical_validation: false,
      native_model_update: false,
    },
  });
}
