#!/usr/bin/env node
/* JSON CLI for the update-dependencies workflow: discovery, planning, supply-chain inspection,
   and the write-ahead log the agent records every step in. It never installs, edits a
   repository, commits, or schedules anything; the agent applies changes and records them here. */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolveRoot, openStore, slug } from './store.mjs';
import { discover, isDirty, repoFiles, isExcluded } from './discover.mjs';
import { detectors, byId } from './detectors/index.mjs';
import { makeRegistry } from './registry.mjs';
import { makeGithub } from './github.mjs';
import { inspectNpm } from './inspect.mjs';

const USAGE = 'Usage: node deps.mjs <command> [args] [--storage DIR] [--run ID] [--input FILE|-] [--only ECOSYSTEM] [--dry-run] [--unsafe]\n' +
  'Commands: discover, status, start [repo...], plan <repo>, inspect <package> <from> <to> [--repo R], skip, held, intent, applied, rolledBack, verified, finish, recover, log [repo]';
const FLAGS = new Set(['--storage', '--run', '--input', '--only', '--repo', '--dry-run', '--unsafe']);

export const parseArgs = (argv) => {
  const [command, ...rest] = argv, positional = [], opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    if (!FLAGS.has(a)) throw new Error(`Unknown option ${a}\n${USAGE}`);
    if (a === '--dry-run' || a === '--unsafe') opts[a.slice(2)] = true;
    else { if (!rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error(`Missing value for ${a}`); opts[a.slice(2)] = rest[++i]; }
  }
  if (!command) throw new Error(USAGE);
  return { command, positional, opts };
};

const now = () => new Date().toISOString();

