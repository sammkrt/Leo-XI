import snapshot from '../data/snapshot.json' with {type:'json'};
import {uniqueMatches,validDay,amsterdamDay} from './club-model.mjs';
import {validateFeed} from './club-feed.mjs';
type ClubData = {club:any;overall:any;members:any[];matches:any[];fetchedAt:string;mode:string;source:string;notice?:string;syncFailure?:{code:string;endpoint?:string;at:string}};
class SyncFailure extends Error {
 code:string;endpoint?:string;
 constructor(code:string,endpoint?:string){super(code);this.code=code;this.endpoint=endpoint}
}
type Attendance={player:string;status:'yes'|'maybe'|'no';updatedAt:string};
export class ClubStore {
 state:DurableObjectState;
 ready:Promise<void>;
 syncing:Promise<ClubData>|null=null;
 constructor(state:DurableObjectState){
  this.state=state;
  this.ready=state.blockConcurrencyWhile(async()=>{
   if(!await state.storage.get('seeded')){
    const records:Record<string,unknown>={seeded:true,startedAt:new Date().toISOString(),latest:{...snapshot,matches:[]},recentMatchIds:snapshot.matches.map(m=>m.matchId)};
    for(const match of uniqueMatches(snapshot.matches))records['match:'+match.matchId]=match;
    await state.storage.put(records);
   }
  });
 }
 async latestData():Promise<ClubData>{
  const latest=(await this.state.storage.get<ClubData>('latest'))||{...snapshot,matches:[]};
  const ids=await this.state.storage.get<string[]>('recentMatchIds')||[];
  const matches=[];for(const id of ids){const m=await this.state.storage.get<any>('match:'+id);if(m)matches.push(m)}
  return {...latest,matches:uniqueMatches(matches)};
 }
 async sync():Promise<ClubData>{
  if(this.syncing)return this.syncing;
  this.syncing=this.syncInternal().finally(()=>{this.syncing=null});return this.syncing;
 }
 async syncInternal():Promise<ClubData>{
  try{
   let response:Response;
   try{response=await fetch('https://raw.githubusercontent.com/sammkrt/Leo-XI/club-data/latest.json',{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json','Cache-Control':'no-cache'}})}catch(error){throw new SyncFailure(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'FEED_TIMEOUT':'FEED_NETWORK')}
   if(!response.ok)throw new SyncFailure('FEED_HTTP_'+response.status);
   let data:ClubData;try{data=validateFeed(await response.json())}catch{throw new SyncFailure('FEED_INVALID_DATA')}
   const clean=data.matches;
   const current=await this.latestData();
   if(Date.parse(data.fetchedAt)<Date.parse(current.fetchedAt))throw new SyncFailure('FEED_OLDER_DATA');
   await this.state.storage.transaction(async(tx)=>{
    await tx.put('latest',{...data,matches:[]});await tx.put('recentMatchIds',clean.map((m:any)=>m.matchId));await tx.put('lastSyncAttempt',new Date().toISOString());await tx.delete('syncError');await tx.delete('syncFailure');
    for(const match of clean)await tx.put('match:'+match.matchId,match);
   });return data;
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
  if(url.pathname==='/api/club'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const latest=await this.latestData();
   const error=await this.state.storage.get<string>('syncError');const stale=Date.now()-Date.parse(latest.fetchedAt)>36*60*60*1000;
   return json(error?{...latest,mode:'snapshot',notice:error,syncFailure:await this.state.storage.get('syncFailure')}:stale?{...latest,notice:'Günlük veri kaydı 36 saati aştı. Yeni veri alınamamış olabilir; son doğrulanmış kayıt gösteriliyor.'}:latest);
  }
  if(url.pathname==='/api/archive'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const records=await this.state.storage.list<any>({prefix:'match:'});
   return json({matches:uniqueMatches([...records.values()]),startedAt:await this.state.storage.get('startedAt'),lastSync:await this.state.storage.get('lastSyncAttempt'),notice:await this.state.storage.get('syncError')||null,persistent:true});
  }
  if(url.pathname==='/api/attendance'){
   const day=url.searchParams.get('date')||amsterdamDay();if(!validDay(day))return json({error:'Geçerli bir tarih seç.'},400);
   const prefix='attendance:'+day+':';
   if(request.method==='POST'){
    const length=Number(request.headers.get('Content-Length')||0);if(length>4096)return json({error:'İstek çok büyük.'},413);
    let body:any;try{const raw=await request.text();if(raw.length>4096)return json({error:'İstek çok büyük.'},413);body=JSON.parse(raw)}catch{return json({error:'Geçersiz istek.'},400)}
    const latest=await this.state.storage.get<ClubData>('latest');
    if(!body||typeof body!=='object'||!['yes','maybe','no'].includes(body.status)||typeof body.player!=='string'||!(latest||snapshot).members.some((p:any)=>p.name===body.player))return json({error:'Kadrodan oyuncu ve katılım durumu seç.'},400);
    const entry:Attendance={player:body.player,status:body.status,updatedAt:new Date().toISOString()};
    await this.state.storage.put(prefix+encodeURIComponent(body.player),entry);
   }else if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const list=await this.state.storage.list<Attendance>({prefix});return json({date:day,entries:[...list.values()],persistent:true});
  }
  return json({error:'Not found'},404);
 }
}
