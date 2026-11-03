/* Workspace in ~/dependencies: user-editable settings.json, a write-ahead journal (events.jsonl)
   replayed into state.json, a readable log per repository, and one run lock. */
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, fsyncSync, appendFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const defaultRoot = () => join(homedir(), 'dependencies');
const expand = (p) => resolve(String(p).replace(/^~(?=\/|$)/, homedir()));

const atomic = (file, text) => {
  const temp = `${file}.${randomUUID()}.tmp`, fd = openSync(temp, 'wx', 0o600);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
};
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

/* --storage wins and is remembered; otherwise the remembered root; otherwise ~/dependencies. */
export const resolveRoot = (storage, preferences = join(defaultRoot(), 'preferences.json')) => {
  if (storage) {
    const root = expand(storage);
    mkdirSync(resolve(preferences, '..'), { recursive: true, mode: 0o700 });
    atomic(preferences, JSON.stringify({ storage: root }, null, 2) + '\n');
    return root;
  }
  return readJson(preferences, {}).storage || defaultRoot();
};

export const defaultSettings = () => ({
  version: 1,
  roots: ['~'],
  exclude: ['**/node_modules/**', '~/Library/**', '**/.Trash/**', '**/.cache/**'],
  minReleaseAgeDays: 7,
  repos: {},
  packages: {},
  ignoreAdvisories: {}
});

export const slug = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, '_');

export const acquireLock = (dir) => {
  const file = join(dir, '.lock');
  let fd;
  try { fd = openSync(file, 'wx', 0o600); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let owner = {};
    try { owner = JSON.parse(readFileSync(file, 'utf8')); } catch { /* torn lock file: treat as stale */ }
    try { process.kill(owner.pid, 0); throw new Error(`Another update run holds ${file} (pid ${owner.pid})`); }
    catch (error) { if (error.code !== 'ESRCH' && owner.pid) throw error; unlinkSync(file); fd = openSync(file, 'wx', 0o600); }
  }
  writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); closeSync(fd);
  return () => { try { unlinkSync(file); } catch { /* already gone */ } };
};

export const createState = () => ({ version: 1, seq: 0, repos: {}, runs: [], currentRun: null, openIntents: {} });

const runOf = (s, id) => s.runs.find((r) => r.id === id);
const repoRun = (run, repo) => (run.repos[repo] ??= { planned: [], reviewed: [], applied: [], held: [], rolledBack: [], verified: [], skipped: null });

/* Pure reducer: the journal is the source of truth, state.json is a cache of this fold. */
export const applyEvent = (state, event) => {
  const s = structuredClone(state), d = event.data || {};
  s.seq = event.seq;
  const run = d.runId ? runOf(s, d.runId) : null;
  if (d.runId && !run && event.type !== 'start') throw new Error(`Unknown run ${d.runId}`);
  switch (event.type) {
    case 'start':
      if (s.currentRun) throw new Error(`Run ${s.currentRun} is still open; finish or recover it first`);
      s.runs.push({ id: d.id, at: event.at, status: 'running', dryRun: !!d.dryRun, unsafe: !!d.unsafe, scope: d.scope || [], repos: {} });
      s.currentRun = d.id;
      break;
    case 'discover':
      for (const [name, r] of Object.entries(d.repos || {})) s.repos[name] = { ...(s.repos[name] || {}), path: r.path, ecosystems: r.ecosystems, discoveredAt: event.at };
      break;
    case 'skip': repoRun(run, d.repo).skipped = d.reason; break;
    case 'plan': repoRun(run, d.repo).planned = d.items || []; break;
    case 'review': repoRun(run, d.repo).reviewed.push({ name: d.name, from: d.from, to: d.to, verdict: d.verdict, signals: d.signals || [], notes: d.notes || '' }); break;
    case 'held': repoRun(run, d.repo).held.push({ name: d.name, from: d.from, to: d.to, reason: d.reason }); break;
    case 'intent':
      if (s.openIntents[d.id]) throw new Error(`Intent ${d.id} already exists`);
      s.openIntents[d.id] = { runId: d.runId, repo: d.repo, name: d.name, from: d.from, to: d.to, files: d.files || [], at: event.at };
      break;
    case 'applied': {
      const intent = s.openIntents[d.intentId];
      if (!intent) throw new Error(`No open intent ${d.intentId}`);
      repoRun(run, intent.repo).applied.push({ name: intent.name, from: intent.from, to: intent.to, notes: d.notes || '', migration: d.migration || null });
      delete s.openIntents[d.intentId];
      s.repos[intent.repo] ??= {};
      (s.repos[intent.repo].versions ??= {})[intent.name] = intent.to;
      break;
    }
    case 'rolledBack': {
      const intent = s.openIntents[d.intentId];
      const target = intent || { repo: d.repo, name: d.name, from: d.from, to: d.to };
      repoRun(run, target.repo).rolledBack.push({ name: target.name, from: target.from, to: target.to, reason: d.reason });
      if (intent) delete s.openIntents[d.intentId];
      else if (s.repos[target.repo]?.versions?.[target.name] === target.to) s.repos[target.repo].versions[target.name] = target.from;
      break;
    }
    case 'verified': repoRun(run, d.repo).verified.push({ checks: d.checks || [], ok: !!d.ok, at: event.at }); break;
    case 'finish':
      if (Object.values(s.openIntents).some((i) => i.runId === d.runId)) throw new Error('Resolve open intents (applied or rolledBack) before finish');
      run.status = d.status || 'completed'; run.finishedAt = event.at; run.summary = d.summary || '';
      if (s.currentRun === d.runId) s.currentRun = null;
      break;
    case 'recover':
      /* An interrupted run: open intents become explicit rollbacks to perform, the run closes. */
      for (const [id, intent] of Object.entries(s.openIntents)) if (intent.runId === d.runId) {
        repoRun(run, intent.repo).rolledBack.push({ name: intent.name, from: intent.from, to: intent.to, reason: 'interrupted run, restore files: ' + intent.files.join(', ') });
        delete s.openIntents[id];
      }
      run.status = 'interrupted'; run.finishedAt = event.at;
      if (s.currentRun === d.runId) s.currentRun = null;
      break;
    default: throw new Error(`Unknown event ${event.type}`);
  }
  return s;
};

