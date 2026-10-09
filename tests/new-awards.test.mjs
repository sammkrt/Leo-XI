import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAwardReport,selectHomeAwards,awardRegistry} from '../lib/derived-awards.ts';
import {newAwardFeatures} from '../lib/new-award-formulas.ts';
import {awardCardContent} from '../lib/award-presentation.ts';
const now=Date.parse('2026-10-09T07:00:00Z');
const base={0:10,1:5,2:1,3:1,6:3,10:1,11:1,13:5,14:5,18:3,19:2,24:60,25:12,26:20,27:3,28:10,29:3,30:60,31:10,32:20,33:5,34:20,35:5,36:10,37:2,38:2,94:1,95:1,99:5,100:3,101:2,105:2,106:3,107:4,108:5,109:4,110:3,111:12,112:5,115:2,118:1,143:10,144:2,147:1,152:3,153:1,158:3,163:1,164:9,174:15,175:4,176:3,177:2,182:1,183:1,202:3,207:2,213:1,214:2,215:100,216:20,217:8,218:7,219:10,229:8,230:2,265:3,266:4,267:0};
const fixture=(change=()=>({}))=>Array.from({length:4},(_,i)=>({matchId:String(100+i),timestamp:now/1000-3600*(i+1),clubs:{'79638':{goals:12},other:{goals:1}},players:{'79638':Object.fromEntries(Array.from({length:6},(_,j)=>{
 const e={...base,...change(i,j)};return ['p'+j,{playername:'p'+j,pos:'defender',goals:e[214],assists:e[11],shots:e[217]+e[218],secondsPlayed:5400,saves:0,goalsconceded:1,cleansheetsgk:0,match_event_aggregate_0:Object.entries(e).map(([k,v])=>`${k}:${v}`).join(','),match_event_aggregate_1:'',match_event_aggregate_2:'',match_event_aggregate_3:''}];}))}}));
const result=(ms,id,options={})=>buildAwardReport(ms,[],{now,...options}).results.find(r=>r.definition.id==='new-'+id);
test('38 unique definitions coexist with existing titles; experimental and partial mappings stay gated',()=>{
 assert.equal(awardRegistry.filter(r=>r.id.startsWith('new-')).length,38);
 for(const id of ['A01','A06','A36','A37','A38'])assert.equal(result(fixture(),id).winners.length,0);
});
test('overlaid goal tags and aerial wins are not unique goals or invented success percentages',()=>{
 const v={M:4,E266:8,E265:4};const f=newAwardFeatures.A28(v);assert.deepEqual(f.map(x=>x.value),[2,1,3]);
 const r=result(fixture((i,j)=>({265:j+1,266:(j+1)*2})),'A28');assert.ok(r.winners.length);const report=buildAwardReport(fixture((i,j)=>({265:j+1,266:(j+1)*2})),[],{now});
 const content=awardCardContent(r,r.winners[0],report);assert.match(content.value,/hava topu/);assert.doesNotMatch(content.value,/%/);
});
test('NASA compares valid shot partitions, rejects missing buckets and contradictory counters',()=>{
 const ms=fixture((i,j)=>({18:7-j,19:j+1,217:12-j,218:6+j}));
 assert.ok(result(ms,'A03').candidates.length>=4);
 ms.forEach(m=>delete m.players['79638'].p5.match_event_aggregate_3);assert.ok(!result(ms,'A03').candidates.some(c=>c.playerId==='p5'));
 ms.forEach(m=>m.players['79638'].p4.shots=99);assert.ok(!result(ms,'A03').candidates.some(c=>c.playerId==='p4'));
});
test('GPS refuses incompatible position totals and reports no winner for identical values',()=>{
 assert.equal(result(fixture(),'A27').winners.length,0);
 assert.equal(result(fixture(()=>({219:999})),'A27').candidates.length,0);
});
test('Bencil Kral does not condemn an efficient finisher and requires complete teammate shots',()=>{
 const ms=fixture((i,j)=>j===0?{214:12}:{});assert.ok(!result(ms,'A07').candidates.some(c=>c.playerId==='p0'));
 ms.forEach(m=>delete m.players['79638'].p5.match_event_aggregate_3);assert.equal(result(ms,'A07').candidates.length,0);
});
test('goalkeeper cards exclude outfield roles and minutes card rejects implausible durations',()=>{
 assert.equal(result(fixture(),'A31').candidates.length,0);
 const ms=fixture();ms.forEach(m=>Object.values(m.players['79638']).forEach(p=>p.secondsPlayed=999999));assert.equal(result(ms,'A35').candidates.length,0);
});
test('season comparison subtracts current totals, rejects overlap errors and stale source',()=>{
 const members=Array.from({length:6},(_,j)=>({name:'p'+j,gamesPlayed:10,goals:10+j*2,assists:5,ratingAve:8,favoritePosition:'forward'}));
 const career=members.map(m=>({...m,gamesPlayed:30,goals:m.goals+5,assists:10,ratingAve:7}));
 const research={version:1,observedAt:new Date(now).toISOString(),endpoints:[],ratings:[],members,career};
 assert.equal(result(fixture(),'A33',{research}).candidates.length,6);
 const bad=structuredClone(research);bad.career[0].gamesPlayed=5;assert.equal(result(fixture(),'A33',{research:bad}).candidates.length,5);
 assert.equal(result(fixture(),'A33',{research:{...research,observedAt:'2020-01-01'}}).candidates.length,0);
});
test('every active new result has finite fixed-weight features and all winners reach homepage',()=>{
 const r=buildAwardReport(fixture((i,j)=>({265:j+1,266:j+2,38:j})),[],{now});
 for(const a of r.results.filter(r=>r.definition.id.startsWith('new-')))for(const c of a.candidates){assert.ok(c.components.every(x=>Number.isFinite(x.raw)&&Number.isFinite(x.adjusted)));assert.ok(Math.abs(c.components.reduce((s,x)=>s+x.weight,0)-1)<1e-9);assert.ok(Object.keys(c.totals).length<55);}
 assert.deepEqual(selectHomeAwards(r),r.results.filter(r=>r.winners.length));
});
