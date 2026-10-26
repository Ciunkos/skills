/* Observable queue behavior, including quota discovery and delayed indexing evidence. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyEvent, queue, score, summary, normalizeUrl } from '../scripts/model.mjs';

const T = '2026-01-01T12:00:00.000Z', url = 'https://example.com/pricing';
const day = (n) => new Date(Date.parse(T) + n * 86_400_000).toISOString();
const fixture = () => {
  let s = createState('example.com');
  const send = (type, data = {}, at = T) => { s = applyEvent(s, { seq: s.seq + 1, type, data: { runId: s.currentRun, ...data }, at }); return s; };
  const start = (id = 'r1', at = T, dryRun = false) => send('start', { id, dryRun }, at);
  const inspect = (u = url, at = T, extra = {}) => send('inspect', { url: u, indexed: false, indexable: true, evidence: 'GSC: URL is not on Google; live test permits indexing', ...extra }, at);
  const begin = (id, u = url, at = T) => send('begin', { url: u, intentId: id }, at);
  const result = (id, outcome = 'accepted', u = url, at = T) => send('result', { url: u, intentId: id, outcome, evidence: `GSC visibly reports ${outcome}` }, at);
  start(); send('import', { items: [{ url }] });
  return { state: () => s, send, start, inspect, begin, result };
};

test('continues beyond ten acceptances, stops on actual quota, and tries again next invocation', () => {
  const f = fixture(), urls = Array.from({ length: 14 }, (_, i) => `https://example.com/page-${i}`);
  f.send('import', { items: urls.map((url) => ({ url })) });
  for (const [i, u] of urls.slice(0, 13).entries()) { f.inspect(u); f.begin(`i${i}`, u); f.result(`i${i}`, 'accepted', u); }
  assert.equal(f.state().runs[0].accepted.length, 13);
  f.inspect(urls[13]); f.begin('quota', urls[13]); f.result('quota', 'quota', urls[13]);
  assert.equal(f.state().runs[0].status, 'quota');
  assert.deepEqual(queue(f.state(), 'r1', T), []);
  assert.equal(f.state().pages[urls[13]].lifetimeAccepted, 0);
  f.start('r2'); f.inspect(urls[13]); f.begin('try-again', urls[13]); f.result('try-again', 'accepted', urls[13]);
  assert.equal(f.state().pages[urls[13]].lifetimeAccepted, 1);
});

test('retry intervals are 3, 7, then 14 days; third acceptance is not an immediate DLQ', () => {
  const f = fixture();
  f.inspect(); f.begin('a'); f.result('a');
  assert.equal(f.state().pages[url].cycle.nextActionAt, day(3));
  f.send('finish', { reason: 'interrupted' }); f.start('r2', day(2));
  assert.deepEqual(queue(f.state(), 'r2', day(2)), []);
  f.inspect(url, day(3)); f.begin('b', url, day(3)); f.result('b', 'accepted', url, day(3));
  assert.equal(f.state().pages[url].cycle.nextActionAt, day(10));
  f.send('finish', { reason: 'interrupted' }, day(3)); f.start('r3', day(10));
  f.inspect(url, day(10)); f.begin('c', url, day(10)); f.result('c', 'accepted', url, day(10));
  assert.equal(f.state().pages[url].cycle.status, 'pending');
  assert.equal(f.state().pages[url].cycle.nextActionAt, day(24));
  f.send('finish', { reason: 'interrupted' }, day(10)); f.start('r4', day(24));
  f.inspect(url, day(24), { indexed: null }); assert.equal(f.state().pages[url].cycle.status, 'pending');
  f.inspect(url, day(24)); assert.equal(f.state().pages[url].cycle.status, 'dlq');
  assert.equal(f.state().runs.at(-1).dlq.length, 1);
  assert.throws(() => f.begin('fourth', url, day(24)), /fresh inspection/);
  f.send('assess', { url, significant: true, revisionKey: 'rewrite-v2', reason: 'Added original pricing research', evidence: 'New comparison tables and customer examples' }, day(25));
  assert.equal(f.state().pages[url].cycle.accepted.length, 0);
  assert.equal(f.state().pages[url].lifetimeAccepted, 3);
  f.inspect(url, day(25)); f.begin('new-cycle', url, day(25));
});

test('an indexed page with a change hint waits for a newer crawl before marking refresh complete', () => {
  const f = fixture();
  f.send('hint', { id: 'h', text: 'Changed pricing page' });
  f.send('assess', { url, hintIds: ['h'], significant: true, revisionKey: 'hint:h', reason: 'User reports a pricing rewrite', evidence: 'Changed pricing page' });
  f.inspect(url, T, { indexed: true, lastCrawlAt: day(-2) });
  assert.equal(queue(f.state(), 'r1', T)[0].action, 'submit');
  f.begin('a'); f.result('a');
  assert.equal(f.state().pages[url].cycle.status, 'pending');
  f.inspect(url, day(1), { indexed: true, lastCrawlAt: day(1) });
  assert.equal(f.state().pages[url].cycle.status, 'complete');
  assert.equal(f.state().hints[0].resolvedAt, day(1));
  assert.deepEqual(queue(f.state(), 'r1', day(1)), []);
});

test('uncertain clicks survive interruption and cannot be blindly repeated; reconciliation is idempotent', () => {
  const f = fixture(); f.inspect(); f.begin('lost'); f.result('lost', 'uncertain');
  f.send('finish', { reason: 'interrupted' }); f.start('r2'); f.inspect();
  assert.deepEqual(queue(f.state(), 'r2', T), []);
  assert.throws(() => f.begin('duplicate'), /fresh inspection/);
  f.result('lost'); f.result('lost');
  assert.equal(f.state().pages[url].lifetimeAccepted, 1);
  assert.equal(f.state().runs[1].accepted[0].reconciledFrom, 'r1');
});

test('an uncertain result parks that URL while allowing other eligible pages in the same run', () => {
  const f = fixture(), other = 'https://example.com/about';
  f.send('import', { items: [{ url: other }] });
  f.inspect(); f.begin('uncertain');
  f.inspect(other);
  assert.throws(() => f.begin('too-early', other), /Record the current click outcome/);
  f.result('uncertain', 'uncertain');
  f.begin('next', other); f.result('next', 'accepted', other);
  assert.ok(f.state().pages[url].pending);
  assert.equal(f.state().pages[other].lifetimeAccepted, 1);
});

test('reconciled acceptance retains its original submission date and cooldown', () => {
  const f = fixture(); f.inspect(); f.begin('a'); f.result('a', 'uncertain');
  f.send('finish', { reason: 'interrupted' }); f.start('r2', day(5));
  f.result('a', 'accepted', url, day(5));
  assert.equal(f.state().pages[url].cycle.accepted[0].at, T);
  assert.equal(f.state().pages[url].cycle.accepted[0].observedAt, day(5));
  assert.equal(f.state().pages[url].cycle.nextActionAt, day(3));
});

test('fresh inspections, dry-run, blockers, and active runs are enforced', () => {
  const f = fixture();
  assert.throws(() => f.begin('early'), /fresh inspection/);
  assert.throws(() => f.start('overlap'), /active run/);
  f.inspect(url, T, { indexable: false, reason: 'noindex' });
  assert.deepEqual(queue(f.state(), 'r1', T), []);
  f.send('finish', { reason: 'interrupted' }); f.start('dry', T, true);
  f.inspect(); assert.equal(queue(f.state(), 'dry', T)[0].action, 'would_submit');
  assert.throws(() => f.begin('dry-click'), /fresh inspection/);
  f.send('preview', { url }); assert.deepEqual(queue(f.state(), 'dry', T), []);
  f.send('inspect', { url, indexed: false, indexable: true, googleCanonical: 'https://example.com/other', evidence: 'Google chose /other' });
  assert.match(f.state().pages[url].blockedReason, /canonical/);
});

test('score follows hints, business value, main language, aging, and canonical URL identity', () => {
  const f = fixture(), pl = 'https://example.com/pl/cennik';
  f.send('import', { items: [{ url: pl }] });
  f.send('configure', { primaryLanguage: 'en' });
  f.send('assess', { url, language: 'en', businessValue: 3, valueReason: 'Primary conversion page' });
  f.send('assess', { url: pl, language: 'pl', businessValue: 3, valueReason: 'Localized conversion page' });
  assert.equal(score(f.state(), f.state().pages[url], T).total - score(f.state(), f.state().pages[pl], T).total, 10);
  f.send('hint', { id: 'h', text: 'Polish pricing is a priority' });
  f.send('assess', { url: pl, hintIds: ['h'] });
  assert.equal(queue(f.state(), 'r1', T)[0].url, pl);
  assert.equal(score(f.state(), f.state().pages[url], day(500)).parts.waiting, 500);
  assert.equal(normalizeUrl('https://EXAMPLE.com/Pricing/?a=1#section'), 'https://example.com/Pricing/?a=1');
  assert.throws(() => f.send('import', { items: [{ url: 'https://outside.example/secret' }] }), /outside/);
});

test('unchanged assessment never resets attempts, and an already complete page is monitored later', () => {
  const f = fixture(); f.inspect(); f.begin('a'); f.result('a');
  f.send('assess', { url, significant: false });
  assert.equal(f.state().pages[url].cycle.accepted.length, 1);
  f.inspect(url, day(2), { indexed: true });
  f.send('finish', { reason: 'interrupted' }, day(2)); f.start('later', day(9));
  assert.equal(queue(f.state(), 'later', day(9))[0].action, 'inspect');
  f.inspect(url, day(9));
  assert.equal(f.state().pages[url].cycle.status, 'queued');
});

test('indexing success after three requests completes that cycle; later deindexing starts another', () => {
  const f = fixture();
  for (const [i, n] of [0, 3, 10].entries()) {
    if (i) { f.send('finish', { reason: 'interrupted' }, day(n)); f.start(`r${i + 1}`, day(n)); }
    f.inspect(url, day(n)); f.begin(`a${i}`, url, day(n)); f.result(`a${i}`, 'accepted', url, day(n));
  }
  f.inspect(url, day(24), { indexed: true });
  assert.equal(f.state().pages[url].cycle.status, 'complete');
  f.send('finish', { reason: 'interrupted' }, day(24)); f.start('later', day(31));
  f.inspect(url, day(31));
  assert.equal(f.state().pages[url].cycle.status, 'queued');
  assert.equal(f.state().pages[url].cycle.accepted.length, 0);
  assert.equal(f.state().pages[url].lifetimeAccepted, 3);
});

test('GSC Page indexing report seeds the queue: not indexed first, indexed and excluded pages skipped while fresh', () => {
  const f = fixture(), map = 'https://example.com/sitemap.xml';
  const pages = ['ignored', 'listed', 'alternate', 'missing'].map((x) => `https://example.com/${x}`);
  f.send('discovered', { task: { url: map, kind: 'sitemap' }, pages: pages.map((url) => ({ url, lastmod: null, source: map })), tasks: [] });
  f.send('report', { status: 'not_indexed', reason: 'Crawled - currently not indexed', reportedAt: day(-3), items: [{ url: pages[0], lastCrawlAt: day(-5) }] });
  f.send('report', { status: 'indexed', reportedAt: day(-3), items: [{ url: pages[1] }, { url }] });
  f.send('report', { status: 'excluded', reason: 'Alternate page with proper canonical tag', reportedAt: day(-3), items: [{ url: pages[2] }] });
  assert.throws(() => f.send('report', { status: 'excluded', reportedAt: T, items: [] }), /reason/);
  assert.throws(() => f.send('report', { status: 'maybe', reason: 'x', reportedAt: T, items: [] }), /status/);
  const q = queue(f.state(), 'r1', T);
  assert.deepEqual(q.map((a) => a.url), [pages[0], pages[3]]);
  assert.equal(q[0].score.parts.reported, 50);
  assert.equal(q[0].report.reason, 'Crawled - currently not indexed');
  assert.equal(q[0].fetchedAt, null);
  assert.equal(f.state().pages[pages[0]].sources.includes('gsc:not_indexed'), true);
  f.send('hint', { id: 'h', text: 'Rewrote the listed page' });
  f.send('assess', { url: pages[1], hintIds: ['h'] });
  assert.ok(queue(f.state(), 'r1', T).some((a) => a.url === pages[1]));
  f.send('discovered', { task: { url: pages[2], kind: 'page' }, page: { url: pages[2], httpStatus: 200, indexable: true, blockedReason: null }, pages: [], tasks: [] }, day(1));
  assert.ok(queue(f.state(), 'r1', day(1)).some((a) => a.url === pages[2]));
  assert.equal(queue(f.state(), 'r1', day(8)).some((a) => a.url === url), true);
  assert.equal(f.state().pages[url].inspection, null);
  const { counts, reportedAt } = summary(f.state());
  assert.deepEqual(counts.reported, { indexed: 2, not_indexed: 1, excluded: 1 });
  assert.equal(reportedAt, day(-3));
});

test('a report saying indexed still lets a pending cycle be observed and completed', () => {
  const f = fixture(); f.inspect(); f.begin('a'); f.result('a');
  f.send('finish', { reason: 'interrupted' }); f.start('r2', day(3));
  f.send('report', { status: 'indexed', reportedAt: day(3), items: [{ url }] }, day(3));
  assert.equal(queue(f.state(), 'r2', day(3))[0].action, 'inspect');
  f.inspect(url, day(3), { indexed: true });
  assert.equal(f.state().pages[url].cycle.status, 'complete');
});

test('a run starts from robots.txt; sitemaps register pages without fetch tasks; links are crawled only without a sitemap or on request', () => {
  const f = fixture(), map = 'https://example.com/sitemap.xml', home = 'https://example.com/';
  f.send('discovered', { task: { url: 'https://example.com/old', kind: 'page' }, pages: [], tasks: [] });
  f.send('finish', { reason: 'interrupted' }); f.start('r2', day(1));
  assert.deepEqual(f.state().discovery.pending, [{ url: 'https://example.com/robots.txt', kind: 'robots' }]);
  f.send('discovered', { task: { url: 'https://example.com/robots.txt', kind: 'robots' }, tasks: [{ url: map, kind: 'sitemap' }] }, day(1));
  assert.deepEqual(f.state().discovery.pending.map((x) => x.kind), ['sitemap', 'page']);
  f.send('discovered', { task: { url: map, kind: 'sitemap' }, pages: [{ url: 'https://example.com/a', lastmod: day(-10), source: map }], tasks: [] }, day(1));
  assert.equal(f.state().discovery.sitemapPages, 1);
  assert.equal(f.state().pages['https://example.com/a'].lastmod, day(-10));
  f.send('discovered', { task: { url: home, kind: 'page' }, pages: [{ url: 'https://example.com/b', source: home }], tasks: [{ url: 'https://example.com/b', kind: 'page' }] }, day(1));
  assert.ok(f.state().pages['https://example.com/b']);
  assert.deepEqual(f.state().discovery.pending, []);
  f.send('configure', { crawlLinks: true });
  f.send('discovered', { task: { url: 'https://example.com/a', kind: 'page' }, pages: [], tasks: [{ url: 'https://example.com/c', kind: 'page' }] }, day(1));
  assert.deepEqual(f.state().discovery.pending, [{ url: 'https://example.com/c', kind: 'page' }]);
  assert.throws(() => f.send('configure', { crawlLinks: 'yes' }), /crawlLinks/);
  const g = fixture();
  g.send('discovered', { task: { url: home, kind: 'page' }, pages: [], tasks: [{ url: 'https://example.com/linked', kind: 'page' }] });
  assert.ok(g.state().discovery.pending.some((x) => x.url === 'https://example.com/linked'));
});

test('a newer sitemap lastmod becomes a change candidate for review, never a revision by itself', () => {
  const f = fixture(), map = 'https://example.com/sitemap.xml';
  const entry = (lastmod, at) => f.send('discovered', { task: { url: map, kind: 'sitemap' }, pages: [{ url, lastmod, source: map }], tasks: [] }, at);
  entry(day(-10), T); assert.equal(f.state().pages[url].changeCandidate, null);
  entry(day(-10), T); assert.equal(f.state().pages[url].changeCandidate, null);
  entry(day(-1), T);
  assert.match(f.state().pages[url].changeCandidate.reason, /lastmod/);
  assert.equal(f.state().pages[url].cycle.changedAt, null);
  f.send('assess', { url, significant: false });
  assert.equal(f.state().pages[url].changeCandidate, null);
});

test('journals written before reports and sitemap-only discovery still replay', () => {
  const f = fixture();
  f.send('import', { items: [{ url: 'https://example.com/sitemap.xml', kind: 'sitemap' }] });
  f.send('discovered', { task: { url: 'https://example.com/sitemap.xml', kind: 'sitemap' }, pages: [{ url: 'https://example.com/legacy', source: 'https://example.com/sitemap.xml' }], tasks: [{ url: 'https://example.com/legacy', kind: 'page' }] });
  const legacy = structuredClone(f.state()); delete legacy.discovery.sitemapPages; delete legacy.settings.crawlLinks;
  const next = applyEvent(legacy, { seq: legacy.seq + 1, type: 'discovered', at: T, data: { runId: 'r1', task: { url: 'https://example.com/legacy', kind: 'page' }, page: { url: 'https://example.com/legacy', httpStatus: 200, indexable: true }, pages: [], tasks: [{ url: 'https://example.com/more', kind: 'page' }] } });
  assert.ok(next.pages['https://example.com/legacy']);
  assert.deepEqual(queue(next, 'r1', T).map((a) => a.url).includes('https://example.com/legacy'), true);
});
