"""Read the supplied SQLite store without modifying it; export canonical matches."""
import argparse, sqlite3, json, hashlib, datetime, pathlib
p=argparse.ArgumentParser();p.add_argument('store');p.add_argument('--archive',required=True);p.add_argument('--output',required=True);args=p.parse_args()
c=sqlite3.connect(pathlib.Path(args.store).resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
if c.execute('pragma integrity_check').fetchone()[0]!='ok':raise ValueError('Store integrity check failed')
archive=json.loads(pathlib.Path(args.archive).read_text())['matches'];identities={}
for match in sorted(archive,key=lambda m:m['timestamp']):
 for club,players in match.get('players',{}).items():
  for pid,row in players.items():
   if row and row.get('playername'):identities[(club,row['playername'].lower())]=pid
matches=[];synthetic=set()
for r in c.execute('select * from ZDERIVEDMATCHDETAIL order by ZTIMESTAMP desc'):
 if r['ZCLUBID']!=79638 or r['ZGAMEVERSION']!='FC27' or r['ZPLATFORMRAW']!='common-gen5' or r['ZMATCHTYPERAW']!='leagueMatch':raise ValueError('Unexpected club, game, platform or match type')
 mid=r['ZMATCHID'];clubs=json.loads(r['ZCLUBSJSON']);ours='79638';opp=str(r['ZOPPONENTCLUBID']);players={}
 if not mid.isdigit() or int(clubs[ours]['goals'])!=r['ZCLUBSCORE'] or int(clubs[opp]['goals'])!=r['ZOPPONENTSCORE']:raise ValueError('Invalid identity or conflicting score')
 for club,field in [(ours,'ZCLUBPLAYERSJSON'),(opp,'ZOPPONENTPLAYERSJSON')]:
  rows={}
  for player in json.loads(r[field]):
   name=player['playername'];pid=identities.get((club,name.lower()))
   if not pid:
    pid='historical:'+club+':'+hashlib.sha256(name.lower().encode()).hexdigest()[:20];synthetic.add((club,name))
   if pid in rows:raise ValueError('Duplicate player in match')
   rows[pid]=player
  players[club]=rows
 matches.append({'matchId':mid,'timestamp':r['ZTIMESTAMP']+978307200,'matchType':'leagueMatch','clubs':clubs,'players':players,'aggregate':json.loads(r['ZAGGREGATEJSON']),'importSource':'FCClubsDerived_v6_FC27.store'})
if len({m['matchId'] for m in matches})!=len(matches):raise ValueError('Duplicate match ID')
content=json.dumps(matches,ensure_ascii=False,separators=(',',':'))
version='fc27-store-'+hashlib.sha256(content.encode()).hexdigest()[:16]
result={'version':version,'clubId':'79638','gameVersion':'FC27','platform':'common-gen5','sourceSha256':hashlib.sha256(pathlib.Path(args.store).read_bytes()).hexdigest(),'timestampEncoding':'Apple epoch converted to Unix seconds (+978307200)','syntheticOpponentIdentities':len(synthetic),'matches':matches}
pathlib.Path(args.output).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'version':version,'matches':len(matches),'overlap':len({m['matchId'] for m in matches}&{m['matchId'] for m in archive}),'syntheticClubIdentities':len([x for x in synthetic if x[0]=='79638']),'syntheticOpponentIdentities':len(synthetic),'maxMatchBytes':max(len(json.dumps(m).encode()) for m in matches)}))
