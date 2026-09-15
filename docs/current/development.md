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

Authoritative JSON Schemas live under `schemas/`. Generated runtime copies must stay synchronized.
A schema change should include a valid example, a decisive invalid example, and an ADR when it changes
a durable public contract.

## Adding a mathematical engine

Do not add a library merely because it may be useful later. First state the exact operation Writ
needs, run one local example, record the engine version and license, explain the input/output meaning,
and document what is lost in translation.

Keep lockfiles and language versions pinned. Prefer the donor project's native language and API when
that keeps the mathematical boundary clearer.

## Documentation

Write current Markdown for a new reader. Lead with the point, define necessary jargon, and keep
research history out of current product explanations.
