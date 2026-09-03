# Experiment A: frozen document to locator to passage

**Overall conclusion: `CURRENT_LOCATOR_MODEL_INSUFFICIENT`.**

From baseline `7c1ff7cf881236beacb40181a83f320e88d9b4f1`, the two reviewed eCFR
references reproduce exactly after explicitly removing their subsection markers. The two reviewed
Handbook locators each identify one numeric clause range, but neither reproduces its reviewed quote.
The competence quote also contains a word absent from the frozen PDF. Passing experiment tests
confirm these observations; they do not establish grounding success or accept evidence.

The complete, machine-readable observations are in
[`document-passage-grounding-results.json`](document-passage-grounding-results.json).
It contains every raw candidate, selection, physical page, transformation intermediate and hash,
stored quote/hash, exact UTF-8 comparison, source declaration, and control result. JSON strings
preserve trailing spaces, `\n` line breaks, and `\f` page boundaries. No raw text is silently trimmed.

## Inputs and identity checks

Only these existing tracked captures were opened:

| Capture under `corpora/institutional/us/nist/sources/captures/` | Media type | Actual and declared SHA-256 |
| --- | --- | --- |
| `ecfr-15-cfr-part-285.xml` | `application/xml` | `b4c06f92e650ea7762d3687419eeb51fc9a8ec506f199e1a39d15772de3e2919` |
| `nist-handbook-150-2020-update-1.pdf` | `application/pdf` | `7105b9f201a580599b1871fcb7dd9cb5c09b0dcc46bb7e9bd654a960cae65f7e` |

Before invoking either parser, the runner checks bytes against the manifest-routed `sources.writ`
document hash, every selected evidence reference's document hash, and `sources/MANIFEST.sha256`.
It also checks the evidence document-version IDs against the corresponding source declaration.
All agree. These checks establish correspondence with declared frozen identity, not authenticity of
the publisher or the truth of source statements.

The XML source is `ecfr.title15_cfr_part_285`, version
`ecfr.title15_cfr_part_285.v2026_08_01`. The PDF source is `nist.handbook_150`, version
`nist.handbook_150.v2020_update_1`.

There was no network source acquisition or dependency installation. The requested Git baseline was
not present locally and was obtained from the repository remote; GitHub is used for branch/PR
delivery only. Extraction and report reproduction perform no network access.

## Extraction boundary and explicit profiles

The internal API is `ground(document, media_type, locator)`. `document` contains frozen bytes and
declared source/version/hash metadata. It has no quote, passage hash, passage ID, record, judgment,
or expected boundary. The core imports no Writ package. `oracle.ts` uses the existing Writ parser
and manifest-routed source adapter to read the approved references; `run.py` passes only document,
media type, and locator into extraction. All reviewed extractions and repetitions finish before any
quote/hash comparison. Changing every expected quote and its self-hash leaves extraction unchanged.

`resolved` means one candidate under the specified experimental profile. It does not mean the
reviewed passage has been recovered. The post-extraction comparison makes that distinction.

**XML profile `ecfr-subsection-marker-v1`:** parse with Python's stdlib ElementTree; select the
`DIV8` section by `N` and verify its title/section citation metadata; select direct `P` children
beginning with the exact subsection marker. `itertext()` decodes XML entities and preserves text
node order. Save that raw text, then remove precisely `(a) ` or `(d) ` as derived from the locator.
No other whitespace or punctuation transformation is applied. Because the raw element text includes
the marker, these successes are conservatively classified as requiring an explicit profile.

**PDF profile `handbook-numeric-clause-ascii-whitespace-v1`:** reuse the already declared
`apps/ingest` PyMuPDF dependency, with **PyMuPDF 1.28.0 / MuPDF 1.29.0**, calling
`page.get_text("text", sort=False)` on each page. Join page strings with explicit form feeds.
Find line-initial dotted numeric markers equal to the locator's clause number. Select from each
marker to the next non-descendant dotted numeric marker, retaining subordinate clauses. Each match
is a candidate; contents entries are not silently discarded.

For each candidate, record these steps independently of any oracle:

1. Keep the raw range including the numeric marker, line breaks, and any page artifacts.
2. Remove the numeric marker and its following spaces/tabs.
3. Replace runs of ASCII space/tab/CR/LF with one space and trim edge spaces.

Step 3 retains form feeds, headers, footers, hyphens, punctuation, and all sentences. It does not
dehyphenate words, add missing words, select a sentence prefix, remove notes, or resolve a contents
entry against the body. No alternative transformation is selected by checking which one matches
the stored quote.

## Reviewed references and exact comparisons

All four stored quotes pass their own stored passage hashes. Each locator produces one candidate.
Raw text equals none of the four stored quotations; explicit profiles reproduce only the two XML
quotations. “Equal” below requires both exact UTF-8 byte equality and equality with the stored hash.

