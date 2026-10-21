/* przemo: the typing rules a human on Slack follows, and the files the skill points at. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { skillVersion } from '../scripts/release-lib.mjs';

const dir = 'skills/przemo';
const files = ['SKILL.md', 'README.md', 'CHANGELOG.md', ...readdirSync(join(dir, 'references')).map((f) => join('references', f))];
const read = (f) => readFileSync(join(dir, f), 'utf8');

test('no long dashes, curly quotes or Polish/French quote marks', () => {
  for (const f of files) {
    const bad = read(f).match(/[–—‘’“”„«»]/g);
    assert.equal(bad, null, `${f}: ${bad?.join(' ')}`);
  }
});

test('no Slack shortcodes in what the skill tells the model to write', () => {
  for (const f of files) assert.doesNotMatch(read(f), /:[a-z_+]+:/, f);
});

test('SKILL.md has a version and every reference it names exists', () => {
  const md = read('SKILL.md');
  assert.ok(skillVersion(md));
  for (const [, ref] of md.matchAll(/`(references\/[\w.-]+)`/g)) assert.ok(existsSync(join(dir, ref)), ref);
});

test('links are only ones the skill may use', () => {
  const allowed = /^(github\.com\/Ciunkos\/skills|ciunkos\.com(\/(przemo|korpo-tlumacz|wyrocznia|migawki|kalkulator-b2b-vs-uop-2026|skills|hire-me))?|xkcd\.com\/1205|paulgraham\.com\/makersschedule\.html)$/;
  for (const f of files) {
    for (const [url] of read(f).matchAll(/\b[a-z0-9-]+\.(com|pl|io|dev|ai|org|net|app|me|co|gg|ly|html)(\/[\w./-]*)?/g)) {
      if (/\.(md|mjs|json)$/.test(url) || url.endsWith('.html') && !url.includes('/')) continue;
      assert.match(url.replace(/[.)]+$/, ''), allowed, `${f}: ${url}`);
    }
  }
});
