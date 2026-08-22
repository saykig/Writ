# Writ ingestion

The ingestion package keeps source-specific extraction separate from normalized corpus contracts.
The frozen G7 AI-for-SMEs adapter reads fixture JSON and emits version `2.0.0` records in memory. It
does not import `MemberSeed`, `MethodologyInventory` runtime types, or write production data.

The G20 adapter is deliberately unavailable during the schema migration. Discovery and fetch
commands remain gated, no Rio source is requested, and ambiguous rows emit review items rather than
fabricated assessments.

The EU and US AI-governance corpora are independent, active jurisdictional corpora generated from
the byte-preserved reviewed pilot input. Regenerate or drift-check them with:

```bash
PYTHONPATH=apps/ingest/src python internal/tooling/scripts/migrate_eu_us_corpora.py
PYTHONPATH=apps/ingest/src python internal/tooling/scripts/migrate_eu_us_corpora.py --check
```

The generator preserves the reviewed values exactly, uses deterministic UUIDv5 identities, and
does not evaluate the archived EU-versus-US question.

Run corpus validation from the repository root with the ingest development environment:

```bash
pytest tests
ruff check apps/ingest/src tests scripts
mypy apps/ingest/src
```

Database tests ignore the application's `DATABASE_URL` and run only when
`WRIT_TEST_DATABASE_URL` is set explicitly (an opt-in). It may point at the same database as
`DATABASE_URL` — including the single Neon database — because each suite runs inside a disposable
schema that is created and dropped on teardown and never writes to the public schema.
