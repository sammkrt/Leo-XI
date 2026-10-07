import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../data/snapshot.json' with {type:'json'};
import {uniqueMatches,weeklyAward,playerRates,validDay,amsterdamDay,matchTotals} from '../lib/club-model.mjs';
import {ClubStore} from '../lib/club-store.ts';
import {createRawExport,rawExportOptions,selectRawMatches} from '../lib/club-export.ts';
class MemoryStorage{
 constructor(){this.values=new Map()}
 async get(key){return structuredClone(this.values.get(key))}
 async put(key,value){if(typeof key==='object'){for(const [k,v]of Object.entries(key))this.values.set(k,structuredClone(v))}else this.values.set(key,structuredClone(value))}
 async delete(key){return this.values.delete(key)}
 async list({prefix}){return new Map([...this.values].filter(([key])=>key.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))}
 async transaction(callback){return callback(this)}
}
const state=()=>{const storage=new MemoryStorage();return {storage,blockConcurrencyWhile:fn=>fn()}};
const json=async(store,url,options)=>{const r=await store.fetch(new Request('https://club.test'+url,options));return {status:r.status,data:await r.json()}};
function mockEA(newMatches=snapshot.matches){return async()=>Response.json({clubId:'79638',matchType:'leagueMatch',matches:newMatches,fetchedAt:new Date().toISOString()})}
test('archive de-duplicates match IDs and orders newest first',()=>{const m=uniqueMatches([...snapshot.matches,...snapshot.matches]);assert.equal(m.length,10);assert.ok(m.every((row,i)=>!i||m[i-1].timestamp>=row.timestamp));assert.equal(matchTotals(m).games,10)});
test('player comparison uses appearance rates rather than totals',()=>{const p=playerRates({gamesPlayed:'20',goals:'10',assists:'5',ratingAve:'7.2',passSuccessRate:'80',tacklesMade:'30'});assert.equal(p.goals,.5);assert.equal(p.assists,.25);assert.equal(p.tackles,1.5);assert.equal(playerRates({gamesPlayed:'0'}).goals,0)});
test('award excludes insufficient appearances and uses a rolling seven day window',()=>{const now=Date.parse('2026-10-07T12:00:00Z');const m=structuredClone(snapshot.matches[0]);const list=[0,1,2].map(i=>({...m,matchId:String(123000+i),timestamp:now/1000-i*86400,players:{'79638':{a:{playername:'Three games',rating:'8.0',goals:'1',assists:'0',mom:'0'},...(i===0?{b:{playername:'One game',rating:'10.0'}}:{})}}}));assert.equal(weeklyAward(list,now).name,'Three games');assert.equal(weeklyAward(list.slice(0,2),now),null);assert.equal(weeklyAward(list,now+10*86400000),null)});
test('archive survives a store restart and EA failure does not erase matches',async()=>{const previous=globalThis.fetch;try{const s=state();const store=new ClubStore(s);await store.ready;globalThis.fetch=mockEA();await store.sync();const extra=structuredClone(snapshot.matches[0]);extra.matchId='999999111';globalThis.fetch=mockEA([extra]);await store.sync();const restarted=new ClubStore(s);const before=await json(restarted,'/api/archive');assert.equal(before.data.matches.length,11);globalThis.fetch=async()=>{throw Error('Unavailable')};const failed=await restarted.sync();assert.equal(failed.mode,'snapshot');assert.match(failed.notice,/Otomatik/);const after=await json(restarted,'/api/archive');assert.equal(after.data.matches.length,11);assert.ok(after.data.notice)}finally{globalThis.fetch=previous}});
test('attendance updates are shared, replace existing status and survive restart',async()=>{const s=state();const store=new ClubStore(s);const day=amsterdamDay();const player=snapshot.members[0].name;const post=status=>json(store,'/api/attendance?date='+day,{method:'POST',body:JSON.stringify({player,status})});assert.equal((await post('yes')).status,200);assert.equal((await post('maybe')).data.entries.length,1);const r=await json(new ClubStore(s),'/api/attendance?date='+day);assert.equal(r.data.entries[0].status,'maybe');assert.equal(r.data.persistent,true)});
test('attendance rejects invalid players, status and dates',async()=>{const store=new ClubStore(state());const day=amsterdamDay();const post=body=>json(store,'/api/attendance?date='+day,{method:'POST',body:JSON.stringify(body)});assert.equal((await post({player:'unknown',status:'yes'})).status,400);assert.equal((await post({player:snapshot.members[0].name,status:'fake'})).status,400);assert.equal((await json(store,'/api/attendance?date=2026-02-31')).status,400);assert.equal(validDay('invalid'),false)});
test('feed HTTP failures preserve data, and a valid scheduled update clears errors',async()=>{const previous=globalThis.fetch;try{const store=new ClubStore(state());await store.ready;globalThis.fetch=async()=>new Response('Forbidden',{status:403});const failed=await store.sync();assert.equal(failed.syncFailure.code,'FEED_HTTP_403');assert.match(failed.notice,/Otomatik/);assert.equal(failed.matches.length,10);const cached=await json(store,'/api/club');assert.equal(cached.data.syncFailure.code,'FEED_HTTP_403');globalThis.fetch=mockEA();const recovered=await store.sync();assert.equal(recovered.mode,'scheduled');assert.equal((await json(store,'/api/club')).data.syncFailure,undefined)}finally{globalThis.fetch=previous}});

