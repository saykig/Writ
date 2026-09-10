# Documentation

## Start here

- [`current/product-definition.md`](./current/product-definition.md) defines what Writ supports now.
- [`current/roadmap.md`](./current/roadmap.md) records the current sequence and exit gates.
- [`current/repository-structure.md`](./current/repository-structure.md) is the path and ownership map.
- [`development.md`](./current/development.md) explains the local checks and change discipline.

The root [`examples/`](../examples/) directory holds runnable examples and exact fixtures. It stays
outside `docs/` because commands and tests execute those files; the examples are not documentation
authority.

## Current capability notes

- [`current/decision-cases.md`](./current/decision-cases.md): bounded derived decision cases.
- [`current/shared-analysis-revision.md`](./current/shared-analysis-revision.md): accepted import,
  revision, reassessment, and replay lifecycle.
- [`current/decision-episodes.md`](./current/decision-episodes.md): accepted decision episodes.
- [`current/external-and-linked-episodes.md`](./current/external-and-linked-episodes.md): bounded
  external simulation and linked episodes.
- [`current/simulation-to-decision.md`](./current/simulation-to-decision.md): exact supplied
  simulation comparisons.
- [`current/review-artifact-binding.md`](./current/review-artifact-binding.md): exact review-byte
  association.
- [`current/nist-proving-ground-audit.md`](./current/nist-proving-ground-audit.md): current NIST
  reference audit.
- [`current/data-model.mmd`](./current/data-model.mmd): source-grounded record model.

## Decisions, evidence, and history

Accepted and proposed architecture decisions live in the root [`adr/`](../adr/) directory.
[`experiments/`](./experiments/) retains bounded build and acceptance evidence;
[`verification/`](./verification/) describes the verification boundary. Historical releases and
recovery points are indexed under [`history/`](./history/), while [`migrations/`](./migrations/)
records completed repository, data, and governance transitions.
