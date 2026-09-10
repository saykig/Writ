# From one queue simulation to one bounded decision comparison

Everything in this example is synthetic. The model runs are actual executions of the pinned SimPy
4.1.1 adapter, but the arrivals, service assumptions, option effects, implementation burdens,
preferences, authority statements, choices and episode dates are supplied engineering fixtures.
Nothing here describes a real charging station.

## Declared menu and objective

The represented menu is exactly three two-server FIFO options. It is complete only for this declared
fixture; completeness of real-world options is `not_established`.

- `retain`: simulated service is the supplied base duration; fixed burden 0 stipulated loss points.
- `streamline`: simulated service is base minus 2 minutes; fixed burden 4 stipulated loss points.
- `intensive`: simulated service is base minus 4 minutes; fixed burden 7 stipulated loss points.

The option deltas are model inputs, not identified intervention effects. The supplied objective is

```text
total loss = 1 stipulated loss point/minute × total simulated waiting minutes
           + fixed option burden in stipulated loss points
```

It uses exact integer arithmetic, no rounding and zero tolerance. The loss-point scale is a declared
preference, not money, measured welfare or an empirically estimated utility function.

| Comparison     | Option     | Service | Simulated total wait | Fixed burden | Exact total loss |
| -------------- | ---------- | ------: | -------------------: | -----------: | ---------------: |
| base service 5 | intensive  |   1 min |                0 min |            7 |                7 |
| base service 5 | retain     |   5 min |                2 min |            0 |            **2** |
| base service 5 | streamline |   3 min |                0 min |            4 |                4 |
| base service 9 | intensive  |   5 min |                2 min |            7 |            **9** |
| base service 9 | retain     |   9 min |               10 min |            0 |               10 |
| base service 9 | streamline |   7 min |                6 min |            4 |               10 |

The exact conditional preference changes from `retain` to `intensive`. That is a statement only
about the supplied model, objective and declared menu. It is not an empirical or causal conclusion.

## Immutable revision and supplied decisions

`revision.json` embeds both comparison records and two exact decision episodes. The declared
revision changes base service from 5 to 9 minutes and enumerates the resulting input/run change for
all three options. The receiver rejects another changed field or an omitted option rerun.

The parent supplied human decision selects `retain_current_process`, matching the first conditional
preference. The successor supplied decision instead selects `seek_empirical_service_evidence`,
outside the modelled menu, despite the second comparison's conditional preference for `intensive`.
The link derives and verifies those relationships but never infers either decision or authority.
Both episodes keep the unrelated native A/B checked history byte-identical and freshly replay it
separately.

Expected hashes in `pins.json` must be obtained independently of received replacements. A relocated
recipient with the SimPy producer and Decision Lab producer disabled runs:

```bash
bun packages/shared-analysis/bin/writ-simulation-decision.ts \
  examples/decision-cases/simulation-decision/revision.json \
  sha256:ca43272fcb1fd79f190dd33100652acc5e2b77bd24a9bb6c23dc3920763263b3 \
  sha256:237684e5ccf3a9458a107a778eed0d5266421997d5e21224cadd8e841cd3351a \
  sha256:3a85e4ba0c56e77c251c6cc0044d2ae6848af6579eff4e71a7d2c6cbf7c5baae \
  sha256:7cc8b95f079010a09bb4a5935acdc01009f419f636b7570eabe52daed5c560fa \
  sha256:4052f17e34af89a543f6e307fd0379bac47e99712bc5cdf12877b2c169f1bcb0 \
  /path/to/pinned/writ-decision-lab /path/to/cpython-3.13.15-with-scipy-1.17/python
```

Regenerate all five public artifacts into an existing empty directory with:

```bash
bun examples/decision-cases/simulation-decision/generate.ts /tmp/new-simulation-decision
```

The retained comparison generator consumes actual SimPy results. Actual producer reproduction is a
separate explicit operation; `run-1.json` and `run-2.json` cover service 5 and 9, while the added
`run-service-{1,3,7}.json` files cover the other option inputs. Use `produce.py` and the corresponding
input file under `examples/external-simulation/simpy-resource/` in the pinned environment described
there. The required no-skip recipient gate is `bun run test:simulation-decision-integration`.

No before/after causal effect, empirical validity, real option completeness, authenticated actor,
Bellman certificate, automatic adoption, supersession or authority to act is claimed.
