# Internal eCFR paragraph grounding

`ground_ecfr` binds caller-declared frozen document identity, one structured-source selector,
and an explicit extraction profile/transformation to deterministically derived evidence text and
its passage hash. It is an opt-in, pure Python helper alongside the existing verification tools.
It performs no file/network access,
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
syntax. Part and section are resolved structurally: one `DIV5` part and one direct `DIV8` section
by type and number, with the section's JSON `hierarchy_metadata.citation` checked. The direct `P`
subsection is identified by its exact textual parenthesized marker. The captured XML does not
provide a subsection attribute; the selector's `subsection` field is matched against parsed text.
Scope is one lowercase subsection marker and the entire selected `P`; there is no implicit sentence
range, nested-subsection support, or neighboring-text fallback.

After document identity verification, the extraction contract is:

```text
frozen document bytes
→ declared extraction profile
→ parsed source text
→ explicit transformation
→ extracted evidence text
→ UTF-8 evidence representation
→ passage hash
```

Profile **`ecfr-paragraph-remove-marker-v1`** uses Python 3.12 stdlib ElementTree XML parsing
(including XML entity decoding and XML line-ending handling), concatenates `itertext()` in document
order, and retains the parsed/selected text in `raw_extracted_text` before the explicit transformation.
This field contains parsed text, not raw source bytes. Its one explicit transformation removes the exact
prefix `(a) ` (or the selected marker followed by one ASCII space). All remaining characters,
whitespace, punctuation, and trailing text in the parsed text are preserved. The resulting
`evidence_text` is encoded as UTF-8 to produce `evidence_utf8`; SHA-256 of that representation is
`passage_hash`. No additional Unicode or whitespace normalization is applied at encoding/hashing.
The UTF-8 evidence representation is deterministically derived under the profile, not recovered as
a literal byte span or raw byte slice of the XML artifact. The result also retains the selector,
profile, selected element address, and explicit transformation.

Statuses distinguish grounded, absent, ambiguous, invalid identity/XML, hash mismatch, unsupported
media/profile/selector, citation-metadata mismatch, and transformation mismatch. Duplicate sections
or paragraphs remain ambiguous even if their text is identical. Ambiguous results include candidate
element addresses but no selected element, parsed passage text, evidence, transformation, or passage hash.
An invalid transformation preserves its unique selected paragraph and parsed text before transformation,
with no evidence/hash. These statuses describe the helper, not new Writ verifier diagnostics or
acceptance decisions.

The two retained regression oracles are `15 CFR § 285.9(a)` and `15 CFR § 285.9(d)`. Their full
paragraphs' derived text and UTF-8 representations reproduce the approved quotes and passage hashes
after explicit marker removal. Tests read the current Writ source authority and reviewed records
through existing adapters, then compare only after extraction. They also cover source mismatches
before parsing, wrong/absent selectors,
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

This materially adds the previously missing profile-derived passage check for this bounded structured-source
case. It should remain internal until additional sources and callers justify a wider contract.
Nothing here establishes evidentiary sufficiency or corrects approved material.

PR #38 deferred `NIST-HANDBOOK-COMPETENCE-HUMAN-REVIEW-001`. Its frozen PDF says “based on
evaluation”; the earlier approved quotation said “based on the evaluation” and omitted a sentence
without specifying that extent. The maintainer's separate human disposition on 2026-09-04 approved
the complete clause 1.3.5 and only sentence 1 of clause 3.5.3, affirming the unchanged scoped NVLAP
decision right. The successor uses new passage identities and preserves the old record, passages
and approval as superseded history. The disposition and extraction evidence are recorded in
`docs/migrations/nist-handbook-competence/`. This follow-up does not add PDF grounding to this
XML helper or change its verification boundary.
