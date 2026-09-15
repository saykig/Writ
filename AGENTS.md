# AGENTS.md

## Mission

Build Writ as local infrastructure for explicit decision problems.

The central object is a decision problem: variables, relationships, uncertainty, information
available to the decision-maker, actions, constraints, objectives, mathematical requests, and
checked results. Provenance may explain where a supplied value, constraint, model choice, or other
input came from. It is not the product by itself.

Writ should use established mathematical software when it fits the problem. The repository owns the
interchange object, adapters, exact bindings, checks, and clear limits around what each result means.

## Read first

Before changing current architecture, read:

- `docs/current/product-definition.md`;
- `docs/current/decision-object.md`;
- `docs/current/roadmap.md`;
- the relevant current schema or ADR; and
- the selected task in `TASKS.yaml`, when one exists.

Current docs and the newest accepted ADR govern new work. Files under `docs/history/`,
`docs/migrations/`, and `docs/experiments/` are evidence of completed work, not current product
instructions.

## Core rules

1. Writ must run locally without an LLM. Models may be optional tools, never a runtime requirement.
2. Do not assume variables represent people, countries, institutions, or any other domain. The core
   decision representation is domain-neutral.
3. Keep supplied facts, modelling choices, mathematical objects, solver output, independent checks,
   empirical adequacy, and human decisions separate.
4. Never invent probabilities, utilities, causal effects, constraints, authority, or missing model
   structure at an adapter boundary.
5. Prefer mature external mathematics over new Writ mathematics. Use a library or CLI, then a thin
   adapter, before building a new solver.
6. Preserve the native meaning of an external engine. A successful translation does not make two
   mathematical formalisms equivalent.
7. Every engine adapter must be explicit about versions, units, supported inputs, unsupported states,
   output meaning, translation loss, and the trusted computing boundary.
8. Candidate production and independent checking should be separate whenever a useful independent
   check is possible.
9. Exact values must stay exact when the mathematics requires it. Do not silently round them through
   JavaScript numbers.
10. TypeScript is the current application language, not the mathematical ceiling. Python, Julia, R,
    Rust, Lean, C++, or another language may sit behind a narrow adapter when the problem warrants it.
11. Do not create a universal ontology, solver registry, graph platform, workflow engine, or hosted
    service before a concrete proving case demonstrates the need.
12. Do not extend `packages/shared-analysis` or the removed episode/replay interfaces. New decision
    work targets the decision-object architecture described in current docs.

## Current reference implementation

`packages/decision-case/` remains a bounded reference for exact input binding, a pinned local
producer, and independent checking. Its first mathematical profile is not the Writ ontology and must
not dictate the future decision-object schema.

Source-grounded corpora and record tooling remain usable inputs and research infrastructure. They do
not define the decision object and should not be expanded merely because they already exist.

## Donor-tool discipline

Before adding an engine, record:

1. the exact operation Writ needs;
2. the upstream project and version;
3. its license and local installation burden;
4. the mathematical meaning of its inputs and outputs;
5. one executed local example;
6. what Writ can independently check; and
7. any meaning lost in translation.

Likely tools include influence-diagram, optimization, probabilistic, sequential-decision, and formal
verification libraries. Their presence on a research list is not evidence that Writ supports them.

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
