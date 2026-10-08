import {locationFromSearch,routeSearch} from '../lib/club-routes.ts';
import {weeklyCards} from '../lib/weekly-cards.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../data/snapshot.json' with {type:'json'};
import {uniqueMatches,weeklyAward,playerRates,validDay,amsterdamDay,matchTotals} from '../lib/club-model.mjs';
import {ClubStore} from '../lib/club-store.ts';
import {createRawExport,rawExportOptions,selectRawMatches} from '../lib/club-export.ts';
import {finiteCounter,playerRows,filterPlayerRows,summarize,metrics,metricIds,groupSessions,defaultFilters,filterMatches,previousMatches,playerSummaries,teamSummary,pairSummaries,passingProfile,rollingTrend,buildAnalyticsReport,analyticsCSV,filtersFromSearch,filtersToSearch,rolePercentile,parseJournal,evidenceFor,matchEvidence,analyticsFilename,playerCoordinates,resolveAnalyticsFilters} from '../lib/club-analytics.ts';
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

const analysisMatch=(id,when,players={},goals='2',conceded='1')=>rawMatch(id,when,{players:{'79638':players},clubs:{'79638':{goals},'42':{goals:conceded,details:{name:'Rakip'}}}});
const analysisPlayer=(extra={})=>({playername:'Oyuncu',pos:'midfielder',...extra});

test('analytics counters distinguish null, zero, malformed, negative and nonfinite data',()=>{
 for(const value of [undefined,null,'',' ',false,{},[],Infinity,-1,'NaN'])assert.equal(finiteCounter(value),null);
 assert.equal(finiteCounter('0'),0);assert.equal(finiteCounter(0),0);assert.equal(finiteCounter('8.5'),8.5);
 const rows=playerRows([analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({goals:'0'})})]);
 assert.equal(summarize(rows,'goals').value,0);assert.equal(summarize(rows,'shots').value,null);
 assert.equal(summarize(rows,'goals').covered,1);assert.equal(summarize(rows,'shots').covered,0);
});

test('analytics pass rates pool numerator and denominator instead of averaging percentages',()=>{
 const rows=playerRows([analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({passesmade:'1',passattempts:'1'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({passesmade:'20',passattempts:'100'})})]);
 const rate=summarize(rows,'passRate');assert.equal(rate.value,21/101*100);assert.equal(rate.numerator,21);assert.equal(rate.denominator,101);assert.equal(rate.covered,2);
 const zero=playerRows([analysisMatch('3','2026-10-08T12:00Z',{p:analysisPlayer({passesmade:'0',passattempts:'0'})})]);
 assert.equal(summarize(zero,'passRate').value,null);assert.equal(summarize(zero,'passRate').covered,1);assert.equal(summarize(zero,'passAttempts').value,0);
});

test('analytics player per-match denominator uses each metric valid appearances',()=>{
 const rows=playerRows([analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({goals:'2',shots:'8'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({goals:'0'})}),analysisMatch('3','2026-10-09T12:00Z',{p:analysisPlayer({goals:null})})]);
 assert.equal(summarize(rows,'goals').perMatch,1);assert.equal(summarize(rows,'goals').covered,2);assert.equal(summarize(rows,'goals').available,3);assert.equal(summarize(rows,'shots').perMatch,8);
 const inconsistent=playerRows([analysisMatch('4','2026-10-10T12:00Z',{p:analysisPlayer({passesmade:'5',passattempts:'2',goals:'1'})})]);
 assert.equal(summarize(inconsistent,'passRate').value,null);assert.equal(summarize(inconsistent,'goals').value,1);
});

test('analytics joins stable player IDs across names and preserves recorded role changes',()=>{
 const matches=[analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({playername:'Eski',pos:'defender',goals:'1'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({playername:'Yeni',pos:'midfielder',goals:'2'}),q:analysisPlayer({playername:'Eski',goals:'0'})})];
 const summaries=playerSummaries(matches,defaultFilters),p=summaries.find(p=>p.id==='p');assert.equal(p.name,'Yeni');assert.deepEqual(p.aliases,['Yeni','Eski']);assert.equal(p.matches,2);assert.equal(summaries.length,2);assert.deepEqual(new Set(p.roles),new Set(['defender','midfielder']));
 const rows=filterPlayerRows(matches,{playerIds:['p'],role:'defender'});assert.equal(rows.length,1);assert.equal(summarize(rows,'goals').value,1);
 const dup=playerRows([...matches,matches[0]]);assert.equal(dup.length,3);assert.equal(summarize([...dup,...dup],'goals').total,3);
});

