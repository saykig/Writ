#!/usr/bin/env python3
"""Compare an existing DSL prediction with a separately loaded historical label."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from writ_ingest.corpus.benchmark import evaluate_then_compare


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dsl-input", type=Path, required=True)
    parser.add_argument("--generated-prediction", type=Path, required=True)
    parser.add_argument("--official-label", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    dsl_input = json.loads(args.dsl_input.read_text(encoding="utf-8"))
    prediction = json.loads(args.generated_prediction.read_text(encoding="utf-8"))

    def load_official_label() -> dict[str, object]:
        return json.loads(args.official_label.read_text(encoding="utf-8"))

    result = evaluate_then_compare(
        dsl_input=dsl_input,
        predictor=lambda _input: prediction,
        official_label_loader=load_official_label,
    )
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        if args.output.exists():
            parser.error(f"refusing to overwrite benchmark output: {args.output}")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
