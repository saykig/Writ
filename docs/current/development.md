# Development

Run the standard checks from the repository root:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
bun run data:check
bun run verify:writ
bun run build
```

Python checks used by CI are defined in `.github/workflows/ci.yml`.

## Changing schemas

Authoritative JSON Schemas live under `schemas/`. Generated runtime copies stay synchronized.
A schema change includes a valid example, a decisive invalid example, and an ADR when it changes a
durable public contract.

## Adding a mathematical engine

Start with the exact mathematical operation Writ needs. Run one local example, record the engine
version and license, explain the input/output meaning, and document translation losses before making
the dependency durable.

Keep lockfiles and language versions pinned. Use the donor project's native language and API when
that gives the clearest mathematical boundary.

## Documentation

Write current Markdown for a new reader. Lead with the point, define necessary jargon, and place
research history in the history and experiment directories.
