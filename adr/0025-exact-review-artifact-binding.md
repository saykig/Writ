# ADR 0025: Exact review-artifact content association

**Status:** Proposed in REVIEW-ARTIFACT-BINDING-001; generic implementation experiment awaiting review

## Demonstrated need

At commit `97ab97de2735116ba3a69a0916507a7bc8d943c4`, replacing the NIST human
disposition's continued support with an explicit withdrawal leaves its accepted native judgments
unchanged. After refreshing the repository checksum manifest, all four verification gates and all
490 Bun tests pass. A rationale path, a commit, and a repository checksum identify repository
content, but do not declare a verifiable association between a particular judgment and exact
review-artifact bytes.

This experiment adds content association only. It does not authenticate a reviewer, evaluate an
assertion, execute review, or turn a human conclusion into a machine conclusion. The source,
passage, typed-record, human-review, provenance boundary and ADR 0016's separate semantic dimensions
remain unchanged.

## Smallest candidate

Use one optional `review_artifact` object on a new native judgment contract:

```json
{
  "path": "docs/migrations/example/human-review.yaml",
  "content_hash": "sha256:<64 lowercase hexadecimal digits>"
}
```

The path is a canonical repository-relative POSIX locator. The hash identifies the complete exact
file bytes, without parsing, Unicode normalization, newline conversion, or semantic interpretation.
A judgment has at most one such binding; independent judgments may bind the same artifact. The
artifact is separate from the judgment's own source file, avoiding a self-referential declaration.

The native judgment version is `0.3.0`, selected explicitly by source dialect `writ 0.3`.
Record contracts remain `0.2.0`. Existing `writ 0.2` judgments and their authoritative `0.2.0`
contract retain their exact meaning. A missing binding states only that the object declares no
exact review-artifact association. It says nothing about human origin, authenticity, validity,
or acceptance.

An explicit filesystem adapter resolves the locator inside the selected repository, rejects path
aliases and symlinks, requires a regular file separate from the judgment source, and supplies bytes
to the same pure content checker used by portable consumers. Verification and export use this
shared boundary. Empty bytes can match their declared hash; that does not make an empty artifact
a meaningful human review.

The supported bundle format preserves the compiled binding and includes the exact bytes as
base64 on its judgment entry. The binding-capable bundle version is `1.1.0`; existing `1.0.0`
bundles remain supported, and repositories using only the earlier contracts retain their earlier
export representation. Reload verifies decoded bytes against the native binding. A hash without
available bytes supports association inspection, not a content-verification claim.

## Rejected alternatives and controls

| Candidate | Result |
| --- | --- |
| Inline native judgment binding | Smallest candidate: one optional governed property, existing judgment identity and lifecycle, shared byte verifier, explicit export bytes. |
| Companion receipt | Adds receipt identity, judgment membership, routing and lifecycle to express an association the judgment can carry itself. It would still need byte verification and export. |
| Repository registry | Adds a second ownership/join mechanism; a registry omitted from export cannot provide the requested portable association. Exporting it reproduces the companion-object overhead. |
| Hash only in rationale; path only; undocumented convention | Neither a typed binding nor a portable machine-verifiable association. |
| Hardcoded test hash | Protects one fixture, not the governed representation or arbitrary exported judgments. |
| Root manifest or Git coincidence | The reproduced substitution survives an ordinary manifest refresh; a commit pins a snapshot but does not declare this association inside the judgment. |
| Compatibility-only Core object | Does not establish a supported native judgment or ordinary portable representation. |

## Human application boundary

The two currently accepted NIST judgments and the existing human-review artifact remain unchanged
in this experiment. Adding a binding to accepted content requires successor judgments and explicit
human authorization. The proposed application is recorded in the human-review packet, not loaded
as accepted corpus objects. Cross-version supersession preserves prior judgments and uses the
existing reciprocal lineage rules.

Binding closure means that changing artifact bytes while the bound judgment remains unchanged
fails verification, even after ordinary checksums are refreshed. Changing both judgment binding
and artifact can form a different structurally valid association; authorization and semantic
agreement still require human/Git review. This ADR does not add a review engine or change any
evidence-basis, truth, target-workflow, or reviewer-identity rule.
