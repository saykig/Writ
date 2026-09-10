# Pinned external producer: SimPy FIFO resource model

This is model-generated engineering evidence, not measured charging-station performance.
The external engine genuinely schedules four car processes on two slots. The model is adapted from
SimPy's MIT-licensed `shared_resources.rst`, retained verbatim with its license. Writ did not build
an event simulator or wrap a Writ-generated numerical fixture.

`input-1.json` declares arrivals at 0, 2, 4, 6 minutes and constant five-minute service.
`run-1.json` preserves the exact inputs, adapter, installed package source manifest and raw output.
SimPy returns starts 0, 2, 5, 7 and finishes 5, 7, 10, 12; total waiting is 2 minutes.
Those numbers are conditional on deterministic arrivals, initially empty identical servers, FIFO,
constant service and no abandonment. No probabilities, loss conversion or policy preference follow.

## Reproduce and receive

Use CPython 3.13.15 in an isolated environment with `simpy==4.1.1`. The producer checks every installed
SimPy Python source against the inspected source-distribution manifest before invoking a fixed
adapter over copied model/input buffers. It records no random seed because there is no randomness.
The interpreter, installed environment, OS and absence of concurrent package tampering remain trusted.
The manifest is not a signature authenticating execution on another machine.

```bash
python -I examples/external-simulation/simpy-resource/produce.py \
  examples/external-simulation/simpy-resource/input-1.json /tmp/new-simpy-run.json
bun packages/shared-analysis/bin/writ-external-simulation.ts \
  /tmp/new-simpy-run.json \
  sha256:aff2e46ccf942f842c0e6fca0524984e0c3b373c1b435092b8e21fb3c31b393e \
  sha256:df06bb93064a29a7637c32c94dbfed9f6d6615b692a97d093b1ca54af3a3a92a
```

Outputs are creation-only. Expected identities must come independently from the intended handoff.
The public receiver runs without Python or SimPy, checks byte/model/input identity and the closed
format, then computes an independent integer recurrence. For FIFO, equal duration and two servers,
completion order follows arrival order. Job i starts at max(arrival_i, finish_(i-2)), with both slots
initially free. Induction verifies every start/finish and total wait. This establishes exact trace
agreement for this supported profile, not an exact Bellman certificate or real-world adequacy.
Variable service, simultaneous arrivals, priority, preemption, stochastic arrivals and other units
are unsupported. The receiver never executes embedded source and rejects stronger status claims.

A second actual run reproduced the envelope byte-for-byte. Five receiving tests include relocated
receiving with no producer on PATH; wrong source/model/input bindings; silently changed output;
rehashed numerically false output; and attempted empirical, causal or Bellman promotion.
