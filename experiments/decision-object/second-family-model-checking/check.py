#!/usr/bin/env python3
from __future__ import annotations

import itertools
import json
import math
from fractions import Fraction
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent


def load_json(name: str) -> dict[str, Any]:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def exact(value: Any) -> Fraction:
    return Fraction(str(value))


def states_by_id(case: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {state["id"]: state for state in case["model"]["states"]}


def target_state(case: dict[str, Any], query: dict[str, Any]) -> str:
    state = query["stop_state"]
    if state not in states_by_id(case):
        raise AssertionError(f"stop state {state!r} is absent from the Writ model")
    return state


def transition(case: dict[str, Any], state: str, action: str) -> dict[str, Fraction]:
    raw = case["model"]["transitions"][state][action]
    result = {target: exact(probability) for target, probability in raw.items()}
    if sum(result.values()) != 1:
        raise AssertionError(f"transition distribution for {state}/{action} is not stochastic")
    return result


def positive_successors(
    case: dict[str, Any], policy: dict[str, str], state: str, target: str
) -> set[str]:
    if state == target:
        return set()
    state_spec = states_by_id(case)[state]
    if state_spec["absorbing"]:
        return {state}
    action = policy[state]
    return {
        successor
        for successor, probability in transition(case, state, action).items()
        if probability > 0
    }


def reachable_before_target(
    case: dict[str, Any], policy: dict[str, str], target: str
) -> set[str]:
    initial = case["model"]["initial_state"]
    seen: set[str] = set()
    stack = [initial]
    while stack:
        state = stack.pop()
        if state in seen:
            continue
        seen.add(state)
        if state == target:
            continue
        for successor in positive_successors(case, policy, state, target):
            if successor not in seen:
                stack.append(successor)
    return seen


def has_closed_class_away_from_target(
    case: dict[str, Any], policy: dict[str, str], target: str
) -> bool:
    reachable = reachable_before_target(case, policy, target)
    candidates = set(reachable) - {target}

    changed = True
    while changed:
        changed = False
        for state in list(candidates):
            successors = positive_successors(case, policy, state, target)
            if any(successor == target or successor not in candidates for successor in successors):
                candidates.remove(state)
                changed = True
    return bool(candidates)


def solve_linear_system(matrix: list[list[Fraction]], rhs: list[Fraction]) -> list[Fraction]:
    n = len(rhs)
    augmented = [row[:] + [rhs_value] for row, rhs_value in zip(matrix, rhs)]

    for col in range(n):
        pivot = next((row for row in range(col, n) if augmented[row][col] != 0), None)
        if pivot is None:
            raise AssertionError("exact policy-evaluation system is singular")
        if pivot != col:
            augmented[col], augmented[pivot] = augmented[pivot], augmented[col]

        scale = augmented[col][col]
        augmented[col] = [value / scale for value in augmented[col]]

        for row in range(n):
            if row == col:
                continue
            factor = augmented[row][col]
            if factor == 0:
                continue
            augmented[row] = [
                current - factor * pivot_value
                for current, pivot_value in zip(augmented[row], augmented[col])
            ]

    return [augmented[row][-1] for row in range(n)]


def evaluate_policy(
    case: dict[str, Any], policy: dict[str, str], query: dict[str, Any]
) -> Fraction | None:
    target = target_state(case, query)
    initial = case["model"]["initial_state"]
    if initial == target:
        return Fraction(0)

    if has_closed_class_away_from_target(case, policy, target):
        return None

    reachable = reachable_before_target(case, policy, target)
    unknown_states = sorted(reachable - {target})
    index = {state: i for i, state in enumerate(unknown_states)}
    reward_model = case["model"]["reward_models"][query["reward_model"]]

    matrix = [[Fraction(0) for _ in unknown_states] for _ in unknown_states]
    rhs = [Fraction(0) for _ in unknown_states]

    for state in unknown_states:
        row = index[state]
        matrix[row][row] = Fraction(1)
        rhs[row] = exact(reward_model["values"][state])

        state_spec = states_by_id(case)[state]
        if state_spec["absorbing"]:
            continue

        action = policy[state]
        if action not in case["model"]["transitions"][state]:
            raise AssertionError(f"policy uses unavailable action {action!r} in {state}")
        for successor, probability in transition(case, state, action).items():
            if successor == target:
                continue
            if successor not in index:
                raise AssertionError(f"reachable successor {successor} missing from policy system")
            matrix[row][index[successor]] -= probability

    values = solve_linear_system(matrix, rhs)
    return values[index[initial]]


def all_policies(case: dict[str, Any], query: dict[str, Any]) -> list[dict[str, str]]:
    target = target_state(case, query)
    states = [
        state["id"]
        for state in case["model"]["states"]
        if not state["absorbing"] and state["id"] != target
    ]
    actions = [list(case["model"]["transitions"][state].keys()) for state in states]
    return [dict(zip(states, choices)) for choices in itertools.product(*actions)]


def exact_optimum(
    case: dict[str, Any], query: dict[str, Any]
) -> tuple[Fraction, list[dict[str, str]]]:
    scored: list[tuple[Fraction, dict[str, str]]] = []
    improper = 0
    for policy in all_policies(case, query):
        value = evaluate_policy(case, policy, query)
        if value is None:
            improper += 1
            continue
        scored.append((value, policy))

    if not scored:
        raise AssertionError("no proper stationary deterministic policy found")
    chooser = max if query["direction"] == "max" else min
    optimum = chooser(value for value, _ in scored)
    policies = [policy for value, policy in scored if value == optimum]
    if improper:
        print(f"note: {improper} stationary policies do not reach the target almost surely")
    return optimum, policies


def compare_direct_snapshot(case: dict[str, Any], direct: dict[str, Any]) -> None:
    snapshot = direct["model_snapshot"]
    case_states = states_by_id(case)
    if set(snapshot["states"]) != set(case_states):
        raise AssertionError("direct donor state set differs from case.json")

    rewards = case["model"]["reward_models"][case["query"]["reward_model"]]["values"]
    for state_id, state in case_states.items():
        if snapshot["states"][state_id]["labels"] != sorted(state["labels"]):
            raise AssertionError(f"direct donor labels differ for {state_id}")
        if exact(snapshot["states"][state_id]["reward"]) != exact(rewards[state_id]):
            raise AssertionError(f"direct donor reward differs for {state_id}")

        expected_choices = case["model"]["transitions"][state_id]
        received_choices = snapshot["transitions"][state_id]
        if set(expected_choices) != set(received_choices):
            raise AssertionError(f"direct donor actions differ for {state_id}")
        for action, distribution in expected_choices.items():
            received = received_choices[action]
            if set(distribution) != set(received):
                raise AssertionError(f"direct donor targets differ for {state_id}/{action}")
            for target, probability in distribution.items():
                if exact(received[target]) != exact(probability):
                    raise AssertionError(
                        f"direct donor probability differs for {state_id}/{action}->{target}"
                    )


def check_query_binding(result: dict[str, Any]) -> None:
    query = result["query"]
    binding = result["query_binding"]
    if binding["stop_state"] != query["stop_state"]:
        raise AssertionError(
            f"{result['source']} binds stop state {binding['stop_state']!r} "
            f"for query state {query['stop_state']!r}"
        )
    if not binding["engine_target_label"]:
        raise AssertionError(f"{result['source']} has an empty engine target binding")


def check_result_for_own_query(
    case: dict[str, Any], result: dict[str, Any], label: str
) -> tuple[Fraction, float]:
    query = result["query"]
    check_query_binding(result)
    value = evaluate_policy(case, result["policy"], query)
    if value is None:
        raise AssertionError(f"{label} scheduler does not reach its target almost surely")

    optimum, optimal_policies = exact_optimum(case, query)
    if value != optimum:
        raise AssertionError(f"{label} scheduler has exact value {value}, exact optimum is {optimum}")
    if result["policy"] not in optimal_policies:
        raise AssertionError(f"{label} policy is not among the exact optimal policies")

    reported = float(result["initial_value"])
    if not math.isfinite(reported):
        raise AssertionError(f"{label} reported a non-finite numeric value")
    return value, reported - float(value)


def check_exact_storm_result(
    case: dict[str, Any], result: dict[str, Any], label: str
) -> tuple[Fraction, str]:
    check_query_binding(result)
    if result["engine"].get("model_numeric_domain") != "exact_rational":
        raise AssertionError(f"{label} is not marked as exact rational")

    query = result["query"]
    optimum, _ = exact_optimum(case, query)
    reported = exact(result["initial_value_exact"])
    if reported != optimum:
        raise AssertionError(f"{label} reports {reported}, exact checker obtains {optimum}")

    model_hash = result.get("prism_model_sha256")
    if not model_hash:
        raise AssertionError(f"{label} lacks a generated-model digest")
    return reported, str(model_hash)


def main() -> None:
    case = load_json("case.json")
    direct = load_json("direct-result.json")
    writ = load_json("writ-result.json")
    min_result = load_json("min-result.json")
    stop_result = load_json("stop-result.json")
    exact_storm = load_json("exact-storm-result.json")
    exact_storm_min = load_json("exact-storm-min-result.json")
    exact_storm_stop = load_json("exact-storm-stop-result.json")

    compare_direct_snapshot(case, direct)

    canonical_query = case["query"]
    if direct["query"] != canonical_query or writ["query"] != canonical_query:
        raise AssertionError("accepted result changed the canonical Writ query")
    if exact_storm["query"] != canonical_query:
        raise AssertionError("exact Storm path changed the canonical Writ query")

    direct_value, direct_gap = check_result_for_own_query(
        case, direct, "direct Stormvogel baseline"
    )
    writ_value, writ_gap = check_result_for_own_query(case, writ, "Writ Storm adapter")
    storm_exact_value, canonical_hash = check_exact_storm_result(
        case, exact_storm, "exact Storm canonical path"
    )

    if direct_value != writ_value or direct_value != storm_exact_value:
        raise AssertionError(
            "canonical exact values disagree across direct scheduler evaluation, "
            "Writ scheduler evaluation, and exact Storm"
        )
    if direct["policy"] != writ["policy"]:
        raise AssertionError("direct and Writ schedulers differ")
    if not math.isclose(
        float(direct["initial_value"]), float(writ["initial_value"]), rel_tol=0, abs_tol=1e-9
    ):
        raise AssertionError("direct and Writ double-precision Storm values differ")

    min_value, min_gap = check_result_for_own_query(case, min_result, "min-direction mutation")
    if min_result["query"] == canonical_query or min_result["query"]["direction"] != "min":
        raise AssertionError("min-direction mutation did not define the intended different request")
    if exact_storm_min["query"] != min_result["query"]:
        raise AssertionError("exact Storm min request differs from the Writ min mutation")
    storm_exact_min, min_hash = check_exact_storm_result(
        case, exact_storm_min, "exact Storm min path"
    )
    if storm_exact_min != min_value:
        raise AssertionError("exact Storm and independent checker disagree on min mutation")

    stop_value, stop_gap = check_result_for_own_query(case, stop_result, "stop-state mutation")
    if (
        stop_result["query"] == canonical_query
        or stop_result["query"]["stop_state"] == canonical_query["stop_state"]
    ):
        raise AssertionError("stop-state mutation did not define the intended different request")
    if exact_storm_stop["query"] != stop_result["query"]:
        raise AssertionError("exact Storm stop request differs from the Writ stop mutation")
    storm_exact_stop, stop_hash = check_exact_storm_result(
        case, exact_storm_stop, "exact Storm stop path"
    )
    if storm_exact_stop != stop_value:
        raise AssertionError("exact Storm and independent checker disagree on stop mutation")

    if len({canonical_hash, min_hash, stop_hash}) != 1:
        raise AssertionError("exact Storm mutations changed the generated MDP instead of only the query")

    print(f"Canonical exact optimum: {direct_value} = {float(direct_value):.6f}")
    print(f"Exact Storm canonical value: {storm_exact_value}")
    print(
        f"Double Storm canonical value: {float(direct['initial_value']):.12f}; "
        f"exact-minus-double: {-direct_gap:.12f}"
    )
    print(f"Min-direction exact optimum: {min_value}; exact Storm: {storm_exact_min}")
    print(
        f"Double Storm min value: {float(min_result['initial_value']):.12f}; "
        f"exact-minus-double: {-min_gap:.12f}"
    )
    print(f"Stop-state exact optimum: {stop_value}; exact Storm: {storm_exact_stop}")
    print(
        f"Double Storm stop-state value: {float(stop_result['initial_value']):.12f}; "
        f"exact-minus-double: {-stop_gap:.12f}"
    )
    print("Expected rejection: min-direction result answers a different optimization request")
    print("Expected rejection: stop-state result answers a different temporal request")
    print(
        "OK: direct and Writ schedulers agree; Storm exact-rational model checking and "
        "the independent exact checker agree on all three queries"
    )


if __name__ == "__main__":
    main()
