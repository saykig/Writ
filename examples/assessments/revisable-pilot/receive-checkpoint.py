"""Verify a retained checkpoint's source identities and reported gate coverage.

This checks immutable source binding, not the truth of an execution report. Run the
listed repository gates and the operation receivers for fresh behavioral evidence.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('receipt', type=Path)
parser.add_argument('--current', action='store_true')
args = parser.parse_args()
record = json.loads(args.receipt.read_text())
commit = record['source_commit']
if len(commit) != 40 or any(c not in '0123456789abcdef' for c in commit):
    raise ValueError('SOURCE_COMMIT_SHAPE')
for name, expected in record['source_files'].items():
    if Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError('SOURCE_PATH')
    raw = subprocess.check_output(['git','show',commit+':'+name],cwd=ROOT)
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('UNBOUND_SOURCE: '+name)
    if args.current and hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != expected:
        raise ValueError('CHANGED_CURRENT_SOURCE: '+name)
required = {'format','lint','typecheck','test','data:check','verify:writ','build',
            'test:decision-integration','test:shared-analysis-integration','test:certificate-transport-integration',
            'validate_pack','source_registry','ruff','mypy','pytest','packet_receiving','pilot_receiving','vela_receiving','continuation_receiving','rendered_script_syntax'}
if {g['gate'] for g in record['gates']} != required or any(g['exit_code'] != 0 for g in record['gates']):
    raise ValueError('GATE_COVERAGE_OR_FAILURE')
if record['browser_workflow']['status'] != 'incomplete':
    raise ValueError('THIS_CHECKPOINT_DOES_NOT_EARN_BROWSER_COMPLETION')
print(json.dumps({'status':'source_bound','source_commit':commit,'source_files':len(record['source_files']),'current_sources_match':args.current,'reported_gates':len(required),'full_goal':'incomplete; browser workflow not established'},indent=2))
