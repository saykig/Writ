// Evidence construction for the 2025 AI-for-SMEs benchmark.
//
// Two responsibilities:
//
//   1. `buildMemberSnapshot` turns a reviewed `MemberSeed` into a schema-valid
//      evidence snapshot (`@writ/domain` `evidence`). The analyst's reviewed
//      classification is stored as an accepted, reviewed supporting *claim*
//      (predicate `rubric_classification`) — NOT as a raw field on the action,
//      because the evidence `action` schema is closed (`additionalProperties:
//      false`). This keeps every on-disk snapshot schema-valid.
//
//   2. `enrichSnapshotForProfile` projects a stored snapshot into the queryable
//      form the resolved methodology reads: it copies each action's reviewed
//      classification onto a `classification` field the `count_distinct(actions
//      where classification == strong …)` query ranges over, applying the
//      interpretation profile's decision for the general, non-SME AI measures.
//      The score itself is then computed by `evaluateCommitment` — never here.

import { sha256Canonical } from "@writ/provenance";
import type { Evidence, InterpretationProfile } from "@writ/domain";
import { MEMBERS } from "./members.js";
import type { ActionSeed, Classification, MemberSeed } from "./members.js";

/** sha256 of the frozen source chapter (verified on disk). */
export const SOURCE_SHA256 =
  "sha256:9e88bb3633d97fe906405f23f63031416c3ea4cf75d8cbc916685ea552e2c85a";

/** Canonical URI of the frozen source chapter. */
export const SOURCE_URI =
  "https://www.g7.utoronto.ca/evaluations/2025compliance-final/04-2025-G7-final-compliance-ai.pdf";

/** Knowledge cutoff = end of the compliance window (all actions ≤ this). */
export const CUTOFF = "2026-06-01T00:00:00Z";

/** Snapshot freeze instant = report publication date. */
export const FROZEN_AT = "2026-06-13T00:00:00Z";

const DOC_ID = "doc-g7-2025-kananaskis-final-compliance";
const DOC_VERSION_ID = "dv-g7-2025-kananaskis-ai-sme-ch4";

/** Dimension tag marking a general, non-SME AI measure whose reading is profile-sensitive. */
export const INTERPRETATION_TAG = "interpretation:general-ai-measure";

/** Reviewed-classification claim predicate. */
export const RUBRIC_PREDICATE = "rubric_classification";

/** The profile decision id that fixes how general non-SME AI measures are read. */
export const GENERAL_MEASURE_DECISION_ID = "decision-general-non-sme-ai-measures";

const atMidnight = (date: string): string => `${date}T00:00:00Z`;

const reviewerId = (analyst: string): string => analyst.toLowerCase().replace(/\s+/g, "-");

const passageId = (member: MemberSeed, action: ActionSeed): string =>
  `passage-${member.id}-${action.slug}`;
const claimId = (member: MemberSeed, action: ActionSeed): string =>
  `claim-${member.id}-${action.slug}`;
const actionId = (member: MemberSeed, action: ActionSeed): string =>
  `action-${member.id}-${action.slug}`;

/** Distinct instrument id per action (the methodology dedups by this path). */
export const instrumentId = (member: MemberSeed, action: ActionSeed): string =>
  `${member.code}-${action.slug}`;

/** A single evidence-schema `passage` record. */
type Passage = Evidence["passages"][number];

function buildPassage(member: MemberSeed, action: ActionSeed): Passage {
  return {
    id: passageId(member, action),
    document_version_id: DOC_VERSION_ID,
    anchor_type: "pdf_text",
    page_number: action.page,
    quote: action.quote,
    anchor_hash: sha256Canonical({
      page: action.page,
      quote: action.quote,
      footnote: action.footnote,
    }),
    language: "en",
  };
}

/** The frozen source document version, shared by every snapshot. */
export function sourceDocumentVersion(): Evidence["document_versions"][number] {
  return {
    id: DOC_VERSION_ID,
    document_id: DOC_ID,
    uri: SOURCE_URI,
    media_type: "application/pdf",
    retrieved_at: "2026-07-01T00:00:00Z",
    issued_at: FROZEN_AT,
    sha256: SOURCE_SHA256,
    publisher: "G7 Research Group",
    source_tier: 2,
  };
}