test('page reads never fetch upstream data; invalid feeds cannot erase stored records',async()=>{const previous=globalThis.fetch;try{const store=new ClubStore(state());await store.ready;let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({...snapshot,club:{clubId:'999'}})};await json(store,'/api/club');assert.equal(requests,0);const failed=await store.sync();assert.equal(failed.syncFailure.code,'FEED_INVALID_DATA');assert.equal(failed.club.clubId,snapshot.club.clubId);assert.equal(failed.matches.length,10)}finally{globalThis.fetch=previous}});

import {playerEvents,decodedPlayer,eventSummary} from '../lib/club-events.mjs';
test('event decoding distinguishes missing data from zero events and rejects malformed counters',()=>{assert.equal(playerEvents({}),null);assert.equal(playerEvents({match_event_aggregate_0:''}),null);assert.equal(playerEvents({match_event_aggregate_0:'214:-1'}),null);assert.equal(playerEvents({match_event_aggregate_0:'214:1,bad'}),null);assert.equal(playerEvents({match_event_aggregate_0:'214:9007199254740992'}),null);const events=playerEvents({match_event_aggregate_0:'214:1,215:4',match_event_aggregate_1:'11:2'});assert.equal(events.get(214),1);assert.equal(events.get(11),2);assert.equal(decodedPlayer({goals:'2',match_event_aggregate_0:'214:1'}),null)});
test('advanced summary filters player and team, and never invents negative pass residuals',()=>{const rows=[{matchId:'1',players:{'79638':{a:{goals:'1',assists:'0',shots:'3',match_event_aggregate_0:'214:1,217:2,218:1,215:4,216:2,30:5,31:1,108:2,115:1'},b:{match_event_aggregate_0:'215:6,216:3,174:2'}},'999':{c:{match_event_aggregate_0:'215:100'}}}},{matchId:'2',players:{'79638':{a:{goals:'4',match_event_aggregate_0:'214:1'},b:{}}}}];const sum=eventSummary(rows);assert.equal(sum.appearances,4);assert.equal(sum.covered,2);assert.equal(sum.completed,10);assert.equal(sum.matches,1);assert.equal(sum.secondAssists,1);const selected=eventSummary(rows,'79638','a');assert.equal(selected.appearances,2);assert.equal(selected.covered,1);assert.equal(selected.shots,3);assert.equal(selected.directionOther[0],null);assert.equal(selected.directionOther[1],1);assert.equal(eventSummary(rows,'999').completed,100)});
test('research goal, assist and shot mappings reconcile with the stored LEO XI records',()=>{const rows=snapshot.matches.flatMap(m=>Object.values(m.players?.['79638']||{}));let checked=0;for(const p of rows){const e=playerEvents(p);if(!e)continue;checked++;assert.equal(e.get(214)||0,Number(p.goals));assert.equal(e.get(11)||0,Number(p.assists));assert.equal((e.get(217)||0)+(e.get(218)||0),Number(p.shots));assert.ok(decodedPlayer(p));}assert.ok(checked>0);const summary=eventSummary(snapshot.matches);assert.equal(summary.covered,checked);assert.equal(summary.appearances,rows.length)});

