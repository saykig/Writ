# Corpus Encoding Playbook

This is the operating procedure for converting a G7 chapter into a reviewed Covenant package.

## 1. Freeze the chapter source

Capture the PDF or HTML bytes, retrieval metadata, content hash, and a visual rendering of pages containing the commitment, definitions, scoring guidance, tables, and country results.

Output: `DocumentVersion` and `Passage` records.

## 2. Complete the methodology inventory

Create one `methodology-inventory.schema.json` record. Transcribe rather than normalize at first. Record:

- exact commitment text and authority;
- subjects and evaluation window;
- definitions and examples;
- strong, weak, countervailing, excluded, and not-applicable conditions;
- dimensions, goals, partners, artifacts, and temporal maturity;
- action identity and attribution language;
- score prose and tables separately;
- the published subject results;
- every ambiguity or mismatch.

Output: reviewed inventory with page-level anchors.

## 3. Encode the literal methodology

Write a `.covenant` package that preserves the apparent source rule even when it is incomplete. Do not silently repair gaps, precedence, or contradictory prose.

Output: literal package and canonical IR.

## 4. Run static analysis

Run syntax, name, type, time, source, identity, attribution, dimension, artifact, score, and prose-to-metric checks. For bounded score inputs, request concrete counterexamples.

Output: diagnostic report and scenario fixtures.

## 5. Open discrepancies

Every result-affecting defect becomes a discrepancy with a category, source location, witness, blocking status, owner, and review state.

Output: discrepancy ledger.

## 6. Define interpretation profiles

Resolve ambiguities only through named, versioned profiles. Typical decisions include:

- whether announced, authorized, funded, launched, or operational programs count;
- whether collective G7 action is attributed to each member;
- whether counteractions override, net against, or coexist with positive action;
- whether one instrument can create multiple countable actions;
- how “up to four strong actions” is converted into an integer range and how zero-strong cases are handled;
- whether evidence outside the evaluation window may establish continuity;
- what makes a source search sufficient for a negative claim.

Output: reviewed interpretation profile with alternatives and rationale.

## 7. Build the evidence snapshot

For benchmark reproduction, start with evidence disclosed in the published chapter. Convert each factual proposition into a claim linked to an immutable passage, then resolve actions and possible duplicates. Record exclusions rather than deleting candidates.

Output: frozen evidence snapshot.

## 8. Evaluate every subject

Run the literal package first. Then run approved profiles. Save all rule evaluations, qualifying and excluded actions, unresolved and contested dependencies, proof nodes, diagnostics, and hashes.

Output: one receipt per subject and profile.

## 9. Compare with the published result

Classify differences as evidence missing, implicit interpretation, rule gap, rule overlap, prose/metric mismatch, identity ambiguity, attribution ambiguity, temporal ambiguity, extraction error, publication inconsistency, or implementation defect.

Output: benchmark comparison matrix.

## 10. Review and release

Require separate evidence and methodology approval. Freeze the dependency graph, run release gates, generate accessible reports, sign the manifest, and preserve all prior releases.

Output: verifiable release.

## Encoding order for the 2025 corpus

Start with a diversity set rather than twenty similar chapters:

1. AI for SMEs: action classes, count thresholds, counteraction, and identity ambiguity.
2. Middle East: two-dimensional scoring.
3. Biodiversity: dimensions plus goals.
4. Debt: criteria-count scoring.
5. Critical minerals: dimensions, partner coverage, and artifact completeness.
6. Infrastructure: direct partner attribution and domestic-action exclusion.
7. Transnational crime: prose-to-metric discrepancy.

After the language handles these without plug-ins, encode the remaining chapters.

## Review checklist

A chapter is not approved until a reviewer can answer:

- Which exact passage defines every score branch?
- What happens when evidence is unknown or contested?
- Are all branches exhaustive and non-overlapping under declared domains?
- What constitutes one action?
- How are collective and implementing-partner actions attributed?
- Which time axis applies to each condition?
- Are negative conclusions supported by an explicit search protocol?
- Can the computed aggregate be reproduced from receipts alone?
