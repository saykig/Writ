# Dependency version policy

Resolve current stable, mutually compatible releases from official package registries and
documentation, then commit exact lockfiles. Do not copy stale version numbers from archived plans.

Rules:

1. Pin Bun via `.bun-version` and Python via `.python-version` in CI and local development.
2. Commit `bun.lock` and the Python lockfile when one is introduced.
3. Use automated update pull requests, but merge only after conformance and migration tests pass.
4. Treat parser, canonicalization, cryptography, database driver, PDF parser, browser automation, and solver upgrades as review-required changes.
5. Record semantic changes in an ADR and bump the relevant language, schema, or evaluator version.
