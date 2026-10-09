import type {ResearchContext,RatingSnapshot} from './research-types';
import snapshot from '../data/snapshot.json' with {type:'json'};
import {uniqueMatches,validDay,amsterdamDay} from './club-model.mjs';
import {validateFeed,validateMatchFeed} from './club-feed.mjs';
import {dispatchCollection} from './collection-scheduler.mjs';
import type {ClubData,Match,MatchFeed} from './club-types';
import {AWARD_VERSION,awardSnapshots,awardCalendarWeek} from './derived-awards.ts';
import type {AwardSnapshot,AwardMember} from './derived-awards.ts';
class SyncFailure extends Error {
 code:string;endpoint?:string;
 constructor(code:string,endpoint?:string){super(code);this.code=code;this.endpoint=endpoint}
}
type StoredAward={week:string;version:string;chunks:string[]};
type Attendance={player:string;status:'yes'|'maybe'|'no';updatedAt:string};
export class ClubStore {
 state:DurableObjectState;
 ready:Promise<void>;
 syncing:Promise<ClubData>|null=null;
 awardNotice="";
 constructor(state:DurableObjectState){
  this.state=state;
  this.ready=state.blockConcurrencyWhile(async()=>{
   if(!await state.storage.get('seeded')){
    const records:Record<string,unknown>={seeded:true,startedAt:new Date().toISOString(),latest:{...snapshot,matches:[]},recentMatchIds:snapshot.matches.map(m=>m.matchId)};
    for(const match of uniqueMatches(snapshot.matches))records['match:'+match.matchId]=match;
    await state.storage.put(records);
   }
   if(await state.storage.get('awardVersion')!==AWARD_VERSION){
    try{
    const records=await state.storage.list<Match>({prefix:'match:'});
    const latest=await this.latestData();
    await state.storage.transaction(async tx=>{
     await this.refreshAwards(tx,[...records.values()],latest.members,await state.storage.get<string>('lastMatchUpdate')||latest.fetchedAt);
     await tx.put('awardVersion',AWARD_VERSION);
    });
    }catch{
     this.awardNotice='Unvan arşivi hazırlanamadı; mevcut maç ve katılım kayıtları korunuyor.';
    }
   }
  });
 }
 async readAwards(storage:Pick<DurableObjectStorage,'list'|'get'>):Promise<AwardSnapshot[]>{
  const records=await storage.list<StoredAward|AwardSnapshot>({prefix:'award:'});
  const awards:AwardSnapshot[]=[];
  for(const record of records.values()){
   if(!('chunks' in record)){awards.push(record);continue;}
   const parts=await Promise.all(record.chunks.map(key=>storage.get<string>(key)));
   if(parts.some(part=>part===undefined))throw Error('Incomplete award snapshot');
   awards.push(JSON.parse(parts.join('')) as AwardSnapshot);
  }
  // Calendar completion is presentation metadata; stored calculations/as-of stay intact even during feed failure.
  const week=awardCalendarWeek();
  return awards.map(record=>({...record,report:{...record.report,provisional:record.week===week}}));
 }
 async refreshAwards(storage:Pick<DurableObjectStorage,'list'|'get'|'put'|'delete'>,matches:Match[],members:AwardMember[],asOf:string){
  const old=await this.readAwards(storage);
  for(const record of await awardSnapshots(matches,members,old,asOf)){
   // Bounded chunks keep growing revision histories below the SQLite key/value size limit.
   const text=JSON.stringify(record),key='award:'+record.version+':'+record.week;
   const previous=await storage.get<StoredAward|AwardSnapshot>(key),chunks:string[]=[];
   for(let i=0;i<text.length;i+=24000){
    const chunkKey='award-chunk:'+record.version+':'+record.week+':'+chunks.length;
    await storage.put(chunkKey,text.slice(i,i+24000));chunks.push(chunkKey);
   }
   if(previous&&'chunks' in previous)for(const stale of previous.chunks.filter(k=>!chunks.includes(k)))await storage.delete(stale);
   await storage.put(key,{week:record.week,version:record.version,chunks} satisfies StoredAward);
  }
 }
 async latestData():Promise<ClubData>{
  const latest=(await this.state.storage.get<ClubData>('latest'))||{...snapshot,matches:[]};
  const ids=await this.state.storage.get<string[]>('recentMatchIds')||[];
  const matches=[];for(const id of ids){const m=await this.state.storage.get<Match>('match:'+id);if(m)matches.push(m)}
  const research=await this.state.storage.get<ResearchContext>('research');
  return {...latest,...(research?{research}:{}),matches:uniqueMatches(matches)};
 }
 async sync():Promise<ClubData>{
  if(this.syncing)return this.syncing;
  this.syncing=this.syncInternal().finally(()=>{this.syncing=null});return this.syncing;
 }
 async syncInternal():Promise<ClubData>{
  try{
   let response:Response;let legacy=false;
   const read=(filename:string)=>fetch('https://raw.githubusercontent.com/sammkrt/Leo-XI/club-data/'+filename,{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json','Cache-Control':'no-cache'}});
   try{response=await read('matches.json');if(response.status===404){legacy=true;response=await read('latest.json')}}catch(error){throw new SyncFailure(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'FEED_TIMEOUT':'FEED_NETWORK')}
   if(!response.ok)throw new SyncFailure('FEED_HTTP_'+response.status);
   let data:ClubData|MatchFeed;try{data=legacy?validateFeed(await response.json()):validateMatchFeed(await response.json())}catch{throw new SyncFailure('FEED_INVALID_DATA')}
   const clean=data.matches;
   const current=await this.latestData();
   const matchTime=await this.state.storage.get<string>('lastMatchUpdate')||current.fetchedAt;
   if(Date.parse(data.fetchedAt)<Date.parse(matchTime))throw new SyncFailure('FEED_OLDER_DATA');
   const candidate=legacy?data as ClubData:(data as MatchFeed).clubSnapshot;
   const totals=candidate&&Date.parse(candidate.fetchedAt)>=Date.parse(current.fetchedAt)?candidate:null;
   await this.state.storage.transaction(async(tx)=>{
    if(data.research){await tx.put('research',data.research);for(const rating of data.research.ratings)await tx.put('rating:'+rating.clubId+':'+rating.observedAt,rating);}
    if(totals)await tx.put('latest',{...totals,club:{...current.club,...totals.club},matches:[]});
    await tx.put('lastMatchUpdate',data.fetchedAt);await tx.put('recentMatchIds',clean.map(m=>m.matchId));await tx.put('lastSyncAttempt',new Date().toISOString());await tx.delete('syncError');await tx.delete('syncFailure');
    for(const match of clean)await tx.put('match:'+match.matchId,match);
    const archive=await tx.list<Match>({prefix:'match:'});
    await this.refreshAwards(tx,[...archive.values()],totals?.members||current.members,data.fetchedAt);
    await tx.put('awardVersion',AWARD_VERSION);
   });this.awardNotice='';return legacy?data as ClubData:{...(await this.latestData()),mode:'scheduled'};
  }catch(error){
   const failure={code:error instanceof SyncFailure?error.code:'STORAGE_WRITE_FAILED',endpoint:error instanceof SyncFailure?error.endpoint:undefined,at:new Date().toISOString()};
   console.error('LEO XI sync failed',JSON.stringify(failure));
   const reason=failure.code==='STORAGE_WRITE_FAILED'?'Yeni veriler kaydedilemedi.':'Otomatik veri kaynağı şu anda okunamıyor.';
   const notice=reason+' Son doğrulanmış kayıt gösteriliyor.';
   await this.state.storage.put({lastSyncAttempt:failure.at,syncError:notice,syncFailure:failure});
   return {...(await this.latestData()),mode:'snapshot',notice,syncFailure:failure};
  }
 }
 async fetch(request:Request):Promise<Response>{
  await this.ready;const url=new URL(request.url);const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  if(url.pathname==='/internal/sync')return json(await this.sync());
  if(url.pathname==='/internal/collect'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   const {scheduledTime}=await request.json() as {scheduledTime:number};
   const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
   const result=await this.state.blockConcurrencyWhile(()=>dispatchCollection(this.state.storage,token,scheduledTime));
   if(result.status==='failed')console.error('LEO XI collection dispatch failed',JSON.stringify(result));
   return json(result,result.status==='failed'?502:200);
  }
  if(url.pathname==='/api/club'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const latest=await this.latestData();
   const error=await this.state.storage.get<string>('syncError');const stale=Date.now()-Date.parse(latest.fetchedAt)>36*60*60*1000;
   return json(error?{...latest,mode:'snapshot',notice:error,syncFailure:await this.state.storage.get('syncFailure')}:stale?{...latest,notice:'Takım ve kadro toplamlarının kaydı 36 saati aştı. Maç arşivi ayrı güncellenir; son doğrulanmış toplamlar gösteriliyor.'}:latest);
  }
  if(url.pathname==='/api/archive'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const records=await this.state.storage.list<Match>({prefix:'match:'});
   let awards:AwardSnapshot[]=[],awardNotice=this.awardNotice;
   try{awards=await this.readAwards(this.state.storage)}catch{awardNotice='Unvan arşivi okunamadı; maç arşivi gösterilmeye devam ediyor.';}
   const lastMatchUpdate=await this.state.storage.get<string>('lastMatchUpdate')||(await this.latestData()).fetchedAt;
   const error=await this.state.storage.get('syncError');const stale=Date.now()-Date.parse(lastMatchUpdate)>36*60*60*1000;
   const ratingRecords=await this.state.storage.list<RatingSnapshot>({prefix:'rating:'});
   return json({ratings:[...ratingRecords.values()],matches:uniqueMatches([...records.values()]),awards:awards.sort((a,b)=>b.week.localeCompare(a.week)),awardNotice:awardNotice||undefined,startedAt:await this.state.storage.get('startedAt'),lastSync:await this.state.storage.get('lastSyncAttempt'),lastMatchUpdate,collectionSchedule:await this.state.storage.get('collectionDispatch'),notice:error||(stale?'Yeni maç verisi 36 saattir alınamadı. Önceki maçlar korunuyor.':null),persistent:true});
  }
  if(url.pathname==='/api/attendance'){
   const day=url.searchParams.get('date')||amsterdamDay();if(!validDay(day))return json({error:'Geçerli bir tarih seç.'},400);
   const prefix='attendance:'+day+':';
   if(request.method==='POST'){
    const length=Number(request.headers.get('Content-Length')||0);if(length>4096)return json({error:'İstek çok büyük.'},413);
    let body:unknown;try{const raw=await request.text();if(raw.length>4096)return json({error:'İstek çok büyük.'},413);body=JSON.parse(raw)}catch{return json({error:'Geçersiz istek.'},400)}
    const latest=await this.state.storage.get<ClubData>('latest');
    if(!body||typeof body!=='object'||!('status' in body)||!(body.status==='yes'||body.status==='maybe'||body.status==='no')||!('player' in body)||typeof body.player!=='string'||!(latest||snapshot).members.some(p=>p.name===body.player))return json({error:'Kadrodan oyuncu ve katılım durumu seç.'},400);
    const entry:Attendance={player:body.player,status:body.status,updatedAt:new Date().toISOString()};
    await this.state.storage.put(prefix+encodeURIComponent(body.player),entry);
   }else if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const list=await this.state.storage.list<Attendance>({prefix});return json({date:day,entries:[...list.values()],persistent:true});
  }
  return json({error:'Not found'},404);
 }
}
