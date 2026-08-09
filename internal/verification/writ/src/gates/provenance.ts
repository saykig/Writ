import { validateJudgmentSupersession } from "@writ/domain";

import { findObjects } from "../repository.js";
import { activeLinks, isAdr0019Relation } from "./ontology.js";
import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

function proposalJudgmentReviewers(snapshot: RepositorySnapshot): Map<string, string> {
  const proposalReviewers = new Map<string, string>();
  for (const review of snapshot.humanReviews) {
    for (const decision of review.decisions) {
      proposalReviewers.set(decision.proposal_judgment_id, review.proposal_proposer);
    }
  }
  return proposalReviewers;
}

function isRecordEndpoint(kind: string): boolean {
  return [
    "record",
    "legal_policy_claim",
    "legal_policy_provision",
    "institutional_mandate",
    "institutional_decision_right",
    "institutional_function",
  ].includes(kind);
}

export function verifyProvenance(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];
  const links = activeLinks(snapshot);
  const judgmentIds = new Set(snapshot.judgments.map(({ value }) => value.judgment_id));
  const historicalMigrationIds = new Set(
    snapshot.migrations.map((migration) => migration.previous_id),
  );

  for (const loaded of snapshot.judgments) {
    const judgment = loaded.value;
    const targetMatches =
      judgment.target_kind === "record_link"
        ? snapshot.links.filter(({ value }) => value.link_id === judgment.target_id)
        : snapshot.records.filter(({ value }) => value.record_id === judgment.target_id);
    const historicalMigratedTarget =
      judgment.status === "superseded" && historicalMigrationIds.has(judgment.target_id);
    if (targetMatches.length === 0 && !historicalMigratedTarget) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_JUDGMENT_TARGET_NOT_FOUND",
          `Judgment target ${judgment.target_id} does not resolve.`,
          { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
        ),
      );
    } else if (targetMatches.length > 1) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_REFERENCE_AMBIGUOUS",
          `Judgment target ${judgment.target_id} resolves to ${targetMatches.length} objects.`,
          { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
        ),
      );
    }
    for (const evidenceId of judgment.evidence_refs) {
      const evidenceMatches = findObjects(snapshot, evidenceId, ["passage"]);
      if (evidenceMatches.length === 0) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_EVIDENCE_NOT_FOUND",
            `Judgment evidence ${evidenceId} does not resolve.`,
            { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
          ),
        );
      } else if (evidenceMatches.length > 1) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_REFERENCE_AMBIGUOUS",
            `Judgment evidence ${evidenceId} resolves to ${evidenceMatches.length} passages.`,
            { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
          ),
        );
      }
    }
    for (const related of [
      ...(judgment.supersedes_judgment_ids ?? []),
      ...(judgment.superseded_by_judgment_id ? [judgment.superseded_by_judgment_id] : []),
    ]) {
      if (!judgmentIds.has(related)) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_SUPERSESSION_INVALID",
            `Judgment ${judgment.judgment_id} references missing supersession judgment ${related}.`,
            { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
          ),
        );
      }
    }
  }

  for (const supersessionIssue of validateJudgmentSupersession(
    snapshot.judgments.map(({ value }) => value),
  ).issues) {
    issues.push(
      issue(
        "provenance",
        "PROVENANCE_SUPERSESSION_INVALID",
        `${supersessionIssue.code}: ${supersessionIssue.message}`,
        { object_id: supersessionIssue.judgmentId },
      ),
    );
  }

  const adrLinks = links.filter(({ value }) => isAdr0019Relation(value.relation_type));
  for (const loaded of adrLinks) {
    const acceptedDispositions = snapshot.judgments.filter(
      ({ value }) =>
        value.target_kind === "record_link" &&
        value.target_id === loaded.value.link_id &&
        value.judgment_type === "record_link_disposition" &&
        value.status === "accepted",
    );
    if (acceptedDispositions.length > 1) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_DISPOSITION_AMBIGUOUS",
          `ADR 0019 link ${loaded.value.link_id} has ${acceptedDispositions.length} current accepted dispositions.`,
          {
            corpus_id: loaded.value.owning_corpus_id,
            object_id: loaded.value.link_id,
            file: loaded.file,
          },
        ),
      );
    }
    if (
      loaded.value.review_state === "approved" &&
      !acceptedDispositions.some(({ value }) => value.value === loaded.value.review_state)
    ) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_DISPOSITION_MISSING",
          `Approved ADR 0019 link ${loaded.value.link_id} has no matching accepted disposition.`,
          {
            corpus_id: loaded.value.owning_corpus_id,
            object_id: loaded.value.link_id,
            file: loaded.file,
          },
        ),
      );
    }
    if (
      loaded.value.review_state === "draft" &&
      snapshot.judgments.some(
        ({ value }) =>
          value.target_kind === "record_link" &&
          value.target_id === loaded.value.link_id &&
          value.judgment_type === "record_link_disposition" &&
          value.status === "accepted" &&
          value.value === "approved",
      )
    ) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_DRAFT_HUMAN_MISMATCH",
          `Draft link ${loaded.value.link_id} has an accepted approved disposition.`,
          {
            corpus_id: loaded.value.owning_corpus_id,
            object_id: loaded.value.link_id,
            file: loaded.file,
          },
        ),
      );
    }
  }

  for (const review of snapshot.humanReviews) {
    for (const decision of review.decisions) {
      const reviewedLinks = adrLinks.filter(({ value }) => value.link_id === decision.link_id);
      const acceptedJudgments = snapshot.judgments.filter(
        ({ value }) => value.judgment_id === decision.accepted_judgment_id,
      );
      if (reviewedLinks.length !== 1) {
        issues.push(
          issue(
            "provenance",
            reviewedLinks.length > 1
              ? "PROVENANCE_REFERENCE_AMBIGUOUS"
              : "PROVENANCE_DISPOSITION_MISSING",
            `Human-review decision ${review.review_id} resolves ${reviewedLinks.length} active ADR 0019 links for ${decision.link_id}.`,
            { object_id: decision.link_id, file: review.file },
          ),
        );
      }
      if (acceptedJudgments.length !== 1) {
        issues.push(
          issue(
            "provenance",
            acceptedJudgments.length > 1
              ? "PROVENANCE_REFERENCE_AMBIGUOUS"
              : "PROVENANCE_DISPOSITION_MISSING",
            `Human-review decision ${review.review_id} resolves ${acceptedJudgments.length} judgments named ${decision.accepted_judgment_id}.`,
            { object_id: decision.link_id, file: review.file },
          ),
        );
      }
      if (reviewedLinks.length !== 1 || acceptedJudgments.length !== 1) continue;

      const reviewedLink = reviewedLinks[0]!.value;
      const accepted = acceptedJudgments[0]!.value;
      const judgmentMatchesDecision =
        decision.decision === "approve" &&
        accepted.target_kind === "record_link" &&
        accepted.target_id === decision.link_id &&
        accepted.judgment_type === "record_link_disposition" &&
        accepted.status === "accepted" &&
        accepted.value === decision.final_review_state &&
        accepted.reviewer === decision.reviewer &&
        reviewedLink.review_state === decision.final_review_state;
      if (!judgmentMatchesDecision) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_DISPOSITION_MISSING",
            `Named judgment ${decision.accepted_judgment_id} does not implement the exact human-review decision for ${decision.link_id}.`,
            {
              corpus_id: reviewedLink.owning_corpus_id,
              object_id: decision.link_id,
              file: review.file,
            },
          ),
        );
      }
    }
  }

  const proposalReviewers = proposalJudgmentReviewers(snapshot);
  for (const loaded of snapshot.judgments) {
    const expectedReviewer = proposalReviewers.get(loaded.value.judgment_id);
    if (expectedReviewer && loaded.value.reviewer !== expectedReviewer) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_AUTOMATION_ATTRIBUTION",
          `Declared proposal judgment ${loaded.value.judgment_id} is attributed to ${loaded.value.reviewer}, not its recorded proposer ${expectedReviewer}.`,
          { corpus_id: loaded.corpus_id, object_id: loaded.value.judgment_id, file: loaded.file },
        ),
      );
    }
  }

  const activeRecords = snapshot.records.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  );
  const activeJudgments = snapshot.judgments.filter(({ value }) => value.status !== "superseded");
  const activeRecordReferences = new Set<string>([
    ...activeRecords.flatMap(({ value }) => [
      ...("parent_instrument_id" in value && typeof value.parent_instrument_id === "string"
        ? [value.parent_instrument_id]
        : []),
      ...("related_provision_ids" in value && Array.isArray(value.related_provision_ids)
        ? value.related_provision_ids.filter((id): id is string => typeof id === "string")
        : []),
    ]),
    ...links.flatMap(({ value }) => [
      ...(isRecordEndpoint(value.source_kind) ? [value.source_id] : []),
      ...(isRecordEndpoint(value.target_kind) ? [value.target_id] : []),
      ...(value.supporting_record_ids ?? []),
    ]),
    ...activeJudgments.flatMap(({ value }) =>
      value.target_kind === "record" ? [value.target_id] : [],
    ),
  ]);
  for (const migration of snapshot.migrations) {
    const activeTargets = activeRecords.filter(
      ({ value, corpus_id }) =>
        corpus_id === migration.corpus_id && value.record_id === migration.active_id,
    );
    if (activeTargets.length !== 1) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
          `Migration active record ID ${migration.active_id} resolves ${activeTargets.length} times in ${migration.corpus_id}.`,
          { corpus_id: migration.corpus_id, object_id: migration.active_id, file: migration.file },
        ),
      );
    }
    const previousRecordActive = activeRecords.some(
      ({ value, corpus_id }) =>
        corpus_id === migration.corpus_id && value.record_id === migration.previous_id,
    );
    if (previousRecordActive || activeRecordReferences.has(migration.previous_id)) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_ACTIVE_LEGACY_ID",
          `Previous ID ${migration.previous_id} remains active after migration to ${migration.active_id}.`,
          {
            corpus_id: migration.corpus_id,
            object_id: migration.previous_id,
            file: migration.file,
          },
        ),
      );
    }
    if (migration.review_artifact) {
      const reviews = snapshot.humanReviews.filter(
        (review) => review.file === migration.review_artifact,
      );
      const matchingReviews = reviews.filter(
        (review) =>
          review.approved_id_revision.previous_id === migration.previous_id &&
          review.approved_id_revision.active_id === migration.active_id &&
          review.approved_id_revision.decision === "approve",
      );
      if (reviews.length !== 1 || matchingReviews.length !== 1) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
            `Structured migration review does not uniquely approve ${migration.previous_id} -> ${migration.active_id}.`,
            {
              corpus_id: migration.corpus_id,
              object_id: migration.active_id,
              file: migration.review_artifact,
            },
          ),
        );
      }
    }
  }

  return gateResult("provenance", issues);
}
