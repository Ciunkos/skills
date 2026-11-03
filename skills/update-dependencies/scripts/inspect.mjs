/* Supply-chain review of one npm upgrade: diff the published tarballs and the registry metadata
   of two versions and report signals with a verdict (ok, review, concern). Heuristics, not proof:
   a concern means "a human or the agent must read this before installing". */
import { makeRegistry } from './registry.mjs';

const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare', 'preprepare', 'postprepare'];
const CODE = /\.(c|m)?js$|\.(c|m)?ts$|\.jsx?$|\.tsx?$/;
const TEXT = /\.(c|m)?[jt]sx?$|\.json$|\.md$|\.txt$|\.d\.ts$|\.map$|\.css$|\.html?$|\.ya?ml$|LICENSE|README|CHANGELOG|\.flow$/i;
const SECRET_ENV = /process\.env(?:\.|\[\s*['"`])(NPM_TOKEN|NODE_AUTH_TOKEN|GITHUB_TOKEN|GH_TOKEN|AWS_[A-Z_]+|AZURE_[A-Z_]+|GOOGLE_[A-Z_]+|[A-Z_]*SECRET[A-Z_]*|[A-Z_]*PASSWORD[A-Z_]*)/g;
const RISKY = [
  ['child-process', /require\(\s*['"`](?:node:)?child_process['"`]\s*\)|from\s+['"`](?:node:)?child_process['"`]/g],
  ['dynamic-code', /\beval\s*\(|new\s+Function\s*\(|vm\.runIn(?:New|This)?Context/g],
  ['network', /require\(\s*['"`](?:node:)?(?:https?|net|dgram|dns|tls)['"`]\s*\)|from\s+['"`](?:node:)?(?:https?|net|dgram|dns|tls)['"`]/g],
  ['obfuscation', /_0x[0-9a-f]{4,}|\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){40,}/gi],
  ['blob', /['"`][A-Za-z0-9+/=]{2000,}['"`]/g]
];

const entropy = (s) => {
  if (!s.length) return 0;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let h = 0;
  for (const n of counts.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
};
const countMatches = (text, re) => (text.match(re) || []).length;
const isBinary = (buf) => buf.subarray(0, 8000).includes(0);

/* Changelog text between the new version's heading and the old one's, capped. */
export const changelogSection = (files, from, to, limit = 6000) => {
  const name = [...files.keys()].find((f) => /^(CHANGELOG|HISTORY|CHANGES|RELEASES)(\.md)?$/i.test(f));
  if (!name) return null;
  const text = files.get(name).toString('utf8');
  const head = (v) => new RegExp(`^#{1,4}[^\\n]*\\b${v.replace(/\./g, '\\.')}\\b`, 'm');
  const start = text.search(head(to)), end = text.search(head(from));
  const slice = start >= 0 ? text.slice(start, end > start ? end : undefined) : text;
  return { file: name, text: slice.slice(0, limit), truncated: slice.length > limit };
};

export const compareVersions = ({ name, from, to, before, after, docBefore, docAfter }) => {
  const signals = [];
  const add = (severity, code, detail) => signals.push({ severity, code, detail });
  const pkgA = before.meta || {}, pkgB = after.meta || {};
  const scriptsA = pkgA.scripts || {}, scriptsB = pkgB.scripts || {};
  for (const k of LIFECYCLE) {
    if (scriptsB[k] && !scriptsA[k]) add('concern', 'install-script-added', `${k}: ${scriptsB[k]}`);
    else if (scriptsB[k] && scriptsA[k] !== scriptsB[k]) add('concern', 'install-script-changed', `${k}: ${scriptsA[k]} → ${scriptsB[k]}`);
  }
  if (pkgB.gypfile && !pkgA.gypfile) add('concern', 'native-build-added', 'gypfile: true');
  const filesA = before.files, filesB = after.files;
  const added = [...filesB.keys()].filter((f) => !filesA.has(f));
  const removed = [...filesA.keys()].filter((f) => !filesB.has(f));
  const changed = [...filesB.keys()].filter((f) => filesA.has(f) && !filesA.get(f).equals(filesB.get(f)));
  for (const f of added) {
    const buf = filesB.get(f);
    if (/\.node$/.test(f)) add('concern', 'native-binary-added', f);
    else if (!TEXT.test(f) && isBinary(buf) && buf.length > 1024) add('review', 'binary-added', `${f} (${buf.length} B)`);
  }
  for (const f of [...added, ...changed].filter((x) => CODE.test(x))) {
    const textB = filesB.get(f).toString('utf8'), textA = filesA.has(f) ? filesA.get(f).toString('utf8') : '';
    for (const [code, re] of RISKY) {
      const n = countMatches(textB, re) - countMatches(textA, re);
      if (n > 0) add(code === 'obfuscation' || code === 'blob' ? 'concern' : 'review', code, `${f}: +${n}`);
    }
    const secrets = new Set([...textB.matchAll(SECRET_ENV)].map((m) => m[1])), had = new Set([...textA.matchAll(SECRET_ENV)].map((m) => m[1]));
    const fresh = [...secrets].filter((k) => !had.has(k));
    if (fresh.length) add('concern', 'reads-secrets', `${f}: ${fresh.join(', ')}`);
    const longest = textB.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
    if (!filesA.has(f) && longest > 5000 && entropy(textB.slice(0, 20000)) > 5.3 && !/\.min\.|dist\/|umd\//.test(f)) add('concern', 'high-entropy-code', `${f}: line ${longest} chars`);
  }
  const depsA = { ...pkgA.dependencies, ...pkgA.optionalDependencies }, depsB = { ...pkgB.dependencies, ...pkgB.optionalDependencies };
  const newDeps = Object.keys(depsB).filter((d) => !(d in depsA));
  if (newDeps.length) add('review', 'dependencies-added', newDeps.map((d) => `${d}@${depsB[d]}`).join(', '));
  if (pkgB.bin && JSON.stringify(pkgB.bin) !== JSON.stringify(pkgA.bin)) add('review', 'bin-changed', JSON.stringify(pkgB.bin));
  const licA = String(pkgA.license || ''), licB = String(pkgB.license || '');
  if (licA !== licB) add('concern', 'license-changed', `${licA || 'none'} → ${licB || 'none'}`);
  const vA = docBefore?.versions?.[from] || {}, vB = docAfter?.versions?.[to] || {};
  const maintainers = new Set((vA.maintainers || docBefore?.maintainers || []).map((m) => m.name || m.email));
  /* Trusted publishing (npm OIDC from CI) publishes as "GitHub Actions" with provenance: expected,
     not a takeover. Flag a publisher that differs from the previous one and is not a maintainer. */
  const publisher = vB._npmUser?.name, previous = vA._npmUser?.name;
  const trusted = !!vB._npmUser?.trustedPublisher || (/^github actions$/i.test(publisher || '') && !!vB.dist?.attestations);
  if (publisher && publisher !== previous && !maintainers.has(publisher) && !trusted) add('concern', 'new-publisher', `${publisher} published ${to}; ${from} was published by ${previous || 'unknown'} and ${publisher} is not a maintainer`);
  if (previous && /^github actions$/i.test(previous) && publisher && !/^github actions$/i.test(publisher)) add('concern', 'publishing-moved-off-ci', `${from} came from trusted CI publishing, ${to} was published by ${publisher}`);
  if (vA.dist?.attestations && !vB.dist?.attestations) add('concern', 'provenance-lost', `${from} had provenance attestations, ${to} has none`);
  if (vB.deprecated) add('review', 'deprecated', String(vB.deprecated));
  if (pkgB.engines?.node && pkgB.engines.node !== pkgA.engines?.node) add('review', 'engines-changed', `node ${pkgA.engines?.node || 'any'} → ${pkgB.engines.node}`);
  const size = (m) => [...m.values()].reduce((n, b) => n + b.length, 0);
  const sizeA = size(filesA), sizeB = size(filesB);
  if (sizeB > 500_000 && sizeB > sizeA * 3) add('review', 'size-jump', `${sizeA} → ${sizeB} bytes unpacked`);
  const verdict = signals.some((s) => s.severity === 'concern') ? 'concern' : signals.length ? 'review' : 'ok';
  return {
    name, from, to, verdict, signals,
    integrity: { from: vA.dist?.integrity || null, to: vB.dist?.integrity || null },
    stats: { added: added.length, removed: removed.length, changed: changed.length, sizeFrom: sizeA, sizeTo: sizeB },
    files: { added: added.slice(0, 40), removed: removed.slice(0, 40), changed: changed.slice(0, 40) },
    repository: (pkgB.repository && (pkgB.repository.url || pkgB.repository)) || null,
    changelog: changelogSection(filesB, from, to)
  };
};

export const inspectNpm = async ({ name, from, to, registry = makeRegistry() }) => {
  const [docBefore, docAfter] = await Promise.all([registry.packument(name), registry.packument(name)]);
  const [before, after] = await Promise.all([registry.tarball(name, from), registry.tarball(name, to)]);
  const read = (t) => ({ meta: JSON.parse(t.files.get('package.json')?.toString('utf8') || '{}'), files: t.files });
  return compareVersions({ name, from, to, before: read(before), after: read(after), docBefore, docAfter });
};
