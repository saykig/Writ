import { loadRepository, repositoryRoot } from "./repository.js";
import { verifyIntegrity, type IntegrityOptions } from "./gates/integrity.js";
import { verifyInteroperability } from "./gates/interoperability.js";
import { verifyOntology } from "./gates/ontology.js";
import { verifyProvenance } from "./gates/provenance.js";
import {
  gateResult,
  type RepositorySnapshot,
  type VerificationGate,
  type VerificationGateResult,
  type WritVerificationResult,
} from "./types.js";

export type VerificationSelection = VerificationGate | "all";

export function verifySnapshot(
  snapshot: RepositorySnapshot,
  selection: VerificationSelection = "all",
  integrityOptions: IntegrityOptions = {},
): WritVerificationResult {
  const runners: Record<VerificationGate, () => VerificationGateResult> = {
    ontology: () => verifyOntology(snapshot),
    interoperability: () => verifyInteroperability(snapshot),
    provenance: () => verifyProvenance(snapshot),
    integrity: () => verifyIntegrity(snapshot, integrityOptions),
  };
  const order: VerificationGate[] =
    selection === "all" ? ["ontology", "interoperability", "provenance", "integrity"] : [selection];
  const gates = order.map((gate) => runners[gate]());
  if (selection !== "all" && selection !== "integrity" && snapshot.loadIssues.length > 0) {
    gates.push(gateResult("integrity", snapshot.loadIssues));
  }
  return { passed: gates.every((gate) => gate.passed), gates };
}

export function verifyRepository(
  selection: VerificationSelection = "all",
  root: string = repositoryRoot(),
  integrityOptions: IntegrityOptions = {},
): WritVerificationResult {
  return verifySnapshot(loadRepository(root).snapshot, selection, integrityOptions);
}

export function renderVerification(result: WritVerificationResult): string {
  const labels: Record<VerificationGate, string> = {
    ontology: "Ontology",
    interoperability: "Interoperability",
    provenance: "Provenance",
    integrity: "Integrity",
  };
  const lines = ["WRIT PRE-MERGE VERIFICATION", ""];
  for (const gate of result.gates) {
    lines.push(`${labels[gate.gate].padEnd(22)}${gate.passed ? "PASS" : "FAIL"}`);
  }
  const issues = result.gates.flatMap((gate) => gate.issues);
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
    `MERGE GATE: ${result.passed ? "PASS" : "FAIL"}`,
  );
  return lines.join("\n");
}