export const main = async (argv = process.argv.slice(2), { preferences, fetcher = fetch } = {}) => {
  const { command, positional, opts } = parseArgs(argv);
  const data = opts.input ? JSON.parse(readFileSync(opts.input === '-' ? 0 : opts.input, 'utf8')) : {};
  const root = resolveRoot(opts.storage, preferences), store = openStore(root);
  const runId = opts.run || data.runId;

  if (command === 'status') {
    const s = store.load(), settings = store.settings();
    const last = s.runs.at(-1);
    const banned = Object.entries(settings.repos).filter(([, r]) => isExcluded(r.path, settings.exclude)).map(([n]) => n);
    return {
      workspace: store.dir, settings: store.settingsFile, currentRun: s.currentRun,
      repos: Object.keys(settings.repos).length - banned.length, exclude: settings.exclude, excludedEntries: banned, skipped: Object.entries(settings.repos).filter(([, r]) => r.skip).map(([n]) => n),
      holds: settings.packages, openIntents: s.openIntents,
      lastRun: last && { id: last.id, at: last.at, status: last.status, dryRun: last.dryRun, repos: Object.fromEntries(Object.entries(last.repos).map(([n, r]) => [n, { applied: r.applied.length, held: r.held.length, rolledBack: r.rolledBack.length, skipped: r.skipped }])) }
    };
  }
  if (command === 'log') {
    const file = positional[0] ? join(store.dir, 'repos', slug(positional[0]), 'log.md') : join(store.dir, 'log.md');
    return { file, text: existsSync(file) ? readFileSync(file, 'utf8') : '' };
  }
  if (command === 'inspect') {
    const [name, from, to] = positional;
    if (!name || !from || !to) throw new Error('inspect needs <package> <from> <to>');
    const report = await inspectNpm({ name, from, to, registry: makeRegistry({ fetcher }) });
    if (runId && opts.repo) await store.update(async ({ emit }) => emit('review', { runId, repo: opts.repo, name, from, to, verdict: report.verdict, signals: report.signals.map(({ severity, code, detail }) => ({ severity, code, detail })) }));
    return report;
  }

  return store.update(async ({ state, emit, settings, mergeRepos }) => {
    const runDiscovery = () => {
      const s0 = settings();
      const found = discover({ roots: s0.roots, exclude: s0.exclude });
      const { settings: merged, pruned } = mergeRepos(Object.fromEntries(Object.entries(found).map(([n, r]) => [n, { path: r.path, ecosystems: r.ecosystems }])), (path) => isExcluded(path, s0.exclude));
      emit('discover', { repos: Object.fromEntries(Object.entries(found).map(([n, r]) => [n, { path: r.path, ecosystems: r.ecosystems }])) });
      return { found, merged, pruned };
    };
    if (command === 'discover') {
      const { found, pruned } = runDiscovery();
      return { workspace: store.dir, settings: store.settingsFile, exclude: settings().exclude, prunedExcluded: pruned, repos: Object.fromEntries(Object.entries(found).map(([n, r]) => [n, { path: r.path, ecosystems: r.ecosystems, findings: r.findings.length }])) };
    }
    if (command === 'start') {
      let discovered = null;
      if (!Object.keys(settings().repos).length) discovered = Object.keys(runDiscovery().found);
      const { repos: all, exclude } = settings();
      const banned = (n) => isExcluded(all[n].path, exclude);
      const scope = (positional.length ? positional : Object.keys(all)).filter((n) => all[n] && !all[n].skip && !banned(n));
      const unknown = positional.filter((n) => !all[n]);
      const excluded = positional.filter((n) => all[n] && banned(n));
      const id = randomUUID();
      emit('start', { id, dryRun: !!opts['dry-run'], unsafe: !!opts.unsafe, scope });
      return { runId: id, workspace: store.dir, scope, skippedBySettings: Object.entries(all).filter(([, r]) => r.skip).map(([n]) => n), excluded, unknown, discovered };
    }
    if (!runId) throw new Error(`${command} needs --run <id> (from start)`);
    const run = state().runs.find((r) => r.id === runId);
    if (!run) throw new Error(`Unknown run ${runId}`);

    if (command === 'plan') {
      const name = positional[0] || data.repo;
      const repo = settings().repos[name];
      if (!repo) throw new Error(`Repository ${name} is not in settings.json; run discover`);
      if (isExcluded(repo.path, settings().exclude)) throw new Error(`Repository ${name} (${repo.path}) is under an excluded path in settings.json; it is never planned or changed`);
      const dirty = isDirty(repo.path);
      if (dirty.length && !data.allowDirty) {
        emit('skip', { runId, repo: name, reason: `uncommitted changes not made by this run (${dirty.slice(0, 5).join('; ')}${dirty.length > 5 ? '; …' : ''})` });
        return { repo: name, skipped: true, dirty };
      }
      const s = settings();
      const holds = { ...s.packages, ...(repo.packages || {}) };
      const files = repoFiles(repo.path);
      const ctx = { registry: makeRegistry({ fetcher }), github: makeGithub({ fetcher }), fetcher, minAgeDays: s.minReleaseAgeDays, now: Date.now(), holds };
      const findings = detectors.filter((d) => !opts.only || d.id === opts.only).flatMap((d) => d.detect(repo.path, files));
      /* node-runtime first so Docker node images know the LTS major. */
      findings.sort((a, b) => (a.ecosystem === 'node-runtime' ? -1 : 0) - (b.ecosystem === 'node-runtime' ? -1 : 0));
      const items = [], errors = [];
      for (const f of findings) {
        try { if (f.ecosystem === 'docker' && !ctx.nodeLts) ctx.nodeLts = await byId['node-runtime'].latestLts(ctx).catch(() => null); items.push(...await byId[f.ecosystem].outdated(repo.path, f, ctx)); }
        catch (e) { errors.push({ ecosystem: f.ecosystem, file: f.manifest || f.file, error: e.message }); }
      }
      for (const f of findings.filter((x) => x.ecosystem === 'npm' && x.lock)) {
        const rc = join(repo.path, f.project, '.npmrc');
        const text = existsSync(rc) ? readFileSync(rc, 'utf8') : '';
        if (!/^\s*min-release-age\s*=/m.test(text)) items.push({ ecosystem: 'npm', project: f.project, name: '.npmrc', from: text ? 'present without min-release-age' : 'missing', to: `min-release-age=${s.minReleaseAgeDays}`, kind: 'config' });
      }
      const held = items.filter((i) => i.kind === 'held');
      const planned = items.filter((i) => i.to && i.kind !== 'held' && !i.error);
      emit('plan', { runId, repo: name, items: planned.map(({ ecosystem, project, file, name: n, from, to, kind }) => ({ ecosystem, project, file, name: n, from, to, kind })) });
      for (const h of held) emit('held', { runId, repo: name, name: h.name, from: h.from, to: h.latest, reason: `settings hold ${h.hold.range}${h.hold.reason ? ': ' + h.hold.reason : ''}` });
      return { repo: name, path: repo.path, notes: repo.notes || '', ecosystems: [...new Set(findings.map((f) => f.ecosystem))], references: [...new Set(findings.map((f) => byId[f.ecosystem].reference))], items: planned, held, review: items.filter((i) => !i.to && !i.error && i.kind !== 'held'), errors: [...errors, ...items.filter((i) => i.error)] };
    }
    if (command === 'skip') return emit('skip', { runId, repo: data.repo, reason: data.reason }) && { ok: true };
    if (command === 'held') { emit('held', { runId, repo: data.repo, name: data.name, from: data.from, to: data.to, reason: data.reason }); return { ok: true }; }
    if (command === 'intent') {
      if (run.dryRun) throw new Error('Dry run: record proposals with held or skip, never intent');
      const id = randomUUID();
      emit('intent', { runId, id, repo: data.repo, name: data.name, from: data.from, to: data.to, files: data.files || [] });
      return { intentId: id };
    }
    if (command === 'applied') { emit('applied', { runId, intentId: data.intentId, notes: data.notes, migration: data.migration }); return { ok: true }; }
    if (command === 'rolledBack') { emit('rolledBack', { runId, intentId: data.intentId, repo: data.repo, name: data.name, from: data.from, to: data.to, reason: data.reason }); return { ok: true }; }
    if (command === 'verified') { emit('verified', { runId, repo: data.repo, ok: !!data.ok, checks: data.checks || [] }); return { ok: true }; }
    if (command === 'finish') { emit('finish', { runId, status: data.status || 'completed', summary: data.summary || '' }); return { ok: true, log: join(store.dir, 'log.md') }; }
    if (command === 'recover') {
      const open = Object.entries(state().openIntents).filter(([, i]) => i.runId === runId).map(([id, i]) => ({ intentId: id, ...i }));
      emit('recover', { runId });
      return { recovered: open, note: 'Restore each listed file from git (git checkout -- <files>) or finish verifying it, then start a new run.' };
    }
    throw new Error(`Unknown command ${command}\n${USAGE}`);
  });
};

const isMain = (() => { try { return !!process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url; } catch { return false; } })();
if (isMain) main().then((r) => process.stdout.write(JSON.stringify(r, null, 2) + '\n'), (e) => { process.stderr.write(e.message + '\n'); process.exit(1); });
