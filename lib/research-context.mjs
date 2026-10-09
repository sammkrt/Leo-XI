// Boundary for optional public EA enrichment. Invalid enrichment cannot discard matches.
export function finiteCount(v){if(v===null||v===undefined||v===''||typeof v==='boolean')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;}
const endpoints=new Set(['clubs/matches','clubs/info','clubs/overallStats','members/stats','members/career/stats','allTimeLeaderboard/search','currentSeasonLeaderboard/search','club/playoffAchievements']);
export function validateResearch(value){
 if(!value||value.version!==1||!Number.isFinite(Date.parse(value.observedAt))||Date.parse(value.observedAt)>Date.now()+300000||!Array.isArray(value.endpoints)||!Array.isArray(value.ratings))return undefined;
 const ratings=value.ratings.filter(r=>r&&/^\d+$/.test(String(r.clubId))&&finiteCount(r.skillRating)!==null&&Number.isFinite(Date.parse(r.observedAt))&&Date.parse(r.observedAt)<=Date.parse(value.observedAt)).slice(0,11).map(r=>({clubId:String(r.clubId),name:String(r.name||r.clubId).slice(0,120),skillRating:Number(r.skillRating),observedAt:r.observedAt,source:'clubs/overallStats'}));
 const clean={version:/** @type {1} */ (1),observedAt:value.observedAt,ratings,endpoints:value.endpoints.filter(e=>e&&endpoints.has(e.endpoint)&&['ok','empty','error'].includes(e.status)).map(e=>({endpoint:e.endpoint,status:e.status,observedAt:value.observedAt}))};
 for(const key of ['info','overall','season','allTime'])if(value[key]&&typeof value[key]==='object'&&!Array.isArray(value[key])&&String(value[key].clubId)==='79638')clean[key]=value[key];
 for(const key of ['members','career'])if(Array.isArray(value[key]))clean[key]=value[key].filter(p=>p&&typeof p.name==='string').slice(0,100).map(p=>Object.fromEntries(['name','gamesPlayed','goals','assists','ratingAve','favoritePosition'].filter(k=>typeof p[k]==='string'||typeof p[k]==='number').map(k=>[k,p[k]])));
 if(Array.isArray(value.playoffs))clean.playoffs=value.playoffs.slice(0,30);
 // Enrichment stays below a Durable Object value limit, even if an endpoint grows unexpectedly.
 return new TextEncoder().encode(JSON.stringify(clean)).length<=96000?clean:undefined;
}
export function ratingBefore(ratings,clubId,time){
 return ratings.filter(r=>r.clubId===clubId&&finiteCount(r.skillRating)!==null&&Date.parse(r.observedAt)/1000<time&&time-Date.parse(r.observedAt)/1000<=7*86400).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0]||null;
}
