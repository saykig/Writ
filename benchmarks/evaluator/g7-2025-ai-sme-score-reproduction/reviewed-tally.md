# AI-for-SMEs benchmark — reviewed 8-member tallies (source: G7 2025 ch.4, sha256:9e88bb36...)

Resolved methodology: +1 iff strong>=5 ; 0 iff (weak in 3..4) or (strong<=4) ; -1 iff weak<=2 or counter.
distinct_by underlying_instrument_id.

| member         | strong | weak | counter | published | computed | interpretation call                                                                                                                                   |
| -------------- | ------ | ---- | ------- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| canada         | 16     | 4    | false   | +1        | +1       | none                                                                                                                                                  |
| france         | 7      | 0    | false   | +1        | +1       | none                                                                                                                                                  |
| germany        | 7      | 4    | false   | +1        | +1       | none (5+ solid)                                                                                                                                       |
| italy          | 8      | 3    | false   | +1        | +1       | none (6 solid)                                                                                                                                        |
| japan          | 3      | 4    | false   | 0         | 0        | YES — 2 general AI laws (AI Act 1 Sep; first basic AI plan 22 Dec) read as WEAK, not strong. Counting them strong => 5 strong => +1 (would mismatch). |
| united_kingdom | 11     | 3    | false   | +1        | +1       | none (9+ solid)                                                                                                                                       |
| united_states  | 3      | 3    | false   | 0         | 0        | YES — strategy docs (AI Action Plan, Genesis Mission, Nat'l Policy Framework) read as WEAK (report's own 'recommendation phase / indirect' language). |
| european_union | 8      | 3    | false   | +1        | +1       | none (7-8 solid)                                                                                                                                      |

All 8 reproduce the published cell under the resolved methodology + the "general non-SME AI measures are weak" interpretation.
Discrepancy ledger entries: japan + united_states => category "implicit analyst interpretation" (interpretation-profile-sensitive).
Full per-action evidence (dates, descriptions, quotes, report pages) captured by the benchmark-extractor agent transcript.
