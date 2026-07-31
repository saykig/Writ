# Delivery and Acceptance Plan

## Product slices

### Slice A: Semantic kernel

Build schemas, canonicalization, four-valued truth, expressions, score selection, proof receipts, and bounded analysis.

Exit condition: the AI-for-SMEs literal and resolved fixtures behave exactly as specified, with deterministic hashes and witnesses.

### Slice B: Authoring toolchain

Build the Langium parser, compiler, formatter, source maps, scenarios, and editor diagnostics.

Exit condition: the methodology diversity set compiles to golden IR without custom evaluator code.

### Slice C: Governed evidence

Build source snapshots, passage anchors, claims, actions, reviews, identity relationships, interpretation profiles, search protocols, and frozen snapshots.

Exit condition: a reviewer can reconstruct one country result from source bytes to receipt without hand-editing the database.

### Slice D: Benchmark and publication

Encode twenty methodologies, produce 160 receipts, review discrepancies, generate the aggregate report, and sign the release.

Exit condition: every published score either matches or has a reviewed, categorized explanation.

### Slice E: Monitoring

Add connector schedules, change detection, candidate extraction, coverage dashboards, and prospective score diffs.

Exit condition: new evidence can be evaluated without mutating a published release.

## Suggested team shape

This is a planning estimate, not a staffing requirement.

- One technical lead responsible for semantic integrity and architecture.
- One language/evaluator engineer.
- One data and ingestion engineer.
- One product/full-stack engineer.
- One G7 methodology lead.
- Two or more rotating evidence reviewers with relevant language and policy coverage.
- Part-time security, accessibility, and legal/source-rights review.

A smaller team can build the semantic kernel. The full 2025 benchmark becomes review-bound, not code-bound, once infrastructure is stable.

## Effort ranges

These ranges assume experienced contributors and a disciplined scope:

| Milestone | Estimated effort |
|---|---:|
| Semantic vertical slice | 4 to 7 engineer-weeks |
| Language and analyzer diversity set | 6 to 10 engineer-weeks |
| Evidence API and first connectors | 8 to 14 engineer-weeks |
| Analyst Studio minimum useful workflow | 6 to 10 engineer-weeks |
| Full 2025 encoding and evidence review | 20 to 40 researcher-weeks plus engineering support |
| Publication and monitoring hardening | 8 to 14 engineer-weeks |

Parallel work shortens calendar time only after the schemas and truth semantics stabilize.

## Quality gates

| Gate | Required evidence |
|---|---|
| Schema | All valid fixtures pass, invalid fixtures fail with stable paths, migrations are tested. |
| Evaluator | Conformance, property, mutation, determinism, and cross-build replay tests pass. |
| Analyzer | Seeded gaps, overlaps, unreachable rules, identity defects, and prose mismatches are detected with witnesses. |
| Language | All diversity examples parse, format idempotently, type-check, and compile to golden IR. |
| Evidence | All decisive claims have immutable anchors and accepted reviews; negative claims have search protocols. |
| Security | OIDC, role separation, fetch isolation, audit-chain verification, secret scanning, and dependency review pass. |
| Accessibility | Core review paths pass keyboard, screen-reader, contrast, and automated accessibility tests. |
| Benchmark | All 160 cells have receipts or blocking discrepancies; aggregates reproduce from cells. |
| Release | Manifest rebuild, signature verification, tamper tests, and rollback documentation pass. |

## Stop conditions

Pause expansion when any of these occurs:

- the canonical IR changes weekly because the corpus was not studied enough;
- reviewers cannot agree on action identity but the evaluator still emits exact counts;
- model extraction precision is too low to reduce review time;
- source rights do not permit the proposed snapshot strategy;
- published results can be matched only through undocumented exceptions;
- the Studio obscures unknown or contested evidence;
- connector maintenance consumes more effort than evidence review.

Resolve the control-point problem before adding features.

## Success metrics

### Semantic quality

- zero unwaived score gaps or conflicting overlaps in published methodology packages;
- one hundred percent of score inputs have declared identity, attribution, time, and unknown policy;
- deterministic replay across clean environments.

### Research productivity

- median time from discovered source to reviewed action;
- reviewer agreement rate and adjudication time;
- share of candidate actions accepted, rejected, merged, or left unresolved;
- source coverage by member, commitment, language, and source tier.

### Public usefulness

- share of results with a complete proof path;
- time required for an external reviewer to locate decisive evidence;
- number and resolution time of substantive challenges;
- reproducibility success rate for downloaded releases.

Do not optimize score agreement with the benchmark as the sole metric. A system that reproduces a table by hiding assumptions has failed.
