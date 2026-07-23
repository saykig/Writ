import { test, expect } from "bun:test";
import { compile, analyze, evaluate, loadExamples, benchmark, verify } from "../lib/toolchain.js";

const literal = loadExamples().find((e) => e.id === "literal")!.source;

test("examples load (three readings)", () => {
  expect(loadExamples().map((e) => e.id)).toEqual(["literal", "resolved", "inclusive"]);
});

test("compile literal → schema-valid AI-SME IR", () => {
  const r = compile(literal);
  expect(r.schemaValid).toBe(true);
  expect(r.ir?.commitments[0]?.id).toBe("AI_SME_ADOPTION");
});

test("analyze literal → COV-SCORE-GAP", () => {
  expect(analyze(literal).findings.map((f) => f.code)).toContain("COV-SCORE-GAP");
});

test("evaluate japan → 0, and receipt verifies + detects tamper", () => {
  const r = evaluate(literal, "japan");
  expect(r.ok).toBe(true);
  expect(r.receipt?.result).toBe("0");
  expect(verify(r.receipt!).valid).toBe(true);
  const tampered = { ...r.receipt!, result: "+1" as const };
  expect(verify(tampered).valid).toBe(false);
});

test("benchmark reproduces 8 cells, 2 interpretation-sensitive", () => {
  const b = benchmark();
  expect(b.cells.length).toBe(8);
  expect(b.summary.matches).toBe(8);
  expect(b.summary.interpretation_sensitive_cells).toBe(2);
});
