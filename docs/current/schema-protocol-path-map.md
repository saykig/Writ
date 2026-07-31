# Schema and protocol path map

This is the complete old-path to new-path map for the schema/protocol authority change.

| Old path | New path | Classification |
| --- | --- | --- |
| `specs/evidence.schema.json` | `schemas/core/evidence.schema.json` | core |
| `specs/source-registry.schema.json` | `schemas/core/source-registry.schema.json` | core |
| `schemas/source_registry_config.schema.json` | `schemas/compatibility/compliance-corpus-v2/source_registry_config.schema.json` | compatibility-only |
| `schemas/corpus_vocabulary.schema.json` | `schemas/core/corpus_vocabulary.schema.json` | core |
| `specs/canonical-ir.schema.json` | `schemas/analysis/canonical-ir.schema.json` | analysis/output |
| `specs/evaluation-receipt.schema.json` | `schemas/analysis/evaluation-receipt.schema.json` | analysis/output |
| `specs/interpretation-profile.schema.json` | `schemas/analysis/interpretation-profile.schema.json` | analysis/output |
| `specs/search-protocol.schema.json` | `schemas/analysis/search-protocol.schema.json` | analysis/output |
| `specs/discrepancy.schema.json` | `schemas/analysis/discrepancy.schema.json` | analysis/output |
| `specs/release.schema.json` | `schemas/analysis/release.schema.json` | analysis/output |
| `specs/methodology-inventory.schema.json` | `schemas/compatibility/g7-benchmark-v1/methodology-inventory.schema.json` | compatibility-only |
| `schemas/assessment.schema.json` | `schemas/compatibility/compliance-corpus-v2/assessment.schema.json` | compatibility-only |
| `schemas/commitment.schema.json` | `schemas/compatibility/compliance-corpus-v2/commitment.schema.json` | compatibility-only |
| `schemas/compliance_report.schema.json` | `schemas/compatibility/compliance-corpus-v2/compliance_report.schema.json` | compatibility-only |
| `schemas/evidence.schema.json` | `schemas/compatibility/compliance-corpus-v2/evidence.schema.json` | compatibility-only |
| `schemas/methodology.schema.json` | `schemas/compatibility/compliance-corpus-v2/methodology.schema.json` | compatibility-only |
| `schemas/reconciliation_manifest.schema.json` | `schemas/compatibility/compliance-corpus-v2/reconciliation_manifest.schema.json` | compatibility-only |
| `schemas/review_item.schema.json` | `schemas/compatibility/compliance-corpus-v2/review_item.schema.json` | compatibility-only |
| `schemas/source_document.schema.json` | `schemas/compatibility/compliance-corpus-v2/source_document.schema.json` | compatibility-only |
| `schemas/source_manifest.schema.json` | `schemas/compatibility/compliance-corpus-v2/source_manifest.schema.json` | compatibility-only |
| `specs/writ.ebnf` | `protocols/language/writ.ebnf` | language protocol |
| `specs/openapi.yaml` | `protocols/api/openapi.yaml` | API protocol |
| `specs/README.md` | `schemas/README.md` and `protocols/README.md` | authority indexes |

The following paths intentionally do not move:

- `packages/domain/schemas/*.schema.json` are generated/runtime vendor copies, not authorities.
- `pilot/eu-us-ai-evaluation/schemas/*.schema.json` remain archived pilot-local until the corpus
  migration branch.
