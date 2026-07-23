// The Writ CLI.
//
// Evaluator commands (CORE-009, no DB, no network):
//
//   writ evaluate --ir <file> --evidence <file> --subject <id>
//                     [--profile <file>] [--as-of <date>] [--cutoff <date>] [--json]
//   writ receipt verify <receipt.json>
//
// Language commands (LANG-004, no DB, no network):
//
//   writ fmt <files...> [--write] [--check]
//   writ check <files...> [--json]
//   writ compile <file> [--out <file>] [--json]
//   writ analyze <file> [--json]
//   writ test <files...> [--json]
//
// `evaluate` runs the deterministic commitment evaluator and prints the receipt.
// `receipt verify` recomputes the canonical hash and exits non-zero on tamper.
// The language commands drive `@writ/language` and `@writ/analyzer`.
// Argument parsing uses the Node built-in `parseArgs` — no third-party dependency.

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { evaluateCommitment, verifyReceipt, type EvaluateCommitmentOptions } from "@writ/evaluator";
import {
  validate,
  type CanonicalIr,
  type EvaluationReceipt,
  type Evidence,
  type InterpretationProfile,
  type SchemaKind,
} from "@writ/domain";
import { processIO, type CliIO } from "./io.js";
import { runAnalyze, runCheck, runCompile, runFmt, runTest } from "./language-commands.js";

export type { CliIO } from "./io.js";

const USAGE = [
  "writ — Writ toolchain",
  "",
  "Usage:",
  "  writ evaluate --ir <file> --evidence <file> --subject <id>",
  "                    [--profile <file>] [--as-of <date>] [--cutoff <date>] [--json]",
  "  writ receipt verify <receipt.json>",
  "  writ fmt <files...> [--write] [--check]",
  "  writ check <files...> [--json]",
  "  writ compile <file> [--out <file>] [--json]",
  "  writ analyze <file> [--json]",
  "  writ test <files...> [--json]",
].join("\n");

/**
 * Run the CLI over an argument vector (everything after `writ`). Returns a
 * process exit code; never calls `process.exit` itself so it stays testable.
 */
export async function runCli(argv: readonly string[], io: CliIO = processIO): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === "evaluate") return runEvaluate(rest, io);
    if (command === "receipt") return runReceipt(rest, io);
    if (command === "fmt") return runFmt(rest, io);
    if (command === "check") return runCheck(rest, io);
    if (command === "compile") return runCompile(rest, io);
    if (command === "analyze") return runAnalyze(rest, io);
    if (command === "test") return runTest(rest, io);
    if (command === "help" || command === "--help" || command === "-h" || command === undefined) {
      io.out(USAGE);
      return command === undefined ? 2 : 0;
    }
    io.err(`Unknown command: ${command}`);
    io.err(USAGE);
    return 2;
  } catch (error) {
    io.err(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

// --- evaluate ---------------------------------------------------------------

function runEvaluate(args: readonly string[], io: CliIO): number {
  const { values } = parseArgs({
    args: [...args],
    options: {
      ir: { type: "string" },
      evidence: { type: "string" },
      subject: { type: "string" },
      profile: { type: "string" },
      "as-of": { type: "string" },
      cutoff: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const missing = (["ir", "evidence", "subject"] as const).filter((flag) => !values[flag]);
  if (missing.length > 0) {
    io.err(`error: missing required flag(s): ${missing.map((flag) => `--${flag}`).join(", ")}`);
    io.err(USAGE);
    return 2;
  }

  const ir = loadValidated<CanonicalIr>(values.ir as string, "canonical-ir", io);
  const snapshot = loadValidated<Evidence>(values.evidence as string, "evidence", io);
  const profile =
    values.profile !== undefined
      ? loadValidated<InterpretationProfile>(values.profile, "interpretation-profile", io)
      : undefined;

  const options: EvaluateCommitmentOptions = {
    ir,
    snapshot,
    subject: values.subject as string,
    ...(profile !== undefined ? { profile } : {}),
    ...(values["as-of"] !== undefined ? { as_of: values["as-of"] } : {}),
    ...(values.cutoff !== undefined ? { cutoff: values.cutoff } : {}),
  };

  const receipt = evaluateCommitment(options);

  if (values.json) {
    io.out(JSON.stringify(receipt, null, 2));
  } else {
    printReceiptSummary(receipt, io);
  }
  return 0;
}

function printReceiptSummary(receipt: EvaluationReceipt, io: CliIO): void {
  io.out(`Commitment: ${receipt.run.commitment_version_id}`);
  io.out(`Subject:    ${receipt.run.subject_id}`);
  io.out(`Profile:    ${receipt.run.interpretation_profile_id}`);
  io.out(`As-of:      ${receipt.run.as_of}`);
  io.out(`Cutoff:     ${receipt.run.cutoff}`);
  io.out("");
  io.out(`Result:     ${receipt.result}  (${receipt.result_status})`);
  io.out(`Matched:    ${receipt.matched_rule_id ?? "—"}`);
  io.out("");
  io.out("Rule evaluations:");
  for (const evaluation of receipt.rule_evaluations) {
    io.out(
      `  ${evaluation.rule_id.padEnd(20)} priority ${String(evaluation.priority).padStart(3)}` +
        `  ${evaluation.result.padStart(3)}  ${evaluation.truth_value}`,
    );
  }
  const diagnostics = receipt.diagnostics ?? [];
  if (diagnostics.length > 0) {
    io.out("");
    io.out("Diagnostics:");
    for (const diagnostic of diagnostics) {
      io.out(`  [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
  const qualifying = receipt.qualifying_action_ids ?? [];
  if (qualifying.length > 0) {
    io.out("");
    io.out(`Qualifying actions: ${qualifying.join(", ")}`);
  }
  io.out("");
  io.out(`Proof:      root ${receipt.proof.root_id}, ${receipt.proof.nodes.length} nodes`);
  io.out(`Hash:       ${receipt.canonical_hash}`);
}

// --- receipt verify ---------------------------------------------------------

function runReceipt(args: readonly string[], io: CliIO): number {
  const [subcommand, path] = args;
  if (subcommand !== "verify") {
    io.err(`error: unknown receipt subcommand: ${subcommand ?? "(none)"}`);
    io.err(USAGE);
    return 2;
  }
  if (path === undefined) {
    io.err("error: receipt verify requires a <receipt.json> path");
    return 2;
  }
  const receipt = readJson(path) as EvaluationReceipt;
  const schema = validate("evaluation-receipt", receipt);
  if (!schema.valid) {
    io.err(`error: ${path} is not a schema-valid evaluation receipt`);
    for (const issue of schema.errors.slice(0, 8)) {
      io.err(`  ${issue.instancePath || "/"}: ${issue.message}`);
    }
    return 1;
  }
  const verification = verifyReceipt(receipt);
  if (verification.valid) {
    io.out(`OK: ${path}`);
    io.out(`  canonical_hash ${verification.actual}`);
    return 0;
  }
  io.err(`TAMPERED: ${path}`);
  io.err(`  stored:   ${verification.actual}`);
  io.err(`  computed: ${verification.expected}`);
  return 1;
}

// --- IO helpers -------------------------------------------------------------

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadValidated<T>(path: string, kind: SchemaKind, io: CliIO): T {
  const data = readJson(path);
  const result = validate(kind, data);
  if (!result.valid) {
    const detail = result.errors
      .slice(0, 8)
      .map((issue) => `  ${issue.instancePath || "/"}: ${issue.message}`)
      .join("\n");
    io.err(`warning: ${path} did not fully validate as ${kind}:\n${detail}`);
  }
  return data as T;
}
