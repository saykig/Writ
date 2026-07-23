# System Architecture

## 1. Architecture objective

Keep the scoring core small, deterministic, and independently testable. Put crawling, model assistance, user interfaces, and report prose around that core rather than inside it.

## 2. Logical architecture

```text
                         +----------------------+
                         |  Public source sites |
                         +----------+-----------+
                                    |
                              connector layer
                                    |
+----------------+       +----------v-----------+       +------------------+
| Source registry|------>| Ingestion workers    |------>| Object storage   |
+----------------+       | crawl/extract/archive|       | raw, WARC, parsed|
                         +----------+-----------+       +---------+--------+
                                    |                             |
                                    v                             |
                         +----------------------+                 |
                         | Evidence API and DB  |<----------------+
                         | claims/actions/review|
                         +----------+-----------+
                                    |
                          frozen evidence snapshot
                                    |
+----------------+       +----------v-----------+       +------------------+
| DSL authoring  |------>| Compiler + analyzer |------>| Method bundles   |
| Monaco + LSP   |       | Langium + Z3        |       | IR + source maps |
+----------------+       +----------+-----------+       +---------+--------+
                                    |                             |
                                    +--------------+--------------+
                                                   |
                                           +-------v--------+
                                           | Evaluator core |
                                           | deterministic  |
                                           +-------+--------+
                                                   |
                                           evaluation receipt
                                                   |
                   +-------------------+-----------+------------+----------------+
                   |                   |                        |                |
          +--------v-------+  +--------v--------+     +---------v------+ +-------v------+
          | Analyst Studio |  | Public explorer |     | Report builder | | Release signer|
          +----------------+  +-----------------+     +----------------+ +--------------+
```

## 3. Repository architecture

Recommended monorepo:

```text
apps/
  api/              Fastify API and OpenAPI
  studio/           Next.js, Monaco, evidence review UI
  ingest/           Python worker service and connectors
  public/           optional public explorer, may begin inside studio
packages/
  domain/           generated and hand-written domain types
  schemas/          JSON Schemas and validators
  language/         Langium grammar, LSP, formatter, source maps
  compiler/         AST to canonical IR
  evaluator/        deterministic evaluation and proof engine
  analyzer/         static diagnostics and Z3 lowering
  provenance/       canonicalization, hashes, signatures, PROV export
  report/           deterministic report skeletons and templates
  cli/              compile, analyze, evaluate, diff, publish commands
  test-corpus/      conformance and benchmark fixtures
services/
  optional model gateway
  optional archive gateway
infra/
  compose/
  migrations/
  observability/
```

The included scaffold is intentionally thin. Codex should create packages in this order: domain, schemas, evaluator, analyzer, compiler, language, API, studio, ingest.

## 4. Technology choices

### 4.1 TypeScript for language and evaluation

Reasons:

- Langium and Monaco integration are first-class.
- Shared types across compiler, evaluator, API, and UI.
- Strong ecosystem for JSON Schema, OpenAPI, exact decimals, and browser tooling.
- Easy local and CI execution.

Use the current supported Node LTS selected at implementation time. Pin it in `.tool-versions` or `.nvmrc` and CI.

### 4.2 Langium for the DSL

Use Langium for:

- grammar and parser generation;
- typed AST generation;
- cross-reference linking;
- validation hooks;
- language server;
- VS Code and web-editor integration.

Do not make the generated AST the public IR. The compiler lowers it into versioned canonical JSON.

### 4.3 Custom evaluator

Do not make OPA/Rego, CEL, Soufflé, or a database query the canonical semantics.

A custom evaluator is justified because the product needs:

- four-valued truth;
- uncertain count intervals;
- explicit proof trees;
- source and claim references;
- contested identity;
- deterministic receipt formats;
- publication-specific diagnostics.

Optional exports may target Rego, CEL, Datalog, or LegalRuleML for interoperability and comparison.

### 4.4 Z3 for bounded analysis

Use the `z3-solver` TypeScript package or an isolated analysis service. Lower normalized finite-domain score conditions to SMT. Keep Z3 out of runtime scoring so evaluation remains simple and transparent.

### 4.5 Python for ingestion

Use Python because the best crawling and document-processing libraries are concentrated there.

Recommended packages:

```text
scrapy
playwright
httpx
trafilatura
lxml
selectolax
pymupdf
docling
warcio
pydantic
fastapi
tenacity
rapidfuzz
python-dateutil
dateparser
pytest
hypothesis
```

Use Apache Tika as a service or subprocess fallback, not a mandatory dependency for all development.

## 5. Core TypeScript libraries

Recommended categories and candidates:

### Schema and types

- JSON Schema draft 2020-12 as the interchange authority.
- AJV for runtime validation.
- TypeBox or generated TypeScript definitions only as developer conveniences.
- Do not allow Zod definitions to diverge from the JSON Schema authority.

### Exact values and time

- `decimal.js` or equivalent for exact decimal operations.
- Temporal API or a pinned polyfill for interval-safe date and time behavior.
- Explicit ISO 8601 and RFC 3339 serialization.

### API and database

- Fastify.
- OpenAPI 3.1.
- Kysely or direct SQL with `pg` for PostgreSQL.
- Avoid an ORM that obscures bitemporal queries, JSONB indexes, and append-only event logic.

### Testing

- Vitest.
- fast-check for property-based tests.
- Playwright for browser tests.
- Testcontainers for integration tests where CI permits it.

