# G7 AI-for-SMEs compatibility fixture

This is a compatibility fixture for historical evaluator and scoring behavior. It preserves the
literal, alternative, and resolved methodologies plus their schema and analyzer inputs so current
packages can verify deterministic compilation, diagnostics, evaluation, and receipt behavior.

It is not a current general corpus model and is not Writ's primary demonstration. Authoritative G7
political records remain under `corpora/multilateral/g7/2025-ai-sme/`; the historical score
reproduction remains an internal evaluator benchmark.

- `language/` contains the historical Writ programs.
- `schemas/` contains their expected IR and schema fixtures.
- `analyzer/` contains named analyzer regression cases.
- `demo.sh` runs the compatibility demonstration explicitly.
