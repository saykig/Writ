#!/usr/bin/env python3
from __future__ import annotations

import itertools
import json
import math
from fractions import Fraction
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
DONOR_EXPECTED = Fraction(7_268_121, 10_000)


def load_json(name: str) -> dict[str, Any]:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def exact(value: Any) -> Fraction:
    return Fraction(str(value))


def node_maps(case: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[str]]]:
    nodes = {node["id"]: node for node in case["nodes"]}
    states = {node["id"]: list(node.get("states", [])) for node in case["nodes"]}
    return nodes, states


def table_index(
    rows: list[dict[str, Any]],
    information: list[str],
    *,
    values_key: str,
) -> dict[tuple[str, ...], Any]:
    indexed: dict[tuple[str, ...], Any] = {}
    for row in rows:
        key = tuple(row["given"][parent] for parent in information)
        indexed[key] = row[values_key]
    return indexed


def declared_decision_information(case: dict[str, Any]) -> dict[str, list[str]]:
    return {
        node["id"]: list(node["information"])
        for node in case["nodes"]
        if node["kind"] == "decision"
    }


def check_information_boundary(case: dict[str, Any], result: dict[str, Any]) -> None:
    declared = declared_decision_information(case)
    received = result["information_sets"]
    if declared != received:
        raise AssertionError(
            f"decision information sets changed: declared={declared!r}, received={received!r}"
        )

    _, states = node_maps(case)
    for decision, information in declared.items():
        expected_keys = {
            tuple(combo)
            for combo in itertools.product(*(states[parent] for parent in information))
        }
        seen_keys: set[tuple[str, ...]] = set()
        for row in result["policy"][decision]:
            when = row["when"]
            if set(when) != set(information):
                raise AssertionError(
                    f"policy for {decision} conditions on {sorted(when)} instead of {information}"
                )
            seen_keys.add(tuple(when[parent] for parent in information))
        if seen_keys != expected_keys:
            raise AssertionError(
                f"policy for {decision} does not cover its declared information states"
            )


def policy_map(case: dict[str, Any], result: dict[str, Any]) -> dict[str, dict[tuple[str, ...], str]]:
    declared = declared_decision_information(case)
    mapped: dict[str, dict[tuple[str, ...], str]] = {}
    for decision, information in declared.items():
        mapped[decision] = {
            tuple(row["when"][parent] for parent in information): row["action"]
            for row in result["policy"][decision]
        }
    return mapped


def evaluate_policy_exact(case: dict[str, Any], result: dict[str, Any]) -> Fraction:
    check_information_boundary(case, result)
    nodes, _ = node_maps(case)
    policy = policy_map(case, result)

    probability_tables = {
        node_id: table_index(rows, list(nodes[node_id]["information"]), values_key="values")
        for node_id, rows in case["probabilities"].items()
    }
    utility_tables = {
        node_id: table_index(rows, list(nodes[node_id]["information"]), values_key="value")
        for node_id, rows in case["utilities"].items()
    }

    expected = Fraction(0)

    def walk(
        index: int,
        assignment: dict[str, str],
        probability: Fraction,
        utility: Fraction,
    ) -> None:
        nonlocal expected
        if index == len(case["nodes"]):
            expected += probability * utility
            return

        node = case["nodes"][index]
        node_id = node["id"]
        information = list(node["information"])
        info_key = tuple(assignment[parent] for parent in information)

        if node["kind"] == "chance":
            distribution = probability_tables[node_id][info_key]
            total = sum(exact(value) for value in distribution.values())
            if total != 1:
                raise AssertionError(f"probabilities for {node_id} at {info_key} sum to {total}")
            for state, raw_probability in distribution.items():
                branch_probability = exact(raw_probability)
                assignment[node_id] = state
                walk(index + 1, assignment, probability * branch_probability, utility)
            assignment.pop(node_id, None)
            return

        if node["kind"] == "decision":
            action = policy[node_id][info_key]
            if action not in node["states"]:
                raise AssertionError(f"unknown action {action!r} for {node_id}")
            assignment[node_id] = action
            walk(index + 1, assignment, probability, utility)
            assignment.pop(node_id, None)
            return

        if node["kind"] == "value":
            value = exact(utility_tables[node_id][info_key])
            walk(index + 1, assignment, probability, utility + value)
            return

        raise AssertionError(f"unsupported node kind {node['kind']!r}")

    walk(0, {}, Fraction(1), Fraction(0))
    return expected


def compare_checked_result(case: dict[str, Any], result: dict[str, Any], label: str) -> Fraction:
    exact_expected = evaluate_policy_exact(case, result)
    reported = float(result["expected_utility"])
    if not math.isclose(reported, float(exact_expected), rel_tol=0.0, abs_tol=1e-6):
        raise AssertionError(
            f"{label} reported expected utility {reported}, exact checker obtained {exact_expected}"
        )
    return exact_expected


def expect_result_rejection(case: dict[str, Any], result: dict[str, Any], label: str) -> str:
    try:
        compare_checked_result(case, result, label)
    except AssertionError as exc:
        return str(exc)
    raise AssertionError(f"{label} was accepted for the original Writ case")


def main() -> None:
    case = load_json("case.json")
    writ_result = load_json("writ-result.json")
    direct_result = load_json("direct-result.json")
    memory_leak_result = load_json("memory-leak-result.json")
    order_corruption_result = load_json("order-corruption-result.json")

    writ_expected = compare_checked_result(case, writ_result, "Writ DecisionProgramming adapter")
    direct_expected = compare_checked_result(case, direct_result, "direct donor baseline")

    if direct_expected != DONOR_EXPECTED:
        raise AssertionError(
            f"direct donor baseline changed: expected {DONOR_EXPECTED}, obtained {direct_expected}"
        )
    if writ_expected != direct_expected:
        raise AssertionError(
            f"Writ and direct donor policies differ in exact expected utility: {writ_expected} vs {direct_expected}"
        )
    if policy_map(case, writ_result) != policy_map(case, direct_result):
        raise AssertionError("Writ DecisionProgramming policy differs from the direct donor baseline")

    pyagrum_path = HERE / "pyagrum-result.json"
    if pyagrum_path.exists():
        pyagrum_result = load_json("pyagrum-result.json")
        pyagrum_expected = compare_checked_result(case, pyagrum_result, "Writ pyAgrum adapter")
        if pyagrum_expected != direct_expected:
            raise AssertionError(
                f"pyAgrum and direct donor policies differ in exact expected utility: {pyagrum_expected} vs {direct_expected}"
            )
        if policy_map(case, pyagrum_result) != policy_map(case, direct_result):
            raise AssertionError("Writ pyAgrum policy differs from the direct donor baseline")
        print(
            "Second engine agrees: pyAgrum policy and exact expected utility match DecisionProgramming"
        )

    order_rejection = expect_result_rejection(
        case, order_corruption_result, "order-corrupted lowering"
    )
    print(f"Expected rejection of order-corrupted lowering: {order_rejection}")

    try:
        check_information_boundary(case, memory_leak_result)
    except AssertionError as exc:
        memory_rejection = str(exc)
    else:
        raise AssertionError("full-memory donor result was accepted for the limited-memory Writ case")
    print(f"Expected rejection of full-memory result: {memory_rejection}")

    print(f"Exact checked expected utility: {writ_expected} = {float(writ_expected):.6f}")
    print(
        "Full-memory donor model expected utility: "
        f"{float(memory_leak_result['expected_utility']):.6f} (valid for a different information structure)"
    )
    print("OK: accepted engine results agree; both semantic mutations were rejected")


if __name__ == "__main__":
    main()
