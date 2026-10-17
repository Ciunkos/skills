/* release-lib.mjs — pure helpers for releases: versions, SKILL.md frontmatter, CHANGELOG sections.
   No file system, no git: release-plan.mjs and bump.mjs do the I/O, tests cover this file. */

export const parse = (v) => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim()); return m ? m.slice(1).map(Number) : null; };
export const cmp = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
export const next = (v, step) => { const [a, b, c] = parse(v); return step === 'major' ? `${a + 1}.0.0` : step === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`; };
export const STEPS = ['patch', 'minor', 'major'];
/* The step between two versions, for moving the pack by the largest step among its skills. */
export const step = (from, to) => { const x = parse(from), y = parse(to); return y[0] > x[0] ? 'major' : y[1] > x[1] ? 'minor' : 'patch'; };

/* `metadata.version: "1.2.3"` in the SKILL.md frontmatter (the only place the number lives). */
export function skillVersion(md) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md);
  const m = fm && /^\s+version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m.exec(fm[1]);
  return m ? m[1] : null;
}
export const setSkillVersion = (md, v) => md.replace(/^(\s+version:\s*)["']?\d+\.\d+\.\d+["']?(\s*)$/m, `$1"${v}"$2`);

/* Body of `## <version>` in a CHANGELOG, trimmed; null when the section is missing,
   '' when it holds only the placeholder comment bump.mjs writes. */
export function changelogSection(md, v) {
  const lines = String(md).split('\n');
  const start = lines.findIndex((l) => new RegExp('^##\\s+' + v.replace(/\./g, '\\.') + '\\b').test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
}

/* Insert `## <version>` right under the title, with a placeholder the release plan refuses to ship. */
export function addChangelogSection(md, v) {
  if (changelogSection(md, v) !== null) return md;
  const block = `## ${v}\n\n<!-- What changed for someone using the skill. The release refuses to ship this section empty. -->\n`;
  return /^# .*\n/.test(md) ? md.replace(/^(# .*\n\n?)/, `$1${block}\n`) : block + '\n' + md;
}

/* Latest released version of a skill from the tag list (`<skill>-v1.2.3`), or of the pack (`v1.2.3`). */
export function latest(tags, prefix) {
  const vs = tags.filter((t) => t.startsWith(prefix + 'v')).map((t) => t.slice(prefix.length + 1)).filter(parse);
  return vs.sort(cmp).pop() || null;
}
