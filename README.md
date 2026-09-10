# Writ

Writ helps people keep the reasoning behind consequential decisions inspectable and correctable.

A decision rarely rests on one fact. It has sources, interpretations, assumptions, calculations,
judgments, authority, implementation, and consequences. Those pieces often end up scattered across
documents and tools. Writ preserves their connections so a later person or machine can answer:

- What did we know, and where did it come from?
- What did we assume?
- What followed from the supplied model or calculation?
- Who decided what, under which authority?
- What changed, and should the old conclusion still be used?

Writ does not decide for people. It does not turn a checked calculation into empirical truth or
permission to act.

## What works today

Writ currently has two deliberately separate parts.

**Source-grounded knowledge** preserves exact sources and passages, typed institutional and
legal-policy records, human review, provenance, and correction history.

**Bounded decision work** preserves an explicit question, supplied assumptions, an exact
mathematical subject, computation, an independent check, applicability, human disposition, and
revision. It can also preserve a small post-decision history—authority, decision, implementation,
observation, and reconsideration—without claiming that sequence proves causality or that the
decision was correct.

The repository contains runnable examples of both boundaries, including exact decision cases,
revision and replay, a pinned external SimPy calculation, and a simulation comparison kept separate
from the human act. These are working research components, not a finished decision application.

## Try a small example

You need [Bun](https://bun.sh/) 1.3.12. From the repository root:

```sh
bun install --frozen-lockfile
bun examples/decision-cases/failure-choice/generate.ts
bun packages/decision-case/bin/writ-decision-case.ts summary \
  --case examples/decision-cases/failure-choice/case.json
```

The fictional case asks which of two actions minimizes expected cost across every compatible model.
The summary shows the exact question, pinned engine, applicability, and human-review status without
contacting a live service. Running its mathematical producer requires the separately pinned
Decision Lab environment described in the
[example guide](examples/decision-cases/failure-choice/README.md).

To run the ordinary repository checks:

```sh
bun run format
bun run lint
bun run typecheck
bun run test
bun run verify:writ
bun run build
```

The [development guide](docs/current/development.md) lists the remaining data, Python, and real
integration checks.

## Read more

- [What Writ supports now](docs/current/product-definition.md)
- [Examples](examples/README.md)
- [Current roadmap](docs/current/roadmap.md)
- [Development and verification](docs/current/development.md)
- [Versioned history](docs/history/README.md)

Copyright 2026 Sara Kim
