/* Node.js runtime declarations: .nvmrc, .node-version, package.json engines.node, setup-node in
   GitHub workflows, and FROM node:<tag> in Dockerfiles. Target: the newest LTS major whose
   release is old enough (nodejs.org/dist/index.json). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const id = 'node-runtime';
export const reference = 'references/detectors/node-runtime.md';
const majorOf = (s) => { const m = /(\d+)/.exec(String(s)); return m ? +m[1] : null; };

export const detect = (repo, files) => {
  const found = [];
  const read = (f) => { try { return readFileSync(join(repo, f), 'utf8'); } catch { return ''; } };
  for (const f of files) {
    if (/(^|\/)\.(nvmrc|node-version)$/.test(f)) found.push({ ecosystem: id, file: f, kind: 'version-file', value: read(f).trim() });
    else if (/(^|\/)package\.json$/.test(f) && !f.includes('node_modules/')) {
      try { const e = JSON.parse(read(f)).engines?.node; if (e) found.push({ ecosystem: id, file: f, kind: 'engines', value: e }); } catch { /* not JSON */ }
    } else if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)) {
      for (const m of read(f).matchAll(/node-version:\s*['"]?([^'"\n#]+)/g)) found.push({ ecosystem: id, file: f, kind: 'setup-node', value: m[1].trim() });
    } else if (/(^|\/)Dockerfile[^/]*$/.test(f)) {
      for (const m of read(f).matchAll(/^FROM\s+(?:--platform=\S+\s+)?node:([^\s@]+)/gim)) found.push({ ecosystem: id, file: f, kind: 'docker', value: m[1] });
    }
  }
  return found.filter((x) => x.value && !/node-version-file/.test(x.value));
};

export const latestLts = async ({ fetcher = fetch, minAgeDays = 7, now = Date.now() } = {}) => {
  const res = await fetcher('https://nodejs.org/dist/index.json');
  if (!res.ok) throw new Error(`nodejs.org index: HTTP ${res.status}`);
  const cutoff = now - minAgeDays * 86_400_000;
  const lts = (await res.json()).filter((r) => r.lts && Date.parse(r.date) <= cutoff);
  return lts.length ? { version: lts[0].version.replace(/^v/, ''), codename: lts[0].lts, date: lts[0].date, major: majorOf(lts[0].version) } : null;
};

/* One item per declaration below the newest LTS major. engines ranges are minimums: they are
   reported for review, not rewritten blindly. */
export const outdated = async (repo, finding, ctx) => {
  ctx.nodeLts ??= await latestLts(ctx);
  const lts = ctx.nodeLts;
  const major = majorOf(finding.value);
  if (!lts || major === null || major >= lts.major) return [];
  return [{
    ecosystem: id, name: `node (${finding.kind})`, file: finding.file, from: finding.value,
    to: finding.kind === 'docker' ? finding.value.replace(/^\d+(\.\d+)*/, String(lts.major)) : finding.kind === 'engines' ? `>=${lts.major}` : String(lts.major),
    kind: 'major', latest: lts.version, note: `Node ${lts.version} (${lts.codename}) is the newest LTS older than ${ctx.minAgeDays} days`
  }];
};
