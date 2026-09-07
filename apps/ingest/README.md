# Writ ingestion

The ingestion package retains generic, source-gated acquisition, registry, manifest, vocabulary,
and review-queue primitives. It has no active G7, G20, EU–US, or constitutional corpus adapter.
The active NIST institutional corpus is compiled from its reviewed repository sources; this package
does not regenerate its substantive content.

`internal/tooling/scripts/fetch_sources.py` defaults to a dry-run fetch plan. Supplied-file or
explicitly approved live acquisition writes exact bytes only when the caller provides `--output`.
The command reports SHA-256 and acquisition provenance, refuses to overwrite an existing file, and
does not insert bytes into a corpus or treat acquisition as evidence acceptance.

Run corpus validation from the repository root with the ingest development environment:

```bash
PYTHONPATH=apps/ingest/src .venv/bin/pytest apps/ingest/tests internal/verification/integration/ingestion
.venv/bin/ruff check apps/ingest/src apps/ingest/tests internal/tooling/scripts internal/verification
.venv/bin/mypy apps/ingest/src
```
