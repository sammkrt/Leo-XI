import type { Match } from './club-types.ts';
import { decodedPlayer, playerEvents } from './club-events.mjs';
import { CLUB_ID, uniqueMatches } from './club-model.mjs';

// Observational community mappings, not official EA definitions.
export const researchSource = 'https://github.com/Interactive-63/eafc-pro-clubs-api-research';
export const labMetrics = [
  {key:'insideShare', label:'Ceza sahası içi şut payı', unit:'%', formula:'100 × (13+14) / (13+14+18+19)', question:'Şutları kaleye daha yakın bölgelerden seçtiğimiz maçlar nasıl geçti?'},
  {key:'insideAccuracy', label:'İçeriden isabet', unit:'%', formula:'100 × 13 / (13+14)', question:'İçeriden şutların sonuçları'},
  {key:'outsideAccuracy', label:'Dışarıdan isabet', unit:'%', formula:'100 × 18 / (18+19)', question:'Dışarıdan şutların sonuçları'},
  {key:'forwardSuccess', label:'İleri pas başarısı', unit:'%', formula:'100 × 30 / (30+31)', question:'İleri pası daha güvenli kullandığımız maçlar nasıl geçti?'},
  {key:'firstTime', label:'Tek pas yoğunluğu', unit:'/100 pas', formula:'100 × 143 / (215+216)', question:'Tek pasın daha yoğun olduğu maçlarda ne değişti?'},
  {key:'switches', label:'Yön değiştirme yoğunluğu', unit:'/100 pas', formula:'100 × 144 / (215+216)', question:'Oyunun yönünü daha sık değiştirdiğimizde ne oldu?'},
  {key:'through', label:'Başarılı ara pas yoğunluğu', unit:'/100 pas', formula:'100 × 152 / (215+216)', question:'Ara pas üretimimiz arttığında sonuçlar nasıl değişti?'},
  {key:'dangerLoss', label:'Savunma bölgesi kayıp payı', unit:'%', formula:'100 × 105 / (105+106+107)', question:'Kayıplarımızın savunma bölgesinde yoğunlaştığı maçlarda ne oldu?'},
  {key:'highRegain', label:'Hücum bölgesi kazanım payı', unit:'%', formula:'100 × 110 / (108+109+110)', question:'Topu daha ileride kazandığımız maçlar nasıl geçti?'},
] as const;
export type MetricKey = typeof labMetrics[number]['key'];
type Fraction = {num:number;den:number;covered?:number};
export type LabRow = {id:string;time:number;opponentId:string;opponent:string;gf:number;ga:number;points:number;roster:string[];covered:number;total:number;metrics:Record<MetricKey,Fraction>};
const count = (v:unknown) => v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) && Number(v)>=0 ? Number(v) : null;
export const fractionValue = (f:Fraction) => f.den>0 ? 100*f.num/f.den : null;
export function labRows(matches:Match[]):LabRow[] {
  return (uniqueMatches(matches) as Match[]).flatMap(m=>{
    const ours=m.clubs[CLUB_ID];const opponentEntry=Object.entries(m.clubs).find(([id,c])=>id!==CLUB_ID&&c);
    if(!ours||!opponentEntry)return [];
    const [opponentId,other]=opponentEntry; const gf=count(ours.goals),ga=count(other?.goals);
    if(gf===null||ga===null)return [];
    const players=Object.entries(m.players?.[CLUB_ID]||{}).filter(([,p])=>p);
    const metrics=Object.fromEntries(labMetrics.map(d=>[d.key,{num:0,den:0,covered:0}])) as Record<MetricKey,Fraction>;
    let covered=0;
    for(const [,p] of players){
      const e=playerEvents(p),decoded=decodedPlayer(p);if(!e||!decoded)continue;
      covered++;
      const g=(id:number):number=>e.get(id)||0;
      const add=(key:MetricKey,num:number,den:number)=>{metrics[key].num+=num;metrics[key].den+=den;metrics[key].covered=(metrics[key].covered||0)+1;};
      const inside=g(13)+g(14),outside=g(18)+g(19);
      if(inside+outside===g(217)+g(218)&&g(13)+g(18)===g(217)){
        add('insideShare',inside,inside+outside);add('insideAccuracy',g(13),inside);add('outsideAccuracy',g(18),outside);
      }
      if(g(30)+g(32)+g(34)<=g(215)&&g(31)+g(33)+g(35)<=g(216))add('forwardSuccess',g(30),g(30)+g(31));
      const passes=g(215)+g(216);
      // These overlay densities are separate counters, not a partition of passes.
      if(g(143)<=passes)add('firstTime',g(143),passes);
      if(g(144)<=passes)add('switches',g(144),passes);
      if(g(152)<=passes)add('through',g(152),passes);
      add('dangerLoss',g(105),g(105)+g(106)+g(107));add('highRegain',g(110),g(108)+g(109)+g(110));
    }
    return [{id:String(m.matchId),time:m.timestamp,opponentId,opponent:other?.details?.name||opponentId,gf,ga,points:gf>ga?3:gf===ga?1:0,roster:players.map(([id])=>id),covered,total:players.length,metrics}];
  });
}
export const eligible = (r:LabRow,key:MetricKey) => r.total>0&&(r.metrics[key].covered??0)/r.total>=.8&&fractionValue(r.metrics[key])!==null;
export function pooled(rows:LabRow[],key:MetricKey){return fractionValue(rows.reduce((a,r)=>({num:a.num+r.metrics[key].num,den:a.den+r.metrics[key].den}),{num:0,den:0}));}
export function outcomes(rows:LabRow[]){const n=rows.length;return {n,points:n?rows.reduce((s,r)=>s+r.points,0)/n:null,gf:n?rows.reduce((s,r)=>s+r.gf,0)/n:null,ga:n?rows.reduce((s,r)=>s+r.ga,0)/n:null};}
export function splitProfile(rows:LabRow[],key:MetricKey){
  const valid=rows.filter(r=>eligible(r,key));
  const values=valid.map(r=>fractionValue(r.metrics[key])!).sort((a,b)=>a-b);
  const middle=Math.floor(values.length/2);const median=values.length?(values.length%2?values[middle]:(values[middle-1]+values[middle])/2):null;
  const low=median===null?[]:valid.filter(r=>fractionValue(r.metrics[key])!<median);
  const high=median===null?[]:valid.filter(r=>fractionValue(r.metrics[key])!>median);
  return {median,low,high,ties:valid.length-low.length-high.length,excluded:rows.length-valid.length,enough:low.length>=5&&high.length>=5};
}
export function opponents(rows:LabRow[]){const groups=new Map<string,LabRow[]>();for(const row of rows)groups.set(row.opponentId,[...(groups.get(row.opponentId)||[]),row]);return [...groups].map(([id,games])=>({id,name:games[0].opponent,games:games.sort((a,b)=>b.time-a.time)})).sort((a,b)=>b.games.length-a.games.length||a.name.localeCompare(b.name));}
export function rosterSimilarity(a:LabRow,b:LabRow){const union=new Set([...a.roster,...b.roster]);return union.size?a.roster.filter(id=>b.roster.includes(id)).length/union.size:null;}
export function nearestMatches(row:LabRow,rows:LabRow[]){
  // Equal-weight mean absolute distance, ratios on a shared 0..1 scale. No fitted model on tiny archives.
  const keys:MetricKey[]=['insideShare','forwardSuccess','dangerLoss','highRegain'];
  return rows.filter(r=>r.id!==row.id&&r.time<row.time&&r.total>0&&r.covered/r.total>=.8).flatMap(r=>{
    const diffs=keys.flatMap(key=>{const a=eligible(row,key)?fractionValue(row.metrics[key]):null,b=eligible(r,key)?fractionValue(r.metrics[key]):null;return a===null||b===null?[]:[Math.abs(a-b)/100];});
    return diffs.length<3?[]:[{row:r,distance:diffs.reduce((a,b)=>a+b,0)/diffs.length,dimensions:diffs.length}];
  }).sort((a,b)=>a.distance-b.distance).slice(0,3);
}
export type Experiment = {id:string;title:string;metric:MetricKey;start:number;target:number;baselineIds:string[];createdAt:number};
export function experimentResult(experiment:Experiment,rows:LabRow[]){
  const valid=(r:LabRow)=>eligible(r,experiment.metric);
  const baseline=rows.filter(r=>experiment.baselineIds.includes(r.id)&&r.time<experiment.start&&valid(r));
  const after=rows.filter(r=>r.time>=experiment.start&&valid(r)).sort((a,b)=>a.time-b.time).slice(0,experiment.target);
  return {baseline,after,before:pooled(baseline,experiment.metric),current:pooled(after,experiment.metric),complete:after.length>=experiment.target};
}
