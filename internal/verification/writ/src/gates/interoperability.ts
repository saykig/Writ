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

function referenceIssue(
  snapshot: RepositorySnapshot,
  id: string,
  kinds: readonly string[],
  missingCode:
    | "INTEROP_SOURCE_NOT_FOUND"
    | "INTEROP_TARGET_NOT_FOUND"
    | "INTEROP_SUPPORT_NOT_FOUND"
    | "INTEROP_EVIDENCE_NOT_FOUND",
  label: string,
  loaded: RepositorySnapshot["links"][number],
) {
  const matches = findObjects(snapshot, id, kinds);
  if (matches.length === 0) {
    return issue("interoperability", missingCode, `${label} ${id} does not resolve.`, {
      corpus_id: loaded.value.owning_corpus_id,
      object_id: loaded.value.link_id,
      file: loaded.file,
    });
  }
  if (matches.length > 1) {
    return issue(
      "interoperability",
      "INTEROP_REFERENCE_AMBIGUOUS",
      `${label} ${id} resolves to ${matches.length} objects.`,
      {
        corpus_id: loaded.value.owning_corpus_id,
        object_id: loaded.value.link_id,
        file: loaded.file,
      },
    );
  }
  return undefined;
}

/** Resolve only references used by the active native corpus contracts. */
export function verifyInteroperability(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];
  const corpusIds = new Set(snapshot.catalogEntries.map((entry) => entry.corpus_id));
  const institutionalSymbols = new Set(
    snapshot.institutionalRecords.flatMap(({ value }) => [
      value.institution_id,
      ...(value.parent_institution_id ? [value.parent_institution_id] : []),
    ]),
  );

  for (const loaded of activeLinks(snapshot)) {
    const link = loaded.value;
    if (!corpusIds.has(link.owning_corpus_id)) {
      issues.push(
        issue(
          "interoperability",
          "INTEROP_OWNER_NOT_FOUND",
          `Owning corpus ${link.owning_corpus_id} is not catalogued.`,
          { object_id: link.link_id, file: loaded.file },
        ),
      );
    }

    if (link.relation_type === "supersedes") {
      const source = referenceIssue(
        snapshot,
        link.source_id,
        ["record"],
        "INTEROP_SOURCE_NOT_FOUND",
        "Source record",
        loaded,
      );
      const target = referenceIssue(
        snapshot,
        link.target_id,
        ["record"],
        "INTEROP_TARGET_NOT_FOUND",
        "Target record",
        loaded,
      );
      if (source) issues.push(source);
      if (target) issues.push(target);
    } else if (link.relation_type === "part_of") {
      if (!institutionalSymbols.has(link.source_id)) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_SOURCE_NOT_FOUND",
            `Institutional source ${link.source_id} does not resolve.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
      if (!institutionalSymbols.has(link.target_id)) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_TARGET_NOT_FOUND",
            `Institutional target ${link.target_id} does not resolve.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
    }

    for (const evidenceId of link.evidence_refs) {
      const finding = referenceIssue(
        snapshot,
        evidenceId,
        ["passage"],
        "INTEROP_EVIDENCE_NOT_FOUND",
        "Evidence passage",
        loaded,
      );
      if (finding) issues.push(finding);
    }
    for (const supportingId of link.supporting_record_ids ?? []) {
      const finding = referenceIssue(
        snapshot,
        supportingId,
        ["record", "legal_policy_claim"],
        "INTEROP_SUPPORT_NOT_FOUND",
        "Supporting record",
        loaded,
      );
      if (finding) issues.push(finding);
    }
  }

  return gateResult("interoperability", issues);
}
