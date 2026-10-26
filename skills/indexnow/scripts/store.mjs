/* External workspace persistence: durable events, replay, atomic snapshots, and lossless log archives. */
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, fsyncSync, appendFileSync, renameSync, unlinkSync, existsSync, truncateSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createState, applyEvent, siteName, summary } from './model.mjs';

export const defaultRoot = () => join(homedir(), 'indexnow');
const atomic = (file, text) => {
  const temp = `${file}.${randomUUID()}.tmp`, fd = openSync(temp, 'wx', 0o600);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
};
export const resolveRoot = (target, storage, preferences = join(defaultRoot(), 'preferences.json')) => {
  const key = siteName(target);
  let prefs = {};
  if (existsSync(preferences)) prefs = JSON.parse(readFileSync(preferences, 'utf8'));
  return resolve(storage ? storage.replace(/^~(?=\/|$)/, homedir()) : prefs[key] || defaultRoot());
};
export const rememberRoot = (target, root, preferences = join(defaultRoot(), 'preferences.json')) => {
  const parent = resolve(preferences, '..'); mkdirSync(parent, { recursive: true, mode: 0o700 });
  const release = acquireLock(parent, '.preferences.lock');
  try {
    const prefs = existsSync(preferences) ? JSON.parse(readFileSync(preferences, 'utf8')) : {};
    prefs[siteName(target)] = resolve(root); atomic(preferences, JSON.stringify(prefs, null, 2) + '\n');
  } finally { release(); }
};
export const acquireLock = (dir, name = '.lock') => {
  const file = join(dir, name);
  let fd;
  try { fd = openSync(file, 'wx', 0o600); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const owner = JSON.parse(readFileSync(file, 'utf8'));
    try { process.kill(owner.pid, 0); throw new Error('Workspace is locked by a running helper'); }
    catch (error) {
      if (error.code !== 'ESRCH') throw error;
      unlinkSync(file); fd = openSync(file, 'wx', 0o600);
    }
  }
  writeFileSync(fd, JSON.stringify({ pid: process.pid })); closeSync(fd);
  return () => unlinkSync(file);
};
export const openStore = (target, root = defaultRoot()) => {
  const dir = join(resolve(root), siteName(target));
  const stateFile = join(dir, 'state.json'), journal = join(dir, 'events.jsonl');
  const load = () => {
    let s = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : createState(target);
    if (s.version !== 1 || s.site !== siteName(target)) throw new Error('Unsupported workspace version or site mismatch');
    if (existsSync(journal)) {
      const text = readFileSync(journal, 'utf8'), complete = text.slice(0, text.lastIndexOf('\n') + 1);
      for (const line of complete.split('\n').filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.seq > s.seq) s = applyEvent(s, event);
      }
    }
    return s;
  };
  const commit = (s, type, data, at = new Date().toISOString()) => {
    const event = { seq: s.seq + 1, id: randomUUID(), type, data, at };
    const next = applyEvent(s, event);
    if (existsSync(journal)) {
      const bytes = readFileSync(journal), end = bytes.lastIndexOf(10) + 1;
      if (end !== bytes.length) {
        atomic(join(dir, `partial-${randomUUID()}.json`), bytes.subarray(end)); truncateSync(journal, end);
      }
    }
    const fd = openSync(journal, 'a', 0o600);
    try { appendFileSync(fd, JSON.stringify(event) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
    atomic(stateFile, JSON.stringify(next, null, 2) + '\n');
    return next;
  };
  const update = async (operation, { wordLimit = 50_000 } = {}) => {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!existsSync(join(dir, '.gitignore'))) atomic(join(dir, '.gitignore'), '*\n');
    const release = acquireLock(dir);
    try {
      let s = load();
      const emit = (type, data, at) => { s = commit(s, type, data, at); return s; };
      const result = await operation({ state: () => s, emit });
      let log = renderLog(s);
      if (log.trim().split(/\s+/).length > wordLimit) {
        const archives = join(dir, 'archives'); mkdirSync(archives, { recursive: true, mode: 0o700 });
        const archive = `${s.seq}-${randomUUID()}.md`;
        atomic(join(archives, archive), log); emit('compact', { archive }); log = renderLog(s);
      }
      atomic(join(dir, 'log.md'), log);
      return result;
    } finally { release(); }
  };
  return { dir, load, update };
};
const escape = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
export const renderLog = (s) => {
  const { counts } = summary(s);
  const lines = [`# Indexnow: ${s.site}`, '', `Inventory: ${counts.total}. Observed indexed: ${counts.indexedObserved}. Pending: ${counts.pending}. DLQ: ${counts.dlq}. Blocked: ${counts.blocked}. Needs review: ${counts.needsReview}.`, '',
    'Accepted requests are not proof of indexing. Full history is in events.jsonl and archives/.', ''];
  for (const r of s.runs.slice(s.logFrom)) {
    lines.push(`## ${r.at} (${r.id})`, '', `Status: ${r.status}. Inspections: ${r.inspected}. Accepted: ${r.accepted.length}. Previewed: ${r.previewed.length}.`, '');
    const detail = (value) => escape(s.compacted ? String(value ?? '').slice(0, 500) : value);
    if (r.quota) lines.push(`GSC quota response: ${detail(r.quota.evidence)}`, '');
    if (r.note) lines.push(detail(r.note), '');
    for (const a of s.compacted ? r.accepted.slice(-100) : r.accepted) lines.push(`- Accepted ${a.at}: ${a.url}${a.reconciledFrom ? ` (reconciled from ${a.reconciledFrom})` : ''}`);
    for (const o of s.compacted ? r.observations.slice(-20) : r.observations) lines.push(`- Observed ${o.at}: ${o.url}: indexed=${o.indexed}, status=${o.status}, last crawl=${o.lastCrawlAt || 'unknown'}. ${detail(o.evidence)}`);
    for (const e of s.compacted ? r.errors.slice(-20) : r.errors) lines.push(`- Needs attention ${e.at}: ${e.url}: ${detail(e.evidence)}`);
    for (const d of s.compacted ? r.dlq.slice(-20) : r.dlq) lines.push(`- DLQ ${d.at}: ${d.url}: ${escape(d.reason)}. Evidence: ${detail(d.evidence)}`);
    if (s.compacted) lines.push('Details summarized after compaction. Full messages and URL history remain in events.jsonl and archived logs.');
    lines.push('');
  }
  return lines.join('\n') + '\n';
};
