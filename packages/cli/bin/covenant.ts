#!/usr/bin/env bun
// Executable entry point for the `covenant` CLI. Delegates to `runCli` and maps
// its returned exit code onto the process. Keeps all logic (and testability) in
// `../src/index.ts`.
import { runCli } from "../src/index.js";

const code = await runCli(process.argv.slice(2));
process.exit(code);
