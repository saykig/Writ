import { sha256Utf8Text } from "./hash.js";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Domain-neutral fields needed to identify and verify one evidence passage. */
export interface EvidenceReference {
  source_id: string;
  document_version_id: string;
  passage_id: string;
  locator: string;
  quote: string;
  passage_hash: string;
  document_hash: string;
}

/** One caller-supplied source/document-version authority declaration. */
export interface SourceVersionDeclaration {
  source_id: string;
  document_version_id: string;
  document_hash: string;
}

export type SourceVersionResolution =
  | { status: "missing_source"; matches: SourceVersionDeclaration[] }
  | { status: "version_mismatch"; matches: SourceVersionDeclaration[] }
  | { status: "ambiguous"; matches: SourceVersionDeclaration[] }
  | {
      status: "resolved";
      source: SourceVersionDeclaration;
      matches: SourceVersionDeclaration[];
    };

export type ProvenanceDiagnosticCode =
  | "PROVENANCE_EVIDENCE_REFERENCE_INVALID"
  | "PROVENANCE_SOURCE_NOT_FOUND"
  | "PROVENANCE_REFERENCE_AMBIGUOUS"
  | "PROVENANCE_SOURCE_MISMATCH"
  | "PROVENANCE_SOURCE_VERSION_MISMATCH"
  | "PROVENANCE_PASSAGE_CONFLICT"
  | "PROVENANCE_PASSAGE_HASH_MISMATCH";

export interface ProvenanceDiagnostic {
  code: ProvenanceDiagnosticCode;
  passage_id: string;
  message: string;
}

export interface PassageSignature {
  source_id: string;
  document_version_id: string;
  locator: string;
  quote: string;
  passage_hash: string;
  document_hash: string;
}

/** A logical passage occurrence plus caller-owned context. */
export interface LogicalPassageOccurrence<T = unknown> {
  passageId: string;
  signature: PassageSignature;
  occurrenceId: string;
  context: T;
}

export interface LogicalPassageResolution<T = unknown> {
  status: "missing" | "resolved" | "conflict";
  passageId: string;
  occurrences: LogicalPassageOccurrence<T>[];
  signatureKeys: string[];
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedAuthority(
  authority: readonly SourceVersionDeclaration[],
): SourceVersionDeclaration[] {
  return authority
    .filter(
      (item) =>
        typeof item?.source_id === "string" &&
        typeof item.document_version_id === "string" &&
        typeof item.document_hash === "string",
    )
    .map(({ source_id, document_version_id, document_hash }) => ({
      source_id,
      document_version_id,
      document_hash,
    }))
    .sort((left, right) =>
      compare(
        `${left.source_id}\0${left.document_version_id}\0${left.document_hash}`,
        `${right.source_id}\0${right.document_version_id}\0${right.document_hash}`,
      ),
    );
}

/** Resolve exactly one source and document version against caller-supplied authority. */
export function resolveSourceVersion(
  authority: readonly SourceVersionDeclaration[],
  sourceId: string,
  documentVersionId: string,
): SourceVersionResolution {
  const sourceMatches = normalizedAuthority(authority).filter(
    ({ source_id }) => source_id === sourceId,
  );
  if (sourceMatches.length === 0) return { status: "missing_source", matches: [] };

  const exact = sourceMatches.filter(
    ({ document_version_id }) => document_version_id === documentVersionId,
  );
  if (exact.length === 0) return { status: "version_mismatch", matches: sourceMatches };
  if (exact.length > 1) return { status: "ambiguous", matches: exact };
  return { status: "resolved", source: exact[0]!, matches: exact };
}

/** Build the complete byte-sensitive identity signature for a passage. */
export function evidencePassageSignature(reference: EvidenceReference): PassageSignature {
  return {
    source_id: reference.source_id,
    document_version_id: reference.document_version_id,
    locator: reference.locator,
    quote: reference.quote,
    passage_hash: reference.passage_hash,
    document_hash: reference.document_hash,
  };
}

/**
 * Serialize a passage signature without Writ Canonical JSON normalization.
 * Property order is constructed here; quote bytes remain distinct.
 */
export function passageSignatureKey(signature: PassageSignature): string {
  return JSON.stringify(signature);
}

function sortOccurrences<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
): LogicalPassageOccurrence<T>[] {
  return [...occurrences].sort((left, right) =>
    compare(
      `${left.passageId}\0${passageSignatureKey(left.signature)}\0${left.occurrenceId}`,
      `${right.passageId}\0${passageSignatureKey(right.signature)}\0${right.occurrenceId}`,
    ),
  );
}

/** Resolve an unqualified passage ID (or alias) by its complete signature. */
export function resolveLogicalPassage<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
  passageId: string,
): LogicalPassageResolution<T> {
  const matching = sortOccurrences(occurrences).filter(
    (occurrence) => occurrence.passageId === passageId,
  );
  const signatureKeys = [
    ...new Set(matching.map(({ signature }) => passageSignatureKey(signature))),
  ].sort(compare);
  return {
    status:
      matching.length === 0 ? "missing" : signatureKeys.length === 1 ? "resolved" : "conflict",
    passageId,
    occurrences: matching,
    signatureKeys,
  };
}

