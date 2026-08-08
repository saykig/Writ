# Cross-family interoperability assessment

## Result

This change establishes a deliberately small draft interoperability layer between legal-policy and
institutional corpora. It creates four Core links and four proposed record-link judgments. None is
human-approved.

The links are stored with the institutional corpus that owns their canonical target. The existing
legal-policy compatibility corpora remain byte-identical. No schema, institutional fact, accepted
judgment, source passage, quotation, identifier, or evidence hash changes.

## Active draft candidates

| Legal-policy record | Corpus | Relation | Institutional target | Evidence | Basis | Confidence | Uncertainty | Human review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `5bf2c350-8a6a-5d44-b73b-d9d9225ecc14` | EU AI Act | `assigns_function_to` | `eu_ai_office` | Article 53(1)(a), passage `32dfed45-b1d4-523c-a426-224fea22a6d3` | direct | high | Request and receipt only; no general implementation, enforcement, capacity, or performance finding | required |
| `456bd51b-75bf-5313-8863-bd6ba767e625` | EU AI Act | `assigns_function_to` | `eu_ai_office` | Article 53(1)(d), passage `f334f6ec-fe5c-5bdb-ac74-0c71cef77a18` | direct | high | Template provision only; no broader authority or capacity finding | required |
| `1d2cfbeb-0e28-5b55-9a75-747e3cdc3efc` | EU AI Act | `assigns_function_to` | `eu_ai_office` | Article 55(1)(c), passage `d17b89de-0b30-547e-84a2-65c5740105ae` | direct | high | Report receipt only; no adjudication or general enforcement finding | required |
| `07e3604d-321e-5621-9fde-357ab058412c` | America’s AI Action Plan | `assigns_function_to` | `nist` | Passage `f6e37323-f678-5515-92bf-475776e887b9` | direct | high | Recommended policy action; no completed implementation, performance, or execution finding | required |

## Resolution and reuse

The resolver uses `corpora/catalog.yaml` and institutional manifests to identify candidate corpora,
then requires exactly one approved atomic identity record. It resolves:

- `nist` to `nist_identity` in `us.institutions.nist`;
- `european_commission` to `european_commission_identity` in
  `eu.institutions.european_commission`;
- `eu_ai_office` to `eu_ai_office_identity` in
  `eu.institutions.european_commission`.

Future corpora can reference these IDs directly. They do not need to reproduce NIST, Commission, or
AI Office entities or remap their names. Missing and ambiguous identities fail rather than falling back
to a path, label, publisher, or root manifest declaration.

## Deferred work

- Add provision-level legal-policy records for AI Act Articles 92 and 101 before creating the intended
  `derives_authority_from` links.
- Establish the complete, time-qualified covered-agency chain before considering OMB-to-NIST
  `applies_to` links.
- Recover and verify the original Commission GPAI guideline and AI Office signatory-notice sources.
- Consider future institutional identities for OMB, the European Parliament, the Council of the
  European Union, and CAISI only after direct evidence and review.
- Resolve the distinct semantics of the White House, White House Office, Executive Office of the
  President, and President before creating any identity.
- Model national competent authorities as individually resolved institutions or an explicit class/set;
  never as one fictitious institution.

The stale `CorpusCatalog.corpora` TypeScript interface remains documented but unchanged because it does
not block the schema-backed `native_corpora` implementation.
