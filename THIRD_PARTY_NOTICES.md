# Third-party notices

This file records third-party and externally authored material associated with Writ. It does not
change the repository's Apache License 2.0. Rights in the materials below remain with their original
owners.

## Sources and corpora

Writ corpora contain source metadata, anchored excerpts, and source-reported judgments derived from
published laws, policies, standards, reports, and research. Their presence records provenance; it
does not grant new reuse rights in the underlying material.

Historical snapshot tags indexed in `docs/history/snapshots.md` preserve additional source files and
older research artifacts. Users should consult the original publishers' terms before redistributing
source material.

## UCDP-derived provenance fixtures

`packages/provenance/test/fixtures/aldera-ucdp-holdout.json` contains short normalized vectors
derived from Uppsala Conflict Data Program material. The tracked metadata identifies the source and
its Creative Commons Attribution 4.0 license. The fixture retains attribution and does not imply
UCDP endorsement.

## Software

JavaScript and Python dependencies keep their upstream licenses. Exact JavaScript versions are
recorded in `bun.lock`; Python dependencies are declared by the packages that use them.

PyMuPDF, used by the ingestion package, declares AGPL-3.0 or a commercial Artifex license. Review all
resolved dependency licenses again before distributing a combined application.
