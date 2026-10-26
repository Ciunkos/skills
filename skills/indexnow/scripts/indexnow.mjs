#!/usr/bin/env node
/* JSON CLI for the agent's browser workflow. Never requests indexing itself. */
import { readFileSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolveRoot, rememberRoot, openStore } from './store.mjs';
import { normalizeUrl, inScope, queue, summary } from './model.mjs';
import { makeDiscoverer } from './discovery.mjs';

export const main = async (argv = process.argv.slice(2), { preferences, fetcher } = {}) => {
  const [command, target, ...flags] = argv;
  if (!target || !command) throw new Error('Usage: node indexnow.mjs <command> <domain|url> [--run ID] [--storage DIR] [--input FILE|-] [--dry-run] [--take N] [--offset N]. Commands: start, configure, import, report, discover, fetch, work, next, view, hint, assess, inspect, begin, result, preview, defer, finish, recover, status, dlq');
  const supported = new Set(['--run', '--storage', '--input', '--take', '--offset', '--dry-run']);
  const opts = {};
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (!supported.has(f)) throw new Error(`Unknown option ${f}`);
    if (f === '--dry-run') opts.dryRun = true;
    else { if (!flags[i + 1] || flags[i + 1].startsWith('--')) throw new Error(`Missing value for ${f}`); opts[f.slice(2)] = flags[++i]; }
  }
  const data = opts.input ? JSON.parse(readFileSync(opts.input === '-' ? 0 : opts.input, 'utf8')) : {};
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Input must be a JSON object');
  const root = resolveRoot(target, opts.storage, preferences), store = openStore(target, root), runId = opts.run || data.runId;
  const take = opts.take ? Number(opts.take) : 20;
  const offset = opts.offset ? Number(opts.offset) : 0;
  if (!Number.isInteger(take) || take < 1 || take > 1000) throw new Error('--take must be between 1 and 1000 (a batch size, not a run limit)');
  if (!Number.isInteger(offset) || offset < 0) throw new Error('--offset must be a nonnegative integer');
  const now = new Date().toISOString();
  if (['status', 'dlq', 'next', 'view', 'work'].includes(command)) {
    const s = store.load();
    if (command === 'status') return { workspace: store.dir, ...summary(s) };
    if (command === 'next') return { runId, actions: queue(s, runId, now, take), discoveryRemaining: s.discovery.pending.length };
    if (command === 'view') return s.pages[normalizeUrl(data.url || target)] || { error: 'URL is not in the inventory' };
    const pages = Object.values(s.pages).filter((p) => command === 'dlq' ? p.cycle.status === 'dlq' : p.pending || p.changeCandidate || p.valueReason === 'Unassessed');
    return { total: pages.length, offset, pages: pages.slice(offset, offset + take), hints: s.hints.filter((h) => !h.resolvedAt) };
  }
  const result = await store.update(async ({ state, emit }) => {
    if (command === 'start') {
      const id = randomUUID();
      emit('start', { id, dryRun: !!opts.dryRun });
      if (target.includes('://') && new URL(target).pathname !== '/') emit('import', { runId: id, items: [{ url: target, source: 'explicit URL' }] });
      if (data.hint) emit('hint', { runId: id, id: randomUUID(), text: data.hint });
      return { runId: id, workspace: store.dir, ...summary(state()) };
    }
    if (command === 'discover' || command === 'fetch') {
      const run = state().runs.find((r) => r.id === runId);
      if (!run || state().currentRun !== runId || run.status !== 'active') throw new Error('Active matching --run required');
      const md = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');
      const version = /^\s+version:\s*"?([\d.]+)/m.exec(md)?.[1];
      const discover = makeDiscoverer({ version, ...(fetcher ? { fetcher } : {}) }); let processed = 0;
      if (command === 'fetch') {
        /* Fetch named candidates now, regardless of the seven-day revisit interval. */
        const urls = [...new Set((data.urls || []).map((u) => normalizeUrl(u, state().origin)))].slice(0, take);
        if (!urls.length) throw new Error('fetch requires urls');
        const pages = [];
        for (const url of urls) {
          const result = await discover(state(), { url, kind: 'page' });
          emit('discovered', { runId, ...result });
          const p = state().pages[url] || {};
          pages.push({ url, error: result.error || null, httpStatus: p.httpStatus ?? null, indexable: p.indexable ?? null, blockedReason: p.blockedReason || null, canonical: p.canonical || null, title: p.title || '', changeCandidate: p.changeCandidate || null });
        }
        return { fetched: pages.length, pages };
      }
      while (state().discovery.pending.length && processed < take) {
        const task = state().discovery.pending[0];
        emit('discovered', { runId, ...await discover(state(), task) }); processed++;
      }
      return { processed, remaining: state().discovery.pending.length, sitemapPages: state().discovery.sitemapPages || 0, failures: state().discovery.failures.slice(-take) };
    }
    if (command === 'report') {
      /* GSC Page indexing report rows. Out-of-scope hosts are skipped, not errors: a domain property covers subdomains this workspace does not. */
      const rows = data.csv ? readFileSync(data.csv, 'utf8').split(/\r?\n/).map((line) => line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, '')).find((cell) => /^https?:\/\//.test(cell))).filter(Boolean).map((url) => ({ url })) : data.items || [];
      const items = [], skipped = [];
      for (const row of rows) {
        let url; try { if (!/^https?:\/\//i.test(row.url || '')) throw new Error('absolute'); url = normalizeUrl(row.url); } catch { skipped.push(row.url); continue; }
        if (!inScope(state(), url)) { skipped.push(url); continue; }
        items.push({ url, ...(row.lastCrawlAt ? { lastCrawlAt: row.lastCrawlAt } : {}) });
      }
      emit('report', { runId, status: data.status, reason: data.reason, reportedAt: data.reportedAt, items });
      return { command, imported: items.length, skipped: skipped.length, skippedUrls: skipped.slice(0, 20), ...summary(state()) };
    }
    if (command === 'recover') {
      emit('finish', { runId, reason: 'interrupted', note: data.note || 'Previous browser run interrupted. Pending clicks require reconciliation.' });
    } else if (['configure', 'import', 'hint', 'assess', 'inspect', 'begin', 'result', 'defer', 'preview', 'finish'].includes(command)) {
      const input = { ...data, runId };
      if (command === 'hint') input.id ||= randomUUID();
      if (command === 'begin') input.intentId ||= randomUUID();
      emit(command, input);
      return { command, ...(input.intentId ? { intentId: input.intentId } : {}), ...(command === 'hint' ? { hintId: input.id } : {}), ...summary(state()) };
    } else throw new Error(`Unknown command ${command}`);
    return summary(state());
  });
  if (opts.storage) rememberRoot(target, root, preferences);
  return result;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; });
}
