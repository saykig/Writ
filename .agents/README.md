# Agent roles

Writ keeps agent skills narrow so one task does not silently become the whole architecture.

Use one primary skill for the job:

- `writ-decision-object` — define or review the decision problem itself;
- `writ-engine-adapter` — choose and connect established mathematical software;
- `writ-proving-ground` — test whether Writ adds value beyond the direct engine; and
- `writ-release-history` — maintain releases, recovery points, and historical records.

The normal build chain is:

```text
decision object
-> engine adapter
-> proving ground
```

Release/history work sits outside that chain.

A task may cross boundaries, but do not let one skill take over another role. In particular, engine
choice should not define the decision object, and a proving case should be allowed to reject an
abstraction that earlier work proposed.

All skills remain subordinate to `AGENTS.md` and the current design principles.
