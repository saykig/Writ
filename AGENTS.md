# AGENTS.md

## Mission

Build Writ as local infrastructure for explicit decision problems.

The central object is a decision problem: variables, relationships, uncertainty, information
available to the decision-maker, actions, constraints, objectives, mathematical requests, and
checked results. Provenance explains important supplied inputs and modelling choices when that
context matters.

Writ uses established mathematical software where it fits the problem. The repository owns the
decision object, adapters, exact bindings, checks, and clear result boundaries.

## Read first

Before changing current architecture, read:

- `docs/current/product-definition.md`;
- `docs/current/design-principles.md`;
- `docs/current/decision-object.md`;
- `docs/current/roadmap.md`;
- `.agents/README.md` and the relevant skill;
- the relevant current schema or ADR; and
- the selected task in `TASKS.yaml`, when one exists.

`docs/current/design-principles.md` records the rules guiding new work. A proving case may revise a
principle when the reason and evidence are recorded explicitly.

Current docs and the newest accepted ADR govern new work. `docs/history/`, `docs/migrations/`, and
`docs/experiments/` preserve the research and engineering record for audit and recovery.

## Agent work chain

Choose one primary skill for the task.

1. `writ-decision-object` defines or reviews the decision problem.
2. `writ-engine-adapter` selects and connects established mathematical software once the operation is
   clear.
3. `writ-proving-ground` evaluates Writ against the direct-engine baseline.
4. `writ-release-history` handles releases, recovery points, snapshots, and historical records.

The normal build handoff is:

```text
decision object
-> engine adapter
-> proving ground
```

The decision-object stage owns problem definition. The adapter stage owns mathematical translation.
The proving-ground stage owns comparative evaluation. Release and history work stays separate from
current semantics.

## Core rules

1. Keep the correctness path local and reproducible from structured inputs.
2. Keep the shared core domain-neutral and let typed profiles carry domain-specific meaning.
3. Record supplied information, modelling choices, mathematical objects, solver output, independent
   checks, empirical adequacy, and human decisions as separate claims.
4. Represent missing probabilities, utilities, causal effects, constraints, authority, and model
   structure explicitly as unknown or unsupported.
5. Prefer mature external mathematics and thin adapters before implementing new solver logic.
6. Preserve the native meaning of each engine across translation boundaries.
7. Record exact versions, units, supported states, output meaning, translation loss, and the trusted
   computing boundary for each adapter.
8. Separate candidate production from independent checking whenever a useful check is available.
9. Preserve exact numeric values wherever the mathematics requires them.
10. Choose the language that gives the clearest bounded mathematical or checking boundary.
11. Add general infrastructure after a proving case demonstrates a concrete reusable need.
12. Build new decision work through the current decision-object path and current agent roles.

## Current reference implementation

`packages/decision-case/` is the bounded reference for exact input binding, a pinned local producer,
and independent checking. Its mathematical profile provides a test case while the shared
decision-object structure is exercised across additional mathematical families.

Source-grounded corpora and record tooling remain available as inputs and research infrastructure
when a decision problem needs them.

## Verification

For semantic changes, add a positive case and decisive negative cases. Return clear failures for
malformed, unsupported, stale, or mismatched inputs. Preserve distinctions such as `unknown`,
`unresolved`, nonidentification, and unsupported operations.

Standard checks:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
bun run data:check
bun run verify:writ
bun run build
```

## Documentation style

Write for a technically curious reader who is new to the project. Start with the plain-language
point. Use specialized terms only when they add precision, define them when necessary, and keep
current Markdown short. State the current project directly; place historical explanation in the
history and experiment directories.
