import {CLUB_ID,uniqueMatches} from './club-model.mjs';
export function validateMatchFeed(value){
 if(!value||String(value.clubId)!==CLUB_ID||value.matchType!=='leagueMatch'||!Array.isArray(value.matches)||value.matches.length>10||!Number.isFinite(Date.parse(value.fetchedAt))||Date.parse(value.fetchedAt)>Date.now()+300000)throw Error('INVALID_MATCH_FEED');
 const matches=uniqueMatches(value.matches);
 if(matches.length!==value.matches.length||matches.some(m=>m.timestamp<=0||m.timestamp*1000>Date.now()+300000))throw Error('INVALID_MATCH_FEED');
 return {clubId:CLUB_ID,matchType:'leagueMatch',matches,fetchedAt:value.fetchedAt};
}
export function validateFeed(value){
 if(!value||String(value.club?.clubId)!==CLUB_ID||String(value.overall?.clubId)!==CLUB_ID||!Array.isArray(value.members)||!value.members.length||!value.members.every(p=>typeof p.name==='string')||!Array.isArray(value.matches)||!Number.isFinite(Date.parse(value.fetchedAt)))throw Error('INVALID_FEED');
 const matches=uniqueMatches(value.matches);
 if(matches.length!==value.matches.length||Date.parse(value.fetchedAt)>Date.now()+300000)throw Error('INVALID_FEED');
 return {club:value.club,overall:value.overall,members:value.members,matches,fetchedAt:value.fetchedAt,mode:'scheduled',source:'EA Clubs'};
}
