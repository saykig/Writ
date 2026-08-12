# Writ

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Writ is a system for turning political, technical, and legal research into structured,
traceable knowledge (domain-specific language).

Research in the global affairs and policy space usually ends up spread across reports,
laws, notes and spreadsheets. This makes it difficult to see where a claim came from, compare
institutions consistently or update an analysis when the evidence changes. Writ keeps the source,
the reviewed claim and the resulting analysis connected.

## How Writ works

1. Sources provide the original laws, policies, reports and research.
2. Human-reviewed records capture specific claims and their evidence.
3. Corpora organize those records by jurisdiction or subject.
4. Results retain a trace back to the records and sources that produced them.

## What is available now

The Writ pilot currently includes:

- independent EU and US AI-governance corpora;
- G7 and G20 multilateral policy records;
- a saved EU–US AI-governance query;
- reproducible evaluator benchmarks;
- Writ Lab, where structured records and analyses can be inspected.

Some datasets remain incomplete. Writ records those gaps explicitly rather
than inventing missing evidence.

## Start here

If you work in policy or research:

- Browse `corpora/` to see the reviewed knowledge.
- Browse `queries/` to see the questions asked across that knowledge.
- Read `docs/current/product-definition.md` for the full product model.
- Open Writ Lab to inspect records and their evidence traces.

If you are contributing code:

- Read `AGENTS.md` before making changes.
- Read `docs/current/repository-structure.md`.
- Check `TASKS.yaml` for the active task.
- Use `internal/` for developer-only verification and infrastructure.

## Repository guide

| Path            | What it contains                             |
| --------------- | -------------------------------------------- |
| `apps/`         | Writ’s interfaces and ingestion applications |
| `corpora/`      | Reviewed political and legal knowledge       |
| `queries/`      | Reproducible questions over corpora          |
| `schemas/`      | Rules defining valid Writ records            |
| `protocols/`    | Writ language and API specifications         |
| `packages/`     | Shared application and language code         |
| `docs/current/` | Current explanations and technical guidance  |
| `internal/`     | Developer-only testing and infrastructure    |
| `archive/`      | Historical, non-authoritative material       |

The semantic packages for the domain model, evaluator, analyzer and provenance must remain usable without a network connection or database.

## Run Writ locally

Install [Git](https://git-scm.com/downloads) and [Bun 1.3+](https://bun.sh/docs/installation), then clone the repository and start the web interface:

```bash
git clone https://github.com/saykig/Writ.git
cd Writ
bun install
bun run web
```

Then open `http://localhost:4317` in your browser. Docker is not required to run the web interface; the full development stack uses additional services.

### Full development environment

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

- Keep jurisdictional corpora independent from comparisons and saved queries.
- Keep the implemented `legal_policy` and `institutional` families distinct; add future families
  through explicit family profiles.
- Preserve unknown and contested values instead of forcing a conclusion.
- Treat external ratings as source-reported judgments.
- Make every Writ-derived result reproducible from named and versioned inputs.
- Preserve a trace from each result back to its records and evidence.
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