import {comparisonValue,betterSide,numericField} from '../lib/club-comparison.mjs';
test('comparison preserves missing values and only divides counters with valid appearances',()=>{for(const value of [undefined,null,'',false,'bad','Infinity',-1])assert.equal(numericField(value),null);assert.equal(numericField('0'),0);const p={gamesPlayed:'20',goals:'10',assists:'5',winRate:'60'};assert.equal(comparisonValue(p,'contributions','count','perGame'),.75);assert.equal(comparisonValue(p,'goals','count','total'),10);assert.equal(comparisonValue(p,'winRate','percent','perGame'),60);assert.equal(comparisonValue({...p,gamesPlayed:'0'},'goals','count','perGame'),null);assert.equal(comparisonValue({...p,assists:undefined},'contributions','count'),null);assert.equal(betterSide(0,2,'count','lower'),'left');assert.equal(betterSide(null,2,'count'),null);assert.equal(betterSide(180,175,'height'),null)});

import {deepGroups,deepMetric,comparisonSample} from '../lib/club-deep-comparison.mjs';
const definition=id=>deepGroups.flatMap(g=>g.metrics).find(m=>m.id===id);
test('deep ratios use pooled attempts and retain zero and missing coverage separately',()=>{
 const rows=[{match_event_aggregate_0:'215:1,216:1'},{match_event_aggregate_0:'215:9,216:1'},{match_event_aggregate_0:'214:0'},{}];
 const rate=deepMetric(rows,definition('passRate'));assert.ok(Math.abs(rate.value-100*10/12)<1e-10);assert.equal(rate.covered,3);assert.equal(rate.available,4);assert.equal(rate.median,70);assert.equal(rate.deviation,20);
 const count=deepMetric(rows,definition('completed'));assert.equal(count.total,10);assert.equal(count.perMatch,10/3);assert.equal(deepMetric([{}],definition('completed')).total,null);
 assert.equal(deepMetric([{match_event_aggregate_0:'214:0'}],definition('passRate')).value,null);
});
test('deep metric eligibility is independent and residual errors cannot cancel across matches',()=>{
 const rows=[{goals:'2',match_event_aggregate_0:'214:1,215:2,30:3'},{goals:'1',match_event_aggregate_0:'214:1,215:3,30:1'}];
 const goals=deepMetric(rows,definition('goals'));assert.equal(goals.covered,1);assert.equal(goals.inconsistent,1);assert.equal(deepMetric(rows,definition('completed')).covered,2);
 const residual=deepMetric(rows,definition('unknownDirectionMade'));assert.equal(residual.total,2);assert.equal(residual.covered,1);assert.equal(residual.inconsistent,1);
 const overlap=deepMetric([{match_event_aggregate_0:'214:1,131:2'}],definition('weakFootShare'));assert.equal(overlap.value,null);assert.equal(overlap.inconsistent,1);
});
test('sample filters shared appearances, recorded position, type and stable player identities',()=>{
 const a={playername:'left',pos:'forward'},b={playername:'right',pos:'midfielder'};
 const m=(id,t,players,extra={})=>({matchId:id,timestamp:t,players:{'79638':players},...extra});
 const rows=[m('1',1,{a,b}),m('2',2,{a:{...a,playername:'renamed'},b:{...b,pos:'forward'}}),m('3',3,{a}),m('4',4,{a,b},{matchType:'playoffMatch'})];
 const all=comparisonSample([...rows,rows[0]],'left','right');assert.equal(all.left.length,3);assert.equal(all.right.length,2);assert.equal(all.commonCount,2);assert.equal(all.left[1].playername,'renamed');
 const common=comparisonSample(rows,'left','right',{common:true,position:'forward'});assert.deepEqual(common.matches.map(m=>m.matchId),['2']);assert.equal(common.left.length,1);assert.equal(common.right.length,1);
 const recent=comparisonSample(rows,'left','right',{window:'1'});assert.deepEqual(recent.matches.map(m=>m.matchId),['3']);assert.equal(recent.right.length,0);
 assert.equal(comparisonSample(rows,'left','right',{matchType:'playoffMatch'}).matches.length,1);
});
test('stored LEO XI match comparison agrees with named goal and assist totals',()=>{
 const sample=comparisonSample(snapshot.matches,snapshot.members[0].name,snapshot.members[1].name,{common:true});assert.ok(sample.commonCount>0);
 for(const rows of [sample.left,sample.right]){const valid=rows.filter(r=>playerEvents(r));const contribution=deepMetric(rows,definition('contributions'));assert.equal(contribution.total,valid.reduce((n,r)=>n+Number(r.goals)+Number(r.assists),0));assert.equal(contribution.covered,valid.length);}
});

