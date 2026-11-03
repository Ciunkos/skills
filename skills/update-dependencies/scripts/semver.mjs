/* Minimal semver for picking upgrade targets: parse, compare, classify, and choose the newest
   stable release that is old enough. No ranges beyond what the picker needs. */

export const parse = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v).trim());
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || '' } : null;
};

export const compare = (a, b) => {
  const x = typeof a === 'string' ? parse(a) : a, y = typeof b === 'string' ? parse(b) : b;
  if (!x || !y) throw new Error(`Not a version: ${!x ? a : b}`);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch || (x.pre === y.pre ? 0 : !x.pre ? 1 : !y.pre ? -1 : x.pre < y.pre ? -1 : 1);
};

export const kind = (from, to) => {
  const x = parse(from), y = parse(to);
  if (!x || !y) return 'unknown';
  if (x.major !== y.major) return 'major';
  /* 0.x minors break by convention (0.170 → 0.186 in three.js). */
  if (x.minor !== y.minor) return x.major === 0 ? 'major' : 'minor';
  return x.patch !== y.patch ? (x.major === 0 && x.minor === 0 ? 'major' : 'patch') : 'none';
};

/* The range prefix a manifest uses, so an upgrade keeps the user's style. */
export const prefixOf = (spec) => (/^\^/.test(spec) ? '^' : /^~/.test(spec) ? '~' : /^\d/.test(spec) ? '' : null);

/**
 * Newest stable version published at least `minAgeDays` before `now`, never below `current`.
 * `times` is the registry's version → ISO publish date map. `allowMajor: false` keeps the major.
 * Returns { version, publishedAt, kind } or null when nothing newer is eligible.
 */
export const pickTarget = ({ times, current, minAgeDays = 7, now = Date.now(), allowMajor = true, exclude = [] }) => {
  const cur = parse(current);
  if (!cur) return null;
  const cutoff = now - minAgeDays * 86_400_000;
  let best = null;
  for (const [v, at] of Object.entries(times || {})) {
    const p = parse(v);
    if (!p || p.pre || exclude.includes(v)) continue;
    if (Date.parse(at) > cutoff) continue;
    if (compare(p, cur) <= 0) continue;
    if (!allowMajor && kind(current, v) === 'major') continue;
    if (!best || compare(p, best.v) > 0) best = { v: p, version: v, publishedAt: at };
  }
  return best && { version: best.version, publishedAt: best.publishedAt, kind: kind(current, best.version) };
};

/* True when `version` satisfies a simple hold: an exact version, `<x.y.z`, `<=`, `^x`, `~x.y`, or `x.y.z - a.b.c`. */
/* "18" → "18.0.0", "1.2" → "1.2.0": holds are written by hand and often short. */
const full = (s) => { const p = String(s).trim().replace(/^v/, '').split('.'); while (p.length < 3) p.push('0'); return p.join('.'); };

export const allowedByHold = (version, hold) => {
  if (!hold) return true;
  const v = parse(version);
  if (!v) return false;
  return String(hold).split('||').some((part) => {
    const h = part.trim();
    let m;
    if ((m = /^<=\s*(.+)$/.exec(h))) return compare(v, full(m[1])) <= 0;
    if ((m = /^<\s*(.+)$/.exec(h))) return compare(v, full(m[1])) < 0;
    if ((m = /^>=\s*(.+)$/.exec(h))) return compare(v, full(m[1])) >= 0;
    if ((m = /^\^\s*(.+)$/.exec(h))) { const b = parse(full(m[1])); return !!b && v.major === b.major && (b.major > 0 || v.minor === b.minor) && compare(v, b) >= 0; }
    if ((m = /^~\s*(.+)$/.exec(h))) { const b = parse(full(m[1])); return !!b && v.major === b.major && v.minor === b.minor && compare(v, b) >= 0; }
    if ((m = /^(\S+)\s+-\s+(\S+)$/.exec(h))) return compare(v, full(m[1])) >= 0 && compare(v, full(m[2])) <= 0;
    if ((m = /^(\d+)(?:\.x)?$/.exec(h))) return v.major === +m[1];
    if ((m = /^(\d+)\.(\d+)(?:\.x)?$/.exec(h))) return v.major === +m[1] && v.minor === +m[2];
    return parse(h) ? compare(v, h) === 0 : false;
  });
};
