# Use content-addressed provenance

Status: Accepted

## Decision

Every source snapshot, methodology bundle, interpretation profile, evidence snapshot, evaluator build, receipt, and release receives a canonical SHA-256 identifier.

## Consequences

Results must remain reproducible after source pages change. Hashes also make tampering and dependency drift visible.
