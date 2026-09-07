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
| `internal/tooling/` | repository maintenance, source-registry, acquisition, migration, and reproduction commands | current product semantics or evidence acceptance |
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

## Retained supporting surfaces

`apps/ingest/` remains active because repository source-registry/tooling code still imports its
registry, URL-policy, acquisition, manifest, validation, vocabulary, and review-queue primitives.
`internal/infrastructure/` contains the reviewed source-registry/vocabulary configuration and its
deterministic generated registry projection.

Source acquisition is caller-controlled. `internal/tooling/scripts/fetch_sources.py` plans by
default and writes exact acquired bytes only to an explicit output path. It reports SHA-256 and
acquisition provenance without modifying a reviewed corpus or conferring evidence acceptance.

Writ has no current database package, migration runner, hosted persistence dependency, corpus
publication service, or long-running HTTP application. Repository and Git artifacts remain the
authority for current corpora, reviews, provenance, and derived decision cases. ADR 0027 records the
implemented persistence retirement as Proposed pending explicit human architectural disposition.

`TASKS.yaml` remains the execution ledger. The human-facing development sequence belongs in
`docs/current/roadmap.md`; completed task history should not silently regain product authority.

## Preservation gate

Repository cleanup must not rewrite reviewed corpus bytes, accepted historical records, prior
execution artifacts, or accepted ADR history merely to make the present tree look simpler. Remove a
surface only when its current consumers and replacement/retention obligations are established.

Current cleanup should optimize for a tree where active files describe active capabilities, while
Git history and migration records preserve how Writ reached them.
