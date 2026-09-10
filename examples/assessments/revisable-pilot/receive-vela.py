"""Receive the frozen synthetic Vela fixture and recheck its native Writ artifacts."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import pwd
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BINARY_SHA = '5b21415c98503b20518c0e68714b0b4f4b3c371525ea110563b89a53a0d3dbb3'
REPOSITORY_ID = '54d09b5a-0740-4564-a352-14109cadb56b'
AUTHORITY_ROOT = 'sha256:c709db2d0330a4342ab75af5860058852399ee7d3d77e6fee88e843e5504b9a9'

def need(ok, code):
    if not ok:
        raise RuntimeError(code)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def command(args, cwd=ROOT, reject=False):
    process = subprocess.run(list(map(str,args)),cwd=cwd,capture_output=True,text=True)
    if reject:
        need(process.returncode != 0, 'FALSE_CONTROL_ACCEPTED')
        return {'rejected': True, 'exit_code': process.returncode}
    need(process.returncode == 0, 'TOOL_FAILED: '+process.stderr[-2000:]+process.stdout[-1000:])
    return json.loads(process.stdout)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vela',type=Path,required=True)
    parser.add_argument('--bun',type=Path,required=True)
    parser.add_argument('--python',type=Path,required=True)
    parser.add_argument('--engine-root',type=Path,required=True)
    args=parser.parse_args()
    need(sha(args.vela.read_bytes()) == BINARY_SHA, 'VELA_BINARY_IDENTITY_MISMATCH')
    evidence=json.loads((HERE/'evidence/vela-reuse.json').read_text())
    anchor=Path(pwd.getpwuid(os.getuid()).pw_dir)/'.vela/trust/authorities'/f'{REPOSITORY_ID}.json'
    existed=anchor.exists()
    if existed:
        prior=anchor.read_bytes()
        need(json.loads(prior)['first_authority_record_root']==AUTHORITY_ROOT, 'SYNTHETIC_PIN_CONFLICT')
    with tempfile.TemporaryDirectory(prefix='writ-vela-recipient-') as d:
        repo=Path(d)/'fixture'
        subprocess.run(['git','clone','--quiet',str(HERE/'evidence/synthetic-vela.bundle'),str(repo)],check=True,capture_output=True)
        try:
            command([args.vela,'authority','trust','pin',repo,'--record-root',AUTHORITY_ROOT,'--json'])
            vela=command([args.vela,'replay',repo,'--json'])
            need(vela['repository_id']==REPOSITORY_ID, 'REPOSITORY_IDENTITY_MISMATCH')
            expected=evidence['final_vela_replay']
            for field in ('git_commit','git_tree','repository_root','origin_root','counts'):
                need(vela[field]==expected[field], 'VELA_ROOT_OR_COUNT_MISMATCH')
            need(vela['counts']['accepted_claims']==0, 'UNEXPECTED_ACCEPTED_STANDING')
            second=evidence['supported_corrected_submission']
            obj=command([args.vela,'show',repo,second['submission_id'],'--json'])
            need(obj['object_schema']=='vela.submission.v3', 'SUBMISSION_VERSION_UNSUPPORTED')
            payload=json.loads(base64.b64decode(obj['object']['payload']))
            artifacts={a['path']:repo/'records/artifacts/sha256'/a['digest'].split(':')[1] for a in payload['artifacts']}
            for a in payload['artifacts']:
                need(sha(artifacts[a['path']].read_bytes())==a['digest'].split(':')[1], 'ARTIFACT_IDENTITY_MISMATCH')
            archive=artifacts['writ/stage-2.archive.json'];mapping=json.loads(artifacts['writ/mapping.json'].read_text())
            need(mapping['native_history_sha256']==sha(archive.read_bytes()), 'MAPPING_HISTORY_MISMATCH')
            need(mapping['prior_vela_claim']==evidence['verification_record']['claim_id'], 'MAPPING_PRIOR_MISMATCH')
            replay=[args.bun,ROOT/'packages/shared-analysis/bin/writ-shared-analysis.ts','replay','--archive',archive,'--engine-root',args.engine_root,'--python',args.python]
            native=command(replay)
            need(native==evidence['native_revision_replay'], 'NATIVE_REPLAY_MISMATCH')
            raw=archive.read_bytes()
            archive.write_bytes(raw+b' ')
            artifact_control=command([args.vela,'replay',repo,'--json'],reject=True)
            archive.write_bytes(raw)
            broken=json.loads(raw);broken['bundles'][0]['case_file']['sha256']='sha256:'+'0'*64
            bad=Path(d)/'mismatched-native.json';bad.write_text(json.dumps(broken,sort_keys=True,separators=(',',':')))
            bad_replay=list(replay);bad_replay[bad_replay.index('--archive')+1]=bad
            native_control=command(bad_replay,reject=True)
            verification_root=evidence['verification_record']['verification_record_root'].split(':')[1]
            candidates=list((repo/'records').rglob(verification_root+'.json'))
            need(len(candidates)==1,'VERIFICATION_LOCATION')
            record=candidates[0];original=record.read_bytes();changed=json.loads(original)
            sig=changed['signatures'][0]['sig'];changed['signatures'][0]['sig']=('A' if sig[0]!='A' else 'B')+sig[1:]
            record.write_text(json.dumps(changed,sort_keys=True,separators=(',',':'))+'\n')
            signature_control=command([args.vela,'replay',repo,'--json'],reject=True)
            record.write_bytes(original)
            final=command([args.vela,'replay',repo,'--json'])
            need(final['repository_root']==expected['repository_root'], 'RESTORED_ROOT_MISMATCH')
            print(json.dumps({'schema':'writ.vela-receiving-check.v1','vela_root':vela['repository_root'],
                'native_archive_sha256':native['archive_sha256'],'freshly_checked':len(native['freshly_checked']),
                'revision_impacts':len(native['revision_impacts']),'accepted_claims':0,
                'controls':{'altered_artifact':artifact_control,'mismatched_native_subject':native_control,'altered_verification_signature':signature_control},
                'scope':'Fixture byte/root integrity and native pinned mathematical receiving; no empirical truth or human acceptance.'},sort_keys=True))
        finally:
            if existed:
                need(anchor.read_bytes()==prior,'PREEXISTING_PIN_CHANGED')
            elif anchor.exists():
                current=json.loads(anchor.read_text())
                need(current['repository_id']==REPOSITORY_ID and current['first_authority_record_root']==AUTHORITY_ROOT,'PIN_CLEANUP_IDENTITY')
                anchor.unlink()
if __name__=='__main__':
    main()
