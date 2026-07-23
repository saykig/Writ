# Use PostgreSQL before a graph database

Status: Accepted

## Decision

Store normalized core records and JSONB projections in PostgreSQL, with object bytes in S3-compatible storage.

## Consequences

The initial access patterns are review queues, versioned objects, joins, full-text search, and reproducible snapshots. Add a graph projection only after measured query pressure justifies it.
