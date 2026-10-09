import {validateResearch} from './research-context.mjs';
import {CLUB_ID,uniqueMatches} from './club-model.mjs';
export function validateMatchFeed(value){
 if(!value||String(value.clubId)!==CLUB_ID||value.matchType!=='leagueMatch'||!Array.isArray(value.matches)||value.matches.length>10||!Number.isFinite(Date.parse(value.fetchedAt))||Date.parse(value.fetchedAt)>Date.now()+300000)throw Error('INVALID_MATCH_FEED');
 const matches=uniqueMatches(value.matches);
 if(matches.length!==value.matches.length||matches.some(m=>m.timestamp<=0||m.timestamp*1000>Date.now()+300000))throw Error('INVALID_MATCH_FEED');
 const research=validateResearch(value.research);
 const clubSnapshot=research?clubSnapshotFromResearch(value.research):undefined;
 return { ...(clubSnapshot?{clubSnapshot}:{}),clubId:CLUB_ID,matchType:'leagueMatch',matches,fetchedAt:value.fetchedAt,...(validateResearch(value.research)?{research:validateResearch(value.research)}:{})};
}
export function validateFeed(value){
 if(!value||String(value.club?.clubId)!==CLUB_ID||String(value.overall?.clubId)!==CLUB_ID||!Array.isArray(value.members)||!value.members.length||!value.members.every(p=>typeof p.name==='string')||!Array.isArray(value.matches)||!Number.isFinite(Date.parse(value.fetchedAt)))throw Error('INVALID_FEED');
 const matches=uniqueMatches(value.matches);
 if(matches.length!==value.matches.length||Date.parse(value.fetchedAt)>Date.now()+300000)throw Error('INVALID_FEED');
 return {club:value.club,overall:value.overall,members:value.members,matches,fetchedAt:value.fetchedAt,mode:'scheduled',source:'EA Clubs',...(validateResearch(value.research)?{research:validateResearch(value.research)}:{})};
}

// Match collections already fetch these endpoints; promote only a complete,
// validated snapshot, before research's deliberately smaller member projection.
export function clubSnapshotFromResearch(research){
 try{
  if(!validateResearch(research))return undefined;
  for(const endpoint of ['allTimeLeaderboard/search','clubs/overallStats','members/stats'])if(!research.endpoints.some(e=>e.endpoint===endpoint&&e.status==='ok'))return undefined;
  const count=v=>(typeof v==='string'||typeof v==='number')&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0;
  for(const row of [research.allTime,research.overall]){
   if(!row||!['gamesPlayed','wins','losses','ties','goals','goalsAgainst'].every(k=>count(row[k])))return undefined;
   if(Number(row.gamesPlayed)!==Number(row.wins)+Number(row.losses)+Number(row.ties))return undefined;
  }
  for(const key of ['gamesPlayed','wins','losses','ties','goals','goalsAgainst'])if(Number(research.allTime[key])!==Number(research.overall[key]))return undefined;
  if(!Array.isArray(research.members)||!research.members.length||!research.members.every(p=>typeof p.proName==='string'&&typeof p.favoritePosition==='string'&&['gamesPlayed','goals','assists','passesMade','tacklesMade','manOfTheMatch','redCards'].every(k=>count(p[k]))))return undefined;
  const result=validateFeed({club:research.allTime,overall:research.overall,members:research.members,matches:[],fetchedAt:research.observedAt});
  return new TextEncoder().encode(JSON.stringify(result)).length<=96000?result:undefined;
 }catch{return undefined;}
}