test('daily collection allows a 24-hour-old feed and flags a missed daily update after 36 hours',async()=>{const s=state(),store=new ClubStore(s);await store.ready;const latest=await s.storage.get('latest');await s.storage.put('latest',{...latest,fetchedAt:new Date(Date.now()-24*60*60*1000).toISOString()});assert.equal((await json(store,'/api/club')).data.notice,undefined);await s.storage.put('latest',{...latest,fetchedAt:new Date(Date.now()-37*60*60*1000).toISOString()});assert.match((await json(store,'/api/club')).data.notice,/36 saati/);assert.equal((await json(store,'/api/archive')).data.matches.length,10);});

import {validateMatchFeed} from '../lib/club-feed.mjs';
test('match-only collection archives new matches without making old club totals look fresh',async()=>{const oldFetch=globalThis.fetch;try{const s=state(),store=new ClubStore(s);await store.ready;const original=(await json(store,'/api/club')).data;const match=structuredClone(snapshot.matches[0]);match.matchId='999222111';const when=new Date().toISOString();globalThis.fetch=async()=>Response.json({clubId:'79638',matchType:'leagueMatch',matches:[match],fetchedAt:when});await store.sync();const club=(await json(store,'/api/club')).data,archive=(await json(store,'/api/archive')).data;assert.equal(club.fetchedAt,original.fetchedAt);assert.deepEqual(club.overall,original.overall);assert.equal(club.matches[0].matchId,match.matchId);assert.equal(archive.matches.length,11);assert.equal(archive.lastMatchUpdate,when);globalThis.fetch=async()=>Response.json({clubId:'79638',matchType:'leagueMatch',matches:[],fetchedAt:snapshot.fetchedAt});assert.equal((await store.sync()).syncFailure.code,'FEED_OLDER_DATA');assert.equal((await json(store,'/api/archive')).data.matches.length,11);}finally{globalThis.fetch=oldFetch}});
test('legacy seed feed is used only while the dedicated match file is absent',async()=>{const oldFetch=globalThis.fetch;try{const store=new ClubStore(state());let urls=[];globalThis.fetch=async url=>{urls.push(String(url));return String(url).endsWith('matches.json')?new Response('',{status:404}):Response.json({...snapshot,fetchedAt:new Date().toISOString()})};assert.equal((await store.sync()).mode,'scheduled');assert.equal(urls.length,2);urls=[];globalThis.fetch=async url=>{urls.push(String(url));return new Response('',{status:403})};assert.equal((await store.sync()).syncFailure.code,'FEED_HTTP_403');assert.equal(urls.length,1);}finally{globalThis.fetch=oldFetch}});
test('match feeds reject wrong clubs, duplicates, malformed matches and future data',()=>{const feed={clubId:'79638',matchType:'leagueMatch',matches:snapshot.matches,fetchedAt:new Date().toISOString()};assert.equal(validateMatchFeed(feed).matches.length,10);for(const invalid of [{...feed,clubId:'999'},{...feed,matchType:'playoffMatch'},{...feed,matches:[snapshot.matches[0],snapshot.matches[0]]},{...feed,matches:[{}]},{...feed,fetchedAt:new Date(Date.now()+3600000).toISOString()}])assert.throws(()=>validateMatchFeed(invalid));});

