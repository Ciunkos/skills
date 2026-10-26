/* File-level recovery, lock ownership, remembered roots, and lossless log compaction. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, readdirSync, existsSync, unlinkSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, acquireLock, resolveRoot, rememberRoot, defaultRoot, renderLog } from '../scripts/store.mjs';
import { main } from '../scripts/indexnow.mjs';

const workspace = (t) => { const root = mkdtempSync(join(tmpdir(), 'indexnow-')); t.after(() => rmSync(root, { recursive: true, force: true })); return { root, store: openStore('example.com', root) }; };

test('journal replays a committed event after a crash before snapshot; partial tails are quarantined', async (t) => {
  const { store } = workspace(t);
  await store.update(({ emit }) => emit('start', { id: 'r' }));
  const oldSnapshot = readFileSync(join(store.dir, 'state.json'));
  await store.update(({ emit }) => emit('hint', { runId: 'r', id: 'h', text: 'Changed pricing page' }));
  writeFileSync(join(store.dir, 'state.json'), oldSnapshot);
  assert.equal(store.load().hints[0].text, 'Changed pricing page');
  appendFileSync(join(store.dir, 'events.jsonl'), '{"seq":3,"unfinished":');
  await store.update(({ emit }) => emit('configure', { runId: 'r', primaryLanguage: 'en' }));
  const s = store.load(); assert.equal(s.seq, 3); assert.equal(s.settings.primaryLanguage, 'en');
  const partial = readdirSync(store.dir).find((x) => x.startsWith('partial-'));
  assert.equal(readFileSync(join(store.dir, partial), 'utf8'), '{"seq":3,"unfinished":');
  assert.equal(readFileSync(join(store.dir, '.gitignore'), 'utf8'), '*\n');
});

test('process lock and durable run ownership prevent overlapping writes and browser runs', async (t) => {
  const { store } = workspace(t);
  await store.update(({ emit }) => emit('start', { id: 'r' }));
  const release = acquireLock(store.dir);
  await assert.rejects(() => store.update(() => {}), /locked/); release();
  await assert.rejects(() => store.update(({ emit }) => emit('start', { id: 'other' })), /active run/);
  assert.equal(existsSync(join(store.dir, '.lock')), false);
  assert.equal(store.load().currentRun, 'r');
  const before = readFileSync(join(store.dir, 'events.jsonl'), 'utf8');
  await assert.rejects(() => store.update(({ emit }) => emit('configure', { runId: 'wrong', property: 'bad' })), /matching/);
  assert.equal(readFileSync(join(store.dir, 'events.jsonl'), 'utf8'), before);
});

test('compaction archives the exact old log and retains recent summaries and full event history', async (t) => {
  const { store } = workspace(t); let original;
  await store.update(({ state, emit }) => {
    for (let i = 0; i < 25; i++) { emit('start', { id: `r${i}` }); emit('finish', { runId: `r${i}`, reason: 'interrupted', note: `Run ${i} observations retained` }); }
    original = renderLog(state());
  }, { wordLimit: 100 });
  const files = readdirSync(join(store.dir, 'archives'));
  assert.equal(files.length, 1);
  assert.equal(readFileSync(join(store.dir, 'archives', files[0]), 'utf8'), original);
  const s = store.load(), active = readFileSync(join(store.dir, 'log.md'), 'utf8');
  assert.equal(s.runs.length, 25); assert.equal(s.logFrom, 5);
  assert.equal(active.includes('(r0)'), false); assert.equal(active.includes('(r5)'), true); assert.equal(active.includes('(r24)'), true);
  unlinkSync(join(store.dir, 'state.json'));
  assert.equal(store.load().runs.length, 25); assert.equal(store.load().logFrom, 5);
});

test('a single oversized run is compacted without losing its raw messages', async (t) => {
  const { store } = workspace(t); const note = 'long observation '.repeat(1000);
  await store.update(({ emit }) => { emit('start', { id: 'r' }); emit('finish', { runId: 'r', reason: 'interrupted', note }); }, { wordLimit: 500 });
  assert.ok(readFileSync(join(store.dir, 'log.md'), 'utf8').length < note.length);
  assert.equal(store.load().runs[0].note, note);
  assert.ok(readFileSync(join(store.dir, 'archives', readdirSync(join(store.dir, 'archives'))[0]), 'utf8').includes(note));
});

test('custom storage is remembered and status stays read-only on a missing workspace', async (t) => {
  const { root } = workspace(t), prefs = join(root, 'prefs.json'), custom = join(root, 'custom directory');
  rememberRoot('example.com', custom, prefs);
  assert.equal(resolveRoot('https://www.example.com/a', undefined, prefs), custom);
  assert.ok(defaultRoot().endsWith('/indexnow'));
  const status = await main(['status', 'missing.example', '--storage', custom], { preferences: prefs });
  assert.equal(status.counts.total, 0); assert.equal(existsSync(join(custom, 'missing.example')), false);
});

test('CLI persists the full intent/outcome flow and never interprets a hint as shell code', async (t) => {
  const { root } = workspace(t), preferences = join(root, 'prefs.json'), input = join(root, 'input.json');
  const call = async (command, data, runId) => {
    writeFileSync(input, JSON.stringify(data));
    return main([command, 'example.com', '--storage', root, '--input', input, ...(runId ? ['--run', runId] : [])], { preferences });
  };
  const start = await call('start', { hint: 'Changed pricing `do not run` $(anything)' });
  const run = start.runId, url = 'https://example.com/pricing';
  await call('import', { items: [{ url }] }, run);
  await call('inspect', { url, indexed: false, indexable: true, evidence: 'GSC allows this page' }, run);
  const begin = await call('begin', { url }, run);
  await call('result', { url, intentId: begin.intentId, outcome: 'accepted', evidence: 'Indexing requested' }, run);
  const status = await main(['status', 'example.com'], { preferences });
  assert.equal(status.latestRun.accepted.length, 1);
  assert.equal(status.unresolvedHints[0].text, 'Changed pricing `do not run` $(anything)');
  assert.equal(status.workspace, join(root, 'example.com'));
});

test('installed skill CLI works through a symlink and status creates no working files', (t) => {
  const { root } = workspace(t), skill = fileURLToPath(new URL('..', import.meta.url));
  symlinkSync(skill, join(root, 'installed'));
  const output = execFileSync(process.execPath, [join(root, 'installed/scripts/indexnow.mjs'), 'status', 'example.com', '--storage', root], { encoding: 'utf8' });
  assert.equal(JSON.parse(output).counts.total, 0);
  assert.equal(existsSync(join(root, 'example.com')), false);
});

test('CLI seeds from a GSC report, skips other hosts, reads an unzipped export, and fetches named candidates', async (t) => {
  const { root } = workspace(t), preferences = join(root, 'prefs.json'), input = join(root, 'input.json'), csv = join(root, 'Table.csv');
  const fetcher = async (url) => new Response(url.endsWith('/robots.txt') ? '' : '<html lang="en"><main>New page</main></html>', { headers: { 'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'text/html' } });
  const call = async (command, data, runId, extra = []) => {
    writeFileSync(input, JSON.stringify(data));
    return main([command, 'example.com', '--storage', root, '--input', input, ...(runId ? ['--run', runId] : []), ...extra], { preferences, fetcher });
  };
  const { runId } = await call('start', {});
  const report = await call('report', { status: 'not_indexed', reason: 'Discovered - currently not indexed', reportedAt: '2026-01-01T00:00:00Z', items: [{ url: 'https://example.com/new' }, { url: 'https://sso.example.com/login' }, { url: 'not a url' }] }, runId);
  assert.equal(report.imported, 1); assert.equal(report.skipped, 2);
  writeFileSync(csv, 'URL,Last crawled\n"https://example.com/csv-page","Jan 1, 2026"\n,\n');
  const fromCsv = await call('report', { status: 'indexed', reportedAt: '2026-01-01T00:00:00Z', csv }, runId);
  assert.equal(fromCsv.imported, 1);
  assert.deepEqual(fromCsv.counts.reported, { indexed: 1, not_indexed: 1, excluded: 0 });
  const next = await call('next', {}, runId);
  assert.deepEqual(next.actions.map((a) => a.url), ['https://example.com/new']);
  await assert.rejects(() => call('fetch', { urls: [] }, runId), /urls/);
  const fetched = await call('fetch', { urls: ['https://example.com/new'] }, runId);
  assert.equal(fetched.fetched, 1); assert.equal(fetched.pages[0].url, 'https://example.com/new');
  assert.equal(fetched.pages[0].httpStatus, 200); assert.equal(fetched.pages[0].indexable, true);
  assert.equal((await call('next', {}, runId)).actions[0].fetchedAt !== null, true);
  assert.match(readFileSync(join(root, 'example.com', 'log.md'), 'utf8'), /1 indexed, 1 not indexed, 0 excluded/);
});
