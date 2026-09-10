"""Adapted from SimPy 4.1.1 shared_resources.rst (MIT; see LICENSE.simpy.txt).

SimPy owns event scheduling and resource acquisition. This adapter supplies explicit
integer inputs and records the resulting per-car trace; it implements no simulator.
"""
import json
import sys

import simpy


def run(inputs):
    env = simpy.Environment()
    resource = simpy.Resource(env, capacity=2)
    rows = [None] * len(inputs["arrivals"])

    def car(index, arrival):
        yield env.timeout(arrival)
        with resource.request() as request:
            yield request
            start = env.now
            yield env.timeout(int(inputs["service_minutes"]))
            rows[index] = {"car": str(index), "arrival": str(arrival),
                           "start": str(start), "finish": str(env.now)}

    for index, arrival in enumerate(inputs["arrivals"]):
        env.process(car(index, int(arrival)))
    env.run()
    return {"unit": "minute", "rows": rows}


if __name__ == "__main__":
    with open(sys.argv[1], "rb") as source:
        inputs = json.load(source)
    print(json.dumps(run(inputs), sort_keys=True, separators=(",", ":")))
