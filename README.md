# Writ

Writ is local infrastructure for explicit decision problems.

It gives a decision problem one inspectable representation for the pieces that matter:

```text
decision problem
  -> variables and dependencies
  -> uncertainty and information available
  -> actions
  -> constraints and objectives
  -> mathematical engine
  -> checked result
```

The meaning of each variable comes from the mathematical model that uses it. A Writ object can carry
physical quantities, system states, probabilities, costs, symbolic objects, or other typed values.

## What Writ owns

Writ owns the decision object, exact semantic bindings, provenance where useful, engine adapters, and
independent checks.

Established mathematical software performs the underlying mathematics. Different problems can use
different tools: influence diagrams, optimization systems, POMDP frameworks, statistical packages,
formal checkers, and other mature engines.

Each adapter records the engine request, version, input meaning, output meaning, translation boundary,
and the checks Writ can perform independently.

Writ also keeps mathematical results, real-world applicability, and human decisions as separate
claims.

## Current status

The first new proving case is complete. One limited-memory influence diagram now runs from the same
Writ object through DecisionProgramming.jl/JuMP/HiGHS and pyAgrum. Both engines return the same policy
and the same independently checked expected utility.

The case also established an adapter rule: mathematical content is bound by explicit identity and
type. The checker caught a wrong table binding that still produced an optimal solver result, and it
rejected a result computed under a different information structure.

The current gate is a bounded case from a different mathematical family. That case will determine
which parts of the influence-diagram profile belong in Writ's shared decision object.

## Run the repository

You need Bun. From the repository root:

```sh
bun install --frozen-lockfile
bun run format
bun run lint
bun run typecheck
bun run test
bun run verify:writ
bun run build
```

Start with [the product definition](docs/current/product-definition.md), then read the
[design principles](docs/current/design-principles.md), [decision-object note](docs/current/decision-object.md),
and [current roadmap](docs/current/roadmap.md).

Copyright 2026 Sara Kim
