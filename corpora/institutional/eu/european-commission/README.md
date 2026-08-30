# European Commission institutional corpus

This draft corpus contains 24 stored atomic institutional records about the European Commission and
its organizational units: 20 are active and human-approved, and four are preserved as superseded
history. It keeps identity, placement, mission, mandate, function, decision-right, and
operational-capacity facts separate. Sara Kim completed the Stage B human review on 2026-08-08 and
the post-NIST transfer-test corrections on 2026-08-30.

The three original AI Office function records retain their assertions, subjects, scope, evidence,
hashes and creation provenance; one received the approved ID revision recorded in the migration
ledger. Seventeen active records were added through the automated proposal phase, along with one
Core `part_of` link from the AI Office to the Commission. Post-NIST review preserved that inherited
link as superseded history and approved a direct successor grounded in recital (6), which places the
Office within the Commission, and Article 1, which places it in DG CONNECT. No inverse is stored.
Human review approved omission of the model-evaluation capacity candidate
because the evidence does not independently establish concrete organizational or technical
machinery; the separate function and decision-right records are approved and remain active.

The same follow-up review approved four record successors. The Commission identity now uses a
self-sufficient Article 13(1) institutional-list passage from a newly registered exact official
source version; the AI Office placement states only the directly evidenced DG CONNECT placement;
the JRC infrastructure capacity is attributed to the Joint Research Centre; and the GPAI mandate's
authority sources are limited to its evidence envelope. Directed Core supersession links keep every
earlier approved record traceable and inactive.

New evidence comes only from identified official EU sources. Source identities, URLs, retrieval
and version metadata, and pinned document hashes are registered in `sources.writ`; records preserve
their exact supporting passages, locators, passage hashes, evidence basis, uncertainty, review, and
provenance. Raw HTML webpage captures are not tracked. The three original AI Act passages and
document version are reused from the legal-policy corpus without modifying its shared source or
passage files. Treaty mandates, functions, decision rights, and maintained capacities are not
treated as interchangeable.

The Commission is represented as a `supranational_institution`; the AI Office remains an
`organizational_unit`. No Commission placement, DG CONNECT identity, holder hierarchy, workforce or
budget capacity, generic operating-status record, or degraded-facility record was created.

All 25 active human-accepted dispositions for this corpus's records and Core links are in
`judgments.writ`; three more accepted dispositions for cross-family links remain in
`cross-family-judgments.writ`. Eight superseded judgments preserve the earlier decisions. The
automated proposal phase, approved ID revisions, approved omission, Core links and post-NIST
corrections are preserved in `migration.yaml`, the review queue and
`docs/migrations/institutional-stage-b/human-review.yaml`. Corpus status remains `draft`;
record-level approval does not itself publish the corpus.
