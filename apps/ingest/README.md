# Writ ingestion

The ingestion package keeps source-specific extraction separate from normalized corpus contracts.
The frozen G7 AI-for-SMEs adapter reads fixture JSON and emits version `2.0.0` records in memory. It
does not import `MemberSeed`, `MethodologyInventory` runtime types, or write production data.

The G20 adapter is deliberately unavailable during the schema migration. Discovery and fetch
commands remain gated, no Rio source is requested, and ambiguous rows emit review items rather than
fabricated assessments.

Run corpus validation from the repository root with the ingest development environment:

```bash
pytest tests
ruff check apps/ingest/src tests scripts
mypy apps/ingest/src
PYTHONPATH=apps/ingest/src python scripts/validate_corpus.py --g7-fixture
```

Database tests ignore the application's `DATABASE_URL` and run only when
`WRIT_TEST_DATABASE_URL` is set explicitly (an opt-in). It may point at the same database as
`DATABASE_URL` — including the single Neon database — because each suite runs inside a disposable
schema that is created and dropped on teardown and never writes to the public schema.
