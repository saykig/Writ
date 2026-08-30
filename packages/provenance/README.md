# `@writ/provenance`

`@writ/provenance` implements **Writ Canonical JSON v1** and content-addressed SHA-256 hashing for
provenance-bearing records and bundles.

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

Keep public APIs small, versioned, and covered by deterministic golden tests.
