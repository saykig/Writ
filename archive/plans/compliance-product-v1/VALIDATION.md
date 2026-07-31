# Validation

Run from the pack root:

```bash
python -m pip install -r scripts/requirements.txt
./scripts/validate_pack.sh
```

The command checks:

- required handoff files;
- JSON syntax;
- JSON Schema validity and all paired examples;
- YAML task IDs and dependencies;
- text-policy constraints;
- TypeScript compilation and semantic tests in `reference-core/`.

The bootstrap Langium grammar is intentionally not compiled by this pack. Completing and validating it is task `LANG-001` after the canonical IR and evaluator contracts stabilize.
