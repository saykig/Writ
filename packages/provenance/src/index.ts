// Public surface of @writ/provenance.
//
// Writ Canonical JSON v1 + SHA-256 content-addressed hashing. The profile reuses
// JCS serialization rules but adds NFC normalization and declared field omission,
// so the complete algorithm is not plain RFC 8785/JCS.
export { canonicalJson, CanonicalJsonError, type CanonicalOptions } from "./canonical-json.js";

export {
  evidencePassageSignature,
  logicalPassageConflicts,
  passageSignatureKey,
  resolveLogicalPassage,
  resolveSourceVersion,
  verifyEvidenceReferences,
  LogicalPassageOccurrenceError,
  type AnchoredTextEvidenceReference,
  type LogicalPassageOccurrence,
  type LogicalPassageResolution,
  type PassageSignature,
  type ProvenanceDiagnostic,
  type ProvenanceDiagnosticCode,
  type SourceVersionDeclaration,
  type SourceVersionResolution,
} from "./evidence.js";

export {
  IllFormedUnicodeError,
  sha256Canonical,
  sha256Utf8Text,
  type HashOptions,
} from "./hash.js";
