# Shared-analysis revision proving ground

These are two separately authored synthetic decision cases. Alpha and beta intentionally reuse
local IDs such as `analysis-base`, `source.states`, `subject.problem` and `use.checked`. Only the
wrapper's bundle scope distinguishes those IDs.

Both cases embed the exact v1 source identity
`(writ.source.synthetic-shared-failure-inputs, synthetic-shared-inputs.v1,
sha256:302fc7940f0c2e4e744320abdb76c52b7cba20c9aad6edbefdd316e225b796fa)`.
That source supplies marginals and losses but no dependence premise.

- Alpha explicitly chooses independence. Its exact law is
  `(9/16,3/16,3/16,1/16)` and the pinned checker must find A uniquely optimal with risks
  `(2,5/2,11/4)`.
- Beta leaves dependence unspecified over the exact q segment. The pinned checker must return
  `model_dependent`, not `unresolved`.
- The B-range and C-range analyses are alternatives. Each has its own strictly optimal action; the
  explicit conjunction is incompatible.

The source-only successor changes explanatory wording but not mathematical bytes. The quantitative
successor explicitly changes `P(X=1)` from `1/4` to `1/2`: alpha's retained independence makes B
strictly optimal with risks `(3,5/2,7/2)`, while beta remains model-dependent. The final alpha
successor withdraws independence and therefore has the same exact unrestricted family as beta.

`generate.ts` is the authority for the checked-in fixture files and `fixture-hashes.json`. It
serializes supplied exact constraints; it never solves the decision. The analyst packets were
authored in separate local worker contexts before this common fixture contract was frozen.
