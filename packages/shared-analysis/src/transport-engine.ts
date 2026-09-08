import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { exactJsonBytes } from "@writ/decision-case";

import { SharedAnalysisError } from "./errors.js";
import type {
  TransportCheckProjection,
  TransportEngineOptions,
} from "./transport-types.js";
import { createVerifiedTransportSourceSnapshot } from "./verified-transport-source.js";

const PYTHON_ADAPTER = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "python",
  "certificate_transport_adapter.py",
);

function protocolCall(
  command: "solve" | "check",
  payload: Record<string, unknown>,
  options: TransportEngineOptions,
): Uint8Array {
  const engineRoot = resolve(options.engineRoot);
  const snapshot = createVerifiedTransportSourceSnapshot(engineRoot);
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
      throw new SharedAnalysisError(
        processResult.exitCode === 69
          ? "SHARED_ANALYSIS_TRANSPORT_ENGINE_UNAVAILABLE"
          : "SHARED_ANALYSIS_TRANSPORT_PROTOCOL_ERROR",
        message || `Pinned certificate-transport ${command} process failed.`,
      );
    }
    const stdout = new Uint8Array(processResult.stdout);
    if (stdout.length === 0) {
      throw new SharedAnalysisError(
        "SHARED_ANALYSIS_TRANSPORT_PROTOCOL_ERROR",
        `Pinned certificate-transport ${command} process returned no bytes.`,
      );
    }
    return stdout;
  } finally {
    snapshot.dispose();
  }
}

function parseCheckProjection(bytes: Uint8Array): TransportCheckProjection {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_PROTOCOL_ERROR",
      "Pinned certificate-transport checker returned malformed JSON.",
    );
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_PROTOCOL_ERROR",
      "Pinned certificate-transport checker returned an invalid report.",
    );
  }
  const report = value as Record<string, unknown>;
  const status = String(report.status);
  const targetStatus = String(report.target_certificate_status);
  const transportStatus = String(report.transport_status);
  if (
    report.schema !== "certificate-transport-check.v1" ||
    !["checked", "rejected", "checker_error"].includes(status) ||
    !["checked", "rejected", "not_checked"].includes(targetStatus) ||
    !["checked", "rejected", "not_checked"].includes(transportStatus) ||
    typeof report.request_sha256 !== "string" ||
    typeof report.evidence_sha256 !== "string" ||
    !Array.isArray(report.diagnostics) ||
    !Array.isArray(report.limits) ||
    (report.bounds !== null &&
      (typeof report.bounds !== "object" || Array.isArray(report.bounds))) ||
    (report.warrant !== null && typeof report.warrant !== "string")
  ) {
    throw new SharedAnalysisError(
      "SHARED_ANALYSIS_TRANSPORT_PROTOCOL_ERROR",
      "Pinned certificate-transport checker returned an invalid report shape.",
    );
  }
  return report as unknown as TransportCheckProjection;
}

export function produceCertificateTransport(
  request: Uint8Array,
  options: TransportEngineOptions,
): Uint8Array {
  return protocolCall(
    "solve",
    { request: Buffer.from(request).toString("base64") },
    options,
  );
}

export function checkCertificateTransportBytes(
  request: Uint8Array,
  evidence: Uint8Array,
  options: TransportEngineOptions,
): Uint8Array {
  return protocolCall(
    "check",
    {
      request: Buffer.from(request).toString("base64"),
      evidence: Buffer.from(evidence).toString("base64"),
    },
    options,
  );
}

export function checkCertificateTransport(
  request: Uint8Array,
  evidence: Uint8Array,
  options: TransportEngineOptions,
): TransportCheckProjection {
  return parseCheckProjection(checkCertificateTransportBytes(request, evidence, options));
}

export function parseTransportCheck(bytes: Uint8Array): TransportCheckProjection {
  return parseCheckProjection(bytes);
}
