import type { AtomicInstitutionalRecord } from "./records.js";

export interface InstitutionalCatalogEntry {
  corpus_id: string;
  family: "legal_policy" | "institutional";
}

export interface InstitutionalResolutionManifest {
  corpus_id: string;
  family: "legal_policy" | "institutional";
  root_institution_id?: string;
}

export interface ApprovedInstitutionResolutionInput {
  native_corpora: readonly InstitutionalCatalogEntry[];
  manifests: readonly InstitutionalResolutionManifest[];
  records: readonly AtomicInstitutionalRecord[];
}

export interface ApprovedInstitutionResolution {
  institution_id: string;
  corpus_id: string;
  identity_record_id: string;
}

export type InstitutionResolutionIssueCode =
  "INSTITUTION_ENDPOINT_NOT_FOUND" | "INSTITUTION_ENDPOINT_AMBIGUOUS";

export class InstitutionResolutionError extends Error {
  constructor(
    readonly code: InstitutionResolutionIssueCode,
    message: string,
  ) {
    super(message);
    this.name = "InstitutionResolutionError";
  }
}

/**
 * Resolve a canonical institutional endpoint through the schema-backed catalog and
 * institutional manifests, then require one approved atomic identity record. A
 * manifest's `root_institution_id` locates a possible corpus but is never sufficient
 * evidence of identity by itself.
 */
export function resolveApprovedInstitutionEndpoint(
  institutionId: string,
  input: ApprovedInstitutionResolutionInput,
): ApprovedInstitutionResolution {
  const institutionalCorpusIds = new Set(
    input.native_corpora
      .filter((entry) => entry.family === "institutional")
      .map((entry) => entry.corpus_id),
  );
  const manifests = new Map(
    input.manifests
      .filter(
        (manifest) =>
          manifest.family === "institutional" && institutionalCorpusIds.has(manifest.corpus_id),
      )
      .map((manifest) => [manifest.corpus_id, manifest]),
  );

  const candidateCorpusIds = new Set<string>();
  for (const manifest of manifests.values()) {
    if (manifest.root_institution_id === institutionId) candidateCorpusIds.add(manifest.corpus_id);
  }
  for (const record of input.records) {
    if (
      institutionalCorpusIds.has(record.corpus_id) &&
      manifests.has(record.corpus_id) &&
      record.institution_id === institutionId
    ) {
      candidateCorpusIds.add(record.corpus_id);
    }
  }

  const matches = input.records.filter(
    (record) =>
      candidateCorpusIds.has(record.corpus_id) &&
      record.institutional_fact_type === "identity" &&
      record.institution_id === institutionId &&
      record.review_state === "approved",
  );

  if (matches.length === 0) {
    throw new InstitutionResolutionError(
      "INSTITUTION_ENDPOINT_NOT_FOUND",
      `institutional endpoint ${institutionId} has no approved identity record`,
    );
  }
  if (matches.length > 1) {
    const ids = matches
      .map((record) => record.record_id)
      .sort()
      .join(", ");
    throw new InstitutionResolutionError(
      "INSTITUTION_ENDPOINT_AMBIGUOUS",
      `institutional endpoint ${institutionId} resolves to multiple approved identity records: ${ids}`,
    );
  }

  const identity = matches[0]!;
  return {
    institution_id: institutionId,
    corpus_id: identity.corpus_id,
    identity_record_id: identity.record_id,
  };
}
