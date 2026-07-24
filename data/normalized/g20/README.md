# G20 normalized candidate layer

Normalized corpus records use the version `2.0.0` contracts for identified commitments, assessment
selections, compliance reports, and member compliance assessments. This directory contains policy
documentation only; no Rio records are present.

Commitments carry neither selection nor score fields. Published historical results remain separate
from Writ-computed results, and `unresolved` is valid only for Writ evaluations. Exact source
wording is retained, while proposed or unmapped terminology enters review rather than being guessed.
Historical labels remain expert-assigned historical scores and cannot transfer automatically to new
commitments.

The G20 2024 Rio adapter is implemented. It parses the interim and final G20 Research Group
compliance reports into version `2.0.0` records without inferring any score. The canonical
normalized set is published to the append-only Neon store; a frozen review copy lives under
`benchmark/2024-rio-g20/normalized/`. This directory stays documentation-only and holds no records.
