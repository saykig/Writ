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

## Decision-object proving case

`experiments/decision-object/first-proving-case/` adapts the four-month Pig Breeding example from
DecisionProgramming.jl 2.0.1. DecisionProgramming.jl is distributed under the MIT License. The
experiment pins upstream commit `105a25ee898cc806db65d5b475e4f1a613265653` and records the donor
source in the experiment README.

The same experiment executes pyAgrum 3.0.0 as a second mathematical implementation. pyAgrum/aGrUM is
distributed under a dual LGPLv3/MIT license. The package is installed as an external dependency and
is not vendored into this repository.

## Probabilistic model-checking proving case

`experiments/decision-object/second-family-model-checking/` adapts the transition structure, action
labels, state labels, and reward values of Stormvogel's published `lion` MDP at release 0.12.3.
Stormvogel is distributed under GPL-3.0.

The experiment executes Storm through `stormpy==1.14.0`. Stormpy is distributed under GPL-3.0 and
provides Python bindings to the Storm model-checking engine. Storm and Stormvogel are installed as
external experiment dependencies; their source trees are not vendored into Writ.

The experiment README and task ledger identify the exact donor versions and how the adapted case is
used. Review the upstream license terms before redistributing a packaged application that includes
these dependencies or adapted upstream material.

## Software

JavaScript and Python dependencies keep their upstream licenses. Exact JavaScript versions are
recorded in `bun.lock`; Python dependencies are declared by the packages or experiments that use
them.

PyMuPDF, used by the ingestion package, declares AGPL-3.0 or a commercial Artifex license. Review all
resolved dependency licenses again before distributing a combined application.