test('analytics sessions cross Amsterdam midnight and split only at the configurable time gap',()=>{
 const matches=[analysisMatch('1','2026-10-06T21:50Z'),analysisMatch('2','2026-10-06T22:10Z'),analysisMatch('3','2026-10-07T00:10Z'),analysisMatch('4','2026-10-07T03:00Z')];
 const sessions=groupSessions(matches,120);assert.equal(sessions.length,2);assert.deepEqual(sessions[1].matches.map(m=>m.matchId),['1','2','3']);
 assert.equal(groupSessions(matches,30).length,3);
 const selected=filterMatches(matches,{...defaultFilters,scope:'session',key:'1'});assert.deepEqual(selected.map(m=>m.matchId),['3','2','1']);
});

test('analytics sessions use real elapsed time across both DST transitions',()=>{
 const spring=[analysisMatch('1','2026-03-29T00:30Z'),analysisMatch('2','2026-03-29T01:30Z')];
 const fall=[analysisMatch('3','2026-10-25T00:30Z'),analysisMatch('4','2026-10-25T01:30Z')];
 assert.equal(groupSessions(spring,60).length,1);assert.equal(groupSessions(fall,60).length,1);assert.equal(groupSessions(fall,30).length,2);
});

test('analytics calendar and custom scopes apply Amsterdam date boundaries',()=>{
 const matches=[analysisMatch('1','2026-09-30T21:59Z'),analysisMatch('2','2026-09-30T22:00Z'),analysisMatch('3','2026-10-04T22:00Z')];
 assert.deepEqual(filterMatches(matches,{...defaultFilters,scope:'month',key:'2026-10'}).map(m=>m.matchId),['3','2']);
 assert.deepEqual(filterMatches(matches,{...defaultFilters,scope:'week',key:'2026-W41'}).map(m=>m.matchId),['3']);
 assert.deepEqual(filterMatches(matches,{...defaultFilters,scope:'custom',from:'2026-10-01',to:'2026-10-01'}).map(m=>m.matchId),['2']);
 assert.deepEqual(filterMatches(matches,{...defaultFilters,scope:'custom',from:'2026-02-30',to:'2026-10-01'}),[]);
});

test('analytics previous equal match sample excludes current records and preserves filters',()=>{
 const matches=Array.from({length:12},(_,i)=>analysisMatch(String(i+1),`2026-10-${String(i+1).padStart(2,'0')}T12:00Z`,{p:analysisPlayer({goals:'1'})}));
 const filters={...defaultFilters,scope:'last5'},selected=filterMatches(matches,filters),previous=previousMatches(matches,selected,filters);
 assert.deepEqual(selected.map(m=>m.matchId),['12','11','10','9','8']);assert.deepEqual(previous.map(m=>m.matchId),['7','6','5','4','3']);
 assert.equal(new Set([...selected,...previous].map(m=>m.matchId)).size,10);
});

test('analytics previous calendar span is stable across DST, with custom overlap excluded',()=>{
 const matches=[analysisMatch('1','2026-03-22T12:00Z'),analysisMatch('2','2026-03-23T12:00Z'),analysisMatch('3','2026-03-29T12:00Z'),analysisMatch('4','2026-03-30T12:00Z')];
 const filters={...defaultFilters,scope:'week',key:'2026-W14'},selected=filterMatches(matches,filters);
 assert.deepEqual(previousMatches(matches,selected,filters).map(m=>m.matchId),['3','2']);
 assert.deepEqual(previousMatches(matches,selected,{...filters,compare:'custom',compareFrom:'2026-03-29',compareTo:'2026-03-30'}).map(m=>m.matchId),['3']);
});

