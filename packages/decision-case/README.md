# `@writ/decision-case`

This package implements Writ's proposed, separate derived decision-case layer. It is not a record
family and does not change corpus, source, passage, record, judgment or review identities.

The pure library opens a portable byte snapshot, verifies embedded source bytes and exact cited
spans, checks complete model-input mappings and an acyclic dependency graph, preserves backend
problem/query bytes in lossless base64 envelopes, and reports revision reuse separately for the
mathematical subject and its evidentiary applicability.

The explicitly invoked runner is the only process-owning component. It accepts a caller-supplied
root for Decision Lab commit `7215b53096bc487756f94f4ca87390716a14f2ee`, verifies the exact
SHA-256 of the complete repository-owned Python import closure used by the Build 2 interface, and
calls a fixed Writ-owned Python bridge in isolated mode. The bridge verifies CPython 3.13 before
importing the package. For each call, Writ copies the exact buffers that passed those hashes into a
private source-only snapshot and imports from that snapshot rather than the supplied directory.
Caller caches, extra modules and other neighboring files are excluded; Python receives `-B`, loaded
`writ_decision_lab` module origins must resolve to `.py` files inside the snapshot, and the snapshot
is removed on success or failure. The bridge first obtains an untrusted candidate with `produce`; a
separate invocation of the upstream exact `check` must succeed before Writ records a mathematical
check. `consumeDecision` checks the candidate yet again against the independently reopened intended
problem/query bytes. The interpreter, its standard library, OS and installed `scipy==1.17.0`
distribution remain trusted runtime prerequisites; this is not an arbitrary-executable sandbox.

Public case and execution decoding compiles the authoritative analysis schemas directly. Duplicate
outer JSON keys, excessive envelope size/depth, missing or wrongly typed required values, invalid
enums and undeclared fields fail before semantic cross-reference and exact-byte checks. Embedded
mathematical bytes are never reserialized.

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

The offline unit suite may skip the real engine. The explicit acceptance command never converts a
missing engine or Python prerequisite into a pass:

```bash
WRIT_DECISION_LAB_ROOT=/path/to/pinned/writ-decision-lab \
WRIT_DECISION_LAB_PYTHON=/path/to/python3.13 \
bun run test:decision-integration
```
