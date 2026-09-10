import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { encodedBytes, exactJsonBytes, verifyEncodedBytes } from "@writ/decision-case";
import { sha256Bytes } from "@writ/provenance";
import { receiveExternalSimulation } from "../src/external-simulation.js";
import { ROOT } from "./fixtures.js";

const raw = readFileSync(join(ROOT, "examples/external-simulation/simpy-resource/run-1.json"));
const runSha256 = "sha256:aff2e46ccf942f842c0e6fca0524984e0c3b373c1b435092b8e21fb3c31b393e";
const inputSha256 = "sha256:df06bb93064a29a7637c32c94dbfed9f6d6615b692a97d093b1ca54af3a3a92a";
const read = () => JSON.parse(raw.toString());

test("independent integer recurrence checks real SimPy trace without an empirical or certificate promotion", () => {
  const result = receiveExternalSimulation(raw, { runSha256, inputSha256 });
  expect(result.total_wait).toEqual({ value: "2", unit: "minute" });
  expect(result.assurance.bellman_certificate).toBe(false);
  expect(result.assurance.model_empirically_validated).toBe(false);
});

test("receives relocated output with no producer/runtime available through PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "writ-external-recipient-"));
  try {
    const file = join(dir, "run.json");
    writeFileSync(file, raw);
    const result = spawnSync(
      process.execPath,
      [
        join(ROOT, "packages/shared-analysis/bin/writ-external-simulation.ts"),
        file,
        runSha256,
        inputSha256,
      ],
      {
        cwd: dir,
        env: { PATH: "/nonexistent", WRIT_DISABLE_EXTERNAL_PRODUCER: "1" },
        encoding: "utf8",
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).total_wait.value).toBe("2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects wrong source/model/input bindings even when envelope identity is refreshed", () => {
  for (const field of ["model", "upstream_example_sha256", "inputs", "package"] as const) {
    const value = read();
    if (field === "model") value.model = encodedBytes(Buffer.from("different model\n"));
    if (field === "upstream_example_sha256") value[field] = `sha256:${"0".repeat(64)}`;
    if (field === "inputs")
      value.inputs = encodedBytes(
        exactJsonBytes({ arrivals: ["0"], service_minutes: "1", unit: "minute" }),
      );
    if (field === "package")
      value.package.source_manifest["simpy/core.py"] = `sha256:${"0".repeat(64)}`;
    const changed = exactJsonBytes(value);
    expect(() =>
      receiveExternalSimulation(changed, { runSha256: sha256Bytes(changed), inputSha256 }),
    ).toThrow(expect.objectContaining({ code: "EXTERNAL_SIMULATION_BINDING_MISMATCH" }));
  }
});

test("refreshed output integrity is insufficient when the simulated trace is numerically false", () => {
  const value = read();
  const output = JSON.parse(Buffer.from(verifyEncodedBytes(value.output, "output")).toString());
  output.rows[2].start = "4";
  value.output = encodedBytes(exactJsonBytes(output));
  const changed = exactJsonBytes(value);
  expect(() => receiveExternalSimulation(changed, { runSha256, inputSha256 })).toThrow();
  expect(() =>
    receiveExternalSimulation(changed, { runSha256: sha256Bytes(changed), inputSha256 }),
  ).toThrow(expect.objectContaining({ code: "EXTERNAL_SIMULATION_TRACE_REJECTED" }));
});

test("rejects stronger empirical/causal/certificate claims and unsupported units", () => {
  for (const patch of [
    { evidence_kind: "measured" },
    { claim: "bellman_certificate" },
    { causal_effect: "2" },
  ]) {
    const changed = exactJsonBytes({ ...read(), ...patch });
    expect(() =>
      receiveExternalSimulation(changed, { runSha256: sha256Bytes(changed), inputSha256 }),
    ).toThrow(expect.objectContaining({ code: "EXTERNAL_SIMULATION_INVALID" }));
  }
  const value = read();
  value.inputs = encodedBytes(
    exactJsonBytes({ arrivals: ["0"], service_minutes: "5", unit: "hour" }),
  );
  const changed = exactJsonBytes(value);
  expect(() =>
    receiveExternalSimulation(changed, {
      runSha256: sha256Bytes(changed),
      inputSha256: value.inputs.sha256,
    }),
  ).toThrow();
});
