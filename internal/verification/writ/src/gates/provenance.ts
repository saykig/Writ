import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { validateJudgmentSupersession } from "@writ/domain";

import { findObjects } from "../repository.js";
import { activeLinks } from "./ontology.js";
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

function reviewActors(root: string): { humans: Set<string>; automation: Set<string> } {
  const humans = new Set<string>();
  const automation = new Set<string>();
  const directory = join(root, "docs", "migrations");
  for (const file of filesUnder(directory).filter((path) => path.endsWith("/human-review.yaml"))) {
    const value = Bun.YAML.parse(readFileSync(file, "utf8")) as unknown;
    if (!object(value)) continue;
    if (value.review_type === "human" && typeof value.reviewer === "string")
      humans.add(value.reviewer);
    if (object(value.proposal_history) && typeof value.proposal_history.proposer === "string") {
      automation.add(value.proposal_history.proposer);
    }
  }
  return { humans, automation };
}

export function verifyProvenance(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];
  const links = activeLinks(snapshot);
  const linkIds = new Set(snapshot.links.map(({ value }) => value.link_id));
  const recordIds = new Set(snapshot.records.map(({ value }) => value.record_id));
  const judgmentIds = new Set(snapshot.judgments.map(({ value }) => value.judgment_id));
  const acceptedByTarget = new Map<string, number>();

  for (const loaded of snapshot.judgments) {
    const judgment = loaded.value;
    const targetExists =
      judgment.target_kind === "record_link"
        ? linkIds.has(judgment.target_id)
        : recordIds.has(judgment.target_id);
    if (!targetExists) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_JUDGMENT_TARGET_NOT_FOUND",
          `Judgment target ${judgment.target_id} does not resolve.`,
          { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
        ),
      );
    }
    if (judgment.status === "accepted") {
      acceptedByTarget.set(judgment.target_id, (acceptedByTarget.get(judgment.target_id) ?? 0) + 1);
    }
    for (const evidenceId of judgment.evidence_refs) {
      if (findObjects(snapshot, evidenceId, ["passage"]).length === 0) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_EVIDENCE_NOT_FOUND",
            `Judgment evidence ${evidenceId} does not resolve.`,
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
      loaded.value.review_state === "approved" &&
      (acceptedByTarget.get(loaded.value.link_id) ?? 0) === 0
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

  const actors = reviewActors(snapshot.root);
  const supersededProposalIds = new Set(
    snapshot.judgments.flatMap(({ value }) => value.supersedes_judgment_ids ?? []),
  );
  for (const loaded of snapshot.judgments) {
    if (
      supersededProposalIds.has(loaded.value.judgment_id) &&
      actors.humans.has(loaded.value.reviewer) &&
      !actors.automation.has(loaded.value.reviewer)
    ) {
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_AUTOMATION_ATTRIBUTION",
          `Automated proposal history ${loaded.value.judgment_id} is attributed to known human reviewer ${loaded.value.reviewer}.`,
          { corpus_id: loaded.corpus_id, object_id: loaded.value.judgment_id, file: loaded.file },
        ),
      );
    }
  }

  const activeReferences = new Set<string>([
    ...snapshot.records.map(({ value }) => value.record_id),
    ...snapshot.links.flatMap(({ value }) => [
      value.link_id,
      value.source_id,
      value.target_id,
      ...(value.supporting_record_ids ?? []),
    ]),
    ...snapshot.judgments.flatMap(({ value }) => [value.target_id]),
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
