import { assertWellFormedUnicode, sha256Utf8Text } from "./hash.js";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** A quotation and its caller-declared source, locator, and integrity hashes. */
export interface DeclaredTextReference {
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
  | {
      status: "invalid_identity";
      matches: [];
      fields: ("source_id" | "document_version_id")[];
    }
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

/** Error thrown when a declared-reference helper receives malformed input. */
export class DeclaredReferenceInputError extends Error {
  readonly code = "PROVENANCE_EVIDENCE_REFERENCE_INVALID";

  constructor() {
    super("declared text reference is malformed");
    this.name = "DeclaredReferenceInputError";
  }
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

/** Error thrown when a logical-passage identity is ill-formed Unicode. */
export class LogicalPassageIdentityError extends Error {
  readonly code = "PROVENANCE_LOGICAL_ID_INVALID";

  constructor(
    readonly field: "passageId" | "occurrenceId",
    readonly value: string,
  ) {
    super(`${field} must be a non-empty well-formed Unicode string`);
    this.name = "LogicalPassageIdentityError";
  }
}

/** Error thrown when a logical-passage signature is structurally invalid. */
export class LogicalPassageSignatureError extends Error {
  readonly code = "PROVENANCE_PASSAGE_SIGNATURE_INVALID";

  constructor() {
    super("passage signature is malformed");
    this.name = "LogicalPassageSignatureError";
  }
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const INVALID_PROPERTY = Symbol("invalid-property");

function ownDataProperty(value: object, key: string): unknown | typeof INVALID_PROPERTY {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : INVALID_PROPERTY;
  } catch {
    return INVALID_PROPERTY;
  }
}

function isWellFormedUnicode(value: string): boolean {
  try {
    assertWellFormedUnicode(value);
    return true;
  } catch {
    return false;
  }
}

function normalizedAuthorityDeclaration(value: unknown): SourceVersionDeclaration | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const sourceId = ownDataProperty(value, "source_id");
  const documentVersionId = ownDataProperty(value, "document_version_id");
  const documentHash = ownDataProperty(value, "document_hash");
  if (
    typeof sourceId !== "string" ||
    sourceId.length === 0 ||
    !isWellFormedUnicode(sourceId) ||
    typeof documentVersionId !== "string" ||
    documentVersionId.length === 0 ||
    !isWellFormedUnicode(documentVersionId) ||
    typeof documentHash !== "string" ||
    !SHA256_PATTERN.test(documentHash)
  ) {
    return undefined;
  }
  return {
    source_id: sourceId,
    document_version_id: documentVersionId,
    document_hash: documentHash,
  };
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
  for (const item of authority) {
    const declaration = normalizedAuthorityDeclaration(item);
    if (declaration === undefined) {
      invalidCount += 1;
      continue;
    }
    declarations.push(declaration);
  }
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
  const invalidIdentityFields = (
    [
      ["source_id", sourceId],
      ["document_version_id", documentVersionId],
    ] as const
  )
    .filter(
      ([, value]) => typeof value !== "string" || value.length === 0 || !isWellFormedUnicode(value),
    )
    .map(([field]) => field);
  if (invalidIdentityFields.length > 0) {
    return { status: "invalid_identity", matches: [], fields: invalidIdentityFields };
  }
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

/** Build the complete byte-sensitive signature for one declared reference. */
export function evidencePassageSignature(reference: DeclaredTextReference): PassageSignature {
  const normalized = normalizedReference(reference);
  if (normalized === undefined) throw new DeclaredReferenceInputError();
  return {
    source_id: normalized.source_id,
    document_version_id: normalized.document_version_id,
    locator: normalized.locator,
    quote: normalized.quote,
    passage_hash: normalized.passage_hash,
    document_hash: normalized.document_hash,
  };
}

/**
 * Serialize a passage signature without Writ Canonical JSON normalization.
 * Property order is constructed here; quote bytes remain distinct.
 */
export function passageSignatureKey(signature: PassageSignature): string {
  const normalized = normalizedPassageSignature(signature);
  if (normalized === undefined) throw new LogicalPassageSignatureError();
  for (const [field, value] of [
    ["source_id", normalized.source_id],
    ["document_version_id", normalized.document_version_id],
    ["locator", normalized.locator],
    ["quote", normalized.quote],
  ] as const) {
    assertWellFormedUnicode(value, field);
  }
  return JSON.stringify({
    source_id: normalized.source_id,
    document_version_id: normalized.document_version_id,
    locator: normalized.locator,
    quote: normalized.quote,
    passage_hash: normalized.passage_hash,
    document_hash: normalized.document_hash,
  });
}

function normalizedPassageSignature(value: unknown): PassageSignature | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const projection: Partial<Record<keyof PassageSignature, string>> = {};
  for (const key of [
    "source_id",
    "document_version_id",
    "locator",
    "quote",
    "passage_hash",
    "document_hash",
  ] as const) {
    const item = ownDataProperty(value, key);
    if (typeof item !== "string" || item.length === 0) return undefined;
    projection[key] = item;
  }
  if (!(
    SHA256_PATTERN.test(projection.passage_hash!) && SHA256_PATTERN.test(projection.document_hash!)
  )) {
    return undefined;
  }
  return projection as PassageSignature;
}

function sortOccurrences<T>(
  occurrences: readonly LogicalPassageOccurrence<T>[],
): LogicalPassageOccurrence<T>[] {
  const occurrenceIds = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    assertLogicalIdentity("passageId", occurrence.passageId);
    assertLogicalIdentity("occurrenceId", occurrence.occurrenceId);
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
  assertLogicalIdentity("passageId", passageId);
  const matching = sortOccurrences(occurrences).filter(
    (occurrence) => occurrence.passageId === passageId,
  );
  return resolutionFromOccurrences(passageId, matching);
}

function assertLogicalIdentity(field: "passageId" | "occurrenceId", value: string): void {
  if (typeof value !== "string" || value.length === 0 || !isWellFormedUnicode(value)) {
    throw new LogicalPassageIdentityError(field, value);
  }
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

function normalizedReference(value: unknown): DeclaredTextReference | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const projection: Partial<Record<keyof DeclaredTextReference, string>> = {};
  for (const key of [
    "source_id",
    "document_version_id",
    "passage_id",
    "locator",
    "quote",
    "passage_hash",
    "document_hash",
  ] as const) {
    const item = ownDataProperty(value, key);
    if (typeof item !== "string" || item.length === 0 || !isWellFormedUnicode(item)) {
      return undefined;
    }
    projection[key] = item;
  }
  if (!(
    SHA256_PATTERN.test(projection.passage_hash!) && SHA256_PATTERN.test(projection.document_hash!)
  )) {
    return undefined;
  }
  return projection as DeclaredTextReference;
}

function passageIdOf(value: unknown): string {
  if (value !== null && typeof value === "object") {
    const passageId = ownDataProperty(value, "passage_id");
    if (typeof passageId === "string" && isWellFormedUnicode(passageId)) return passageId;
  }
  return "";
}

function sourceDiagnostics(
  reference: DeclaredTextReference,
  authority: readonly SourceVersionDeclaration[],
): ProvenanceDiagnostic[] {
  const resolution = resolveSourceVersion(
    authority,
    reference.source_id,
    reference.document_version_id,
  );
  if (resolution.status === "invalid_authority" || resolution.status === "invalid_identity") {
    throw new Error("normalized declared-reference inputs must resolve without validation errors");
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
 * Verify declared fields and hashes against caller-supplied authority. The
 * input array does not establish a passage namespace; callers invoke
 * `logicalPassageConflicts` with an explicit scope for that policy. This
 * function does not decide whether the caller was authorized to supply those
 * declarations. It also does not inspect a document or prove that `quote`
 * occurs at `locator`; callers must establish that grounding separately.
 */
export function verifyEvidenceReferences(
  references: readonly unknown[],
  authority: readonly unknown[],
): ProvenanceDiagnostic[] {
  const diagnostics: ProvenanceDiagnostic[] = [];
  const normalized = normalizedAuthority(authority);
  if (normalized.invalidCount > 0) {
    diagnostics.push({
      code: "PROVENANCE_AUTHORITY_INVALID",
      passage_id: "",
      message: `Caller source authority contains ${normalized.invalidCount} malformed declaration${normalized.invalidCount === 1 ? "" : "s"}.`,
    });
  }

  for (const value of references) {
    const reference = normalizedReference(value);
    if (reference === undefined) {
      diagnostics.push({
        code: "PROVENANCE_EVIDENCE_REFERENCE_INVALID",
        passage_id: passageIdOf(value),
        message:
          "Evidence reference must declare non-empty source, document-version, passage, locator, quote, passage-hash, and document-hash fields with sha256 hashes.",
      });
      continue;
    }
    if (normalized.invalidCount === 0) {
      diagnostics.push(...sourceDiagnostics(reference, normalized.declarations));
    }
    const actualPassageHash = sha256Utf8Text(reference.quote);
    if (actualPassageHash !== reference.passage_hash) {
      diagnostics.push({
        code: "PROVENANCE_PASSAGE_HASH_MISMATCH",
        passage_id: reference.passage_id,
        message: `Evidence passage ${reference.passage_id} hashes to ${actualPassageHash}, not ${reference.passage_hash}.`,
      });
    }
  }

  return sortDiagnostics(diagnostics);
}