/** Return every conflicting passage identity in deterministic identifier order. */
export function logicalPassageConflicts<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
): LogicalPassageResolution<T>[] {
  const identifiers = new Set<string>();
  for (const occurrence of occurrences) identifiers.add(occurrence.passageId);
  return [...identifiers]
    .sort(compare)
    .map((passageId) => resolveLogicalPassage(occurrences, passageId))
    .filter((resolution) => resolution.status === "conflict");
}

function validReference(value: unknown): value is EvidenceReference {
  if (value === null || typeof value !== "object") return false;
  const reference = value as Record<string, unknown>;
  for (const key of [
    "source_id",
    "document_version_id",
    "passage_id",
    "locator",
    "quote",
    "passage_hash",
    "document_hash",
  ] as const) {
    if (typeof reference[key] !== "string" || reference[key].length === 0) return false;
  }
  return (
    SHA256_PATTERN.test(reference.passage_hash as string) &&
    SHA256_PATTERN.test(reference.document_hash as string)
  );
}

function passageIdOf(value: unknown): string {
  if (value !== null && typeof value === "object") {
    const passageId = (value as Record<string, unknown>).passage_id;
    if (typeof passageId === "string") return passageId;
  }
  return "";
}

function sourceDiagnostics(
  reference: EvidenceReference,
  authority: readonly SourceVersionDeclaration[],
): ProvenanceDiagnostic[] {
  const resolution = resolveSourceVersion(
    authority,
    reference.source_id,
    reference.document_version_id,
  );
  if (resolution.status === "missing_source") {
    return [
      {
        code: "PROVENANCE_SOURCE_NOT_FOUND",
        passage_id: reference.passage_id,
        message: `Evidence source ${reference.source_id} does not resolve to structured source metadata.`,
      },
    ];
  }
  if (resolution.status === "version_mismatch") {
    const versions = [
      ...new Set(resolution.matches.map(({ document_version_id }) => document_version_id)),
    ].sort(compare);
    return [
      {
        code: "PROVENANCE_SOURCE_VERSION_MISMATCH",
        passage_id: reference.passage_id,
        message: `Evidence source ${reference.source_id} has document version ${reference.document_version_id}, but structured source metadata declares ${versions.join(", ") || "no version identity"}.`,
      },
    ];
  }
  if (resolution.status === "ambiguous") {
    return [
      {
        code: "PROVENANCE_REFERENCE_AMBIGUOUS",
        passage_id: reference.passage_id,
        message: `Evidence source ${reference.source_id} and document version ${reference.document_version_id} resolve to ${resolution.matches.length} documents.`,
      },
    ];
  }
  return resolution.source.document_hash === reference.document_hash
    ? []
    : [
        {
          code: "PROVENANCE_SOURCE_MISMATCH",
          passage_id: reference.passage_id,
          message: `Evidence source ${reference.source_id} has document hash ${reference.document_hash}, but structured source metadata declares ${resolution.source.document_hash}.`,
        },
      ];
}

function sortDiagnostics(diagnostics: readonly ProvenanceDiagnostic[]): ProvenanceDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    compare(
      `${left.code}\0${left.passage_id}\0${left.message}`,
      `${right.code}\0${right.passage_id}\0${right.message}`,
    ),
  );
}

/**
 * Verify evidence against caller-supplied authority. This function does not
 * decide whether the caller was authorized to supply those declarations.
 */
export function verifyEvidenceReferences(
  references: readonly unknown[],
  authority: readonly SourceVersionDeclaration[],
): ProvenanceDiagnostic[] {
  const diagnostics: ProvenanceDiagnostic[] = [];
  const valid: EvidenceReference[] = [];

  for (const value of references) {
    if (!validReference(value)) {
      diagnostics.push({
        code: "PROVENANCE_EVIDENCE_REFERENCE_INVALID",
        passage_id: passageIdOf(value),
        message:
          "Evidence reference must declare non-empty source, document-version, passage, locator, quote, passage-hash, and document-hash fields with sha256 hashes.",
      });
      continue;
    }
    valid.push(value);
    diagnostics.push(...sourceDiagnostics(value, authority));
    const actualPassageHash = sha256Utf8Text(value.quote);
    if (actualPassageHash !== value.passage_hash) {
      diagnostics.push({
        code: "PROVENANCE_PASSAGE_HASH_MISMATCH",
        passage_id: value.passage_id,
        message: `Evidence passage ${value.passage_id} hashes to ${actualPassageHash}, not ${value.passage_hash}.`,
      });
    }
  }

  const occurrences = valid.map((reference) => ({
    passageId: reference.passage_id,
    signature: evidencePassageSignature(reference),
    occurrenceId: passageSignatureKey(evidencePassageSignature(reference)),
    context: reference,
  }));
  for (const conflict of logicalPassageConflicts(occurrences)) {
    diagnostics.push({
      code: "PROVENANCE_PASSAGE_CONFLICT",
      passage_id: conflict.passageId,
      message: `Passage ${conflict.passageId} has ${conflict.signatureKeys.length} distinct logical signatures.`,
    });
  }

  return sortDiagnostics(diagnostics);
}