| Reviewed passage | Locator | Selection | Raw equal | Profiled equal | Classification |
| --- | --- | --- | --- | --- | --- |
| `ecfr.title15_cfr_part_285.section_285_9_a` | `15 CFR § 285.9(a)` | `/DIV5[@N='285']/DIV8[@N='285.9']/P[1]` | No | Yes | `DETERMINISTIC_EXTRACTION_PROFILE_REQUIRED` |
| `ecfr.title15_cfr_part_285.section_285_9_d` | `15 CFR § 285.9(d)` | `/DIV5[@N='285']/DIV8[@N='285.9']/P[4]` | No | Yes | `DETERMINISTIC_EXTRACTION_PROFILE_REQUIRED` |
| `nist.handbook_150.competence` | `NIST Handbook 150:2020, clause 1.3.5` | Physical PDF page 10 / printed page 2 | No | No | `LOCATOR_CONTRACT_INSUFFICIENT` |
| `nist.handbook_150.accreditation_decision` | `NIST Handbook 150:2020, clause 3.5.3` | Physical PDF page 26 / printed page 18 | No | No | `LOCATOR_CONTRACT_INSUFFICIENT` |

Exact hashes (all values have the `sha256:` prefix in the JSON report):

| Passage | Raw extraction hash | Profiled extraction hash | Stored Writ passage hash |
| --- | --- | --- | --- |
| § 285.9(a) | `b1b49cacba9359a57e5d02d5515c82709696dbfb87b1a5b68a2cdcc91aa9d419` | `bad7706f4b4a2bed7afe210bf35e9f890d9960cf30f6477c4fe97fa41917f2c7` | `bad7706f4b4a2bed7afe210bf35e9f890d9960cf30f6477c4fe97fa41917f2c7` |
| § 285.9(d) | `e101763923d418d7ef77b299961ffb9947da0ceac9aadc35b60c386671d08610` | `0be471d591511a1e3a85e410fb5b0c2e1df5b356a44e0cf18164b26682d81f2e` | `0be471d591511a1e3a85e410fb5b0c2e1df5b356a44e0cf18164b26682d81f2e` |
| 1.3.5 | `502a16a334d6dc4ac3719359661c53330f91f8c3e66bd3ce91b2af1437ef45be` | `2e70cc37b645dc6d9004f7b831c7188c9b1b8cdb1da751706e29677f5f78b4a6` | `f6263b3ae31de22e2ba0f486d2092bb154179287ad0a38001a0cf8e3ef054700` |
| 3.5.3 | `b37f70c44f0c2f83faa7b855716a1b6f8a32b4130e8a6975787fdb46377d9156` | `2ae01bbe6b23bd82be976d75ce5caf5dc73a5c1f11967eb9385ff90eafc8f20b` | `cc833bd19e3e1ba753395046a518a87828e00834e22bb72e2e7146dfa79e6ba1` |

### Exact raw XML text

```text
(a) The Chief of NVLAP is responsible for all NVLAP accreditation actions, including granting, denying, renewing, suspending, and revoking any NVLAP accreditation.
```

```text
(d) When accreditation is granted, NVLAP shall provide to the laboratory a Certificate of Accreditation and a Scope of Accreditation,
```

Removing only each four-character marker produces the complete corresponding stored quote.
The comma at the end of subsection (d) is present in the frozen capture itself. It is preserved;
this experiment makes no claim that the capture includes all text in another rendition of the rule.

### Exact raw PDF text

These JSON string literals preserve line endings and trailing spaces exactly:

```json
"1.3.5 \nNVLAP accreditation is based on evaluation of a laboratory’s management and technical \ncompetence for conducting specific tests or calibrations. Accreditation is granted only after thorough \nevaluation of an applicant has demonstrated that all NVLAP requirements have been fulfilled. Fulfillment \nof requirements is acknowledged by the issuance of a Certificate of Accreditation and a Scope of \nAccreditation, which details the specific test methods, calibration parameters, or services for which a \nlaboratory has been accredited. \n"
```

```json
"3.5.3 \nBased on this evaluation, NVLAP makes the decision whether or not to accredit the laboratory. If \nthe evaluation reveals nonconformities beyond those identified in the assessment process, NVLAP \ninforms the laboratory in writing of the nonconformities. The laboratory shall respond as specified in \n3.3.4. All nonconformities must be resolved to NVLAP’s satisfaction before accreditation can be granted. \nNOTE In the event that NVLAP determines accreditation cannot be granted, the laboratory has the right to appeal \nthat decision (see 3.13). \n"
```

In 1.3.5, the stored quote begins “NVLAP accreditation is based on **the** evaluation”. The frozen
PDF says “NVLAP accreditation is based on evaluation”. The rendered page confirms the missing
“the”; this is not a line-wrap artifact. The stored quote also stops before the third sentence,
beginning “Fulfillment of requirements”. The locator supplies neither that sentence boundary nor
permission to add a word. Even a future sentence-range locator would not resolve the wording mismatch.

In 3.5.3, the stored quote is exactly the first sentence after the whitespace profile. The actual
clause continues with nonconformity requirements and a note about appeal. The locator names the
whole clause without specifying a first-sentence excerpt. Selecting the prefix because it equals
Writ's quotation would violate the experiment. No first-sentence-only profile was invented.

