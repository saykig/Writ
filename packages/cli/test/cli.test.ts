import { afterAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli, type CliIO } from "../src/index.js";

function example(name: string): string {
  return fileURLToPath(
    new URL(
      `../../../internal/verification/fixtures/compatibility/g7-ai-sme/schemas/${name}`,
      import.meta.url,
    ),
  );
}

const IR = example("2025-ai-sme-literal.ir.json");
const EVIDENCE = example("2025-ai-sme.sample-evidence.json");
const PROFILE = example("2025-ai-sme.sample-profile.json");

const workdir = mkdtempSync(join(tmpdir(), "writ-cli-"));
afterAll(() => rmSync(workdir, { recursive: true, force: true }));

function capture(): { io: CliIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (l) => out.push(l), err: (l) => err.push(l) }, out, err };
}

describe("writ CLI", () => {
  test("evaluate prints a human summary and exits 0", async () => {
    const { io, out } = capture();
    const code = await runCli(
      ["evaluate", "--ir", IR, "--evidence", EVIDENCE, "--subject", "Canada", "--profile", PROFILE],
      io,
    );
    expect(code).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("Result:");
    expect(text).toContain("unresolved");
    expect(text).toContain("sha256:");
  });

  test("evaluate --json emits a receipt that round-trips through verify", async () => {
    const evalIO = capture();
    const code = await runCli(
      ["evaluate", "--ir", IR, "--evidence", EVIDENCE, "--subject", "Canada", "--json"],
      evalIO.io,
    );
    expect(code).toBe(0);
    const receiptJson = evalIO.out.join("\n");
    const receipt = JSON.parse(receiptJson);
    expect(receipt.schema_version).toBe("1.0.0");

    const path = join(workdir, "receipt.json");
    writeFileSync(path, receiptJson);

    const verifyIO = capture();
    const verifyCode = await runCli(["receipt", "verify", path], verifyIO.io);
    expect(verifyCode).toBe(0);
    expect(verifyIO.out.join("\n")).toContain("OK:");
  });

  test("receipt verify exits non-zero on a tampered receipt", async () => {
    const evalIO = capture();
    await runCli(
      ["evaluate", "--ir", IR, "--evidence", EVIDENCE, "--subject", "Canada", "--json"],
      evalIO.io,
    );
    const receipt = JSON.parse(evalIO.out.join("\n"));
    receipt.result = "+1"; // tamper without recomputing the hash

    const path = join(workdir, "tampered.json");
    writeFileSync(path, JSON.stringify(receipt));

    const verifyIO = capture();
    const code = await runCli(["receipt", "verify", path], verifyIO.io);
    expect(code).toBe(1);
    expect(verifyIO.err.join("\n")).toContain("TAMPERED");
  });

  test("missing required flags exit 2 with usage", async () => {
    const { io, err } = capture();
    const code = await runCli(["evaluate", "--ir", IR], io);
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("missing required flag");
  });
});
