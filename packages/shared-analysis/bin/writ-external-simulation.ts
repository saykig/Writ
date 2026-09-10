#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { receiveExternalSimulation } from "../src/external-simulation.js";
const [path, runSha256, inputSha256, ...extra] = process.argv.slice(2);
try {
  if (!path || !runSha256 || !inputSha256 || extra.length)
    throw new Error(
      "Usage: writ-external-simulation RUN EXPECTED_RUN_SHA256 EXPECTED_INPUT_SHA256",
    );
  const { value: _value, ...receipt } = receiveExternalSimulation(readFileSync(path), {
    runSha256,
    inputSha256,
  });
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 2;
}
