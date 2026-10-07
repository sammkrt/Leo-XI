export const CLUB_ID = '79638';
export function clubMatch(match) {
 const ours=match.clubs?.[CLUB_ID];
 const opponent=Object.entries(match.clubs||{}).find(([id])=>id!==CLUB_ID)?.[1];
 if(!ours||!opponent)return null;
 return {ours,opponent,goals:Number(ours.goals)||0,conceded:Number(opponent.goals??ours.goalsAgainst)||0,result:Number(ours.wins)?'G':Number(ours.ties)?'B':'M'};
}
export function uniqueMatches(matches) {
 const byId=new Map();
 for(const match of matches){if(/^\d+$/.test(String(match?.matchId))&&Number.isFinite(match.timestamp)&&clubMatch(match))byId.set(String(match.matchId),match);}
 return [...byId.values()].sort((a,b)=>b.timestamp-a.timestamp);
}
export function periodMatches(matches,period,now=Date.now()) {
 const cutoff=period==='week'?now-7*86400000:period==='month'?now-30*86400000:0;
 return uniqueMatches(matches).filter(m=>m.timestamp*1000>=cutoff&&m.timestamp*1000<=now);
}
export function matchTotals(matches) {
 return matches.reduce((sum,m)=>{const c=clubMatch(m);if(!c)return sum;sum.games++;sum[c.result==='G'?'wins':c.result==='B'?'draws':'losses']++;sum.goals+=c.goals;sum.conceded+=c.conceded;return sum;},{games:0,wins:0,draws:0,losses:0,goals:0,conceded:0});
}
export function weeklyAward(matches,now=Date.now()) {
 const pool=new Map();
 for(const match of periodMatches(matches,'week',now))for(const [id,p] of Object.entries(match.players?.[CLUB_ID]||{})){
  const rating=Number(p.rating);if(!Number.isFinite(rating)||rating<=0)continue;
  const row=pool.get(id)||{id,name:p.playername,games:0,ratingSum:0,goals:0,assists:0,mom:0};
  row.games++;row.ratingSum+=rating;row.goals+=Number(p.goals)||0;row.assists+=Number(p.assists)||0;row.mom+=Number(p.mom)||0;pool.set(id,row);
 }
 const ranked=[...pool.values()].filter(p=>p.games>=3).map(p=>({...p,average:p.ratingSum/p.games})).sort((a,b)=>b.average-a.average||b.mom-a.mom||b.games-a.games||a.name.localeCompare(b.name));
 return ranked[0]||null;
}
export function playerRates(player) {
 const games=Number(player.gamesPlayed)||0;
 return {games,goals:games?Number(player.goals)/games:0,assists:games?Number(player.assists)/games:0,rating:Number(player.ratingAve)||0,passes:Number(player.passSuccessRate)||0,tackles:games?Number(player.tacklesMade)/games:0};
}
export function amsterdamDay(now=Date.now()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validDay(value,now=Date.now()) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const t=Date.parse(value+'T12:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value)return false;
 return value>=amsterdamDay(now-86400000)&&value<=amsterdamDay(now+31*86400000);
}
