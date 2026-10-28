/* schema.test.mjs — the checker catches what the schemas and limits forbid. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check, checkRubricLimits, checkScan } from '../scripts/schema.mjs';

const schema = JSON.parse(readFileSync(new URL('../assets/rubric-output.schema.json', import.meta.url), 'utf8'));
const good = { id: 'problem', score: 4, confidence: 'high', evidence: ['x'], assumptions: [], reasoning: 'Fine.', questions: [], improve: [] };

test('valid rubric result passes', () => {
  assert.deepEqual(check(good, schema), []);
  assert.deepEqual(checkRubricLimits(good), []);
});

test('wrong enum, missing field, extra field, wrong type', () => {
  assert.ok(check({ ...good, score: 6 }, schema).some((p) => p.includes('score')));
  assert.ok(check({ ...good, confidence: 'sure' }, schema).some((p) => p.includes('confidence')));
  const { improve, ...missing } = good;
  assert.ok(check(missing, schema).some((p) => p.includes('improve: required')));
  assert.ok(check({ ...good, band: 'Solid' }, schema).some((p) => p.includes('band: not allowed')));
  assert.ok(check({ ...good, score: '4' }, schema).some((p) => p.includes('expected integer')));
});

test('limits: too many items, too long reasoning, empty reasoning', () => {
  assert.ok(checkRubricLimits({ ...good, questions: ['a', 'b', 'c', 'd'] }).some((p) => p.includes('questions')));
  assert.ok(checkRubricLimits({ ...good, reasoning: Array(161).fill('w').join(' ') }).some((p) => p.includes('160 words')));
  assert.ok(checkRubricLimits({ ...good, reasoning: ' ' }).some((p) => p.includes('empty')));
});

const scanSchema = JSON.parse(readFileSync(new URL('../assets/scan.schema.json', import.meta.url), 'utf8'));
const scan = {
  searchedAt: '2026-10-28', queries: ['q'], statusQuo: ['a notebook'], notes: '',
  competitors: [{ name: 'A', url: 'https://a.example.com', kind: 'direct', forWhom: 'crews', price: '10 EUR/month', priceUrl: 'https://a.example.com/pricing', freeTier: 'no', difference: 'x' }],
  communities: [{ name: 'Group', url: 'https://forum.example.com/g', why: 'owners ask about invoicing' }]
};

test('valid scan passes', () => {
  assert.deepEqual(check(scan, scanSchema), []);
  assert.deepEqual(checkScan(scan), []);
});

test('scan: non-http links, a price without its page, too many rows', () => {
  const bad = JSON.parse(JSON.stringify(scan));
  bad.competitors[0].url = 'javascript:alert(1)';
  bad.communities[0].url = 'data:text/html,x';
  assert.ok(checkScan(bad).some((p) => p.includes('competitors[0].url')));
  assert.ok(checkScan(bad).some((p) => p.includes('communities[0].url')));
  const noPage = JSON.parse(JSON.stringify(scan));
  noPage.competitors[0].priceUrl = '';
  assert.ok(checkScan(noPage).some((p) => p.includes('no priceUrl')));
  const many = { ...scan, competitors: Array(9).fill(scan.competitors[0]) };
  assert.ok(checkScan(many).some((p) => p.includes('more than 8')));
  assert.ok(checkScan({ ...scan, searchedAt: 'yesterday' }).some((p) => p.includes('ISO date')));
  assert.ok(check({ ...scan, competitors: [{ ...scan.competitors[0], freeTier: 'maybe' }] }, scanSchema).some((p) => p.includes('freeTier')));
});
