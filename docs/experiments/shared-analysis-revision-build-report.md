# Shared-analysis revision implementation report

## Disposition

The build is a working bounded extension of PR 43. PR 43 established one exact decision-case
handoff. This build adds separately authored imports, shared-source inspection, explicit model
disagreement, supplied revision events, bounded dependency impact, scope-bound applicability
reassessment, selected recomputation, exact export, and recipient-side checking of the preserved
candidate.

The selected implementation is a consolidation: retain the smaller native public lifecycle and
adopt only the reuse candidate's deterministic lineage-index mechanics. The portable archive does
not contain the derived index, and replay checks stored candidate bytes rather than solving a
replacement result.

ADR 0028 remains **Proposed**. This implementation does not accept it on behalf of a human reviewer.

## Authority and exact state

- Original task baseline: Writ `a65b4f70e54b7020c6a480c2a39b6735f9151b9d`, which contained the
  PR 43 merge `99c7e4f31bbd3a405e19176b13cd776f4b16a0db` and implementation head
  `5b6bea250e06cedde095fcacc7015f317d0b8700`.
- Intervening main integrated before finalization: PR 46 merge
  `32207b8178f969da04e0133470b33f286c5512ad`.
- Common behavioral-contract commit:
  `d2d0d2618176e897e3bf16d88476b3d80a5b6f31`.
- Native candidate before/after PR 46:
  `58dd884a2f629d871194ab3151605e9d7fc0cc02` / `781581b87abd2b318e57459f7d84d5cc42549466`.
- Reuse candidate before/after PR 46:
  `6851ef4fe98945fc36af94997237614a4ee5bdff` / `175c19cbc961ee622f1b8a833978abafc1660ac7`.
- Selected consolidation implementation:
  `62f0cc2db5cd6fc14ccd35f80b051f91b4b0cd28` plus schema-count integration
  `0fe1cd05e6671e8367ff42e53964647e46f88453`.
- Decision Lab source: `7215b53096bc487756f94f4ca87390716a14f2ee`.
- Aldera source: `9b7d05e9fb2ed11c315e9b6a1dca66e3a8aa9eb4`.
- Bellman reference only: `b1266137f824dc65e614722f1f0592846b915262`.
- Executed runtime: Bun `1.3.12`; CPython `3.13.15`; SciPy `1.17.0`.

The Decision Lab and Aldera source copies were task-owned, pinned, and clean. Bellman, Decision Lab,
Aldera, and their user-local repositories were not modified.

PR 46 moved the original fixture to `examples/decision-cases/failure-choice/`. Its case SHA-256 is
still `232252f443a2c9f410f0271c83ba65fca5b575fc5aac6b15c20ad228b6374d84`, exactly equal on
PR 46 main and the combined branch. Shared fixtures moved to
`examples/decision-cases/shared-analysis-revision/`; the retired root `decision-cases/` and
`archive/` were not recreated.

## Common contract and authorship

The common commit froze the versioned schema, separately supplied alpha/beta fixture bytes, public
lifecycle shape, and positive/negative acceptance tests before candidate implementation. Alpha and
beta authoring packets came from separate local worker contexts. They deliberately collide on local
IDs while differing on dependence assumptions; the coordinator integrated them into one reproducible
fixture generator without merging them into one native case.

Candidate A and candidate B used separate local worktrees and branches at the common commit. The
candidate-A worker completed source review but did not deliver implementation code, so the
coordinator implemented the native candidate in its assigned worktree. The candidate-B worker
independently authored the reuse-oriented candidate. This report does not claim independent
authorship where it did not occur.

Both branches then merged PR 46 independently, preserved their implementation parents, updated live
paths, regenerated manifests from their resulting trees, reran package tests, and were pushed
without PRs.

## Candidate comparison

| Measure | Native candidate | Reuse-oriented candidate |
| --- | --- | --- |
| Implementation commit | `58dd884a…` | `6851ef4f…` |
| Diff from common contract | 3 files; 701 insertions; 36 deletions | 6 files; 1,556 insertions; 33 deletions |
| Offline result before consolidation | 10 pass; 2 integration-gated skips; 42 assertions | 12 pass; 2 integration-gated skips; 45 assertions |
| Real integration | 2 pass; 0 skip; 17 assertions | 2 pass; 0 skip; 17 assertions |
| Main strength | Small, direct Writ lifecycle and lower audit surface | Strong fail-closed validation and isolated deterministic graph mechanics |
| Main cost | Bespoke traversal and fewer boundary checks before consolidation | 1,323-line central contract and roughly 2.2 times the implementation diff |

The reuse candidate's complete path enumeration, duplicate-node conflict detection, lexical
traversal, and cycle failure were useful and nonduplicative. Its parallel larger lifecycle was not.
The selected branch therefore uses the native API/CLI and adds a small `ScopedLineageIndex`, strict
archive/binding validation, and the narrow PR-43 execution recheck boundary. There is no permanent
implementation switch and no concatenated second framework.

## Make, reuse, and adapt record