const rawMatch=(id,when,extra={})=>({matchId:id,timestamp:Date.parse(when)/1000,clubs:{'79638':{goals:'2'},'42':{goals:'1',details:{name:'Rakip'}}},...extra});
const rawIds=(rows,selection)=>selectRawMatches(rows,selection).map(match=>match.matchId);
const exportTime='2026-10-07T12:00:00.000Z';

test('raw all-time export includes every unique available match and preserves full records',()=>{
 const rows=[...snapshot.matches,snapshot.matches[0]];
 const exported=JSON.parse(createRawExport(rows,{scope:'all-time'},exportTime).json);
 assert.equal(exported.matchCount,10);assert.equal(exported.matches.length,10);
 assert.deepEqual(exported.matches,snapshot.matches);
 assert.equal(exported.timezone,'Europe/Amsterdam');assert.equal(exported.exportedAt,exportTime);
 assert.deepEqual(exported.selection,{});assert.equal(createRawExport(rows,{scope:'all-time'},exportTime).filename,'leo-xi-raw-all-time.json');
});

test('raw match export selects exactly one complete match without inventing a match type',()=>{
 const rows=[rawMatch('1','2026-10-06T20:00:00Z'),rawMatch('2','2026-10-07T20:00:00Z')];
 const file=createRawExport(rows,{scope:'match',key:'1'},exportTime),value=JSON.parse(file.json);
 assert.deepEqual(value.matches,[rows[0]]);assert.deepEqual(value.selection,{matchId:'1'});
 assert.equal(value.matchCount,1);assert.equal(file.filename,'leo-xi-raw-match-1.json');
 assert.equal('matchType' in value.matches[0],false);
 const option=rawExportOptions(rows,'match').find(row=>row.key==='1');
 assert.match(option.label,/Rakip/);assert.match(option.label,/2:1/);assert.match(option.label,/22:00/);
});

test('raw sessions use Amsterdam calendar days and are ordered newest first with unique counts',()=>{
 const rows=[rawMatch('1','2026-10-06T21:59:00Z'),rawMatch('2','2026-10-06T22:00:00Z'),rawMatch('3','2026-10-07T01:00:00Z')];
 const options=rawExportOptions([...rows,rows[2]],'session');
 assert.deepEqual(options.map(({key,matchCount})=>({key,matchCount})),[{key:'2026-10-07',matchCount:2},{key:'2026-10-06',matchCount:1}]);
 assert.deepEqual(rawIds(rows,{scope:'session',key:'2026-10-07'}),['3','2']);
 assert.equal(createRawExport(rows,{scope:'session',key:'2026-10-07'},exportTime).filename,'leo-xi-raw-session-2026-10-07.json');
});

