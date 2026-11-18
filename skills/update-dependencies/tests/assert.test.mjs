/* Offline tests for the guards added after a real run: target picking ignores unpublished
   versions, discovery walks past a commitless .git, records must name a real repository, and
   assert catches upgrades that did not land, landed at another version, or moved while held. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pickTarget } from '../scripts/semver.mjs';
import { findRepos } from '../scripts/discover.mjs';
import { assertRepo } from '../scripts/assert.mjs';
import { main } from '../scripts/deps.mjs';

const DAY = 86_400_000, NOW = Date.parse('2026-11-18T12:00:00Z');
const ago = (d) => new Date(NOW - d * DAY).toISOString();
const tmp = () => mkdtempSync(join(tmpdir(), 'deps-assert-'));
const git = (dir, ...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { stdio: 'ignore' });
const lock = (versions) => JSON.stringify({ packages: { '': {}, ...Object.fromEntries(Object.entries(versions).map(([n, v]) => [`node_modules/${n}`, { version: v }])) } });

/* A committed npm project: package.json with ^ ranges, a lockfile, optional .npmrc. */
const project = (versions, { npmrc = true } = {}) => {
  const dir = tmp();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: Object.fromEntries(Object.entries(versions).map(([n, v]) => [n, '^' + v])) }));
  writeFileSync(join(dir, 'package-lock.json'), lock(versions));
  if (npmrc) writeFileSync(join(dir, '.npmrc'), 'min-release-age=7\n');
  execFileSync('git', ['init', '-q', dir]);
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'init');
  return dir;
};
const record = (over) => ({ planned: [], applied: [], held: [], rolledBack: [], verified: [{ ok: true, at: ago(0), checks: [] }], lastChangeAt: ago(0.5), ...over });
const item = (name, from, to, kind = 'minor') => ({ ecosystem: 'npm', project: '.', name, from, to, kind });

test('pickTarget: an unpublished version still in the time map is never the target', () => {
  /* A 2013 "1.58.1" was unpublished but stays in `time`; the package now ships 0.x. */
  const times = { '1.58.1': ago(4600), '0.186.1': ago(60), '0.187.0': ago(19) };
  const available = ['0.186.1', '0.187.0'];
  assert.equal(pickTarget({ times, current: '0.186.1', now: NOW }).version, '1.58.1', 'without the guard the bug reproduces');
  assert.equal(pickTarget({ times, current: '0.186.1', now: NOW, available }).version, '0.187.0');
  assert.equal(pickTarget({ times, current: '0.186.1', now: NOW, ceiling: '0.187.0' }).version, '0.187.0', 'nothing above the latest dist-tag');
  assert.equal(pickTarget({ times: { '2.0.0': ago(30), '1.5.0': ago(30) }, current: '1.0.0', now: NOW, ceiling: '2.0.0-rc.1' }).version, '2.0.0', 'a prerelease latest tag is no ceiling');
});

test('discovery walks past a .git without commits and finds the repositories below it', () => {
  const root = tmp();
  execFileSync('git', ['init', '-q', root]); /* an accidental git init in a home folder */
  const child = join(root, 'web');
  mkdirSync(child);
  execFileSync('git', ['init', '-q', child]);
  git(child, 'commit', '-q', '--allow-empty', '-m', 'init');
  assert.deepEqual(findRepos([root]), [child]);
});

test('records must name one real repository, and an intent must list relative files', async () => {
  const storage = tmp(), prefs = join(tmp(), 'prefs.json');
  const repo = project({ a: '1.0.0' });
  writeFileSync(join(storage, 'settings.json'), JSON.stringify({ roots: [], exclude: [], repos: { web: { path: repo, ecosystems: ['npm'] } } }));
  const run = (args, input) => {
    const file = join(tmp(), 'in.json');
    if (input) writeFileSync(file, JSON.stringify(input));
    return main([...args, '--storage', storage, ...(input ? ['--input', file] : [])], { preferences: prefs });
  };
  const { runId } = await run(['start']);
  await assert.rejects(run(['intent', '--run', runId], { repo: 'web api', name: 'a', from: '1.0.0', to: '1.1.0', files: ['package.json'] }), /Unknown repository "web api"/);
  await assert.rejects(run(['held', '--run', runId], { repo: 'nope', name: 'a', from: '1', to: '2', reason: 'x' }), /Unknown repository/);
  await assert.rejects(run(['intent', '--run', runId], { repo: 'web', name: 'a', from: '1.0.0', to: '1.1.0' }), /needs files/);
  await assert.rejects(run(['intent', '--run', runId], { repo: 'web', name: 'a', from: '1.0.0', to: '1.1.0', files: ['../other/package.json'] }), /relative paths/);
  const { intentId } = await run(['intent', '--run', runId], { repo: 'web', name: 'a', from: '1.0.0', to: '1.1.0', files: ['package.json', 'package-lock.json'] });
  assert.ok(intentId);
});

