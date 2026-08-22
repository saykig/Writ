# Writ

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Research in global affairs and political science is often spread across reports, laws, notes, and
spreadsheets. This makes it difficult to see where a claim came from, how it was reviewed, or which
distinctions the evidence actually supports. Writ keeps sources, passages, typed records, human
review, and provenance connected.

Writ makes political knowledge more inspectable, reviewable, provenance-preserving, and easier for
humans to reason from without replacing human judgment. This repository is the authoritative home
of the Writ language, corpora, schemas, protocols, verification, and deterministic data-bundle
exporter.

## How Writ works

1. Sources preserve the original laws, policies, reports, and research.
2. Passages anchor the exact evidence used.
3. Typed records state only what that evidence supports.
4. Humans review the records.
5. Provenance preserves the path back to the source.

## What is available now

The current proving ground is the NIST institutional corpus. It tests whether Writ can represent
identity, placement, mission, mandate, function, decision right, and operational capacity without
overclaiming. The repository also retains:

- Legal and policy corpora
- Institutional corpora
- archived G7 and G20 compatibility datasets.

Some datasets remain incomplete. Writ records those gaps explicitly rather
than inventing missing evidence.

## Start here

If you work in policy or research:

- Browse `corpora/` to see the reviewed knowledge.
- Read `docs/current/product-definition.md` for the full product model.

If you are contributing code:

- Read `AGENTS.md` before making changes.
- Read `docs/current/repository-structure.md`.
- Check `TASKS.yaml` for the active task.
- Use `internal/` for developer-only verification and infrastructure.

## Repository guide

| Path            | What it contains                            |
| --------------- | ------------------------------------------- |
| `apps/`         | Writ API and ingestion applications         |
| `corpora/`      | Reviewed political and legal knowledge      |
| `schemas/`      | Rules defining valid Writ records           |
| `protocols/`    | Writ language and API specifications        |
| `packages/`     | Shared application and language code        |
| `docs/current/` | Current explanations and technical guidance |
| `internal/`     | Developer-only testing and infrastructure   |
| `archive/`      | Historical, non-authoritative material      |

The domain, language, provenance, and deterministic data-bundle packages remain usable without a
network connection or database.

## Develop Writ locally

Install [Git](https://git-scm.com/downloads) and [Bun 1.3+](https://bun.sh/docs/installation), then
clone the repository and install its locked dependencies:

```bash
git clone https://github.com/saykig/Writ.git
cd Writ
bun install --frozen-lockfile
```

Run the API development service with:

```bash
bun run dev
```

## Which files are authoritative

Use this order when documents disagree:

1. `AGENTS.md`, unless an accepted replacement decision explicitly supersedes one of its rules.
2. `docs/current/product-definition.md`.
3. Accepted architectural decisions and current JSON Schemas.
4. Current protocol and language specifications.
5. Current product and task documents.
6. Examples and compatibility material.

Material under `archive/` is historical and non-authoritative. Material under `internal/` may verify behaviour, but it is not a public corpus, governing protocol or primary product example.

## Working rules

- Keep corpora and records independent of questions, comparisons, analyses, and presentation
  layers.
- Keep the implemented `legal_policy` and `institutional` families distinct; add future families
  through explicit family profiles.
- Preserve unknown and contested values instead of forcing a conclusion.
- Treat external ratings as source-reported judgments.
- Keep compiled records reproducible from named source files and versioned contracts.
- Preserve a trace from each record back to its evidence.
- Treat visualizations and memos as views, not source records.
- Supersede accepted records instead of silently rewriting them.
- Do not fabricate missing evidence or infer certainty from absent information.

## License

Writ is licensed under the Apache License 2.0. See LICENSE for details.

Copyright 2026 Sara Kim

The Apache License applies to original Writ code and documentation. It does not relicense external
source documents, source passages, published judgments, datasets, dependencies, or third-party
assets. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and rights notes.

## Rights and secrets

Third-party material remains subject to the terms of its original publisher.
Keep credentials in ignored local environment files based on `.env.example`. Never place credentials in corpus records, fixtures, logs or commits.
