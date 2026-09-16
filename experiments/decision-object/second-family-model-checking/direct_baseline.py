#!/usr/bin/env python3
from __future__ import annotations

import importlib.metadata
import json
from pathlib import Path
from typing import Any

import stormvogel
import stormvogel.examples

HERE = Path(__file__).resolve().parent

STATE_BY_LABEL = {
    "init": "satisfied",
    "full": "full",
    "hungry : (": "hungry",
    "hungry :(": "hungry",
    "starving :((": "starving",
    "dead": "dead",
}
ACTION_BY_LABEL = {"hunt >:D": "hunt", "rawr": "rawr"}


def load_case() -> dict[str, Any]:
    return json.loads((HERE / "case.json").read_text(encoding="utf-8"))


def state_id(state: Any) -> str:
    labels = set(state.labels)
    matches = {STATE_BY_LABEL[label] for label in labels if label in STATE_BY_LABEL}
    if len(matches) != 1:
        raise AssertionError(f"cannot map donor state labels {sorted(labels)!r}")
    return next(iter(matches))


def query_property(query: dict[str, Any]) -> str:
    if query["kind"] != "expected_accumulated_reward_until_label":
        raise ValueError(f"unsupported query kind {query['kind']!r}")
    direction = query["direction"]
    if direction not in {"min", "max"}:
        raise ValueError(f"unsupported direction {direction!r}")
    reward = query["reward_model"].replace('"', '\\"')
    target = query["stop_label"].replace('"', '\\"')
    return f'R{{"{reward}"}}{direction}=? [F "{target}"]'


def donor_snapshot(model: Any, reward_name: str) -> dict[str, Any]:
    rewards = model.get_rewards(reward_name)
    states: dict[str, Any] = {}
    transitions: dict[str, Any] = {}

    for state in model:
        sid = state_id(state)
        states[sid] = {
            "labels": sorted(state.labels),
            "reward": float(rewards.get_state_reward(state) or 0),
        }
        choices: dict[str, dict[str, float]] = {}
        if state.has_choices():
            for action, branch in state.choices:
                if action.label is None:
                    # Stormvogel adds an engine-level self-loop to terminal states.
                    continue
                if action.label not in ACTION_BY_LABEL:
                    raise AssertionError(f"unexpected donor action label {action.label!r}")
                aid = ACTION_BY_LABEL[action.label]
                choices[aid] = {
                    state_id(target): float(probability)
                    for probability, target in branch
                }
        transitions[sid] = choices

    return {"states": states, "transitions": transitions}


def main() -> None:
    case = load_case()
    query = case["query"]
    prop = query_property(query)

    lion = stormvogel.examples.create_lion_mdp()
    snapshot = donor_snapshot(lion, query["reward_model"])

    result = stormvogel.model_checking(lion, prop, scheduler=True)
    if result is None or result.scheduler is None:
        raise RuntimeError("Stormvogel did not return a scheduler")

    policy: dict[str, str] = {}
    for state in lion:
        sid = state_id(state)
        if sid == "dead":
            continue
        action = result.scheduler.get_action_at_state(state)
        if action.label not in ACTION_BY_LABEL:
            raise AssertionError(f"unexpected scheduled action {action.label!r} in {sid}")
        policy[sid] = ACTION_BY_LABEL[action.label]

    payload = {
        "source": "direct-stormvogel-baseline",
        "engine": {
            "stormvogel": importlib.metadata.version("stormvogel"),
            "stormpy": importlib.metadata.version("stormpy"),
            "backend": "Storm",
        },
        "query": query,
        "compiled_property": prop,
        "initial_value": float(result.at_init()),
        "policy": policy,
        "model_snapshot": snapshot,
    }
    (HERE / "direct-result.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Direct Stormvogel value: {payload['initial_value']}")
    print(json.dumps(policy, sort_keys=True))


if __name__ == "__main__":
    main()
