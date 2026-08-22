# Writ ingestion

The ingestion package retains generic, source-gated acquisition, registry, manifest, vocabulary,
and immutable-storage primitives. It has no active G7, G20, EU–US, or constitutional corpus
adapter. The active NIST institutional corpus is compiled from its reviewed repository sources;
this package does not regenerate its substantive content.

Run corpus validation from the repository root with the ingest development environment:

```bash
PYTHONPATH=apps/ingest/src .venv/bin/pytest apps/ingest/tests internal/verification/integration/ingestion
.venv/bin/ruff check apps/ingest/src apps/ingest/tests internal/tooling/scripts internal/verification
mypy apps/ingest/src
```

Database tests ignore the application's `DATABASE_URL` and run only when
`WRIT_TEST_DATABASE_URL` is set explicitly (an opt-in). It may point at the same database as
`DATABASE_URL` — including the single Neon database — because each suite runs inside a disposable
schema that is created and dropped on teardown and never writes to the public schema.
