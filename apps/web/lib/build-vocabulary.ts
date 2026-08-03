/**
 * The terms the Builder offers, read off the reviewed corpus.
 *
 * Nothing here is a new vocabulary. Every option a user can pick for a coded
 * field is a value some reviewed record already carries, so a draft built here
 * uses the same terms as the corpus it is modelled on. A term the corpus does
 * not use is not offered, because offering it would teach a distinction the data
 * does not draw.
 *
 * `unknown` is appended to every list. It is a recorded judgment in this system,
 * and a reviewer must always be able to say they could not tell.
 */

import { demoAnalysisClaimRecords } from "./demo-analysis.js";
import type { ClaimFields } from "./demo-analysis-format.js";

export interface BuildVocabulary {
  recordType: readonly string[];
  actorType: readonly string[];
  conductType: readonly string[];
  legalForce: readonly string[];
  adoption: readonly string[];
  applicability: readonly string[];
  enforcement: readonly string[];
  jurisdiction: readonly string[];
  /**
   * Record types the reviewed corpus carries without any conduct classification —
   * an exception, a scope rule, a lifecycle rule. The form uses this to say so
   * rather than leaving an empty conduct field reading as an omission.
   */
  recordTypesWithoutConduct: readonly string[];
}

function distinct(field: keyof ClaimFields): string[] {
  const values = new Set<string>();
  for (const claim of demoAnalysisClaimRecords()) {
    const raw = claim.fields[field];
    if (typeof raw === "string" && raw) values.add(raw);
  }
  if (!values.has("unknown")) values.add("unknown");
  return [...values].sort();
}

let cache: BuildVocabulary | undefined;

export function buildVocabulary(): BuildVocabulary {
  if (cache === undefined) {
    cache = {
      recordType: distinct("record_type"),
      actorType: distinct("actor_type"),
      conductType: distinct("conduct_type"),
      legalForce: distinct("legal_force"),
      adoption: distinct("adoption_status"),
      applicability: distinct("applicability_status"),
      enforcement: distinct("enforcement_status"),
      jurisdiction: ["European Union", "United States"],
      recordTypesWithoutConduct: [
        ...new Set(
          demoAnalysisClaimRecords()
            .filter((claim) => !claim.fields.conduct_type)
            .map((claim) => claim.fields.record_type)
            .filter((type): type is string => Boolean(type)),
        ),
      ].sort(),
    };
  }
  return cache;
}
