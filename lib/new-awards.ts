import specs from '../data/new-award-specs.json' with {type:'json'};
import {newAwardFeatures} from './new-award-formulas.ts';
import {playerEvents,decodedPlayer} from './club-events.mjs';
import {finiteCount} from './research-context.mjs';
import type {AwardDefinition,AwardResult,AwardCandidate,AwardMember,AwardOptions,AwardRules} from './derived-awards';
import type {Match,MatchPlayer} from './club-types';
type Values=Record<string,number>;
type Entry={id:string;name:string;role:string;matchId:string;v:Values};
const S=(v:Values,...ids:number[])=>ids.reduce((a,id)=>a+v['E'+id],0);
const minimums:Record<string,(v:Values)=>boolean>={
 A01:v=>v.E214>=1||S(v,38,147)>=3,A02:v=>v.E112>=4&&v.E174>=5,A03:v=>S(v,18,19)>=5&&S(v,217,218)>=8,
 A04:v=>v.E217>=5&&v.E202>=2,A05:v=>S(v,13,14)>=6&&v.E214>=2,A06:v=>v.E214>=2&&v.E123>=1,
 A07:v=>S(v,217,218)>=8&&v.teamShots>0&&v.E214/S(v,217,218)<.5&&(v.E11+.5*v.E115)/S(v,217,218)<.5,
 A08:v=>S(v,215,216)>=30&&S(v,152,115)>=3,A09:v=>v.E115>=2,A10:v=>v.E153>=2&&S(v,30,31)>=15,
 A11:v=>v.E143>=8&&S(v,30,31)>=15,A12:v=>S(v,28,29)>=8&&v.E144>=2,A13:v=>S(v,30,32,34)>=40&&S(v,215,216)>=50,
 A14:v=>S(v,215,216)>=50&&S(v,30,31)>=15,A15:v=>S(v,182,207,175,183,176,177)>=5&&S(v,215,216)>=30,
 A16:v=>S(v,176,177,182)>=5,A17:v=>S(v,36,37)>=8,A18:v=>S(v,36,37)>=10&&v.E37>=4,
 A19:v=>S(v,110,158,6)>=6,A20:v=>S(v,107,110)>=7&&S(v,174,112)>=5,A21:v=>S(v,108,164,6)>=7,
 A22:v=>S(v,94,10,3,105)>=3,A23:v=>S(v,229,230)>=7,A24:v=>S(v,0,1)>=10,A25:v=>S(v,2,3,163)>=3,
 A26:v=>v.E219>=5,A27:v=>v.E219>=8,A28:v=>S(v,265,266)>=5,A29:v=>S(v,266,229,230)>=6,
 A30:v=>S(v,2,3)>=3&&S(v,95,213,94,10)>=2,A31:v=>v.Saves+v.GoalsConceded>=8,A32:v=>v.Saves+v.GoalsConceded>=8,
 A35:v=>v.SecondsPlayed>=10800,
};
const rolesFor:Record<string,string[]>={A22:['defender'],A26:['defender','midfielder'],A29:['defender'],A31:['goalkeeper'],A32:['goalkeeper']};
// Meaningful front-of-card counters; formula indices remain in the audit disclosure.
const highlights:Record<string,[number,string][]>= {
 A01:[[38,'skill geçişi'],[147,'artistik pas'],[214,'gol']],A02:[[38,'skill geçişi'],[112,'rakip geçişi'],[174,'top sürme']],A03:[[19,'dışarıdan isabetsiz'],[18,'dışarıdan isabetli'],[218,'isabetsiz şut']],
 A04:[[202,'kurtarılan şut'],[217,'isabetli şut'],[214,'gol']],A05:[[13,'içeriden isabetli'],[14,'içeriden isabetsiz'],[214,'toplam gol']],A06:[[123,'aşırtma etiketi'],[214,'gol'],[128,'teknik etiketi']],
 A07:[[217,'isabetli şut'],[218,'isabetsiz şut'],[11,'asist']],A08:[[152,'ara pas'],[115,'ikinci asist'],[147,'artistik pas']],A09:[[115,'ikinci asist'],[143,'tek pas'],[176,'iyi karar bildirimi']],
 A10:[[153,'ofsayt pası'],[30,'başarılı ileri pas'],[31,'hatalı ileri pas']],A11:[[143,'tek pas'],[30,'başarılı ileri pas'],[31,'hatalı ileri pas']],A12:[[144,'yön değiştirme'],[28,'başarılı uzun pas'],[29,'hatalı uzun pas']],
 A13:[[32,'geri pas'],[34,'yan pas'],[152,'ara pas']],A14:[[31,'hatalı ileri pas'],[216,'pas hatası'],[30,'başarılı ileri pas']],A15:[[182,'başka seçenek bildirimi'],[207,'kötü pas bildirimi'],[175,'seçenek yok bildirimi']],
 A16:[[176,'iyi karar'],[177,'en iyi karar'],[182,'başka seçenek']],A17:[[36,'başarılı orta'],[37,'hatalı orta'],[11,'asist']],A18:[[37,'hatalı orta'],[36,'başarılı orta'],[216,'pas hatası']],
 A19:[[110,'önde top kazanma'],[158,'rakipten top alma'],[6,'pas arası']],A20:[[107,'önde kayıp'],[110,'önde kazanım'],[174,'top sürme']],A21:[[108,'geride kazanım'],[164,'temiz müdahale'],[6,'pas arası']],
 A22:[[94,'verilen penaltı'],[10,'verilen korner'],[105,'geride kayıp']],A23:[[230,'kayarak kazanım'],[229,'ayakta kazanım'],[164,'temiz müdahale']],A24:[[164,'temiz müdahale'],[0,'kazanılan müdahale'],[1,'kaybedilen müdahale']],
 A25:[[163,'sert müdahale'],[95,'anlık sarı'],[94,'verilen penaltı']],A26:[[105,'geride kayıp'],[106,'ortada kayıp'],[1,'kaybedilen müdahale']],A27:[[219,'pozisyon dışı'],[103,'en ağır pozisyon bildirimi'],[111,'iyi pozisyon bildirimi']],
 A28:[[265,'hücum hava topu'],[266,'savunma hava topu'],[108,'geride kazanım']],A29:[[266,'savunma hava topu'],[229,'ayakta kazanım'],[108,'geride kazanım']],A30:[[95,'anlık sarı'],[213,'gecikmeli sarı'],[94,'verilen penaltı']],A35:[[174,'top sürme'],[215,'başarılı pas'],[108,'geride kazanım']],
};
export const newAwardRegistry:AwardDefinition[]=specs.cards.map(c=>{
 const [icon,...name]=c.name.split(' ');return {id:'new-'+c.id,title:name.join(' '),icon,category:c.category.startsWith('Pas')?'passing':c.category.startsWith('Savunma')?'defense':'style',variant:'research-v1',joke:c.tagline,fields:c.events.map(e=>'E'+e),thresholds:{M:3},components:[],formula:c.score_template,limitation:c.caution+' Adaylık: '+c.eligibility+(c.id==='A07'?' Ek koruma: gol/şut<0,5 ve (asist+0,5×ikinci asist)/şut<0,5.':''),...(!c.default_enabled?{unavailableReason:'Deneysel eşleme; yeterli bağımsız doğrulama yok. Varsayılan kapalı.'}:{})};
});
function record(id:string,p:MatchPlayer,matchId:string):Entry|null{
 // All four buckets must be explicitly delivered (empty strings are valid). Missing buckets aren't zero.
 if(!Array.from({length:4},(_,i)=>p['match_event_aggregate_'+i]).every(x=>typeof x==='string'))return null;
 const e=playerEvents(p);if(!e||!decodedPlayer(p))return null;
 const v:Values={M:1};for(let i=0;i<=300;i++)v['E'+i]=e.get(i)||0;
 for(const [key,field]of [['SecondsPlayed','secondsPlayed'],['Saves','saves'],['GoalsConceded','goalsconceded'],['CleanSheetsGK','cleansheetsgk']]){const n=finiteCount(p[field]);if(n!==null)v[key]=n;}
 return {id,name:p.playername||id,role:p.pos,matchId,v};
}
function validFor(id:string,r:Entry){
 const v=r.v;
 if(rolesFor[id]&&!rolesFor[id].includes(r.role))return false;
 if(['A01','A02'].includes(id)&&v.E38>v.E112)return false;
 if(['A03','A04','A05'].includes(id)&&(S(v,13,14,18,19)!==S(v,217,218)||S(v,13,18)!==v.E217))return false;
 if(id==='A04'&&v.E202>v.E217)return false;
 if(['A06','A01'].includes(id)&&v.E123>v.E214)return false;
 if(['A10','A11','A13','A14'].includes(id)&&(S(v,30,32,34)>v.E215||S(v,31,33,35)>v.E216))return false;
 if(['A08','A11','A12','A13','A14','A17','A18'].includes(id)&&(S(v,24,26,28,36)>v.E215||S(v,25,27,29,37)>v.E216))return false;
 if(['A08','A11','A12','A13','A16'].includes(id)&&[143,144,152].some(e=>v['E'+e]>S(v,215,216)))return false;
 if(['A26','A27'].includes(id)&&S(v,99,100,101,102,103)!==v.E219)return false;
 if(['A23','A24','A29'].includes(id)&&S(v,229,230)>v.E0)return false;
 if(['A31','A32'].includes(id)&&(!['Saves','GoalsConceded','CleanSheetsGK'].every(k=>Number.isFinite(v[k]))||v.E267>v.Saves||v.CleanSheetsGK>1))return false;
 if(id==='A35'&&(!Number.isFinite(v.SecondsPlayed)||v.SecondsPlayed<60||v.SecondsPlayed>10800))return false;
 return true;
}
const percentile=(value:number,values:number[])=>values.length<2?.5:(values.filter(v=>v<value-1e-9).length+(values.filter(v=>Math.abs(v-value)<=1e-9).length-1)/2)/(values.length-1);
function rank(candidates:AwardCandidate[],rules:AwardRules){
 // Shrink each feature toward other eligible same-role players, falling back explicitly to the team.
 for(const c of candidates)for(let i=0;i<c.components.length;i++){
  const same=candidates.filter(p=>p!==c&&p.roles[0]===c.roles[0]),peers=same.length>=rules.minRolePeers?same:candidates.filter(p=>p!==c);
  const base=peers.length?peers.reduce((s,p)=>s+p.components[i].raw,0)/peers.length:c.components[i].raw;
  const x=c.components[i];x.baseline=base;x.prior=rules.priorMatches;x.adjusted=(x.raw*c.M+rules.priorMatches*base)/(c.M+rules.priorMatches);
  x.references=[{role:c.roles[0],scope:same.length>=rules.minRolePeers?'same-role':'team',peers:peers.length,observations:peers.reduce((s,p)=>s+p.M,0),attempts:peers.reduce((s,p)=>s+p.M,0),weight:1,value:base}];
 }
 for(const c of candidates){for(let i=0;i<c.components.length;i++){
  const same=candidates.filter(p=>p.roles[0]===c.roles[0]),peers=same.length>=rules.minRolePeers+1?same:candidates;c.components[i].percentile=percentile(c.components[i].adjusted,peers.map(p=>p.components[i].adjusted));
 }c.index=100*c.components.reduce((s,x)=>s+x.weight*x.percentile!,0);}
 candidates.sort((a,b)=>b.index!-a.index!||a.playerId.localeCompare(b.playerId));
 if(candidates.length<rules.minCandidates)return {winners:[],reason:`En az ${rules.minCandidates} uygun aday gerekiyor; ${candidates.length} aday var.`};
 const high=candidates[0].index!,low=candidates.at(-1)!.index!;
 if(high-low<rules.minIndexSpread)return {winners:[],reason:'Adaylar arasında anlamlı ayrışma yok.'};
 const winners=candidates.filter(c=>Math.abs(c.index!-high)<=rules.equalityTolerance),next=candidates.find(c=>!winners.includes(c));
 if(next&&(high-next.index!<rules.minIndexGap||winners.every(c=>c.components.every((x,i)=>Math.abs(x.adjusted-next.components[i].adjusted)<rules.minRelativeDifference*Math.max(1,Math.abs(x.adjusted),Math.abs(next.components[i].adjusted))))))return {winners:[],reason:'Lider farkı yeterli değil.'};
 return {winners,reason:''};
}
function makeCandidate(id:string,name:string,proName:string,roles:string[],v:Values,ids:string[],features:{label:string;weight:number;value:number}[],context:string,available=ids.length):AwardCandidate{
 return {playerId:id,name,proName,roles,M:v.M,available,totals:v,matchIds:ids,index:null,context,sourceTotals:[],components:features.map((f,i)=>({key:'feature-'+i,label:f.label,weight:f.weight,raw:f.value,adjusted:f.value,percentile:null,numerator:f.value,denominator:1,baseline:null,prior:0,references:[]}))};
}
export function newAwardResults(matches:readonly Match[],members:readonly AwardMember[],options:AwardOptions,rules:AwardRules):AwardResult[]{
 const entries:Entry[]=[];
 for(const m of matches){
  if(Object.values(m.clubs).some(c=>Number(c?.winnerByDnf)>0))continue;
  const raw=Object.entries(m.players?.['79638']||{}).filter(([,p])=>p),valid=raw.flatMap(([id,p])=>{const r=record(id,p!,String(m.matchId));return r?[r]:[];});
  const teamShots=valid.length===raw.length?valid.reduce((s,r)=>s+S(r.v,217,218),0):null;
  for(const r of valid){if(teamShots!==null)r.v.teamShots=teamShots;entries.push(r);}
 }
 return newAwardRegistry.map(def=>{
  const id=def.id.slice(4),result:AwardResult={definition:def,candidates:[],winners:[],reason:'',excluded:[]};
  if(def.unavailableReason){result.reason=def.unavailableReason;return result;}
  if(['A01','A06'].includes(id)&&!options.allowPartialMappings){result.reason='E123 aşırtma eşlemesi kısmi; doğrulama bayrağı açılana kadar kazanan üretilmez.';return result;}
  if(id==='A33'||id==='A34')return contextualAward(result,matches,members,options,rules);
  const valid=entries.filter(r=>(!options.role||options.role==='all'||r.role===options.role)&&validFor(id,r)&&(!(id==='A07')||Number.isFinite(r.v.teamShots)));
  for(const playerId of new Set(valid.map(r=>r.id))){
   if(options.playerIds?.length&&!options.playerIds.includes(playerId))continue;
   const sample=valid.filter(r=>r.id===playerId),M=sample.length;
   if(M<Math.max(3,rules.minMatches))continue;
   const v:Values={M};for(const key of Object.keys(sample[0].v).filter(k=>k!=='M'&&(def.fields.includes(k)||['teamShots','Saves','GoalsConceded','CleanSheetsGK','SecondsPlayed'].includes(k))))if(sample.every(r=>Number.isFinite(r.v[key])))v[key]=sample.reduce((s,r)=>s+r.v[key],0);
   if(!minimums[id]?.(v))continue;
   const features=newAwardFeatures[id](v);if(features.some(f=>!Number.isFinite(f.value)))continue;
   const roleCounts=new Map<string,number>();sample.forEach(r=>roleCounts.set(r.role,(roleCounts.get(r.role)||0)+1));const roles=[...roleCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([r])=>r);
   const name=sample.at(-1)!.name,member=members.find(m=>m.name.toLowerCase()===name.toLowerCase());
   const context=id==='A31'||id==='A32'?`${v.Saves} kurtarış · ${v.GoalsConceded} yenilen gol · ${v.CleanSheetsGK} gol yemeden maç`:(highlights[id]||[]).map(([e,label])=>`${v['E'+e]} ${label}`).join(' · ');
   result.candidates.push(makeCandidate(playerId,name,member?.proName||name,roles,v,sample.map(r=>r.matchId),features,context,matches.filter(m=>m.players?.['79638']?.[playerId]).length));
  }
  for(const m of matches)for(const [playerId,p]of Object.entries(m.players?.['79638']||{}))if(p&&!valid.some(r=>r.id===playerId&&r.matchId===String(m.matchId)))result.excluded.push({playerId,matchId:String(m.matchId),reasons:['Eksik/tutarsız olay, DNF, kartın rol veya kapsam koşulu']});
  Object.assign(result,rank(result.candidates,rules));
  // Keep the original scientific caution alongside implementation-specific checks.
  return result;
 });
}
function contextualAward(result:AwardResult,matches:readonly Match[],members:readonly AwardMember[],options:AwardOptions,rules:AwardRules):AwardResult{
 const ctx=options.research,at=Date.parse(ctx?.observedAt||'');
 if(!ctx||!Number.isFinite(at)||at>(options.now??Date.now())+300000||Math.abs((options.now??Date.now())-at)>48*3600000){result.reason='Güncel ve aynı toplama çalışmasına ait sezon/kariyer kaynakları bekleniyor.';return result;}
 if(result.definition.id==='new-A33'){
  if(!ctx.members||!ctx.career){result.reason='Sezon ve kariyer oyuncu verileri birlikte gerekli.';return result;}
  for(const current of ctx.members){
   const career=ctx.career.find(p=>p.name===current.name);if(!career)continue;
   const fields=['gamesPlayed','goals','assists','ratingAve'];if(!fields.every(k=>finiteCount(current[k])!==null&&finiteCount(career[k])!==null))continue;
   const [M,G,A,R]=fields.map(k=>Number(current[k])),[CM,CG,CA,CR]=fields.map(k=>Number(career[k])),old=CM-M;
   if(M<8||old<10||CG<G||CA<A||R>10||CR>10)continue;
   const oldRating=(CR*CM-R*M)/old;if(oldRating<0||oldRating>10)continue;
   const output=(G+A)/M,delta=output-(CG-G+CA-A)/old,rd=R-oldRating;if(delta<=0||rd<=0)continue;
   const name=String(current.name),member=members.find(m=>m.name===name),found=matches.flatMap(m=>Object.entries(m.players?.['79638']||{})).find(([,p])=>p?.playername===name),id=found?.[0]||'season:'+name,role=String(current.favoritePosition||'unknown');
   if(options.playerIds?.length&&!options.playerIds.includes(id)||options.role&&options.role!=='all'&&options.role!==role)continue;
   const c=makeCandidate(id,name,member?.proName||name,[role],{M,CurrentGoals:G,CurrentAssists:A,PriorGames:old},[],[{label:'Gol+asist / maç gelişimi',weight:.45,value:delta},{label:'Puan ortalaması gelişimi',weight:.35,value:rd},{label:'Sezon gol+asist / maç',weight:.2,value:output}],`${G+A} sezon gol+asist · ${M} sezon maçı · ${old} önceki maç`);c.displayPeriod='Cari sezon / önceki kariyer';result.candidates.push(c);
  }
  Object.assign(result,rank(result.candidates,rules));return result;
 }
 const season=ctx.season,all=ctx.allTime;
 if(options.playerIds?.length||options.role&&options.role!=='all'){result.reason='Takım kartı bireysel/rol filtresinde hesaplanmaz.';return result;}
 if(!season||!all||!['wins','gamesPlayed'].every(k=>finiteCount(season[k])!==null&&finiteCount(all[k])!==null)||Number(season.gamesPlayed)<=0||Number(all.gamesPlayed)<Number(season.gamesPlayed)||Number(season.wins)>Number(season.gamesPlayed)||Number(all.wins)>Number(all.gamesPlayed)){result.reason='İki leaderboard döneminde geçerli kulüp toplamları gerekli.';return result;}
 const games=[...matches].filter(m=>Object.keys(m.clubs).length===2&&Object.values(m.clubs).every(c=>finiteCount(c?.goals)!==null)&&!Object.values(m.clubs).some(c=>Number(c?.winnerByDnf)>0)).sort((a,b)=>b.timestamp-a.timestamp).slice(0,10);
 if(games.length<5){result.reason='En az 5 sonuç kaydı gerekli.';return result;}
 const score=games.reduce((s,m)=>{const gf=Number(m.clubs['79638']?.goals),ga=Number(Object.entries(m.clubs).find(([id])=>id!=='79638')![1]!.goals);return {gf:s.gf+gf,ga:s.ga+ga,l:s.l+(gf<ga?1:0)};},{gf:0,ga:0,l:0});
 const n=games.length,value=.45*score.l/n+.30*Math.min(1,Math.max(0,score.ga-score.gf)/n)+.25*Math.max(0,Number(all.wins)/Number(all.gamesPlayed)-Number(season.wins)/Number(season.gamesPlayed));
 if(value<.35){result.reason='Takım form riski eşiği (0,35) aşılmadı.';return result;}
 const c=makeCandidate('club:79638','LEO XI','LEO XI',['unknown'],{M:n},games.map(m=>String(m.matchId)),[{label:'Takım form riski (0–1)',weight:1,value}],`${score.l} mağlubiyet · ${score.gf}:${score.ga} goller · ${n} kayıtlı maç`);c.displayPeriod='Son kayıtlar / sezon bağlamı';c.index=value*100;result.candidates=[c];result.winners=[c];return result;
}
