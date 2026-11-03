/* Discovery: walk the configured roots for git repositories (and their submodules), list each
   repository's files with git (so .gitignore is respected and node_modules never scanned), and
   run every detector. Read-only. */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { detectors } from './detectors/index.mjs';

const expand = (p) => resolve(String(p).replace(/^~(?=\/|$)/, homedir()));
const SKIP = new Set(['node_modules', 'Library', '.Trash', '.cache', '.npm', '.git', 'Applications', 'Movies', 'Music', 'Pictures', '.wrangler', 'dist', 'build', 'DerivedData', 'Pods']);

/* Glob with ~, **, * and ? → RegExp over absolute paths. */
export const globToRegExp = (glob) => {
  const g = expand(glob.startsWith('**') ? '/' + glob : glob).replace(/^\/\*\*/, '**');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { re += '.*'; i++; if (g[i + 1] === '/') i++; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
};

const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });

export const findRepos = (roots, { exclude = [], maxDepth = 4 } = {}) => {
  const excluded = exclude.map(globToRegExp);
  const found = new Set();
  const walk = (dir, depth) => {
    if (excluded.some((re) => re.test(dir) || re.test(dir + '/'))) return;
    if (existsSync(join(dir, '.git'))) {
      found.add(dir);
      try { for (const sub of git(dir, ['submodule', 'foreach', '--quiet', '--recursive', 'pwd']).split('\n').filter(Boolean)) found.add(sub); } catch { /* no submodules or git error */ }
      return;
    }
    if (depth >= maxDepth) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink() || SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.config')) continue;
      walk(join(dir, e.name), depth + 1);
    }
  };
  for (const r of roots) walk(expand(r), 0);
  return [...found].sort();
};

export const repoFiles = (dir) => {
  try { return git(dir, ['ls-files', '-co', '--exclude-standard']).split('\n').filter(Boolean); }
  catch { return []; }
};

/* Unique, readable name: the folder name, or parent/folder when two repos share a name. */
export const nameRepos = (paths) => {
  const counts = paths.reduce((m, p) => m.set(basename(p), (m.get(basename(p)) || 0) + 1), new Map());
  return Object.fromEntries(paths.map((p) => [counts.get(basename(p)) > 1 ? relative(homedir(), p) : basename(p), p]));
};

export const discover = ({ roots = ['~'], exclude = [], maxDepth } = {}) => {
  const repos = {};
  for (const [name, path] of Object.entries(nameRepos(findRepos(roots, { exclude, maxDepth })))) {
    const files = repoFiles(path);
    const findings = detectors.flatMap((d) => d.detect(path, files));
    const ecosystems = [...new Set(findings.map((f) => f.ecosystem))];
    if (ecosystems.length) repos[name] = { path, ecosystems, findings };
  }
  return repos;
};

export const isDirty = (dir) => {
  try { return git(dir, ['status', '--porcelain']).split('\n').filter(Boolean); } catch { return ['not a git repository']; }
};

export const stat = (p) => { try { return statSync(p); } catch { return null; } };
