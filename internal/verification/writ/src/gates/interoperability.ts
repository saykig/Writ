import { InstitutionResolutionError } from "@writ/domain";

import { findObjects } from "../repository.js";
import { activeLinks, isAdr0019Relation, resolveInstitution } from "./ontology.js";
import {
  gateResult,
  issue,
  type RepositorySnapshot,
  type VerificationGateResult,
} from "../types.js";

function linkSignature(source: string | null, relation: string, target: string): string {
  return `${source ?? "<unresolved>"}\0${relation}\0${target}`;
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
      const sourceKinds =
        link.relation_type === "derives_authority_from"
          ? ["record"]
          : ["legal_policy_claim", "source", "publication", "instrument", "record"];
      const sourceMatches = findObjects(snapshot, link.source_id, sourceKinds);
      if (sourceMatches.length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_SOURCE_NOT_FOUND",
            `Source endpoint ${link.source_id} does not resolve.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      } else if (sourceMatches.length > 1) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Source endpoint ${link.source_id} resolves to ${sourceMatches.length} objects.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
      if (link.relation_type !== "derives_authority_from") {
        try {
          const target = resolveInstitution(snapshot, link.target_id);
          if (target.corpus_id !== link.owning_corpus_id) {
            issues.push(
              issue(
                "interoperability",
                "INTEROP_OWNER_MISMATCH",
                `Institutional endpoint ${link.target_id} is owned by ${target.corpus_id}, not ${link.owning_corpus_id}.`,
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
        const targetMatches = findObjects(snapshot, link.target_id, [
          "legal_policy_claim",
          "record",
        ]);
        if (targetMatches.length === 0) {
          issues.push(
            issue(
              "interoperability",
              "INTEROP_TARGET_NOT_FOUND",
              `Target provision ${link.target_id} does not resolve.`,
              { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
            ),
          );
        } else if (targetMatches.length > 1) {
          issues.push(
            issue(
              "interoperability",
              "INTEROP_REFERENCE_AMBIGUOUS",
              `Target provision ${link.target_id} resolves to ${targetMatches.length} objects.`,
              { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
            ),
          );
        }
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
      const supporting = findObjects(snapshot, supportingId, ["record"]);
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
      } else if (supporting.every((item) => item.corpus_id !== link.owning_corpus_id)) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_SUPPORT_ENDPOINT_MISMATCH",
            `Supporting record ${supportingId} is not owned by ${link.owning_corpus_id}.`,
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
      if (mapping.mapping_status.includes("active") && active.length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Active queue mapping ${mapping.mapping_id} does not resolve to an active link.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      } else if (mapping.mapping_status.includes("active") && active.length > 1) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_REFERENCE_AMBIGUOUS",
            `Active queue mapping ${mapping.mapping_id} resolves to ${active.length} links.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      }
    }
  }

  return gateResult("interoperability", issues);
}
