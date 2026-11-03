/* Python: exact pins (name==x.y.z) in requirements*.txt and PEP 621 pyproject.toml dependency
   lists. Targets from PyPI release upload times. Ranges and lock tools (uv, poetry) are listed
   for the agent to update with their own commands. */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pickTarget, parse } from '../semver.mjs';

export const id = 'python';
export const reference = 'references/detectors/python.md';

export const detect = (repo, files) => files.filter((f) => /(^|\/)(requirements[^/]*\.txt|pyproject\.toml)$/.test(f)).map((f) => {
  let text = '';
  try { text = readFileSync(join(repo, f), 'utf8'); } catch { return null; }
  const pins = [...text.matchAll(/^\s*['"]?([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*==\s*([0-9][^\s;'",#]*)/gm)].map((m) => ({ name: m[1], version: m[2] }));
  const dir = dirname(join(repo, f));
  const lock = ['uv.lock', 'poetry.lock', 'Pipfile.lock'].find((l) => existsSync(join(dir, l))) || null;
  return { ecosystem: id, manifest: f, pins, lock };
}).filter((x) => x && (x.pins.length || x.lock));

export const outdated = async (repo, finding, { fetcher = fetch, minAgeDays = 7, now = Date.now() }) => {
  const items = [];
  for (const { name, version } of finding.pins) {
    if (!parse(version)) continue;
    const res = await fetcher(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
    if (!res.ok) { items.push({ ecosystem: id, manifest: finding.manifest, name, from: version, error: `PyPI HTTP ${res.status}` }); continue; }
    const doc = await res.json();
    const times = Object.fromEntries(Object.entries(doc.releases || {}).filter(([, files]) => files.length && !files.every((x) => x.yanked)).map(([v, files]) => [v, files.map((x) => x.upload_time_iso_8601).sort()[0]]));
    const target = pickTarget({ times, current: version, minAgeDays, now });
    if (target) items.push({ ecosystem: id, manifest: finding.manifest, name, from: version, to: target.version, kind: target.kind, publishedAt: target.publishedAt });
  }
  if (finding.lock) items.push({ ecosystem: id, manifest: finding.manifest, name: finding.lock, from: 'locked', to: null, kind: 'review', note: `update with the lock tool (${finding.lock}), respecting the release-age rule` });
  return items;
};
