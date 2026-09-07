# `@writ/decision-case`

This package implements Writ's proposed, separate derived decision-case layer. It is not a record
family and does not change corpus, source, passage, record, judgment or review identities.

The pure library opens a portable byte snapshot, verifies embedded source bytes and exact cited
spans, checks complete model-input mappings and an acyclic dependency graph, preserves backend
problem/query bytes in lossless base64 envelopes, and reports revision reuse separately for the
mathematical subject and its evidentiary applicability.

The explicitly invoked runner is the only process-owning component. It accepts a caller-supplied
root for Decision Lab commit `7215b53096bc487756f94f4ca87390716a14f2ee`, verifies the exact
SHA-256 of the Build 2 interface files, and calls a fixed Writ-owned Python bridge. The bridge first
obtains an untrusted candidate with `produce`; a separate invocation of the upstream exact `check`
must succeed before Writ records a mathematical check. `consumeDecision` checks the candidate yet
again against the independently reopened intended problem/query bytes.

The supported semantics and operations are deliberately closed:

- `finite-linear-uncertainty.v1`;
- `decision` for a `static_expected_loss_decision` use;
- `compatibility` for an explicit compatibility control.

Unknown semantics and operations fail explicitly. A case cannot supply a command or executable.
Missing engines, pin drift, malformed protocol output, stale problem/query binding, unsupported
reuse, and applicability needing reassessment all fail closed with stable diagnostics. An upstream
`unresolved` result remains non-functional; it is never relabelled incompatible or model-dependent.

The three statuses remain separate in every execution: exact mathematical check status for the
selected bytes, applicability of the source-to-model mapping, and human review disposition. A
fresh exact calculation does not supply empirical premises, human acceptance, or authority to act.
