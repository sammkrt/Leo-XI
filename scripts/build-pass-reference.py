"""Reproducible, anonymous direction model. Usage: python scripts/build-pass-reference.py research.zip"""
import csv, hashlib, io, json, math, sys, zipfile
from collections import defaultdict
from pathlib import Path

source = Path(sys.argv[1])
with zipfile.ZipFile(source) as archive:
    member = next(n for n in archive.namelist() if n.endswith('eafc_27_raw_player_data.csv'))
    raw = archive.read(member)
    records = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
def number(v):
    try:
        n = float(v)
        return int(n) if math.isfinite(n) and n >= 0 and n.is_integer() else None
    except (ValueError, TypeError):
        return None
valid, seen = [], set()
for r in records:
    identity = (r['matchId'], r['clubId'], r['playerId'])
    if identity in seen or r['clubId'] == '79638':
        continue
    seen.add(identity)
    ids = [30,31,32,33,34,35,215,216,214,11,217,218]
    e = {i:number(r.get('event_'+str(i))) for i in ids}
    if any(v is None for v in e.values()): continue
    if sum(e[i] for i in (30,32,34)) > e[215] or sum(e[i] for i in (31,33,35)) > e[216]: continue
    if any(number(r.get(k)) != v for k,v in [('passesmade',e[215]),('passattempts',e[215]+e[216]),('goals',e[214]),('assists',e[11]),('shots',e[217]+e[218])]): continue
    time = number(r['timestamp'])
    if time is None: continue
    valid.append((time,r['matchId'],r['pos'],e))
times = sorted(set(t for t,_,_,_ in valid))
cutoff = times[max(0,int(len(times)*.8)-1)]
train = [r for r in valid if r[0] <= cutoff]
test = [r for r in valid if r[0] > cutoff]
totals = defaultdict(lambda:[[0,0] for _ in range(3)])
for _,_,role,e in train:
    for key in (role,'all'):
        for j,(won,lost) in enumerate(((30,31),(32,33),(34,35))):
            totals[key][j][0]+=e[won]; totals[key][j][1]+=e[won]+e[lost]
global_rates = [s/n if n else 0 for s,n in totals['all']]
roles={}
for role, pairs in totals.items():
    roles[role]={'counts':pairs,'rates':[(s+100*global_rates[j])/(n+100) for j,(s,n) in enumerate(pairs)]}
actual=expected=attempts=0
for _,_,role,e in test:
    rates=roles.get(role,roles['all'])['rates']
    for j,(won,lost) in enumerate(((30,31),(32,33),(34,35))):
        n=e[won]+e[lost];actual+=e[won];expected+=n*rates[j];attempts+=n
result={'version':1,'source':'https://github.com/Interactive-63/eafc-pro-clubs-api-research',
 'csvSha256':hashlib.sha256(raw).hexdigest(),'rawRows':len(records),'validRows':len(valid),
 'excludedClub':'79638','trainedThrough':cutoff,'roles':roles,
 'trainingRows':len(train),'trainingMatches':len(set(r[1] for r in train)),
 'holdout':{'rows':len(test),'matches':len(set(r[1] for r in test)),'attempts':attempts,
 'calibrationErrorPP':100*(actual-expected)/attempts if attempts else None}}
Path('data/pass-reference.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='roles'},indent=2))
