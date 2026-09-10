# Two immutable charging-planning episodes

Both episodes and all actor statements are synthetic engineering material. The October event dates
are supplied story dates, not authenticated dates of the actual September computation. No charging
station was deployed or observed. Simulation output is labelled model-generated in the link AND
inside each standalone episode's exact observation record.

1. The first supplied decision commissions a two-slot SimPy run at five-minute service. The actual
   external model produces 2 total waiting minutes. Reconsideration asks for a slower-service stress
   test because the service assumption is unvalidated.
2. A separately declared revision changes only service time to nine minutes. The successor decision
   commissions that rerun; the real external model produces 10 total waiting minutes. Its next step
   asks for empirical service-time evidence before deployment. The result does not prove an effect
   in the world, prove the earlier decision wrong, or automatically supersede it.

Both native A/B mathematical histories remain byte-identical and are freshly checked separately.
They are not models of this queue: no queue-time-to-loss mapping or applicability claim is supplied.
This exercises attachment and correction provenance without fabricating a new native guarantee.

The link resolves the parent's episode SHA, observation ID and reconsideration ID. It checks the
complete external input diff and both traces, rather than trusting labels or filenames. `pins.json`
is a reviewed-fixture handoff; a recipient must obtain expected pins independently from replacements.
`receiving-checkpoint.json` is a retained actual relocated checker-only receipt, not authority for a
future run. The recipient uses the public CLI:

```bash
bun packages/shared-analysis/bin/writ-linked-episodes.ts \
  examples/decision-cases/linked-episodes/link.json \
  sha256:3eea747e5a0ad3edf9555914c3d934f01ee585693b122b6d3ecd66efd53d884e \
  sha256:df245a6ae7007f6dbfe33beb5198b8bdb934e18dbf2f3d3269ccf401830ffa5d \
  sha256:ba389cbdde80468deed6f9d91cc9e9ce4912f3255f6b28958c801c51bee54dfc \
  /path/to/pinned/writ-decision-lab /path/to/cpython-3.13.15-with-scipy-1.17/python
```

Regenerate the pair into an existing empty directory with:

```bash
bun examples/decision-cases/linked-episodes/generate.ts /tmp/new-linked-episodes
```

This uses the public native episode and link APIs and already retained simulation runs. Actual
external reproduction is a separate explicit producer command documented in the simulation example.
The no-skip integration gate is `bun run test:linked-episodes-integration` with the same pinned native
backend environment used by the existing Decision Case/Shared Analysis integration gates.
