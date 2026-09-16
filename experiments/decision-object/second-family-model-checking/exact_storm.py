#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import re
import tempfile
from fractions import Fraction
from pathlib import Path
from typing import Any

import stormpy

HERE = Path(__file__).resolve().parent


def load_case(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def exact(value: Any) -> Fraction:
    return Fraction(str(value))


def rational_text(value: Any) -> str:
    number = exact(value)
    if number.denominator == 1:
        return str(number.numerator)
    return f"{number.numerator}/{number.denominator}"


def validate_identifier(value: str, *, kind: str) -> None:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"{kind} {value!r} is not safe for the exact Storm probe")


def validate_case(case: dict[str, Any]) -> None:
    model = case["model"]
    if model["kind"] != "finite_mdp":
        raise ValueError(f"unsupported model kind {model['kind']!r}")

    state_ids = [state["id"] for state in model["states"]]
    if len(state_ids) != len(set(state_ids)):
        raise ValueError("state ids must be unique")
    if model["initial_state"] not in state_ids:
        raise ValueError("initial state is missing")

    action_ids = [action["id"] for action in model["actions"]]
    if len(action_ids) != len(set(action_ids)):
        raise ValueError("action ids must be unique")
    for action_id in action_ids:
        validate_identifier(action_id, kind="action id")

    query = case["query"]
    if query["kind"] != "expected_accumulated_reward_until_state":
        raise ValueError(f"unsupported query kind {query['kind']!r}")
    if query["direction"] not in {"min", "max"}:
        raise ValueError(f"unsupported direction {query['direction']!r}")
    if query["stop_state"] not in state_ids:
        raise ValueError(f"stop state {query['stop_state']!r} is absent")
    if query["reward_model"] not in model["reward_models"]:
        raise ValueError(f"reward model {query['reward_model']!r} is absent")

    for state in model["states"]:
        sid = state["id"]
        choices = model["transitions"].get(sid, {})
        if state["absorbing"]:
            if choices:
                raise ValueError(f"absorbing state {sid} declares Writ actions")
            continue
        if not choices:
            raise ValueError(f"nonabsorbing state {sid} has no actions")
        for action_id, distribution in choices.items():
            if action_id not in action_ids:
                raise ValueError(f"unknown action {action_id!r} in {sid}")
            if set(distribution) - set(state_ids):
                raise ValueError(f"unknown target state in {sid}/{action_id}")
            if sum(exact(probability) for probability in distribution.values()) != 1:
                raise ValueError(f"transition probabilities for {sid}/{action_id} do not sum to one")


def build_prism(case: dict[str, Any]) -> tuple[str, dict[str, str]]:
    validate_case(case)
    model = case["model"]
    states = model["states"]
    state_order = [state["id"] for state in states]
    state_index = {state_id: index for index, state_id in enumerate(state_order)}
    query_labels = {state_id: f"writ_state_{index}" for index, state_id in enumerate(state_order)}
    initial_index = state_index[model["initial_state"]]

    lines = [
        "mdp",
        "",
        "module writ_lion",
        f"  s : [0..{len(states) - 1}] init {initial_index};",
    ]

    action_order = [action["id"] for action in model["actions"]]
    for state in states:
        sid = state["id"]
        source_index = state_index[sid]
        choices = model["transitions"].get(sid, {})
        if state["absorbing"]:
            lines.append(f"  [] s={source_index} -> (s'={source_index});")
            continue
        for action_id in action_order:
            if action_id not in choices:
                continue
            terms = []
            for target, probability in choices[action_id].items():
                terms.append(
                    f"{rational_text(probability)}:(s'={state_index[target]})"
                )
            lines.append(
                f"  [{action_id}] s={source_index} -> " + " + ".join(terms) + ";"
            )

    lines.extend(["endmodule", ""])
    for state_id in state_order:
        lines.append(
            f'label "{query_labels[state_id]}" = s={state_index[state_id]};'
        )

    for reward_name, reward_spec in model["reward_models"].items():
        if reward_spec["kind"] != "state_reward":
            raise ValueError(f"unsupported reward kind {reward_spec['kind']!r}")
        reward_literal = reward_name.replace('"', '\\"')
        lines.extend(["", f'rewards "{reward_literal}"'])
        for state_id in state_order:
            value = exact(reward_spec["values"][state_id])
            if value != 0:
                lines.append(
                    f"  s={state_index[state_id]} : {rational_text(value)};"
                )
        lines.append("endrewards")

    lines.append("")
    return "\n".join(lines), query_labels


def query_property(query: dict[str, Any], target_label: str) -> str:
    reward = query["reward_model"].replace('"', '\\"')
    direction = query["direction"]
    return f'R{{"{reward}"}}{direction}=? [F "{target_label}"]'


def run(case: dict[str, Any], *, source: str) -> dict[str, Any]:
    prism_text, labels = build_prism(case)
    stop_state = case["query"]["stop_state"]
    property_text = query_property(case["query"], labels[stop_state])

    with tempfile.NamedTemporaryFile("w", suffix=".nm", encoding="utf-8") as handle:
        handle.write(prism_text)
        handle.flush()
        program = stormpy.parse_prism_program(handle.name)
        properties = stormpy.parse_properties_for_prism_program(property_text, program)
        model = stormpy.build_sparse_exact_model(program, properties)

    result = stormpy.model_checking(
        model,
        properties[0],
        only_initial_states=True,
        extract_scheduler=False,
    )
    initial_state = model.initial_states[0]
    raw_value = result.at(initial_state)
    exact_value = str(raw_value)

    return {
        "source": source,
        "engine": {
            "stormpy": importlib.metadata.version("stormpy"),
            "backend": "Storm",
            "model_numeric_domain": "exact_rational",
        },
        "query": case["query"],
        "compiled_property": property_text,
        "query_binding": {
            "stop_state": stop_state,
            "engine_target_label": labels[stop_state],
        },
        "initial_value_exact": exact_value,
        "prism_model_sha256": hashlib.sha256(prism_text.encode("utf-8")).hexdigest(),
        "prism_model": prism_text,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", default="case.json")
    parser.add_argument("--output", default="exact-storm-result.json")
    parser.add_argument("--source", default="writ-storm-exact-probe")
    parser.add_argument("--direction", choices=["min", "max"])
    parser.add_argument("--stop-state")
    args = parser.parse_args()

    case = load_case(HERE / args.case)
    if args.direction is not None:
        case["query"]["direction"] = args.direction
    if args.stop_state is not None:
        case["query"]["stop_state"] = args.stop_state

    payload = run(case, source=args.source)
    (HERE / args.output).write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"{payload['source']} exact value: {payload['initial_value_exact']}")
    print(payload["compiled_property"])


if __name__ == "__main__":
    main()
