import {CLUB_ID,uniqueMatches} from './club-model.mjs';
export function validateFeed(value){
 if(!value||String(value.club?.clubId)!==CLUB_ID||String(value.overall?.clubId)!==CLUB_ID||!Array.isArray(value.members)||!value.members.length||!value.members.every(p=>typeof p.name==='string')||!Array.isArray(value.matches)||!Number.isFinite(Date.parse(value.fetchedAt)))throw Error('INVALID_FEED');
 const matches=uniqueMatches(value.matches);
 if(matches.length!==value.matches.length||Date.parse(value.fetchedAt)>Date.now()+300000)throw Error('INVALID_FEED');
 return {club:value.club,overall:value.overall,members:value.members,matches,fetchedAt:value.fetchedAt,mode:'scheduled',source:'EA Clubs'};
}
