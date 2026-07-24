import { MEMBERS } from "@writ/benchmark";

import type {
  G7AssessmentPreview,
  G7EvidenceAction,
  G7EvidenceView,
  G7MemberId,
} from "@/components/g7/types";
import { benchmark, evaluateMember, memberSnapshot } from "@/lib/toolchain";

export const G7_ASSESSMENT_TOPIC = "AI adoption by SMEs";
export const G7_ASSESSMENT_YEAR = 2025;

const MEMBER_IDS = new Set(MEMBERS.map((member) => member.id));

export function isG7MemberId(value: string): value is G7MemberId {
  return MEMBER_IDS.has(value);
}

export function g7AssessmentPreviews(): readonly G7AssessmentPreview[] {
  const cells = new Map(benchmark().cells.map((cell) => [cell.member, cell]));

  return MEMBERS.map((member) => {
    const cell = cells.get(member.id);
    const receipt = evaluateMember(member.id, "published");
    const snapshot = memberSnapshot(member.id);

    if (!cell || !receipt || !snapshot) {
      throw new Error(`Incomplete frozen G7 assessment data for "${member.id}".`);
    }

    return {
      id: member.id as G7MemberId,
      name: member.name,
      markerCoordinates: member.markerCoordinates,
      markerAnchor: member.markerAnchor,
      topic: G7_ASSESSMENT_TOPIC,
      year: G7_ASSESSMENT_YEAR,
      publishedResult: cell.published as G7AssessmentPreview["publishedResult"],
      writResult: receipt.result,
      resultStatus: receipt.result_status,
      reviewedActions: snapshot.actions.length,
    };
  });
}

export function g7AssessmentPreview(memberId: string): G7AssessmentPreview | undefined {
  if (!isG7MemberId(memberId)) return undefined;
  return g7AssessmentPreviews().find((member) => member.id === memberId);
}

const CLASSIFICATION_PREDICATE = "rubric_classification";

/** Compact, immutable projection of the frozen evidence shown in a member Lab. */
export function g7EvidenceView(memberId: string): G7EvidenceView | undefined {
  if (!isG7MemberId(memberId)) return undefined;
  const snapshot = memberSnapshot(memberId);
  if (!snapshot) return undefined;

  const passages = new Map(snapshot.passages.map((passage) => [passage.id, passage]));
  const actions: G7EvidenceAction[] = snapshot.actions.map((action) => {
    const claim = snapshot.claims.find(
      (candidate) =>
        candidate.subject_ref === action.id && candidate.predicate === CLASSIFICATION_PREDICATE,
    );
    const passageId = claim?.evidence_links[0]?.passage_id;
    const passage = passageId ? passages.get(passageId) : undefined;
    const review = claim
      ? snapshot.reviews.find((candidate) => candidate.object_id === claim.id)
      : undefined;

    return {
      id: action.id,
      label: action.label,
      classification: claim ? String(claim.object) : null,
      implementationStage: action.implementation_stage,
      passage: passage
        ? {
            page: passage.page_number ?? null,
            quote: passage.quote,
          }
        : null,
      review: review
        ? {
            reviewerId: review.reviewer_id,
            decision: review.decision,
          }
        : null,
    };
  });

  return {
    snapshotId: snapshot.snapshot.id,
    frozenAt: snapshot.snapshot.frozen_at,
    cutoff: snapshot.snapshot.cutoff,
    contentHash: snapshot.snapshot.content_hash,
    actions,
  };
}
