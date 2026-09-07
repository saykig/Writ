# Synthetic failure-choice decision case

This is a Writ-owned synthetic mathematical fixture, not a NIST corpus, an empirical estimate, a
causal claim, or authority to act. The portable case contains exact source bytes, exact byte spans,
explicit modelling choices and transformations, raw base64-encoded Decision Lab problem/query
bytes, a bounded dependency DAG, three immutable static revisions, and one interpretation control.

Generate the portable bundle deterministically:

```bash
bun examples/decision-cases/failure-choice/generate.ts
```

Inspect it without an engine:

```bash
bun packages/decision-case/bin/writ-decision-case.ts summary \
  --case examples/decision-cases/failure-choice/case.json
```

To execute, obtain the exact Decision Lab commit
`7215b53096bc487756f94f4ca87390716a14f2ee` in a temporary or otherwise caller-controlled
directory, install CPython 3.13 and `scipy==1.17.0`, then pass that extracted root explicitly:

```bash
bun packages/decision-case/bin/writ-decision-case.ts run \
  --case examples/decision-cases/failure-choice/case.json \
  --analysis revision-0 --engine-root /path/to/pinned/writ-decision-lab \
  --python /path/to/python3.13 --out /tmp/revision-0.execution.json
```

The runner verifies the complete repository-owned engine import closure, copies those exact verified
source buffers into a private source-only snapshot, and invokes a fixed Writ-owned adapter from that
snapshot. Caller caches and extra files are not copied, repository module origins must remain inside
the snapshot, and the snapshot is removed after each invocation. The adapter obtains a candidate and
invokes the upstream exact checker separately. A recipient must still call `consume`, which reopens
the portable case and freshly checks the candidate again. Neither a stored status nor the prior check
authorizes reuse.

Run the mandatory real-engine acceptance suite with the same prerequisites:

```bash
WRIT_DECISION_LAB_ROOT=/path/to/pinned/writ-decision-lab \
WRIT_DECISION_LAB_PYTHON=/path/to/python3.13 \
bun run test:decision-integration
```

Unlike the default offline tests, this command exits unsuccessfully when either prerequisite is
missing; it cannot report a pass by skipping the integration.
