# Corpus-family foundation migration

This migration replaces the transitional EU and US subject-based AI corpus directories with
family-first issuer-and-instrument corpora. `pre-migration-inventory.json` records the stable
identities, reviewed claim values, hashes, workflow states and protected-tree digests at
`296f79f91f3d5d64b9b7f8f6b6866df881e7e868`.

The migration is governed by ADR 0017. The inventory is generated deterministically with:

```bash
bun internal/tooling/scripts/corpus_family_inventory.ts \
  --output docs/migrations/corpus-family-foundation/pre-migration-inventory.json
```
