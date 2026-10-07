import snapshot from '../data/snapshot.json' with {type:'json'};
import {CLUB_ID,uniqueMatches,validDay,amsterdamDay} from './club-model.mjs';
type ClubData = {club:any;overall:any;members:any[];matches:any[];fetchedAt:string;mode:string;source:string;notice?:string};
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
   const get=async(path:string):Promise<any>=>{const r=await fetch('https://proclubs.ea.com/api/fc/'+path,{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('EA '+r.status);return r.json();};
   const [clubs,overall,members,matches]=await Promise.all([get('allTimeLeaderboard/search?platform=common-gen5&clubName=LEO%20XI'),get('clubs/overallStats?platform=common-gen5&clubIds='+CLUB_ID),get('members/stats?platform=common-gen5&clubId='+CLUB_ID),get('clubs/matches?platform=common-gen5&clubIds='+CLUB_ID+'&matchType=leagueMatch&maxResultCount=10')]);
   const club=Array.isArray(clubs)&&clubs.find((c:any)=>String(c.clubId)===CLUB_ID);
   if(!club||!overall?.[0]||String(overall[0].clubId)!==CLUB_ID||!Array.isArray(members?.members)||!members.members.length||!Array.isArray(matches))throw Error('EA yanıtı doğrulanamadı');
   const clean=uniqueMatches(matches);
   const data:ClubData={club,overall:overall[0],members:members.members,matches:clean,fetchedAt:new Date().toISOString(),mode:'live',source:'EA Clubs'};
   await this.state.storage.transaction(async(tx)=>{
    await tx.put('latest',{...data,matches:[]});await tx.put('recentMatchIds',clean.map((m:any)=>m.matchId));await tx.put('lastSyncAttempt',new Date().toISOString());await tx.delete('syncError');
    for(const match of clean)await tx.put('match:'+match.matchId,match);
   });return data;
  }catch{
   const notice='EA kaynağına ulaşılamadı. Son doğrulanmış kayıt gösteriliyor.';
   await this.state.storage.put({lastSyncAttempt:new Date().toISOString(),syncError:notice});
   return {...(await this.latestData()),mode:'snapshot',notice};
  }
 }
 async fetch(request:Request):Promise<Response>{
  await this.ready;const url=new URL(request.url);const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  if(url.pathname==='/internal/sync')return json(await this.sync());
  if(url.pathname==='/api/club'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const attempt=await this.state.storage.get<string>('lastSyncAttempt');
   if(!attempt||Date.now()-Date.parse(attempt)>120000)return json(await this.sync());
   const latest=await this.latestData();
   const error=await this.state.storage.get<string>('syncError');return json(error?{...latest,mode:'snapshot',notice:error}:latest);
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
