# Writ release history

This directory is the canonical index of Writ's meaningful development releases. The `v0.0.x`
series records research, architecture, and capability checkpoints before Writ 0.1. Each release is
bound to an exact historical commit and Git tree.

These releases do not promise API stability, schema compatibility, production readiness, or public
product maturity. A version increment marks a completed transition worth understanding; it does not
follow every commit or pull request. Failed, narrowed, replaced, and retired directions belong in
the record alongside the parts that survived.

`v0.1.0` is reserved for an explicit future maturity decision. It must not be inferred from elapsed
time, commit count, or completion of the `v0.0.x` sequence.

Published version tags are immutable. Release publication requires explicit human authorization.
The target commit establishes historical time; GitHub's publication timestamp records when the
release entry was actually created and is never rewritten to impersonate the historical date.

Snapshot and data-recovery tags use the separate `snapshot/` namespace and are indexed in
[`../snapshots.md`](../snapshots.md). They preserve recoverable datasets rather than Writ product
versions and do not receive parallel version releases.

## Backfilled pre-0.1 series

| Version | Title | Exact target |
| --- | --- | --- |
| [`v0.0.1`](./v0.0.1.md) | Origin: Covenant to Writ | `a435e9d2a340df58fcbb6dad85ea8444e7b72e52` |
| [`v0.0.2`](./v0.0.2.md) | Source-grounded reset and corpus architecture | `14ec512a28949155054dd2e7479337dbfce95f8c` |
| [`v0.0.3`](./v0.0.3.md) | Reviewed institutional knowledge and verification | `8a4e3b8ed31c8f7b26fbfdb377ec901a39ffdeb4` |
| [`v0.0.4`](./v0.0.4.md) | Evidence-bound foundation and NIST reference | `8a8c19e25fc129c84b27f0f545fcde697032097a` |
| [`v0.0.5`](./v0.0.5.md) | Portable provenance kernel | `7c1ff7cf881236beacb40181a83f320e88d9b4f1` |
| [`v0.0.6`](./v0.0.6.md) | Decision-provenance foundation | `20f0473afa62ed3c6e0433a21b189d1d9d1712d6` |
| [`v0.0.7`](./v0.0.7.md) | Bounded decision-provenance integration | `32207b8178f969da04e0133470b33f286c5512ad` |

The `v0.0.4` target follows the named `nist-reference-2026-08-29` checkpoint by one merged pull
request. This is deliberate: the named checkpoint at `148da931...` remains unchanged, while the
version cutoff at `8a8c19e...` also includes the HTTP application retirement required to complete
the foundation transition.

## Historical checkpoint aliases and recovery tags

| Tag | Relationship to version history |
| --- | --- |
| `pre-foundation-reset-2026-08-22` | Recovery point between `v0.0.3` and `v0.0.4`; preserves the state immediately before the foundation reset |
| `nist-reference-2026-08-29` | Named NIST checkpoint immediately before the final `v0.0.4` cutoff |
| `portable-provenance-kernel-2026-09-02` | Historical named checkpoint at the exact `v0.0.5` target commit |
| `decision-provenance-foundation-2026-09-05` | Historical named checkpoint at the exact `v0.0.6` target commit |

Numbered `v0.0.x` and future `v0.x.x` tags are the canonical Writ development milestones for
meaningful research, architecture, or capability transitions, not individual PRs or commits.
Existing named tags remain immutable aliases or genuine recovery points; do not create a free-form
named milestone when the next numbered release is the appropriate record. The `snapshot/*` tags
preserve historical data bodies and are not product versions. `v0.1.0` remains reserved for an
explicit future maturity decision.

## Reconstruction method

The series was reconstructed from commits and trees first, then historical ADR versions, merged
pull requests, migration records, existing tags, historical files at their actual commits, and the
task ledger. Current documentation was used only to identify later standing. The machine-readable
[`manifest.json`](./manifest.json) records boundaries, target timestamps, tree identities,
release-note hashes, and supported checkpoint hashes.

Human-readable period dates use UTC to match the GitHub merge chronology. Exact Git commit
timestamps retain their recorded numeric offsets.

Historical sections describe what existed at the target. Later interpretation is confined to “What
did not survive,” “What survived,” “What changed next,” and “Current retrospective.” Checks reported
for an old version come from evidence attached to that work; current verification is not projected
backward onto an older tree.
