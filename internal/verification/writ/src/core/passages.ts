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
    adapterKind: "reviewed_compatibility_passage",
  };
}

/**
 * Index each unqualified Core passage identity by its complete evidence
 * signature. Evidence basis is deliberately excluded from identity.
 */
export function logicalPassageOccurrences(
  snapshot: RepositorySnapshot,
): LogicalPassageOccurrence[] {
  const reviewedCompatibilityPassageFiles = new Set(
    snapshot.documents
      .filter(
        (document) =>
          document.category === "passages" &&
          document.governing_contract.adapter_kind === "reviewed_compatibility_document",
      )
      .map(({ file }) => file),
  );
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
  for (const object of snapshot.objects) {
    if (
      object.kind !== "passage" ||
      typeof object.value.source_id === "string" ||
      !reviewedCompatibilityPassageFiles.has(object.file)
    )
      continue;
    const occurrence = structuredPassageOccurrence(snapshot, object);
    if (occurrence) occurrences.push(occurrence);
  }

  return occurrences.sort((left, right) => {
    const leftKey = `${left.passageId}\0${left.signatureKey}\0${left.corpusId}\0${left.objectId}\0${left.file}`;
    const rightKey = `${right.passageId}\0${right.signatureKey}\0${right.corpusId}\0${right.objectId}\0${right.file}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function resolution(
  passageId: string,
  occurrences: LogicalPassageOccurrence[],
): LogicalPassageResolution {
  const signatureKeys = [...new Set(occurrences.map(({ signatureKey }) => signatureKey))].sort();
  return {
    status:
      occurrences.length === 0 ? "missing" : signatureKeys.length === 1 ? "resolved" : "conflict",
    passageId,
    occurrences,
    signatureKeys,
  };
}

function addOccurrence(
  index: Map<string, LogicalPassageOccurrence[]>,
  identifier: string,
  occurrence: LogicalPassageOccurrence,
): void {
  const current = index.get(identifier);
  if (current) current.push(occurrence);
  else index.set(identifier, [occurrence]);
}

/** Build one deterministic passage index for all lookups performed by a gate. */
export function buildLogicalPassageIndex(snapshot: RepositorySnapshot): LogicalPassageIndex {
  const occurrences = logicalPassageOccurrences(snapshot);
  const all = new Map<string, LogicalPassageOccurrence[]>();
  const currentNative = new Map<string, LogicalPassageOccurrence[]>();
  for (const occurrence of occurrences) {
    for (const identifier of [occurrence.passageId, ...occurrence.aliases]) {
      addOccurrence(all, identifier, occurrence);
      if (occurrence.adapterKind === "current_native_core") {
        addOccurrence(currentNative, identifier, occurrence);
      }
    }
  }
  return {
    occurrences,
    resolve(passageId) {
      return resolution(passageId, all.get(passageId) ?? []);
    },
    currentNativeConflicts() {
      return [...currentNative]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([passageId, matches]) => resolution(passageId, matches))
        .filter(({ status }) => status === "conflict");
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