/** Build a schema-valid evidence snapshot for one member (classification in claims). */
export function buildMemberSnapshot(member: MemberSeed): Evidence {
  const passages: Evidence["passages"] = member.actions.map((action) =>
    buildPassage(member, action),
  );

  const claims: Evidence["claims"] = member.actions.map((action) => ({
    id: claimId(member, action),
    claim_type: "fact",
    subject_ref: actionId(member, action),
    predicate: RUBRIC_PREDICATE,
    object: action.classification,
    truth_value: "true",
    status: "accepted",
    valid_time: { start: atMidnight(action.date) },
    recorded_at: atMidnight(action.date),
    created_by: reviewerId(member.analyst),
    origin: "human",
    evidence_links: [
      { passage_id: passageId(member, action), stance: "supports", support_type: "direct" },
    ],
  }));

  const actions: Evidence["actions"] = member.actions.map((action) => {
    const record: Evidence["actions"][number] = {
      id: actionId(member, action),
      label: action.label,
      actors: [member.name],
      jurisdiction: member.name,
      kind: action.kind,
      instrument_type: action.kind,
      announcement_time: atMidnight(action.date),
      valid_time: { start: atMidnight(action.date) },
      implementation_stage: action.stage,
      beneficiaries: ["SME"],
      beneficiary_targeting: action.targeting,
      attribution: action.attribution,
      program_family_id: `${member.code}-ai-sme`,
      underlying_instrument_id: instrumentId(member, action),
      relationships: [],
      status: "accepted",
      claim_ids: [claimId(member, action)],
      ...(action.amount ? { amounts: [action.amount] } : {}),
      ...(action.interpretation_sensitive ? { dimensions: [INTERPRETATION_TAG] } : {}),
    };
    return record;
  });

  const reviews: Evidence["reviews"] = member.actions.flatMap((action) => [
    {
      id: `review-claim-${member.id}-${action.slug}`,
      object_type: "claim",
      object_id: claimId(member, action),
      reviewer_id: reviewerId(member.analyst),
      decision: "accept",
      rationale: `Reviewed classification "${action.classification}" for ${action.label} (report p.${action.page}, fn.${action.footnote}).`,
      created_at: atMidnight(action.date),
    },
    {
      id: `review-action-${member.id}-${action.slug}`,
      object_type: "action",
      object_id: actionId(member, action),
      reviewer_id: reviewerId(member.analyst),
      decision: "accept",
      rationale: `Action verified against the frozen source chapter, report p.${action.page}.`,
      created_at: atMidnight(action.date),
    },
  ]);

  const snapshot: Evidence = {
    schema_version: "1.0.0",
    snapshot: {
      id: `snapshot-${member.id}-ai-sme-2025`,
      frozen_at: FROZEN_AT,
      cutoff: CUTOFF,
      content_hash: sha256Canonical({ passages, claims, actions, reviews }),
      description: `Reviewed AI-for-SMEs evidence for ${member.name}, 2025 G7 Kananaskis final compliance chapter 4.`,
    },
    document_versions: [sourceDocumentVersion()],
    passages,
    claims,
    actions,
    reviews,
  };
  return snapshot;
}

// --- Profile-driven enrichment ----------------------------------------------

/** The choice payload carried by the general-measure decision in a profile. */
interface GeneralMeasureChoice {
  readonly classification: Classification;
  readonly instruments: readonly string[];
}

/** Read the general-measure interpretation from a profile's decision, if present. */
export function generalMeasureChoice(
  profile: InterpretationProfile,
): GeneralMeasureChoice | undefined {
  const decision = profile.decisions.find((d) => d.id === GENERAL_MEASURE_DECISION_ID);
  if (decision === undefined) return undefined;
  const choice = decision.choice as GeneralMeasureChoice | undefined;
  if (
    choice === undefined ||
    typeof choice !== "object" ||
    !Array.isArray((choice as GeneralMeasureChoice).instruments)
  ) {
    return undefined;
  }
  return choice;
}

/** The rubric classification an action carries in its supporting claim. */
export interface ClassificationProjectionDiagnostic {
  readonly code: "WRT-BENCH-CLASSIFICATION-UNKNOWN";
  readonly actionId: string;
  readonly claimIds: readonly string[];
  readonly reason: string;
}

export type RubricClassificationState =
  | { readonly status: "known"; readonly value: Classification }
  | {
      readonly status: "unknown";
      readonly value: null;
      readonly diagnostic: ClassificationProjectionDiagnostic;
    };

export interface ProfileProjection {
  readonly snapshot: Evidence;
  readonly diagnostics: readonly ClassificationProjectionDiagnostic[];
}

function isClassification(value: unknown): value is Classification {
  return value === "strong" || value === "weak" || value === "counter";
}

/** Preserve a missing or unusable rubric claim as an explicit unknown state. */
export function baseClassificationState(
  snapshot: Evidence,
  action: Evidence["actions"][number],
): RubricClassificationState {
  const claim = snapshot.claims.find(
    (c) =>
      c.predicate === RUBRIC_PREDICATE &&
      (action.claim_ids ?? []).includes(c.id) &&
      c.subject_ref === action.id,
  );
  if (
    claim !== undefined &&
    claim.status === "accepted" &&
    claim.truth_value === "true" &&
    isClassification(claim.object)
  ) {
    return { status: "known", value: claim.object };
  }
  const reason =
    claim === undefined
      ? "No rubric-classification claim is linked to the action."
      : "The linked rubric-classification claim is not accepted, true, and usable.";
  return {
    status: "unknown",
    value: null,
    diagnostic: {
      code: "WRT-BENCH-CLASSIFICATION-UNKNOWN",
      actionId: action.id,
      claimIds: [...(action.claim_ids ?? [])],
      reason,
    },
  };
}