test('analytics club scores are separate from career totals and summed goal contributions',()=>{
 const match=analysisMatch('1','2026-10-07T12:00Z',{a:analysisPlayer({goals:'1',assists:'1'}),b:analysisPlayer({goals:'1',assists:'1'})});
 assert.equal(teamSummary([match]).goals,2);assert.equal(summarize(playerRows([match]),'contributions').total,4);
 const report=buildAnalyticsReport(snapshot.matches,defaultFilters,exportTime);assert.equal(report.team.matches,uniqueMatches(snapshot.matches).length);assert.equal('overall' in report,false);assert.equal('per90' in metrics,false);
 const absent=analysisMatch('2','2026-10-08T12:00Z',{},null,null);assert.equal(teamSummary([absent]).goals,null);assert.equal(teamSummary([absent]).covered,0);assert.equal(teamSummary([absent]).pointsPerMatch,null);
});

test('analytics direction and length partitions reject contradictory rows before pooling',()=>{
 const matches=[analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({match_event_aggregate_0:'215:5,216:1,30:3,31:1,32:1,24:2,26:2'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({match_event_aggregate_0:'215:1,216:0,30:4,24:3'})})];
 const rows=playerRows(matches),direction=passingProfile(rows,'direction'),length=passingProfile(rows,'length');
 assert.equal(direction.covered,1);assert.equal(length.covered,1);assert.equal(direction.rows.reduce((a,r)=>a+r.made,0),5);assert.equal(direction.rows.reduce((a,r)=>a+r.failed,0),1);
 assert.equal(summarize(rows,'forwardRate').covered,1);assert.equal(summarize(rows,'forwardRate').value,75);
 assert.equal(passingProfile([], 'direction').rows[0].made,null);
});

test('analytics event families do not add overlapping defense counters or invent dribble success',()=>{
 const rows=playerRows([analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({tacklesmade:'3',match_event_aggregate_0:'6:2,108:4,174:1'})})]);
 assert.equal(summarize(rows,'interceptions').total,2);assert.equal(summarize(rows,'wins').total,4);assert.equal(summarize(rows,'tackleMade').total,3);
 assert.equal('defenseTotal' in metrics,false);assert.equal('dribbleRate' in metrics,false);
});

test('analytics population deviation requires two valid observations',()=>{
 const rows=playerRows([analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({rating:'6'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({rating:'8'})})]);
 assert.equal(summarize(rows,'rating').value,7);assert.equal(summarize(rows,'ratingDeviation').value,1);assert.equal(summarize(rows.slice(0,1),'ratingDeviation').value,null);
});

test('analytics rolling rate pools raw attempts and counts retain observed zero',()=>{
 const matches=[analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({passesmade:'1',passattempts:'1',goals:'0'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({passesmade:'9',passattempts:'99',goals:'2'})})];
 const report=buildAnalyticsReport(matches,defaultFilters,exportTime);
 assert.deepEqual(rollingTrend(report.trend,'passRate'),[100,10]);assert.deepEqual(rollingTrend(report.trend,'goals'),[0,1]);
});

test('analytics pair sample is shared appearances and low samples are not ranked',()=>{
 const matches=[analysisMatch('1','2026-10-07T12:00Z',{a:analysisPlayer(),b:analysisPlayer()}),analysisMatch('2','2026-10-08T12:00Z',{a:analysisPlayer()})];
 const pairs=pairSummaries(matches,{...defaultFilters,minMatches:3});assert.equal(pairs.length,1);assert.equal(pairs[0].matches,1);assert.equal(pairs[0].sufficient,false);assert.deepEqual(pairs[0].matchIds,['1']);
});

test('analytics role percentile needs sufficient peers and refuses changed roles',()=>{
 const matches=Array.from({length:3},(_,i)=>analysisMatch(String(i+1),`2026-10-0${i+1}T12:00Z`,Object.fromEntries(Array.from({length:5},(_,j)=>['p'+j,analysisPlayer({goals:String(j)})]))));
 const players=playerSummaries(matches,defaultFilters);assert.equal(rolePercentile(players,players[0],'goals').value,0);assert.equal(rolePercentile(players,players[4],'goals').value,100);assert.equal(rolePercentile(players.slice(0,4),players[0],'goals'),null);
 const changed={...players[0],roles:['defender','midfielder']};assert.equal(rolePercentile(players,changed,'goals'),null);
});

