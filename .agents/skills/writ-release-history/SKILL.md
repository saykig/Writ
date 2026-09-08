---
name: writ-release-history
description: Maintain Writ's versioned historical record across releases, legacy checkpoints, recovery tags, and frozen snapshots.
---

# Writ release history

Use this skill for version creation, release notes, Git tags, historical reconstruction, release
manifests, snapshots, recovery points, and migration/history cleanup. Read
`docs/history/releases/README.md`, `docs/history/releases/manifest.json`, and the current history
index before assuming which tags or versions exist.

## Namespaces and authority

- `v0.0.x` and future `v0.x.x` identify meaningful completed research, architecture, or capability
  transitions. Do not version every PR or commit.
- `v0.1.0` requires an explicit future maturity decision.
- Existing named checkpoint tags are immutable historical aliases or genuine recovery points. Do
  not create a free-form milestone when the event belongs in the next numbered release.
- `snapshot/*` is reserved for frozen data or artifact recovery history. Snapshots are not Writ
  product versions and do not automatically receive GitHub Releases.

Current named examples include `pre-foundation-reset-2026-08-22`,
`nist-reference-2026-08-29`, `portable-provenance-kernel-2026-09-02`, and
`decision-provenance-foundation-2026-09-05`. Treat the canonical history documentation, rather than
this example list, as authority for future tags and relationships.

## Reconstruct and verify

Use repository evidence at the historical commit. Prefer commits and trees, historical ADR states,
merged PRs, migrations, existing tags, and historical files over current retrospective prose. Do
not make the current architecture appear inevitable or erase failed paths.

Before changing release history:

1. fetch remote tags and release metadata;
2. resolve annotated tags to their underlying commits;
3. check local and remote name collisions;
4. verify every recorded target commit and tree; and
5. compare existing notes, hashes, tag targets, and publication metadata before mutation.

For a numbered release, record only supported identities:

- version and title;
- historical start where applicable;
- exact target commit, commit timestamp, and Git tree;
- canonical release-note path and SHA-256;
- major ADRs and merged PRs;
- relevant named-checkpoint relationships; and
- root-manifest or artifact hashes that can be verified from repository evidence.

Never invent an unavailable identity, rewrite Git history, backdate a commit, forge a tagger date,
or describe a later GitHub publication date as the historical checkpoint date. The target commit
establishes historical time; GitHub records when publication actually occurred.

## Historical narrative

A substantial release note should distinguish what Writ was trying to do, what existed, what
worked, what failed or was falsified, what was retired, what survived, verification available at
the time, known limitations, what changed next, and a clearly labelled current retrospective. Do
not project current checks or architecture backward onto an older tree.

Keep `docs/history/releases/manifest.json` as the machine-readable numbered-version index. Use the
current history documents for alias, recovery, and snapshot relationships instead of duplicating
large ledgers.

## Mutation and publication

Published numbered version tags must not move. Do not delete or rename an existing tag or release
to simplify presentation. Release publication requires explicit human authorization; preparing a
release-history PR does not authorize publication.

When publication is explicitly authorized:

1. create or verify the tag, then confirm its exact target;
2. before `v0.1.0`, publish it as a prerelease unless explicitly instructed otherwise;
3. use the canonical committed release note;
4. avoid redundant source archives or other unsupported assets; and
5. re-fetch and independently verify the resulting tag and GitHub metadata.

Stop rather than publish a partial series if authentication, permissions, collisions, or historical
ambiguity prevent a coherent migration.

Release/history work must remain separate from runtime behavior, schemas and protocols, corpora,
sources, reviewed judgments, decision-case semantics, ADR historical status, Bellman, and Decision
Lab. If one of those must change, split it into another task or PR.
