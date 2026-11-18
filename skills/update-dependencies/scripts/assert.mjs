/* assert.mjs: compare a repository's working tree with what the run recorded for it, so a run
   cannot finish with an upgrade that was planned but never landed, landed at another version,
   was undone by a later step, or moved although it was held. Read-only: reads files and git HEAD.

   Errors (the run cannot finish until they are fixed or the run is closed as incomplete):
   - a planned item with no outcome (applied, held, or rolled back);
   - an applied npm item whose lockfile version is not the applied version (a later rollback
     restored an older lockfile, a ^ range resolved past the target without a cooldown, ...);
   - an applied item of another ecosystem whose file does not contain the target;
   - a held or rolled-back npm item that moved anyway (npm audit fix, a peer group install);
   - a direct dependency that went down since git HEAD without a recorded outcome;
   - an npm project with a lockfile and no min-release-age in .npmrc;
   - no passing `verified` record after the last change.
   Warnings: direct dependencies that changed without a recorded outcome (inspect them), and
   transitive downgrades (often the cooldown at work; say so in the notes). */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { compare, parse } from './semver.mjs';

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const headJson = (repo, rel) => { try { return JSON.parse(execFileSync('git', ['-C', repo, 'show', `HEAD:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 })); } catch { return null; } };
const rel = (project, file) => (project && project !== '.' ? `${project}/${file}` : file);
const locked = (lock, name) => lock?.packages?.[`node_modules/${name}`]?.version || lock?.dependencies?.[name]?.version || null;
const lower = (a, b) => { try { return parse(a) && parse(b) && compare(a, b) < 0; } catch { return false; } };

/* An outcome names the item it covers: the plan's name, the plan's name followed by detail
   ("node (setup-node) .github/workflows/test.yml"), or a group whose name lists it
   ("react group (react, react-dom, @types/react)"). */
const covers = (entry, name) => {
  const n = String(entry.name);
  return n === name || n.startsWith(name + ' ') || (n.includes('(') && n.split(/[\s,()]+/).includes(name));
};

export const assertRepo = ({ path, record, minReleaseAgeDays = 7 }) => {
  const errors = [], warnings = [];
  const { planned = [], applied = [], held = [], rolledBack = [], verified = [] } = record || {};
  const outcomes = [...applied.map((e) => ({ ...e, outcome: 'applied' })), ...held.map((e) => ({ ...e, outcome: 'held' })), ...rolledBack.map((e) => ({ ...e, outcome: 'rolledBack' }))];
  const lockCache = new Map();
  const lockOf = (project) => {
    const key = project || '.';
    if (!lockCache.has(key)) lockCache.set(key, readJson(join(path, rel(project, 'package-lock.json'))));
    return lockCache.get(key);
  };

  for (const item of planned) {
    const mine = outcomes.filter((o) => covers(o, item.name));
    if (!mine.length) { errors.push(`unresolved: ${item.name} ${item.from} → ${item.to} has no outcome (applied, held or rolled back)`); continue; }
    const done = mine.filter((o) => o.outcome === 'applied');
    if (item.ecosystem === 'npm' && item.kind === 'config') {
      if (done.length) {
        const rc = join(path, rel(item.project, '.npmrc'));
        if (!existsSync(rc) || !/^\s*min-release-age\s*=/m.test(readFileSync(rc, 'utf8'))) errors.push(`${rel(item.project, '.npmrc')}: applied but has no min-release-age`);
      }
      continue;
    }
    if (item.ecosystem === 'npm') {
      const lock = lockOf(item.project);
      if (!lock) continue;
      const now = locked(lock, item.name);
      if (done.length) {
        /* The last applied outcome is the version that must be installed (it may differ from the
           plan, for example a corrected target); a later rollback of it is fine if the lockfile
           is back at `from`. */
        const want = done.at(-1).to;
        const undone = mine.some((o) => o.outcome === 'rolledBack' && o.to === want);
        /* A group outcome carries one version; its members may land at their own plan targets. */
        const groupMember = done.at(-1).name !== item.name && now === item.to;
        if (now !== want && !groupMember && !(undone && now === item.from)) errors.push(`${item.name}: applied ${want} but ${rel(item.project, 'package-lock.json')} has ${now ?? 'nothing'}${now && !lower(now, want) ? ' (resolved past the target: is min-release-age set?)' : ' (a later step restored an older lockfile?)'}`);
      } else if (now !== item.from) {
        errors.push(`${item.name}: ${mine[0].outcome} at ${item.from} but the lockfile has ${now ?? 'nothing'} (moved by another step, such as npm audit fix or a group install)`);
      }
      continue;
    }
    if (done.length && item.file) {
      const file = join(path, item.file);
      const want = String(done.at(-1).to || '').split(' ')[0];
      const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (want && !text.includes(want)) errors.push(`${item.file}: applied ${item.name} ${want} but the file does not contain it`);
    }
  }

  /* Whole-project checks for every npm project the run planned. */
  const projects = [...new Set(planned.filter((i) => i.ecosystem === 'npm').map((i) => i.project || '.'))];
  for (const project of projects) {
    const lock = lockOf(project);
    if (!lock) continue;
    const rc = join(path, rel(project, '.npmrc'));
    const cooled = existsSync(rc) && /^\s*min-release-age\s*=/m.test(readFileSync(rc, 'utf8'));
    const npmrcHeld = held.some((h) => h.name === '.npmrc');
    if (!cooled && !npmrcHeld) errors.push(`${rel(project, '.npmrc')}: no min-release-age, so ^ ranges can resolve releases younger than ${minReleaseAgeDays} days`);
    const before = headJson(path, rel(project, 'package-lock.json'));
    if (!before) continue;
    const pkg = readJson(join(path, rel(project, 'package.json'))) || {};
    const direct = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }));
    for (const [key, entry] of Object.entries(lock.packages || {})) {
      if (!key) continue;
      const was = before.packages?.[key]?.version, is = entry.version;
      if (!was || !is || was === is) continue;
      const name = key.replace(/^.*node_modules\//, '');
      const top = key === `node_modules/${name}` && direct.has(name);
      const explained = outcomes.some((o) => covers(o, name));
      if (lower(is, was)) {
        if (top && !explained) errors.push(`${name}: went down ${was} → ${is} with no recorded outcome`);
        else if (!top) warnings.push(`${key}: transitive downgrade ${was} → ${is} (the cooldown moving off a too-young release? say so in the notes)`);
      } else if (top && !explained) warnings.push(`${name}: changed ${was} → ${is} with no recorded outcome; inspect it and record it`);
    }
  }

  const lastCheck = verified.at(-1);
  if (applied.length && !lastCheck) errors.push('no verified record: run the repository checks and record them');
  else if (lastCheck && !lastCheck.ok) errors.push('the last verified record failed: fix or roll back, then verify again');
  else if (lastCheck && record.lastChangeAt && lastCheck.at < record.lastChangeAt) errors.push('the repository changed after the last verified record: run the checks again');

  return { ok: errors.length === 0, errors, warnings };
};
