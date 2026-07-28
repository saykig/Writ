/**
 * Build Writ evidence snapshots for the EU-US AI evaluation pilot.
 *
 * The reviewed annotation table classifies each provision; `fetch_pilot_sources.py`
 * supplies the document, the retrieval hash, and the verbatim passage. This
 * script joins the two into the snapshot format the evaluator consumes, one
 * snapshot per jurisdiction, so the same methodology can be run against each.
 *
 * A normalized claim whose parent row has no retrieved passage is left out and
 * reported. Writ evaluates quoted law; a classification with nothing to quote is
 * not evidence, and padding the snapshot with it would produce a receipt that
 * looks complete and is not. The count of what was left out is written beside
 * the snapshots so the gap travels with the result.
 *
 * Run: bun scripts/build-pilot-snapshot.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Imported by relative path, as `scripts/replicate.ts` does, so the workspace
// package resolves without the root needing a dependency on it.
import { sha256Canonical } from "../packages/provenance/src/index.js";

const PILOT = "pilot/eu-us-ai-evaluation";
const OUT = join(PILOT, "evidence");

interface NormalizedClaim {
  claim_id: string;
  parent_row_id: string;
  jurisdiction: "EU" | "US";
  instrument: string;
  source_locator: string;
  claim_record_type: string;
  legal_force: string;
  adoption_status: string;
  applicability_status: string;
  enforcement_status: string;
  actor_type?: string;
  conduct_type?: string;
  headline_relevance?: string;
  scope?: string[];
  binding_scope?: string;
  compliance_function?: string;
  target_system?: string;
}

interface ProvDocument {
  id: string;
  document_id: string;
  title: string;
  uri: string;
  media_type: string;
  retrieved_at: string;
  issued_at: string;
  sha256: string;
  publisher: string;
  source_tier: number;
}

interface ProvPassage {
  id: string;
  row_id: string;
  document_version_id: string;
  anchor_type: string;
  page_number?: number;
  dom_path?: string;
  anchor_phrase?: string;
  quote: string;
  anchor_hash: string;
  language: string;
}

const read = <T>(rel: string): T => JSON.parse(readFileSync(rel, "utf8")) as T;

const claims = read<NormalizedClaim[]>(join(PILOT, "normalized/claims.json"));
const documents = read<ProvDocument[]>(join(PILOT, "provenance/document-versions.json"));
const passages = read<ProvPassage[]>(join(PILOT, "provenance/passages.json"));

const passageByRow = new Map(passages.map((passage) => [passage.row_id, passage]));
const documentById = new Map(documents.map((document) => [document.id, document]));

/**
 * The evidence schema's `implementation_stage` vocabulary was written for
 * spending commitments, and the pilot's legal lifecycle does not map onto it
 * cleanly. Only `adoption_status` is close enough to carry across, and the
 * precise lifecycle stays on the claim qualifiers, which is where the
 * methodology reads it. Nothing queries this field.
 */
const STAGE: Record<string, string> = { adopted: "operational", proposed: "proposed" };

/**
 * The evidence schema requires a `reviewer_id` on every review, and the reviewed
 * dataset names no reviewer anywhere. Rather than invent a person, the review is
 * attributed to the review itself, by the dataset's own id. What that records is
 * true and checkable: this claim carries `review_decision: accepted` in that
 * dataset. What it does not do is put a name to work nobody signed.
 */
const REVIEWER = "eu_us_ai_evaluation_pilot_human_reviewed";

interface Built {
  documentVersions: unknown[];
  passages: unknown[];
  claims: unknown[];
  actions: unknown[];
  reviews: unknown[];
  omitted: string[];
}

