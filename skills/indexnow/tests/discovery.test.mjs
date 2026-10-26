/* Discovery fixtures use invented domains and an injected fetcher, never a live site. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createState, applyEvent } from '../scripts/model.mjs';
import { parseSitemap, parsePage, parseRobots, robotsAllowed, makeDiscoverer } from '../scripts/discovery.mjs';

test('sitemap parsing handles namespaces, CDATA, entities, alternates, and image loc exclusions', () => {
  const xml = `<?xml version="1.0"?><sm:urlset xmlns:sm="urn:sitemap" xmlns:image="urn:image" xmlns:xhtml="urn:xhtml"><sm:url><sm:loc><![CDATA[https://example.com/pricing?a=1&b=2]]></sm:loc><image:image><image:loc>https://example.com/photo.jpg</image:loc></image:image><xhtml:link hreflang="pl" href="https://example.com/pl/cennik" /></sm:url><sm:url><sm:loc>https://example.com/search?a=1&amp;b=2</sm:loc></sm:url></sm:urlset>`;
  const parsed = parseSitemap(xml, 'https://example.com');
  assert.deepEqual(parsed.urls, ['https://example.com/pricing?a=1&b=2', 'https://example.com/search?a=1&b=2']);
  assert.deepEqual(parsed.entries.map((e) => e.lastmod), [null, null]);
  const dated = parseSitemap('<urlset><url><loc>https://example.com/a</loc><lastmod>2026-01-02</lastmod></url><url><lastmod>not a date</lastmod><loc>https://example.com/b</loc></url></urlset>', 'https://example.com');
  assert.deepEqual(dated.entries, [{ url: 'https://example.com/a', lastmod: '2026-01-02T00:00:00.000Z' }, { url: 'https://example.com/b', lastmod: null }]);
  assert.deepEqual(parsed.alternates, [{ url: 'https://example.com/pl/cennik', language: 'pl' }]);
  assert.throws(() => parseSitemap('<!DOCTYPE x><urlset/>'), /DTDs/);
  assert.throws(() => parseSitemap('<html>error</html>'), /sitemap/);
});

test('HTML checks indexability and hashes main content while ignoring navigation, scripts, and timestamps', () => {
  const html = (nav, price) => `<html lang="en"><head><title>Pricing</title><link rel="canonical" href="/pricing"><link rel="alternate" hreflang="pl" href="/pl/cennik"></head><body><nav>${nav}</nav><main><h1>Plans</h1><p>${price}</p><time>today</time></main><script>"<a href='/fake'>fake</a>"</script><a href="/about">About</a></body></html>`;
  const a = parsePage(html('Home', '$10'), 'https://example.com/pricing');
  const b = parsePage(html('Changed nav', '$10'), 'https://example.com/pricing');
  assert.equal(a.page.contentHash, b.page.contentHash);
  assert.notEqual(a.page.contentHash, parsePage(html('Home', '$20'), 'https://example.com/pricing').page.contentHash);
  assert.equal(a.page.language, 'en'); assert.equal(a.page.alternates[0].language, 'pl');
  assert.deepEqual(a.links, ['https://example.com/about']);
  assert.equal(parsePage('<meta name="robots" content="noindex">', 'https://example.com/').page.indexable, false);
  assert.match(parsePage('<link rel="canonical" href="/main">', 'https://example.com/alias').page.blockedReason, /canonical/);
});

test('robots groups respect specific agents, longest paths, allow ties, and every sitemap', () => {
  const robots = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/public\nSitemap: https://example.com/map-a.xml\nSitemap: https://example.com/map-b.xml\nUser-agent: Googlebot\nDisallow: /google-only');
  assert.equal(robots.sitemaps.length, 2);
  assert.equal(robotsAllowed(robots, 'https://example.com/private'), false);
  assert.equal(robotsAllowed(robots, 'https://example.com/private/public'), true);
  assert.equal(robotsAllowed(robots, 'https://example.com/private', 'Googlebot'), true);
  assert.equal(robotsAllowed(robots, 'https://example.com/google-only', 'Googlebot'), false);
});

test('nested and gzip sitemaps resume across batches without following cycles or leaving scope', async () => {
  const fixtures = {
    '/robots.txt': 'User-agent: *\nDisallow: /private\nSitemap: https://example.com/maps.xml',
    '/maps.xml': '<sitemapindex><sitemap><loc>https://example.com/child.xml.gz</loc></sitemap><sitemap><loc>https://example.com/maps.xml</loc></sitemap></sitemapindex>',
    '/child.xml.gz': gzipSync('<urlset><url><loc>https://example.com/pricing</loc></url></urlset>'),
    '/': '<html lang="en"><main>Home</main><a href="/private">Private</a><a href="https://outside.example/">Outside</a></html>',
    '/pricing': '<main>Plans</main>',
  };
  const requests = [];
  const discover = makeDiscoverer({ fetcher: async (url) => {
    requests.push(url); const path = new URL(url).pathname;
    return new Response(fixtures[path] ?? 'missing', { status: fixtures[path] ? 200 : 404, headers: { 'content-type': path.includes('xml') ? 'application/xml' : 'text/html' } });
  } });
  let s = createState('example.com'), n = 0;
  const send = (type, data) => { s = applyEvent(s, { seq: s.seq + 1, at: '2026-01-01T00:00:00Z', type, data }); };
  send('start', { id: 'r' });
  while (s.discovery.pending.length) {
    assert.ok(n++ < 15, 'cycle must terminate');
    const result = await discover(s, s.discovery.pending[0]); send('discovered', { runId: 'r', ...result });
    s = JSON.parse(JSON.stringify(s));
  }
  assert.ok(s.pages['https://example.com/pricing']);
  assert.equal(requests.some((x) => x.endsWith('/pricing')), false, 'sitemap pages are registered, not fetched');
  assert.equal(s.discovery.sitemapPages, 1);
  send('discovered', { runId: 'r', ...await discover(s, { url: 'https://example.com/pricing', kind: 'page' }) });
  assert.equal(s.pages['https://example.com/pricing'].httpStatus, 200);
  assert.equal(s.settings.primaryLanguage, 'en');
  assert.equal(s.discovery.failures.length, 0);
  assert.equal(requests.filter((x) => x.endsWith('/maps.xml')).length, 1);
  assert.equal(requests.some((x) => x.includes('outside') || x.includes('/private')), false);
});

test('robots and cross-site redirect failures are preserved as gaps', async () => {
  const state = createState('example.com');
  const failed = makeDiscoverer({ fetcher: async () => new Response('unavailable', { status: 503 }) });
  assert.match((await failed(state, { url: state.origin + '/', kind: 'page' })).error, /robots/);
  const redirect = makeDiscoverer({ fetcher: async (url) => url.endsWith('robots.txt') ? new Response('') : new Response('', { status: 302, headers: { location: 'https://outside.example/' } }) });
  assert.match((await redirect(state, { url: state.origin + '/', kind: 'page' })).error, /scope/);
});

test('new invocations refresh sitemap discovery before the seven-day page revisit interval', async () => {
  let second = false;
  const discover = makeDiscoverer({ fetcher: async (url) => {
    const path = new URL(url).pathname;
    const text = path === '/robots.txt' ? 'Sitemap: https://example.com/map.xml' : path === '/map.xml' ? `<urlset><url><loc>https://example.com/first</loc></url>${second ? '<url><loc>https://example.com/new-page</loc></url>' : ''}</urlset>` : '<main>Page</main>';
    return new Response(text, { headers: { 'content-type': path.endsWith('.xml') ? 'application/xml' : 'text/html' } });
  } });
  let s = createState('example.com'), at = '2026-01-01T00:00:00Z';
  const send = (type, data) => { s = applyEvent(s, { seq: s.seq + 1, at, type, data }); };
  const drain = async () => { while (s.discovery.pending.length) send('discovered', { runId: s.currentRun, ...await discover(s, s.discovery.pending[0]) }); };
  send('start', { id: 'r1' }); await drain();
  send('finish', { runId: 'r1', reason: 'interrupted' });
  second = true; at = '2026-01-02T00:00:00Z';
  send('start', { id: 'r2' }); await drain();
  assert.ok(s.pages['https://example.com/new-page']);
});
