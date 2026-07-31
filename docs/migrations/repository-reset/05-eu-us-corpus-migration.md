# EU and US corpus migration

The hash-pinned combined review input was split into independent EU and US jurisdictional corpora.
The original pilot remains exactly recoverable under
`archive/pilots/eu-us-ai-evaluation-v1/original/`.

## Preservation counts

| Material | Before | EU corpus | US corpus | Preserved total |
| --- | ---: | ---: | ---: | ---: |
| reviewed parent annotations | 24 | 12 imported reviews | 12 imported reviews | 24 |
| atomic substantive claims | 32 | 15 | 17 | 32 |
| accepted review decisions | 24 | 12 | 12 | 24 |
| verified source documents | 10 | 1 | 9 | 10 |
| anchored source passages | 22 | 10 | 12 | 22 |
| explicitly unresolved source rows | 3 | 2 | 1 | 3 |
| `unknown` enforcement values | 12 | 12 | 0 | 12 |
| unique legacy row/claim references | 38 | 17 | 21 | 38 |

The 24 parent annotations remain review/grouping records. The 32 atomic claims are the only
substantive active claim records, so leaf parents are not duplicated as second claims.

## Identifier maps

The complete old-to-new maps are:

- `corpora/jurisdictions/eu/ai-governance/migration-map.yaml`
- `corpora/jurisdictions/us/ai-governance/migration-map.yaml`

Every legacy identifier resolves exactly once. Bundle parent identifiers resolve to imported review
groups; leaf parent identifiers and child identifiers resolve to substantive claims.

The corrected Article 55 mapping remains:

| Official locator | Legacy reference |
| --- | --- |
| Article 55(1)(a) | `EU-06` |
| Article 55(1)(b) | `EU-07` |
| Article 55(1)(c) | `EU-08` |
| Article 55(1)(d) | `EU-09` |

The temporary Article 51 and Article 52 rows remain excluded. Their removal evidence is retained in
the archive and the EU reconciliation record.
