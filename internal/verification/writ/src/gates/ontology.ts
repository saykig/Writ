import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";
import { CURRENT_RECORD_ADAPTERS } from "../adapters/current-record-contracts.js";

/** Reconcile the active catalog with each manifest without imposing retired cross-family rules. */
export function verifyOntology(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];

  for (const manifest of snapshot.manifests) {
    const entry = snapshot.catalogEntries.find(
      (candidate) => candidate.corpus_id === manifest.value.corpus_id,
    );
    if (entry && entry.family !== manifest.value.family) {
      issues.push(
        issue(
          "ontology",
          "ONTOLOGY_FAMILY_MISMATCH",
          `Catalog family ${entry.family} disagrees with manifest family ${manifest.value.family}.`,
          { corpus_id: manifest.value.corpus_id, file: manifest.file },
        ),
      );
    }
    const contract = manifest.value.record_contract;
    const adapter = CURRENT_RECORD_ADAPTERS.resolve(contract.id, contract.version);
    if (adapter) {
      const capabilities = adapter.adapt({
        family: manifest.value.family,
        value: manifest.value,
      }).capabilities;
      if (
        contract.kind !== capabilities.manifestKind ||
        manifest.value.family !== capabilities.expectedFamily
      ) {
        issues.push(
          issue(
            "ontology",
            "ONTOLOGY_CONTRACT_FAMILY_MISMATCH",
            `Manifest declares ${contract.kind} ${manifest.value.family}, but exact contract ${contract.id} version ${contract.version} governs ${capabilities.manifestKind} ${capabilities.expectedFamily} corpora.`,
            { corpus_id: manifest.value.corpus_id, file: manifest.file },
          ),
        );
      }
    }
  }

  for (const loaded of snapshot.records) {
    if (
      loaded.value.family !== loaded.governing_contract.expected_family ||
      loaded.value.family !== loaded.manifest_family
    ) {
      issues.push(
        issue(
          "ontology",
          "ONTOLOGY_RECORD_FAMILY_MISMATCH",
          `Record ${loaded.value.record_id} declares family ${loaded.value.family}, but its manifest declares ${loaded.manifest_family} and exact contract ${loaded.governing_contract.id} version ${loaded.governing_contract.version} governs ${loaded.governing_contract.expected_family}.`,
          {
            corpus_id: loaded.corpus_id,
            object_id: loaded.value.record_id,
            file: loaded.file,
          },
        ),
      );
    }
  }

  return gateResult("ontology", issues);
}
