import {writeFile} from 'node:fs/promises';
import {CLUB_ID} from '../lib/club-model.mjs';
import {validateFeed,validateMatchFeed} from '../lib/club-feed.mjs';
const base='https://proclubs.ea.com/api/fc/';
async function get(path){
 const endpoint=path.split('?')[0];
 const response=await fetch(base+path,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
 if(!response.ok)throw Error(`EA ${endpoint}: HTTP ${response.status}`);
 return response.json();
}
// A failed or invalid response aborts the run before any published data changes.
const matchesOnly=process.argv.includes('--matches-only');
async function collect(){
 if(matchesOnly){const matches=await get('clubs/matches?platform=common-gen5&clubIds='+CLUB_ID+'&matchType=leagueMatch&maxResultCount=10');return validateMatchFeed({clubId:CLUB_ID,matchType:'leagueMatch',matches,fetchedAt:new Date().toISOString()});}
 const [clubs,overall,members,matches]=await Promise.all([
 get('allTimeLeaderboard/search?platform=common-gen5&clubName=LEO%20XI'),
 get('clubs/overallStats?platform=common-gen5&clubIds='+CLUB_ID),
 get('members/stats?platform=common-gen5&clubId='+CLUB_ID),
 get('clubs/matches?platform=common-gen5&clubIds='+CLUB_ID+'&matchType=leagueMatch&maxResultCount=10')
 ]);
 return validateFeed({club:Array.isArray(clubs)&&clubs.find(c=>String(c.clubId)===CLUB_ID),overall:overall?.[0],members:members?.members,matches,fetchedAt:new Date().toISOString()});
}
const data=await collect();
const filename=matchesOnly?'matches.json':'latest.json';
const content=JSON.stringify(data);
if(process.argv.includes('--local')){
 await writeFile('/tmp/leo-xi-'+filename,content+'\n');console.log('Validated EA data saved locally.');
}else{
 const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;
 if(!token||repo!=='sammkrt/Leo-XI')throw Error('Missing publisher configuration');
 async function github(path,method='GET',body,allowMissing=false){
  const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method,signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(allowMissing&&r.status===404)return null;
  if(!r.ok)throw Error(`GitHub publish: HTTP ${r.status}`);
  return r.json();
 }
 // The club-data branch is provisioned once; only this data file is updated.
 const previous=await github('contents/'+filename+'?ref=club-data','GET',undefined,true);
 await github('contents/'+filename,'PUT',{message:matchesOnly?'Update verified EA league matches':'Update verified EA club data',branch:'club-data',...(previous?{sha:previous.sha}:{}),content:Buffer.from(content+'\n').toString('base64')});
 console.log(`Published ${filename}: ${data.fetchedAt}; ${data.matches.length} verified recent matches.`);
}
