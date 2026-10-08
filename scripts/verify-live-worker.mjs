import assert from 'node:assert/strict';

const base = 'https://leo-xi.samet-krt.workers.dev';
async function read(path, json = true) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  return json ? response.json() : response.text();
}
const archive = await read('/api/archive');
assert.equal(archive.persistent, true, 'Archive must use durable storage');
assert.ok(Array.isArray(archive.matches), 'Match archive missing');
assert.ok(Array.isArray(archive.awards), 'Award archive missing; old Worker may still be serving');
assert.ok(!archive.awardNotice, 'Award archive initialization/read failed');
const club = await read('/api/club');
assert.ok(Array.isArray(club.members), 'Club roster missing');
await read('/api/attendance');
const page = await read('/analiz/unvanlar?scope=last7', false);
assert.ok(page.includes('Takımın unvanları'), 'Titles screen missing');
console.log('Live Worker titles route and durable archive/club/attendance APIs verified.');
