"""Check retained pilot identities and score arithmetic, not semantic scoring judgment."""
from pathlib import Path
import hashlib
import json
import tempfile
import shutil

HERE = Path(__file__).resolve().parent

def need(ok, code):
    if not ok:
        raise ValueError(code)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def receive(root=HERE):
    e = root/'evidence'
    record = json.loads((e/'pilot-observations.json').read_text())
    need(sha(root/'packets/FREEZE.json') == record['freeze_sha256'], 'FREEZE_IDENTITY')
    need(sha(e/'blinded-scorer.json') == record['scorer_sha256'], 'SCORER_IDENTITY')
    scorer = json.loads((e/'blinded-scorer.json').read_text())
    need(set(record['blind_map']) == set('ABCDEF'), 'RUN_COVERAGE')
    need(set(record['blind_map'].values()) == {f'{c}-{i}' for c in ['prose','structured'] for i in range(1,4)}, 'RUN_COVERAGE')
    totals = {'structured':0,'prose':0}
    expected = set()
    for label,run in record['blind_map'].items():
        stages = scorer['runs'][label]
        need([r['stage'] for r in stages] == [0,1,2], 'STAGE_COVERAGE')
        for stage,item in enumerate(stages):
            name = f'{run}-stage-{stage}.json';expected.add(name)
            binding = record['responses'][name];path=e/'recipients'/name
            need(sha(path) == binding['sha256'], 'RESPONSE_IDENTITY')
            raw = path.read_text();response=json.loads(raw)
            need(response['stage'] == stage, 'RESPONSE_STAGE')
            need(len(raw.split()) == binding['whitespace_word_count'] <= 800, 'RESPONSE_BUDGET')
            need(response['source_ids'] == [f'S{i}' for i in range(stage+1)], 'SOURCE_SCOPE')
            need(len(item['scores']) == 8 and all(type(v) is int and v in [0,1] for v in item['scores']), 'SCORE_SHAPE')
            need(item['scores'] == binding['scores'], 'SCORE_BINDING')
            totals[run.split('-')[0]] += sum(item['scores'])
        need(sum(sum(x['scores']) for x in stages) == scorer['totals'][label], 'RUN_TOTAL')
    need(set(record['responses']) == expected, 'RESPONSE_COVERAGE')
    need(totals == record['condition_totals'], 'CONDITION_TOTAL')
    need(sum(totals.values()) == scorer['totals']['all_runs'] and scorer['totals']['possible'] == 144, 'TOTAL')
    return {'status':'checked','responses':18,'scores_per_condition':totals,'possible_per_condition':72,'scope':'Exact packet/response/scorer bindings and score arithmetic; semantic scoring remains an authored assessment.'}

def controls():
    result=[]
    with tempfile.TemporaryDirectory() as folder:
        root=Path(folder)/'pilot'
        shutil.copytree(HERE/'packets',root/'packets')
        shutil.copytree(HERE/'evidence',root/'evidence',ignore=shutil.ignore_patterns('*.bundle'))
        path=root/'evidence/recipients/structured-1-stage-0.json';before=path.read_bytes();path.write_bytes(before+b' ')
        try:receive(root)
        except ValueError as e:need(str(e)=='RESPONSE_IDENTITY','WRONG_REJECTION');result.append(str(e))
        else:raise ValueError('ALTERED_RESPONSE_ACCEPTED')
        path.write_bytes(before)
        path=root/'evidence/pilot-observations.json';record=json.loads(path.read_text());record['condition_totals']['prose']+=1;path.write_text(json.dumps(record))
        try:receive(root)
        except ValueError as e:need(str(e)=='CONDITION_TOTAL','WRONG_REJECTION');result.append(str(e))
        else:raise ValueError('FORGED_TOTAL_ACCEPTED')
    return result

if __name__ == '__main__':
    print(json.dumps({'receiving':receive(),'rejections':controls()},indent=2))
