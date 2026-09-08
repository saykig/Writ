#!/usr/bin/env bun

import { readFileSync } from "node:fs";

import { DecisionEpisodeError, replayDecisionEpisode } from "../src/index.js";

function option(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === undefined || value.startsWith("--")) throw new Error(`Missing ${name}.`);
  return value;
}

function main(args: readonly string[]): number {
  if (args[0] !== "replay") {
    throw new Error(
      "Usage: writ-decision-episode replay --episode <file> --engine-root <path> [--python <path>]",
    );
  }
  const episode = readFileSync(option(args, "--episode"));
  const engineRoot = option(args, "--engine-root");
  const pythonIndex = args.indexOf("--python");
  const pythonExecutable = pythonIndex >= 0 ? option(args, "--python") : undefined;
  const options =
    pythonExecutable === undefined ? { engineRoot } : { engineRoot, pythonExecutable };
  console.log(JSON.stringify(replayDecisionEpisode(episode, options), null, 2));
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof DecisionEpisodeError) {
    console.error(
      JSON.stringify({ code: error.code, message: error.message, detail: error.detail }),
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 2;
}
