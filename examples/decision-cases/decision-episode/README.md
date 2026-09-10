# Decision episode fixture

This directory contains one synthetic `decision_episode` generated from the accepted alpha
shared-analysis revision story and PR #51 certificate-transport semantics.

The fixture deliberately keeps these separate:

- old and successor checked mathematical executions;
- stale applicability and explicit reassessment;
- certificate transport and fresh checker status;
- a supplied authority statement;
- an explicit human/institutional decision;
- implementation;
- an observed consequence;
- optional interpretations, of which this fixture has none; and
- an explicit reconsideration request with no automatic model update.

The human decision selects A even though the successor analysis freshly checks B as strictly
optimal. This is an intentional control: Writ preserves the decision and does not derive it from the
mathematics.

Regenerate with the exact already-pinned local Decision Lab checkout and runtime:

```bash
bun examples/decision-cases/decision-episode/generate.ts \
  --out /path/to/episode.json \
  --engine-root /path/to/pinned/writ-decision-lab \
  --python /path/to/cpython-3.13-with-scipy-1.17/bin/python
```

Freshly replay without invoking the producer:

```bash
bun packages/shared-analysis/bin/writ-decision-episode.ts replay \
  --episode examples/decision-cases/decision-episode/episode.json \
  --expected-episode-sha256 sha256:f0b049f4dbdcb66ad5c4ecc26bf0560e4778474c91fc4957d2309a57fb7fceb3 \
  --engine-root /path/to/pinned/writ-decision-lab \
  --python /path/to/cpython-3.13-with-scipy-1.17/bin/python
```

All content is synthetic engineering material. It is not source truth, an empirical estimate, a
causal claim or authority to act.
