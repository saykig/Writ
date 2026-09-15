# Writ

Writ is local infrastructure for explicit decision problems.

A decision problem can contain many variables, uncertain states, dependencies, available actions,
constraints, objectives, and information limits. Writ's job is to keep those pieces in one
inspectable object, send well-defined mathematical work to the right engine, and preserve exactly
what the engine was asked and what its result means.

```text
decision problem
  -> variables and dependencies
  -> uncertainty and information available
  -> actions
  -> constraints and objectives
  -> mathematical engine
  -> checked result
```

Writ does not require an LLM, a hosted service, or a social-science ontology. A variable can be a
physical quantity, a system state, a probability, a cost, a mathematical object, or anything else a
specific model defines.

## What Writ owns

Writ should own the decision object, exact input/output binding, provenance where it matters, engine
adapters, and independent checks. It should not reimplement mature mathematics that already exists.

Different problems may therefore use different established tools: an influence-diagram library, an
optimization system, a POMDP framework, a statistical package, or a formal checker. Each adapter must
state what it accepts, what the external engine guarantees, and what Writ can independently verify.

A solver result is not the same thing as a good real-world model, and neither is the same thing as a
human decision. Writ keeps those claims separate.

## Current status

The repository already has one narrow reference implementation under `packages/decision-case/`. It
shows how Writ can preserve exact mathematical inputs, run a pinned local engine, and check a
candidate result independently. It is a useful test bed, not the final decision-object format or a
universal solver interface.

The next milestone is a small, engine-neutral decision object and one strong local proving case. The
case must run without an LLM or network service and must be difficult enough that using Writ is more
useful than calling a solver directly.

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
[current roadmap](docs/current/roadmap.md) and [decision-object note](docs/current/decision-object.md).

Copyright 2026 Sara Kim
