import { sha256Utf8Text } from "./hash.js";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Fields needed to identify and verify one anchored quotation from a source. */
export interface AnchoredTextEvidenceReference {
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
  | { status: "invalid_authority"; matches: []; invalidCount: number }
  | { status: "missing_source"; matches: SourceVersionDeclaration[] }
  | { status: "version_mismatch"; matches: SourceVersionDeclaration[] }
  | { status: "ambiguous"; matches: SourceVersionDeclaration[] }
  | {
      status: "resolved";
      source: SourceVersionDeclaration;
      matches: SourceVersionDeclaration[];
    };

export type ProvenanceDiagnosticCode =
  | "PROVENANCE_AUTHORITY_INVALID"
  | "PROVENANCE_EVIDENCE_REFERENCE_INVALID"
  | "PROVENANCE_SOURCE_NOT_FOUND"
  | "PROVENANCE_REFERENCE_AMBIGUOUS"
  | "PROVENANCE_SOURCE_MISMATCH"
  | "PROVENANCE_SOURCE_VERSION_MISMATCH"
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

/** Error thrown when one caller scope reuses an occurrence identity. */
export class LogicalPassageOccurrenceError extends Error {
  readonly code = "PROVENANCE_OCCURRENCE_ID_DUPLICATE";

  constructor(
    readonly passageId: string,
    readonly occurrenceId: string,
  ) {
    super(
      `logical passage ${JSON.stringify(passageId)} repeats occurrence ID ${JSON.stringify(occurrenceId)}`,
    );
    this.name = "LogicalPassageOccurrenceError";
  }
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validAuthorityDeclaration(value: unknown): value is SourceVersionDeclaration {
  if (value === null || typeof value !== "object") return false;
  const declaration = value as Record<string, unknown>;
  return (
    typeof declaration.source_id === "string" &&
    declaration.source_id.length > 0 &&
    typeof declaration.document_version_id === "string" &&
    declaration.document_version_id.length > 0 &&
    typeof declaration.document_hash === "string" &&
    SHA256_PATTERN.test(declaration.document_hash)
  );
}

function compareDeclarations(
  left: SourceVersionDeclaration,
  right: SourceVersionDeclaration,
): number {
  return (
    compare(left.source_id, right.source_id) ||
    compare(left.document_version_id, right.document_version_id) ||
    compare(left.document_hash, right.document_hash)
  );
}

function normalizedAuthority(authority: readonly unknown[]): {
  declarations: SourceVersionDeclaration[];
  invalidCount: number;
} {
  const declarations: SourceVersionDeclaration[] = [];
  let invalidCount = 0;
  authority.forEach((item) => {
    if (!validAuthorityDeclaration(item)) {
      invalidCount += 1;
      return;
    }
    declarations.push({
      source_id: item.source_id,
      document_version_id: item.document_version_id,
      document_hash: item.document_hash,
    });
  });
  declarations.sort(compareDeclarations);
  return { declarations, invalidCount };
}

/**
 * Resolve exactly one source and document version against well-formed,
 * caller-supplied authority. Identifiers are compared exactly.
 */
export function resolveSourceVersion(
  authority: readonly unknown[],
  sourceId: string,
  documentVersionId: string,
): SourceVersionResolution {
  const normalized = normalizedAuthority(authority);
  if (normalized.invalidCount > 0) {
    return {
      status: "invalid_authority",
      matches: [],
      invalidCount: normalized.invalidCount,
    };
  }
  const sourceMatches = normalized.declarations.filter(({ source_id }) => source_id === sourceId);
  if (sourceMatches.length === 0) return { status: "missing_source", matches: [] };

  const exact = sourceMatches.filter(
    ({ document_version_id }) => document_version_id === documentVersionId,
  );
  if (exact.length === 0) return { status: "version_mismatch", matches: sourceMatches };
  if (exact.length > 1) return { status: "ambiguous", matches: exact };
  return { status: "resolved", source: exact[0]!, matches: exact };
}

/** Build the complete byte-sensitive identity signature for anchored text. */
export function evidencePassageSignature(
  reference: AnchoredTextEvidenceReference,
): PassageSignature {
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
  return JSON.stringify({
    source_id: signature.source_id,
    document_version_id: signature.document_version_id,
    locator: signature.locator,
    quote: signature.quote,
    passage_hash: signature.passage_hash,
    document_hash: signature.document_hash,
  });
}

function sortOccurrences<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
): LogicalPassageOccurrence<T>[] {
  const occurrenceIds = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const ids = occurrenceIds.get(occurrence.passageId) ?? new Set<string>();
    if (ids.has(occurrence.occurrenceId)) {
      throw new LogicalPassageOccurrenceError(occurrence.passageId, occurrence.occurrenceId);
    }
    ids.add(occurrence.occurrenceId);
    occurrenceIds.set(occurrence.passageId, ids);
  }
  return [...occurrences].sort(
    (left, right) =>
      compare(left.passageId, right.passageId) ||
      compare(passageSignatureKey(left.signature), passageSignatureKey(right.signature)) ||
      compare(left.occurrenceId, right.occurrenceId),
  );
}