test('analytics URL filters round-trip selected IDs and preserve unrelated parameters',()=>{
 const filters={...defaultFilters,scope:'custom',from:'2026-10-01',to:'2026-10-07',playerIds:['a','b'],role:'defender',view:'players',minMatches:3,gapMinutes:90};
 const query=filtersToSearch(filters,'keep=present');assert.equal(new URLSearchParams(query).get('keep'),'present');assert.deepEqual(filtersFromSearch(query),filters);
 const bad=filtersFromSearch('leo_scope=unsupported&leo_gap=-5&leo_from=2026-02-30&leo_minMatches=NaN');assert.equal(bad.scope,'all');assert.equal(bad.gapMinutes,15);assert.equal(bad.from,'');assert.equal(bad.minMatches,1);
});

test('analytics filtered CSV and JSON use the same measured sample without mutating raw records',()=>{
 const matches=[analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({goals:'2',passesmade:'8',passattempts:'10'})}),analysisMatch('2','2026-10-08T12:00Z',{p:analysisPlayer({goals:'0'})})],before=structuredClone(matches);
 const report=buildAnalyticsReport(matches,{...defaultFilters,scope:'match',key:'1'},exportTime),csv=analyticsCSV(report);
 assert.equal(report.matchCount,1);assert.deepEqual(report.matchIds,['1']);assert.equal(report.players[0].metrics.passRate.value,80);
 assert.ok(csv.includes('"passRate","80","%","8","8","10","1","1","1"'));assert.deepEqual(JSON.parse(JSON.stringify(report)).matchIds,report.matchIds);assert.deepEqual(matches,before);
 const hostile=buildAnalyticsReport([analysisMatch('3','2026-10-08T12:00Z',{p:analysisPlayer({playername:'=FORMULA',goals:'0'})})],defaultFilters,exportTime);assert.ok(analyticsCSV(hostile).includes("'=FORMULA"));
});

test('analytics tactical notes validate local persisted structure and filter without changing EA data',()=>{
 assert.deepEqual(parseJournal('broken'),{});assert.deepEqual(parseJournal('[]'),{});
 const journal=parseJournal(JSON.stringify({'match:1':{formation:'4-3-3',tactic:'Kısa çıkış',role:4,note:'x'.repeat(1200)},bad:null}));
 assert.equal(journal['match:1'].role,'');assert.equal(journal['match:1'].note.length,1000);
 const matches=[analysisMatch('1','2026-10-07T12:00Z'),analysisMatch('2','2026-10-08T12:00Z')];assert.deepEqual(filterMatches(matches,{...defaultFilters,tag:'kısa'},journal).map(m=>m.matchId),['1']);
});

test('analytics missing history does not create development arrows or evidence',()=>{
 const matches=[analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({goals:'0'})})];
 const report=buildAnalyticsReport(matches,defaultFilters,exportTime);assert.deepEqual(report.previousPlayers,[]);assert.deepEqual(evidenceFor(matches,[]),[]);
 for(const id of metricIds){assert.ok(metrics[id].source.length);assert.ok(metrics[id].formula);assert.ok(metrics[id].limitation);}
});


test('analytics role filters retain role-change history and count percentiles use appearance rates',()=>{
 const matches=Array.from({length:4},(_,i)=>analysisMatch(String(i+1),`2026-10-0${i+1}T12:00Z`,Object.fromEntries(Array.from({length:5},(_,j)=>['p'+j,analysisPlayer({goals:String(j),pos:i===3&&j===0?'defender':'midfielder'})]))));
 const filtered=playerSummaries(matches,{...defaultFilters,role:'midfielder'});assert.deepEqual(new Set(filtered.find(p=>p.id==='p0').roles),new Set(['defender','midfielder']));assert.equal(rolePercentile(filtered,filtered.find(p=>p.id==='p0'),'goals'),null);
 const uniform=playerSummaries(matches.slice(0,3),defaultFilters),less={...uniform[2],metrics:{...uniform[2].metrics,goals:{...uniform[2].metrics.goals,value:100,perMatch:1}}};
 assert.equal(rolePercentile([...uniform.filter(p=>p.id!==less.id),less],less,'goals').value,37.5);
});

