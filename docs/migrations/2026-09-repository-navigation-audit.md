# Repository navigation audit — September 2026

## Result

The tracked root already has a coherent division of responsibility. This audit keeps all eleven
top-level directories, makes their purpose easier to find, and does not move or retire an active or
historical artifact merely to reduce the root count.

The audit was performed at `28e0cd4f2208cc0ba5ca2e34ad474a2784960709` after PR #53. Counts
below describe tracked files at that commit, before the concurrent empirical handoff and
documentation work.

| Root         | Files | Decision            | Evidence for the decision                                                                                                      |
| ------------ | ----: | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/`   |     3 | Keep                | Repository instructions invoke the three reusable Writ skills from this conventional location.                                 |
| `.github/`   |     1 | Keep                | The workflow runs the hosted TypeScript, Python, data, and Writ verification gates.                                            |
| `adr/`       |    29 | Keep                | ADRs preserve durable architecture decisions and historical proposal/acceptance state.                                         |
| `apps/`      |    14 | Keep                | `apps/ingest` is an installed Python package used by CI, acquisition tooling, and verification.                                |
| `corpora/`   |   175 | Keep                | It is the active reviewed source-grounded knowledge authority and is exercised directly by compilers and verification.         |
| `docs/`      |    77 | Simplify navigation | It already groups current guidance, experiments, history, migrations, and verification; its index needed a clearer entry path. |
| `examples/`  |   123 | Keep at root        | Public commands, package tests, frozen receipts, generators, exact cases, and external-run fixtures execute from these paths.  |
| `internal/`  |    64 | Keep                | CI and root commands use its verification suites, source tooling, and operational configuration.                               |
| `packages/`  |   182 | Keep                | Root workspaces build and test the active TypeScript implementations from here.                                                |
| `protocols/` |     2 | Keep                | ADR 0013 and pack validation name `protocols/language/writ.ebnf` as the language protocol authority.                           |
| `schemas/`   |    37 | Keep                | This is the sole active JSON Schema authority; implementations compile or vendor from it.                                      |

The root also contains the expected repository entrypoints and controls: `README.md`, `AGENTS.md`,
`TASKS.yaml`, `MANIFEST.sha256`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, the Bun/Python version and
workspace files, formatting/lint configuration, and a small multi-language `Makefile`. None is a
second product surface.

## Why `examples/` remains at the root

`examples/` is not a loose documentation collection:

- decision-case and shared-analysis tests load exact fixtures from it;
- example generators import one another by repository-relative path;
- the empirical handoff has its own runnable producer, consumer, receiver, and boundary tests;
- user-facing commands run the files in place; and
- retained receipts and manifests name the paths they actually checked.

Moving the directory to `docs/examples/` is possible. Live imports, tests, commands, ignore rules,
the task ledger, and the root manifest could all be updated in one coordinated migration. Frozen
receipts and accepted reports would keep the historical paths they actually checked; they should
not be rewritten merely to make old coordinates look current. Exact file bytes could survive a Git
move, although the repository-level path manifest would necessarily change.

The current judgment is to keep the root: `examples/` signals executable material more clearly than
`docs/examples/`, package tests and public commands use it directly, and the concurrent empirical
handoff is being built there. Moving the surviving decision, simulation, and empirical executables
in the same round would add a wide path migration and validation burden for the modest navigation
gain of removing one root. `docs/README.md` now points newcomers to the executable root directly.
This is a bounded cost/clarity decision, not a claim that the paths can never move.

At the audited commit, the three tracked groups had distinct purposes:

- `decision-cases/` contains public runnable cases and exact checked fixtures;
- `external-simulation/` contains a source-bound third-party example and frozen run evidence reused
  by the decision examples; and
- `assessments/revisable-pilot/` was a completed, executable continuation pilot with frozen
  recipient evidence and a demonstration-only package consumer.

This cleanup retires the completed assessment demonstration after establishing its exact recovery
point. The concurrent AFY work adds `empirical-handoffs/`, which remains in the executable root
while supported. A prose explanation may live under `docs/`, but duplicating a runnable body would
make ownership unclear.

## Retirement and recovery decision

One completed demonstration earned retirement. `packages/assessment-view` is private, no other
package imports it, and its only live inputs are the completed pilot packets. Its product note and
completion report explicitly call the local HTML view disposable and say that ongoing website
maintenance is not warranted. Inclusion in the root workspace and its own regression test proved
that the demonstration replayed; they did not establish a permanent product commitment.

The coordinated cleanup therefore removes `packages/assessment-view` and
`examples/assessments/revisable-pilot` from current `main`. It removes the one-off HTML/CLI and 60
directly browsable evidence files from the active tree. It does not remove the reusable exact
revision, replay, or provenance semantics in `packages/shared-analysis`, `packages/decision-case`,
and `packages/provenance`. A reader who needs to rerun the historical UI, Vela receiver, pilot
receiver, or scoring checks must first recover the snapshot below.

Ignored local environments, build outputs, caches, and `.DS_Store` files are not part of the public
tree and were not deleted to manufacture a smaller repository.

The previously retired EU-US, G7, and G20 bodies remain remotely recoverable through their
immutable tags. The assessment snapshot adds one recovery point without changing those older tags.
The audit confirmed all four targets locally and on `origin`:

| Tag                                      | Commit                                     |
| ---------------------------------------- | ------------------------------------------ |
| `snapshot/eu-us-ai-evaluation-v1`        | `60d5b5e023fb3578db323e424136f3100b561952` |
| `snapshot/g7-2025-ai-sme`                | `9cf9187e07cfa53f019bf33e363447047ca161a4` |
| `snapshot/g20-2024-rio`                  | `8c149002d0e371e4dc3f605bbbbed216f4297189` |
| `snapshot/revisable-assessment-pilot-v1` | `c09922f8a4689284de42b1b1bcc22098fa19c117` |

The lightweight `snapshot/revisable-assessment-pilot-v1` tag was created and independently verified
locally and on `origin` at `c09922f8a4689284de42b1b1bcc22098fa19c117`, where the completed pilot
and package reached their final byte state:

| Historical path                        | Files | Git tree                                   | Relocation-independent SHA-256                                     |
| -------------------------------------- | ----: | ------------------------------------------ | ------------------------------------------------------------------ |
| `examples/assessments/revisable-pilot` |    60 | `ffbdb320b45485bccb520badf5e22d31f81fb26c` | `de021abf955867ac0de06cfd8858a366a8ce07aa1a9fe455cc1e54669e70da07` |
| `packages/assessment-view`             |    10 | `4d2738503b1e887fa4f5da810113a414bb97d60a` | `9df26ff833a8d50f5dbcb66ccc68f7f0ae3954b89ea448038042b734ec530309` |

The SHA-256 construction is the one used by the snapshot ledger: bytewise-sorted relative path,
NUL, exact file contents, NUL. The two trees were unchanged between that finalization commit and
the retirement decision.

Recover both paths into a clean checkout with:

```bash
git checkout snapshot/revisable-assessment-pilot-v1 -- \
  examples/assessments/revisable-pilot packages/assessment-view
```

Likewise, the two-file `protocols/` root is intentionally not folded into `docs/`: it is a checked
normative authority. The one-package `apps/` root remains useful because it separates the Python
application boundary from TypeScript libraries. Either move would be architectural churn rather
than navigation cleanup.

## Changes made

- rewrote `docs/README.md` as a short route into current guidance, capability notes, runnable
  examples, experiment evidence, and history;
- added a newcomer path and explicit keep/simplify classifications to
  `docs/current/repository-structure.md`;
- added this evidence-backed audit so future cleanup starts from recorded consumers and recovery
  obligations instead of repeating a root-count exercise; and
- retired the completed assessment demonstration after creating and remotely verifying its exact
  snapshot, while preserving the reusable provenance and revision packages.

No schema, protocol, corpus, accepted record, numbered version tag, or release was changed by this
audit. The existing task ledger, lockfile, manifest, current guidance, and snapshot ledger are
updated with the retirement in the same coordinated change rather than rewriting frozen evidence.
