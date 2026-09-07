#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  analysisById,
  consumeDecision,
  DecisionCaseError,
  executionBytes,
  openDecisionCase,
  parseExecution,
  runDecisionCase,
} from "../src/index.js";

function option(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === undefined || value.startsWith("--")) throw new Error(`Missing ${name}.`);
  return value;
}

function writeNew(path: string, bytes: Uint8Array): void {
  if (existsSync(path)) {
    throw new DecisionCaseError(
      "DECISION_CASE_OUTPUT_EXISTS",
      `Refusing to overwrite existing output ${path}.`,
    );
  }
  writeFileSync(path, bytes, { flag: "wx" });
}

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  writ-decision-case summary --case <bundle>",
      "  writ-decision-case run --case <bundle> --analysis <id> --engine-root <path> --out <file> [--python <path>]",
      "  writ-decision-case consume --case <bundle> --execution <file> --analysis <id> --use <use> --engine-root <path> [--python <path>]",
    ].join("\n"),
  );
}

function main(args: readonly string[]): number {
  const command = args[0] ?? usage();
  const caseFile = openDecisionCase(readFileSync(option(args, "--case")));
  if (command === "summary") {
    console.log(
      JSON.stringify(
        {
          case_id: caseFile.value.case_id,
          title: caseFile.value.title,
          engine_commit: caseFile.value.engine.commit,
          analyses: caseFile.value.analyses.map((analysis) => ({
            analysis_id: analysis.analysis_id,
            question: analysis.question,
            intended_use: analysis.intended_use,
            applicability: analysis.applicability.status,
            human_review: analysis.human_review.disposition,
          })),
        },
        null,
        2,
      ),
    );
    return 0;
  }
  const analysisId = option(args, "--analysis");
  analysisById(caseFile, analysisId);
  const engineRoot = option(args, "--engine-root");
  const pythonIndex = args.indexOf("--python");
  const pythonExecutable = pythonIndex >= 0 ? option(args, "--python") : undefined;
  const engineOptions =
    pythonExecutable === undefined ? { engineRoot } : { engineRoot, pythonExecutable };
  if (command === "run") {
    const execution = runDecisionCase(caseFile, analysisId, engineOptions);
    writeNew(option(args, "--out"), executionBytes(execution));
    console.log(
      JSON.stringify({
        analysis_id: analysisId,
        mathematical_status: execution.mathematical_check.result.status,
        applicability: execution.applicability.status,
        human_review: execution.human_review.disposition,
      }),
    );
    return 0;
  }
  if (command === "consume") {
    const execution = parseExecution(readFileSync(option(args, "--execution")));
    const result = consumeDecision(
      caseFile,
      execution,
      analysisId,
      option(args, "--use") as "static_expected_loss_decision" | "compatibility_check",
      engineOptions,
    );
    console.log(JSON.stringify(result, null, 2));
    return result.functional ? 0 : 3;
  }
  return usage();
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof DecisionCaseError) {
    console.error(
      JSON.stringify({ code: error.code, message: error.message, detail: error.detail }),
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 2;
}
