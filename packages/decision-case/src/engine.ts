import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Bytes } from "@writ/provenance";

import { analysisBindingHash, analysisById, mathematicalBytes } from "./case.js";
import { DecisionCaseError } from "./errors.js";
import { encodedBytes, exactJsonBytes, verifyEncodedBytes } from "./identity.js";
import { assertDecisionExecutionSchema, parseGovernedJson } from "./schema-validation.js";
import { createVerifiedEngineSourceSnapshot } from "./verified-engine-source.js";
import type {
  CheckedProjection,
  ConsumedDecision,
  DecisionExecution,
  IntendedUse,
  LoadedDecisionCase,
  MathematicalOperation,
} from "./types.js";

const PYTHON_ADAPTER = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "python",
  "decision_lab_adapter.py",
);

export interface EngineOptions {
  readonly engineRoot: string;
  readonly pythonExecutable?: string;
}

function protocolCall(
  command: "solve" | "check",
  payload: Record<string, unknown>,
  options: EngineOptions,
): Uint8Array {
  const engineRoot = resolve(options.engineRoot);
  const snapshot = createVerifiedEngineSourceSnapshot(engineRoot);
  const python = options.pythonExecutable ?? "python3";
  try {
    const processResult = Bun.spawnSync(
      [python, "-I", "-B", PYTHON_ADAPTER, command, snapshot.sourceRoot],
      {
        cwd: snapshot.root,
        env: process.env,
        stdin: exactJsonBytes(payload),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    if (processResult.exitCode !== 0) {
      const message = new TextDecoder().decode(processResult.stderr).trim();
      throw new DecisionCaseError(
        processResult.exitCode === 69
          ? "DECISION_CASE_ENGINE_UNAVAILABLE"
          : command === "check" && processResult.exitCode === 65
            ? "DECISION_CASE_MATHEMATICAL_CHECK_FAILED"
            : "DECISION_CASE_ENGINE_PROTOCOL_ERROR",
        message || `Pinned engine ${command} process failed with exit ${processResult.exitCode}.`,
      );
    }
    const stdout = new Uint8Array(processResult.stdout);
    if (stdout.length === 0) {
      throw new DecisionCaseError(
        "DECISION_CASE_ENGINE_PROTOCOL_ERROR",
        `Pinned engine ${command} returned no bytes.`,
      );
    }
    return stdout;
  } finally {
    snapshot.dispose();
  }
}

function parseChecked(bytes: Uint8Array): CheckedProjection {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<
      string,
      unknown
    >;
  } catch {
    throw new DecisionCaseError(
      "DECISION_CASE_ENGINE_PROTOCOL_ERROR",
      "Pinned checker returned malformed output.",
    );
  }
  if (
    !["compatibility", "decision"].includes(String(value.operation)) ||
    typeof value.status !== "string" ||
    !["exact_family", "outer_enclosure"].includes(String(value.family_kind)) ||
    typeof value.model_sha256 !== "string" ||
    typeof value.query_sha256 !== "string" ||
    value.conclusion === null ||
    typeof value.conclusion !== "object" ||
    Array.isArray(value.conclusion)
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_ENGINE_PROTOCOL_ERROR",
      "Pinned checker returned an invalid checked projection.",
    );
  }
  return value as unknown as CheckedProjection;
}

function exactSubjectHash(hash: string): string {
  return hash.startsWith("sha256:") ? hash.slice("sha256:".length) : "";
}

function checkCandidate(
  candidate: Uint8Array,
  problem: Uint8Array,
  query: Uint8Array,
  options: EngineOptions,
): CheckedProjection {
  const checked = parseChecked(
    protocolCall(
      "check",
      {
        candidate_result: Buffer.from(candidate).toString("base64"),
        problem: Buffer.from(problem).toString("base64"),
        query: Buffer.from(query).toString("base64"),
      },
      options,
    ),
  );
  if (
    checked.model_sha256 !== exactSubjectHash(sha256Bytes(problem)) ||
    checked.query_sha256 !== exactSubjectHash(sha256Bytes(query))
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_MATHEMATICAL_CHECK_FAILED",
      "Pinned checker response is not bound to the intended problem and query bytes.",
    );
  }
  return checked;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function runDecisionCase(
  caseFile: LoadedDecisionCase,
  analysisId: string,
  options: EngineOptions,
): DecisionExecution {
  const analysis = analysisById(caseFile, analysisId);
  const { problem, query } = mathematicalBytes(analysis);
  const candidate = protocolCall(
    "solve",
    {
      problem: Buffer.from(problem).toString("base64"),
      query: Buffer.from(query).toString("base64"),
    },
    options,
  );
  const checked = checkCandidate(candidate, problem, query, options);
  return deepFreeze({
    schema_version: "0.1.0",
    case_id: caseFile.value.case_id,
    case_sha256: caseFile.case_sha256,
    analysis_id: analysisId,
    analysis_sha256: analysisBindingHash(caseFile, analysis),
    engine: caseFile.value.engine,
    problem_sha256: sha256Bytes(problem),
    query_sha256: sha256Bytes(query),
    candidate_result: encodedBytes(candidate),
    mathematical_check: { status: "freshly_checked", result: checked },
    applicability: analysis.applicability,
    human_review: analysis.human_review,
  });
}

