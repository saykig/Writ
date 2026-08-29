import { createHash } from "node:crypto";
import { validateJudgmentSupersession } from "@writ/domain";

import { findObjects } from "../repository.js";
import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

const activeLinks = (snapshot: RepositorySnapshot) =>
  snapshot.links.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  );

function nestedReferences(value: unknown, key: string): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => nestedReferences(item, key));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([childKey, child]) =>
    childKey === key && Array.isArray(child) && child.every((item) => typeof item === "string")
      ? child
      : nestedReferences(child, key),
  );
}

function sourceDocumentHash(value: Record<string, unknown>): string | undefined {
  for (const key of ["document_hash", "sha256"] as const) {
    if (typeof value[key] === "string") return value[key];
  }
  return undefined;
}

function sourceDocumentVersionIds(value: Record<string, unknown>): string[] {
  if (typeof value.document_version_id === "string") return [value.document_version_id];
  return value.record_type === "source_document_version" && Array.isArray(value.legacy_refs)
    ? value.legacy_refs.filter((item): item is string => typeof item === "string")
    : [];
}

/** Check judgment evidence, targets, supersession, and native ID migration history. */
export function verifyProvenance(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];
  const judgmentIds = new Set(snapshot.judgments.map(({ value }) => value.judgment_id));
  const historicalMigrationIds = new Set(
    snapshot.migrations.map((migration) => migration.previous_id),
  );

  const passages = new Map<string, { signature: string; recordId: string; file: string }>();
  for (const loaded of snapshot.institutionalRecords) {
    const record = loaded.value;
    const localPassages = new Set(record.evidence.map((evidence) => evidence.passage_id));

    for (const evidenceRef of nestedReferences(record, "evidence_refs")) {
      if (!localPassages.has(evidenceRef)) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_EVIDENCE_NOT_FOUND",
            `Record evidence reference ${evidenceRef} is not present in the record's evidence envelope.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      }
    }
    for (const evidence of record.evidence) {
      const actualPassageHash = `sha256:${createHash("sha256")
        .update(evidence.quote)
        .digest("hex")}`;
      if (actualPassageHash !== evidence.passage_hash) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_PASSAGE_HASH_MISMATCH",
            `Evidence passage ${evidence.passage_id} hashes to ${actualPassageHash}, not ${evidence.passage_hash}.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      }
      let sourceMatches = findObjects(snapshot, evidence.source_id, ["source_document", "source"]);
      let compatibilityVersion: string | undefined;
      if (sourceMatches.length === 0) {
        const compatibilityMappings = findObjects(snapshot, evidence.source_id, [
          "compatibility_source_identity",
        ]);
        if (compatibilityMappings.length === 1) {
          const mapping = compatibilityMappings[0]!.value;
          if (
            typeof mapping.compatibility_source_id === "string" &&
            typeof mapping.document_version_id === "string"
          ) {
            sourceMatches = findObjects(snapshot, mapping.compatibility_source_id, [
              "source_document",
              "source",
            ]);
            compatibilityVersion = mapping.document_version_id;
          }
        } else if (compatibilityMappings.length > 1) {
          sourceMatches = compatibilityMappings;
        }
      }
      if (sourceMatches.length === 0) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_SOURCE_NOT_FOUND",
            `Evidence source ${evidence.source_id} does not resolve to structured source metadata.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      } else if (sourceMatches.length > 1) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_REFERENCE_AMBIGUOUS",
            `Evidence source ${evidence.source_id} resolves to ${sourceMatches.length} source documents.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      } else {
        const declaredHash = sourceDocumentHash(sourceMatches[0]!.value);
        if (declaredHash !== undefined && declaredHash !== evidence.document_hash) {
          issues.push(
            issue(
              "provenance",
              "PROVENANCE_SOURCE_MISMATCH",
              `Evidence source ${evidence.source_id} has document hash ${evidence.document_hash}, but structured source metadata declares ${declaredHash}.`,
              { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
            ),
          );
        }
        const declaredVersions = compatibilityVersion
          ? [compatibilityVersion]
          : sourceDocumentVersionIds(sourceMatches[0]!.value);
        if (!declaredVersions.includes(evidence.document_version_id)) {
          issues.push(
            issue(
              "provenance",
              "PROVENANCE_SOURCE_VERSION_MISMATCH",
              `Evidence source ${evidence.source_id} has document version ${evidence.document_version_id}, but structured source metadata declares ${declaredVersions.join(", ") || "no version identity"}.`,
              { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
            ),
          );
        }
      }

      const passageKey = `${loaded.corpus_id}\0${evidence.passage_id}`;
      const signature = JSON.stringify({
        source_id: evidence.source_id,
        document_version_id: evidence.document_version_id,
        locator: evidence.locator,
        quote: evidence.quote,
        passage_hash: evidence.passage_hash,
        document_hash: evidence.document_hash,
      });
      const prior = passages.get(passageKey);
      if (prior && prior.signature !== signature) {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_PASSAGE_CONFLICT",
            `Passage ${evidence.passage_id} conflicts with its occurrence in ${prior.recordId}.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      } else if (!prior) {
        passages.set(passageKey, {
          signature,
          recordId: record.record_id,
          file: loaded.file,
        });
      }
    }
  }

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

  for (const finding of validateJudgmentSupersession(snapshot.judgments.map(({ value }) => value))
    .issues) {
    issues.push(
      issue(
        "provenance",
        "PROVENANCE_SUPERSESSION_INVALID",
        `${finding.code}: ${finding.message}`,
        { object_id: finding.judgmentId },
      ),
    );
  }

  const activeRecords = snapshot.records.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  );
  const activeJudgments = snapshot.judgments.filter(({ value }) => value.status !== "superseded");
  const links = activeLinks(snapshot);
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
    const activeReferences = new Set([
      ...links
        .filter(({ value }) => value.owning_corpus_id === migration.corpus_id)
        .flatMap(({ value }) => [
          value.source_id,
          value.target_id,
          ...(value.supporting_record_ids ?? []),
        ]),
      ...activeJudgments
        .filter(({ corpus_id }) => corpus_id === migration.corpus_id)
        .flatMap(({ value }) => (value.target_kind === "record" ? [value.target_id] : [])),
    ]);
    if (previousRecordActive || activeReferences.has(migration.previous_id)) {
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
  }

  return gateResult("provenance", issues);
}
