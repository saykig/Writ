import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze, benchmark, compile, evaluate } from "../lib/toolchain";
import { repoRoot } from "../lib/repo";

const read = (f: string) => readFileSync(join(repoRoot(), "examples", f), "utf8");
const literal = read("2025-ai-sme-literal.covenant");
const resolved = read("2025-ai-sme-resolved.covenant");

test("compile produces canonical IR", () => {
  expect(compile(literal).ir).toBeDefined();
});
test("analyze finds the gap on the literal reading", () => {
  expect(analyze(literal).findings.map((f) => f.code)).toContain("COV-SCORE-GAP");
});
test("the resolved reading analyzes clean", () => {
  expect(analyze(resolved).findings.length).toBe(0);
});
test("evaluating japan under the published profile yields 0", () => {
  const r = evaluate(resolved, "japan", "published");
  expect(r.ok).toBe(true);
  expect(r.receipt?.result).toBe("0");
});
test("the benchmark reproduces all eight cells", () => {
  const b = benchmark();
  expect(b.cells.length).toBe(8);
  expect(b.summary.matches).toBe(8);
});
