"""Explicit producer: inspect pinned SimPy source, run fixed adapter, preserve raw bytes.

No received data chooses executable code. Interpreter/OS remain trusted prerequisites.
Run with the isolated CPython 3.13.15 environment containing SimPy 4.1.1.
"""
import base64
import hashlib
import json
import os
import platform
import subprocess
import sys
import tempfile
from pathlib import Path

import simpy

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent


def digest(raw):
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def encoded(raw):
    return {'encoding': 'base64', 'content': base64.b64encode(raw).decode(), 'sha256': digest(raw)}


def main():
    if os.environ.get('WRIT_DISABLE_EXTERNAL_PRODUCER') == '1':
        raise RuntimeError('External producer disabled')
    if len(sys.argv) != 3:
        raise SystemExit('Usage: produce.py INPUT OUTPUT (creation only)')
    profile = json.loads((ROOT / 'packages/shared-analysis/src/simpy-profile.json').read_bytes())
    if platform.python_implementation() != 'CPython' or platform.python_version() != '3.13.15':
        raise ValueError('This producer pins CPython 3.13.15')
    package_root = Path(simpy.__file__).resolve().parent
    actual = {'simpy/' + str(f.relative_to(package_root)): digest(f.read_bytes())
              for f in package_root.rglob('*.py')}
    if actual != profile['source_manifest'] or simpy.__version__ != profile['version']:
        raise ValueError('Installed SimPy source differs from inspected distribution')
    model = (HERE / 'model.py').read_bytes()
    if digest(model) != profile['model_sha256']:
        raise ValueError('Model adapter source differs from reviewed profile')
    input_path = Path(sys.argv[1]).resolve()
    inputs = input_path.read_bytes()
    # Execute the exact model/input buffers just bound, not a second read of caller inputs.
    with tempfile.TemporaryDirectory(prefix='writ-simpy-run-') as work:
        snapshot = Path(work)
        (snapshot / 'model.py').write_bytes(model)
        (snapshot / 'input.json').write_bytes(inputs)
        output = subprocess.check_output([sys.executable, '-I', str(snapshot / 'model.py'), str(snapshot / 'input.json')])
    value = {'schema_version': '0.1.0', 'artifact_kind': 'external_simulation_run',
             'profile': profile['profile'], 'evidence_kind': 'model_generated',
             'claim': 'finite_trace_under_supplied_inputs',
             'package': {'name': 'simpy', 'version': '4.1.1',
                         'sdist_sha256': profile['sdist_sha256'],
                         'source_manifest': actual},
             'model': encoded(model), 'upstream_example_sha256': profile['upstream_example_sha256'],
             'inputs': encoded(inputs), 'output': encoded(output),
             'assumptions': profile['assumptions'],
             'runtime': {'implementation': 'CPython', 'version': platform.python_version(),
                         'randomness': 'none', 'time_arithmetic': 'integer'}}
    with open(sys.argv[2], 'xb') as target:
        target.write((json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode())
    print(json.dumps({'run_sha256': digest(Path(sys.argv[2]).read_bytes()),
                      'input_sha256': digest(inputs), 'output_sha256': digest(output),
                      'package_source_checked': True}))


if __name__ == '__main__':
    main()