test('analytics single-match evidence uses only preceding valid matches with at least three samples',()=>{
 const matches=Array.from({length:5},(_,i)=>analysisMatch(String(i+1),`2026-10-0${i+1}T12:00Z`,{p:analysisPlayer({passesmade:String(i+1),passattempts:'10'})}));
 assert.equal(matchEvidence(matches[3],matches).length,1);assert.equal(matchEvidence(matches[2],matches).length,0);assert.ok(matchEvidence(matches[3],matches)[0].evidence.includes('20.00'));assert.deepEqual(matchEvidence(matches[3],matches)[0].matchIds,['4','3','2','1']);
});

test('analytics export filenames and dictionary include date, team and score provenance',()=>{
 assert.equal(analyticsFilename({...defaultFilters,scope:'week',key:'2026-W41'},'json','2026-10-07'),'leo-xi-team-week-2026-W41-2026-10-07.json');
 const report=buildAnalyticsReport([],defaultFilters,exportTime);assert.ok(report.dictionary.find(m=>m.id==='pointsPerMatch').formula.includes('geçerli'));assert.deepEqual(report.matchIds,[]);assert.equal(report.team.pointsPerMatch,null);
});


test('analytics previous session cannot include an earlier excluded match in the current night',()=>{
 const matches=[analysisMatch('1','2026-10-06T19:00Z',{p:analysisPlayer()}),analysisMatch('2','2026-10-07T19:00Z',{q:analysisPlayer()}),analysisMatch('3','2026-10-07T20:00Z',{p:analysisPlayer()})];
 const filters={...defaultFilters,scope:'session',key:'2',playerIds:['p']},selected=filterMatches(matches,filters);
 assert.deepEqual(selected.map(m=>m.matchId),['3']);assert.deepEqual(previousMatches(matches,selected,filters).map(m=>m.matchId),['1']);
});

test('analytics previous session preserves the full archive grouping through filtered gaps',()=>{
 const matches=[analysisMatch('1','2026-10-06T18:00Z',{p:analysisPlayer()}),analysisMatch('2','2026-10-06T20:00Z',{q:analysisPlayer()}),analysisMatch('3','2026-10-06T22:00Z',{p:analysisPlayer()}),analysisMatch('4','2026-10-07T22:00Z',{p:analysisPlayer()})];
 const filters={...defaultFilters,scope:'session',key:'4',playerIds:['p']};assert.deepEqual(previousMatches(matches,filterMatches(matches,filters),filters).map(m=>m.matchId),['3','1']);
});

test('analytics role eligibility preserves changes in entirely excluded matches',()=>{
 const matches=Array.from({length:4},(_,i)=>analysisMatch(String(i+1),`2026-10-0${i+1}T12:00Z`,Object.fromEntries(Array.from({length:5},(_,j)=>['p'+j,analysisPlayer({pos:i===3?'defender':'midfielder',goals:String(j)})]))));
 const report=buildAnalyticsReport(matches,{...defaultFilters,role:'midfielder'},exportTime);
 assert.equal(report.matchCount,3);assert.deepEqual(new Set(report.players[0].roles),new Set(['midfielder','defender']));assert.equal(rolePercentile(report.players,report.players[0],'goals'),null);
 assert.equal(report.players[1].metrics.goals.covered,3);assert.equal(report.players[1].metrics.goals.value,3);
});

test('analytics match and session detail views resolve the same scope for rendering and exports',()=>{
 const matches=[analysisMatch('1','2026-10-06T19:00Z'),analysisMatch('2','2026-10-07T19:00Z'),analysisMatch('3','2026-10-07T20:00Z')];
 const report=buildAnalyticsReport(matches,{...defaultFilters,view:'match'},exportTime);
 assert.equal(report.matchCount,1);assert.equal(report.filters.scope,'match');assert.deepEqual(report.matchIds,['3']);
 const night=buildAnalyticsReport(matches,{...defaultFilters,view:'session'},exportTime);assert.equal(night.filters.scope,'session');assert.deepEqual(night.matchIds,['3','2']);
 assert.equal(resolveAnalyticsFilters(matches,{...defaultFilters,view:'match',scope:'week',key:'2026-W41'}).key,'3');
 assert.equal(buildAnalyticsReport([],{...defaultFilters,view:'match'},exportTime).matchCount,0);
});

