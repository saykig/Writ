# Writ pre-merge verifier

`bun run verify:writ` is Writ's deterministic semantic/data merge gate. It reads the repository and
reports errors; it never rewrites corpora, regenerates files, infers links, repairs manifests or
approves judgments.

## Commands

```bash
bun run verify:ontology
bun run verify:interop
bun run verify:provenance
bun run verify:integrity
bun run verify:writ
```

The combined command exits `0` only when every gate passes. Issues carry stable codes and are sorted by
gate, code, corpus, object and file. Formatting, linting, unit tests, conformance and builds remain
separate engineering gates.

## Gates

- **Ontology** validates objects within their governing schema scope, resolves canonical approved
  institutional identities and applies the explicitly coded endpoint rules accepted in ADR 0019.
- **Interoperability** resolves active Core-link endpoints, owners, evidence and supporting records.
  Explicit migration queues under `docs/migrations/**/mapping-queue.yaml` are workflow history, not the
  canonical graph; unresolved candidates remain queue-only.
- **Provenance** verifies current native/Core evidence, human dispositions, supersession and declared
  identifier migrations. Compatibility formats continue through their authoritative schemas and
  existing adapters unless a bounded new semantic check is required.
- **Integrity** verifies catalogues, manifests, routed files, scoped counts, generated drift, the source
  registry and the repository's complete tracked-file checksum manifest.

## V1 native-source boundary

For compiled native records, V1 reconstructs resolvable evidence-passage and source-reference objects
from each record's compiled evidence envelope. Those reconstructed source references are not treated
as independently loaded publication, source-document or instrument objects, and therefore cannot
satisfy an ADR 0019 endpoint that declares one of those specific kinds. V1 does not independently
parse every source declaration in every `.writ` file. Existing pack validation, source-registry checks
and repository tests remain responsible for those declarations and stored-source integrity. Expanding
that boundary requires a bounded adapter backed by an existing contract, not a verifier-owned source
ontology.

## Authority and versions

The verifier indexes `$id` values from the authoritative `schemas/` tree. Core, extension, analysis
and compatibility schemas remain scoped contracts; their enums are never unioned into a verifier-owned
global vocabulary. Package schema copies, embedded schemas and TypeScript interfaces do not override
the authoritative source.

Adapters are selected by exact `(contract_id, declared_version)`. A missing schema identity is an
invalid contract. A recognized authoritative identity without an exact adapter reports
`VERIFIER_UNSUPPORTED_CONTRACT`; this says only that verified support is unavailable and makes no
claim that the version itself is valid or invalid. No semantic-version compatibility is inferred.

Every blocking invariant names an existing schema, accepted ADR, explicit canonical Core/domain
contract, scoped manifest/corpus contract or mechanical integrity requirement. ADR-backed rules are
implemented deliberately; the verifier does not interpret prose. A new invariant without existing
normative authority is a modeling preference and cannot block a merge. Conflicting normative sources
report `VERIFIER_AUTHORITY_CONFLICT` for human architectural review.

## Human review boundary

The verifier can establish that evidence resolves, endpoint kinds agree with an accepted contract and
the required human judgment exists. It cannot decide that a legal or policy interpretation is wise or
that quoted evidence substantively proves the reviewed claim. That remains a human decision.

## Extending verification

1. Establish or identify the governing schema, accepted ADR or scoped contract first.
2. Add an exact-version loader adapter only when the existing parser/validator cannot supply the
   required objects.
3. Implement the check explicitly and register its authority metadata.
4. Add a positive case and a deterministic negative fixture with the stable issue code.
5. If current repository state and normative authority genuinely conflict, stop for review; do not
   weaken the invariant or rewrite corpus content to make the gate pass.

Queue and migration adapters are workflow capabilities, not ontology. A malformed supported version
fails structurally; a recognizable future version reports `VERIFIER_UNSUPPORTED_CONTRACT`.
