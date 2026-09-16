#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pyagrum as gum

HERE = Path(__file__).resolve().parent


def load_case(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def number(value: Any) -> float:
    text = str(value)
    if "/" in text:
        numerator, denominator = text.split("/", 1)
        return float(numerator) / float(denominator)
    return float(text)


def build_diagram(case: dict[str, Any]) -> gum.InfluenceDiagram:
    diagram = gum.InfluenceDiagram()
    states = {
        node["id"]: list(node.get("states", []))
        for node in case["nodes"]
    }
    state_index = {
        name: {label: index for index, label in enumerate(labels)}
        for name, labels in states.items()
    }

    for node in case["nodes"]:
        name = node["id"]
        kind = node["kind"]
        if kind == "chance":
            diagram.addChanceNode(gum.LabelizedVariable(name, name, states[name]))
        elif kind == "decision":
            diagram.addDecisionNode(gum.LabelizedVariable(name, name, states[name]))
        elif kind == "value":
            diagram.addUtilityNode(gum.LabelizedVariable(name, name, 1))
        else:
            raise ValueError(f"unsupported node kind {kind!r}")

    for node in case["nodes"]:
        for parent in node["information"]:
            diagram.addArc(parent, node["id"])

    for node in case["nodes"]:
        name = node["id"]
        if node["kind"] == "chance":
            rows = case["probabilities"][name]
            table = diagram.cpt(name)
            for row in rows:
                values = [number(row["values"][state]) for state in states[name]]
                if row["given"]:
                    given = {
                        parent: state_index[parent][label]
                        for parent, label in row["given"].items()
                    }
                    table[given] = values
                else:
                    table.fillWith(values)
        elif node["kind"] == "value":
            table = diagram.utility(name)
            for row in case["utilities"][name]:
                given = {
                    parent: state_index[parent][label]
                    for parent, label in row["given"].items()
                }
                table[given] = [number(row["value"])]

    return diagram


def engine_information_sets(
    case: dict[str, Any], diagram: gum.InfluenceDiagram
) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for node in case["nodes"]:
        if node["kind"] != "decision":
            continue
        name = node["id"]
        declared = list(node["information"])
        actual = {
            diagram.variable(parent_id).name()
            for parent_id in diagram.parents(name)
        }
        if actual != set(declared):
            raise AssertionError(
                f"pyAgrum parents for {name} changed: declared={declared}, actual={sorted(actual)}"
            )
        result[name] = declared
    return result


def extract_policy(
    case: dict[str, Any], diagram: gum.InfluenceDiagram, inference: gum.ShaferShenoyLIMIDInference
) -> dict[str, list[dict[str, Any]]]:
    states = {
        node["id"]: list(node.get("states", []))
        for node in case["nodes"]
    }
    policy: dict[str, list[dict[str, Any]]] = {}

    for node in case["nodes"]:
        if node["kind"] != "decision":
            continue
        name = node["id"]
        information = list(node["information"])
        tensor = inference.optimalDecision(name)
        rows: list[dict[str, Any]] = []

        for instantiation in tensor.loopIn():
            if tensor.get(instantiation) <= 0.5:
                continue
            labels = instantiation.todict(withLabels=True)
            if name not in labels:
                raise AssertionError(f"optimalDecision tensor for {name} lacks the decision variable")
            rows.append(
                {
                    "when": {parent: str(labels[parent]) for parent in information},
                    "action": str(labels[name]),
                }
            )

        expected_rows = 1
        for parent in information:
            expected_rows *= len(states[parent])
        if len(rows) != expected_rows:
            raise AssertionError(
                f"optimalDecision tensor for {name} produced {len(rows)} chosen rows, expected {expected_rows}"
            )
        rows.sort(key=lambda row: tuple(row["when"][parent] for parent in information))
        policy[name] = rows

    return policy


def main() -> None:
    case = load_case(HERE / "case.json")
    diagram = build_diagram(case)
    information_sets = engine_information_sets(case, diagram)

    inference = gum.ShaferShenoyLIMIDInference(diagram)
    if not inference.isSolvable():
        raise RuntimeError("pyAgrum reports the LIMID as unsolvable")
    inference.makeInference()

    result = {
        "source": "writ-pyagrum-adapter",
        "engine": {
            "name": "pyAgrum",
            "version": gum.__version__,
            "inference": "ShaferShenoyLIMIDInference",
        },
        "information_sets": information_sets,
        "policy": extract_policy(case, diagram, inference),
        "expected_utility": float(inference.MEU()["mean"]),
        "termination_status": "INFERENCE_COMPLETE",
    }
    (HERE / "pyagrum-result.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"pyAgrum expected utility: {result['expected_utility']}")
    print(json.dumps(result["policy"], indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