/**
 * Project a stored snapshot into the queryable form the resolved methodology
 * reads: every action gains a `classification` field equal to its reviewed
 * classification, except that instruments named by the profile's general-measure
 * decision take that decision's classification. The returned value is not a
 * schema-valid `evidence` document (it carries the extra `classification`
 * field); it is the in-memory collection `evaluateCommitment` ranges over.
 */
export function projectSnapshotForProfile(
  snapshot: Evidence,
  profile: InterpretationProfile,
): ProfileProjection {
  const choice = generalMeasureChoice(profile);
  const overridden = new Set(choice?.instruments ?? []);
  const diagnostics: ClassificationProjectionDiagnostic[] = [];
  const actions = snapshot.actions.map((action) => {
    const base = baseClassificationState(snapshot, action);
    const instrument = String(action.underlying_instrument_id ?? "");
    if (overridden.has(instrument)) {
      return {
        ...action,
        classification: choice!.classification,
        rubric_classification_state: {
          status: "known",
          value: choice!.classification,
          source: "interpretation_profile",
        },
      };
    }
    if (base.status === "known") {
      return {
        ...action,
        classification: base.value,
        rubric_classification_state: base,
      };
    }
    diagnostics.push(base.diagnostic);
    return {
      ...action,
      rubric_classification_state: base,
    };
  });
  return {
    snapshot: { ...snapshot, actions } as Evidence,
    diagnostics,
  };
}

/** Compatibility projection for the frozen benchmark's existing callers. */
export function enrichSnapshotForProfile(
  snapshot: Evidence,
  profile: InterpretationProfile,
): Evidence {
  return projectSnapshotForProfile(snapshot, profile).snapshot;
}

// --- Source manifest ---------------------------------------------------------

/** Methodology passages (rubric + definitions) cited by the inventory + profiles. */
export const METHODOLOGY_PASSAGES: readonly Passage[] = [
  {
    id: "passage-commitment-text",
    document_version_id: DOC_VERSION_ID,
    anchor_type: "pdf_text",
    page_number: 170,
    quote:
      "We commit to … sustain investments in AI [artificial intelligence] adoption programs for SMEs [small and medium-sized enterprises], including supporting access to compute and digital infrastructure.",
    anchor_hash: sha256Canonical({ ref: "commitment-text", page: 170 }),
    language: "en",
  },
  {
    id: "passage-definition-strong",
    document_version_id: DOC_VERSION_ID,
    anchor_type: "pdf_text",
    page_number: 172,
    quote:
      "Strong domestic actions include allocating funding for SME AI adoption, enacting legislation that facilitates integration, establishing privacy or consumer protection frameworks, subsidizing access to compute and digital infrastructure, creating SME-specific training centers, publishing toolkits or case studies, and supporting talent exchanges.",
    anchor_hash: sha256Canonical({ ref: "definition-strong", page: 172 }),
    language: "en",
  },
  {
    id: "passage-definition-weak",
    document_version_id: DOC_VERSION_ID,
    anchor_type: "pdf_text",
    page_number: 172,
    quote:
      "Weaker actions include attending conferences, issuing verbal statements of support, endorsing other countries' SME AI policies, launching short-term pilots or one-off grants, creating general AI programs not tailored to SMEs, hosting awareness events without resources, or providing outdated or impractical tools.",
    anchor_hash: sha256Canonical({ ref: "definition-weak", page: 172 }),
    language: "en",
  },
  {
    id: "passage-scoring-guidelines",
    document_version_id: DOC_VERSION_ID,
    anchor_type: "pdf_text",
    page_number: 173,
    quote:
      "+1: five or more strong actions. 0: three or four weak actions, or up to four strong actions. −1: two or fewer weak actions, or acts that counter investments in AI adoption programs.",
    anchor_hash: sha256Canonical({ ref: "scoring-guidelines", page: 173 }),
    language: "en",
  },
];

/** Schema-compatible projection of source records held by the G7 corpus. */
export function buildSourceManifest(): {
  schema_version: "1.0.0";
  document_version: Evidence["document_versions"][number];
  passages: Passage[];
} {
  const actionPassages = MEMBERS.flatMap((member) =>
    member.actions.map((action) => buildPassage(member, action)),
  );
  return {
    schema_version: "1.0.0",
    document_version: sourceDocumentVersion(),
    passages: [...METHODOLOGY_PASSAGES, ...actionPassages],
  };
}