test('raw calendar weeks group different days and split at Amsterdam Monday midnight',()=>{
 const rows=[rawMatch('1','2026-09-28T12:00:00Z'),rawMatch('2','2026-10-04T21:59:00Z'),rawMatch('3','2026-10-04T22:00:00Z'),rawMatch('4','2026-10-07T12:00:00Z')];
 const options=rawExportOptions(rows,'week');
 assert.deepEqual(options.map(row=>[row.key,row.matchCount]),[['2026-W41',2],['2026-W40',2]]);
 assert.deepEqual(rawIds(rows,{scope:'week',key:'2026-W41'}),['4','3']);
 assert.match(options[0].label,/05 Ekim 2026/);assert.match(options[0].label,/11 Ekim 2026/);
 assert.equal(createRawExport(rows,{scope:'week',key:'2026-W41'},exportTime).filename,'leo-xi-raw-week-2026-W41.json');
});

test('raw ISO week year is correct across New Year including week 53',()=>{
 const rows=[rawMatch('1','2020-12-31T12:00:00Z'),rawMatch('2','2021-01-03T22:59:00Z'),rawMatch('3','2021-01-03T23:00:00Z'),rawMatch('4','2021-01-07T12:00:00Z')];
 assert.deepEqual(rawExportOptions(rows,'week').map(row=>[row.key,row.matchCount]),[['2021-W01',2],['2020-W53',2]]);
 assert.deepEqual(rawIds(rows,{scope:'week',key:'2020-W53'}),['2','1']);
});

test('raw month grouping uses Amsterdam midnight and includes all days in the chosen month',()=>{
 const rows=[rawMatch('1','2026-09-30T21:59:00Z'),rawMatch('2','2026-09-30T22:00:00Z'),rawMatch('3','2026-10-20T12:00:00Z')];
 assert.deepEqual(rawExportOptions(rows,'month').map(row=>[row.key,row.matchCount]),[['2026-10',2],['2026-09',1]]);
 assert.deepEqual(rawIds(rows,{scope:'month',key:'2026-10'}),['3','2']);
 assert.equal(createRawExport(rows,{scope:'month',key:'2026-10'},exportTime).filename,'leo-xi-raw-month-2026-10.json');
});

test('raw calendar grouping respects winter offsets and DST transitions',()=>{
 const rows=[rawMatch('1','2026-03-29T00:30:00Z'),rawMatch('2','2026-03-29T01:30:00Z'),rawMatch('3','2026-10-25T00:30:00Z'),rawMatch('4','2026-10-25T01:30:00Z'),rawMatch('5','2026-10-25T22:59:00Z'),rawMatch('6','2026-10-25T23:00:00Z')];
 assert.deepEqual(rawExportOptions(rows,'session').map(row=>[row.key,row.matchCount]),[['2026-10-26',1],['2026-10-25',3],['2026-03-29',2]]);
 assert.deepEqual(rawIds(rows,{scope:'session',key:'2026-10-25'}),['5','4','3']);
 assert.deepEqual(rawIds(rows,{scope:'week',key:'2026-W44'}),['6']);
});

test('raw export leaves missing values, both teams, counters and unknown nested fields untouched',()=>{
 const row=rawMatch('1','2026-10-07T12:00:00Z',{clubs:{'79638':{goals:null},'42':{details:{name:'Rakip'},unknownClubField:[1,null]}},players:{'79638':{a:{playername:'A',match_event_aggregate_0:'214:0,215:7',futureField:{value:null}}},'42':{b:{playername:'B',goals:'0'}}},unknownMatchField:{nested:[0,null,{source:'EA'}]}});
 const before=structuredClone(row);
 function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}}
 freeze(row);
 const parsed=JSON.parse(createRawExport([row],{scope:'match',key:'1'},exportTime).json);
 assert.deepEqual(parsed.matches,[before]);assert.deepEqual(row,before);
 assert.equal('goals' in parsed.matches[0].players['79638'].a,false);
 assert.equal(parsed.matches[0].clubs['79638'].goals,null);
 assert.equal(selectRawMatches([row],{scope:'all-time'})[0],row);
 const option=rawExportOptions([row],'match')[0];assert.match(option.label,/—:—/);
});

