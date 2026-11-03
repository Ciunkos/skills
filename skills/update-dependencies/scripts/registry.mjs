/* npm registry access: packuments, tarballs checked against dist.integrity, and an in-memory
   tar reader. Read-only; nothing here installs or executes package code. */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

export const registryUrl = (env = process.env) => (env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/+$/, '');
const UA = 'update-dependencies-skill (read-only dependency review)';

export const makeRegistry = ({ fetcher = fetch, base = registryUrl() } = {}) => {
  const cache = new Map();
  const getJson = async (url) => {
    if (cache.has(url)) return cache.get(url);
    const res = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': UA } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const json = await res.json();
    cache.set(url, json);
    return json;
  };
  const packument = (name) => getJson(`${base}/${name.startsWith('@') ? '@' + encodeURIComponent(name.slice(1)) : encodeURIComponent(name)}`);
  const tarball = async (name, version) => {
    const doc = await packument(name);
    const meta = doc.versions?.[version];
    if (!meta) throw new Error(`${name}@${version} is not in the registry`);
    const res = await fetcher(meta.dist.tarball, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${meta.dist.tarball}: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    verifyIntegrity(bytes, meta.dist);
    return { meta, bytes, files: readTar(gunzipSync(bytes)) };
  };
  return { packument, tarball };
};

/* sha512 SRI when present (all modern publishes), else the legacy sha1 shasum. */
export const verifyIntegrity = (bytes, dist = {}) => {
  if (dist.integrity) {
    const [algo, expected] = dist.integrity.split(' ')[0].split(/-(.+)/);
    const actual = createHash(algo).update(bytes).digest('base64');
    if (actual !== expected) throw new Error(`Integrity mismatch: expected ${dist.integrity}, got ${algo}-${actual}`);
    return dist.integrity;
  }
  if (dist.shasum) {
    const actual = createHash('sha1').update(bytes).digest('hex');
    if (actual !== dist.shasum) throw new Error(`Shasum mismatch: expected ${dist.shasum}, got ${actual}`);
    return 'sha1-' + dist.shasum;
  }
  throw new Error('Registry entry has no integrity or shasum');
};

/* ustar reader: regular files only, path prefix ("package/") stripped. Returns Map<path, Buffer>. */
export const readTar = (buf) => {
  const files = new Map();
  let off = 0, longName = null;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const str = (a, b) => header.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = str(345, 500);
    let name = longName || (prefix ? prefix + '/' : '') + str(0, 100);
    longName = null;
    const body = buf.subarray(off + 512, off + 512 + size);
    if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '');
    else if (type === '0' || type === '\0' || type === '7') files.set(name.replace(/^[^/]+\//, ''), Buffer.from(body));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
};