test('analytics single-match maps use real counts and apply the attempt threshold without inventing missing axes',()=>{
 const match=analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({passesmade:'8',passattempts:'10',goals:'2',assists:'0'})});
 const p=playerSummaries([match],defaultFilters)[0];assert.equal(playerCoordinates(p,'passAttempts','passRate').x,10);assert.equal(playerCoordinates(p,'passAttempts','passRate').y,80);
 assert.equal(playerCoordinates(p,'goals','assists').x,2);assert.equal(playerCoordinates(p,'goals','assists').y,0);assert.equal(playerCoordinates(p,'passAttempts','passRate',11),null);assert.equal(playerCoordinates(p,'rating','ratingDeviation'),null);
});

test('analytics match evidence respects player and role filters for current and reference records',()=>{
 const matches=Array.from({length:4},(_,i)=>analysisMatch(String(i+1),`2026-10-0${i+1}T12:00Z`,{p:analysisPlayer({passesmade:String(i+1),passattempts:'10',pos:'midfielder'}),q:analysisPlayer({passesmade:'100',passattempts:'100',pos:'forward'})}));
 const evidence=matchEvidence(matches[3],matches,'79638',{playerIds:['p'],role:'midfielder'});assert.equal(evidence.length,1);assert.ok(evidence[0].evidence.includes('40.00'));assert.ok(evidence[0].evidence.includes('20.00'));assert.ok(evidence[0].sample.includes('1/1'));
});

test('analytics opponent match data shares canonical CSV/JSON math and never turns absent records into zero',()=>{
 const match=analysisMatch('1','2026-10-07T12:00Z',{p:analysisPlayer({goals:'2'})});match.players['other']={q:analysisPlayer({passesmade:'8',passattempts:'10',pos:'forward'})};
 const opponentId=Object.keys(match.clubs).find(id=>id!=='79638');match.players[opponentId]=match.players.other;delete match.players.other;
 const report=buildAnalyticsReport([match],{...defaultFilters,scope:'match',key:'1',playerIds:['p']},exportTime);
 assert.equal(report.opponents.length,1);assert.equal(report.opponents[0].playerMetrics.passRate.value,80);assert.equal(report.opponents[0].playerMetrics.goals.value,null);assert.ok(analyticsCSV(report).includes('"rakip-insan-kayıtları",""'));assert.ok(analyticsCSV(report).split('\r\n')[0].endsWith('"kulüpId"'));assert.equal(report.players.length,1);
 const filtered=buildAnalyticsReport([match],{...defaultFilters,scope:'match',key:'1',role:'midfielder'},exportTime);assert.equal(filtered.opponents[0].playerMetrics.passRate.value,null);
});


