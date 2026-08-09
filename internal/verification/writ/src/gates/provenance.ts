import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { validateJudgmentSupersession } from "@writ/domain";

import { findObjects } from "../repository.js";
import { activeLinks, isAdr0019Relation } from "./ontology.js";
import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const child = join(directory, name);
      return statSync(child).isDirectory() ? filesUnder(child) : [child];
    })
    .sort();
}

function proposalJudgmentReviewers(root: string): Map<string, string> {
  const proposalReviewers = new Map<string, string>();
  const directory = join(root, "docs", "migrations");
  for (const file of filesUnder(directory).filter((path) => path.endsWith("/human-review.yaml"))) {
    const value = Bun.YAML.parse(readFileSync(file, "utf8")) as unknown;
    if (!object(value)) continue;
    const proposer = object(value.proposal_history) ? value.proposal_history.proposer : undefined;
    if (typeof proposer !== "string" || !Array.isArray(value.decisions)) continue;
    for (const decision of value.decisions) {
      if (object(decision) && typeof decision.proposal_judgment_id === "string") {
        proposalReviewers.set(decision.proposal_judgment_id, proposer);
      }
    }
  }
  return proposalReviewers;
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

  for (const loaded of links) {
    if (
      isAdr0019Relation(loaded.value.relation_type) &&
      loaded.value.review_state === "approved" &&
      !snapshot.judgments.some(
        ({ value }) =>
          value.target_kind === "record_link" &&
          value.target_id === loaded.value.link_id &&
          value.judgment_type === "record_link_disposition" &&
          value.status === "accepted" &&
          value.value === loaded.value.review_state,
      )
    ) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_DISPOSITION_MISSING",
          `Approved link ${loaded.value.link_id} has no accepted disposition.`,
          {
            corpus_id: loaded.value.owning_corpus_id,
            object_id: loaded.value.link_id,
            file: loaded.file,
          },
        ),
      );
    }
    if (
      isAdr0019Relation(loaded.value.relation_type) &&
      loaded.value.review_state === "draft" &&
      snapshot.judgments.some(
        ({ value }) =>
          value.target_kind === "record_link" &&
          value.target_id === loaded.value.link_id &&
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

  const proposalReviewers = proposalJudgmentReviewers(snapshot.root);
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
  const activeReferences = new Set<string>([
    ...activeRecords.flatMap(({ value }) => [
      value.record_id,
      ...value.subjects.map((subject) => subject.subject_id),
      ...(value.family === "institutional" && "institution_id" in value
        ? [
            value.institution_id as string,
            ...("parent_institution_id" in value && typeof value.parent_institution_id === "string"
              ? [value.parent_institution_id]
              : []),
          ]
        : []),
      ...("parent_instrument_id" in value && typeof value.parent_instrument_id === "string"
        ? [value.parent_instrument_id]
        : []),
      ...("related_provision_ids" in value && Array.isArray(value.related_provision_ids)
        ? value.related_provision_ids.filter((id): id is string => typeof id === "string")
        : []),
    ]),
    ...links.flatMap(({ value }) => [
      value.link_id,
      value.source_id,
      value.target_id,
      ...(value.supporting_record_ids ?? []),
    ]),
    ...activeJudgments.flatMap(({ value }) => [value.target_id]),
  ]);
  for (const migration of snapshot.migrations) {
    if (!activeReferences.has(migration.active_id)) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
          `Migration active ID ${migration.active_id} does not resolve.`,
          { corpus_id: migration.corpus_id, object_id: migration.active_id, file: migration.file },
        ),
      );
    }
    if (activeReferences.has(migration.previous_id)) {
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
      const reviewFile = join(snapshot.root, migration.review_artifact);
      if (!existsSync(reviewFile)) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
            `Migration review artifact does not exist: ${migration.review_artifact}`,
            {
              corpus_id: migration.corpus_id,
              object_id: migration.active_id,
              file: migration.file,
            },
          ),
        );
      } else {
        const history = readFileSync(reviewFile, "utf8");
        if (!history.includes(migration.previous_id) || !history.includes(migration.active_id)) {
          issues.push(
            issue(
              "provenance",
              "PROVENANCE_MIGRATION_HISTORY_INCONSISTENT",
              `Migration review artifact does not connect ${migration.previous_id} to ${migration.active_id}.`,
              {
                corpus_id: migration.corpus_id,
                object_id: migration.active_id,
                file: relative(snapshot.root, reviewFile),
              },
            ),
          );
        }
      }
    }
  }

  return gateResult("provenance", issues);
}
