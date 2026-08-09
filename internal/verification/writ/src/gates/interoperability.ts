import { InstitutionResolutionError } from "@writ/domain";

import { findObjects } from "../repository.js";
import { activeLinks, isAdr0019Relation, resolveInstitution } from "../rules/adr-0019.js";
import {
  gateResult,
  issue,
  type IndexedObject,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

function linkSignature(source: string | null, relation: string, target: string): string {
  return `${source ?? "<unresolved>"}\0${relation}\0${target}`;
}

interface EndpointMatch {
  id: string;
  kind: string;
  corpus_id: string;
  file: string;
}

function indexedMatches(
  snapshot: RepositorySnapshot,
  id: string,
  kinds: readonly string[],
): EndpointMatch[] {
  return findObjects(snapshot, id, kinds).map(({ id: objectId, kind, corpus_id, file }) => ({
    id: objectId,
    kind,
    corpus_id,
    file,
  }));
}

function endpointMatches(
  snapshot: RepositorySnapshot,
  id: string,
  declaredKind: string,
): EndpointMatch[] {
  if (declaredKind === "legal_policy_provision") {
    return snapshot.records
      .filter(
        ({ value }) =>
          value.record_id === id &&
          value.family === "legal_policy" &&
          value.review_state !== "superseded" &&
          value.review_state !== "withdrawn",
      )
      .map(({ value, file, corpus_id }) => ({
        id: value.record_id,
        kind: declaredKind,
        corpus_id,
        file,
      }));
  }

  const institutionalFactKinds: Record<string, string> = {
    institutional_mandate: "mandate",
    institutional_decision_right: "decision_right",
    institutional_function: "function",
  };
  const factType = institutionalFactKinds[declaredKind];
  if (factType) {
    return snapshot.institutionalRecords
      .filter(
        ({ value }) =>
          value.record_id === id &&
          value.institutional_fact_type === factType &&
          value.review_state !== "superseded" &&
          value.review_state !== "withdrawn",
      )
      .map(({ value, file, corpus_id }) => ({
        id: value.record_id,
        kind: declaredKind,
        corpus_id,
        file,
      }));
  }

  return indexedMatches(snapshot, id, [declaredKind]);
}

function hasObjectWithId(snapshot: RepositorySnapshot, id: string): boolean {
  return (
    findObjects(snapshot, id).length > 0 ||
    snapshot.records.some(({ value }) => value.record_id === id)
  );
}

function endpointResolutionIssue(
  snapshot: RepositorySnapshot,
  id: string,
  declaredKind: string,
  side: "source" | "target",
  link: (typeof snapshot.links)[number],
) {
  const matches = endpointMatches(snapshot, id, declaredKind);
  if (matches.length === 0) {
    const kindMismatch = hasObjectWithId(snapshot, id);
    return issue(
      "interoperability",
      kindMismatch
        ? "INTEROP_ENDPOINT_KIND_MISMATCH"
        : side === "source"
          ? "INTEROP_SOURCE_NOT_FOUND"
          : "INTEROP_TARGET_NOT_FOUND",
      kindMismatch
        ? `${side} endpoint ${id} resolves, but not as declared kind ${declaredKind}.`
        : `${side} endpoint ${id} does not resolve as declared kind ${declaredKind}.`,
      {
        corpus_id: link.value.owning_corpus_id,
        object_id: link.value.link_id,
        file: link.file,
      },
    );
  }
  if (matches.length > 1) {
    return issue(
      "interoperability",
      "INTEROP_REFERENCE_AMBIGUOUS",
      `${side} endpoint ${id} resolves to ${matches.length} ${declaredKind} objects.`,
      {
        corpus_id: link.value.owning_corpus_id,
        object_id: link.value.link_id,
        file: link.file,
      },
    );
  }
  return undefined;
}

function supportingRecordMatches(snapshot: RepositorySnapshot, id: string): IndexedObject[] {
  return findObjects(snapshot, id, ["record", "legal_policy_claim"]);
}

export function verifyInteroperability(snapshot: RepositorySnapshot): VerificationGateResult {
  const issues = [];
  const links = activeLinks(snapshot);
  const linksById = new Map<string, typeof links>();
  for (const loaded of links) {
    const matches = linksById.get(loaded.value.link_id) ?? [];
    matches.push(loaded);
    linksById.set(loaded.value.link_id, matches);
  }
  const corpusIds = new Set(snapshot.catalogEntries.map((entry) => entry.corpus_id));
  const institutionalSymbols = new Set(
    snapshot.institutionalRecords.flatMap(({ value }) => [
      value.institution_id,
      ...(value.parent_institution_id ? [value.parent_institution_id] : []),
    ]),
  );

  for (const loaded of links) {
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

    if (isAdr0019Relation(link.relation_type)) {
      const sourceIssue = endpointResolutionIssue(
        snapshot,
        link.source_id,
        link.source_kind,
        "source",
        loaded,
      );
      if (sourceIssue) issues.push(sourceIssue);
      if (link.relation_type !== "derives_authority_from") {
        try {
          const target = resolveInstitution(snapshot, link.target_id);
          const identity = snapshot.institutionalRecords.find(
            ({ value }) => value.record_id === target.identity_record_id,
          );
          const actualTargetKind =
            identity?.value.institution_type === "organizational_unit"
              ? "organizational_unit"
              : "institution";
          if (actualTargetKind !== link.target_kind) {
            issues.push(
              issue(
                "interoperability",
                "INTEROP_ENDPOINT_KIND_MISMATCH",
                `Target endpoint ${link.target_id} resolves as ${actualTargetKind}, not declared kind ${link.target_kind}.`,
                { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
              ),
            );
          }
          if (target.corpus_id !== link.owning_corpus_id) {
            issues.push(
              issue(
                "interoperability",
                "INTEROP_OWNER_MISMATCH",
                `Institution-owned ADR 0019 link is stored by ${link.owning_corpus_id}, but canonical endpoint ${link.target_id} is owned by ${target.corpus_id}.`,
                { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
              ),
            );
          }
        } catch (error) {
          if (error instanceof InstitutionResolutionError) {
            issues.push(
              issue(
                "interoperability",
                error.code === "INSTITUTION_ENDPOINT_AMBIGUOUS"
                  ? "INTEROP_REFERENCE_AMBIGUOUS"
                  : "INTEROP_TARGET_NOT_FOUND",
                error.message,
                {
                  corpus_id: link.owning_corpus_id,
                  object_id: link.link_id,
                  file: loaded.file,
                },
              ),
            );
          } else throw error;
        }
      } else {
        const targetIssue = endpointResolutionIssue(
          snapshot,
          link.target_id,
          link.target_kind,
          "target",
          loaded,
        );
        if (targetIssue) issues.push(targetIssue);
        const institutionalSources = endpointMatches(snapshot, link.source_id, link.source_kind);
        if (
          institutionalSources.length === 1 &&
          institutionalSources[0]!.corpus_id !== link.owning_corpus_id
        ) {
          issues.push(
            issue(
              "interoperability",
              "INTEROP_OWNER_MISMATCH",
              `Institution-owned ADR 0019 link is stored by ${link.owning_corpus_id}, but canonical institutional source ${link.source_id} is owned by ${institutionalSources[0]!.corpus_id}.`,
              { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
            ),
          );
        }
      }
      if (link.basis === "inherited" && !link.supporting_record_ids?.length) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_INHERITED_SUPPORT_MISSING",
            `Inherited ADR 0019 link ${link.link_id} does not declare supporting records.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
    } else if (link.relation_type === "supersedes") {
      for (const [side, id] of [
        ["source", link.source_id],
        ["target", link.target_id],
      ] as const) {
        const matches = findObjects(snapshot, id, ["record"]);
        if (matches.length === 0) {
          issues.push(
            issue(
              "interoperability",
              side === "source" ? "INTEROP_SOURCE_NOT_FOUND" : "INTEROP_TARGET_NOT_FOUND",
              `${side} record ${id} does not resolve.`,
              { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
            ),
          );
        } else if (matches.length > 1) {
          issues.push(
            issue(
              "interoperability",
              "INTEROP_REFERENCE_AMBIGUOUS",
              `${side} record ${id} resolves to ${matches.length} objects.`,
              { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
            ),
          );
        }
      }
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
      const evidenceMatches = findObjects(snapshot, evidenceId, ["passage"]);
      if (evidenceMatches.length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_EVIDENCE_NOT_FOUND",
            `Evidence passage ${evidenceId} does not resolve.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      } else if (evidenceMatches.length > 1) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Evidence passage ${evidenceId} resolves to ${evidenceMatches.length} objects.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
    }
    for (const supportingId of link.supporting_record_ids ?? []) {
      const supporting = supportingRecordMatches(snapshot, supportingId);
      if (supporting.length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_SUPPORT_NOT_FOUND",
            `Supporting record ${supportingId} does not resolve.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      } else if (supporting.length > 1) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Supporting record ${supportingId} resolves to ${supporting.length} objects.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
    }
  }

  const adrLinks = links.filter(({ value }) => isAdr0019Relation(value.relation_type));
  const stored = new Set(
    adrLinks.map(({ value }) => `${value.relation_type}\0${value.source_id}\0${value.target_id}`),
  );
  for (const loaded of adrLinks) {
    if (
      stored.has(
        `${loaded.value.relation_type}\0${loaded.value.target_id}\0${loaded.value.source_id}`,
      )
    ) {
      issues.push(
        issue(
          "interoperability",
          "INTEROP_INVERSE_DUPLICATE",
          `Stored inverse duplicate exists for ${loaded.value.link_id}.`,
          {
            corpus_id: loaded.value.owning_corpus_id,
            object_id: loaded.value.link_id,
            file: loaded.file,
          },
        ),
      );
    }
  }

  const signatures = new Map<string, typeof links>();
  for (const item of links) {
    const signature = linkSignature(
      item.value.source_id,
      item.value.relation_type,
      item.value.target_id,
    );
    const matches = signatures.get(signature) ?? [];
    matches.push(item);
    signatures.set(signature, matches);
  }
  for (const queue of snapshot.queues) {
    const activeQueueMappings = new Set<string>();
    for (const id of queue.active_link_ids) {
      const matches = linksById.get(id) ?? [];
      if (matches.length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Queue-declared active link ${id} does not resolve.`,
            { object_id: id, file: queue.file },
          ),
        );
      } else if (matches.length > 1) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Queue-declared active link ${id} resolves to ${matches.length} links.`,
            { object_id: id, file: queue.file },
          ),
        );
      } else if (matches[0]!.value.review_state !== "approved") {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Queue-declared active link ${id} has review_state ${matches[0]!.value.review_state}, not approved.`,
            { object_id: id, file: queue.file },
          ),
        );
      }
    }
    for (const mapping of queue.mappings) {
      const signature = linkSignature(
        mapping.legal_policy_record_id,
        mapping.proposed_relation,
        mapping.target_institutional_id,
      );
      const active = signatures.get(signature) ?? [];
      if (mapping.mapping_status === "unresolved" && active.length > 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_UNRESOLVED_ACTIVE",
            `Unresolved mapping ${mapping.mapping_id} is active as ${active[0]!.value.link_id}.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      }
      if (mapping.mapping_status === "active_approved" && active.length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Active queue mapping ${mapping.mapping_id} does not resolve to an active link.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      } else if (mapping.mapping_status === "active_approved" && active.length > 1) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Active queue mapping ${mapping.mapping_id} resolves to ${active.length} links.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      } else if (
        mapping.mapping_status === "active_approved" &&
        active[0]!.value.review_state !== "approved"
      ) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Active approved queue mapping ${mapping.mapping_id} resolves to link ${active[0]!.value.link_id} with review_state ${active[0]!.value.review_state}.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      } else if (mapping.mapping_status === "active_approved") {
        activeQueueMappings.add(active[0]!.value.link_id);
      }
    }
    const declaredActive = new Set(queue.active_link_ids);
    if (
      declaredActive.size !== activeQueueMappings.size ||
      [...declaredActive].some((id) => !activeQueueMappings.has(id))
    ) {
      issues.push(
        issue(
          "interoperability",
          "INTEROP_ACTIVE_SET_MISMATCH",
          `Queue ${queue.queue_id} active_link_ids do not equal its resolved active_approved mappings.`,
          { object_id: queue.queue_id, file: queue.file },
        ),
      );
    }
  }

  return gateResult("interoperability", issues);
}
