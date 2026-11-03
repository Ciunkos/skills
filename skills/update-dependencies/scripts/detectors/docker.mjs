/* Dockerfile base images (FROM). For Docker Hub images: a newer tag of the same flavor
   (same suffix, same precision, old enough), and a digest pin so the build cannot drift:
   FROM image:<exact version tag>@sha256:<digest>. node images take their major from the
   node-runtime detector (LTS only); this module still pins them. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compare } from '../semver.mjs';

export const id = 'docker';
export const reference = 'references/detectors/docker.md';

export const parseRef = (ref) => {
  const [withTag, digest = null] = ref.split('@');
  const slash = withTag.indexOf('/');
  const hasRegistry = slash > 0 && /[.:]|^localhost$/.test(withTag.slice(0, slash));
  const registry = hasRegistry ? withTag.slice(0, slash) : 'docker.io';
  const rest = hasRegistry ? withTag.slice(slash + 1) : withTag;
  const colon = rest.lastIndexOf(':');
  const name = colon > 0 ? rest.slice(0, colon) : rest, tag = colon > 0 ? rest.slice(colon + 1) : 'latest';
  return { registry, name, repo: registry === 'docker.io' && !name.includes('/') ? `library/${name}` : name, tag, digest };
};

export const detect = (repo, files) => files.filter((f) => /(^|\/)(Dockerfile|Containerfile)[^/]*$/.test(f)).flatMap((f) => {
  let text = '';
  try { text = readFileSync(join(repo, f), 'utf8'); } catch { return []; }
  const stages = new Set();
  const out = [];
  for (const m of text.matchAll(/^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/gim)) {
    const ref = m[1];
    if (m[2]) stages.add(m[2].toLowerCase());
    if (ref === 'scratch' || ref.includes('$') || stages.has(ref.toLowerCase())) continue;
    out.push({ ecosystem: id, file: f, ref, ...parseRef(ref) });
  }
  return out;
});

const versionTag = (tag) => { const m = /^v?(\d+(?:\.\d+){0,2})(.*)$/.exec(tag); return m ? { nums: m[1], parts: m[1].split('.').length, suffix: m[2] } : null; };
const asSemver = (nums) => { const p = nums.split('.'); while (p.length < 3) p.push('0'); return p.join('.'); };

export const hubTags = async (repo, { fetcher = fetch, pages = 4 } = {}) => {
  const tags = [];
  let url = `https://hub.docker.com/v2/repositories/${repo}/tags?page_size=100&ordering=last_updated`;
  for (let i = 0; i < pages && url; i++) {
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`Docker Hub ${repo}: HTTP ${res.status}`);
    const page = await res.json();
    tags.push(...page.results.map((t) => ({ name: t.name, digest: t.digest, at: t.tag_last_pushed || t.last_updated })));
    url = page.next;
  }
  return tags;
};

export const outdated = async (repo, finding, { fetcher, minAgeDays = 7, now = Date.now(), nodeLts } = {}) => {
  if (finding.registry !== 'docker.io') return [{ ecosystem: id, file: finding.file, name: finding.name, from: finding.tag, to: null, kind: 'review', note: `${finding.registry} is not Docker Hub; check tags and pin a digest by hand` }];
  const tags = await hubTags(finding.repo, { fetcher });
  const cur = versionTag(finding.tag);
  const cutoff = now - minAgeDays * 86_400_000;
  let to = finding.tag;
  if (finding.name === 'node' && cur && nodeLts && +cur.nums.split('.')[0] < nodeLts.major) to = `${nodeLts.major}${cur.suffix}`;
  else if (finding.name !== 'node' && cur) {
    const better = tags.map((t) => ({ ...t, v: versionTag(t.name) }))
      .filter((t) => t.v && t.v.suffix === cur.suffix && t.v.parts === cur.parts && Date.parse(t.at) <= cutoff && compare(asSemver(t.v.nums), asSemver(cur.nums)) > 0)
      .sort((a, b) => compare(asSemver(b.v.nums), asSemver(a.v.nums)))[0];
    if (better) to = better.name;
  }
  const target = tags.find((t) => t.name === to);
  if (!target) return to === finding.tag ? [] : [{ ecosystem: id, file: finding.file, name: finding.name, from: finding.tag, to, kind: 'major', note: 'target tag not in the newest Docker Hub pages; verify it exists before applying' }];
  /* The most specific tag sharing the digest gives a readable pin (26.13.0-bookworm-slim). */
  const exact = tags.filter((t) => t.digest === target.digest).map((t) => ({ ...t, v: versionTag(t.name) })).filter((t) => t.v && t.v.suffix === (cur?.suffix ?? ''))
    .sort((a, b) => b.v.parts - a.v.parts)[0]?.name || to;
  const pinned = finding.digest === target.digest;
  if (to === finding.tag && pinned) return [];
  return [{
    ecosystem: id, file: finding.file, name: finding.name, from: finding.digest ? `${finding.tag}@${finding.digest.slice(0, 19)}…` : finding.tag,
    to: `${exact}@${target.digest}`, kind: to === finding.tag ? 'pin' : (cur && versionTag(to) && +versionTag(to).nums.split('.')[0] > +cur.nums.split('.')[0] ? 'major' : 'minor'),
    line: `FROM ${finding.registry === 'docker.io' ? '' : finding.registry + '/'}${finding.name}:${exact}@${target.digest}`,
    note: to === finding.tag ? 'pin the current tag by digest' : `newer tag ${to}`
  }];
};
