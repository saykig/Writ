import { findObjects } from "../repository.js";
import { buildLogicalPassageIndex } from "../core/passages.js";
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

interface EndpointCandidate {
  key: string;
  kind: string;
}

/**
 * Resolve endpoint-kind declarations without assigning semantics to a relation.
 * Object kinds come from the manifest-aware repository loader. Institutional
 * symbols additionally expose the generic `institution` kind and, where an
 * approved identity supplies one, its schema-backed institution type.
 */
function endpointCandidates(snapshot: RepositorySnapshot, id: string): EndpointCandidate[] {
  const candidates = new Map<string, EndpointCandidate>();
  for (const object of findObjects(snapshot, id)) {
    const key = `object\0${object.corpus_id}\0${object.file}\0${object.kind}\0${object.id}`;
    candidates.set(key, { key, kind: object.kind });
  }

  const institutional = snapshot.institutionalRecords.filter(
    ({ value }) => value.institution_id === id || value.parent_institution_id === id,
  );
  for (const corpusId of new Set(institutional.map(({ corpus_id }) => corpus_id))) {
    const key = `institution\0${corpusId}\0${id}`;
    candidates.set(key, { key, kind: "institution" });
  }
  for (const { value, corpus_id: corpusId } of institutional) {
    if (
      value.institution_id === id &&
      value.institutional_fact_type === "identity" &&
      value.institution_type
    ) {
      const key = `institution-type\0${corpusId}\0${id}\0${value.institution_type}`;
      candidates.set(key, { key, kind: value.institution_type });
    }
  }
  return [...candidates.values()];
}

function endpointIssue(
  snapshot: RepositorySnapshot,
  id: string,
  declaredKind: string,
  missingCode: "INTEROP_SOURCE_NOT_FOUND" | "INTEROP_TARGET_NOT_FOUND",
  label: string,
  loaded: RepositorySnapshot["links"][number],
) {
  const candidates = endpointCandidates(snapshot, id);
  if (candidates.length === 0) {
    return issue("interoperability", missingCode, `${label} ${id} does not resolve.`, {
      corpus_id: loaded.value.owning_corpus_id,
      object_id: loaded.value.link_id,
      file: loaded.file,
    });
  }
  const matching = candidates.filter(({ kind }) => kind === declaredKind);
  if (matching.length === 0) {
    const actual = [...new Set(candidates.map(({ kind }) => kind))].sort().join(", ");
    return issue(
      "interoperability",
      "INTEROP_DECLARED_KIND_MISMATCH",
      `${label} ${id} declares kind ${declaredKind}, but resolves as: ${actual}.`,
      {
        corpus_id: loaded.value.owning_corpus_id,
        object_id: loaded.value.link_id,
        file: loaded.file,
      },
    );
  }
  if (matching.length > 1) {
    return issue(
      "interoperability",
      "INTEROP_REFERENCE_AMBIGUOUS",
      `${label} ${id} resolves to ${matching.length} ${declaredKind} endpoints.`,
      {
        corpus_id: loaded.value.owning_corpus_id,
        object_id: loaded.value.link_id,
        file: loaded.file,
      },
    );
  }
  return undefined;
}

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
  const passageIndex = buildLogicalPassageIndex(snapshot);
  const corpusIds = new Set(snapshot.catalogEntries.map((entry) => entry.corpus_id));

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

    const source = endpointIssue(
      snapshot,
      link.source_id,
      link.source_kind,
      "INTEROP_SOURCE_NOT_FOUND",
      "Source endpoint",
      loaded,
    );
    const target = endpointIssue(
      snapshot,
      link.target_id,
      link.target_kind,
      "INTEROP_TARGET_NOT_FOUND",
      "Target endpoint",
      loaded,
    );
    if (source) issues.push(source);
    if (target) issues.push(target);

    for (const evidenceId of link.evidence_refs) {
      const evidence = passageIndex.resolve(evidenceId);
      if (evidence.status === "missing") {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_EVIDENCE_NOT_FOUND",
            `Evidence passage ${evidenceId} does not resolve.`,
            {
              corpus_id: link.owning_corpus_id,
              object_id: link.link_id,
              file: loaded.file,
            },
          ),
        );
      } else if (evidence.status === "conflict") {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Evidence passage ${evidenceId} resolves to ${evidence.signatureKeys.length} conflicting logical passage signatures.`,
            {
              corpus_id: link.owning_corpus_id,
              object_id: link.link_id,
              file: loaded.file,
            },
          ),
        );
      }
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
