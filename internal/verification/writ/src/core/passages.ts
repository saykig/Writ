import type { WritRecord } from "@writ/domain";

import type { IndexedObject, RepositorySnapshot } from "../types.js";

export interface PassageSignature {
  source_id: string;
  document_version_id: string;
  locator: string;
  quote: string;
  passage_hash: string;
  document_hash: string;
}

export interface LogicalPassageOccurrence {
  passageId: string;
  aliases: string[];
  signature: PassageSignature;
  signatureKey: string;
  corpusId: string;
  objectId: string;
  file: string;
}

export interface LogicalPassageResolution {
  status: "missing" | "resolved" | "conflict";
  passageId: string;
  occurrences: LogicalPassageOccurrence[];
  signatureKeys: string[];
}

type Evidence = WritRecord["evidence"][number];

export function corePassageSignature(evidence: Evidence): PassageSignature {
  return {
    source_id: evidence.source_id,
    document_version_id: evidence.document_version_id,
    locator: evidence.locator,
    quote: evidence.quote,
    passage_hash: evidence.passage_hash,
    document_hash: evidence.document_hash,
  };
}

export function passageSignatureKey(signature: PassageSignature): string {
  return JSON.stringify(signature);
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

  const sources = snapshot.objects.filter(
    (candidate) =>
      (candidate.kind === "source_document" || candidate.kind === "source") &&
      (candidate.id === sourceId || candidate.aliases.includes(sourceId)),
  );
  if (sources.length !== 1) return undefined;
  const source = sources[0]!;
  const documentHash = sourceHash(source.value);
  const documentVersionId =
    typeof source.value.document_version_id === "string"
      ? source.value.document_version_id
      : source.value.record_type === "source_document_version"
        ? source.id
        : undefined;
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
  };
}

/**
 * Index each unqualified Core passage identity by its complete evidence
 * signature. Evidence basis is deliberately excluded from identity.
 */
export function logicalPassageOccurrences(
  snapshot: RepositorySnapshot,
): LogicalPassageOccurrence[] {
  const occurrences: LogicalPassageOccurrence[] = snapshot.records.flatMap((loaded) =>
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
      };
    }),
  );

  // Compiled record evidence is indexed above without physical-file
  // deduplication. Add only separately stored compatibility passages here.
  for (const object of snapshot.objects) {
    if (object.kind !== "passage" || typeof object.value.source_id === "string") continue;
    const occurrence = structuredPassageOccurrence(snapshot, object);
    if (occurrence) occurrences.push(occurrence);
  }

  return occurrences.sort((left, right) => {
    const leftKey = `${left.passageId}\0${left.signatureKey}\0${left.corpusId}\0${left.objectId}\0${left.file}`;
    const rightKey = `${right.passageId}\0${right.signatureKey}\0${right.corpusId}\0${right.objectId}\0${right.file}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export function resolveLogicalPassage(
  snapshot: RepositorySnapshot,
  passageId: string,
): LogicalPassageResolution {
  const occurrences = logicalPassageOccurrences(snapshot).filter(
    (occurrence) => occurrence.passageId === passageId || occurrence.aliases.includes(passageId),
  );
  const signatureKeys = [...new Set(occurrences.map(({ signatureKey }) => signatureKey))].sort();
  return {
    status:
      occurrences.length === 0 ? "missing" : signatureKeys.length === 1 ? "resolved" : "conflict",
    passageId,
    occurrences,
    signatureKeys,
  };
}

export function logicalPassageConflicts(snapshot: RepositorySnapshot): LogicalPassageResolution[] {
  const identifiers = new Set<string>();
  for (const occurrence of logicalPassageOccurrences(snapshot)) {
    identifiers.add(occurrence.passageId);
    for (const alias of occurrence.aliases) identifiers.add(alias);
  }
  return [...identifiers]
    .sort()
    .map((passageId) => resolveLogicalPassage(snapshot, passageId))
    .filter((resolution) => resolution.status === "conflict");
}
