import { createHash } from "node:crypto";
import { validateJudgmentSupersession } from "@writ/domain";

import { buildLogicalPassageIndex, type LogicalPassageResolution } from "../core/passages.js";
import { resolveRoutedSource } from "../core/sources.js";
import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
  type VerificationIssue,
} from "../types.js";

const activeLinks = (snapshot: RepositorySnapshot) =>
  snapshot.links.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  );

const activeInstitutionalRecords = (snapshot: RepositorySnapshot) =>
  snapshot.institutionalRecords.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  );

const currentNativeCoreRecords = (snapshot: RepositorySnapshot) =>
  snapshot.records.filter(({ governing_contract }) => governing_contract.verifies_core_provenance);

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

function sourceDocumentVersionIds(source: {
  id: string;
  value: Record<string, unknown>;
}): string[] {
  if (typeof source.value.document_version_id === "string") {
    return [source.value.document_version_id];
  }
  return source.value.record_type === "source_document_version"
    ? [
        source.id,
        ...(Array.isArray(source.value.legacy_refs)
          ? source.value.legacy_refs.filter((item): item is string => typeof item === "string")
          : []),
      ]
    : [];
}

function citationSourceIssues(
  snapshot: RepositorySnapshot,
  corpusId: string,
  evidenceId: string,
  evidence: LogicalPassageResolution,
  context: { object_id: string; file: string },
): VerificationIssue[] {
  if (evidence.status !== "resolved") return [];
  const signature = evidence.occurrences[0]!.signature;
  const source = resolveRoutedSource(snapshot, corpusId, signature.source_id);
  if (source.status === "missing") {
    return [
      issue(
        "provenance",
        "PROVENANCE_SOURCE_NOT_FOUND",
        `Cited passage ${evidenceId} uses source ${signature.source_id}, which does not resolve to structured source metadata.`,
        { corpus_id: corpusId, ...context },
      ),
    ];
  }
  if (source.status === "not_routed") {
    return [
      issue(
        "provenance",
        "PROVENANCE_SOURCE_NOT_ROUTED",
        `Cited passage ${evidenceId} uses source ${signature.source_id}, but ${corpusId} does not route its structured declaration through locations.sources.`,
        { corpus_id: corpusId, ...context },
      ),
    ];
  }
  if (source.status === "ambiguous") {
    return [
      issue(
        "provenance",
        "PROVENANCE_REFERENCE_AMBIGUOUS",
        `Cited passage ${evidenceId} uses source ${signature.source_id}, which resolves to ${source.matches.length} routed declarations.`,
        { corpus_id: corpusId, ...context },
      ),
    ];
  }

  const findings: VerificationIssue[] = [];
  const declaredHash = sourceDocumentHash(source.source.value);
  if (declaredHash !== signature.document_hash) {
    findings.push(
      issue(
        "provenance",
        "PROVENANCE_SOURCE_MISMATCH",
        `Cited passage ${evidenceId} has document hash ${signature.document_hash}, but the routed source declares ${declaredHash ?? "no document hash"}.`,
        { corpus_id: corpusId, ...context },
      ),
    );
  }
  const declaredVersions = source.compatibilityVersion
    ? [source.compatibilityVersion]
    : sourceDocumentVersionIds(source.source);
  if (!declaredVersions.includes(signature.document_version_id)) {
    findings.push(
      issue(
        "provenance",
        "PROVENANCE_SOURCE_VERSION_MISMATCH",
        `Cited passage ${evidenceId} has document version ${signature.document_version_id}, but the routed source declares ${declaredVersions.join(", ") || "no version identity"}.`,
        { corpus_id: corpusId, ...context },
      ),
    );
  }
  return findings;
}

interface DirectedSupportEdge {
  sourceId: string;
  targetId: string;
}

function hasGroundedEvidence(
  record: RepositorySnapshot["institutionalRecords"][number]["value"],
): boolean {
  return (
    record.evidence.length > 0 &&
    record.evidence.every(({ basis }) => basis === "direct" || basis === "inferred")
  );
}

