import type {Match,MatchPlayer} from './club-types';
import type {RatingSnapshot} from './research-types';
import {CLUB_ID,uniqueMatches,amsterdamDay} from './club-model.mjs';
import {finiteCount,ratingBefore} from './research-context.mjs';
export const roleOrder=['goalkeeper','defender','midfielder','forward'] as const;
export const roleNames={goalkeeper:'Kaleci',defender:'Savunma',midfielder:'Orta saha',forward:'Hücum',unknown:'Belirsiz'};
export type Roster={n:number;roles:number[];unknown:number;players:{id:string;name:string;role:string}[]};
export type Matchup={id:string;time:number;night:string;opponentId:string;opponent:string;gf:number;ga:number;result:0|1|2;own:Roster;other:Roster;ownSR:number|null;otherSR:number|null;gap:number|null;dnf:boolean;type:string};
export function roster(records:Record<string,MatchPlayer|undefined>|undefined):Roster{
 const players=Object.entries(records||{}).flatMap(([id,p])=>p?[{id,name:p.playername||id,role:roleOrder.includes(p.pos as typeof roleOrder[number])?p.pos:'unknown'}]:[]);
 return {n:players.length,roles:roleOrder.map(r=>players.filter(p=>p.role===r).length),unknown:players.filter(p=>p.role==='unknown').length,players};
}
export function matchupRows(matches:readonly Match[],ratings:RatingSnapshot[]=[],now=Date.now()):Matchup[]{
 return (uniqueMatches([...matches]) as Match[]).flatMap(m=>{
  const ours=m.clubs[CLUB_ID],opps=Object.entries(m.clubs).filter(([id,c])=>id!==CLUB_ID&&c);
  if(!ours||opps.length!==1||m.timestamp*1000>now)return [];
  const [opponentId,other]=opps[0],gf=finiteCount(ours.goals),ga=finiteCount(other?.goals);
  if(gf===null||ga===null||!Number.isInteger(gf)||!Number.isInteger(ga))return [];
  const ownSR=ratingBefore(ratings,CLUB_ID,m.timestamp)?.skillRating??null,otherSR=ratingBefore(ratings,opponentId,m.timestamp)?.skillRating??null;
  return [{id:String(m.matchId),time:m.timestamp,night:amsterdamDay(m.timestamp*1000),opponentId,opponent:other?.details?.name||opponentId,gf,ga,result:(gf>ga?0:gf===ga?1:2) as 0|1|2,own:roster(m.players?.[CLUB_ID]),other:roster(m.players?.[opponentId]),ownSR,otherSR,gap:ownSR===null||otherSR===null?null:ownSR-otherSR,dnf:Number(ours.winnerByDnf)>0||Number(other?.winnerByDnf)>0,type:['1','leagueMatch'].includes(String(m.matchType||ours.matchType))?'leagueMatch':String(m.matchType||ours.matchType||'unknown')}];
 }).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
}
export const countEligible=(r:Matchup)=>!r.dnf&&r.own.n>=1&&r.own.n<=11&&r.other.n>=1&&r.other.n<=11;
export function wilson(w:number,n:number){if(!n)return [0,1] as const;const z=1.96,d=1+z*z/n,c=(w/n+z*z/(2*n))/d,h=z*Math.sqrt((w/n*(1-w/n)+z*z/(4*n))/n)/d;return [Math.max(0,c-h),Math.min(1,c+h)] as const;}
export function summary(rows:Matchup[]){
 const n=rows.length,w=rows.filter(r=>r.result===0).length,d=rows.filter(r=>r.result===1).length,l=n-w-d;
 const uniqueOpponents=new Set(rows.map(r=>r.opponentId)).size,nights=new Set(rows.map(r=>r.night)).size;
 return {n,w,d,l,raw:n?w/n:null,smoothed:(w+1)/(n+3),probabilities:[(w+1)/(n+3),(d+1)/(n+3),(l+1)/(n+3)],interval:wilson(w,n),points:n?(3*w+d)/n:null,uniqueOpponents,nights,rankable:n>=5&&uniqueOpponents>=3&&nights>=3,ids:rows.map(r=>r.id)};
}
export function groups(rows:Matchup[],key:(r:Matchup)=>string|null){
 const map=new Map<string,Matchup[]>();for(const r of rows){const k=key(r);if(k!==null)map.set(k,[...(map.get(k)||[]),r]);}
 return [...map].map(([label,games])=>({label,games,...summary(games)})).sort((a,b)=>b.n-a.n||a.label.localeCompare(b.label));
}
export function strengthBand(gap:number|null){return gap===null?null:gap>150?'Biz +150 SR üstündeyiz':gap< -150?'Rakip +150 SR üstünde':'Yakın güç (±150 SR)';}
export function composition(r:Roster){return r.unknown||!r.n?null:r.roles.join('–');}
export function matchupReport(rows:Matchup[]){
 const valid=rows.filter(countEligible),countGroups=groups(valid,r=>`${r.own.n} × ${r.other.n}`),ranked=countGroups.filter(g=>g.rankable).sort((a,b)=>b.smoothed-a.smoothed);
 return {valid,excluded:rows.length-valid.length,counts:countGroups,strength:groups(valid,r=>strengthBand(r.gap)),roles:groups(valid,r=>composition(r.own)&&composition(r.other)?`${composition(r.own)} / ${composition(r.other)}`:null),best:ranked[0]||null,worst:ranked.length>1?ranked.at(-1)!:null,overall:summary(valid)};
}
export type Scenario={own:number;other:number;ownRoles?:number[];otherRoles?:number[];gap?:number;type?:string};
function validScenario(s:Scenario){return [s.own,s.other].every(n=>Number.isInteger(n)&&n>=1&&n<=11)&&[s.ownRoles,s.otherRoles].every((r,i)=>!r||(r.length===4&&r.every(n=>Number.isInteger(n)&&n>=0)&&r.reduce((a,b)=>a+b,0)===[s.own,s.other][i]&&r[0]<=1))&&(s.gap===undefined||Number.isFinite(s.gap));}
export function scenarioEstimate(history:Matchup[],s:Scenario,before=Infinity){
 if(!validScenario(s))return {error:'Pozisyon toplamı oyuncu sayısına eşit olmalı; kaleci en fazla bir olabilir.',rows:[] as Matchup[],stats:summary([]),enough:false};
 // Exact human-count cohort; role composition distance is predeclared, not optimized on results.
 const rows=history.filter(r=>r.time<before&&countEligible(r)&&r.own.n===s.own&&r.other.n===s.other&&(!s.type||r.type===s.type)&&
  (s.gap===undefined||(r.gap!==null&&Math.abs(r.gap-s.gap)<=150))&&
  [s.ownRoles,s.otherRoles].every((roles,i)=>!roles||((i?r.other:r.own).unknown===0&&roles.reduce((d,v,j)=>d+Math.abs(v-(i?r.other:r.own).roles[j]),0)<=2)));
 const stats=summary(rows);return {error:'',rows,stats,enough:stats.n>=20&&stats.uniqueOpponents>=5&&stats.nights>=5};
}
export function prequentialValidation(rows:Matchup[]){
 const ordered=rows.filter(countEligible).sort((a,b)=>a.time-b.time),predictions:{p:number;actual:number;base:number}[]=[];
 for(const row of ordered){
  // Same-night outcomes are held out together to reduce repeated-lineup leakage.
  const past=ordered.filter(r=>r.time<row.time&&r.night!==row.night);
  const estimate=scenarioEstimate(past,{own:row.own.n,other:row.other.n,type:row.type},row.time);
  if(!estimate.enough)continue;
  predictions.push({p:estimate.stats.smoothed,actual:row.result===0?1:0,base:summary(past).smoothed});
 }
 const n=predictions.length,brier=n?predictions.reduce((s,r)=>s+(r.p-r.actual)**2,0)/n:null,baseline=n?predictions.reduce((s,r)=>s+(r.base-r.actual)**2,0)/n:null;
 const calibration=n?Array.from({length:5},(_,i)=>predictions.filter(r=>Math.min(4,Math.floor(r.p*5))===i)).reduce((sum,g)=>sum+(g.length?Math.abs(g.reduce((s,r)=>s+r.p-r.actual,0))/n:0),0):null;
 return {n,brier,baseline,calibration,qualified:n>=30&&brier!==null&&baseline!==null&&brier<baseline&&calibration!==null&&calibration<=.15};
}
