# Dependency version policy

At bootstrap, resolve current stable, mutually compatible releases from official package registries and documentation, then commit exact lockfiles. Do not copy stale version numbers from this planning pack.

Rules:

1. Pin the Node and Python runtime in CI and local development files.
2. Commit `pnpm-lock.yaml` and the Python lockfile.
3. Use automated update pull requests, but merge only after conformance and migration tests pass.
4. Treat parser, canonicalization, cryptography, database driver, PDF parser, browser automation, and solver upgrades as review-required changes.
5. Record semantic changes in an ADR and bump the relevant language, schema, or evaluator version.
