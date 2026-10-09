import {periodMatches,uniqueMatches,CLUB_ID} from './club-model.mjs';
import type {Match} from './club-types';
type Member={name:string;proName:string};
export function weeklyGhost(matches:Match[],members:Member[],now=Date.now()){
 const week=periodMatches(uniqueMatches(matches),'week',now) as Match[];
 if(!week.length||!members.length)return null;
 const counts=new Map(members.map(m=>[m.name.trim().toLowerCase(),0]));let appearances=0;
 for(const match of week){const seen=new Set<string>();for(const player of Object.values(match.players?.[CLUB_ID]||{})){
  const name=player?.playername?.trim().toLowerCase();if(!name||!counts.has(name)||seen.has(name))continue;
  seen.add(name);counts.set(name,counts.get(name)!+1);appearances++;
 }}
 if(!appearances)return null;
 const games=Math.min(...counts.values());return {games,players:members.filter(m=>counts.get(m.name.trim().toLowerCase())===games)};
}
