// The two interpretation profiles that turn the frozen methodology into a
// reproducible score.
//
// Both profiles agree on every clean cell. They differ on ONE reviewed decision:
// how to read general, non-SME-targeted AI legislation / strategy documents.
//
//   published  — reads them as WEAK (the report's own "recommendation phase /
//                indirect / general AI programs not tailored to SMEs" language).
//                This reproduces Japan 0 and United States 0.
//   generous   — reads those same measures as STRONG. Under it Japan's strong
//                count reaches 5 and flips to +1 (and the US likewise), proving
//                the published scores are interpretation-sensitive, not raw fact.
//
// The decision is realized honestly: it names the exact instruments it re-reads
// (the two ambiguous Japanese measures and the three US strategy documents) and
// cites the rubric-definition passages behind the call.

import { sha256Canonical } from "@covenant/provenance";
import type { InterpretationProfile } from "@covenant/domain";
import type { Classification } from "./members.js";
import { MEMBERS } from "./members.js";
import { GENERAL_MEASURE_DECISION_ID, instrumentId } from "./evidence.js";
import { resolvedBundleHash } from "./methodology.js";

export type ProfileKind = "published" | "generous";

/** Instrument ids of every interpretation-sensitive (general non-SME AI) measure. */
export function sensitiveInstrumentIds(): string[] {
  return MEMBERS.flatMap((member) =>
    member.actions
      .filter((action) => action.interpretation_sensitive === true)
      .map((action) => instrumentId(member, action)),
  );
}

/** Passage ids anchoring the interpretation-sensitive measures. */
function sensitivePassageIds(): string[] {
  return MEMBERS.flatMap((member) =>
    member.actions
      .filter((action) => action.interpretation_sensitive === true)
      .map((action) => `passage-${member.id}-${action.slug}`),
  );
}

interface ProfileSpec {
  readonly kind: ProfileKind;
  readonly id: string;
  readonly name: string;
  readonly classification: Classification;
  readonly choiceLabel: string;
  readonly rationale: string;
}

const SPECS: Record<ProfileKind, ProfileSpec> = {
  published: {
    kind: "published",
    id: "profile-ai-sme-published",
    name: "published",
    classification: "weak",
    choiceLabel: "weak",
    rationale:
      "General AI legislation and national strategy documents that are not tailored to SMEs are scored WEAK, per the rubric's exclusion of 'general AI programs not tailored to SMEs' and the report's own 'recommendation phase / indirect' language. This reproduces the published Japan and United States cells.",
  },
  generous: {
    kind: "generous",
    id: "profile-ai-sme-generous",
    name: "generous",
    classification: "strong",
    choiceLabel: "strong",
    rationale:
      "The same general AI legislation and national strategy documents are read as STRONG, on the view that economy-wide AI frameworks materially advance SME AI adoption (legislation facilitating integration). Under this reading Japan reaches five strong actions and flips to +1, demonstrating the interpretation-sensitivity of the published scores.",
  },
};

/** Build one interpretation profile (with its content-addressed `canonical_hash`). */
export function buildProfile(kind: ProfileKind): InterpretationProfile {
  const spec = SPECS[kind];
  const instruments = sensitiveInstrumentIds();
  const sourcePassages = [
    "passage-scoring-guidelines",
    "passage-definition-strong",
    "passage-definition-weak",
    ...sensitivePassageIds(),
  ];

  const withoutHash: Omit<InterpretationProfile, "canonical_hash"> = {
    schema_version: "1.0.0",
    id: spec.id,
    name: spec.name,
    version: "1.0.0",
    methodology_bundle_hash: resolvedBundleHash(),
    parameters: {
      counteraction_precedence: true,
      general_non_sme_ai_measures: spec.classification,
    },
    decisions: [
      {
        id: GENERAL_MEASURE_DECISION_ID,
        question:
          "How should general, non-SME-targeted AI legislation and national AI strategy documents be classified under the rubric?",
        choice: { classification: spec.classification, instruments },
        alternatives_considered: [
          { classification: "weak", instruments },
          { classification: "strong", instruments },
        ],
        rationale: spec.rationale,
        source_passage_ids: sourcePassages,
        status: "accepted",
        approved_by: ["mehek-berry", "isabella-chan-combrink"],
        approved_at: "2026-06-12T00:00:00Z",
      },
    ],
    waivers: [],
    status: "approved",
    created_at: "2026-06-01T00:00:00Z",
    created_by: "g7-research-group",
  };

  const canonical_hash = sha256Canonical(withoutHash, {
    dropFields: ["/canonical_hash", "/signature"],
  });
  return { ...withoutHash, canonical_hash };
}