| Responsibility | Inspected source/version | Used or declined | Writ-owned semantics and evidence |
| --- | --- | --- | --- |
| Exact case/execution bytes, subject bindings, reuse comparison, solving, and checking | Writ `@writ/decision-case`, including PR 43 and `recheckDecisionExecution` | Reused directly | Shared-analysis adds only bundle scope, explicit revision/applicability records, and archive composition. Decision integration: 16 pass, 147 assertions. |
| Canonical hashes and exact JSON | Writ `@writ/provenance` / decision-case identity helpers | Reused directly | Archive identity, source-version conflict checks, and deterministic impact bases use existing SHA-256/canonical primitives. |
| Scoped dependency paths and cycle/conflict behavior | Aldera `src/lineage-graph.ts` at `9b7d05e…`, Apache-2.0 | Adapted narrowly with notice | `ScopedLineageIndex` indexes native case dependencies only; all-path and cycle tests pass. Dataset/entity/activity/store authority was declined. |
| Incremental query engine | [Salsa overview](https://salsa-rs.github.io/salsa/overview.html) | Declined | Rust query storage and memoization add a runtime/cache boundary without a measured incremental workload; external calculation must remain an explicit runner. |
| File workflow reproduction | [DVC `repro`](https://doc.dvc.org/command-reference/repro) | Declined | Stage/cache/lock mutation does not express evidentiary applicability, model disagreement, or a portable reassessment declaration. |
| Derivation/revision vocabulary | [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) | Referenced semantically, no runtime/code adoption | Writ preserves derivation and revision distinctions but keeps its bounded native identifiers and decision semantics. |

No new service, database, global toolchain, package publication, or non-Writ runtime dependency was
introduced.

## Executed lifecycle evidence

The checked proving ground establishes the following through public functions and the pinned
producer/checker:

- Alpha and beta import as separate exact cases. Their colliding local IDs remain scoped to bundle;
  their shared source is recognized only by exact source ID, document-version ID, and SHA-256.
- Alpha's independence model checks A as uniquely optimal. Beta's unrestricted dependence family
  checks as `model_dependent`, not unresolved.
- A wording-only source successor keeps problem/query bytes reusable but requires a new exact
  source-bound applicability declaration.
- Changing `P(X=1)` to `1/2` makes alpha's B uniquely optimal and leaves beta model-dependent; both
  require explicit reassessment before recomputation.
- Withdrawing alpha's independence premise preserves the historical conditional result and checks
  the declared successor as model-dependent.
- Alternative complete support routes remain disjunctive; withdrawing one does not erase the
  other, while contradictory supplied premises remain visible.
- A complete unrelated inventory may establish `unaffected`; omitted ancestry stays
  `not_established`.
- Reversed imports and exact repeated imports are deterministic. Conflicting bundle/source bytes,
  missing route sources, stale applicability bases, missing revised source bindings, noncanonical
  archives, forged archive identities, and cycles fail closed.
- A separate recipient CLI reconstructs impacts and checks every preserved candidate. A real
  integration shim deliberately rejects producer `solve`; replay still passes, proving it uses
  checker `check` on archived candidate bytes.

The compact direct-files Python baseline used the same pinned checker. It reproduced alpha/beta
base outcomes, source-only mathematical reuse, quantitative successor outcomes, and alpha's
independence-withdrawal result. It does not provide scoped identity, conflict refusal, portable
revision/applicability declarations, deterministic reconstructed lineage, or recipient replay;
those are the operations earned by the Writ package.

## Verification evidence

The selected post-PR46 tree passed:

- `bun run format`;
- `bun run lint` across all eight workspaces;
- `bun run typecheck` across all eight workspaces;
- `bun run test` across all workspaces; the shared package reported 12 pass, 2 expected
  integration-gated skips, 0 fail, and 55 assertions;
- `bun run data:check`: 81 records, 16 links, 65 judgments, byte-identical output;
- `bun run verify:writ`: ontology, interoperability, provenance, and integrity all pass with zero
  errors and zero warnings;
- `bun run build` across all eight workspaces;
- `bun run test:decision-integration`: 16 pass, 0 skip, 147 assertions;
- `bun run test:shared-analysis-integration`: 2 pass, 0 skip, 18 assertions;
- `ruff check apps/ingest internal/tooling/scripts internal/verification`: pass;
- `pytest apps/ingest internal/verification`: 75 pass.

The first aggregate test run correctly exposed a stale schema-authority count (28 rather than 29);
the exact guard was updated and the suite rerun. The Python suite also requires Bun on `PATH` (or
`BUN` set); an environment-only failed attempt was rerun with the repository's Bun 1.3.12 and all 75
tests passed.

The original corpus-bearing export was compared with a clean export from the selected branch after
removing commit-bound metadata. The `catalog`, `corpora`, `resources`, `records`, `recordLinks`, and
`recordJudgments` content is identical; both normalized structures hash to
`be1f3bc28ce24154c4d0ef78d51bf46c3f5184095d227a7c2c6b61d82a22e9b1`. Expected metadata changes
are the Writ commit, embedded updated third-party notice, and resulting overall bundle hash
(`sha256:519e2286…` baseline versus `sha256:5221e9ae…` at consolidation commit).

## Remaining limits

- The profile remains `finite-linear-uncertainty.v1` with the existing `decision` and
  `compatibility` operations. It does not add causal, sequential, strategic, safety, or
  authority-to-act semantics.
- Revision events are explicit alternatives assessed against the imported exact basis; v0.1 does
  not infer chronology or automatically choose or chain source versions.
- The rebuildable lineage index enumerates all distinct paths. That is reviewable for the bounded
  DAGs here but can grow exponentially on larger graphs; no unmeasured caching system was added.
- The package records declarations, not authenticated reviewer identity or empirical truth. Human
  disposition and authority remain outside this operation.
- v0.1 does not make one analysis's output an implicit premise of another analysis. Cross-analysis
  interoperability here consists of exact shared evidence, explicit disagreement, scoped revision
  impact, and selected revalidation.
