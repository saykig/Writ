"""Receive the prospective packet freeze and recover equal content from prose/JSON."""
from pathlib import Path
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent

def receive():
    root = HERE / 'packets'
    manifest = json.loads((root / 'FREEZE.json').read_text())
    for name, expected in manifest['files'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise ValueError('FROZEN_PACKET_CHANGED: ' + name)
    seen = set()
    for stage in range(3):
        packet = json.loads((root / f'stage-{stage}.json').read_text())
        prose = (root / f'stage-{stage}.md').read_text()
        header, *blocks = prose.split('## ')
        for value in (packet['assessment_id'], packet['question'], packet['status'], packet['schema'], f'Stage: {stage}.'):
            if value not in header:
                raise ValueError('PROSE_HEADER_MISMATCH')
        restored = []
        for block in blocks:
            lines = block.strip().splitlines()
            identity, title = lines[0].split(': ', 1)
            match = re.fullmatch(r'Record type: (.+)\.', lines[1])
            if match is None:
                raise ValueError('PROSE_KIND_MISMATCH')
            deps = lines[3].removeprefix('Declared dependencies: ').removesuffix('.')
            record = dict(id=identity, title=title, kind=match.group(1), text=lines[2], depends_on=[] if deps == 'none' else deps.split(', '))
            for line in lines[4:]:
                key, raw = line.split(': ', 1)
                record[key] = json.loads(raw)
            restored.append(record)
        if restored != packet['records']:
            raise ValueError('INFORMATION_NOT_MATCHED')
        for record in restored:
            if record['id'] in seen or not set(record['depends_on']) <= seen:
                raise ValueError('DUPLICATE_OR_FORWARD_REFERENCE')
            seen.add(record['id'])
            if record['kind'] == 'source':
                actual = 'sha256:' + hashlib.sha256(record['excerpt'].encode()).hexdigest()
                if actual != record['excerpt_sha256']:
                    raise ValueError('SOURCE_EXCERPT_MISMATCH')
    return {'status': 'passed', 'stages': 3, 'conditions': 2, 'records': len(seen), 'equal_substantive_records': True, 'freeze': manifest}

if __name__ == '__main__':
    print(json.dumps(receive(), indent=2))
