# Family extensions

Family extensions add domain fields to the shared core without making those fields universal.
Dependency direction is always from an extension to `schemas/core/`, never between unrelated
families and never from core back to an extension.

| Family        | Classification          | Current schema |
| ------------- | ----------------------- | -------------- |
| institutional | institutional extension | `institutional-record.schema.json` |
| legal/policy  | legal-policy extension  | `legal-policy-record.schema.json`  |
| theoretical   | theoretical extension   | none yet       |
| empirical     | empirical extension     | none yet       |

`record-judgment.schema.json` is a separate analytical judgment object about a target record. Its
workflow states are `proposed`, `accepted`, `contested`, and `superseded`; record approval remains
part of the record workflow and is not a judgment state.

The extensions reference only reusable definitions from `core/record.schema.json`; the core does
not depend on either family.
