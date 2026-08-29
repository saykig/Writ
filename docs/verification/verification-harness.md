# Writ Verification Harness

`bun run verify:writ` runs Writ's deterministic, authority-traced verification instrument. It reads
a verification workspace—the Writ repository state being checked—and reports findings; it never
rewrites corpora, regenerates files, infers links, repairs manifests, approves judgments, or decides
whether a change should be accepted or merged.

## Result meaning

`PASS` means only that, under the authoritative contracts and exact adapters the harness supports,
the selected dimensions found no machine-detectable incompatibilities. It does not establish truth,
legal or political correctness, evidentiary sufficiency, completeness, human approval, acceptance,
or whether a change should be merged.

`FAIL` means findings exist. The process exits non-zero so automation can surface those findings; the
result itself does not forbid acceptance or merging. Human review determines acceptance.

## Commands

```bash
bun run verify:ontology
bun run verify:interop
bun run verify:provenance
bun run verify:integrity
bun run verify:writ
```

Normally the verification workspace is the current Writ repository. To select the filesystem path of
an alternate existing Writ-compatible verification workspace, use `--root`:

```bash
bun run verify:writ -- --root <workspace>
```

The caller creates and manages an alternate verification workspace; the harness does not create,
clean or mutate one. Full integrity verification expects the verification workspace to be a Git
worktree because existing checksum and generated-drift checks use Git inventory.

For deterministic machine-readable output:

```bash
bun run verify:writ -- --format json
bun run verify:writ -- --root <workspace> --format json
```

JSON output has stable top-level `status`, `gates`, `issues` and `summary` fields. It contains no
timestamp, random value or host-specific absolute path. Issues remain deterministically sorted and
include their registered authority context when available. Identical input and options produce
byte-identical output.

The human-readable result ends with:

```text
VERIFICATION RESULT: PASS
Human review determines acceptance.
```

## Candidate workflow

1. Prepare candidate material in a Writ-compatible verification workspace.
2. Run `bun run verify:writ -- --root <workspace>`.
3. Inspect ontology, interoperability, provenance and integrity findings.
4. Fix machine-detectable problems or document unsupported or contested cases.
5. A human reviewer decides whether and how the material enters Writ.

## Verification dimensions

- **Ontology** reconciles the active catalog and manifest family declarations.
- **Interoperability** resolves active Core-link endpoints, owners, evidence and supporting records.
  For every relation type, `source_kind` and `target_kind` must mechanically match the resolved
  endpoint objects; `INTEROP_DECLARED_KIND_MISMATCH` reports a mismatch. This check does not assign
  relation-specific endpoint semantics or restore the retired ADR-0019 rule pack.
  It covers retained catalogued links under generic Core contracts without reactivating the
  specialized ADR-0019 workflow rule pack.
- **Provenance** verifies current native institutional source and passage resolution, quotation and
  document hashes, local fact-payload evidence references, repeated passage consistency, judgment
  targets and evidence, judgment supersession, and declared identifier migrations.
- **Integrity** verifies catalogues, manifests, routed files, scoped counts, source-registry drift and
  the repository's complete tracked-file checksum manifest.

Judgment count reconciliation retains the repository's existing manifest contract. V1 does not
redefine whether historical or superseded judgments belong in a declared count; changing that
contract requires a separate normative decision.

## Kernel, adapters and rule packs

The stable kernel selects dimensions, orchestrates rule execution and renders results. It has no
closed corpus-family vocabulary. Current Writ adapters load the exact `(contract_id,
declared_version)` pairs supported today. No migration-workflow adapter is currently registered;
historical workflow artifacts are not active verifier inputs.

The harness indexes `$id` values from the authoritative `schemas/` tree. Core, extension, analysis
and compatibility schemas remain scoped contracts; their enums are never unioned into a harness-owned
global vocabulary. Package schema copies, embedded schemas and TypeScript interfaces do not override
the authoritative source.

Adapters describe capability, not ontology. A missing schema identity is an invalid contract. A
recognized authoritative identity without an exact adapter reports `VERIFIER_UNSUPPORTED_CONTRACT`;
this says only that verified support is unavailable and makes no claim that the version itself is
valid or invalid. No semantic-version compatibility is inferred.

## Native-source boundary

For compiled native records, the harness reconstructs evidence passages from each record's compiled
evidence envelope and parses manifest-routed `.writ` source declarations as independent structured
source documents. Native institutional evidence must resolve by its declared source identity and
match both its document hash and explicitly declared document-version identity. A matching hash
cannot rescue an incorrect native source ID. Retained compatibility material resolves only through
identities declared by its compatibility contract; there is no repository-wide hash fallback.
Repeated passage IDs within one corpus must preserve identical source, version, locator, quotation
and hashes, and quotation bytes must reproduce the passage hash.

`document_version_id` is an opaque stable identity for the declared natural version, retrieval
snapshot or content-derived version. Verification requires exact equality with structured source
metadata and never derives, normalizes or interprets an identifier from its spelling or a date.

This is reference and byte consistency, not source interpretation. The harness does not decide
whether a passage semantically warrants a fact type, independently authenticate a retired web page,
or introduce a global source ontology.

## Extending verification

1. Establish or identify the governing schema, accepted ADR or scoped contract first.
2. Add an exact-version loader adapter only when the existing parser or validator cannot supply the
   required objects.
3. Implement any ADR-backed constraint explicitly in a scoped rule pack and register its authority
   metadata.
4. Add a positive case and a deterministic negative fixture with the stable issue code.
5. If current repository state and normative authority genuinely conflict, stop for review; do not
   weaken the invariant or rewrite corpus content to obtain a passing result.

Queue and migration adapters are workflow capabilities, not ontology. A malformed supported version
fails structurally; a recognizable future version reports `VERIFIER_UNSUPPORTED_CONTRACT`.

## Scale and workflow

The harness is intended to run over verification workspaces with tens of thousands of routed records
while keeping results bounded to deterministic findings. Callers can inspect JSON summaries,
partition work by the four dimensions, and run the same verification workspace through human review
workflows without copying corpus data into the harness. Future scaling work should measure loading
and rule-pack performance against realistic inventories (for example 50,000 records) without relaxing
authority isolation or inventing new family semantics.

For illustration only—not as current Writ corpus counts—a 50,000-record candidate batch might report
47,812 without findings, 1,403 unresolved identities, 531 missing evidence references, 192
cross-corpus ambiguities and 62 unsupported-contract findings. The bounded issue format supports that
kind of review without embedding complete records or source documents in results.
