import { test, expect } from "bun:test";

import { analyze, compile, evaluatePilot, loadPilotExamples } from "../lib/toolchain";

const sourceFor = (id: string) => {
  const example = loadPilotExamples().find((candidate) => candidate.id === id);
  if (!example) throw new Error(`No pilot reading "${id}".`);
  return example.source;
};

test("the reviewed rule compiles to canonical IR", () => {
  expect(compile(sourceFor("reviewed")).ir).toBeDefined();
});

test("the reviewed rule analyzes clean", () => {
  expect(analyze(sourceFor("reviewed")).findings.length).toBe(0);
});

test("the reading with a band left out is caught before any evidence", () => {
  expect(analyze(sourceFor("incomplete")).findings.map((f) => f.code)).toContain("WRT-SCORE-GAP");
});

test("the reviewed rule finds one binding duty on EU providers", () => {
  const result = evaluatePilot(sourceFor("reviewed"), "eu");
  expect(result.ok).toBe(true);
  expect(result.receipt?.result).toBe("+1");
  // The receipt names the provision, not just the score.
  expect(result.receipt?.qualifying_action_ids).toEqual(["claim-eu-06"]);
});

test("the reviewed rule finds none on US providers, only on its agencies", () => {
  const result = evaluatePilot(sourceFor("reviewed"), "us");
  expect(result.ok).toBe(true);
  expect(result.receipt?.result).toBe("0");
  expect(result.receipt?.matched_rule_id).toBe("government_duty_only");
});

test("dropping `binding` and `market_provider` turns the US answer to yes", () => {
  // The loosened reading qualifies US-03, the voluntary NIST Generative AI
  // Profile. This is the collapse the reviewed rule exists to prevent, so it is
  // pinned here rather than left as prose.
  const result = evaluatePilot(sourceFor("any-actor"), "us");
  expect(result.receipt?.result).toBe("+1");
  expect(result.receipt?.qualifying_action_ids).toEqual(["claim-us-03"]);
});

test("dropping the conduct condition holds the verdict but widens the evidence", () => {
  const result = evaluatePilot(sourceFor("broad-conduct"), "eu");
  expect(result.receipt?.result).toBe("+1");
  // One provision becomes nine: documentation and reporting duties now read as
  // model evaluation. The score survives a definition that no longer means it.
  expect(result.receipt?.qualifying_action_ids?.length).toBe(9);
});

test("an unknown jurisdiction is refused rather than evaluated against the wrong snapshot", () => {
  const result = evaluatePilot(sourceFor("reviewed"), "japan");
  expect(result.ok).toBe(false);
});
