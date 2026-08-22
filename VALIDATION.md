# Validation

The active repository uses Bun for TypeScript packages and Python 3.12 for ingestion.

Run the documentation and repository checks from the root:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
bun run conformance
bun run build
```

Python checks use the install and commands defined in `.github/workflows/ci.yml`.

For schema and protocol authority changes:

```bash
bun test packages/domain
PYTHONPATH=apps/ingest/src .venv/bin/pytest -q internal/verification/schema
.venv/bin/python internal/tooling/scripts/validate_pack.py
bun run conformance
```

Authoritative schemas live only under `schemas/`. Runtime vendor copies under
`packages/domain/schemas/` are checked against the path map in
`packages/domain/src/schemas.ts`.

For documentation-only changes:

```bash
bun x prettier --check AGENTS.md README.md PRODUCT.md \
  VALIDATION.md VERSION_POLICY.md TASKS.yaml adr docs internal
git diff --check
```

Also verify that:

- current governing documents use `docs/current/product-definition.md`;
- no active governing document requires a query layer or compliance-product architecture;
- removed planning archives are absent from the tracked tree and current references;
- external ratings are described as source-reported judgments;
- generated files, schemas, runtime code, and corpus records are unchanged.
