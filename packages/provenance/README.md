# `@writ/provenance`

`@writ/provenance` is Writ's portable mechanical provenance kernel. It implements **Writ
Canonical JSON v1**, content-addressed SHA-256, exact UTF-8 text hashing, exact
source/document-version resolution against caller-supplied authority, declared-reference integrity
verification, and byte-sensitive conflict detection within an explicit caller-defined logical
passage scope.

The package supports Node.js 22 or newer and Bun 1.3 or newer. Its built ESM and declarations are
available through the package root export in a packed tarball. The package remains private; remote
publication is outside this boundary. The root export has no runtime dependencies beyond `node:crypto`.
Version 0.2.0 adds exact review-artifact byte association and the separate, opt-in
`@writ/provenance/repository` filesystem adapter, which also uses `node:fs` and `node:path`.

## Public surface

Runtime exports:

- `canonicalJson`, `CanonicalJsonError`, and `sha256Canonical`;
- `sha256Utf8Text`, `sha256Bytes`, and `IllFormedUnicodeError`;
- `isReviewArtifactPath` and `verifyReviewArtifact`;
- `resolveSourceVersion` and `verifyEvidenceReferences`;
- `evidencePassageSignature`, `passageSignatureKey`, and `DeclaredReferenceInputError`;
- `resolveLogicalPassage`, `logicalPassageConflicts`, `LogicalPassageOccurrenceError`, and
  `LogicalPassageIdentityError`, and `LogicalPassageSignatureError`.

Type-only exports:

- `CanonicalOptions` and `HashOptions`;
- `DeclaredTextReference` and `SourceVersionDeclaration`;
- `SourceVersionResolution`, `ProvenanceDiagnostic`, and `ProvenanceDiagnosticCode`;
- `PassageSignature`, `LogicalPassageOccurrence`, and `LogicalPassageResolution`.
- `ReviewArtifactBinding`, `ReviewArtifactDiagnostic`, `ReviewArtifactDiagnosticCode`, and
  `ReviewArtifactVerification`.

## Exact review-artifact association

`verifyReviewArtifact({ path, content_hash }, bytes?)` checks one declared canonical
repository-relative locator and a `sha256:<64 lowercase hex>` identity against caller-supplied
`Uint8Array` bytes. It returns `verified`, `invalid` with stable diagnostics, or `unavailable` when
the caller supplies no bytes. Hashing never decodes text, canonicalizes JSON, or normalizes Unicode
or line endings. Empty bytes are valid content when their hash matches; this does not establish
that the artifact contains a review. A missing binding declares no association and does not imply
that a judgment is fabricated, invalid, machine-generated, or non-human.

The binding is one exact plain object with only `path` and `content_hash`. Absolute paths, empty,
`.` and `..` segments, repeated separators, backslashes, percent signs, colons and ASCII controls
are invalid instead of being normalized. The path remains independent of its content hash. A copy
at another valid declared repository path is a different locator with potentially identical bytes.
The kernel makes no authorization decision about the content of that path.

The opt-in `readRepositoryReviewArtifact(root, binding, { judgmentPath })` adapter reads a regular
file only at its exact stored repository path. It rejects missing files, all symlink components,
case/path aliases, escapes and a locator equal to the judgment's own containing source path.
It returns exact bytes only after the same pure checker verifies their hash. The selected root is
the whole governed location. Repository verification and ordinary export call this same adapter;
portable consumers call the pure checker on decoded exported bytes. Filesystem reads assume frozen
inputs, as the rest of deterministic repository verification does.

These operations establish content association only. They do not authenticate authorship, compare
the judgment with the artifact's meaning, determine evidentiary sufficiency, approve a judgment,
or alter its target. Another review, an extraction report or even an empty file can have valid byte
identity. Human review remains responsible for choosing the appropriate artifact and comparing
semantics. Self-reference rejection requires the repository caller's source-path context; the pure
byte checker cannot infer where its input judgment was stored.

`DeclaredTextReference` names the seven-field declaration without claiming document grounding. The
kernel proves that the quote matches its declared passage hash and that the declared source,
document version, and document hash match caller-supplied authority. It does **not** open the
referenced document, interpret the locator, or prove that the quote bytes occur there. The caller
must prove the document-to-locator-to-quote transition separately. Consumer-specific fields such as
Writ assertion basis or Aldera lineage role may extend the shape without becoming kernel semantics.
The type does not model extraction, table cells, dataset rows, spreadsheets, images, attachments,
maps, machine outputs, or documented negative searches.

