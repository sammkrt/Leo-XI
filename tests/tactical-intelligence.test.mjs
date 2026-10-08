import test from 'node:test';
import assert from 'node:assert/strict';
import {
 side, tacticalRows, aggregate, playerProfiles, dependency, pressMap, scoreReview,
 sessions, evaluateTrial, differenceInterval, rematchRecipe, validTrialPlan, reference,
} from '../lib/tactical-intelligence.ts';
import snapshot from '../data/snapshot.json' with {type:'json'};
const time=reference.trainedThrough+10000;
function player(extra={},fields={}){
 const events={215:30,216:10,30:10,31:5,32:10,33:2,34:10,35:3,13:2,14:1,18:1,19:0,217:3,218:1,105:1,106:2,107:1,108:1,109:1,110:2,143:5,175:3,182:1,99:1,100:0,101:0,102:1,103:0,219:2,111:8,...extra};
 return {playername:'Player',pos:'midfielder',match_event_aggregate_0:Object.entries(events).map(([k,v])=>k+':'+v).join(','),...fields};
}
function match(id,at,ours=player(),other=player()){
 return {matchId:String(id),timestamp:at,clubs:{79638:{goals:'2'},99:{goals:'1',details:{name:'Opponent'}}},players:{79638:{a:ours},99:{b:other}}};
}
const row=(id,at,events={})=>tacticalRows([match(id,at,player(events))])[0];
test('reference artifact records independent chronological holdout and excluded target club',()=>{
 assert.equal(reference.excludedClub,'79638');assert.ok(reference.trainingRows>0);assert.ok(reference.holdout.rows>0);
 assert.equal(reference.trainingRows+reference.holdout.rows,reference.validRows);
 for(const role of Object.values(reference.roles))assert.ok(role.rates.every(p=>p>=0&&p<=1));
});
test('events missing are unavailable; real zero feedback remains zero; pooling uses attempts',()=>{
 assert.equal(side({a:{playername:'Unknown',pos:'midfielder'}},time).signals.noOption.records,0);
 const a=row(1,time,{175:0}),b=row(2,time+1,{175:8,215:70});
 assert.equal(aggregate([a,b],'noOption').value,100*8/120);
 assert.equal(aggregate([a],'noOption').value,0);
 assert.equal(aggregate([{...a,own:{...a.own,total:2}}],'noOption').value,null);
});
test('reference cannot leak from the future and unknown roles never get invented peers',()=>{
 assert.equal(side({a:player()},reference.trainedThrough).signals.adjusted.records,0);
 assert.equal(side({a:player({}, {pos:'unknown'})},time).signals.adjusted.records,0);
 assert.equal(side({a:player()},time).signals.adjusted.records,1);
});
test('pass residual matches directional expectation and shrinks small samples toward zero',()=>{
 const a=row(1,time);const rates=reference.roles.midfielder.rates;
 const expected=15*rates[0]+12*rates[1]+13*rates[2];
 const profiles=playerProfiles([a]);
 assert.ok(Math.abs(profiles[0].signals.adjusted.value-100*(30-expected)/40)<1e-10);
 assert.ok(Math.abs(profiles[0].signals.adjusted.adjusted-100*(30-expected)/90)<1e-10);
});
test('impossible directions and incomplete direction coverage do not enter the model',()=>{
 assert.equal(side({a:player({30:100})},time).signals.adjusted.records,0);
 assert.equal(side({a:player({215:200})},time).signals.adjusted.records,0);
});
test('two-sided shot balance requires all player records and reconciled shot categories',()=>{
 const good=row(1,time);
 assert.equal(good.own.shots,4);
 const missing=tacticalRows([match(2,time,player(),{playername:'Missing',pos:'forward'})])[0];
 assert.equal(missing.other.shots,null);
 const invalid=side({a:player({13:20})},time);
 assert.equal(invalid.shots,null);
});
test('concentration is one for one contributor and two for equal contributors; empty is null',()=>{
 const a=row(1,time);assert.equal(dependency([a])[0].effective,1);
 const m=match(2,time);m.players['79638'].b=player({}, {playername:'Second'});
 const d=dependency(tacticalRows([m]))[0];assert.equal(d.effective,2);assert.equal(d.total,20);
 assert.equal(dependency([])[0].effective,null);
 assert.equal(dependency([{...a,own:{...a.own,total:2}}])[0].included,0);
});
test('press map preserves exact fractions, does not label small samples or median ties',()=>{
 const rows=[row(1,time),row(2,time+1)];
 assert.equal(pressMap(rows).rows[0].label,'Örneklem birikiyor');
 const many=Array.from({length:5},(_,i)=>row(i+1,time+i));
 assert.equal(pressMap(many).rows[0].label,'Medyan sınırında');
 assert.equal(pressMap(many).rows[0].x,25);
});
test('score baseline excludes the match itself and future games',()=>{
 const all=Array.from({length:8},(_,i)=>row(i+1,time+i));
 const report=scoreReview(all[5],all);
 assert.deepEqual(report.ids,['5','4','3','2','1']);assert.equal(report.metrics[0].n,5);
 assert.equal(scoreReview(all[1],all).metrics[0].normal,null);
});
test('sessions use elapsed gap, compare disjoint early/late pairs and expose roster changes',()=>{
 const rows=Array.from({length:4},(_,i)=>row(i+1,time+i*1200));
 const result=sessions(rows);
 assert.equal(result.paired.length,1);assert.equal(result.paired[0].changes[0].delta,0);
 assert.equal(result.paired[0].ownOverlap,1);
 assert.equal(sessions([...rows,row(6,time+20000)]).groups.length,2);
});
const plan={version:2,implementation:'firstTime',primary:'forward',guardrail:'loss',direction:1,threshold:3};
function experiment(){return {id:'trial',title:'Team trial',metric:'firstTime',start:time+100,target:6,baselineIds:['1','2','3','4','5','6'],createdAt:time*1000,plan};}
function trialRows(){return [...Array.from({length:6},(_,i)=>row(i+1,time+i)),...Array.from({length:6},(_,i)=>row(i+7,time+100+i,{143:12,30:15,31:0,215:35,216:5}))];}
test('trial detects applied positive signal from paired raw fractions',()=>{
 const result=evaluateTrial(experiment(),trialRows());
 assert.equal(result.status,'Olumlu sinyal');assert.equal(result.baseline.length,6);assert.equal(result.after.length,6);
 assert.equal(result.matchedBaseline.length,6);assert.equal(result.matchedAfter.length,6);
});
test('trial window stays first N recorded games and cannot replace missing outcomes',()=>{
 const rows=trialRows();rows[6]={...rows[6],own:side({},time)};
 rows.push(row(20,time+999,{143:12,30:15,31:0,215:35,216:5}));
 const result=evaluateTrial(experiment(),rows);
 assert.equal(result.window.length,6);assert.equal(result.after.length,5);
 assert.ok(!result.window.some(r=>r.id==='20'));
});
test('trial prioritizes guardrail harm; no application or small samples cannot win',()=>{
 const rows=trialRows().map(r=>r.time>=time+100?row(r.id,r.time,{143:12,30:15,31:0,215:35,216:5,105:20}):r);
 assert.equal(evaluateTrial(experiment(),rows).status,'Olumsuz sinyal');
 const unapplied=trialRows().map(r=>row(r.id,r.time));assert.equal(evaluateTrial(experiment(),unapplied).status,'Uygulanmadı');
 assert.equal(evaluateTrial(experiment(),trialRows().slice(0,8)).status,'Veri yetersiz');
 assert.equal(validTrialPlan({...plan,primary:'loss'}),false);
 assert.equal(validTrialPlan({...plan,implementation:'__proto__'}),false);
 assert.equal(evaluateTrial({...experiment(),plan:undefined},trialRows()),null);
});
test('bootstrap is deterministic and cannot produce interval below minimum sample',()=>{
 const rows=trialRows(),a=rows.slice(0,6),b=rows.slice(6);
 assert.deepEqual(differenceInterval(a,b,'forward'),differenceInterval(a,b,'forward'));
 assert.equal(differenceInterval(a.slice(0,4),b,'forward'),null);
});
test('rematch keeps other-opponent baseline separate and reveals changed opposition roster',()=>{
 const rows=[row(2,time+2),row(1,time+1)];rows[0].other.roster=['new'];
 const recipe=rematchRecipe(rows,rows);
 assert.equal(recipe.changed,true);assert.equal(recipe.normal.n,0);
 assert.match(recipe.message,/gerekiyor/);
});
test('real snapshot produces finite signals and no mutation',()=>{
 const before=JSON.stringify(snapshot.matches),rows=tacticalRows(snapshot.matches);
 for(const r of rows)for(const s of [r.own,r.other])for(const f of Object.values(s.signals)){
 assert.ok(Number.isFinite(f.num));assert.ok(Number.isFinite(f.den));assert.ok(f.den>=0);
 }
 assert.equal(JSON.stringify(snapshot.matches),before);assert.equal(rows.length,10);
});

test('named pass contradictions cannot enter tactical metrics',()=>{
 assert.equal(side({a:player({}, {passesmade:'999'})},time).players.length,0);
});

test('chart axes use the same valid appearances, including source IDs',()=>{
 const a=row(1,time), b=row(2,time+1,{30:100,175:999});
 const p=playerProfiles([b,a],['ambition','adjusted'])[0];
 assert.deepEqual(p.ids,['1']);assert.equal(p.n,1);
});
