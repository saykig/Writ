# Development

## Verification

Run the standard repository checks from the root:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
bun run data:check
bun run verify:writ
bun run build
```

Python and CI verification are defined in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).
After installing the ingestion development dependencies, run:

```bash
.venv/bin/python internal/tooling/scripts/validate_pack.py
.venv/bin/python internal/tooling/scripts/generate_source_registry.py --check
.venv/bin/ruff check apps/ingest internal/tooling/scripts internal/verification
.venv/bin/mypy apps/ingest/src
.venv/bin/pytest apps/ingest internal/verification
```

## Schema and protocol authority changes

Authoritative schemas live under [`schemas/`](../../schemas/). Runtime vendor copies under
`packages/domain/schemas/` must remain synchronized with their authority mapping.
The language protocol authority lives at `protocols/language/writ.ebnf`.

For schema or protocol authority changes, also run:

```bash
bun test packages/domain
PYTHONPATH=apps/ingest/src .venv/bin/pytest -q internal/verification/schema
.venv/bin/python internal/tooling/scripts/validate_pack.py
bun run verify:writ
```

## Dependency and version changes

- Resolve stable, mutually compatible releases from official registries and documentation; commit
  exact lockfiles.
- Keep Bun and Python versions pinned through `.bun-version` and `.python-version`.
- Commit `bun.lock` and the Python lockfile when one is introduced.
- Merge automated dependency updates only after the complete verification and migration tests pass.
- Require deliberate review for parser, canonicalization, cryptography, database-driver, PDF-parser,
  browser-automation, and solver upgrades.
- Record semantic changes in an ADR and bump the affected language, schema, or compiler version.
