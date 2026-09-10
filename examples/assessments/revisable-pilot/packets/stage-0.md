# OPERA assessment continuation

Assessment: opera-bounded-2011-2012. Stage: 0.
Question: How should the OPERA anomaly assessment change as the supplied evidence changes?
Standing: experimental analyst artifact; not a native scientific or political record and not a decision-case mathematical operation
Packet schema: writ.experimental-assessment-packet.v1

## S0: 2011-09-23
Record type: source.
CERN reported an apparent excess neutrino speed of about 20 ppm from over 15,000 events. OPERA reported finding no instrumental explanation after checks, while seeking independent measurements before confirmation or refutation.
Declared dependencies: none.
url: "https://home.cern/opera-experiment-reports-anomaly-in-flight-time-of-neutrinos-from-cern-to-gran-sasso/"
date: "2011-09-23"
excerpt: "20 parts per million above the speed of light"
excerpt_sha256: "sha256:086e3d04e52497c673e92a8d768e6d40c559df53e8792d83f0e932f9b2f4d5a7"
parent_sha256: "sha256:406c35afe7c8c5d604e9880305704f61179bb838eb725acf94636ce3412deb29"
parent_byte_span: [220195, 220240]
capture: "2026-09-09; dated section of a current page, not an archived historical edition"

## H1: Genuine propagation effect
Record type: hypothesis.
The apparent anomaly reflects genuinely superluminal propagation. Analyst hypothesis, not an accepted fact.
Declared dependencies: none.

## H2: Timing-chain fault
Record type: hypothesis.
An unrecognized hardware or measurement-chain fault explains the apparent anomaly. Analyst hypothesis.
Declared dependencies: none.

## H3: Statistical or analysis artefact
Record type: hypothesis.
Statistical, pulse-profile or analysis effects explain the apparent anomaly. Analyst hypothesis; this menu is neither exhaustive nor proven mutually exclusive.
Declared dependencies: none.

## A1: Calibration sufficiency
Record type: assumption.
Synthetic analyst Alpha provisionally assumes that the reported checks exclude unrecognized timing-chain faults. This is an analyst premise, stronger than S0.
Declared dependencies: S0.

## D1: Calibration sufficiency is contested
Record type: disagreement.
Synthetic analyst Beta disputes A1: failure to find an instrumental explanation does not exclude unknown timing faults. Both positions are AI-authored analytic positions, not quotations or human endorsements.
Declared dependencies: A1, S0.

## C1: An anomaly merits scrutiny
Record type: interpretation.
S0 supports treating the reported observation as an anomaly to investigate, without establishing H1.
Declared dependencies: S0.

## C2: Conditional exclusion of H2
Record type: interpretation.
Only conditional on A1, Alpha excludes H2 from the working explanation menu. D1 contests the premise. This conditional record must not become an unconditional conclusion.
Declared dependencies: A1, D1, H2.

## Q1: What remains unknown?
Record type: question.
Which explanation survives further measurement, and what unrecognized systematic effects, if any, account for the apparent anomaly?
Declared dependencies: H1, H2, H3.

## B0: Scope of this exercise
Record type: boundary.
Use only the supplied packet and later supplied updates. These are selected dated sections of one publisher page; omitted sections are outside this exercise. Shared provenance is not independent evidence. Hashes bind bytes, not truth. No numeric prior, likelihood, posterior, causal effect, model independence, native mathematical guarantee or authority is supplied. Historical familiarity is possible; this is a continuation task, not a blind forecast.
Declared dependencies: none.

