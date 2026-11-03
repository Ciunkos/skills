/* npm: every package.json outside node_modules (nested projects included). Current versions come
   from package-lock.json when present; targets keep the manifest's range prefix (^ by default). */
import { readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { pickTarget, prefixOf, allowedByHold, parse } from '../semver.mjs';

export const id = 'npm';
export const reference = 'references/detectors/npm.md';
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

export const detect = (repo, files) => files
  .filter((f) => f.endsWith('/package.json') || f === 'package.json')
  .filter((f) => !f.includes('node_modules/'))
  .map((f) => {
    const dir = dirname(join(repo, f));
    let pkg = {};
    try { pkg = JSON.parse(readFileSync(join(repo, f), 'utf8')); } catch { return null; }
    const lock = existsSync(join(dir, 'package-lock.json')) ? 'package-lock.json' : existsSync(join(dir, 'npm-shrinkwrap.json')) ? 'npm-shrinkwrap.json' : null;
    const count = SECTIONS.reduce((n, s) => n + Object.keys(pkg[s] || {}).length, 0);
    return count ? { ecosystem: id, manifest: f, project: relative(repo, dir) || '.', lock, npmrc: existsSync(join(dir, '.npmrc')) } : null;
  })
  .filter(Boolean);

const lockedVersion = (lock, name) => lock?.packages?.[`node_modules/${name}`]?.version || lock?.dependencies?.[name]?.version || null;

export const outdated = async (repo, finding, { registry, minAgeDays, now = Date.now(), holds = {} }) => {
  const dir = join(repo, finding.project);
  const pkg = JSON.parse(readFileSync(join(repo, finding.manifest), 'utf8'));
  const lock = finding.lock ? JSON.parse(readFileSync(join(dir, finding.lock), 'utf8')) : null;
  const items = [];
  for (const section of SECTIONS) for (const [name, spec] of Object.entries(pkg[section] || {})) {
    const prefix = prefixOf(spec);
    if (prefix === null) continue; /* file:, git, npm: aliases, workspace:, tags: not registry semver */
    const current = lockedVersion(lock, name) || spec.replace(/^[\^~]/, '');
    if (!parse(current)) continue;
    let doc;
    try { doc = await registry.packument(name); } catch (e) { items.push({ ecosystem: id, project: finding.project, name, from: current, error: e.message }); continue; }
    const hold = holds[name];
    const exclude = hold?.hold ? Object.keys(doc.time || {}).filter((v) => parse(v) && !allowedByHold(v, hold.hold)) : [];
    const target = pickTarget({ times: doc.time, current, minAgeDays, now, exclude });
    const latest = doc['dist-tags']?.latest;
    if (target) items.push({
      ecosystem: id, project: finding.project, section, name, from: current, to: target.version, kind: target.kind,
      spec, newSpec: `${prefix === '' ? '^' : prefix}${target.version}`, publishedAt: target.publishedAt, latest,
      hold: hold?.hold ? { range: hold.hold, reason: hold.reason || '' } : null
    });
    else if (latest && latest !== current && hold?.hold) items.push({ ecosystem: id, project: finding.project, section, name, from: current, to: null, kind: 'held', latest, hold: { range: hold.hold, reason: hold.reason || '' } });
  }
  return items;
};