test('readable match URLs migrate legacy filters without losing the selected match',()=>{
 const legacy='leo_tab=Analiz&leo_scope=match&leo_view=match&leo_role=all&leo_result=all&leo_opponent=all&leo_type=all&leo_minMatches=1&leo_minAttempts=0&leo_gap=120&leo_mode=perMatch&leo_compare=previous&leo_key=74140658290365';
 const target=locationFromSearch(routeSearch('/',legacy));assert.equal(target,'/analiz/mac/74140658290365');
 assert.deepEqual(filtersFromSearch(routeSearch(target)),filtersFromSearch(legacy));
});
test('readable URLs retain changed filters, repeated unrelated parameters and encoded session IDs',()=>{
 const filters={...defaultFilters,view:'session',scope:'session',key:'2026-10-07:late',playerIds:['1','2'],role:'defender',mode:'total',gapMinutes:90};
 const search=filtersToSearch(filters,'keep=one&keep=two');const url=locationFromSearch(search);const parsed=new URL(url,'https://club.test');
 assert.equal(parsed.pathname,'/analiz/seans/2026-10-07%3Alate');assert.equal(parsed.searchParams.has('leo_scope'),false);
 const decoded=routeSearch(parsed.pathname,parsed.search);assert.deepEqual(filtersFromSearch(decoded),filters);assert.deepEqual(new URLSearchParams(decoded).getAll('keep'),['one','two']);
 assert.equal(locationFromSearch(decoded),url);
});
test('normal section paths do not retain analytics filters and the homepage resolves on back navigation',()=>{
 for(const [tab,path]of [['Genel bakış','/'],['Maçlar','/maclar'],['Kadro','/kadro'],['Karşılaştır','/karsilastir'],['Maç gecesi','/mac-gecesi']]){
  assert.equal(locationFromSearch('leo_tab='+encodeURIComponent(tab)+'&leo_scope=month&leo_key=2026-10&leo_view=players'),path);
  assert.equal(new URLSearchParams(routeSearch(path)).get('leo_tab'),tab);
 }
});
test('analytics defaults are omitted and every view survives direct URL parsing',()=>{
 assert.equal(locationFromSearch(filtersToSearch(defaultFilters)),'/analiz');
 for(const [view,path]of [['team','/analiz'],['players','/analiz/oyuncular'],['match','/analiz/mac'],['session','/analiz/seans'],['compare','/analiz/karsilastir'],['matrix','/analiz/matris'],['pairs','/analiz/ikili'],['development','/analiz/gelisim']]){
  const query=routeSearch(path);assert.equal(filtersFromSearch(query).view,view);assert.equal(locationFromSearch(query),path);
 }
 const query=routeSearch('/analiz/oyuncular','scope=month&key=2026-10&role=defender');assert.equal(filtersFromSearch(query).scope,'month');assert.equal(filtersFromSearch(query).key,'2026-10');
});
test('unknown routes and malformed match identifiers are rejected',()=>{
 for(const path of ['/unknown','/kadro/extra','/analiz/unknown','/analiz/mac/invalid','/analiz/mac/12/extra','/analiz/seans/a%2Fb','/analiz/%zz'])assert.equal(routeSearch(path),null,path);
});


test('weekly cards count only last seven days, deduplicate matches and include absent roster members',()=>{
 const now=Date.parse('2026-10-08T12:00:00Z');const members=[{name:'a',proName:'A'},{name:'b',proName:'B'},{name:'c',proName:'C'}];
 const make=(id,when,players)=>({...structuredClone(snapshot.matches[0]),matchId:id,timestamp:when/1000,players:{'79638':players}});
 const row=(playername,shots,goals,assists,passattempts,passesmade)=>({playername,shots,goals,assists,passattempts,passesmade});
 const recent=make('123',now-1000,{one:row('a','10','2','3','20','12'),two:row('b','7','1','1','10','8')});
 const old=make('124',now-8*86400000,{two:row('b',100,0,100,100,0)});const future=make('125',now+1000,{two:row('b',100,0,100,100,0)});
 const result=weeklyCards([recent,recent,old,future],members,now);
 assert.equal(result.washing.value,8);assert.deepEqual(result.washing.players,[members[0]]);assert.equal(result.potato.value,8);assert.equal(result.carrying.value,5);assert.equal(result.absent.value,0);assert.deepEqual(result.absent.players,[members[2]]);
});
test('weekly cards share titles on ties and never fabricate awards for empty weeks',()=>{
 const now=snapshot.matches[0].timestamp*1000+1000;const members=[{name:'a',proName:'A'},{name:'b',proName:'B'}];
 const match={...snapshot.matches[0],players:{'79638':{a:{playername:'a',shots:5,goals:1,assists:2,passattempts:10,passesmade:5},b:{playername:'b',shots:5,goals:1,assists:2,passattempts:10,passesmade:5}}}};
 const result=weeklyCards([match],members,now);for(const key of ['washing','potato','absent','carrying'])assert.deepEqual(result[key].players,members);
 assert.deepEqual(weeklyCards([match],members,now+8*86400000),{washing:null,potato:null,absent:null,carrying:null,fouls:null,assassin:null});
 assert.equal(weeklyCards([{...match,players:{}}],members,now).absent,null);
});
test('weekly card metrics independently reject missing and contradictory counters',()=>{
 const now=snapshot.matches[0].timestamp*1000+1000;const members=[{name:'a',proName:'A'},{name:'b',proName:'B'}];
 const match={...snapshot.matches[0],players:{'79638':{a:{playername:'a',shots:'',goals:1,assists:2,passattempts:1,passesmade:9},b:{playername:'b',shots:4,goals:1,assists:null,passattempts:10,passesmade:7}}}};
 const result=weeklyCards([match],members,now);assert.deepEqual(result.washing.players,[members[1]]);assert.deepEqual(result.potato.players,[members[1]]);assert.deepEqual(result.carrying.players,[members[0]]);
 const second={...match,matchId:'123456',players:{'79638':{b:{playername:'b',goals:0,assists:0}}}};
 const incomplete=weeklyCards([match,second],members,now);assert.equal(incomplete.washing,null);assert.equal(incomplete.potato,null);
});
test('weekly cards follow stable player IDs across username changes',()=>{
 const now=snapshot.matches[0].timestamp*1000+1000;const members=[{name:'current',proName:'Current'}];const row=name=>({playername:name,shots:3,goals:1,assists:1,passattempts:10,passesmade:8});
 const latest={...snapshot.matches[0],players:{'79638':{stable:row('current')}}};const older={...latest,matchId:'1234567',timestamp:latest.timestamp-3600,players:{'79638':{stable:row('old-name')}}};
 const result=weeklyCards([older,latest],members,now);assert.equal(result.absent.value,2);assert.equal(result.washing.value,4);assert.equal(result.carrying.value,4);
});