/** Resolve an unqualified passage ID by its complete signature. */
export function resolveLogicalPassage<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
  passageId: string,
): LogicalPassageResolution<T> {
  const matching = sortOccurrences(occurrences).filter(
    (occurrence) => occurrence.passageId === passageId,
  );
  return resolutionFromOccurrences(passageId, matching);
}

function resolutionFromOccurrences<T>(
  passageId: string,
  occurrences: LogicalPassageOccurrence<T>[],
): LogicalPassageResolution<T> {
  const signatureKeys = [
    ...new Set(occurrences.map(({ signature }) => passageSignatureKey(signature))),
  ].sort(compare);
  return {
    status:
      occurrences.length === 0 ? "missing" : signatureKeys.length === 1 ? "resolved" : "conflict",
    passageId,
    occurrences,
    signatureKeys,
  };
}

/** Return every conflicting passage identity in deterministic identifier order. */
export function logicalPassageConflicts<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
): LogicalPassageResolution<T>[] {
  const grouped = new Map<string, LogicalPassageOccurrence<T>[]>();
  for (const occurrence of sortOccurrences(occurrences)) {
    const matching = grouped.get(occurrence.passageId) ?? [];
    matching.push(occurrence);
    grouped.set(occurrence.passageId, matching);
  }
  return [...grouped.entries()]
    .map(([passageId, matching]) => resolutionFromOccurrences(passageId, matching))
    .filter((resolution) => resolution.status === "conflict");
}

function validReference(value: unknown): value is AnchoredTextEvidenceReference {
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
  if (!(
    SHA256_PATTERN.test(reference.passage_hash as string) &&
    SHA256_PATTERN.test(reference.document_hash as string)
  )) {
    return false;
  }
  try {
    sha256Utf8Text(reference.quote as string);
    return true;
  } catch {
    return false;
  }
}

function passageIdOf(value: unknown): string {
  if (value !== null && typeof value === "object") {
    const passageId = (value as Record<string, unknown>).passage_id;
    if (typeof passageId === "string") return passageId;
  }
  return "";
}

function sourceDiagnostics(
  reference: AnchoredTextEvidenceReference,
  authority: readonly unknown[],
): ProvenanceDiagnostic[] {
  const resolution = resolveSourceVersion(
    authority,
    reference.source_id,
    reference.document_version_id,
  );
  if (resolution.status === "invalid_authority") {
    return [
      {
        code: "PROVENANCE_AUTHORITY_INVALID",
        passage_id: reference.passage_id,
        message: `Caller source authority contains ${resolution.invalidCount} malformed declaration${resolution.invalidCount === 1 ? "" : "s"}.`,
      },
    ];
  }
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
 * Verify each anchored-text reference against caller-supplied authority. The
 * input array does not establish a passage namespace; callers invoke
 * `logicalPassageConflicts` with an explicit scope for that policy. This
 * function does not decide whether the caller was authorized to supply those
 * declarations.
 */
export function verifyEvidenceReferences(
  references: readonly unknown[],
  authority: readonly unknown[],
): ProvenanceDiagnostic[] {
  const diagnostics: ProvenanceDiagnostic[] = [];

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

  return sortDiagnostics(diagnostics);
}
