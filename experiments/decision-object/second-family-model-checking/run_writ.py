#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.metadata
import json
from fractions import Fraction
from pathlib import Path
from typing import Any

import stormpy

HERE = Path(__file__).resolve().parent


def load_case(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def exact(value: Any) -> Fraction:
    return Fraction(str(value))


def query_property(query: dict[str, Any]) -> str:
    if query["kind"] != "expected_accumulated_reward_until_label":
        raise ValueError(f"unsupported query kind {query['kind']!r}")
    direction = query["direction"]
    if direction not in {"min", "max"}:
        raise ValueError(f"unsupported direction {direction!r}")
    reward = query["reward_model"].replace('"', '\\"')
    target = query["stop_label"].replace('"', '\\"')
    return f'R{{"{reward}"}}{direction}=? [F "{target}"]'


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

    all_labels = {label for state in model["states"] for label in state["labels"]}
    if case["query"]["stop_label"] not in all_labels:
        raise ValueError(f"stop label {case['query']['stop_label']!r} is absent from the model")
    if case["query"]["reward_model"] not in model["reward_models"]:
        raise ValueError(f"reward model {case['query']['reward_model']!r} is absent")

    for state in model["states"]:
        sid = state["id"]
        choices = model["transitions"].get(sid, {})
        if state["absorbing"]:
            if choices:
                raise ValueError(f"absorbing state {sid} should not declare Writ actions")
            continue
        if not choices:
            raise ValueError(f"nonabsorbing state {sid} has no actions")
        for action_id, distribution in choices.items():
            if action_id not in action_ids:
                raise ValueError(f"unknown action {action_id!r} in {sid}")
            if set(distribution) - set(state_ids):
                raise ValueError(f"unknown target state in {sid}/{action_id}")
            total = sum(exact(probability) for probability in distribution.values())
            if total != 1:
                raise ValueError(f"transition probabilities for {sid}/{action_id} sum to {total}")


def build_storm_model(case: dict[str, Any]) -> tuple[Any, dict[str, Any]]:
    validate_case(case)
    model = case["model"]
    states = model["states"]
    state_order = [state["id"] for state in states]
    state_index = {state_id: index for index, state_id in enumerate(state_order)}
    action_labels = {action["id"]: action["label"] for action in model["actions"]}
    action_by_label = {label: action_id for action_id, label in action_labels.items()}

    builder = stormpy.SparseMatrixBuilder(
        rows=0,
        columns=0,
        entries=0,
        force_dimensions=False,
        has_custom_row_grouping=True,
        row_groups=0,
    )

    row_bindings: dict[int, dict[str, Any]] = {}
    row = 0
    for state in states:
        sid = state["id"]
        builder.new_row_group(row)
        if state["absorbing"]:
            builder.add_next_value(row, state_index[sid], 1.0)
            row_bindings[row] = {
                "state_id": sid,
                "action_id": None,
                "engine_generated": "absorbing_self_loop",
            }
            row += 1
            continue

        choices = model["transitions"][sid]
        for action in model["actions"]:
            aid = action["id"]
            if aid not in choices:
                continue
            for target, probability in choices[aid].items():
                builder.add_next_value(row, state_index[target], float(exact(probability)))
            row_bindings[row] = {
                "state_id": sid,
                "action_id": aid,
                "action_label": action_labels[aid],
            }
            row += 1

    transition_matrix = builder.build()

    state_labeling = stormpy.storage.StateLabeling(len(states))
    labels = sorted({label for state in states for label in state["labels"]})
    for label in labels:
        state_labeling.add_label(label)
    for state in states:
        sid = state["id"]
        for label in state["labels"]:
            state_labeling.add_label_to_state(label, state_index[sid])

    choice_labeling = stormpy.storage.ChoiceLabeling(row)
    for label in sorted(action_by_label):
        choice_labeling.add_label(label)
    for row_index, binding in row_bindings.items():
        label = binding.get("action_label")
        if label is not None:
            choice_labeling.add_label_to_choice(label, row_index)

    reward_models: dict[str, Any] = {}
    for reward_name, reward_spec in model["reward_models"].items():
        if reward_spec["kind"] != "state_reward":
            raise ValueError(f"unsupported reward kind {reward_spec['kind']!r}")
        vector = [
            float(exact(reward_spec["values"][state_id]))
            for state_id in state_order
        ]
        reward_models[reward_name] = stormpy.SparseRewardModel(
            optional_state_reward_vector=vector
        )

    components = stormpy.SparseModelComponents(
        transition_matrix=transition_matrix,
        state_labeling=state_labeling,
        reward_models=reward_models,
        rate_transitions=False,
    )
    components.choice_labeling = choice_labeling
    mdp = stormpy.storage.SparseMdp(components)

    if list(mdp.initial_states) != [state_index[model["initial_state"]]]:
        raise AssertionError(
            f"Storm initial states changed: expected {[state_index[model['initial_state']]]}, "
            f"received {list(mdp.initial_states)}"
        )

    boundary = {
        "state_order": state_order,
        "row_bindings": {str(key): value for key, value in row_bindings.items()},
        "numeric_translation": "exact rational strings converted to Storm double precision; exact checking uses source rationals",
    }
    return mdp, boundary


def extract_policy(case: dict[str, Any], mdp: Any, scheduler: Any) -> dict[str, str]:
    model = case["model"]
    state_order = [state["id"] for state in model["states"]]
    action_by_label = {action["label"]: action["id"] for action in model["actions"]}
    policy: dict[str, str] = {}

    if not scheduler.memoryless or not scheduler.deterministic:
        raise AssertionError("expected a deterministic memoryless Storm scheduler")

    for state in mdp.states:
        sid = state_order[state.id]
        source_state = model["states"][state.id]
        if source_state["absorbing"]:
            continue
        choice = scheduler.get_choice(state)
        if not choice.defined:
            raise AssertionError(f"scheduler has no choice for {sid}")
        action_index = choice.get_deterministic_choice()
        action = state.actions[action_index]
        labels = set(action.labels)
        matches = [action_by_label[label] for label in labels if label in action_by_label]
        if len(matches) != 1:
            raise AssertionError(f"cannot bind Storm action labels {sorted(labels)!r} in {sid}")
        policy[sid] = matches[0]

    return policy


def run(case: dict[str, Any], *, source: str) -> dict[str, Any]:
    mdp, boundary = build_storm_model(case)
    prop_text = query_property(case["query"])
    prop = stormpy.parse_properties(prop_text)[0]
    result = stormpy.model_checking(mdp, prop, extract_scheduler=True)
    if not result.has_scheduler:
        raise RuntimeError("Storm did not return a scheduler")

    initial_state = mdp.initial_states[0]
    return {
        "source": source,
        "engine": {
            "stormpy": importlib.metadata.version("stormpy"),
            "backend": "Storm",
        },
        "query": case["query"],
        "compiled_property": prop_text,
        "initial_value": float(result.at(initial_state)),
        "policy": extract_policy(case, mdp, result.scheduler),
        "adapter_boundary": boundary,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", default="case.json")
    parser.add_argument("--output", default="writ-result.json")
    parser.add_argument("--source", default="writ-stormpy-adapter")
    parser.add_argument("--direction", choices=["min", "max"])
    parser.add_argument("--stop-label")
    args = parser.parse_args()

    case = load_case(HERE / args.case)
    if args.direction is not None:
        case["query"]["direction"] = args.direction
    if args.stop_label is not None:
        case["query"]["stop_label"] = args.stop_label

    payload = run(case, source=args.source)
    (HERE / args.output).write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"{payload['source']} value: {payload['initial_value']}")
    print(payload["compiled_property"])
    print(json.dumps(payload["policy"], sort_keys=True))


if __name__ == "__main__":
    main()
