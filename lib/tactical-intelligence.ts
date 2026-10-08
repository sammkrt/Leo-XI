import type { Match, MatchPlayer } from './club-types.ts';
import { decodedPlayer, playerEvents } from './club-events.mjs';
import { CLUB_ID } from './club-model.mjs';
import { labRows, type LabRow, type Experiment } from './team-lab.ts';
import reference from '../data/pass-reference.json' with {type:'json'};

export { reference };
export const signalDefinitions = {
  noOption: {label:'Seçenek yok bildirimi',unit:'/100 pas',better:-1},
  elsewhere: {label:'Başka pas seçmeliydi',unit:'/100 pas',better:-1},
  goodOption: {label:'İyi / en iyi seçenek bildirimi',unit:'/100 pas',better:1},
  forward: {label:'İleri pas başarısı',unit:'%',better:1},
  ambition: {label:'İleri pas girişim payı',unit:'%',better:1},
  adjusted: {label:'Yön beklentisinin üzerindeki pas',unit:'yp',better:1},
  loss: {label:'Savunma bölgesi kayıp payı',unit:'%',better:-1},
  regain: {label:'Hücum bölgesi kazanım payı',unit:'%',better:1},
  severity: {label:'Ağır pozisyon dışı bildirim payı',unit:'%',better:-1},
  inside: {label:'İçeriden şut payı',unit:'%',better:1},
  firstTime: {label:'Tek pas yoğunluğu',unit:'/100 pas',better:1},
} as const;
export type SignalKey = keyof typeof signalDefinitions;
export type Fraction = {num:number;den:number;records:number};
export type EvidencePlayer = {
 id:string;name:string;role:string;e:Map<number,number>;passes:number;directions:boolean;shotsValid:boolean;
 signals:Partial<Record<SignalKey,Fraction>>;
};
export type Side = {total:number;players:EvidencePlayer[];signals:Record<SignalKey,Fraction>;shots:number|null;insideShots:number|null;roster:string[]};
export type TacticalRow = LabRow & {own:Side;other:Side};
const empty = ():Fraction=>({num:0,den:0,records:0});
export const value = (f:Fraction|undefined) => f&&f.den>0?100*f.num/f.den:null;
export const median = (values:number[]) => {
 const sorted=[...values].sort((a,b)=>a-b), n=sorted.length;
 return n?(sorted[Math.floor(n/2)]+sorted[Math.floor((n-1)/2)])/2:null;
};
function evidence(id:string,p:MatchPlayer,time:number):EvidencePlayer|null {
 const e=playerEvents(p);if(!e||!decodedPlayer(p))return null;
 const g=(n:number)=>e.get(n)||0, passes=g(215)+g(216);
 const namedPassesAgree=[['passesmade',g(215)],['passattempts',passes]].every(([key,n])=>{
  const raw=p[key as string];return raw===undefined||raw===null||raw===''||Number(raw)===n;
 });
 if(!namedPassesAgree)return null;
 const directions=g(30)+g(32)+g(34)<=g(215)&&g(31)+g(33)+g(35)<=g(216);
 const shotsValid=g(13)+g(14)+g(18)+g(19)===g(217)+g(218)&&g(13)+g(18)===g(217);
 const signals:EvidencePlayer['signals']={};
 const add=(key:SignalKey,num:number,den:number)=>{signals[key]={num,den,records:1}};
 add('noOption',g(175),passes);add('elsewhere',g(182),passes);add('goodOption',g(176)+g(177),passes);
 add('loss',g(105),g(105)+g(106)+g(107));add('regain',g(110),g(108)+g(109)+g(110));
 if(g(99)+g(100)+g(101)+g(102)+g(103)===g(219))add('severity',g(102)+g(103),g(219)+g(111));
 if(g(143)<=passes)add('firstTime',g(143),passes);
 if(shotsValid)add('inside',g(13)+g(14),g(217)+g(218));
 if(directions){
  const known=g(30)+g(31)+g(32)+g(33)+g(34)+g(35);
  add('forward',g(30),g(30)+g(31));add('ambition',g(30)+g(31),passes);
  const role=reference.roles[p.pos as keyof typeof reference.roles];
  // No future reference data, unknown-role substitution, or fabricated unknown-direction expectations.
  if(role&&time>reference.trainedThrough&&known>0&&passes>0&&known/passes>=.8){
   const expected=[30,32,34].reduce((s,k,j)=>s+(g(k)+g(k+1))*role.rates[j],0);
   add('adjusted',g(30)+g(32)+g(34)-expected,known);
  }
 }
 return {id,name:p.playername||id,role:p.pos,e,passes,directions,shotsValid,signals};
}
export function side(players:Record<string,MatchPlayer|undefined>,time:number):Side {
 const entries=Object.entries(players).filter(([,p])=>p);
 const valid=entries.flatMap(([id,p])=>{const r=evidence(id,p!,time);return r?[r]:[]});
 const signals=Object.fromEntries(Object.keys(signalDefinitions).map(k=>[k,empty()])) as Side['signals'];
 for(const p of valid)for(const [k,f] of Object.entries(p.signals)){
  const target=signals[k as SignalKey];target.num+=f.num;target.den+=f.den;target.records++;
 }
 const allShots=entries.length>0&&valid.length===entries.length&&valid.every(p=>p.shotsValid);
 return {total:entries.length,players:valid,signals,roster:entries.map(([id])=>id),
  shots:allShots?valid.reduce((s,p)=>s+(p.e.get(217)||0)+(p.e.get(218)||0),0):null,
  insideShots:allShots?valid.reduce((s,p)=>s+(p.e.get(13)||0)+(p.e.get(14)||0),0):null};
}
export function tacticalRows(matches:Match[]):TacticalRow[]{
 const byId=new Map(matches.map(m=>[String(m.matchId),m]));
 return labRows(matches).map(r=>{const m=byId.get(r.id)!;return {...r,own:side(m.players?.[CLUB_ID]||{},r.time),other:side(m.players?.[r.opponentId]||{},r.time)}});
}
export const readable = (s:Side,key:SignalKey) => s.total>0&&s.signals[key].records/s.total>=.8&&value(s.signals[key])!==null;
export function aggregate(rows:TacticalRow[],key:SignalKey,which:'own'|'other'='own'){
 const included=rows.filter(r=>readable(r[which],key));
 const total=included.reduce((a,r)=>({num:a.num+r[which].signals[key].num,den:a.den+r[which].signals[key].den,records:a.records+r[which].signals[key].records}),empty());
 return {...total,value:value(total),n:included.length,ids:included.map(r=>r.id),excluded:rows.length-included.length};
}
export function playerProfiles(rows:TacticalRow[],required:SignalKey[]=[]){
 const grouped=new Map<string,{id:string;name:string;roles:Set<string>;rows:EvidencePlayer[];ids:string[]}>();
 for(const r of rows)for(const p of r.own.players){
  if(!required.every(k=>value(p.signals[k])!==null))continue;
  const group=grouped.get(p.id)||{id:p.id,name:p.name,roles:new Set<string>(),rows:[],ids:[]};
  group.roles.add(p.role);group.rows.push(p);group.ids.push(r.id);grouped.set(p.id,group);
 }
 return [...grouped.values()].map(g=>{
  const signals=Object.fromEntries(Object.keys(signalDefinitions).map(key=>{
   const records=g.rows.flatMap(r=>r.signals[key as SignalKey]?[r.signals[key as SignalKey]!]:[]);
   const f=records.reduce((s,r)=>({num:s.num+r.num,den:s.den+r.den,records:s.records+1}),empty());
   return [key,{...f,value:value(f),adjusted: key==='adjusted'&&f.den>0?100*f.num/(f.den+50):value(f)}];
  })) as Record<SignalKey,Fraction&{value:number|null;adjusted:number|null}>;
  return {...g,roles:[...g.roles],n:g.rows.length,passes:g.rows.reduce((s,r)=>s+r.passes,0),signals};
 });
}
export function bottleneck(rows:TacticalRow[]){
 const no=aggregate(rows,'noOption'),forward=aggregate(rows,'forward'),bad=aggregate(rows,'elsewhere');
 // Within-team empirical comparison, at least five paired valid matches.
 const pairs=rows.filter(r=>readable(r.own,'noOption')&&readable(r.own,'forward'));
 const x=median(pairs.map(r=>value(r.own.signals.noOption)!)), y=median(pairs.map(r=>value(r.own.signals.forward)!));
 const candidates=pairs.filter(r=>value(r.own.signals.noOption)!>x!&&value(r.own.signals.forward)!<y!);
 return {no,forward,bad,x,y,ids:candidates.map(r=>r.id),message:pairs.length<5?'Teşhis için en az 5 ortak geçerli maç gerekiyor.':candidates.length>=2?
 'Seçenek yok bildiriminin yüksek, ileri pas başarısının düşük olduğu maçlar var. İkinci pas desteğini artırmayı takım deneyi olarak sınayın.':
 'Seçenek yokluğu ile düşük ileri pas başarısının birlikte tekrarlandığı yeterli kanıt yok.'};
}
export function pressMap(rows:TacticalRow[]){
 const valid=rows.filter(r=>readable(r.own,'loss')&&readable(r.own,'regain'));
 const x=median(valid.map(r=>value(r.own.signals.loss)!)), y=median(valid.map(r=>value(r.own.signals.regain)!));
 return {x,y,rows:valid.map(r=>{
  const loss=value(r.own.signals.loss)!,regain=value(r.own.signals.regain)!;
  const label=valid.length<5?'Örneklem birikiyor':loss===x||regain===y?'Medyan sınırında':regain>y!?(loss<x!?'Önde kazanım / geride düşük kayıp':'İki taraflı risk'):(loss<x!?'Düşük önde kazanım / düşük kayıp':'Geriden çıkış incelemesi');
  return {row:r,x:loss,y:regain,label};
 }),excluded:rows.length-valid.length};
}
export const rosterOverlap=(a:string[],b:string[])=>{const union=new Set([...a,...b]);return union.size?[...new Set(a)].filter(x=>b.includes(x)).length/union.size:null;};
export function scoreReview(row:TacticalRow,history:TacticalRow[]){
 const past=history.filter(r=>r.time<row.time).sort((a,b)=>b.time-a.time).slice(0,20);
 const shotBalance=(r:TacticalRow,inside=false)=>{const a=inside?r.own.insideShots:r.own.shots,b=inside?r.other.insideShots:r.other.shots;return a===null||b===null?null:a-b};
 const defs=[
  {key:'shots',label:'Kayıtlı şut farkı',read:(r:TacticalRow)=>shotBalance(r),better:1,unit:'şut'},
  {key:'inside',label:'İçeriden kayıtlı şut farkı',read:(r:TacticalRow)=>shotBalance(r,true),better:1,unit:'şut'},
  {key:'adjusted',label:'Yön beklentisine göre pas',read:(r:TacticalRow)=>readable(r.own,'adjusted')?value(r.own.signals.adjusted):null,better:1,unit:'yp'},
  {key:'loss',label:'Savunma bölgesi kayıp payı',read:(r:TacticalRow)=>readable(r.own,'loss')?value(r.own.signals.loss):null,better:-1,unit:'%'},
 ];
 const metrics=defs.map(d=>{const current=d.read(row),samples=past.flatMap(r=>{const v=d.read(r);return v===null?[]:[v]});const normal=samples.length>=5?median(samples):null;
  return {key:d.key,label:d.label,current,normal,n:samples.length,unit:d.unit,delta:current===null||normal===null?null:(current-normal)*d.better};});
 const worse=metrics.filter(m=>m.delta!==null&&m.delta<0).length,better=metrics.filter(m=>m.delta!==null&&m.delta>0).length;
 const message=metrics.filter(m=>m.delta!==null).length<3?'Oyun–sonuç ayrımı için en az üç göstergede 5 geçmiş maç gerekiyor.':
 row.points===3&&worse>=3?'Galibiyete rağmen en az üç oyun göstergesi kendi geçmiş medyanımızın gerisinde. Kaynak maçları inceleyin.':
 row.points===0&&better>=3?'Yenilgiye rağmen en az üç oyun göstergesi geçmiş medyanımızın üzerinde. Tek sonuçla taktiği değiştirmeyin.':
 'Skor ile oyun göstergeleri arasında belirgin bir ayrışma eşiği oluşmadı.';
 return {metrics,message,ids:past.map(r=>r.id)};
}
export const contributionFamilies = [
 {key:'forward',label:'Başarılı ileri pas',ids:[30]},
 {key:'through',label:'Başarılı ara pas',ids:[152]},
 {key:'secondAssist',label:'İkinci asist',ids:[115]},
 {key:'regains',label:'Bölgesel top kazanımı',ids:[108,109,110]},
] as const;
export function dependency(rows:TacticalRow[]){
 return contributionFamilies.map(f=>{
  const sums=new Map<string,{id:string;name:string;count:number}>();let included=0;
  for(const r of rows){
   if(!r.own.total||r.own.players.length!==r.own.total||r.own.players.some(p=>f.key==='forward'&&!p.directions||f.key==='through'&&(p.e.get(152)||0)>p.passes))continue;
   included++;
   for(const p of r.own.players){const old=sums.get(p.id)||{id:p.id,name:p.name,count:0};old.count+=f.ids.reduce((s,id)=>s+(p.e.get(id)||0),0);sums.set(p.id,old)}
  }
  const total=[...sums.values()].reduce((s,p)=>s+p.count,0);
  const contributors=[...sums.values()].filter(p=>p.count>0).map(p=>({...p,share:p.count/total})).sort((a,b)=>b.count-a.count);
  return {...f,total,included,excluded:rows.length-included,contributors,effective:total?1/contributors.reduce((s,p)=>s+p.share*p.share,0):null};
 });
}
export function sessions(rows:TacticalRow[],gapMinutes=90){
 const groups:TacticalRow[][]=[];
 for(const r of [...rows].sort((a,b)=>a.time-b.time)){const last=groups.at(-1);if(!last||r.time-last.at(-1)!.time>gapMinutes*60)groups.push([r]);else last.push(r)}
 const keys:SignalKey[]=['adjusted','loss','severity','inside'];
 const paired=groups.filter(g=>g.length>=4).map(g=>{
  const early=g.slice(0,2),late=g.slice(-2);
  const changes=keys.map(key=>{const before=aggregate(early,key),after=aggregate(late,key);return {key,before:before.value,after:after.value,delta:before.n===2&&after.n===2&&before.value!==null&&after.value!==null?after.value-before.value:null}});
  return {id:g[0].id,rows:g,changes,ownOverlap:rosterOverlap(early.flatMap(r=>r.own.roster),late.flatMap(r=>r.own.roster)),opponents:[...new Set(g.map(r=>r.opponent))]};
 });
 const summaries=keys.map(key=>{const v=paired.flatMap(g=>{const c=g.changes.find(c=>c.key===key)!;return c.delta===null?[]:[c.delta]});return {key,n:v.length,delta:median(v),worsened:v.filter(d=>d*signalDefinitions[key].better<0).length}});
 return {groups,paired,summaries};
}
export function rematchRecipe(rows:TacticalRow[],all:TacticalRow[]){
 const latest=rows[0],previous=rows[1];
 if(!latest)return null;
 const otherHistory=all.filter(r=>r.opponentId!==latest.opponentId&&r.time<latest.time);
 const own=aggregate(rows,'forward'),normal=aggregate(otherHistory,'forward');
 const difference=own.value===null||normal.value===null?null:own.value-normal.value;
 const ours=previous?rosterOverlap(latest.own.roster,previous.own.roster):null;
 const theirs=previous?rosterOverlap(latest.other.roster,previous.other.roster):null;
 const message=rows.length<2||normal.n<5||own.n<2?'Tekrarlayan reçete için en az 2 karşılaşma ve 5 başka rakip maçı gerekiyor.':
 difference!==null&&difference<=-5?'Bu rakibe karşı ileri pas başarısı diğer rakiplerdeki seviyenin en az 5 yüzde puan altında. Kısa destek seçeneğini artırmayı deneyin.':
 'İleri pas için belirgin bir rakibe özgü düşüş yok. Rakip profili ve notlar üzerinden bir takım deneyi seçin.';
 return {ours,theirs,own,normal,difference,message,changed:theirs!==null&&theirs<.5};
}
export type TrialPlan={version:2;implementation:SignalKey;primary:SignalKey;guardrail:SignalKey;direction:1|-1;threshold:number};
export type TacticalExperiment=Experiment&{plan?:TrialPlan};
export function validTrialPlan(p:unknown):p is TrialPlan{
 if(!p||typeof p!=='object')return false;const x=p as TrialPlan;
 return x.version===2&&Object.hasOwn(signalDefinitions,x.implementation)&&Object.hasOwn(signalDefinitions,x.primary)&&Object.hasOwn(signalDefinitions,x.guardrail)&&x.primary!==x.guardrail&&(x.direction===1||x.direction===-1)&&Number.isFinite(x.threshold)&&x.threshold>=1&&x.threshold<=20;
}
// Deterministic bootstrap of whole matches, preserving the numerator/denominator within each match.
export function differenceInterval(before:TacticalRow[],after:TacticalRow[],key:SignalKey){
 const a=before.filter(r=>readable(r.own,key)),b=after.filter(r=>readable(r.own,key));
 if(a.length<5||b.length<5)return null;
 let seed=9173;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const samples:number[]=[];
 for(let i=0;i<400;i++){const sample=(rows:TacticalRow[])=>Array.from({length:rows.length},()=>rows[Math.floor(random()*rows.length)]);
  const av=aggregate(sample(a),key).value,bv=aggregate(sample(b),key).value;if(av!==null&&bv!==null)samples.push(bv-av)}
 samples.sort((x,y)=>x-y);return [samples[Math.floor(samples.length*.05)],samples[Math.floor(samples.length*.95)]] as const;
}
export function evaluateTrial(ex:TacticalExperiment,rows:TacticalRow[]){
 if(!validTrialPlan(ex.plan))return null;const p=ex.plan;
 const ok=(r:TacticalRow)=>[p.implementation,p.primary,p.guardrail].every(k=>readable(r.own,k));
 const baseline=rows.filter(r=>ex.baselineIds.includes(r.id)&&r.time<ex.start&&ok(r));
 // First N recorded matches, not first N favourable/valid outcomes. Missingness cannot extend a trial.
 const window=rows.filter(r=>r.time>=ex.start).sort((a,b)=>a.time-b.time).slice(0,ex.target);
 const after=window.filter(ok);
 const compare=(key:SignalKey)=>{const before=aggregate(baseline,key),current=aggregate(after,key);return {key,before,current,delta:before.value===null||current.value===null?null:current.value-before.value,interval:differenceInterval(baseline,after,key)}};
 const implementation=compare(p.implementation),primary=compare(p.primary),guardrail=compare(p.guardrail);
 const completed=window.length===ex.target;
 const implemented=implementation.delta!==null&&implementation.delta*p.direction>=p.threshold;
 const guardBad=guardrail.delta!==null&&guardrail.delta*signalDefinitions[p.guardrail].better<=-p.threshold;
 const interval=primary.interval;const favourable=interval&&(signalDefinitions[p.primary].better===1?interval[0]>0:interval[1]<0);
 const adverse=interval&&(signalDefinitions[p.primary].better===1?interval[1]<0:interval[0]>0);
 const status=!completed||baseline.length<5||after.length<5?'Veri yetersiz':!implemented?'Uygulanmadı':guardBad||adverse?'Olumsuz sinyal':favourable?'Olumlu sinyal':'Belirsiz';
 const matchedBaseline=baseline.filter(b=>after.some(a=>a.opponentId===b.opponentId&&(rosterOverlap(a.own.roster,b.own.roster)??0)>=.5&&(rosterOverlap(a.other.roster,b.other.roster)??0)>=.5));
 const matchedAfter=after.filter(a=>matchedBaseline.some(b=>a.opponentId===b.opponentId&&(rosterOverlap(a.own.roster,b.own.roster)??0)>=.5&&(rosterOverlap(a.other.roster,b.other.roster)??0)>=.5));
 return {baseline,after,window,completed,implementation,primary,guardrail,status,matchedBaseline,matchedAfter,matchedInterval:differenceInterval(matchedBaseline,matchedAfter,p.primary)};
}
