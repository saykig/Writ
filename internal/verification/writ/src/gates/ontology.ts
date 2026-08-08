import {
  InstitutionResolutionError,
  resolveApprovedInstitutionEndpoint,
  type AtomicInstitutionalRecord,
  type RecordLink,
} from "@writ/domain";

import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

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

function resolutionInput(snapshot: RepositorySnapshot) {
  return {
    native_corpora: snapshot.catalogEntries,
    manifests: snapshot.manifests.map(({ value }) => value),
    records: snapshot.institutionalRecords.map(({ value }) => value),
  };
}

export function resolveInstitution(snapshot: RepositorySnapshot, institutionId: string) {
  return resolveApprovedInstitutionEndpoint(institutionId, resolutionInput(snapshot));
}

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
          {
            corpus_id: manifest.value.corpus_id,
            file: manifest.file,
          },
        ),
      );
    }
  }

  for (const link of activeLinks(snapshot)) {
    const contract = isAdr0019Relation(link.value.relation_type)
      ? ADR_0019_ENDPOINTS[link.value.relation_type]
      : undefined;
    if (contract) {
      if (!(contract.source as readonly string[]).includes(link.value.source_kind)) {
        issues.push(
          issue(
            "ontology",
            "ONTOLOGY_INVALID_SOURCE_KIND",
            `${link.value.relation_type} does not permit source kind ${link.value.source_kind}.`,
            {
              corpus_id: link.value.owning_corpus_id,
              object_id: link.value.link_id,
              file: link.file,
            },
          ),
        );
      }
      if (!(contract.target as readonly string[]).includes(link.value.target_kind)) {
        issues.push(
          issue(
            "ontology",
            "ONTOLOGY_INVALID_TARGET_KIND",
            `${link.value.relation_type} does not permit target kind ${link.value.target_kind}.`,
            {
              corpus_id: link.value.owning_corpus_id,
              object_id: link.value.link_id,
              file: link.file,
            },
          ),
        );
      }

      const institutionId =
        link.value.relation_type === "derives_authority_from" ? undefined : link.value.target_id;
      if (institutionId) {
        try {
          resolveInstitution(snapshot, institutionId);
        } catch (error) {
          if (error instanceof InstitutionResolutionError) {
            issues.push(
              issue(
                "ontology",
                error.code === "INSTITUTION_ENDPOINT_AMBIGUOUS"
                  ? "ONTOLOGY_IDENTITY_AMBIGUOUS"
                  : "ONTOLOGY_IDENTITY_NOT_FOUND",
                error.message,
                {
                  corpus_id: link.value.owning_corpus_id,
                  object_id: link.value.link_id,
                  file: link.file,
                },
              ),
            );
          } else throw error;
        }
      }
    }

    if (link.value.relation_type === "part_of" && link.value.supporting_record_ids) {
      for (const supportingId of link.value.supporting_record_ids) {
        const placement = snapshot.institutionalRecords.find(
          ({ value }) =>
            value.record_id === supportingId && value.institutional_fact_type === "placement",
        )?.value as AtomicInstitutionalRecord | undefined;
        if (placement && placement.institution_id !== link.value.source_id) {
          issues.push(
            issue(
              "ontology",
              "ONTOLOGY_PLACEMENT_SUPPORT_INCOMPATIBLE",
              `Placement ${supportingId} describes ${placement.institution_id}, not traversal source ${link.value.source_id}.`,
              {
                corpus_id: link.value.owning_corpus_id,
                object_id: link.value.link_id,
                file: link.file,
              },
            ),
          );
        }
      }
    }
  }

  return gateResult("ontology", issues);
}