function inheritedSupportEdges(
  snapshot: RepositorySnapshot,
  inheritedLink: RepositorySnapshot["links"][number],
): DirectedSupportEdge[] {
  const supportIds = new Set(inheritedLink.value.supporting_record_ids ?? []);
  const edges: DirectedSupportEdge[] = [];

  for (const { value: record } of activeInstitutionalRecords(snapshot)) {
    if (
      record.review_state !== "approved" ||
      !supportIds.has(record.record_id) ||
      !hasGroundedEvidence(record)
    )
      continue;
    if (record.institutional_fact_type === "placement") {
      edges.push({ sourceId: record.institution_id, targetId: record.parent_institution_id });
    } else if (
      record.institutional_fact_type === "relationship" &&
      record.record_link.relation_type === "part_of" &&
      (record.record_link.basis === "direct" || record.record_link.basis === "inferred")
    ) {
      edges.push({
        sourceId: record.record_link.source_id,
        targetId: record.record_link.target_id,
      });
    }
  }

  return edges;
}

function establishesDirectedPath(
  sourceId: string,
  targetId: string,
  edges: readonly DirectedSupportEdge[],
): boolean {
  const visited = new Set([sourceId]);
  const pending = [sourceId];
  while (pending.length > 0) {
    const current = pending.shift()!;
    for (const edge of edges) {
      if (edge.sourceId !== current) continue;
      if (edge.targetId === targetId) return true;
      if (!visited.has(edge.targetId)) {
        visited.add(edge.targetId);
        pending.push(edge.targetId);
      }
    }
  }
  return false;
}

