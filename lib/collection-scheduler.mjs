// Cloudflare ticks every five minutes. Each ten-minute Amsterdam slot is
// dispatched once; its second tick can retry a rejected GitHub request.
export function collectionSlot(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const minute = Number(parts.find(p => p.type === 'minute').value);
  if (!(hour >= 21 || hour < 2 || ((hour === 2 || hour === 7) && minute < 10))) return null;
  return new Date(Math.floor(date.getTime() / 600000) * 600000).toISOString();
}

// Caller serializes this operation through Durable Object blockConcurrencyWhile.
export async function dispatchCollection(storage, token, timestamp, request = fetch) {
  const slot = collectionSlot(timestamp);
  if (!slot) return { status: 'outside-window' };
  const previous = await storage.get('collectionDispatch');
  if (previous?.status === 'accepted' && previous.slot >= slot) return { ...previous, duplicate: true };
  const record = { slot, attemptedAt: new Date().toISOString(), status: 'failed', code: 'MISSING_TOKEN' };
  if (token) {
    try {
      const response = await request('https://api.github.com/repos/sammkrt/Leo-XI/actions/workflows/update-club-data.yml/dispatches', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json', 'User-Agent': 'leo-xi-cloudflare',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      });
      record.code = 'GITHUB_HTTP_' + response.status;
      if (response.status === 204) record.status = 'accepted';
      await response.arrayBuffer();
    } catch {
      record.code = 'GITHUB_NETWORK_OR_TIMEOUT';
    }
  }
  await storage.put('collectionDispatch', record);
  return record;
}
