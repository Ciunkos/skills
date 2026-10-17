/* Releases: versions, SKILL.md frontmatter, CHANGELOG sections, tag lookup, and a .skill zip that unzips. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, cmp, next, step, skillVersion, setSkillVersion, changelogSection, addChangelogSection, latest } from '../scripts/release-lib.mjs';
import { zip, packageSkill } from '../scripts/package-skill.mjs';

test('versions: parse, compare, next, step', () => {
  assert.deepEqual(parse('1.2.3'), [1, 2, 3]);
  assert.equal(parse('1.2'), null);
  assert.ok(cmp('0.10.0', '0.9.9') > 0);
  assert.equal(next('1.2.3', 'patch'), '1.2.4');
  assert.equal(next('1.2.3', 'minor'), '1.3.0');
  assert.equal(next('1.2.3', 'major'), '2.0.0');
  assert.equal(step('1.2.3', '1.3.0'), 'minor');
});

test('SKILL.md version: read and write metadata.version only', () => {
  const md = '---\nname: x\nmetadata:\n  version: "0.1.0"\n  author: A\n---\n# X\nversion: 9.9.9 in prose\n';
  assert.equal(skillVersion(md), '0.1.0');
  const out = setSkillVersion(md, '0.2.0');
  assert.equal(skillVersion(out), '0.2.0');
  assert.ok(out.includes('version: 9.9.9 in prose'));
});

test('CHANGELOG: section body, placeholder counts as empty, insert under the title', () => {
  const cl = '# Changelog\n\n## 0.2.0\n\n- New thing.\n\n## 0.1.0\n\nFirst.\n';
  assert.equal(changelogSection(cl, '0.2.0'), '- New thing.');
  assert.equal(changelogSection(cl, '0.1.0'), 'First.');
  assert.equal(changelogSection(cl, '0.3.0'), null);
  const added = addChangelogSection(cl, '0.3.0');
  assert.equal(changelogSection(added, '0.3.0'), '');
  assert.ok(added.indexOf('## 0.3.0') < added.indexOf('## 0.2.0'));
  assert.equal(addChangelogSection(added, '0.3.0'), added);
});

test('latest tag per skill and for the pack', () => {
  const tags = ['business-idea-validator-v0.1.0', 'business-idea-validator-v0.10.0', 'business-idea-validator-v0.2.0', 'v0.1.0', 'v0.2.0'];
  assert.equal(latest(tags, 'business-idea-validator-'), '0.10.0');
  assert.equal(latest(tags, ''), '0.2.0');
  assert.equal(latest(tags, 'other-'), null);
});

test('.skill zip: unzips to one folder with SKILL.md on top, no tests inside', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skill-'));
  writeFileSync(join(dir, 'a.zip'), zip([{ name: 'x/SKILL.md', data: Buffer.from('hello') }, { name: 'x/sub/b.txt', data: Buffer.from('b'.repeat(1000)) }]));
  const list = execFileSync('unzip', ['-Z1', join(dir, 'a.zip')], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(list, ['x/SKILL.md', 'x/sub/b.txt']);
  assert.equal(execFileSync('unzip', ['-p', join(dir, 'a.zip'), 'x/SKILL.md'], { encoding: 'utf8' }), 'hello');
  const r = packageSkill('business-idea-validator', join(dir, 'out'), process.cwd());
  const files = execFileSync('unzip', ['-Z1', r.paths[0]], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(files.includes('business-idea-validator/SKILL.md'));
  assert.ok(!files.some((f) => f.includes('/tests/')));
  assert.ok(readFileSync(r.paths[1]).equals(readFileSync(r.paths[0])));
});
