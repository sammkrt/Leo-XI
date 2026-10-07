import {playerEvents} from './club-events.mjs';

// Community mappings, not official EA statistics. Preserve the original payloads.
// https://github.com/Interactive-63/eafc-pro-clubs-api-research
const sum=(...ids)=>e=>ids.reduce((n,id)=>n+(e.get(id)||0),0);
const metric=(id,label,ids,extra={})=>({id,label,read:sum(...ids),...extra});
const rate=(id,label,numerator,denominator,extra={})=>({id,label,read:sum(...numerator),denominator:sum(...denominator),...extra});
const residual=(total,...parts)=>e=>{const n=sum(total)(e)-sum(...parts)(e);return n<0?null:n;};
export const deepGroups=[
 {id:'attack',label:'Hücum',metrics:[
  metric('goals','Gol',[214],{validate:'goals'}),metric('assists','Asist',[11],{validate:'assists'}),metric('contributions','Gol + asist',[214,11],{validate:'contributions'}),metric('secondAssists','İkinci asist',[115]),metric('throughAssists','Ara pastan asist',[118]),
  metric('shots','Şut',[217,218],{validate:'shots'}),metric('onTarget','İsabetli şut',[217]),metric('offTarget','İsabetsiz şut',[218]),
  rate('accuracy','Şut isabeti',[217],[217,218],{validate:'shots'}),rate('conversion','Şut başına gol',[214],[217,218],{validate:'conversion'}),
  metric('insideShots','Ceza sahası içi şut',[13,14]),metric('outsideShots','Ceza sahası dışı şut',[18,19]),rate('insideAccuracy','Ceza sahası içi isabet',[13],[13,14]),rate('outsideAccuracy','Ceza sahası dışı isabet',[18],[18,19]),
  rate('outsideShare','Konumu belli şutlarda dış saha payı',[18,19],[13,14,18,19]),metric('firstTimeGoals','Gelişine şutla gol',[128]),metric('weakFootGoals','Zayıf ayakla gol',[131]),metric('postGoals','Direğe çarparak gol',[136]),
  rate('throughAssistShare','Asistlerde ara pas payı',[118],[11],{validate:'assists'}),rate('weakFootShare','Gollerde zayıf ayak payı',[131],[214],{validate:'goals'})
 ]},
 {id:'passing',label:'Pas',metrics:[
  metric('completed','Başarılı pas',[215]),metric('failed','Başarısız pas',[216]),metric('attempts','Takip edilen pas denemesi',[215,216]),rate('passRate','Pas başarısı',[215],[215,216]),
  ...[['forward','İleri',30,31],['backward','Geri',32,33],['sideways','Yana',34,35],['short','Kısa',24,25],['medium','Orta',26,27],['long','Uzun',28,29]].flatMap(([id,label,yes,no])=>[metric(id+'Made',label+' başarılı pas',[yes]),metric(id+'Failed',label+' başarısız pas',[no]),rate(id+'Rate',label+' pas başarısı',[yes],[yes,no])]),
  ...[['forward', 'İleri',30],['backward','Geri',32],['sideways','Yana',34]].map(([id,label,event])=>rate(id+'Share',label+' yön payı',[event],[30,32,34])),
  metric('crossMade','Başarılı orta · duran top dahil',[36]),metric('crossFailed','Başarısız orta · açık oyun',[37]),metric('firstTimePass','Tek dokunuş pas',[143]),metric('switchPlay','Oyun yönünü değiştiren pas',[144]),metric('flairPass','Gösterişli pas',[147]),metric('throughBalls','Başarılı ara pas',[152]),metric('offsidePass','Ofsayt pası',[153]),
  {id:'unknownDirectionMade',label:'Yönü sınıflanmayan başarılı pas',read:residual(215,30,32,34)},
  {id:'unknownDirectionFailed',label:'Yönü sınıflanmayan başarısız pas',read:residual(216,31,33,35)},
  {id:'unknownLengthMade',label:'Türü sınıflanmayan başarılı pas',read:residual(215,24,26,28,36)},
  {id:'unknownLengthFailed',label:'Türü sınıflanmayan başarısız pas',read:residual(216,25,27,29,37)}
 ]},
 {id:'defense',label:'Savunma',metrics:[
  metric('tacklesWon','Başarılı müdahale',[0]),metric('tacklesLost','Başarısız müdahale',[1]),rate('tackleRate','Müdahale başarısı',[0],[0,1]),metric('standing','Ayakta başarılı müdahale',[229]),metric('sliding','Kayarak başarılı müdahale',[230]),metric('dangerous','Tehlikeli müdahale',[163]),metric('clean','Topa temiz müdahale',[164]),metric('interceptions','Top kesme',[6]),metric('dispossessions','Rakipten top alma',[158]),metric('blockedCrosses','Engellenen orta',[156]),metric('attackAerial','Hücum hava topu kazanma',[265]),metric('defenseAerial','Savunma hava topu kazanma',[266])
 ]},
 {id:'possession',label:'Top kaybı & kazanma',metrics:[
  metric('losses','Bölgesi belli top kaybı',[105,106,107]),metric('wins','Bölgesi belli top kazanma',[108,109,110]),
  ...[['Defans',105,108],['Orta saha',106,109],['Hücum',107,110]].flatMap(([label,lost,won])=>[metric('lost'+lost,label+' bölgesinde top kaybı',[lost]),metric('won'+won,label+' bölgesinde top kazanma',[won])]),
  rate('defenseLossShare','Kayıplarda defans bölgesi payı',[105],[105,106,107]),rate('attackWinShare','Kazanımlarda hücum bölgesi payı',[110],[108,109,110])
 ]},
 {id:'dribbling',label:'Dripling',metrics:[metric('dribbles','Tamamlanan dripling',[174]),metric('carried','Dribbles carried · araştırma etiketi',[97]),metric('skillBeat','Beceri hareketiyle geçiş',[38]),{id:'nonSkillBeat',label:'Beceri hareketi dışı geçiş',read:residual(112,38)}]},
 {id:'discipline',label:'Disiplin',metrics:[metric('fouls','Yapılan faul',[2,3]),metric('foulsWon','Alınan faul',[4]),metric('yellows','Sarı kart',[95,213]),metric('immediateYellow','Doğrudan sarı kart olayı',[95]),metric('delayedYellow','Avantaj sonrası sarı kart',[213]),metric('penalties','Yaptırılan penaltı',[94]),metric('cornersConceded','Verilen korner',[10]),metric('cornersAttempted','Kullanılan korner',[145]),{id:'yellowMatches',label:'Sarı kart görülen maç',read:e=>sum(95,213)(e)>0?1:0},{id:'penaltyMatches',label:'Penaltı yaptırılan maç',read:e=>sum(94)(e)>0?1:0}]},
 {id:'position',label:'Pozisyon & geri bildirim',metrics:[
  metric('outPosition','Pozisyon dışı geri bildirim',[219]),...Array.from({length:5},(_,i)=>metric('severity'+(i+1),'Pozisyon dışı · şiddet '+(i+1)+'/5',[99+i])),metric('severe','Şiddetli pozisyon dışı olay',[102,103]),rate('severeShare','Pozisyon dışı olaylarda şiddetli pay',[102,103],[219]),metric('goodPosition','Olumlu pozisyon geri bildirimi',[111]),
  ...[['useBall','Topu kullan',212],['pickPass','Pasını seç',207],['noOption','İyi seçenek yok',175],['goodOption','İyi seçenek seçildi',176],['bestOption','En iyi seçenek seçildi',177],['elsewhere','Başka yere pas vermeliydin',182],['chosePass','Pas vermeyi seçti',183]].map(([id,label,event])=>metric(id,label+' · geri bildirim',[event]))
 ]}
];
const namedValid=(row,e,key)=>{
 const checks={goals:[['goals',sum(214)(e)]],assists:[['assists',sum(11)(e)]],shots:[['shots',sum(217,218)(e)]]};
 const keys=key==='contributions'?['goals','assists']:key==='conversion'?['goals','shots']:[key];
 return keys.every(k=>(checks[k]||[]).every(([name,value])=>row[name]==null||row[name]===''||Number(row[name])===value));
};
export function deepMetric(rows,definition){
 let total=0,denominator=0,covered=0,inconsistent=0;const values=[];
 for(const row of rows){const e=playerEvents(row);if(!e)continue;
  const n=definition.read(e),d=definition.denominator?.(e);
  if(n===null||!Number.isFinite(n)||n<0||(definition.validate&&!namedValid(row,e,definition.validate))||(d!==undefined&&(!Number.isFinite(d)||d<0||n>d))){inconsistent++;continue;}
  covered++;total+=n;if(d!==undefined)denominator+=d;values.push(d===undefined?n:d>0?n/d*100:null);
 }
 const sorted=values.filter(n=>n!==null).sort((a,b)=>a-b);const average=sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null;
 const median=sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:null;
 const deviation=average===null?null:Math.sqrt(sorted.reduce((s,n)=>s+(n-average)**2,0)/sorted.length);
 return {total:covered?total:null,denominator:definition.denominator?(covered?denominator:null):null,perMatch:covered?total/covered:null,value:definition.denominator?(denominator>0?total/denominator*100:null):(covered?total:null),covered,available:rows.length,inconsistent,median,deviation};
}
export function comparisonSample(matches,leftName,rightName,{common=false,window='all',position='all',matchType='leagueMatch'}={}){
 // Legacy records came exclusively from the leagueMatch endpoint.
 const seen=new Set();const ordered=[...matches].sort((a,b)=>b.timestamp-a.timestamp).filter(m=>{if(seen.has(String(m.matchId)))return false;seen.add(String(m.matchId));return (m.matchType||'leagueMatch')===matchType;});
 const identities=name=>new Set(ordered.flatMap(m=>Object.entries(m.players?.['79638']||{}).filter(([,p])=>p.playername===name).map(([id])=>id)));
 const aIds=identities(leftName),bIds=identities(rightName);
 const rowsFor=(m,ids)=>Object.entries(m.players?.['79638']||{}).filter(([id,p])=>ids.has(id)&&(position==='all'||p.pos===position));
 let pool=ordered.filter(m=>{const a=rowsFor(m,aIds),b=rowsFor(m,bIds);return common?a.length>0&&b.length>0:a.length>0||b.length>0;});
 if(window!=='all')pool=pool.slice(0,Number(window));
 const extract=ids=>{const keys=new Set();return pool.flatMap(m=>rowsFor(m,ids).filter(([id])=>{const key=m.matchId+':'+id;if(keys.has(key))return false;keys.add(key);return true;}).map(([id,p])=>({...p,matchId:m.matchId,playerId:id,timestamp:m.timestamp})));};
 return {left:extract(aIds),right:extract(bIds),matches:pool,commonCount:pool.filter(m=>rowsFor(m,aIds).length&&rowsFor(m,bIds).length).length};
}