function build(jurisdiction: "EU" | "US"): Built {
  const mine = claims.filter((claim) => claim.jurisdiction === jurisdiction);
  const omitted: string[] = [];
  const outActions: unknown[] = [];
  const outClaims: unknown[] = [];
  const outReviews: unknown[] = [];
  const usedPassages = new Map<string, ProvPassage>();
  const usedDocuments = new Map<string, ProvDocument>();

  for (const claim of mine) {
    const passage = passageByRow.get(claim.parent_row_id);
    if (!passage) {
      omitted.push(claim.claim_id);
      continue;
    }
    const document = documentById.get(passage.document_version_id);
    if (!document) {
      omitted.push(claim.claim_id);
      continue;
    }
    usedPassages.set(passage.id, passage);
    usedDocuments.set(document.id, document);

    const slug = claim.claim_id.toLowerCase();
    const actionId = `action-${slug}`;

    outActions.push({
      id: actionId,
      label: `${claim.instrument} ${claim.source_locator}`,
      actors: [claim.jurisdiction],
      jurisdiction: claim.jurisdiction,
      // The reviewed table's own record type, carried across unchanged.
      kind: claim.claim_record_type,
      implementation_stage: STAGE[claim.adoption_status] ?? "proposed",
      // The pilot classifies legal duties, not beneficiaries. Saying "absent"
      // is the schema's way of recording that the dimension does not apply.
      beneficiary_targeting: "absent",
      attribution: "unilateral",
      status: "accepted",
      claim_ids: [`claim-${slug}`],
    });

    // One claim per provision, carrying the reviewers' classification. The four
    // dimensions the headline rule tests live in `qualifiers`, where the
    // evaluator's path resolver can reach them.
    const qualifiers: Record<string, unknown> = {
      legal_force: claim.legal_force,
      adoption_status: claim.adoption_status,
      applicability_status: claim.applicability_status,
      enforcement_status: claim.enforcement_status,
      row_id: claim.claim_id,
      instrument: claim.instrument,
      source_locator: claim.source_locator,
    };
    for (const key of [
      "actor_type",
      "conduct_type",
      "binding_scope",
      "compliance_function",
      "target_system",
    ] as const) {
      // Absent stays absent. A missing classification is not a false one.
      if (claim[key] !== undefined) qualifiers[key] = claim[key];
    }
    if (claim.scope !== undefined) qualifiers.scope = claim.scope;

    outClaims.push({
      id: `claim-${slug}`,
      claim_type: "fact",
      subject_ref: actionId,
      predicate: "reviewed_legal_classification",
      object: claim.headline_relevance ?? "unclassified",
      qualifiers,
      truth_value: "true",
      status: "accepted",
      // The instrument's own publication date, and the date its text was
      // retrieved. The reviewed table states no dates, so none are invented.
      valid_time: { start: document.issued_at },
      recorded_at: document.retrieved_at,
      origin: "human",
      evidence_links: [
        { passage_id: passage.id, stance: "supports", support_type: "direct" },
      ],
    });

    // The reviewed table's own accept decision, carried across so the evaluator
    // can see that this claim was reviewed. An unreviewed claim does not score,
    // which is why this record has to exist rather than be assumed.
    outReviews.push({
      id: `review-claim-${slug}`,
      object_type: "claim",
      object_id: `claim-${slug}`,
      reviewer_id: REVIEWER,
      decision: "accept",
      rationale:
        `Row ${claim.claim_id} (${claim.instrument} ${claim.source_locator}) carries ` +
        `review_decision "accepted" in the human-reviewed pilot dataset.`,
      created_at: document.retrieved_at,
    });
  }

  return {
    documentVersions: [...usedDocuments.values()].map((document) => ({
      id: document.id,
      document_id: document.document_id,
      uri: document.uri,
      media_type: document.media_type,
      retrieved_at: document.retrieved_at,
      issued_at: document.issued_at,
      sha256: document.sha256,
      publisher: document.publisher,
      source_tier: document.source_tier,
    })),
    passages: [...usedPassages.values()].map((passage) => ({
      id: passage.id,
      document_version_id: passage.document_version_id,
      anchor_type: passage.anchor_type,
      ...(passage.page_number !== undefined ? { page_number: passage.page_number } : {}),
      ...(passage.dom_path !== undefined ? { dom_path: passage.dom_path } : {}),
      quote: passage.quote,
      anchor_hash: passage.anchor_hash,
      language: passage.language,
    })),
    claims: outClaims,
    actions: outActions,
    reviews: outReviews,
    omitted,
  };
}

// Every document was retrieved on the same run, so the latest retrieval date is
// both the freeze point and the cutoff. No clock is read here.
const frozenAt = documents
  .map((document) => document.retrieved_at)
  .sort()
  .at(-1)!;

mkdirSync(OUT, { recursive: true });
const report: Record<string, unknown> = {};

for (const jurisdiction of ["EU", "US"] as const) {
  const built = build(jurisdiction);
  const body = {
    passages: built.passages,
    claims: built.claims,
    actions: built.actions,
    reviews: built.reviews,
  };
  const snapshot = {
    schema_version: "1.0.0",
    snapshot: {
      id: `snapshot-eu-us-ai-evaluation-${jurisdiction.toLowerCase()}`,
      frozen_at: frozenAt,
      cutoff: frozenAt,
      content_hash: sha256Canonical(body),
      description:
        `Human-reviewed ${jurisdiction} provisions on model evaluation, each traced ` +
        `to the retrieved text of its source document.`,
    },
    document_versions: built.documentVersions,
    ...body,
  };
  const file = join(OUT, `${jurisdiction.toLowerCase()}.snapshot.json`);
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  report[jurisdiction] = {
    actions: built.actions.length,
    omitted: built.omitted,
    documents: built.documentVersions.length,
  };
}

writeFileSync(join(OUT, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);

// --- Interpretation profile --------------------------------------------------
//
// The pilot's methodology takes no parameters: the reviewers stated the headline
// rule as a fixed conjunction, and there is no interpretive latitude in it to
// govern. The profile therefore records no decisions and no waivers. It still
// exists, and is still content-addressed, because the receipt names the profile
// it was computed under, and "no choices were made" is itself a claim a reader
// should be able to check.

const METHODOLOGY = join(PILOT, "methodology/model-evaluation-duty.writ");
const PROFILES = join(PILOT, "profiles");

const withoutHash = {
  schema_version: "1.0.0",
  id: "profile-eu-us-ai-evaluation-reviewed",
  name: "reviewed",
  version: "1.0.0",
  methodology_bundle_hash: sha256Canonical({
    source: readFileSync(METHODOLOGY, "utf8"),
  }),
  parameters: {},
  decisions: [] as unknown[],
  waivers: [] as unknown[],
  status: "approved",
};

mkdirSync(PROFILES, { recursive: true });
writeFileSync(
  join(PROFILES, "reviewed.profile.json"),
  `${JSON.stringify(
    {
      ...withoutHash,
      canonical_hash: sha256Canonical(withoutHash, {
        dropFields: ["/canonical_hash", "/signature"],
      }),
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify(report, null, 2));
