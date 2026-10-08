import test from 'node:test';
import assert from 'node:assert/strict';
// Actual UTC instants cover both Amsterdam offsets and DST transitions.
import {collectionSlot,dispatchCollection} from '../lib/collection-scheduler.mjs';
test('collection slots follow Amsterdam hours in summer and winter',()=>{
 for(const [stamp,expected] of [
  ['2026-10-08T18:59:00Z',false],['2026-10-08T19:00:00Z',true],
  ['2026-10-09T00:00:00Z',true],['2026-10-09T00:10:00Z',false],
  ['2026-10-09T05:00:00Z',true],['2026-10-09T05:10:00Z',false],
  ['2026-12-08T19:59:00Z',false],['2026-12-08T20:00:00Z',true],
  ['2026-12-09T01:00:00Z',true],['2026-12-09T01:10:00Z',false],
  ['2026-12-09T06:00:00Z',true],['2026-12-09T06:10:00Z',false],
  ['2026-03-29T01:00:00Z',false],['2026-10-25T00:00:00Z',true],
  ['2026-10-25T01:00:00Z',true],
 ])assert.equal(Boolean(collectionSlot(stamp)),expected,stamp);
 assert.equal(collectionSlot('invalid'),null);
});
test('dispatch is durable, deduplicated and retries failure without storing secrets',async()=>{
 const records=new Map();const storage={get:async key=>records.get(key),put:async(key,value)=>records.set(key,value)};
 let calls=0;const accepted=async()=>{calls++;return new Response(null,{status:204})};
 const first=await dispatchCollection(storage,'test-secret','2026-10-08T21:20:00Z',accepted);
 assert.equal(first.status,'accepted');
 assert.equal((await dispatchCollection(storage,'test-secret','2026-10-08T21:25:00Z',accepted)).duplicate,true);
 assert.equal(calls,1);
 const failed=await dispatchCollection(storage,'test-secret','2026-10-08T21:30:00Z',async()=>new Response(null,{status:403}));
 assert.equal(failed.code,'GITHUB_HTTP_403');
 assert.equal((await dispatchCollection(storage,'test-secret','2026-10-08T21:35:00Z',accepted)).status,'accepted');
 assert.equal(calls,2);
 assert.equal(JSON.stringify([...records.values()]).includes('test-secret'),false);
 assert.equal((await dispatchCollection(storage,null,'2026-10-08T21:40:00Z',accepted)).code,'MISSING_TOKEN');
 assert.equal((await dispatchCollection(storage,'test-secret','2026-10-09T08:00:00Z',accepted)).status,'outside-window');
});
