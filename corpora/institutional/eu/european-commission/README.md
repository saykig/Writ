# European Commission institutional corpus

This draft corpus contains 20 human-approved atomic institutional records about the European Commission and its
European AI Office organizational unit. It keeps identity, placement, mission, mandate, function,
decision-right, and operational-capacity facts separate. Sara Kim completed the Stage B human
review on 2026-08-08 and approved all 20 records and the Core relationship link.

The three original AI Office function records retain their assertions, subjects, scope, evidence,
hashes and creation provenance; one received the approved ID revision recorded in the migration
ledger. Seventeen active records were added through the automated proposal phase, along with one
Core `part_of` link from the AI Office to the
Commission. The link is inherited through the directly evidenced DG CONNECT placement, and no
inverse is stored. Human review approved omission of the model-evaluation capacity candidate
because the evidence does not independently establish concrete organizational or technical
machinery; the separate function and decision-right records are approved and remain active.

New evidence comes only from official EU sources captured under `sources/captures/`. The three
original AI Act passages and document version are reused from the legal-policy corpus without
modifying its shared source or passage files. Treaty mandates, functions, decision rights, and
maintained capacities are not treated as interchangeable.

The Commission is represented as a `supranational_institution`; the AI Office remains an
`organizational_unit`. No Commission placement, DG CONNECT identity, holder hierarchy, workforce or
budget capacity, generic operating-status record, or degraded-facility record was created.

All 21 active human-accepted dispositions are in `judgments.writ`. The automated proposal phase,
approved ID revisions, approved omission and Core link are preserved in `migration.yaml`, the
review queue and `docs/migrations/institutional-stage-b/human-review.yaml`. Corpus status remains
`draft`; record-level approval does not itself publish the corpus.