const LOG_LINE = {
  skip: (d) => `- Skipped: ${d.reason}`,
  plan: (d) => `- Planned ${d.items.length}: ${d.items.map((i) => `${i.name} ${i.from} → ${i.to} (${i.kind})`).join(', ') || 'nothing'}`,
  review: (d) => `- Reviewed ${d.name} ${d.from} → ${d.to}: ${d.verdict}${d.signals?.length ? ' [' + d.signals.map((x) => x.code || x).join(', ') + ']' : ''}${d.notes ? '. ' + d.notes : ''}`,
  held: (d) => `- Held ${d.name} ${d.from} → ${d.to}: ${d.reason}`,
  intent: (d) => `- Applying ${d.name} ${d.from} → ${d.to} (files: ${(d.files || []).join(', ')})`,
  applied: (d, i) => `- Applied ${i.name} ${i.from} → ${i.to}${d.migration ? '. Migration: ' + d.migration : ''}${d.notes ? '. ' + d.notes : ''}`,
  rolledBack: (d, i) => `- Rolled back ${(i || d).name} ${(i || d).from} → ${(i || d).to}: ${d.reason}`,
  verified: (d) => `- Checks ${d.ok ? 'passed' : 'FAILED'}: ${(d.checks || []).map((c) => `${c.cmd} ${c.ok ? 'ok' : 'fail'}${c.detail ? ' (' + c.detail + ')' : ''}`).join('; ')}`
};

export const openStore = (root = defaultRoot()) => {
  const dir = resolve(root), stateFile = join(dir, 'state.json'), journal = join(dir, 'events.jsonl'), settingsFile = join(dir, 'settings.json');
  const ensure = () => {
    mkdirSync(join(dir, 'repos'), { recursive: true, mode: 0o700 });
    if (!existsSync(join(dir, '.gitignore'))) atomic(join(dir, '.gitignore'), '*\n');
  };
  const load = () => {
    let s = readJson(stateFile, createState());
    if (s.version !== 1) throw new Error('Unsupported workspace version');
    if (existsSync(journal)) {
      const text = readFileSync(journal, 'utf8'), complete = text.slice(0, text.lastIndexOf('\n') + 1);
      for (const line of complete.split('\n').filter(Boolean)) { const e = JSON.parse(line); if (e.seq > s.seq) s = applyEvent(s, e); }
    }
    return s;
  };
  const settings = () => ({ ...defaultSettings(), ...readJson(settingsFile, {}) });
  /* Discovery only adds repositories and refreshes detected ecosystems; it never drops user keys. */
  const mergeRepos = (found) => {
    ensure();
    const current = settings();
    for (const [name, r] of Object.entries(found)) current.repos[name] = { ...(current.repos[name] || { skip: false, notes: '' }), path: r.path, ecosystems: r.ecosystems };
    atomic(settingsFile, JSON.stringify(current, null, 2) + '\n');
    return current;
  };
  const repoLog = (repo, line, at) => {
    const file = join(dir, 'repos', slug(repo), 'log.md');
    mkdirSync(resolve(file, '..'), { recursive: true, mode: 0o700 });
    if (!existsSync(file)) atomic(file, `# ${repo}\n`);
    appendFileSync(file, `${line} _(${at})_\n`);
  };
  const update = async (operation) => {
    ensure();
    const release = acquireLock(dir);
    try {
      let s = load();
      const emit = (type, data, at = new Date().toISOString()) => {
        const before = s, event = { seq: s.seq + 1, id: randomUUID(), type, data, at };
        const next = applyEvent(s, event);
        const fd = openSync(journal, 'a', 0o600);
        try { appendFileSync(fd, JSON.stringify(event) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
        atomic(stateFile, JSON.stringify(next, null, 2) + '\n');
        s = next;
        const intent = before.openIntents[data.intentId];
        const repo = data.repo || intent?.repo;
        if (repo && LOG_LINE[type]) {
          if (type === 'plan') repoLog(repo, `\n## Run ${data.runId}`, at);
          repoLog(repo, LOG_LINE[type](data, intent), at);
        }
        if (type === 'finish' || type === 'recover') {
          const run = s.runs.find((r) => r.id === data.runId);
          const count = (k) => Object.values(run.repos).reduce((n, r) => n + r[k].length, 0);
          appendFileSync(join(dir, 'log.md'), `\n## ${at} (${data.runId})\n${run.status}${run.dryRun ? ', dry run' : ''}${run.unsafe ? ', unsafe' : ''}: ${count('applied')} applied, ${count('held')} held, ${count('rolledBack')} rolled back across ${Object.keys(run.repos).length} repositories.${run.summary ? '\n' + run.summary : ''}\n`);
        }
        return s;
      };
      return await operation({ state: () => s, emit, settings, mergeRepos });
    } finally { release(); }
  };
  return { dir, load, settings, mergeRepos, update, settingsFile };
};
