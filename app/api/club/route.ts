import snapshot from '../../../data/snapshot.json';
export async function GET() {
 try {
 const base='https://proclubs.ea.com/api/fc/';
 const get=async(path:string):Promise<any>=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('EA '+r.status);return r.json();};
 const [club,overall,members,matches]=await Promise.all([
 get('allTimeLeaderboard/search?platform=common-gen5&clubName=LEO%20XI'),get('clubs/overallStats?platform=common-gen5&clubIds=79638'),get('members/stats?platform=common-gen5&clubId=79638'),get('clubs/matches?platform=common-gen5&clubIds=79638&matchType=leagueMatch&maxResultCount=10')]);
 const selected=club.find((c:{clubId:string})=>String(c.clubId)==='79638');
 if(!selected||!overall[0]||!Array.isArray(members.members)||!Array.isArray(matches))throw Error('Invalid EA response');
 return Response.json({club:selected,overall:overall[0],members:members.members,matches,fetchedAt:new Date().toISOString(),source:'EA Clubs',mode:'live'},{headers:{'Cache-Control':'public, max-age=120'}});
 }catch{return Response.json({...snapshot,mode:'snapshot',notice:'EA kaynağına şu an ulaşılamıyor. Son doğrulanmış kayıt gösteriliyor.'},{headers:{'Cache-Control':'no-store'}});}
}
