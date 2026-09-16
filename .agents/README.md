# Agent roles

Writ uses narrow agent skills with explicit handoffs between stages of work.

Use one primary skill for the job:

- `writ-decision-object` — define or review the decision problem;
- `writ-engine-adapter` — choose and connect established mathematical software;
- `writ-proving-ground` — test Writ against a direct-engine baseline; and
- `writ-release-history` — maintain releases, recovery points, and historical records.

The normal build chain is:

```text
decision object
-> engine adapter
-> proving ground
```

Each role owns one layer. The decision-object role defines the problem, the engine-adapter role
handles mathematical translation, and the proving-ground role evaluates whether the resulting
architecture earns its place. Release and history work stays separate from that build chain.

All skills follow `AGENTS.md` and the current design principles.
