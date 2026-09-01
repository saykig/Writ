import {
  evidencePassageSignature,
  logicalPassageConflicts as portablePassageConflicts,
  passageSignatureKey,
  resolveLogicalPassage as resolvePortablePassage,
  type EvidenceReference,
  type LogicalPassageOccurrence as PortablePassageOccurrence,
  type LogicalPassageResolution as PortablePassageResolution,
  type PassageSignature,
} from "@writ/provenance";

import type { IndexedObject, RepositorySnapshot } from "../types.js";
import { resolveRoutedSource } from "./sources.js";

export type { PassageSignature } from "@writ/provenance";
export { passageSignatureKey } from "@writ/provenance";

export interface LogicalPassageOccurrence {
  passageId: string;
  aliases: string[];
  signature: PassageSignature;
  signatureKey: string;
  corpusId: string;
  objectId: string;
  file: string;
  adapterKind: "current_native_core" | "reviewed_compatibility_passage";
}

export interface LogicalPassageResolution {
  status: "missing" | "resolved" | "conflict";
  passageId: string;
  occurrences: LogicalPassageOccurrence[];
  signatureKeys: string[];
}

export interface LogicalPassageIndex {
  occurrences: LogicalPassageOccurrence[];
  resolve(passageId: string): LogicalPassageResolution;
  currentNativeConflicts(): LogicalPassageResolution[];
}

export function corePassageSignature(evidence: EvidenceReference): PassageSignature {
  return evidencePassageSignature(evidence);
}

function sourceHash(value: Record<string, unknown>): string | undefined {
  return typeof value.document_hash === "string"
    ? value.document_hash
    : typeof value.sha256 === "string"
      ? value.sha256
      : undefined;
}

function structuredLocator(value: Record<string, unknown>): string | undefined {
  for (const key of ["locator", "dom_path", "json_pointer"] as const) {
    if (typeof value[key] === "string") return value[key];
  }
  return typeof value.page_number === "number" ? String(value.page_number) : undefined;
}

function structuredPassageOccurrence(
  snapshot: RepositorySnapshot,
  object: IndexedObject,
): LogicalPassageOccurrence | undefined {
  const value = object.value;
  const sourceId = value.source_machine_id;
  const quote = value.quote;
  const passageHash = value.anchor_hash;
  const locator = structuredLocator(value);
  if (
    typeof sourceId !== "string" ||
    typeof quote !== "string" ||
    typeof passageHash !== "string" ||
    locator === undefined
  )
    return undefined;

  const resolved = resolveRoutedSource(snapshot, object.corpus_id, sourceId);
  if (resolved.status !== "resolved") return undefined;
  const source = resolved.source;
  const documentHash = sourceHash(source.value);
  const documentVersionId =
    resolved.compatibilityVersion ??
    (typeof source.value.document_version_id === "string"
      ? source.value.document_version_id
      : source.value.record_type === "source_document_version"
        ? source.id
        : undefined);
  if (documentHash === undefined || documentVersionId === undefined) return undefined;

  const signature = {
    source_id: sourceId,
    document_version_id: documentVersionId,
    locator,
    quote,
    passage_hash: passageHash,
    document_hash: documentHash,
  };
  return {
    passageId: object.id,
    aliases: object.aliases,
    signature,
    signatureKey: passageSignatureKey(signature),
    corpusId: object.corpus_id,
    objectId: object.id,
    file: object.file,
    adapterKind: "reviewed_compatibility_passage",
  };
}

export function reviewedCompatibilityPassageObjects(snapshot: RepositorySnapshot): IndexedObject[] {
  const files = new Set(
    snapshot.documents
      .filter(
        (document) =>
          document.category === "passages" &&
          document.governing_contract.adapter_kind === "reviewed_compatibility_document",
      )
      .map(({ file }) => file),
  );
  return snapshot.objects.filter(
    (object) =>
      object.kind === "passage" &&
      typeof object.value.source_id !== "string" &&
      files.has(object.file),
  );
}

/**
 * Index each unqualified Core passage identity by its complete evidence
 * signature. Evidence basis is deliberately excluded from identity.
 */
export function logicalPassageOccurrences(
  snapshot: RepositorySnapshot,
): LogicalPassageOccurrence[] {
  const occurrences: LogicalPassageOccurrence[] = snapshot.records
    .filter(({ governing_contract }) => governing_contract.verifies_core_provenance)
    .flatMap((loaded) =>
      loaded.value.evidence.map((evidence) => {
        const signature = corePassageSignature(evidence);
        return {
          passageId: evidence.passage_id,
          aliases: [],
          signature,
          signatureKey: passageSignatureKey(signature),
          corpusId: loaded.corpus_id,
          objectId: loaded.value.record_id,
          file: loaded.file,
          adapterKind: "current_native_core" as const,
        };
      }),
    );

  // Frozen compiled compatibility records retain their historical adapter and
  // do not acquire current-native Core provenance semantics. The reviewed
  // compatibility passage adapter remains a bounded resolution input because
  // current Core links and judgments already cite those preserved passages.
  for (const object of reviewedCompatibilityPassageObjects(snapshot)) {
    const occurrence = structuredPassageOccurrence(snapshot, object);
    if (occurrence) occurrences.push(occurrence);
  }

  return occurrences.sort((left, right) => {
    const leftKey = `${left.passageId}\0${left.signatureKey}\0${left.corpusId}\0${left.objectId}\0${left.file}`;
    const rightKey = `${right.passageId}\0${right.signatureKey}\0${right.corpusId}\0${right.objectId}\0${right.file}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function portableOccurrences(
  occurrences: readonly LogicalPassageOccurrence[],
): Array<PortablePassageOccurrence<LogicalPassageOccurrence>> {
  return occurrences.flatMap((occurrence) =>
    [occurrence.passageId, ...occurrence.aliases].map((passageId) => ({
      passageId,
      signature: occurrence.signature,
      occurrenceId: `${occurrence.corpusId}\0${occurrence.objectId}\0${occurrence.file}`,
      context: occurrence,
    })),
  );
}

function repositoryResolution(
  resolution: PortablePassageResolution<LogicalPassageOccurrence>,
): LogicalPassageResolution {
  return {
    ...resolution,
    occurrences: resolution.occurrences.map(({ context }) => context),
  };
}

/** Build one deterministic passage index for all lookups performed by a gate. */
export function buildLogicalPassageIndex(snapshot: RepositorySnapshot): LogicalPassageIndex {
  const occurrences = logicalPassageOccurrences(snapshot);
  const all = portableOccurrences(occurrences);
  const currentNative = portableOccurrences(
    occurrences.filter(({ adapterKind }) => adapterKind === "current_native_core"),
  );
  return {
    occurrences,
    resolve(passageId) {
      return repositoryResolution(resolvePortablePassage(all, passageId));
    },
    currentNativeConflicts() {
      return portablePassageConflicts(currentNative).map(repositoryResolution);
    },
  };
}

export function resolveLogicalPassage(
  snapshot: RepositorySnapshot,
  passageId: string,
): LogicalPassageResolution {
  return buildLogicalPassageIndex(snapshot).resolve(passageId);
}

export function logicalPassageConflicts(snapshot: RepositorySnapshot): LogicalPassageResolution[] {
  return buildLogicalPassageIndex(snapshot).currentNativeConflicts();
}
