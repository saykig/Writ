import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Bytes } from "@writ/provenance";

import { analysisBindingHash, analysisById, mathematicalBytes } from "./case.js";
import { DecisionCaseError } from "./errors.js";
import { encodedBytes, exactJsonBytes, verifyEncodedBytes } from "./identity.js";
import type {
  CheckedProjection,
  ConsumedDecision,
  DecisionExecution,
  IntendedUse,
  LoadedDecisionCase,
  MathematicalOperation,
} from "./types.js";

const ENGINE_FILES: Readonly<Record<string, string>> = {
  "src/writ_decision_lab/build2/__init__.py":
    "sha256:8cfc1091f474dcccde373b2837129c3807a9afa5ab5518882bd12b6de8361df7",
  "src/writ_decision_lab/build2/backend.py":
    "sha256:43f2ddf2753244cddca20e82308d05874620ba08e03370b37b5096673dbd5edf",
  "src/writ_decision_lab/build2/checker.py":
    "sha256:d2377dabe4feb8b4b3e3ceb7a7626b0b90afe642d1ce58db9b11215c8ef58ef4",
  "src/writ_decision_lab/build2/consumer.py":
    "sha256:928fed6adc106ac0027cb4de9e2513f34138b16b85b4553d724b3e7a894e837b",
  "src/writ_decision_lab/build2/engine.py":
    "sha256:87930f266b3a73ca906dd93056f4e91a98fc2493cb11c604b42d9e828c83a7da",
  "src/writ_decision_lab/build2/errors.py":
    "sha256:b34d0f621a0a0925ceb78890edc59079b980903f8dbc58e827dd68ca0d0c7847",
  "src/writ_decision_lab/build2/exact.py":
    "sha256:a6a1b3bc27327a2a90de71bde59428a991f041f7235633e007235b89a388e5d4",
  "src/writ_decision_lab/build2/model.py":
    "sha256:7656d7fb93186617481390e9445752bf00451a5a0bed00a5e89566ebfb6e3924",
};

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

function verifyEngineRoot(root: string): void {
  for (const [relative, expected] of Object.entries(ENGINE_FILES)) {
    const path = join(root, relative);
    if (!existsSync(path)) {
      throw new DecisionCaseError(
        "DECISION_CASE_ENGINE_UNAVAILABLE",
        `Pinned Decision Lab file is unavailable: ${relative}.`,
      );
    }
    if (sha256Bytes(readFileSync(path)) !== expected) {
      throw new DecisionCaseError(
        "DECISION_CASE_ENGINE_PIN_MISMATCH",
        `Decision Lab file does not match the pinned interface: ${relative}.`,
      );
    }
  }
}

function protocolCall(
  command: "solve" | "check",
  payload: Record<string, unknown>,
  options: EngineOptions,
): Uint8Array {
  verifyEngineRoot(options.engineRoot);
  const python = options.pythonExecutable ?? "python3";
  const processResult = Bun.spawnSync([python, PYTHON_ADAPTER, command], {
    cwd: options.engineRoot,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONPATH: join(options.engineRoot, "src"),
    },
    stdin: exactJsonBytes(payload),
    stdout: "pipe",
    stderr: "pipe",
  });
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      "Decision execution is not valid UTF-8 JSON.",
    );
  }
  try {
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new DecisionCaseError("DECISION_CASE_INVALID", "Unsupported decision execution.");
    }
    const value = parsed as DecisionExecution;
    const sha256 = /^sha256:[0-9a-f]{64}$/;
    if (
      value.schema_version !== "0.1.0" ||
      typeof value.case_id !== "string" ||
      value.case_id.length === 0 ||
      typeof value.analysis_id !== "string" ||
      value.analysis_id.length === 0 ||
      !sha256.test(value.case_sha256) ||
      !sha256.test(value.analysis_sha256) ||
      !sha256.test(value.problem_sha256) ||
      !sha256.test(value.query_sha256) ||
      value.mathematical_check?.status !== "freshly_checked"
    ) {
      throw new DecisionCaseError("DECISION_CASE_INVALID", "Unsupported decision execution.");
    }
    verifyEncodedBytes(value.candidate_result, "candidate_result");
    return deepFreeze(value);
  } catch (error) {
    if (error instanceof DecisionCaseError) throw error;
    throw new DecisionCaseError(
      "DECISION_CASE_INVALID",
      "Decision execution does not satisfy the portable runtime contract.",
    );
  }
}

export function executionBytes(execution: DecisionExecution): Uint8Array {
  return exactJsonBytes(execution);
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