The authority passed to `resolveSourceVersion` or `verifyEvidenceReferences` is authoritative only
because the caller supplied it. Every declaration must have non-empty exact source/version IDs and
a lowercase SHA-256 document hash; one malformed declaration makes the complete authority input
invalid rather than being silently filtered, including when no valid reference reaches resolution.
Required fields must be own data properties; accessors are invalid and are never invoked. Extension
fields are allowed and ignored. The package does not decide corpus routing, authority legitimacy,
source authorization, review state, family semantics, or lineage.

`verifyEvidenceReferences` checks each supplied reference independently. It deliberately does not
declare its input array to be a passage namespace. A caller defines a logical-passage scope by
supplying occurrences to `resolveLogicalPassage` or `logicalPassageConflicts`; occurrence IDs must
be non-empty and unique within each non-empty passage ID. Passage signatures require non-empty
source/version/locator/quote fields and lowercase SHA-256 passage/document hashes; malformed or
accessor-backed required fields fail with a typed error and can never resolve. This keeps Writ's
repository-specific native/compatibility scope in Writ's adapter and leaves the repository-global
external passage namespace unresolved.

## Writ Canonical JSON v1

The profile accepts the package's existing in-memory JSON value domain and applies these steps:

1. Omit any fields declared through `dropFields`, using RFC 6901 JSON Pointer paths (with the
   existing bare-top-level-key convenience). Pointers address Writ's NFC-normalized key space, so
   `/café` also addresses an input key spelled `cafe\u0301`. Leading-slash pointers must use valid
   `~0` and `~1` escapes; malformed escapes fail closed. The empty RFC root pointer is rejected
   because the profile cannot omit its complete input, while `/` addresses a top-level empty key.
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

The accepted in-memory domain is `null`, booleans, finite numbers, strings, ordinary arrays, and
plain objects (including null-prototype objects). `undefined`, including an undefined-valued object
property, is rejected rather than silently omitted. Runtime objects such as Date, Map, Set, RegExp,
boxed primitives, class instances, and custom-prototype objects are not JSON data and throw
`CanonicalJsonError`. Symbol, non-enumerable, accessor, sparse-array, and named-array properties are
also outside the plain-data contract; cycles and nesting beyond 512 levels throw that bounded typed
error.
Within canonical string values, the historical `JSON.stringify` behavior still escapes lone
surrogate code units. Changing that pre-existing canonical profile edge would require migration.

Existing Writ canonical bytes and hashes remain defined by Writ Canonical JSON v1. `dropFields` is
a caller-selected Writ identity-profile transform, not generic object equality: an object hashed
with `/decision` omitted can intentionally equal an object that never had `decision`. A consumer
must use one specified omission profile consistently. Any change to unaffected historical bytes or
hashes requires a new profile identity and an explicit hash-migration decision.

Numbers retain Writ v1's in-memory ECMAScript `number` semantics. JSON integer spellings beyond the
IEEE-754 safe-integer range can parse to the same in-memory number and therefore the same canonical
identity. Consumers that require exact quantities must use an explicit exact representation, not
assume that `sha256Canonical` preserves the spelling or arbitrary precision of source JSON.
`sha256Canonical` identifies the in-memory Writ value under a selected Writ identity profile. It
must not substitute for hashing the raw bytes of a PDF, HTML page, source JSON file, or other source
document.

Exact-text identity is separate: `sha256Utf8Text` hashes exact valid UTF-8 text. It does not call
`canonicalJson`, normalize Unicode, trim whitespace, replace NBSP, normalize line endings, or
normalize quotation marks. Because JavaScript UTF-8 encoders otherwise replace lone surrogates,
ill-formed UTF-16 strings throw `IllFormedUnicodeError`; a valid literal U+FFFD remains hashable.

Source IDs, document-version IDs, passage IDs, locators, logical passage IDs, occurrence IDs, and
quotes remain exact strings. The portable identity contracts reject lone surrogates but do not
normalize valid strings; NFC and NFD spellings therefore remain distinct. Writ Canonical JSON
normalizes object string values, so equality of two `sha256Canonical` results must never be used as
an identifier-equivalence oracle.

These mechanics establish neither document grounding, evidentiary support, nor truth. A valid
declared-reference result does not prove that quoted bytes occur at the locator. Even separately
grounded text does not decide whether a passage supports a claim, an inference is defensible, a
relationship is accepted, or a decision was warranted. Those proofs and judgments belong to caller
layers above this package.

Keep public APIs small, versioned, and covered by deterministic golden tests.
