#!/usr/bin/env bash
# No IAM/secret/flag mutation. Uses the existing source runtime identity and
# exact Ready serving image; GCP access remains production-ref-only WIF.
set -euo pipefail
test "$GITHUB_REF" = refs/heads/production
test "$GITHUB_REPOSITORY" = prdanielcunha/musicscale
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
chmod 700 "$workdir"
gcloud run services describe musicscale-api --project millionsnest --region us-central1 --format=json > "$workdir/service.json"
python3 - "$workdir" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
s = json.loads((p/'service.json').read_text())
# Treat missing/literal false as OFF. Never infer activation from secret presence.
env = s['spec']['template']['spec']['containers'][0].get('env', [])
flag = next((e for e in env if e['name']=='MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED'), {})
if flag.get('value') != 'true':
    (p/'disabled').touch()
    print('MUSICSCALE_SOURCE_RECOVERY_DISABLED_NO_MUTATION')
    sys.exit(0)
traffic = [t for t in s['status'].get('traffic', []) if t.get('percent', 0)>0]
assert len(traffic)==1 and traffic[0]['percent']==100, 'RECOVERY_AMBIGUOUS_SERVING_REVISION'
(p/'revision').write_text(traffic[0]['revisionName'])
PY
if test -f "$workdir/disabled"; then exit 0; fi
gcloud run revisions describe "$(cat "$workdir/revision")" --project millionsnest --region us-central1 --format=json > "$workdir/revision.json"
python3 - "$workdir" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1]); r=json.loads((p/'revision.json').read_text())
assert any(c['type']=='Ready' and c['status']=='True' for c in r['status']['conditions']), 'RECOVERY_REVISION_NOT_READY'
c=r['spec']['containers'][0]
assert r['spec']['serviceAccountName']=='mn-musicscale-runtime@millionsnest.iam.gserviceaccount.com'
# Pin immutable digest, never latest or a stale production branch image.
image=r['status'].get('imageDigest', '')
assert image.startswith('us-central1-docker.pkg.dev/millionsnest/millionsnest-web/musicscale-api@sha256:'), 'RECOVERY_IMAGE_NOT_PINNED'
names=['FIREBASE_PROJECT_ID','MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED',
       'MUSICSCALE_CONNECT_SOURCE_EVENT_SECRET','MUSICSCALE_CONNECT_OPERATOR_TARGETS_JSON']
env=[e for e in c.get('env', []) if e['name'] in names]
assert {e['name'] for e in env}==set(names), 'RECOVERY_APPROVED_SOURCE_CONFIGURATION_MISSING'
assert next(e for e in env if e['name']==names[1]).get('value')=='true'
# Keys must already be Secret Manager references in the serving source runtime.
assert 'valueFrom' in next(e for e in env if e['name']==names[2]), 'RECOVERY_SOURCE_KEY_NOT_SECRET_MANAGED'
job={'apiVersion':'run.googleapis.com/v1','kind':'Job','metadata':{'name':'musicscale-connect-source-recovery-v1'},
 'spec':{'template':{'spec':{'taskCount':1,'parallelism':1,'template':{'spec':{
 'serviceAccountName':r['spec']['serviceAccountName'],'maxRetries':0,'timeoutSeconds':'3300',
 'containers':[{'image':image,'command':['node'],'args':['dist/connect-recovery.mjs'],'env':env,
 'resources':{'limits':{'cpu':'1','memory':'512Mi'}}}]}}}}}}
(p/'job.json').write_text(json.dumps(job))
PY
# No new scheduler API, keys, permission grants, shared Rules or provider sends.
# IAM failure here is a real external blocker, never reason to broaden access.
gcloud run jobs replace "$workdir/job.json" --project millionsnest --region us-central1 --quiet > /dev/null
gcloud run jobs execute musicscale-connect-source-recovery-v1 --project millionsnest --region us-central1 --wait --quiet
echo MUSICSCALE_SOURCE_RECOVERY_JOB_COMPLETED
