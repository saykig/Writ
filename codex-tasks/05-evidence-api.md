# Build evidence, review, and evaluation APIs

## Instruction

Apply `0001_initial.sql`, add repositories and services, then expose OpenAPI endpoints for sources, document versions, passages, claims, actions, relationships, reviews, methodology bundles, interpretation profiles, evidence snapshots, evaluation runs, receipts, discrepancies, and releases. Add OIDC, role-based permissions, optimistic concurrency, idempotency keys, and immutable audit events.

Acceptance: writes require authenticated roles; review and publication are separated; every evaluation pins immutable dependencies; audit-chain verification catches mutation; OpenAPI contract tests pass.

## Non-goals

Do not redesign settled ADRs without opening a replacement ADR. Do not add broad infrastructure that is not required by the acceptance criteria. Do not hide incomplete behavior behind mocks in production paths.
