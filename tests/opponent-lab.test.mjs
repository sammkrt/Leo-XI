import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupRows,matchupReport,scenarioEstimate,prequentialValidation,wilson} from '../lib/opponent-lab.ts';
import {validateResearch,ratingBefore} from '../lib/research-context.mjs';
const start=Date.parse('2026-09-01T12:00:00Z')/1000;
const players=(n)=>Object.fromEntries(Array.from({length:n},(_,i)=>[String(i),{playername:'p'+i,pos:i<2?'defender':'forward'}]));
const match=(i,own=6,other=4,gf=2,ga=1)=>({matchId:String(i+1),timestamp:start+i*86400,clubs:{'79638':{goals:gf,matchType:'1'},['o'+i%5]:{goals:ga,details:{name:'Other'}}},players:{'79638':players(own),['o'+i%5]:players(other)}});
const now=Date.parse('2027-01-01');
test('counts and role composition are per-match humans and missing side is not inferred from roster',()=>{
 const m=match(0);m.players['79638']['0'].pos='any';const rows=matchupRows([m,m],[],now);
 assert.equal(rows.length,1);assert.equal(rows[0].own.n,6);assert.equal(rows[0].other.n,4);assert.equal(rows[0].own.unknown,1);assert.equal(rows[0].own.roles[1],1);
 delete m.players.o0;assert.equal(matchupReport(matchupRows([m],[],now)).valid.length,0);
});
test('future and post-match SR never leak into historical comparisons; stale snapshots rejected',()=>{
 const m=match(10),iso=t=>new Date(t*1000).toISOString();
 const ratings=[{clubId:'79638',skillRating:1800,observedAt:iso(m.timestamp-60)},{clubId:'o0',skillRating:1600,observedAt:iso(m.timestamp-120)},{clubId:'o0',skillRating:2100,observedAt:iso(m.timestamp+1)}];
 assert.equal(matchupRows([m],ratings,now)[0].gap,200);
 assert.equal(ratingBefore(ratings,'o0',m.timestamp+8*86400),null);
 assert.equal(matchupRows([m],ratings,(m.timestamp-1)*1000).length,0);
});
test('matrix handles draws, DNF and sparse groups without certainty',()=>{
 const ms=[match(0,6,4,2,1),match(1,6,4,1,1),match(2,6,4,0,1),match(3)];ms[3].clubs['79638'].winnerByDnf='1';
 const report=matchupReport(matchupRows(ms,[],now));assert.equal(report.excluded,1);assert.deepEqual([report.overall.w,report.overall.d,report.overall.l],[1,1,1]);assert.equal(report.best,null);assert.equal(report.counts[0].smoothed,1/3);
 assert.ok(wilson(1,1)[0]<.3);assert.ok(wilson(0,1)[1]>.7);
});
test('scenario checks role totals, exact counts, SR missingness and chronological cutoffs',()=>{
 const rows=matchupRows(Array.from({length:30},(_,i)=>match(i)),[],now);
 assert.ok(scenarioEstimate(rows,{own:6,other:4,ownRoles:[0,2,2,1]}).error);
 assert.equal(scenarioEstimate(rows,{own:6,other:5}).stats.n,0);
 assert.equal(scenarioEstimate(rows,{own:6,other:4,gap:0}).stats.n,0);
 const e=scenarioEstimate(rows,{own:6,other:4},start+20*86400);assert.equal(e.stats.n,20);assert.equal(e.enough,true);assert.ok(e.stats.probabilities.every(p=>p>0&&p<1));assert.ok(Math.abs(e.stats.probabilities.reduce((a,b)=>a+b,0)-1)<1e-9);
});
test('validation is chronological, order-independent and small archives cannot unlock predictions',()=>{
 const rows=matchupRows(Array.from({length:25},(_,i)=>match(i)),[],now);
 assert.deepEqual(prequentialValidation(rows),prequentialValidation([...rows].reverse()));assert.equal(prequentialValidation(rows).qualified,false);
});
test('research boundary rejects future collection and keeps malformed SR unknown',()=>{
 assert.equal(validateResearch({version:1,observedAt:'bad',ratings:[],endpoints:[]}),undefined);
 const iso=new Date().toISOString(),ctx=validateResearch({version:1,observedAt:iso,endpoints:[],ratings:[{clubId:'79638',skillRating:'',observedAt:iso},{clubId:'79638',skillRating:0,observedAt:iso}]});assert.equal(ctx.ratings.length,1);
});
