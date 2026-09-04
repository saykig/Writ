# NIST review-artifact binding: human-review packet

**Gate: AWAITING_REVIEW_BINDING_HUMAN_DISPOSITION**

This packet proposes an application. It is not an accepted native judgment, and no proposed
lineage below is loaded into the corpus by this PR.

The reproduced defect is an unchanged accepted judgment surviving material substitution of its
referenced human-review text after an ordinary checksum refresh. The minimal implementation adds
an optional native judgment `0.3.0` `review_artifact` with separate `path` and `content_hash`, plus
shared exact-byte verification and portable bundle bytes. It proves content association only:
neither identity, human authorship, semantic agreement, sufficient evidence, nor truth.

The exact existing artifact to bind is:

```text
docs/migrations/nist-handbook-competence/human-review.yaml
sha256:75e67171bd28d33e623b8079ae20fb6c92dd7ba7b984c8ddbf8ee940fcd0f713
```

Its bytes remain unchanged. It contains both the successor-record disposition and the separate
supersession-link disposition. Binding new judgment versions to those bytes associates them with
that existing review; it does not claim that the old artifact names or separately authorizes the
new binding lineage. Your new disposition would authorize that application.

| Existing accepted judgment to preserve and supersede | Proposed bound successor | Target, unchanged |
| --- | --- | --- |
| `judgment_nist_nvlap_lab_decision_right_v2_human_review` | `judgment_nist_nvlap_lab_decision_right_v2_bound_review` | record `nist_nvlap_lab_decision_right_v2` |
| `judgment_nist_nvlap_lab_decision_right_v2_supersession_human_review` | `judgment_nist_nvlap_lab_decision_right_v2_supersession_bound_review` | record link `nist_nvlap_lab_decision_right_v2_supersedes_nist_nvlap_lab_decision_right` |

After approval, each existing judgment would retain all content and gain only superseded status
and its successor pointer. Each new `0.3.0` judgment would independently name its predecessor,
retain the target, approval value and evidence references, and carry the exact binding above.
The earlier Sara Kim judgment and its pointer to the preserved unbound successor would remain
unchanged. The new reviewer would be the role “Writ maintainer (explicit human binding disposition)”;
the actual supplied approval and date would be recorded separately. No named person's identity
would be inferred.

The NVLAP assertion, complete three sentences of §1.3.5, sentence 1 of §3.5.3, §285.9(a), source
versions, passage identities, record states, and record-supersession direction would not change.
NIST would have 29 judgments: 22 accepted and seven superseded; its 20 records and seven links
would remain unchanged.

## Exact planned files after approval

Corpus/application files:

- `corpora/institutional/us/nist/judgments.writ` — retirement metadata only on the two identified judgments.
- `corpora/institutional/us/nist/review-binding-judgments.writ` — new `writ 0.3` successor judgments.
- `corpora/institutional/us/nist/corpus.yaml` — new judgment route and revised judgment counts.
- `corpora/institutional/us/nist/migration.yaml` — separate binding-application provenance and lineage.
- `corpora/institutional/us/nist/README.md` — current counts and binding-application explanation.
- `docs/current/nist-proving-ground-audit.md` — current lineage and count view.
- `docs/migrations/nist-handbook-competence/review-binding-human-disposition.yaml` — verbatim newly supplied approval.
- `docs/migrations/review-artifact-binding/experiment-report.md` — record the separately authorized application result.
- `TASKS.yaml` — completion only after application checks.
- `MANIFEST.sha256` — required tracked-byte inventory update.

Concrete regression and snapshot expectations affected by that application:

- `internal/verification/writ/test/nist-handbook-correction.test.ts`
- `internal/verification/writ/test/verifier.test.ts`
- `internal/verification/integration/corpora/test_corpus_family_architecture.py`
- `packages/language/test/corpus-record-contracts.test.ts`
- `packages/language/test/nist-stage-a.test.ts`
- `packages/language/test/institutional-stage-b.test.ts`
- `packages/language/test/cross-family-interoperability.test.ts`
- `packages/data-bundle/test/data-bundle.test.ts`

This list is the proposed application boundary. A newly discovered need beyond it would be
reported rather than silently expanding the approved application. The original human-review
artifact, extraction report, corpus records, links, captures and frozen before fixture are excluded.

## One-paragraph disposition

You can approve the application in one paragraph, for example:

> I approve the two proposed bound successor judgments and their separate supersession lineages
> listed in this packet, each binding the existing NIST human-review artifact at the exact path
> and SHA-256 stated above. Preserve the prior judgments and review history, and retain the
> substantive NVLAP assertion, approved excerpts, evidence identities and record-supersession
> direction unchanged. Record this as my human authorization of the binding application.

Until an explicit disposition is supplied, the existing unbound judgments remain valid and the
demonstrated NIST association gap remains unapplied. No new corpus review object is accepted by
this generic implementation experiment.
