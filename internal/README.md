# Internal repository support

`internal/` contains active developer-only support machinery:

- `verification/` contains fixtures, benchmarks, conformance cases, and integration/schema suites
  used to prove behavior.
- `tooling/` contains executable repository-maintenance, migration, validation, and development
  commands.
- `infrastructure/` contains operational configuration, generated compatibility projections, and
  database migrations.

Nothing here is a public corpus, normative schema, governing protocol, or user-facing example.
Active political and research knowledge remains under `corpora/`; historical non-authoritative
material remains under `archive/`.
