# Family extensions

Family extensions add domain fields to the shared core without making those fields universal.
Dependency direction is always from an extension to `schemas/core/`, never between unrelated
families and never from core back to an extension.

| Family        | Classification          | Current schema                     |
| ------------- | ----------------------- | ---------------------------------- |
| institutional | institutional extension | `institutional-record.schema.json` |
| legal/policy  | legal-policy extension  | `legal-policy-record.schema.json`  |

Record judgments are authoritative under `schemas/analysis/record-judgment.schema.json`. Their
workflow states are `proposed`, `accepted`, `contested`, and `superseded`; record approval remains
part of the record workflow and is not a judgment state.

Each record extension composes the complete shared `recordBase`, constrains its own `family` with
`const`, and uses JSON Schema 2020-12 `unevaluatedProperties: false` to reject fields evaluated by
neither the base nor the extension. The public core record schema applies the same closure to base
records while accepting future family identifiers. Core does not depend on either family.

Institutional v0.2 records are atomic discriminated facts. Identity, placement, relationship,
mission, mandate, function, decision-right, and operational-capacity payloads remain separate. A
mission or function never establishes a mandate, authority, or capacity. The frozen v0.1 profile
contract remains available under compatibility.
