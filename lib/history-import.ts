import history from '../data/imports/fc27-history.json' with {type:'json'};
import {uniqueMatches} from './club-model.mjs';
import type {Match,MatchPlayer} from './club-types';
export const HISTORY_IMPORT_VERSION=history.version;
export const historicalMatches=history.matches as unknown as Match[];
/** Retain real EA IDs; resolve provisional historical identities when EA supplies them. */
export function reconcileHistoryIdentities(matches:Match[]):Match[]{
 const known=new Map<string,string>();
 for(const match of [...matches].sort((a,b)=>a.timestamp-b.timestamp))for(const [club,players] of Object.entries(match.players||{}))for(const [id,p]of Object.entries(players||{})){
  if(p?.playername&&!id.startsWith('historical:'))known.set(club+':'+p.playername.toLowerCase(),id);
 }
 return matches.map(match=>{
  if(!match.importSource)return match;
  let changed=false;const clubs:NonNullable<Match['players']>={};
  for(const [club,players]of Object.entries(match.players||{})){
   const rows:Record<string,MatchPlayer|undefined>={};
   for(const [id,p]of Object.entries(players||{})){
    const real=p?.playername&&id.startsWith('historical:')?known.get(club+':'+p.playername.toLowerCase()):undefined;
    const target=real||id;if(target!==id)changed=true;
    if(rows[target])throw Error('Historical player identity collision');rows[target]=p;
   }clubs[club]=rows;
  }
  return changed?{...match,players:clubs}:match;
 });
}
export async function importHistory(storage:Pick<DurableObjectStorage,'get'|'put'|'list'|'transaction'>):Promise<number>{
 if(await storage.get('historyImportVersion')===HISTORY_IMPORT_VERSION)return 0;
 if(uniqueMatches(historicalMatches).length!==historicalMatches.length||historicalMatches.some(m=>m.timestamp<=0||m.timestamp*1000>Date.now()+300000))throw Error('Invalid historical match bundle');
 return storage.transaction(async tx=>{
  const existing=await tx.list<Match>({prefix:'match:'});let added=0;
  const merged=reconcileHistoryIdentities([...existing.values(),...historicalMatches.filter(m=>!existing.has('match:'+m.matchId))]);
  for(const match of merged){const key='match:'+match.matchId;
   if(!existing.has(key)){await tx.put(key,match);added++;}
   else if(match!==existing.get(key))await tx.put(key,match);
  }
  await tx.put('historyImportVersion',HISTORY_IMPORT_VERSION);
  await tx.put('historyImport',{version:HISTORY_IMPORT_VERSION,sourceSha256:history.sourceSha256,added,total:merged.length,importedAt:new Date().toISOString()});
  return added;
 });
}
