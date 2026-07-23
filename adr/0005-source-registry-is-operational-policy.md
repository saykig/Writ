# Treat the source registry as operational policy

Status: Accepted

## Decision

Connectors are enabled only after endpoint, authority, license, retention, identifier, and parser verification.

## Consequences

A long list of URLs is not a data pipeline. Verification status and fixture coverage must gate production ingestion.