### Provenance and security

- JOSE implementation for signatures and verification.
- RFC 8785-compatible JSON canonicalizer.
- OpenTelemetry SDK.
- Pino structured logging.

## 6. Data architecture

### 6.1 PostgreSQL

Use PostgreSQL as the transactional source of truth.

Reasons:

- relational integrity for identities, reviews, and releases;
- JSONB for versioned IR and proof trees;
- range types for temporal data;
- full-text search;
- mature indexing and backup;
- optional pgvector for candidate retrieval without a separate vector store.

### 6.2 Object storage

Use S3-compatible object storage for:

- original document bytes;
- WARC files;
- rendered page images;
- extraction artifacts;
- compiled bundles;
- release exports.

Local development uses MinIO or a filesystem adapter.

### 6.3 Search

MVP:

- PostgreSQL full-text search;
- trigram indexes;
- structured filters;
- optional pgvector candidate retrieval.

Add OpenSearch only when corpus scale or query requirements justify operational complexity.

### 6.4 No graph database in the critical path

The domain is graph-shaped, but PostgreSQL can represent relationships and recursive queries. Export JSON-LD or PROV-O for graph consumers. Reconsider a graph store only after measured query pain.

## 7. Database design

Key tables:

```text
institutions
institution_aliases
jurisdictions
summits
documents
document_versions
passages
source_registry_entries
source_fetches
commitment_candidates
commitments
commitment_versions
methodology_packages
compiled_bundles
interpretation_profiles
claims
evidence_links
actions
action_relationships
classifications
reviews
evidence_snapshots
evidence_snapshot_members
evaluation_runs
evaluation_receipts
receipt_dependencies
discrepancies
releases
release_members
audit_events
jobs
```

Use UUIDv7 or ULID identifiers. Store human-readable slugs separately.

### 7.1 Bitemporal pattern

For mutable logical entities, use version rows:

```text
logical_id
version_id
valid_during tstzrange or daterange
recorded_during tstzrange
payload
status
```

Publication references immutable version IDs.

### 7.2 Append-only audit

Audit events include:

```text
event_id
actor_id
event_type
object_type
object_id
before_hash
after_hash
request_id
occurred_at
reason
```

## 8. Service boundaries

### Compiler service or library

Pure package first. Optional API wrapper later.

Inputs: DSL files and lock file.
Outputs: bundle, source map, diagnostics.

### Analyzer

Pure package that consumes normalized IR. Z3 can run in-process or in a sandboxed worker.

### Evaluator

Pure package with no database dependency. API service loads frozen inputs and writes receipts.

### Evidence API

Owns claims, actions, reviews, snapshots, and adjudication state.

### Ingestion workers

Own fetching and extraction artifacts. They can create candidates but cannot accept evidence.

### Model gateway

Optional service that provides a single structured-output interface, prompt registry, model logging, redaction, and policy controls. Keeping it separate prevents model SDKs from leaking into the evaluator.

### Publication service

Creates release manifests, report artifacts, signatures, and public exports.

## 9. Job orchestration

Start with a PostgreSQL-backed job table and idempotent workers. This minimizes infrastructure while source volume is modest.

Job fields:

```text
id
type
payload_hash
payload
state
attempt
available_at
locked_by
lock_expires_at
last_error
result_refs[]
```

Adopt a dedicated durable workflow system only after measured requirements such as large connector fleets, multi-day workflows, or complex cross-service compensation.

## 10. CLI design

Required commands:

```text
covenant init
covenant fmt
covenant check
covenant compile
covenant analyze
covenant test
covenant evaluate
covenant receipt verify
covenant diff methodology
covenant diff evidence
covenant diff receipt
covenant benchmark
covenant release build
covenant release verify
covenant source validate
covenant source fetch
```

CLI output supports human text and JSON. CI uses JSON and stable diagnostic codes.

## 11. Deployment profiles

### Local developer

Docker Compose:

```text
PostgreSQL
MinIO
API
Studio
Ingest worker
optional Tika
optional OpenTelemetry collector
```

The evaluator and compiler also run directly without containers.

### Research team production

- managed PostgreSQL;
- versioned object storage with retention;
- containerized services;
- OIDC provider;
- centralized secrets;
- backups and restore drills;
- monitoring and error tracking;
- signed release pipeline.

### Public read-only deployment

May use a static release bundle plus a read-only API. Public users do not need access to internal workflow tables or restricted source objects.

## 12. Build and supply-chain controls

- lock dependency versions;
- generate SBOMs;
- scan dependencies and containers;
- sign release images and methodology releases;
- pin CI actions by commit where practical;
- separate build and signing identities;
- test restore and reproducibility;
- store evaluator build digest in every receipt.

## 13. Scaling model

Scale along independent axes:

- source connector workers;
- document extraction workers;
- model candidate extraction workers;
- deterministic evaluation jobs;
- read-only public queries.

The evaluator is embarrassingly parallel by commitment and subject. It should not require distributed state.

## 14. Architectural invariants

1. Raw sources are immutable.
2. Accepted evidence is review-gated.
3. The evaluator is pure.
4. A methodology bundle is content-addressed.
5. A release pins all dependencies.
6. Unknown is never silently converted to false.
7. A model cannot publish a score.
8. All score-decisive objects are source-linked or rationale-linked.
9. Prior releases remain replayable.
10. External integrations cannot mutate released artifacts.
