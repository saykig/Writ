import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCli, type CliIO } from "../src/index.js";

const NIST_RECORDS = fileURLToPath(
  new URL("../../../corpora/institutional/us/nist/records.writ", import.meta.url),
);

function capture(): { io: CliIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

describe("writ CLI", () => {
  test("help exposes only active record commands", async () => {
    const captured = capture();
    expect(await runCli(["help"], captured.io)).toBe(0);
    const usage = captured.out.join("\n");
    expect(usage).toContain("writ fmt");
    expect(usage).toContain("writ check");
    expect(usage).toContain("writ compile");
    for (const retired of ["evaluate", "receipt", "analyze", "scenario", "writ test"])
      expect(usage).not.toContain(retired);
  });

  test("retired execution commands are unknown", async () => {
    for (const command of ["evaluate", "receipt", "analyze", "test"]) {
      const captured = capture();
      expect(await runCli([command], captured.io)).toBe(2);
      expect(captured.err[0]).toBe(`Unknown command: ${command}`);
    }
  });

  test("compile succeeds for the NIST record corpus and emits native records", async () => {
    const captured = capture();
    expect(await runCli(["compile", NIST_RECORDS, "--json"], captured.io)).toBe(0);
    const output = JSON.parse(captured.out.join("\n")) as {
      records: Array<{ family: string }>;
      judgments: unknown[];
    };
    expect(output.records.length).toBeGreaterThan(0);
    expect(output.records.every((record) => record.family === "institutional")).toBe(true);
    expect(output.judgments).toEqual([]);
    expect(captured.err).toEqual([]);
  });
});
