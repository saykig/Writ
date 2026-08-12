import { InstitutionResolutionError } from "@writ/domain";

import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";
import {
  ADR_0019_ENDPOINTS,
  activeLinks,
  isAdr0019Relation,
  resolveInstitution,
} from "../rules/adr-0019.js";

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
  }

  return gateResult("ontology", issues);
}
