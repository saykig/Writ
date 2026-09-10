import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { encodedBytes, exactJsonBytes, verifyEncodedBytes } from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";

import { openSimulationDecisionRevision } from "../src/simulation-decision-revision.js";
import { ROOT } from "./fixtures.js";

const directory = join(ROOT, "examples/decision-cases/simulation-decision");
const raw = readFileSync(join(directory, "revision.json"));
const pins = JSON.parse(readFileSync(join(directory, "pins.json"), "utf8"));
const read = () => JSON.parse(raw.toString());

function receiveChanged(value: unknown, pinChanges: Record<string, string> = {}) {
  const bytes = exactJsonBytes(value);
  return openSimulationDecisionRevision(bytes, {
    ...pins,
    ...pinChanges,
    revisionSha256: sha256Bytes(bytes),
  });
}

test("preserves a complete rerun, ranking change and separate supplied human dispositions", () => {
  const opened = openSimulationDecisionRevision(raw, pins);
  expect(opened.ranking_change).toEqual({
    prior_status: "unique_minimum",
    prior_preferred_option_ids: ["retain"],
    successor_status: "unique_minimum",
    successor_preferred_option_ids: ["intensive"],
  });
  expect(opened.value.option_input_changes).toHaveLength(3);
  expect(opened.value.dispositions.parent.status).toBe("selected_recommended_modeled_option");
  expect(opened.value.dispositions.successor.status).toBe("deferred_or_outside_modeled_menu");
  expect(opened.value.dispositions.successor.modeled_option_id).toBeNull();
  expect(opened.parentEpisode.value.checked_history).toEqual(
    opened.successorEpisode.value.checked_history,
  );
});

test("rejects an incomplete or misstated revision declaration", () => {
  const omitted = read();
  omitted.option_input_changes.pop();
  expect(() => receiveChanged(omitted)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_REVISION_INCOMPLETE" }),
  );

  const misstated = read();
  misstated.assumption_revision.prior_value = "4";
  expect(() => receiveChanged(misstated)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_REVISION_INCOMPLETE" }),
  );
});

test("rejects an undeclared option-semantics change even when the successor comparison remains valid", () => {
  const changed = read();
  const successor = JSON.parse(
    Buffer.from(verifyEncodedBytes(changed.successor_comparison, "successor")).toString(),
  );
  successor.options[0].description = "Different supplied intervention semantics.";
  const successorBytes = exactJsonBytes(successor);
  changed.successor_comparison = encodedBytes(successorBytes);
  expect(() =>
    receiveChanged(changed, { successorComparisonSha256: sha256Bytes(successorBytes) }),
  ).toThrow(expect.objectContaining({ code: "SIMULATION_DECISION_REVISION_INCOMPLETE" }));
});

test("rejects a false comparison-to-decision disposition and substituted episode pin", () => {
  const changed = read();
  changed.dispositions.successor.status = "selected_recommended_modeled_option";
  changed.dispositions.successor.modeled_option_id = "intensive";
  expect(() => receiveChanged(changed)).toThrow(
    expect.objectContaining({ code: "SIMULATION_DECISION_REVISION_BINDING_MISMATCH" }),
  );
  expect(() =>
    openSimulationDecisionRevision(raw, {
      ...pins,
      successorEpisodeSha256: pins.parentEpisodeSha256,
    }),
  ).toThrow();
});

test("rejects an undeclared native-history change", () => {
  const changed = read();
  const successor = JSON.parse(
    Buffer.from(verifyEncodedBytes(changed.successor_episode, "successor episode")).toString(),
  );
  successor.checked_history.binding_sha256 = `sha256:${"0".repeat(64)}`;
  const successorBytes = exactJsonBytes(successor);
  changed.successor_episode = encodedBytes(successorBytes);
  expect(() =>
    receiveChanged(changed, { successorEpisodeSha256: sha256Bytes(successorBytes) }),
  ).toThrow();
});
