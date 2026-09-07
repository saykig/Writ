# Repository structure and ownership

This document explains the active tree and authority boundaries. It is a retention and ownership
map, not a universal knowledge model.

## Active authorities

| Path | Owns | Does not own |
| --- | --- | --- |
| `corpora/` | reviewed native records, source passages, provenance, reviews, and corpus manifests | downstream questions, mathematical models, or recommendations |
| `decision-cases/` | bounded portable derived decision fixtures and immutable case/execution artifacts | source truth, empirical premise validity, or authority to act |
| `schemas/` | active JSON Schema interchange contracts, including analysis-layer decision-case contracts | mathematical theorem authority |
| `protocols/` | Writ language protocol definitions | corpus or Bellman mathematical authority |
| `packages/domain/` | native record/link/judgment contracts | derived mathematical semantics |
| `packages/provenance/` | portable mechanical provenance primitives | domain truth or mathematical proof |
| `packages/decision-case/` | validation, identity, revision, runner and fresh-checking consumer boundary for the currently supported decision profile | general optimization, empirical modelling, or a solver registry |
| `packages/language/` and data/export packages | deterministic authoring/lowering/export tooling | reviewed political data |
| `internal/verification/` | Writ verification gates, grounding checks, fixtures, and integration/schema suites | source or mathematical authority |
| `internal/tooling/` | repository maintenance, source-registry, migration, publication, and reproduction commands | current product semantics |
| `docs/current/` | governing product guidance, roadmap, and current technical documentation | historical migration evidence |

`adr/` preserves architecture decisions. A later decision supersedes earlier active wiring without
rewriting historical ADR text.

## External mathematical authority

Bellman is developed in a separate repository. Its mature mathematical artifacts define the
semantics and guarantees that Writ may progressively implement. Writ should pin and reference those
semantics at an interface rather than duplicate a parallel mathematical archive.

Decision Lab is also separate. The current derived-decision adapter pins one specific Decision Lab
commit and checker profile. That is a replaceable backend boundary, not ownership of Writ's corpus
or Bellman's mathematics.

## Supporting and historical areas

- `archive/` contains non-normative historical pilots and compatibility material. Active runtime
  behavior must not depend on it unless an explicit compatibility test says otherwise.
- `docs/migrations/` preserves completed resets, review dispositions, migrations, and governance
  transitions.
- `.agents/` contains only current reusable agent skills. One-off reviewer-role experiments should
  be retired after their durable lessons are promoted into tests or governing documents.
- `.github/` remains at the root for CI and repository integration.

Application- and package-owned tests remain colocated with their implementations where practical.

## Confirmed retirement target

The completed consumer audit confirms that `apps/api/` is legacy Postgres/Neon persistence
infrastructure and is not required by current Writ functionality. The compiler, verifier,
decision-case layer, corpus authority, language package, provenance layer, and repository-native
workflow do not depend on it as runtime authority.

The remaining legacy surface includes the API connection and repository code, SQL migrations and
database tests, `internal/tooling/scripts/publish_corpus.ts`, optional Python online publication
through `apps/ingest/src/writ_ingest/corpus/online_store.py` and `psycopg`, and Docker/database
environment wiring. Preserve that complete surface in this governance PR and retire it coherently in
a separate bounded cleanup PR.

## Retained supporting surfaces

`apps/ingest/` remains active because repository source-registry/tooling code still imports its
source/registry primitives.

`TASKS.yaml` remains the execution ledger. The human-facing development sequence belongs in
`docs/current/roadmap.md`; completed task history should not silently regain product authority.

## Preservation gate

Repository cleanup must not rewrite reviewed corpus bytes, accepted historical records, prior
execution artifacts, or accepted ADR history merely to make the present tree look simpler. Remove a
surface only when its current consumers and replacement/retention obligations are established.

Current cleanup should optimize for a tree where active files describe active capabilities, while
Git history and migration records preserve how Writ reached them.
