# AGENTS.md

## Mission

Build Writ as local infrastructure for explicit decision problems.

The central object is a decision problem: variables, relationships, uncertainty, information
available to the decision-maker, actions, constraints, objectives, mathematical requests, and
checked results. Provenance may explain where an important supplied input or modelling choice came
from. It is supporting structure, not the product by itself.

Writ should use established mathematical software when it fits the problem. The repository owns the
decision object, adapters, exact bindings, checks, and clear limits around what each result means.

## Read first

Before changing current architecture, read:

- `docs/current/product-definition.md`;
- `docs/current/design-principles.md`;
- `docs/current/decision-object.md`;
- `docs/current/roadmap.md`;
- `.agents/README.md` and the relevant skill;
- the relevant current schema or ADR; and
- the selected task in `TASKS.yaml`, when one exists.

`docs/current/design-principles.md` records lessons that new work should not quietly violate. A later
proving case may justify changing a principle, but that change must be explicit and evidence-backed.

Current docs and the newest accepted ADR govern new work. Files under `docs/history/`,
`docs/migrations/`, and `docs/experiments/` are evidence of completed work, not current product
instructions.

## Agent work chain

Choose one primary skill for the task.

1. `writ-decision-object` defines or reviews the decision problem itself.
2. `writ-engine-adapter` selects and connects established mathematical software once the operation is
   clear.
3. `writ-proving-ground` tests whether Writ adds real value beyond using the underlying engine
   directly.
4. `writ-release-history` handles releases, recovery points, snapshots, and historical records. It is
   outside the build chain.

The normal build handoff is:

```text
decision object
-> engine adapter
-> proving ground
```

Do not let an engine define the problem merely because its API is convenient. Do not let a proving
case protect an abstraction from failure merely because code already exists. Do not let historical
maintenance change current semantics.

## Core rules

1. Writ must run locally without an LLM. Models may be optional tools, never a runtime requirement.
2. Keep the core domain-neutral. Variables do not have to represent people, institutions, or any
   particular application area.
3. Keep supplied information, modelling choices, mathematical objects, solver output, independent
   checks, empirical adequacy, and human decisions separate.
4. Never invent probabilities, utilities, causal effects, constraints, authority, or missing model
   structure to make an adapter work.
5. Prefer mature external mathematics over new Writ mathematics. Use a library or CLI and a thin
   adapter before building a solver.
6. Preserve the native meaning of each engine. A translation does not make different mathematical
   formalisms equivalent.
7. Record exact versions, units, supported inputs, unsupported states, output meaning, translation
   loss, and the trusted computing boundary for each adapter.
8. Separate candidate production from independent checking whenever a useful check is possible.
9. Keep exact values exact when the mathematics requires it. Do not silently round through
   JavaScript numbers.
10. TypeScript is the current application language, not the mathematical ceiling. Use the language
    that makes a bounded mathematical or checking boundary clearest.
11. Do not create a universal ontology, solver registry, graph platform, workflow engine, or hosted
    service before a proving case demonstrates the need.
12. Do not extend the removed shared-analysis, episode, or replay interfaces. New decision work uses
    the current decision-object path.

## Current reference implementation

`packages/decision-case/` remains a bounded reference for exact input binding, a pinned local
producer, and independent checking. Its mathematical profile is not the Writ ontology and must not
dictate the future decision-object schema.

Source-grounded corpora and record tooling remain usable inputs and research infrastructure. They do
not define the decision object and should not be expanded merely because they already exist.

## Verification

For semantic changes, add a positive case and decisive negative cases. Fail clearly on malformed,
unsupported, stale, or mismatched inputs. Do not turn `unknown`, `unresolved`, nonidentification, or
an unsupported operation into a convenient answer.

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

Write for a technically curious reader who has never seen the project. Start with the plain-language
point. Use specialized terms only when they add precision, define them when necessary, and keep
current Markdown short. Do not make a reader reconstruct the research history to understand the
current system.
