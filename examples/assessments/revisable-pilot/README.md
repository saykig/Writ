# Revisable-assessment pilot

Start with the [retained research report](RESEARCH_REPORT.md) and the
[local notebook instructions](../../../packages/assessment-view/README.md).
The current checkpoint is incomplete at the corrected browser-workflow gate.

The native synthetic exercise uses existing shared-analysis records; the public
OPERA packets are experimental analyst artifacts with no invented native mathematical
or political-record semantics. Both sets are inspectable in the local notebook.

```sh
python3 examples/assessments/revisable-pilot/receive-packets.py
python3 examples/assessments/revisable-pilot/receive-pilot.py
python3 examples/assessments/revisable-pilot/receive-vela.py \
  --vela /path/to/pinned-macos-vela \
  --bun /path/to/bun --python /path/to/pinned-checker-python \
  --engine-root /path/to/pinned-decision-lab
```

`receive-vela.py` checks the exact official macOS binary digest recorded in the
[signed distribution manifest](evidence/vela-macos-aarch64.zip.release-manifest.json).
It clones the committed synthetic bundle, creates only the known synthetic trust pin
if needed, runs real Vela and native Writ receiving, tests mutations, and removes a
pin it created. It preserves an existing exact matching pin. It does not sign new
claims, need private keys, establish real authority or accept a Claim. Other binary
platforms require a separately verified distribution binding; no cross-platform pass
is implied by this macOS probe. Actual CLI/library scope and losses are in the reuse
report. The original fixture's disposable private keys have been removed.

To regenerate the initial native artifacts using the pinned real checker:

```sh
bun examples/assessments/revisable-pilot/reuse-native.ts \
  --engine-root /path/to/pinned-decision-lab \
  --python /path/to/pinned-checker-python --out /tmp/new-native-output
```

The output directory must be fresh. The two revisions target selected original
analyses, not a new sequential mathematical operation. The retained Vela bundle is
already sufficient for receiving; no signing or recreation of synthetic authority is
required. Its native archive can also be exported through the local notebook.

The pilot packets and rubric froze at `bdeef24` before the six real recipient contexts.
All 18 responses are retained. Source/score identity checking does not decide whether
a semantic score is deserved. The condition-blinded scorer output and root review
remain authored evaluation evidence, separate from deterministic score arithmetic.
Human follow-up instructions are in the frozen protocol; no recruitment took place.

A source-bound checkpoint receipt binds the exact code and retained observations to
a full Git commit. `receive-checkpoint.py RECEIPT --current` verifies those identities
and required reported gate coverage; it does not rerun the gates or confer a browser
pass. Fresh gates are the normal repository scripts, all three required native
integration commands, Python checks, and the receivers above. Run native integration
after package builds finish, because provenance rebuilding replaces its dist directory.
