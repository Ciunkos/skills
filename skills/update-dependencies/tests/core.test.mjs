/* Offline tests: version picking, the write-ahead store, discovery on a fixture tree, the tar
   reader, integrity checks, inspection signals, and Actions/Docker pinning with fake APIs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pickTarget, kind, allowedByHold, prefixOf } from '../scripts/semver.mjs';
import { openStore, applyEvent, createState } from '../scripts/store.mjs';
import { discover, findRepos, globToRegExp } from '../scripts/discover.mjs';
import { readTar, verifyIntegrity } from '../scripts/registry.mjs';
import { compareVersions } from '../scripts/inspect.mjs';
import * as actions from '../scripts/detectors/github-actions.mjs';
import * as docker from '../scripts/detectors/docker.mjs';
import * as npm from '../scripts/detectors/npm.mjs';

const DAY = 86_400_000, NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (d) => new Date(NOW - d * DAY).toISOString();
const tmp = () => mkdtempSync(join(tmpdir(), 'deps-test-'));

test('pickTarget: newest stable old enough, never lower than current', () => {
  const times = { '4.150.0': ago(30), '4.153.0': ago(9), '4.157.0': ago(0.2), '5.0.0-beta.1': ago(20), '4.156.0': ago(2) };
  assert.equal(pickTarget({ times, current: '4.150.0', minAgeDays: 7, now: NOW }).version, '4.153.0');
  assert.equal(pickTarget({ times, current: '4.156.0', minAgeDays: 7, now: NOW }), null, 'no downgrade from a newer installed version');
  assert.equal(pickTarget({ times: { '2.0.0': ago(30), '1.5.0': ago(30) }, current: '1.0.0', now: NOW, allowMajor: false }).version, '1.5.0');
});

test('kind: 0.x minors and 0.0.x patches are majors', () => {
  assert.equal(kind('0.170.0', '0.186.1'), 'major');
  assert.equal(kind('1.2.3', '1.3.0'), 'minor');
  assert.equal(kind('0.0.1', '0.0.2'), 'major');
  assert.equal(kind('1.2.3', '2.0.0'), 'major');
});

test('holds and range prefixes', () => {
  assert.equal(allowedByHold('2.9.0', '<3.0.0'), true);
  assert.equal(allowedByHold('3.0.0', '<3.0.0'), false);
  assert.equal(allowedByHold('18.3.1', '^18'), true);
  assert.equal(allowedByHold('19.0.0', '^18 || ^20'), false);
  assert.equal(allowedByHold('1.4.0', '1.2.3 - 1.9.0'), true);
  assert.equal(prefixOf('^1.0.0'), '^');
  assert.equal(prefixOf('1.0.0'), '');
  assert.equal(prefixOf('file:../x'), null);
});

test('store: journal replays into state, logs per repo, recover closes interrupted runs', async () => {
  const store = openStore(tmp());
  let runId, intentId;
  await store.update(async ({ emit }) => {
    runId = 'r1';
    emit('start', { id: runId });
    emit('plan', { runId, repo: 'web', items: [{ name: 'vite', from: '6.0.0', to: '7.0.0', kind: 'major' }] });
    intentId = 'i1';
    emit('intent', { runId, id: intentId, repo: 'web', name: 'vite', from: '6.0.0', to: '7.0.0', files: ['package.json', 'package-lock.json'] });
  });
  await assert.rejects(store.update(async ({ emit }) => emit('finish', { runId })), /open intents/);
  await store.update(async ({ emit }) => emit('recover', { runId }));
  const s = store.load();
  assert.equal(s.currentRun, null);
  assert.equal(s.runs[0].status, 'interrupted');
  assert.match(s.runs[0].repos.web.rolledBack[0].reason, /package-lock\.json/);
  assert.match(readFileSync(join(store.dir, 'repos', 'web', 'log.md'), 'utf8'), /Applying vite 6\.0\.0 → 7\.0\.0/);
  assert.match(readFileSync(join(store.dir, 'log.md'), 'utf8'), /interrupted/);
  const replayed = readFileSync(join(store.dir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).reduce(applyEvent, createState());
  assert.deepEqual(replayed, s);
});

test('store: applied moves the intent into the run and records the version', async () => {
  const store = openStore(tmp());
  await store.update(async ({ emit }) => {
    emit('start', { id: 'r' });
    emit('intent', { runId: 'r', id: 'a', repo: 'web', name: 'x', from: '1.0.0', to: '1.1.0', files: ['package.json'] });
    emit('applied', { runId: 'r', intentId: 'a', notes: 'patch' });
    emit('verified', { runId: 'r', repo: 'web', ok: true, checks: [{ cmd: 'npm test', ok: true }] });
    emit('finish', { runId: 'r', summary: 'ok' });
  });
  const s = store.load();
  assert.equal(s.repos.web.versions.x, '1.1.0');
  assert.equal(s.runs[0].repos.web.applied[0].name, 'x');
  assert.deepEqual(s.openIntents, {});
});

test('discover: repositories and every detector on a fixture tree', () => {
  const root = tmp(), repo = join(root, 'proj');
  const write = (p, text) => { mkdirSync(join(repo, p, '..'), { recursive: true }); writeFileSync(join(repo, p), text); };
  write('package.json', JSON.stringify({ dependencies: { a: '^1.0.0' }, engines: { node: '>=22' } }));
  write('package-lock.json', JSON.stringify({ packages: { 'node_modules/a': { version: '1.2.0' } } }));
  write('.nvmrc', '22\n');
  write('Dockerfile', 'FROM node:22-bookworm-slim AS build\nFROM build\nFROM scratch\n');
  write('.github/workflows/ci.yml', 'jobs:\n  t:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./local\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20.x\n');
  write('requirements.txt', 'requests==2.31.0\nflask>=2\n');
  write('App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved', JSON.stringify({ pins: [{ identity: 'alamofire', location: 'https://github.com/Alamofire/Alamofire.git', state: { version: '5.8.0' } }] }));
  write('Podfile.lock', 'PODS:\n  - Firebase/Core (10.1.0)\n  - Kingfisher (7.9.0)\n');
  write('node_modules/x/package.json', '{"dependencies":{"evil":"1.0.0"}}');
  execFileSync('git', ['init', '-q', repo]);
  const found = discover({ roots: [root], exclude: [] });
  const r = found.proj;
  assert.ok(r, 'repository found');
  assert.deepEqual(r.ecosystems.sort(), ['apple', 'docker', 'github-actions', 'node-runtime', 'npm', 'python']);
  assert.equal(r.findings.filter((f) => f.ecosystem === 'npm').length, 1, 'node_modules is never scanned');
  assert.equal(r.findings.filter((f) => f.ecosystem === 'docker').length, 1, 'stage refs and scratch are skipped');
  assert.equal(r.findings.filter((f) => f.ecosystem === 'github-actions').length, 2, 'local actions are skipped');
  assert.equal(r.findings.filter((f) => f.ecosystem === 'node-runtime').length, 4);
  assert.deepEqual(findRepos([root], { exclude: [join(root, 'proj') + '/**'] }), [], 'exclude globs apply');
  assert.ok(globToRegExp('**/node_modules/**').test('/a/b/node_modules/c'));
});

const tar = (files) => {
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const body = Buffer.from(text), h = Buffer.alloc(512);
    h.write('package/' + name, 0); h.write('0000644\0', 100); h.write(body.length.toString(8).padStart(11, '0') + '\0', 124); h.write('0', 156); h.write('ustar\0', 257);
    h.fill(' ', 148, 156);
    let sum = 0; for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
};

test('readTar and verifyIntegrity', () => {
  const gz = gzipSync(tar({ 'package.json': '{"name":"x"}', 'lib/a.js': 'module.exports=1' }));
  const files = readTar(gunzipSync(gz));
  assert.equal(files.get('lib/a.js').toString(), 'module.exports=1');
  const integrity = 'sha512-' + createHash('sha512').update(gz).digest('base64');
  assert.equal(verifyIntegrity(gz, { integrity }), integrity);
  assert.throws(() => verifyIntegrity(Buffer.concat([gz, Buffer.from('x')]), { integrity }), /Integrity mismatch/);
});

const pkgFiles = (files) => new Map(Object.entries(files).map(([k, v]) => [k, Buffer.from(v)]));

test('inspect signals: install scripts, secrets, obfuscation, publisher, license', () => {
  const before = { meta: { license: 'MIT', scripts: {} }, files: pkgFiles({ 'index.js': 'module.exports = () => 1' }) };
  const after = {
    meta: { license: 'BUSL-1.1', scripts: { postinstall: 'node setup.js' }, dependencies: { 'new-dep': '^1.0.0' } },
    files: pkgFiles({ 'index.js': 'module.exports = () => 1', 'setup.js': 'const t = process.env.NPM_TOKEN; require("child_process").exec("curl x"); var _0x1a2b=1;' })
  };
  const docBefore = { versions: { '1.0.0': { maintainers: [{ name: 'alice' }], _npmUser: { name: 'alice' }, dist: { attestations: { url: 'x' } } } } };
  const docAfter = { versions: { '1.0.1': { _npmUser: { name: 'mallory' }, dist: {} } } };
  const r = compareVersions({ name: 'p', from: '1.0.0', to: '1.0.1', before, after, docBefore, docAfter });
  const codes = r.signals.map((s) => s.code);
  assert.equal(r.verdict, 'concern');
  for (const c of ['install-script-added', 'reads-secrets', 'child-process', 'obfuscation', 'new-publisher', 'provenance-lost', 'license-changed', 'dependencies-added']) assert.ok(codes.includes(c), c);
});

test('inspect: CI trusted publishing is not a new publisher; clean upgrade is ok', () => {
  const same = { meta: { license: 'MIT' }, files: pkgFiles({ 'a.js': 'x' }) };
  const docBefore = { versions: { '1.0.0': { maintainers: [{ name: 'alice' }], _npmUser: { name: 'GitHub Actions' }, dist: { attestations: {} } } } };
  const docAfter = { versions: { '1.0.1': { _npmUser: { name: 'GitHub Actions', trustedPublisher: { id: 'github' } }, dist: { attestations: {} } } } };
  const r = compareVersions({ name: 'p', from: '1.0.0', to: '1.0.1', before: same, after: { ...same, files: pkgFiles({ 'a.js': 'y' }) }, docBefore, docAfter });
  assert.equal(r.verdict, 'ok', JSON.stringify(r.signals));
});

test('github-actions: newest old-enough release pinned by SHA with a comment', async () => {
  const github = {
    releases: async () => [{ tag: 'v7.0.1', at: ago(10) }, { tag: 'v7.1.0', at: ago(1) }, { tag: 'v6.0.0', at: ago(200) }],
    commitOf: async (repo, tag) => (tag === 'v7.0.1' ? 'a'.repeat(40) : null)
  };
  const [item] = await actions.outdated('/r', { file: 'ci.yml', action: 'actions/checkout', path: '', ref: 'v4', comment: null }, { github, minAgeDays: 7, now: NOW });
  assert.equal(item.uses, `actions/checkout@${'a'.repeat(40)} # v7.0.1`);
  assert.equal(item.kind, 'major');
  const pinned = await actions.outdated('/r', { file: 'ci.yml', action: 'actions/checkout', path: '', ref: 'a'.repeat(40), comment: 'v7.0.1' }, { github, minAgeDays: 7, now: NOW });
  assert.deepEqual(pinned, [], 'already pinned to the newest eligible release');
});

test('docker: digest pin for the current flavor, node major from LTS', async () => {
  const tags = [
    { name: '26-bookworm-slim', digest: 'sha256:new', tag_last_pushed: ago(10) },
    { name: '26.13.0-bookworm-slim', digest: 'sha256:new', tag_last_pushed: ago(10) },
    { name: '22-bookworm-slim', digest: 'sha256:old', tag_last_pushed: ago(10) },
    { name: '22.22.1-bookworm-slim', digest: 'sha256:old', tag_last_pushed: ago(10) }
  ];
  const fetcher = async () => ({ ok: true, json: async () => ({ results: tags, next: null }) });
  const f = { file: 'Dockerfile', registry: 'docker.io', name: 'node', repo: 'library/node', tag: '22-bookworm-slim', digest: null };
  const [item] = await docker.outdated('/r', f, { fetcher, minAgeDays: 7, now: NOW, nodeLts: { major: 26 } });
  assert.equal(item.line, 'FROM node:26.13.0-bookworm-slim@sha256:new');
  const [pin] = await docker.outdated('/r', { ...f, tag: '26-bookworm-slim' }, { fetcher, minAgeDays: 7, now: NOW, nodeLts: { major: 26 } });
  assert.equal(pin.kind, 'pin');
});

test('npm detector: caret targets from the lockfile version, holds respected', async () => {
  const repo = tmp();
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ dependencies: { a: '1.0.0', b: '^2.0.0', c: 'file:../c' } }));
  writeFileSync(join(repo, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/a': { version: '1.0.0' }, 'node_modules/b': { version: '2.1.0' } } }));
  const docs = {
    a: { time: { '1.0.0': ago(100), '1.4.0': ago(20), '1.5.0': ago(2) }, 'dist-tags': { latest: '1.5.0' } },
    b: { time: { '2.1.0': ago(100), '3.0.0': ago(30) }, 'dist-tags': { latest: '3.0.0' } }
  };
  const registry = { packument: async (n) => docs[n] };
  const items = await npm.outdated(repo, { manifest: 'package.json', project: '.', lock: 'package-lock.json' }, { registry, minAgeDays: 7, now: NOW, holds: { b: { hold: '^2', reason: 'license' } } });
  const a = items.find((i) => i.name === 'a'), b = items.find((i) => i.name === 'b');
  assert.equal(a.to, '1.4.0');
  assert.equal(a.newSpec, '^1.4.0', 'exact pins become caret ranges');
  assert.equal(b.kind, 'held');
  assert.equal(items.some((i) => i.name === 'c'), false, 'file: specs are not registry packages');
});
