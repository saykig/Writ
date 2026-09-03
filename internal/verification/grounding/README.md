# Internal eCFR paragraph grounding

`ground_ecfr` binds caller-declared frozen document identity, one explicit structural selector,
and one explicit extraction profile to exact UTF-8 evidence and its SHA-256 hash. It is an opt-in,
pure Python helper alongside the existing verification tools. It performs no file/network access,
model inference, mutation, randomness, or clock reads. The existing Writ verifier is unchanged.

```python
from internal.verification.grounding.ecfr import (
    PROFILE,
    EcfrParagraphSelector,
    ground_ecfr,
)

result = ground_ecfr(
    frozen_xml_bytes,
    source_id="ecfr.title15_cfr_part_285",
    document_version_id="ecfr.title15_cfr_part_285.v2026_08_01",
    document_hash="sha256:b4c06f92e650ea7762d3687419eeb51fc9a8ec506f199e1a39d15772de3e2919",
    media_type="application/xml",
    selector=EcfrParagraphSelector(
        title=15, part="285", section="285.9", subsection="a"
    ),
    extraction_profile=PROFILE,
)
```

The caller supplies source/version authority. The helper verifies the bytes against that declared
hash; it cannot authenticate source/version labels or infer review acceptance. `document_hash`
is populated only when the declared identities are nonempty and the bytes match; the declared and
observed hashes are also retained on failure. A hash mismatch returns before XML parsing.

The selector is a Python value with four fields, not an XPath interpreter or a new Writ locator
syntax. It selects one `DIV5` part, one direct `DIV8` section by type and number, checks the section's
JSON `hierarchy_metadata.citation`, and selects a direct `P` whose text starts with the exact
parenthesized subsection marker. Scope is one lowercase subsection and the entire selected `P`;
there is no implicit sentence range, nested-subsection support, or neighboring-text fallback.

Profile **`ecfr-paragraph-remove-marker-v1`** uses Python 3.12 stdlib ElementTree XML parsing
(including XML entity decoding and XML line-ending handling), concatenates `itertext()` in document
order, and retains that raw extracted text. Its one explicit transformation removes the exact
prefix `(a) ` (or the selected marker followed by one ASCII space). All remaining characters,
whitespace, punctuation, and trailing text are preserved. Hashing uses exact UTF-8 bytes without
Unicode or whitespace normalization. The result exposes `evidence_text`, `evidence_bytes`, and
`passage_hash` along with the selector, profile, selected element address, and transformation.

Statuses distinguish grounded, absent, ambiguous, invalid identity/XML, hash mismatch, unsupported
media/profile/selector, citation-metadata mismatch, and transformation mismatch. Duplicate sections
or paragraphs remain ambiguous even if their text is identical. Ambiguous results include candidate
element addresses but no selected element, raw passage, evidence, transformation, or passage hash.
An invalid transformation preserves its unique selected paragraph and raw text, with no evidence/hash.
These statuses describe the helper, not new Writ verifier diagnostics or acceptance decisions.

The two retained regression oracles are `15 CFR § 285.9(a)` and `15 CFR § 285.9(d)`. Their full
paragraphs reproduce the approved quotes and passage hashes after explicit marker removal. Tests
read the current Writ source authority and reviewed records through existing adapters, then compare
only after extraction. They also cover source mismatches before parsing, wrong/absent selectors,
duplicate matches, repetition, altered quotes, exact whitespace, and visible transformations.

```bash
python -m pytest internal/verification/grounding -q
```

The repository Python suite already collects these tests. Python's standard library is the helper's
only runtime dependency; the integration oracles use the repository's existing Bun dependencies.

This promotes the small XML behavior earned by [Experiment A, PR #37](https://github.com/saykig/Writ/pull/37).
The PDF numeric-clause resolver, PyMuPDF behavior, page heuristics, generic locators, research runner,
report machinery, and large results JSON remain on that research PR. No changes to grammar, schemas,
`@writ/provenance`, corpus material, public APIs, or the existing verifier are needed.

This materially adds the previously missing frozen-byte-to-passage check for this bounded structural
case. It should remain internal until additional sources and callers justify a wider contract.
Nothing here establishes evidentiary sufficiency or corrects approved material.

`NIST-HANDBOOK-COMPETENCE-HUMAN-REVIEW-001` is carried forward in `TASKS.yaml`, ready but deferred.
The approved competence quotation says “based on the evaluation”; the frozen PDF says “based on
evaluation”. Human review must address that mismatch, the unspecified excerpt extent, dependent
approved records, and dependent judgments. This PR performs none of that review. Eventual corrections
must use the existing review/supersession process; approved material is not silently rewritten.
