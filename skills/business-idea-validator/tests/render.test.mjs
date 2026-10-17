/* render.test.mjs — the example renders in both languages and the example
   report passes the schema and the limits. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMarkdown } from '../scripts/render.mjs';
import { verdict } from '../scripts/verdict.mjs';
import { checkReport } from '../scripts/schema.mjs';
import { RUBRIC_ORDER, LABELS, LANGS } from '../scripts/i18n.mjs';

const here = new URL('.', import.meta.url);
const load = (p) => JSON.parse(readFileSync(new URL(p, here), 'utf8'));
const report = load('../assets/examples/fieldnote/report.json');
const schemas = { reportSchema: load('../assets/report.schema.json'), rubricSchema: load('../assets/rubric-output.schema.json'), order: RUBRIC_ORDER };

test('example report is valid and its verdict is reproducible', () => {
  assert.deepEqual(checkReport(report, schemas), []);
  assert.deepEqual(verdict(report), report.verdict);
  assert.equal(report.verdict.label, 'validate');
});

test('renders English with all ten rubric headings and the verdict', () => {
  const md = renderMarkdown(report, 'en');
  assert.match(md, /^# Business idea validation/);
  assert.match(md, /## Verdict: Validate first/);
  for (const id of RUBRIC_ORDER) assert.ok(md.includes(`### ${LABELS.en.rubric[id].name}:`), id);
  assert.ok(!md.includes('—'), 'no em dash');
  assert.ok(md.includes('> FieldNote'), 'idea quoted');
});

test('notes print only when present', () => {
  const r = JSON.parse(JSON.stringify(report));
  assert.ok(!renderMarkdown(r, 'en').includes('**Notes.**'));
  r.synthesis.notes = 'No questions could be asked.';
  assert.ok(renderMarkdown(r, 'en').includes('**Notes.** No questions could be asked.'));
});

test('renders Polish labels for the same data', () => {
  const md = renderMarkdown(report, 'pl');
  assert.match(md, /^# Walidacja pomysłu na biznes/);
  assert.match(md, /## Werdykt: Najpierw sprawdź/);
  assert.ok(md.includes('Tablica ocen'));
});

test('a red-flag idea text is escaped, not interpreted', () => {
  const r = JSON.parse(JSON.stringify(report));
  r.idea.text = '<script>alert(1)</script> | pipe';
  r.rubrics[0].evidence = ['<b>bold</b>'];
  const md = renderMarkdown(r, 'en');
  assert.ok(!md.includes('<script>'));
  assert.ok(!md.includes('<b>'));
});

test('every label exists in every language', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, p + k + '.') : [p + k]));
  const en = keys(LABELS.en).sort();
  for (const lang of LANGS) assert.deepEqual(keys(LABELS[lang]).sort(), en, lang);
});