test('raw empty and unavailable selections contain no fabricated records',()=>{
 for(const scope of ['all-time','session','match','week','month']){
  const selection=scope==='all-time'?{scope}:{scope,key:'missing'};
  assert.deepEqual(rawExportOptions([],scope),[]);assert.equal(selectRawMatches([],selection).length,0);
  assert.equal(JSON.parse(createRawExport([],selection,exportTime).json).matchCount,0);
 }
 const rows=[rawMatch('1','2026-10-07T12:00:00Z')];
 for(const scope of ['session','match','week','month'])assert.deepEqual(selectRawMatches(rows,{scope,key:'missing'}),[]);
});

test('raw duplicate IDs are exported once with the existing last-record-wins policy',()=>{
 const first=rawMatch('1','2026-10-06T12:00:00Z',{rawField:'old'}),last=rawMatch('1','2026-10-07T12:00:00Z',{rawField:'verified'});
 assert.deepEqual(selectRawMatches([first,last],{scope:'all-time'}),[last]);
 assert.deepEqual(rawExportOptions([first,last],'session').map(row=>[row.key,row.matchCount]),[['2026-10-07',1]]);
 assert.equal(JSON.parse(createRawExport([first,last],{scope:'match',key:'1'},exportTime).json).matches[0].rawField,'verified');
});

test('raw filenames and JSON serialization are deterministic without reordering or mutating input',()=>{
 const a=rawMatch('2','2026-10-07T12:00:00Z'),b=rawMatch('1','2026-10-07T12:00:00Z');const rows=[a,b];
 const before=structuredClone(rows);
 assert.deepEqual(createRawExport(rows,{scope:'all-time'},exportTime),createRawExport([b,a],{scope:'all-time'},exportTime));
 assert.deepEqual(rawIds(rows,{scope:'all-time'}),['1','2']);assert.deepEqual(rows,before);
});


test('raw ID grouping follows archive string identity without changing the original ID field',()=>{
 const rows=[rawMatch('1','2026-10-07T12:00:00Z'),rawMatch(1,'2026-10-07T12:00:00Z')];
 const exported=JSON.parse(createRawExport(rows,{scope:'match',key:'1'},exportTime).json);
 assert.equal(exported.matchCount,1);assert.equal(exported.matches[0].matchId,1);
 assert.equal(rawExportOptions(rows,'match')[0].key,'1');
});

test('raw export keeps sparse records even when clubs and players are missing',()=>{
 const row={matchId:'19',timestamp:Date.parse('2026-10-07T12:00:00Z')/1000,unknown:{events:[null,0,'7']}};
 for(const selection of [{scope:'all-time'},{scope:'match',key:'19'},{scope:'session',key:'2026-10-07'},{scope:'week',key:'2026-W41'},{scope:'month',key:'2026-10'}]){
  const value=JSON.parse(createRawExport([row],selection,exportTime).json);
  assert.deepEqual(value.matches,[row]);assert.equal(value.matchCount,1);
  assert.equal('clubs' in value.matches[0],false);assert.equal('players' in value.matches[0],false);
 }
 assert.match(rawExportOptions([row],'match')[0].label,/—:—/);
});

test('raw export round-trips complete Durable Object archive records including unknown fields',async()=>{
 const s=state(),store=new ClubStore(s);await store.ready;
 const raw=structuredClone(snapshot.matches[0]);raw.matchId='991234567';
 raw.futureRawField={nested:[null,0,{counter:'12'}]};
 const opponent=Object.keys(raw.clubs).find(id=>id!=='79638');
 raw.clubs[opponent].futureRawClubField={events:[1,2]};
 await s.storage.put('match:'+raw.matchId,raw);
 const archive=(await json(new ClubStore(s),'/api/archive')).data;
 const file=createRawExport(archive.matches,{scope:'match',key:raw.matchId},exportTime);
 assert.deepEqual(JSON.parse(file.json).matches,[raw]);
 assert.deepEqual(await s.storage.get('match:'+raw.matchId),raw);
});
