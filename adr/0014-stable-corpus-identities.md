# ADR 0014: Stable corpus identities

**Status:** Accepted

## Context

The combined EU-US pilot used spreadsheet-order identifiers such as `EU-06` and `US-09C`.
Those values are useful migration evidence but do not scale as permanent corpus identities:
they encode a particular review table's order, and they expose no stable distinction between
machine identity and a readable policy citation.

The reviewed migration input must remain exactly recoverable while the EU and US become
independent jurisdictional corpora.

## Decision

Every active source, passage, entity, claim, relationship, and imported review record has:

- `machine_id`: a deterministic UUIDv5;
- `ref`: a readable corpus reference;
- `display_ref`: a policy-readable label;
- `aliases`: alternate current references;
- `legacy_refs`: identifiers retired by this migration.

The namespace is:

`urn:uuid:6f806bca-a20b-5e2f-a445-6a15e6958ef4`

The derivation rule is:

`UUIDv5(namespace, "eu-us-ai-governance-v1:<record-kind>:<immutable-import-key>")`

Immutable import keys are the reviewed claim identifier for claims, the frozen document-version
identifier for sources, the frozen passage identifier for passages, the reviewed parent identifier
for imported reviews, and the two endpoint machine IDs plus relationship kind for relationships.
These inputs are migration coordinates, not mutable claim text, labels, conclusions, or source
content. Random UUIDs and wall-clock values are prohibited.

Readable references use lowercase kebab-case and preserve official article, memorandum, and
executive-order numbers. They never encode spreadsheet position, a research question, or a
conclusion. Readable references may later be superseded while `machine_id` remains stable; former
readable references then move to `aliases`.

All internal relationship endpoints are machine IDs. The old `EU-##` and `US-##` values remain
resolvable only through `legacy_refs` and the per-corpus migration maps.

## Consequences

- Machine identity survives citation-label improvements.
- Human references remain legible to policy researchers.
- The migration is deterministic and reproducible from the hash-pinned reviewed input.
- Legacy spreadsheet identifiers remain inspectable without governing active identity.
