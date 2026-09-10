import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodedBytes, exactJsonBytes, verifyEncodedBytes } from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";
import { openLinkedEpisodeRevision } from "../src/linked-episodes.js";
import { ROOT } from "./fixtures.js";
const directory = join(ROOT, "examples/decision-cases/linked-episodes");
const raw = readFileSync(join(directory, "link.json"));
const pins = JSON.parse(readFileSync(join(directory, "pins.json"), "utf8"));
const read = () => JSON.parse(raw.toString());
function receiveChanged(value: unknown) {
  const bytes = exactJsonBytes(value);
  return openLinkedEpisodeRevision(bytes, { ...pins, linkSha256: sha256Bytes(bytes) });
}

test("resolves both immutable episodes and complete external revision without superseding or updating native history", () => {
  const opened = openLinkedEpisodeRevision(raw, pins);
  expect(opened.parent.value.observation.observation_id).toBe(
    opened.value.parent_reference.observation_id,
  );
  expect(opened.priorRun.total_wait.value).toBe("2");
  expect(opened.successorRun.total_wait.value).toBe("10");
  expect(opened.value.native_model_effect).toBe("unchanged");
  expect(opened.value.supersession).toBe("none_automatic");
  expect(opened.parent.episode_sha256).toBe(pins.parentSha256);
});

test("rejects wrong named parent observation/reconsideration and stale independent episode pins", () => {
  for (const field of ["observation_id", "reconsideration_id", "episode_sha256"]) {
    const changed = read();
    changed.parent_reference[field] = field.endsWith("sha256")
      ? `sha256:${"0".repeat(64)}`
      : "different-event";
    expect(() => receiveChanged(changed)).toThrow();
  }
  expect(() =>
    openLinkedEpisodeRevision(raw, { ...pins, parentSha256: pins.successorSha256 }),
  ).toThrow();
  expect(() =>
    openLinkedEpisodeRevision(raw, { ...pins, linkSha256: `sha256:${"0".repeat(64)}` }),
  ).toThrow();
});

test("rejects coherent successor observation replacement against its original expected episode identity", () => {
  const changed = read();
  const episode = JSON.parse(
    Buffer.from(verifyEncodedBytes(changed.successor_episode, "successor")).toString(),
  );
  episode.observation.record = encodedBytes(Buffer.from("New supposed observation\n"));
  changed.successor_episode = encodedBytes(exactJsonBytes(episode));
  expect(() => receiveChanged(changed)).toThrow();
});

test("rejects omitted/misstated external revisions and model-evidence promotions", () => {
  for (const mutate of [
    (value: ReturnType<typeof read>) => {
      value.external_revision.prior_value = "4";
    },
    (value: ReturnType<typeof read>) => {
      value.external_revision.successor_input_sha256 = value.external_revision.prior_input_sha256;
    },
    (value: ReturnType<typeof read>) => {
      value.external_revision.successor_run_sha256 = value.external_revision.prior_run_sha256;
    },
    (value: ReturnType<typeof read>) => {
      value.external_revision.declared_at = "2026-02-30T00:00:00Z";
    },
    (value: ReturnType<typeof read>) => {
      value.evidence_kind = "measured";
    },
    (value: ReturnType<typeof read>) => {
      value.native_model_effect = "updated";
    },
    (value: ReturnType<typeof read>) => {
      value.supersession = "accepted";
    },
    (value: ReturnType<typeof read>) => {
      value.relationship = "causal_effect";
    },
  ]) {
    const changed = read();
    mutate(changed);
    expect(() => receiveChanged(changed)).toThrow();
  }
});

test("rejects an undeclared arrival change even when both external output and episode hashes are valid", () => {
  const changed = read();
  const child = JSON.parse(
    Buffer.from(verifyEncodedBytes(changed.successor_episode, "child")).toString(),
  );
  const run = JSON.parse(
    Buffer.from(verifyEncodedBytes(child.observation.record, "run")).toString(),
  );
  const input = JSON.parse(Buffer.from(verifyEncodedBytes(run.inputs, "input")).toString());
  const output = JSON.parse(Buffer.from(verifyEncodedBytes(run.output, "output")).toString());
  // Arrival 7 still precedes this car's actual service start 11. The revised trace
  // is numerically valid, but arrival timing is outside the declared service-only diff.
  input.arrivals[3] = "7";
  output.rows[3].arrival = "7";
  run.inputs = encodedBytes(exactJsonBytes(input));
  run.output = encodedBytes(exactJsonBytes(output));
  const runBytes = exactJsonBytes(run);
  child.observation.record = encodedBytes(runBytes);
  const childBytes = exactJsonBytes(child);
  changed.successor_episode = encodedBytes(childBytes);
  changed.external_revision.successor_run_sha256 = sha256Bytes(runBytes);
  changed.external_revision.successor_input_sha256 = run.inputs.sha256;
  const bytes = exactJsonBytes(changed);
  expect(() =>
    openLinkedEpisodeRevision(bytes, {
      ...pins,
      linkSha256: sha256Bytes(bytes),
      successorSha256: sha256Bytes(childBytes),
    }),
  ).toThrow(expect.objectContaining({ code: "LINKED_EPISODE_REVISION_INVALID" }));
});
