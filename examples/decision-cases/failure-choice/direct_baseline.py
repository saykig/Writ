"""Equal-assurance direct script for the decision-case comparison."""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

from writ_decision_lab.build2.checker import check
from writ_decision_lab.build2.consumer import consume
from writ_decision_lab.build2.engine import produce


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", required=True, type=Path)
    parser.add_argument("--analysis", required=True)
    args = parser.parse_args()
    case = json.loads(args.case.read_bytes().decode("utf-8"))
    analysis = next(item for item in case["analyses"] if item["analysis_id"] == args.analysis)
    problem = base64.b64decode(analysis["mathematical_subject"]["problem"]["content"], validate=True)
    query = base64.b64decode(analysis["mathematical_subject"]["query"]["content"], validate=True)
    candidate = produce(problem, query)
    checked = check(candidate, problem, query)
    displayed = consume(candidate, problem, query)
    print(
        json.dumps(
            {
                "analysis_id": args.analysis,
                "status": checked.status,
                "display": displayed["display"],
                "fresh_exact_check": True,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
