/* GitHub Actions `uses:` in .github/workflows and composite action.yml files. Target: the newest
   release at least minAgeDays old, pinned by full commit SHA with the version as a comment:
   uses: owner/repo@<40-hex sha> # v1.2.3. A tag or branch ref is reported as needing a pin
   even when it is already the newest release. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compare, parse, kind as kindOf } from '../semver.mjs';

export const id = 'github-actions';
export const reference = 'references/detectors/github-actions.md';
const SHA = /^[0-9a-f]{40}$/;

export const detect = (repo, files) => files
  .filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f) || /(^|\/)action\.ya?ml$/.test(f))
  .flatMap((f) => {
    let text = '';
    try { text = readFileSync(join(repo, f), 'utf8'); } catch { return []; }
    return [...text.matchAll(/^\s*-?\s*uses:\s*['"]?([\w.-]+\/[\w.-]+)(\/[^@\s'"]*)?@([^\s'"#]+)['"]?(?:\s*#\s*(\S+))?/gm)]
      .filter((m) => !m[1].startsWith('./') && !m[1].startsWith('docker:'))
      .map((m) => ({ ecosystem: id, file: f, action: m[1], path: m[2] || '', ref: m[3], comment: m[4] || null }));
  });

const tagVersion = (tag) => parse(String(tag).replace(/^v/, '')) && String(tag).replace(/^v/, '');
const normalize = (tag) => { const p = String(tag).replace(/^v/, '').split('.'); while (p.length < 3) p.push('0'); return p.join('.'); };

export const outdated = async (repo, finding, { github, minAgeDays = 7, now = Date.now() }) => {
  const cutoff = now - minAgeDays * 86_400_000;
  const releases = (await github.releases(finding.action)).filter((r) => tagVersion(r.tag) && Date.parse(r.at) <= cutoff)
    .sort((a, b) => compare(normalize(b.tag), normalize(a.tag)));
  const newest = releases[0];
  if (!newest) return [];
  const pinnedTo = SHA.test(finding.ref) ? (finding.comment || null) : finding.ref;
  const currentVersion = pinnedTo && /^v?\d/.test(pinnedTo) ? normalize(pinnedTo) : null;
  const behind = !currentVersion || compare(normalize(newest.tag), currentVersion) > 0;
  const needsPin = !SHA.test(finding.ref);
  if (!behind && !needsPin) return [];
  const sha = await github.commitOf(finding.action, newest.tag);
  if (!sha) return [{ ecosystem: id, file: finding.file, name: finding.action, from: finding.ref, to: newest.tag, kind: 'review', note: 'could not resolve the release tag to a commit' }];
  return [{
    ecosystem: id, file: finding.file, name: finding.action + finding.path, from: pinnedTo ? `${finding.ref.slice(0, 12)}${SHA.test(finding.ref) ? '… # ' + pinnedTo : ''}` : finding.ref,
    to: `${sha} # ${newest.tag}`, kind: currentVersion ? kindOf(currentVersion, normalize(newest.tag)) : 'pin',
    uses: `${finding.action}${finding.path}@${sha} # ${newest.tag}`, publishedAt: newest.at, note: needsPin ? 'pin by commit SHA (tags are mutable)' : ''
  }];
};