test('weekly discipline cards pool fouls and cards, preserve zero-card winners and share exact ratio ties',()=>{
 const now=snapshot.matches[0].timestamp*1000+1000;
 const members=['a','b','c','d'].map(name=>({name,proName:name}));
 const row=(name,fouls,yellow,red=0)=>({playername:name,redcards:red,match_event_aggregate_0:`2:${fouls},95:${yellow}`});
 const make=(id,players)=>({...snapshot.matches[0],matchId:id,players:{'79638':players}});
 const matches=[make('1',{a:row('a',2,1),b:row('b',4,1),c:row('c',0,0),d:row('d',2,0)}),make('2',{a:row('a',8,1),b:row('b',6,1),d:row('d',1,0)})];
 const result=weeklyCards(matches,members,now);
 assert.equal(result.fouls.value,10);assert.deepEqual(result.fouls.players,members.slice(0,2));
 assert.equal(result.assassin.value,0);assert.deepEqual(result.assassin.players,[members[3]]);
 const tied=weeklyCards(matches,members.slice(0,3),now);assert.equal(tied.assassin.value,.2);assert.deepEqual(tied.assassin.players,members.slice(0,2));
});
test('weekly discipline ignores incomplete or contradictory events and requires a positive foul denominator',()=>{
 const now=snapshot.matches[0].timestamp*1000+1000, members=[{name:'a',proName:'A'}];
 const make=(id,row)=>({...snapshot.matches[0],matchId:id,players:{'79638':{a:{playername:'a',...row}}}});
 assert.equal(weeklyCards([make('1',{redcards:0,match_event_aggregate_0:'95:1'})],members,now).assassin,null);
 const valid=make('1',{redcards:1,match_event_aggregate_0:'2:2,3:2,95:1,213:1'});
 assert.equal(weeklyCards([valid],members,now).assassin.value,.75);
 for(const broken of [{}, {match_event_aggregate_0:'2:bad'}, {goals:1,match_event_aggregate_0:'2:1'}]){
  const result=weeklyCards([valid,make('2',broken)],members,now);assert.equal(result.fouls,null);assert.equal(result.assassin,null);
 }
 const missingRed=weeklyCards([make('1',{match_event_aggregate_0:'2:3'})],members,now);assert.equal(missingRed.fouls.value,3);assert.equal(missingRed.assassin,null);
});