test('assert: a clean repository passes', () => {
  const dir = project({ a: '1.0.0', b: '2.0.0' });
  writeFileSync(join(dir, 'package-lock.json'), lock({ a: '1.1.0', b: '2.0.0' }));
  const r = assertRepo({ path: dir, record: record({ planned: [item('a', '1.0.0', '1.1.0'), item('b', '2.0.0', '3.0.0', 'major')], applied: [{ name: 'a', from: '1.0.0', to: '1.1.0' }], held: [{ name: 'b', from: '2.0.0', to: '3.0.0', reason: 'concern' }] }) });
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('assert: a planned item without an outcome is unresolved', () => {
  const dir = project({ a: '1.0.0' });
  const r = assertRepo({ path: dir, record: record({ planned: [item('a', '1.0.0', '1.1.0')] }) });
  assert.match(r.errors.join(), /unresolved: a/);
});

test('assert: an applied upgrade that a later rollback silently undid is caught', () => {
  /* The rollback of one item restored package-lock.json from git HEAD and took earlier items with it. */
  const dir = project({ a: '1.0.0', b: '1.0.0' });
  writeFileSync(join(dir, 'package-lock.json'), lock({ a: '1.0.0', b: '1.0.0' }));
  const r = assertRepo({ path: dir, record: record({ planned: [item('a', '1.0.0', '2.0.0', 'major'), item('b', '1.0.0', '1.1.0')], applied: [{ name: 'a', from: '1.0.0', to: '2.0.0' }], rolledBack: [{ name: 'b', from: '1.0.0', to: '1.1.0', reason: 'peer conflict' }] }) });
  assert.match(r.errors.join(), /a: applied 2\.0\.0 but package-lock\.json has 1\.0\.0/);
  assert.equal(r.errors.length, 1, 'b is rolled back and still at 1.0.0: fine');
});

test('assert: a ^ range that resolved past the target points at the missing cooldown', () => {
  const dir = project({ a: '1.0.0' }, { npmrc: false });
  writeFileSync(join(dir, 'package-lock.json'), lock({ a: '1.2.1' }));
  const r = assertRepo({ path: dir, record: record({ planned: [item('a', '1.0.0', '1.2.0')], applied: [{ name: 'a', from: '1.0.0', to: '1.2.0' }] }) });
  assert.match(r.errors.join('\n'), /applied 1\.2\.0 but package-lock\.json has 1\.2\.1 \(resolved past the target/);
  assert.match(r.errors.join('\n'), /no min-release-age/);
});

test('assert: a held package that npm audit fix moved anyway is caught; unrecorded direct changes warn', () => {
  const dir = project({ a: '3.23.8', c: '4.73.0' });
  writeFileSync(join(dir, 'package-lock.json'), lock({ a: '3.25.76', c: '4.104.0' }));
  const r = assertRepo({ path: dir, record: record({ planned: [item('a', '3.23.8', '4.0.0', 'major')], held: [{ name: 'a', from: '3.23.8', to: '4.0.0', reason: 'concern' }] }) });
  assert.match(r.errors.join(), /a: held at 3\.23\.8 but the lockfile has 3\.25\.76/);
  assert.match(r.warnings.join(), /c: changed 4\.73\.0 → 4\.104\.0 with no recorded outcome/);
});

test('assert: an unexplained direct downgrade is an error, a transitive one a warning', () => {
  const dir = project({ a: '2.0.0' });
  const before = JSON.stringify({ packages: { '': {}, 'node_modules/a': { version: '2.0.0' }, 'node_modules/a/node_modules/t': { version: '1.1.0' } } });
  writeFileSync(join(dir, 'package-lock.json'), before); git(dir, 'commit', '-q', '-am', 'lock');
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ packages: { '': {}, 'node_modules/a': { version: '1.9.0' }, 'node_modules/a/node_modules/t': { version: '1.0.0' } } }));
  const r = assertRepo({ path: dir, record: record({ planned: [item('x', '1.0.0', '1.1.0')], held: [{ name: 'x', from: '1.0.0', to: '1.1.0', reason: 'dry' }] }) });
  assert.match(r.errors.join(), /a: went down 2\.0\.0 → 1\.9\.0/);
  assert.match(r.warnings.join(), /transitive downgrade 1\.1\.0 → 1\.0\.0/);
});

test('assert: other ecosystems must contain the applied target; checks must postdate the last change', () => {
  const dir = project({ a: '1.0.0' });
  writeFileSync(join(dir, '.nvmrc'), '22\n');
  const planned = [{ ecosystem: 'node-runtime', file: '.nvmrc', name: 'node (.nvmrc)', from: '22', to: '26', kind: 'major' }];
  const r = assertRepo({ path: dir, record: record({ planned, applied: [{ name: 'node (.nvmrc)', from: '22', to: '26' }], verified: [{ ok: true, at: ago(1), checks: [] }], lastChangeAt: ago(0.5) }) });
  assert.match(r.errors.join('\n'), /\.nvmrc: applied node \(\.nvmrc\) 26 but the file does not contain it/);
  assert.match(r.errors.join('\n'), /changed after the last verified record/);
});

test('assert: a group outcome covers each package it names', () => {
  const dir = project({ react: '19.2.6', 'react-dom': '19.2.6', '@types/react': '19.2.7' });
  writeFileSync(join(dir, 'package-lock.json'), lock({ react: '19.3.1', 'react-dom': '19.3.1', '@types/react': '19.3.0' }));
  const planned = [item('react', '19.2.6', '19.3.1'), item('react-dom', '19.2.6', '19.3.1'), item('@types/react', '19.2.7', '19.3.0')];
  const r = assertRepo({ path: dir, record: record({ planned, applied: [{ name: 'react group (react, react-dom, @types/react)', from: '19.2.6', to: '19.3.1' }] }) });
  assert.deepEqual(r.errors, [], 'a member at its own plan target is fine');
  const workflows = [{ ecosystem: 'node-runtime', file: '.nvmrc', name: 'node (setup-node)', from: '24', to: '26', kind: 'major' }];
  const h = assertRepo({ path: dir, record: record({ planned: workflows, held: [{ name: 'node (setup-node) .github/workflows/test.yml', from: '24', to: '26', reason: 'submodule' }] }) });
  assert.deepEqual(h.errors, [], 'the plan name followed by detail covers the item');
  const other = assertRepo({ path: dir, record: record({ planned: workflows, held: [{ name: 'node (.nvmrc)', from: '24', to: '26', reason: 'x' }] }) });
  assert.match(other.errors.join(), /unresolved/, 'a different name does not');
});
