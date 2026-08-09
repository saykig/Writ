import { INVARIANT_BY_CODE } from "../invariants.js";
import type { VerificationGate, VerificationIssue, WritVerificationResult } from "../types.js";

const LABELS: Record<VerificationGate, string> = {
  ontology: "Ontology",
  interoperability: "Interoperability",
  provenance: "Provenance",
  integrity: "Integrity",
};

function allIssues(result: WritVerificationResult): VerificationIssue[] {
  return result.gates.flatMap((gate) => gate.issues);
}

export function verificationJson(result: WritVerificationResult) {
  const issues = allIssues(result);
  return {
    status: result.passed ? "PASS" : "FAIL",
    gates: result.gates.map((gate) => ({
      gate: gate.gate,
      status: gate.passed ? "PASS" : "FAIL",
      errors: gate.issues.filter((item) => item.severity === "error").length,
      warnings: gate.issues.filter((item) => item.severity === "warning").length,
    })),
    issues: issues.map((item) => {
      const invariant = INVARIANT_BY_CODE.get(item.code);
      return {
        gate: item.gate,
        code: item.code,
        severity: item.severity,
        message: item.message,
        ...(item.corpus_id ? { corpus_id: item.corpus_id } : {}),
        ...(item.object_id ? { object_id: item.object_id } : {}),
        ...(item.file ? { file: item.file } : {}),
        ...(invariant ? { authority: invariant.authority } : {}),
      };
    }),
    summary: {
      errors: issues.filter((item) => item.severity === "error").length,
      warnings: issues.filter((item) => item.severity === "warning").length,
      checked_gates: result.gates.length,
      passed_gates: result.gates.filter((gate) => gate.passed).length,
    },
  };
}

export function renderVerificationJson(result: WritVerificationResult): string {
  return JSON.stringify(verificationJson(result), null, 2);
}

export function renderVerificationText(result: WritVerificationResult): string {
  const lines = ["WRIT VERIFICATION", ""];
  for (const gate of result.gates) {
    lines.push(`${LABELS[gate.gate].padEnd(22)}${gate.passed ? "PASS" : "FAIL"}`);
  }
  const issues = allIssues(result);
  if (issues.length > 0) {
    lines.push("");
    for (const item of issues) {
      const location = [item.corpus_id, item.object_id, item.file].filter(Boolean).join(" | ");
      lines.push(
        `${item.severity.toUpperCase()} ${item.code}${location ? ` [${location}]` : ""}: ${item.message}`,
      );
    }
  }
  lines.push(
    "",
    `Errors: ${issues.filter((item) => item.severity === "error").length}`,
    `Warnings: ${issues.filter((item) => item.severity === "warning").length}`,
    "",
    `VERIFICATION RESULT: ${result.passed ? "PASS" : "FAIL"}`,
    "Human review determines acceptance.",
  );
  return lines.join("\n");
}
