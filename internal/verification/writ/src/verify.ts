import { loadRepository } from "./repository.js";
import { runVerification, type VerificationSelection } from "./core/engine.js";
import { renderVerificationText } from "./core/output.js";
import { verificationWorkspace, type VerificationWorkspace } from "./core/workspace.js";
import { verifyIntegrity, type IntegrityOptions } from "./gates/integrity.js";
import { verifyInteroperability } from "./gates/interoperability.js";
import { verifyOntology } from "./gates/ontology.js";
import { verifyProvenance } from "./gates/provenance.js";
import {
  type RepositorySnapshot,
  type VerificationGate,
  type VerificationGateResult,
  type WritVerificationResult,
} from "./types.js";

export type { VerificationSelection } from "./core/engine.js";

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
  return runVerification(snapshot, selection, {
    order: ["ontology", "interoperability", "provenance", "integrity"],
    runners: {
      ontology: runners.ontology,
      interoperability: runners.interoperability,
      provenance: runners.provenance,
      integrity: runners.integrity,
    },
    loadIssues: (target) => target.loadIssues,
  });
}

export function verifyWorkspace(
  workspace: VerificationWorkspace,
  selection: VerificationSelection = "all",
  integrityOptions: IntegrityOptions = {},
): WritVerificationResult {
  return verifySnapshot(loadRepository(workspace.root).snapshot, selection, integrityOptions);
}

export function verifyRepository(
  selection: VerificationSelection = "all",
  root?: string,
  integrityOptions: IntegrityOptions = {},
): WritVerificationResult {
  return verifyWorkspace(verificationWorkspace(root), selection, integrityOptions);
}

export function renderVerification(result: WritVerificationResult): string {
  return renderVerificationText(result);
}
