import {periodMatches,uniqueMatches,CLUB_ID} from './club-model.mjs';
import type {Match} from './club-types';
type Member={name:string;proName:string};
export function weeklyAttendanceRanking(matches:Match[],members:Member[],now=Date.now()){
 const week=periodMatches(uniqueMatches(matches),'week',now) as Match[];
 if(!week.length||!members.length)return [];
 const counts=new Map(members.map(m=>[m.name.trim().toLowerCase(),0]));let appearances=0;
 for(const match of week){const seen=new Set<string>();for(const player of Object.values(match.players?.[CLUB_ID]||{})){
  const name=player?.playername?.trim().toLowerCase();if(!name||!counts.has(name)||seen.has(name))continue;
  seen.add(name);counts.set(name,counts.get(name)!+1);appearances++;
 }}
 if(!appearances)return [];
 return members.map(player=>({...player,games:counts.get(player.name.trim().toLowerCase())!})).sort((a,b)=>a.games-b.games);
}

export function weeklyGhost(matches:Match[],members:Member[],now=Date.now()){
 const ranked=weeklyAttendanceRanking(matches,members,now);if(!ranked.length)return null;
 const games=ranked[0].games;return {games,players:members.filter(m=>ranked.some(p=>p.name===m.name&&p.games===games))};
}
