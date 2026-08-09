import {
  resolveApprovedInstitutionEndpoint,
  type InstitutionalCatalogEntry,
  type InstitutionalResolutionManifest,
  type RecordLink,
} from "@writ/domain";

import type { RepositorySnapshot } from "../types.js";

/** Explicit rule pack for the six relations governed by accepted ADR 0019. */
export const ADR_0019_ENDPOINTS = Object.freeze({
  issued_by: {
    source: ["publication", "source_document", "instrument"],
    target: ["institution", "organizational_unit"],
  },
  assigns_function_to: {
    source: ["legal_policy_claim", "legal_policy_provision"],
    target: ["institution", "organizational_unit"],
  },
  implemented_by: {
    source: ["legal_policy_claim", "legal_policy_provision"],
    target: ["institution", "organizational_unit"],
  },
  enforced_by: {
    source: ["legal_policy_claim", "legal_policy_provision"],
    target: ["institution", "organizational_unit"],
  },
  applies_to: {
    source: ["legal_policy_claim", "legal_policy_provision"],
    target: ["institution", "organizational_unit"],
  },
  derives_authority_from: {
    source: ["institutional_mandate", "institutional_decision_right", "institutional_function"],
    target: ["legal_policy_provision"],
  },
} as const);

export type Adr0019Relation = keyof typeof ADR_0019_ENDPOINTS;

export function isAdr0019Relation(relation: string): relation is Adr0019Relation {
  return Object.hasOwn(ADR_0019_ENDPOINTS, relation);
}

export function activeLinks(
  snapshot: RepositorySnapshot,
): Array<{ value: RecordLink; file: string; corpus_id: string }> {
  return snapshot.links.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  );
}

export function resolveInstitution(snapshot: RepositorySnapshot, institutionId: string) {
  const currentFamily = (value: {
    family: string;
  }): value is { family: "legal_policy" | "institutional" } & typeof value =>
    value.family === "legal_policy" || value.family === "institutional";
  return resolveApprovedInstitutionEndpoint(institutionId, {
    native_corpora: snapshot.catalogEntries.filter(currentFamily) as InstitutionalCatalogEntry[],
    manifests: snapshot.manifests
      .map(({ value }) => value)
      .filter(currentFamily)
      .map((manifest): InstitutionalResolutionManifest => ({
        corpus_id: manifest.corpus_id,
        family: manifest.family as "legal_policy" | "institutional",
        ...(manifest.root_institution_id
          ? { root_institution_id: manifest.root_institution_id }
          : {}),
      })),
    records: snapshot.institutionalRecords.map(({ value }) => value),
  });
}
