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
  const linkById = new Map(links.map((item) => [item.value.link_id, item]));
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
      if (findObjects(snapshot, link.source_id, sourceKinds).length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_SOURCE_NOT_FOUND",
            `Source endpoint ${link.source_id} does not resolve.`,
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
              issue("interoperability", "INTEROP_TARGET_NOT_FOUND", error.message, {
                corpus_id: link.owning_corpus_id,
                object_id: link.link_id,
                file: loaded.file,
              }),
            );
          } else throw error;
        }
      } else if (
        findObjects(snapshot, link.target_id, ["legal_policy_claim", "record"]).length === 0
      ) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_TARGET_NOT_FOUND",
            `Target provision ${link.target_id} does not resolve.`,
            { corpus_id: link.owning_corpus_id, object_id: link.link_id, file: loaded.file },
          ),
        );
      }
    } else if (link.relation_type === "supersedes") {
      for (const [side, id] of [
        ["source", link.source_id],
        ["target", link.target_id],
      ] as const) {
        if (findObjects(snapshot, id, ["record"]).length === 0) {
          issues.push(
            issue(
              "interoperability",
              side === "source" ? "INTEROP_SOURCE_NOT_FOUND" : "INTEROP_TARGET_NOT_FOUND",
              `${side} record ${id} does not resolve.`,
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
      if (findObjects(snapshot, evidenceId, ["passage"]).length === 0) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_EVIDENCE_NOT_FOUND",
            `Evidence passage ${evidenceId} does not resolve.`,
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
  const stored = new Set(adrLinks.map(({ value }) => `${value.source_id}\0${value.target_id}`));
  for (const loaded of adrLinks) {
    if (stored.has(`${loaded.value.target_id}\0${loaded.value.source_id}`)) {
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

  const signatures = new Map(
    links.map((item) => [
      linkSignature(item.value.source_id, item.value.relation_type, item.value.target_id),
      item,
    ]),
  );
  for (const queue of snapshot.queues) {
    for (const id of queue.active_link_ids) {
      if (!linkById.has(id)) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Queue-declared active link ${id} does not resolve.`,
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
      const active = signatures.get(signature);
      if (mapping.mapping_status === "unresolved" && active) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_UNRESOLVED_ACTIVE",
            `Unresolved mapping ${mapping.mapping_id} is active as ${active.value.link_id}.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      }
      if (mapping.mapping_status.includes("active") && !active) {
        issues.push(
          issue(
            "interoperability",
            "INTEROP_ACTIVE_SET_MISMATCH",
            `Active queue mapping ${mapping.mapping_id} does not resolve to an active link.`,
            { object_id: mapping.mapping_id, file: queue.file },
          ),
        );
      }
    }
  }

  return gateResult("interoperability", issues);
}
