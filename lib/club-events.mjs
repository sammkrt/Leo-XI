// Community research: https://github.com/Interactive-63/eafc-pro-clubs-api-research
// Only mappings classified as confirmed/high confidence are included.
export function playerEvents(player){
 const fields=Array.from({length:4},(_,i)=>player?.['match_event_aggregate_'+i]);
 if(!fields.some(v=>typeof v==='string'&&v.trim()))return null;
 const events=new Map();
 for(const field of fields){
  if(field==null||field==='')continue;
  if(typeof field!=='string')return null;
  for(const token of field.split(',')){
   const pair=token.trim().match(/^(\d+):(\d+)$/);if(!pair)return null;
   const id=Number(pair[1]),count=Number(pair[2]);if(!Number.isSafeInteger(id)||!Number.isSafeInteger(count))return null;
   const total=(events.get(id)||0)+count;if(!Number.isSafeInteger(total))return null;events.set(id,total);
  }
 }
 return events;
}
const event=(events,id)=>events.get(id)||0;
export function decodedPlayer(player){
 const e=playerEvents(player);if(!e)return null;
 const get=id=>event(e,id);
 const shots=get(217)+get(218);
 // Validate the mappings against the corresponding named EA fields, when present.
 for(const [key,value]of [['goals',get(214)],['assists',get(11)],['shots',shots]]){
  if(player[key]!=null&&player[key]!==''&&Number(player[key])!==value)return null;
 }
 return {completed:get(215),failed:get(216),directions:[[get(30),get(31)],[get(32),get(33)],[get(34),get(35)]],lengths:[[get(24),get(25)],[get(26),get(27)],[get(28),get(29)],[get(36),get(37)]],shots,onTarget:get(217),dribbles:get(174),interceptions:get(6),secondAssists:get(115),outOfPosition:get(219),won:[get(108),get(109),get(110)],lost:[get(105),get(106),get(107)]};
}
export function eventSummary(matches,teamId='79638',playerId='all'){
 const total={appearances:0,covered:0,matches:0,completed:0,failed:0,directions:[[0,0],[0,0],[0,0]],lengths:[[0,0],[0,0],[0,0],[0,0]],shots:0,onTarget:0,dribbles:0,interceptions:0,secondAssists:0,outOfPosition:0,won:[0,0,0],lost:[0,0,0]};
 for(const match of matches){let included=false;for(const [id,player]of Object.entries(match.players?.[teamId]||{})){
  if(playerId!=='all'&&id!==playerId)continue;total.appearances++;const row=decodedPlayer(player);if(!row)continue;
  included=true;total.covered++;
  for(const key of ['completed','failed','shots','onTarget','dribbles','interceptions','secondAssists','outOfPosition'])total[key]+=row[key];
  for(const key of ['directions','lengths'])row[key].forEach((pair,i)=>pair.forEach((n,j)=>total[key][i][j]+=n));
  for(const key of ['won','lost'])row[key].forEach((n,i)=>total[key][i]+=n);
 }if(included)total.matches++;}
 const remaining=pairs=>[0,1].map(index=>{const n=total[index===0?'completed':'failed']-pairs.reduce((sum,p)=>sum+p[index],0);return n<0?null:n});
 return {...total,directionOther:remaining(total.directions),lengthOther:remaining(total.lengths)};
}
