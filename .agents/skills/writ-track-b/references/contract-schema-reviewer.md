# Contract and schema reviewer

Evaluate consistency among syntax, compiler output, authoritative JSON Schemas, domain types,
exact version dispatch and validation APIs.

Exercise explicit supported and unsupported versions. Older contracts retain their old meaning;
new fields do not silently upgrade them. Check that grammar additions do not unintentionally take
old identifier positions and that exact identity comparisons do not inherit Unicode normalization
from canonical hashing.

Distinguish parser acceptance, compiler diagnostics and schema validation when they intentionally
own different responsibilities. Treat an undocumented fallback from an unknown exact contract as
a candidate defect, not compatibility.

Report the smallest source or object, each layer result, and the exact authority for the expected
behavior.
