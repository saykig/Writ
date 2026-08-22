import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

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
  }

  return gateResult("ontology", issues);
}