/** Check judgment evidence, targets, supersession, and native ID migration history. */
export function verifyProvenance(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];
  const passageIndex = buildLogicalPassageIndex(snapshot);
  const judgmentIds = new Set(snapshot.judgments.map(({ value }) => value.judgment_id));
  const historicalMigrationIds = new Set(
    snapshot.migrations.map((migration) => migration.previous_id),
  );

  for (const loaded of currentNativeCoreRecords(snapshot)) {
    const record = loaded.value;
    for (const evidence of record.evidence) {
      const actualPassageHash = `sha256:${createHash("sha256")
        .update(Buffer.from(evidence.quote, "utf8"))
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

      const source = resolveRoutedSource(snapshot, loaded.corpus_id, evidence.source_id);
      if (source.status === "missing") {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_SOURCE_NOT_FOUND",
            `Evidence source ${evidence.source_id} does not resolve to structured source metadata.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      } else if (source.status === "not_routed") {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_SOURCE_NOT_ROUTED",
            `Evidence source ${evidence.source_id} exists, but ${loaded.corpus_id} does not route its structured declaration through locations.sources.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      } else if (source.status === "ambiguous") {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_REFERENCE_AMBIGUOUS",
            `Evidence source ${evidence.source_id} resolves to ${source.matches.length} physical source declarations.`,
            { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
          ),
        );
      } else {
        const declaredHash = sourceDocumentHash(source.source.value);
        if (declaredHash !== evidence.document_hash) {
          issues.push(
            issue(
              "provenance",
              "PROVENANCE_SOURCE_MISMATCH",
              `Evidence source ${evidence.source_id} has document hash ${evidence.document_hash}, but structured source metadata declares ${declaredHash ?? "no document hash"}.`,
              { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
            ),
          );
        }
        const declaredVersions = source.compatibilityVersion
          ? [source.compatibilityVersion]
          : sourceDocumentVersionIds(source.source);
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
    }
  }

  for (const conflict of passageIndex.currentNativeConflicts()) {
    const first = conflict.occurrences[0]!;
    const identities = conflict.occurrences
      .map((occurrence) => `${occurrence.corpusId}:${occurrence.objectId}`)
      .sort()
      .join(", ");
    issues.push(
      issue(
        "provenance",
        "PROVENANCE_PASSAGE_CONFLICT",
        `Passage ${conflict.passageId} has ${conflict.signatureKeys.length} distinct logical signatures across ${identities}.`,
        { corpus_id: first.corpusId, object_id: conflict.passageId, file: first.file },
      ),
    );
  }

  for (const loaded of snapshot.institutionalRecords) {
    const record = loaded.value;
    const localPassages = new Set(record.evidence.map((evidence) => evidence.passage_id));

    if (record.review_state !== "superseded" && record.review_state !== "withdrawn") {
      const evidenceSourceIds = new Set(record.evidence.map((evidence) => evidence.source_id));
      for (const authoritySourceId of nestedReferences(record, "authority_source_ids")) {
        if (!evidenceSourceIds.has(authoritySourceId)) {
          issues.push(
            issue(
              "provenance",
              "PROVENANCE_AUTHORITY_SOURCE_NOT_EVIDENCED",
              `Authority source ${authoritySourceId} is not present among the record's evidence source_id values; add evidence from that source or remove the unsupported authority declaration.`,
              { corpus_id: loaded.corpus_id, object_id: record.record_id, file: loaded.file },
            ),
          );
        }
      }
    }

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
  }

  for (const loaded of activeLinks(snapshot)) {
    const link = loaded.value;
    for (const evidenceId of link.evidence_refs) {
      issues.push(
        ...citationSourceIssues(
          snapshot,
          link.owning_corpus_id,
          evidenceId,
          passageIndex.resolve(evidenceId),
          {
            object_id: link.link_id,
            file: loaded.file,
          },
        ),
      );
    }
    if (link.basis !== "inherited") continue;
    const edges = link.relation_type === "part_of" ? inheritedSupportEdges(snapshot, loaded) : [];
    if (!establishesDirectedPath(link.source_id, link.target_id, edges)) {
      const supportIds = link.supporting_record_ids?.join(", ") || "none";
      issues.push(
        issue(
          "provenance",
          "PROVENANCE_INHERITED_PATH_NOT_ESTABLISHED",
          `Inherited link ${link.link_id} does not have a compatible directed path from ${link.source_id} to ${link.target_id} through its declared approved, grounded placement or part_of relationship records (${supportIds}); declare every directed support step or use a supported non-inherited basis.`,
          { corpus_id: loaded.corpus_id, object_id: link.link_id, file: loaded.file },
        ),
      );
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
      const evidence = passageIndex.resolve(evidenceId);
      if (evidence.status === "missing") {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_EVIDENCE_NOT_FOUND",
            `Judgment evidence ${evidenceId} does not resolve.`,
            { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
          ),
        );
      } else if (evidence.status === "conflict") {
        issues.push(
          issue(
            "provenance",
            "PROVENANCE_REFERENCE_AMBIGUOUS",
            `Judgment evidence ${evidenceId} resolves to ${evidence.signatureKeys.length} conflicting logical passage signatures.`,
            { corpus_id: loaded.corpus_id, object_id: judgment.judgment_id, file: loaded.file },
          ),
        );
      } else {
        issues.push(
          ...citationSourceIssues(snapshot, loaded.corpus_id, evidenceId, evidence, {
            object_id: judgment.judgment_id,
            file: loaded.file,
          }),
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
    const historicalTargets = snapshot.records.filter(
      ({ value, corpus_id }) =>
        corpus_id === migration.corpus_id && value.record_id === migration.active_id,
    );
    const activeTargets = activeRecords.filter(
      ({ value, corpus_id }) =>
        corpus_id === migration.corpus_id && value.record_id === migration.active_id,
    );
    const approvedSupersessionLinks = links.filter(
      ({ value }) =>
        value.owning_corpus_id === migration.corpus_id &&
        value.review_state === "approved" &&
        value.relation_type === "supersedes" &&
        value.source_kind === "record" &&
        value.target_kind === "record" &&
        value.target_id === migration.active_id,
    );
    const activeSuccessors = approvedSupersessionLinks.flatMap(({ value }) =>
      activeRecords.filter(
        ({ value: record, corpus_id }) =>
          corpus_id === migration.corpus_id && record.record_id === value.source_id,
      ),
    );
    const preservedSupersededTarget =
      activeTargets.length === 0 &&
      historicalTargets.length === 1 &&
      historicalTargets[0]!.value.review_state === "superseded" &&
      approvedSupersessionLinks.length === 1 &&
      activeSuccessors.length === 1;
    if (activeTargets.length !== 1 && !preservedSupersededTarget) {
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
