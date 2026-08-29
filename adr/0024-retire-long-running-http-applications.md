# ADR 0024: Retire long-running HTTP applications

**Status:** Accepted

## Context

The runtime audit found no current consumer that requires either the Fastify command API or the
FastAPI ingestion health shell. Writ's compile, validation, bundle, and verification paths operate
directly over reviewed repository sources without an HTTP server or database connection.

## Decision

Writ has no active long-running HTTP application surface. Its current operational core is
repository-native:

source → passage → typed record → human review → uncertainty → provenance

The Fastify command application, its legacy claim/action command layer, the ingestion FastAPI
shell, and the OpenAPI contract are retired. This decision supersedes only the active API portions
of ADR 0013 and the remaining-API retention recorded by ADR 0022; those decisions remain preserved
as historical records.

This decision does not determine the future of Postgres-backed source or artifact storage, the
source registry, or generic source acquisition. Those capabilities remain retained pending a
separate decision based on demonstrated need.

## Consequences

- Native compilation, human-review records, deterministic bundles, and Writ verification remain
  repository workflows.
- Database migrations, storage repositories, registry generation, and acquisition tooling remain
  available without an HTTP application.
- A future HTTP surface must be justified by a current consumer and a separate accepted decision.
