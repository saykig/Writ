# `@writ/provenance`

`@writ/provenance` is Writ's portable, domain-neutral provenance/evidence kernel. It implements
**Writ Canonical JSON v1**, content-addressed SHA-256, exact UTF-8 passage hashing, exact
source/document-version resolution against caller-supplied authority, evidence-reference
verification, and byte-sensitive logical-passage conflict detection.

The package supports Node.js 22 or newer and Bun 1.3 or newer. Its built ESM and declarations are
published through the package root export. It has no runtime dependencies beyond `node:crypto`.

## Public surface

Runtime exports:

- `canonicalJson` and `CanonicalJsonError`;
- `sha256Canonical` and `sha256Utf8Text`;
- `resolveSourceVersion` and `verifyEvidenceReferences`;
- `evidencePassageSignature` and `passageSignatureKey`;
- `resolveLogicalPassage` and `logicalPassageConflicts`.

Type-only exports:

- `CanonicalOptions` and `HashOptions`;
- `EvidenceReference` and `SourceVersionDeclaration`;
- `SourceVersionResolution`, `ProvenanceDiagnostic`, and `ProvenanceDiagnosticCode`;
- `PassageSignature`, `LogicalPassageOccurrence`, and `LogicalPassageResolution`.

`EvidenceReference` deliberately contains only the seven fields needed for provenance identity and
verification. Consumer-specific fields such as Writ assertion basis or Aldera lineage role may
extend that shape without becoming kernel semantics.

The authority passed to `resolveSourceVersion` or `verifyEvidenceReferences` is authoritative only
because the caller supplied it. The package does not decide corpus routing, source authorization,
review state, family semantics, or lineage.

## Writ Canonical JSON v1

The profile accepts the package's existing in-memory JSON value domain and applies these steps:

1. Omit any fields declared through `dropFields`, using RFC 6901 JSON Pointer paths (with the
   existing bare-top-level-key convenience).
2. NFC-normalize every string value and object key. Reject object keys that collide after NFC
   normalization.
3. Serialize without whitespace. Preserve array order and sort normalized object keys by UTF-16
   code unit.
4. Serialize literals and finite numbers using the existing ECMAScript-compatible behavior;
   reject non-finite numbers and serialize `-0` as `0`.
5. Encode the canonical text as UTF-8. `sha256Canonical` hashes those bytes and returns
   `sha256:<lowercase hexadecimal digest>`.

Whitespace removal, literal and number serialization, string escaping, recursive UTF-16 key
ordering, preserved array order, and UTF-8 output are derived from the
[RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html).

NFC normalization and pre-canonicalization `dropFields` omission are Writ-specific. RFC 8785
requires parsed Unicode strings to be preserved as-is and defines no equivalent omission step.
Consequently, Writ Canonical JSON v1 is deterministic but is **not** complete RFC 8785/JCS
conformance and must not be labelled as plain JCS.

The implementation also operates on JavaScript values rather than acting as a complete I-JSON
validator. In particular, its existing `JSON.stringify` behavior escapes lone surrogate code units
instead of rejecting them as RFC 8785 requires. That pre-existing edge case is documented here but
is not changed by the profile-naming cleanup.

Existing Writ canonical bytes and hashes remain defined by Writ Canonical JSON v1. Any behavioral
change requires a new profile identity and an explicit hash-migration decision.

Passage identity is separate: `sha256Utf8Text` hashes the exact UTF-8 quote bytes. It does not call
`canonicalJson`, normalize Unicode, trim whitespace, replace NBSP, or normalize quotation marks.

Keep public APIs small, versioned, and covered by deterministic golden tests.
