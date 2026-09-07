# ADR 0027: Retire legacy database persistence

**Status:** Proposed

## Context

Writ originally used PostgreSQL for normalized records and JSONB projections, with planned
S3-compatible object storage. After the compliance runtime and long-running HTTP applications were
retired, the remaining `apps/api` package contained database connection and migration code,
repositories for the earlier persisted object model, source-registry and corpus-blob storage, and
database-specific tests. Publication survived through a Phase 1A TypeScript script and an optional
Python Neon path.

The current-consumer audit found that this persistence chain did not serve a current Writ
capability. Native corpora, reviewed records, source artifacts, provenance, deterministic exports,
and derived decision cases are governed by tracked repository artifacts. Their compilation,
verification, export, reload, and checked decision execution require no database connection or
database-owned identity.

Generic source-registry lookup, URL validation, fetch planning, approved live retrieval, supplied
file acquisition, exact bytes, and SHA-256 calculation were separable from persistence and remain
useful.

## Proposed decision

Retire the legacy persistence architecture completely:

- remove `apps/api`, its Postgres client and repositories, migration runner, types, and tests;
- remove the SQL migration tree, Postgres Docker service, database environment variables, root
  database commands, and migration CI job;
- remove the Phase 1A TypeScript corpus publisher and the Python online store;
- remove the `postgres`, `psycopg`, and unused S3 client dependencies that supported the retired
  storage direction;
- keep repository and Git artifacts as the authority for current Writ objects.

Retain `fetch_sources.py` as a narrow caller-controlled acquisition command. Planning remains its
default behavior. Supplied-file or explicitly approved live acquisition requires an explicit output
path, writes exact bytes without overwriting an existing file, and reports SHA-256 and acquisition
provenance. It does not insert into a corpus or imply review or evidence acceptance.

No replacement database, object store, storage abstraction, or publication service is introduced.
Persistence may be reconsidered if a concrete future capability demonstrates access, scale,
coordination, or durability requirements that repository artifacts cannot satisfy.

## Historical continuity

ADR 0006 records why PostgreSQL was originally selected. ADRs 0022 and 0024 record the earlier
runtime and HTTP retirements and the persistence surface that remained afterward. Accepted ADRs,
historical migrations, archived compatibility artifacts, and Git history remain unchanged and
continue to preserve that sequence.

If accepted, this decision supersedes ADR 0006's active PostgreSQL direction and the persistence
retention described by ADR 0024. Implementation of this proposal does not itself constitute human
architectural acceptance.

## Consequences

- Current Writ operation has no database service, credentials, migrations, or hosted publication
  step.
- Native corpus, provenance, verification, export/reload, and decision-case behavior remain
  repository workflows.
- Source acquisition produces caller-owned candidate bytes with explicit provenance; moving those
  bytes into reviewed corpus authority remains a separate human-governed act.
- Historical database artifacts remain recoverable from Git rather than remaining executable on
  the current tree.
