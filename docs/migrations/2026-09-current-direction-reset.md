# 2026-09 current-direction governance reset

This migration aligns Writ's active governance documents with the project state after the bounded
derived decision-case integration entered `main`.

## Current-direction changes

- The North Star is stated directly: make consequential decision-making mathematically inspectable,
  cumulative, and correctable.
- The source-grounded knowledge layer remains independent and governed by its existing record,
  review, and provenance contracts.
- A separate derived decision layer is recognized as current Writ work. Explicit questions and
  mathematical subjects are permitted there because they are part of the guarantee being checked;
  they do not govern source or corpus truth.
- Bellman is named as the mathematical semantic programme that stable Writ decision primitives
  should implement.
- NIST remains the knowledge-layer proving ground but no longer stands in for the entire Writ
  roadmap.
- `TASKS.yaml` remains an execution ledger. The human-facing sequence now lives in
  `docs/current/roadmap.md`.

## Agent retirement

The provisional `.agents/skills/writ-track-b/` review-role experiment and
`docs/current/agent-role-outcomes.md` are retired from the active tree. Their durable findings were
already promoted into production regressions, diagnostics, and repository invariants. Git history
preserves the complete role contracts and outcome table.

This does not remove the general practice of adversarial cross-layer review. It removes one fixed
set of reviewer personas after their experimental purpose was served.

## Retention decisions

- `archive/` stays as historical evidence; active code must not treat it as current authority.
- `docs/migrations/` stays as the history of migrations and completed architecture transitions.
- `apps/ingest` stays because current source-registry and repository tooling still consume it.
- `apps/api` and the retained Postgres/storage surface are **not deleted here**. Current repository
  text already labels them retained pending a future decision. Removing that tested package,
  database migrations, Docker wiring, and dependencies requires a separate consumer/retirement
  audit.
- Accepted ADRs are not deleted when superseded. Newer current docs/ADRs should state what remains
  active while preserving decision history.

No corpus bytes, historical decision-case execution artifacts, or Bellman/Decision Lab repositories
are modified by this governance reset.
