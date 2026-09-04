# Review-artifact binding experiment

Task: `REVIEW-ARTIFACT-BINDING-001`. Baseline: `97ab97de2735116ba3a69a0916507a7bc8d943c4`.
Implementation branch: `codex/review-artifact-binding`; main and accepted NIST data are unchanged.
The implementation remains a review candidate. The NIST application requires a separate human
disposition described in [the packet](human-review-packet.md).

## Reproduction before implementation

The baseline was clean main at the exact requested commit. Before implementation, replacing the
human disposition's statement that the passages support the assertion with a withdrawal, while
leaving native judgments unchanged and refreshing `MANIFEST.sha256`, passed all four verification
gates and the complete 490-test Bun suite. The mutation was restored before implementation.

The original artifact hash is
`sha256:75e67171bd28d33e623b8079ae20fb6c92dd7ba7b984c8ddbf8ee940fcd0f713`;
the substituted artifact hash was
`sha256:5791569e80564930030f592ddaac20552f4dd3dab83017f2b0c4bc675cd4f3e9`.
Baseline HEAD, branch, worktree, all tracked-file hashes, governing-contract hashes, mutation and
command logs were captured before code changes. The equivalent synthetic regression now changes
only the artifact and refreshes ordinary checksums; a declared binding rejects the substitution.

## Minimal bakeoff

| Candidate | Result |
| --- | --- |
| A: optional inline native judgment binding | Survives with two fields, an explicit judgment version and shared exact-byte verification. |
| B: first-class companion receipt | Adds an object identity, membership joins, lifecycle and export handling without a required benefit over A. |
| C: repository registry | Adds a separate join and private repository state; portability would require exporting another governed object. |

Rationale-only hashes, fixed test hashes, the root manifest, path-only references and Git coincidence
do not give an accepted judgment a governed portable association. Compatibility-only objects and
private conventions cannot supply the missing native contract.

The chosen `0.3.0` judgment property is `review_artifact: { path, content_hash }`. Dialect `writ 0.3`
selects it explicitly; old judgment schemas remain byte-identical. Bundle `1.1.0` carries the
unchanged native binding and exact base64 artifact bytes. Old unbound exports retain format
`1.0.0`. The portable provenance package exposes a pure byte verifier and an explicit repository
file adapter; verifier and exporter use the same boundary.

## Falsification and limits

The strongest initial export attack changed compiled binding and artifact bytes, refreshed all
outer hashes, and retained the original bound native source fragment. It initially passed. A
second attack downgraded the format and contract and stripped the compiled binding. Both now fail
through a narrow comparison with the stored native binding. Exact string comparison also closes
an independently demonstrated NFC/NFD locator mismatch that canonical hashing would normalize.

Other regressions cover malformed or uppercase hashes, trailing newline, missing bytes, empty
and arbitrary bytes, directories, traversal, symlinks, aliases, self-reference, contradictory
bindings, separate record/link targets sharing an artifact, and existing supersession constraints.
Grammar roundtrips preserve the new field and existing identifiers; schema/kernel parity tests
cover demonstrated Unicode and line-separator traversal failures.

A correctly hashed extraction report or unrelated human-review file can still be associated with
a judgment. Empty bytes can also verify. This proves content association only: it does not prove
reviewer identity, human authorship, semantic agreement, evidence sufficiency or truth. Changing
the binding and artifact together requires human/Git review. An absent old binding is neither
fabrication nor invalidity. The existing NIST judgments remain unbound until authorized successors
are applied; this PR does not claim to have applied the protection to them.

Unrelated pre-existing projector/verifier disagreements remain deferred to differential testing,
including historical passage identity conflicts and broken reciprocal judgment lineage accepted
by projection but rejected by authoritative verification. This experiment does not claim general
bundle/verification equivalence.

## Acceptance and human gate

Integrated acceptance results and the ordinary clean-export experiment are recorded here after
their completion. The exact current unbound bundle at the fixed baseline commit remains
byte-identical (1,532,537 serialized characters). Accepted corpus files, source material and the
original NIST human-review artifact remain unchanged.

No proposed NIST binding lineage is loaded or accepted. The human packet lists the two separate
successor judgments, unchanged targets, exact existing artifact path/hash and exact planned files.
Task completion is withheld at `AWAITING_REVIEW_BINDING_HUMAN_DISPOSITION`.
