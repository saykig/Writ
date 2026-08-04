# Family extensions

Family extensions add domain fields to the shared core without making those fields universal.
Dependency direction is always from an extension to `schemas/core/`, never between unrelated
families and never from core back to an extension.

| Family        | Classification          | Current schema                     |
| ------------- | ----------------------- | ---------------------------------- |
| institutional | institutional extension | `institutional-record.schema.json` |
| legal/policy  | legal-policy extension  | `legal-policy-record.schema.json`  |
| theoretical   | theoretical extension   | none yet                           |
| empirical     | empirical extension     | none yet                           |

`record-judgment.schema.json` is a separate analytical judgment object about a target record. Its
workflow states are `proposed`, `accepted`, `contested`, and `superseded`; record approval remains
part of the record workflow and is not a judgment state.

Each record extension composes the complete shared `recordBase`, constrains its own `family` with
`const`, and uses JSON Schema 2020-12 `unevaluatedProperties: false` to reject fields evaluated by
neither the base nor the extension. The public core record schema applies the same closure to base
records while accepting future family identifiers. Core does not depend on either family.

Institutional `mandate`, optional `mission`, `functions`, and `operational_capacity` are separate
facts. A mission or function never establishes a mandate, authority, or capacity; each field must
carry its own status and sources. In particular, identity, placement, relationship, and function
records may state `mandate.status` as `unknown`.
