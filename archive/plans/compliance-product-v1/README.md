# Compliance product v1 plan archive

This directory preserves the original Writ compliance-product planning pack and its task prompts.
The files are retained unchanged so the research and engineering history remains inspectable.

## What the old plan tested

The plan treated G7 commitment-compliance evaluation as the initial product boundary. It specified
a typed methodology language, four-valued evidence semantics, deterministic score selection,
static gap and overlap analysis, reviewed evidence workflows, content-addressed provenance,
reproducible receipts, a G7 benchmark, and an analyst Studio.

That bounded pilot helped test difficult and still valuable capabilities:

- deterministic derivation over frozen inputs;
- explicit `true`, `false`, `unknown`, and `contested` values;
- exact quantities and explicit identity policies;
- source anchoring, content hashes, and immutable snapshots;
- human review and supersession;
- stable diagnostics and minimized witnesses;
- traces from results to methodology and evidence;
- discrepancies instead of hidden benchmark exceptions.

## Why it is no longer normative

The old plan made one analytical use—commitment compliance and score reproduction—the identity of
Writ. That boundary cannot represent political-science and global-affairs knowledge generally
without forcing obligations, commitments, and scores onto records that do not have them. It also
coupled corpora to particular questions and comparisons.

These documents therefore describe a superseded product hypothesis. They must not be used as
current implementation instructions, schema authority, or product requirements.

## What supersedes it

Current authority begins with:

1. `AGENTS.md`;
2. `docs/current/product-definition.md`;
3. accepted ADRs and current schemas;
4. current protocol, product, and task documents.

The governing definition is:

> Writ is a structured, source-grounded knowledge system and domain-specific language for political
> science and global affairs. It represents claims, institutions, laws, policies, theories,
> empirical findings, evidence and relationships while preserving provenance, scope, uncertainty,
> contestation and revision history. Questions are asked across corpora; they do not define
> corpora.

## Contents

- `docs/plan/` — the original numbered build pack.
- `codex-tasks/` — the original implementation prompts.
- `TASKS.yaml` — the original compliance-product task graph.
- `VALIDATION.md` — validation instructions for that planning pack.

Material governed by separate removal decisions is not included in this archive.