## Controls, ambiguity, and boundary findings

| Locator / control | Candidates | Observed result |
| --- | --- | --- |
| `15 CFR § 285.9(e)` | 0 | `no_candidate`; adjacent (d) is not returned |
| `NIST Handbook 150:2020, clause 1.3.99` | 0 | `no_candidate`; adjacent clauses are not returned |
| `NIST Handbook 150:2020, clause 3.5` | 2 | `ambiguous`; contents on physical page 4 and body on page 26; no selected passage/hash |
| `NIST Handbook 150:2020, clause 1.3.2` | 1 | Cross-page probe spans physical pages 9–10, with form feed and next-page publication furniture preserved |
| `NIST Handbook 150:2020, clause 1.12` | 2 | Contents on page 4; body on pages 18–19; raw `NVLAP-\n\f` remains visible at the boundary |
| Repeat each reviewed case and unmodified-document probe three times | Unchanged | Entire grounding objects identical, including candidate ranges, steps, and hashes |
| Alter stored quote after extraction; also replace all quotes and self-hashes before a fresh run | Unchanged | Extracted results unchanged; post-extraction comparisons change |
| Replace byte zero in each document; retain declared identity | 0 | `SOURCE_CAPTURE_MISMATCH`; parser not invoked, no extraction or passage hash |

The five supplementary locator probes have no reviewed quote/hash oracle and are marked
`LOCATOR_CONTRACT_INSUFFICIENT` within that limited scope. Valid absence is a successful negative
control, not a claim that the resolver should find evidence there. The untouched documents are
not classified as source mismatches. The two byte-mutation controls alone produce that finding.

The two body/contents matches are real occurrences in the frozen PDF. A person can distinguish them;
this numeric text profile has no approved rule authorizing that distinction. This is a limitation
of the tested text-resolution contract, not proof that every possible PDF locator would be ambiguous.

None of the four existing reviewed quotations spans an XML structural boundary or PDF page boundary.
The supplementary 1.3.2 and 1.12 probes exercise actual page-crossing material without adding corpus
records or inventing reviewed oracles. Headers/footers appear before body text in MuPDF's unsorted
extraction order even when visually placed at the side/bottom. Joining line breaks does not remove
that furniture. The 1.12 body candidate also includes the following undotted top-level heading `2`
before the dotted `2.1` stop marker. This over-inclusion is an additional known boundary limitation;
the resolver does not claim this ambiguous candidate is a correctly delimited passage.

The hyphenated `NVLAP-` crosses a page boundary. The profile preserves the hyphen, form feed, and page
furniture instead of deciding whether or how to join the word. No hyphenation transformation is
claimed to reproduce a reviewed quotation.

## Reproduction, scope, and promotion recommendation

From the repository root with existing dependencies installed:

```bash
python -m internal.verification.experiments.document_passage_grounding.run --check
python -m pytest internal/verification/experiments/document_passage_grounding -q
```

Use the repository's Python 3.12 environment; set `BUN` to an installed Bun executable if it is not
on `PATH`. To generate observations, omit `--check` and explicitly redirect stdout to a separate
review file. The runner never fetches sources or rewrites any corpus or report itself. `--check`
compares the complete JSON serialization, including engine versions, against the checked-in report.
The reported reproduction is for the recorded PyMuPDF/MuPDF versions. The existing repository
dependency is unpinned; no cross-version or cross-platform reproducibility claim is made. On another
engine version, the snapshot test explicitly skips while the behavior tests still run; `--check`
fails on that engine metadata drift and requires inspection, rather than silently updating the report.

**Recommendation:** keep both resolvers internal. The XML result earns a narrowly scoped follow-up
on explicit structural selection and marker handling, with more frozen documents before considering
promotion. The PDF result requires an explicit passage-extent/extraction contract and investigation
of the stored competence wording through the existing human review process. Neither a public
grounding primitive nor a universal locator model is justified by this experiment. No change to
`@writ/provenance`, schemas, grammar, corpus content, reviews, or decision semantics is made.

## Exact file inventory

| Action | File | Purpose |
| --- | --- | --- |
| Add | `internal/verification/experiments/document_passage_grounding/ground.py` | Quote-free internal resolver and typed results |
| Add | `internal/verification/experiments/document_passage_grounding/oracle.ts` | Existing parser/source adapter reads approved Writ oracles |
| Add | `internal/verification/experiments/document_passage_grounding/run.py` | Offline orchestration, post-extraction comparison, and report checking |
| Add | `internal/verification/experiments/document_passage_grounding/test_grounding.py` | Frozen-source, independence, identity, ambiguity, and reproducibility tests |
| Add | `docs/verification/document-passage-grounding-results.json` | Complete deterministic raw and transformed observations |
| Add | `docs/verification/document-passage-grounding.md` | This report, limitations, and promotion recommendation |
| Change | `TASKS.yaml` | One scoped experiment task and its acceptance gate |
| Change | `MANIFEST.sha256` | Tracked-tree checksum entries for this change |
