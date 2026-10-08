import assert from 'node:assert/strict';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;
assert.ok(GITHUB_TOKEN && GITHUB_REPOSITORY && GITHUB_SHA, 'GitHub build verification context missing');
const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/check-runs?per_page=100`;
for (let attempt = 0; attempt < 50; attempt++) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, `Cannot read Cloudflare build check: HTTP ${response.status}`);
  const { check_runs: checks } = await response.json();
  const build = checks
    .filter(check => check.name === 'Workers Builds: leo-xi' && check.app?.slug === 'cloudflare-workers-and-pages')
    .sort((a, b) => b.id - a.id)[0];
  if (build?.status === 'completed') {
    assert.equal(build.conclusion, 'success', `Cloudflare deployment failed: ${build.conclusion}; ${build.details_url}`);
    console.log(`Cloudflare Workers Builds deployed ${GITHUB_SHA}: ${build.details_url}`);
    process.exit(0);
  }
  console.log(`Waiting for Cloudflare Workers Builds on ${GITHUB_SHA}: ${build?.status || 'not registered'}`);
  await new Promise(resolve => setTimeout(resolve, 20000));
}
throw new Error('Cloudflare build did not complete within the verification window; check the existing main Git deployment connection.');
