# Repository structure and ownership

This document explains the active tree and authority boundaries. It is a retention and ownership
map, not a universal knowledge model.

## Finding your way around

For a first visit:

1. read the root `README.md` for one runnable path;
2. use `docs/README.md` to find current guidance and historical evidence;
3. use `examples/README.md` for executable examples;
4. go to `packages/` or `apps/` only when changing implementation; and
5. treat `schemas/`, `protocols/`, `adr/`, and `corpora/` as governed authorities rather than
   miscellaneous support folders.

The active root is deliberately short, but not flat. Its eleven tracked directories separate public
contracts and evidence from implementations, internal checks, examples, documentation, repository
automation, and agent guidance. The [September 2026 navigation audit](../migrations/2026-09-repository-navigation-audit.md)
records why each root remains and why moving `examples/` under `docs/` was rejected.

## Active areas and authority boundaries

| Path         | Classification      | Owns                                                                                                                | Does not own                                                                       |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `.agents/`   | keep                | current reusable repository skills                                                                                  | one-off reviewer roles or product authority                                        |
| `.github/`   | keep                | hosted repository checks                                                                                            | Writ semantics                                                                     |
| `adr/`       | keep                | architecture decisions and their historical status                                                                  | implementation or release publication                                              |
| `apps/`      | keep                | language-specific application boundaries; currently the Python ingestion package                                    | schema, corpus, or review authority                                                |
| `corpora/`   | keep                | reviewed native records, source passages, provenance, reviews, and corpus manifests                                 | downstream questions, mathematical models, or recommendations                      |
| `docs/`      | simplify navigation | current guidance, bounded experiment reports, migrations, verification notes, and release/recovery history          | runtime contracts or executable fixtures                                           |
| `examples/`  | keep at root        | runnable illustrative material, including bounded portable decision fixtures and immutable case/execution artifacts | source truth, normative contracts, empirical premise validity, or authority to act |
| `internal/`  | keep                | developer-only verification, tooling, fixtures, and operational configuration                                       | public API or semantic authority                                                   |
| `packages/`  | keep                | TypeScript libraries, commands, tests, and package-owned generated copies                                           | reviewed political data                                                            |
| `protocols/` | keep                | Writ language protocol definitions                                                                                  | corpus or Bellman mathematical authority                                           |
| `schemas/`   | keep                | active JSON Schema interchange contracts, including analysis-layer contracts                                        | mathematical theorem authority                                                     |

Within `packages/`, authority stays narrow:

| Path                                          | Owns                                                                                                                                                                                         | Does not own                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/`                            | native record/link/judgment contracts                                                                                                                                                        | derived mathematical semantics                                                                                                                             |
| `packages/provenance/`                        | portable mechanical provenance primitives                                                                                                                                                    | domain truth or mathematical proof                                                                                                                         |
| `packages/decision-case/`                     | validation, identity, revision, runner and fresh-checking consumer boundary for the currently supported decision profile                                                                     | general optimization, empirical modelling, or a solver registry                                                                                            |
| `packages/shared-analysis/`                   | scoped import, disagreement inspection, explicit revision impact, applicability reassessment, selected recomputation, portable replay, and the accepted bounded decision-episode composition | source truth, automatic source selection, authenticated review, outcome evaluation, causal inference, workflow management, or a second mathematical engine |
| `packages/language/` and data/export packages | deterministic authoring, lowering, and export tooling                                                                                                                                        | reviewed political data                                                                                                                                    |

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

- `docs/history/snapshots.md` indexes retired historical bodies by exact Git tag, historical path,
  file count, digest, and recovery command. Those snapshots are absent from the current tree and are
  not runtime authorities.
- `docs/migrations/` preserves completed resets, review dispositions, migrations, and governance
  transitions.
- `examples/` remains runnable illustrative material. Its portable case identities and exact
  execution bytes are protected fixtures, not reviewed corpora or semantic authorities.
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
publication service, long-running HTTP application, or tracked archive root. Repository artifacts
remain the authority for current corpora, reviews, provenance, and derived decision cases; Git tags
preserve the retired historical snapshots. ADR 0027 records the implemented persistence retirement
as Proposed pending explicit human architectural disposition.

`TASKS.yaml` remains the execution ledger. The human-facing development sequence belongs in
`docs/current/roadmap.md`; completed task history should not silently regain product authority.

## Preservation gate

Repository cleanup must not rewrite reviewed corpus bytes, accepted historical records, prior
execution artifacts, or accepted ADR history merely to make the present tree look simpler. Remove a
surface only when its current consumers and replacement/retention obligations are established.

Current cleanup should optimize for a tree where active files describe active capabilities, while
Git history and migration records preserve how Writ reached them.