export function parseExecution(raw: Uint8Array): DecisionExecution {
  const value = parseGovernedJson(new Uint8Array(raw), "decision execution");
  assertDecisionExecutionSchema(value);
  verifyEncodedBytes(value.candidate_result, "candidate_result");
  return deepFreeze(value);
}

export function executionBytes(execution: DecisionExecution): Uint8Array {
  return exactJsonBytes(execution);
}

/**
 * Freshly check a preserved candidate against its exact original subject without authorizing use.
 *
 * Shared-analysis replay performs applicability gating in its own scope-bound record. This function
 * therefore returns only the mathematical projection: it does not reinterpret intended use,
 * current applicability, or human disposition.
 */
export function recheckDecisionExecution(
  caseFile: LoadedDecisionCase,
  execution: DecisionExecution,
  analysisId: string,
  options: EngineOptions,
): CheckedProjection {
  const analysis = analysisById(caseFile, analysisId);
  if (
    execution.case_id !== caseFile.value.case_id ||
    execution.case_sha256 !== caseFile.case_sha256 ||
    execution.analysis_id !== analysisId ||
    execution.analysis_sha256 !== analysisBindingHash(caseFile, analysis) ||
    sha256Bytes(exactJsonBytes(execution.engine)) !==
      sha256Bytes(exactJsonBytes(caseFile.value.engine))
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_STALE_SUBJECT_BINDING",
      "Execution is not bound to the selected exact case and analysis revision.",
    );
  }
  const { problem, query } = mathematicalBytes(analysis);
  if (
    execution.problem_sha256 !== sha256Bytes(problem) ||
    execution.query_sha256 !== sha256Bytes(query)
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_STALE_SUBJECT_BINDING",
      "Execution problem/query hashes do not match the selected revision.",
    );
  }
  const candidate = verifyEncodedBytes(execution.candidate_result, "candidate_result");
  return deepFreeze(checkCandidate(candidate, problem, query, options));
}

export function consumeDecision(
  caseFile: LoadedDecisionCase,
  execution: DecisionExecution,
  analysisId: string,
  use: IntendedUse,
  options: EngineOptions,
): ConsumedDecision {
  const analysis = analysisById(caseFile, analysisId);
  if (
    execution.case_id !== caseFile.value.case_id ||
    execution.analysis_id !== analysisId ||
    sha256Bytes(exactJsonBytes(execution.engine)) !==
      sha256Bytes(exactJsonBytes(caseFile.value.engine))
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_STALE_SUBJECT_BINDING",
      "Execution is not bound to the selected case and analysis revision.",
    );
  }
  if (use !== analysis.intended_use) {
    throw new DecisionCaseError(
      "DECISION_CASE_UNSUPPORTED_USE",
      `Analysis ${analysisId} cannot be reinterpreted as ${use}.`,
    );
  }
  if (execution.analysis_sha256 !== analysisBindingHash(caseFile, analysis)) {
    const priorHumanReviewBinding = analysisBindingHash(caseFile, {
      ...analysis,
      human_review: execution.human_review,
    });
    if (execution.analysis_sha256 !== priorHumanReviewBinding) {
      const { problem, query } = mathematicalBytes(analysis);
      if (
        execution.problem_sha256 === sha256Bytes(problem) &&
        execution.query_sha256 === sha256Bytes(query)
      ) {
        throw new DecisionCaseError(
          "DECISION_CASE_APPLICABILITY_REASSESSMENT_REQUIRED",
          `Analysis ${analysisId} has changed support or modelling dependencies.`,
        );
      }
      throw new DecisionCaseError(
        "DECISION_CASE_STALE_SUBJECT_BINDING",
        "Execution is not bound to the selected analysis subject.",
      );
    }
  }
  if (analysis.applicability.status !== "supported") {
    throw new DecisionCaseError(
      "DECISION_CASE_APPLICABILITY_REASSESSMENT_REQUIRED",
      `Analysis ${analysisId} needs support reassessment before functional use.`,
      { changed_dependencies: analysis.applicability.changed_dependencies },
    );
  }
  const { problem, query } = mathematicalBytes(analysis);
  if (
    execution.problem_sha256 !== sha256Bytes(problem) ||
    execution.query_sha256 !== sha256Bytes(query)
  ) {
    throw new DecisionCaseError(
      "DECISION_CASE_STALE_SUBJECT_BINDING",
      "Execution problem/query hashes do not match the selected revision.",
    );
  }
  const candidate = verifyEncodedBytes(execution.candidate_result, "candidate_result");
  const checked = checkCandidate(candidate, problem, query, options);
  const unresolved = checked.status === "unresolved";
  return deepFreeze({
    functional: !unresolved,
    mathematical_status: checked.status,
    family_kind: checked.family_kind,
    conclusion: unresolved ? null : checked.conclusion,
    applicability: analysis.applicability,
    human_review: analysis.human_review,
    use,
  });
}

export function mathematicalOperation(execution: DecisionExecution): MathematicalOperation {
  return execution.mathematical_check.result.operation;
}
