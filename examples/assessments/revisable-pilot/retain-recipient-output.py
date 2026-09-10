"""Retain only actual recipient final messages from a caller-supplied local transcript.
Never retains private reasoning, surrounding conversation, credentials or full logs.
"""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rollout', type=Path, required=True)
args = parser.parse_args()
out = Path(__file__).resolve().parent / 'evidence' / 'recipients'
out.mkdir(exist_ok=True)
runs = {'recipient_1':'structured-1','recipient_2':'prose-1','recipient_3':'structured-2','recipient_4':'prose-2','recipient_5':'structured-3','recipient_6':'prose-3'}
seen = set()
for line in args.rollout.open():
    item = json.loads(line)
    payload = item.get('payload', {})
    if item.get('type') != 'response_item' or payload.get('type') != 'agent_message':
        continue
    name = payload.get('author','').removeprefix('/root/')
    if name not in runs:
        continue
    for block in payload['content']:
        text = block.get('text','')
        if not text.startswith('Message Type: FINAL_ANSWER\n') or '\nPayload:\n' not in text:
            continue
        response = text.split('\nPayload:\n',1)[1]
        stage = json.loads(response)['stage']
        key = f'{runs[name]}-stage-{stage}'
        digest = hashlib.sha256(response.encode()).hexdigest()
        if key in seen:
            raise ValueError('ADDITIONAL_ATTEMPT_REQUIRES_DISTINCT_RETENTION: ' + key)
        seen.add(key)
        dest = out / (key + '.json')
        if dest.exists() and dest.read_bytes() != response.encode():
            raise ValueError('FROZEN_RESPONSE_CHANGED: ' + key)
        if not dest.exists():
            dest.write_bytes(response.encode())
        print(json.dumps({'run':runs[name],'stage':stage,'sha256':digest,'timestamp':item.get('timestamp'),'message_id':payload.get('id')}))
