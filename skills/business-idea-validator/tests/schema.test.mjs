/* schema.test.mjs — the checker catches what the schemas and limits forbid. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check, checkRubricLimits } from '../scripts/schema.mjs';

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
