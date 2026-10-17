/* verdict.test.mjs — the rule, case by case. Each case is a scorecard shape
   (scores and confidences) plus the synthesis bits the rule reads. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict, band, RULES } from '../scripts/verdict.mjs';
import { RUBRIC_ORDER, CORE } from '../scripts/i18n.mjs';

const make = (scores, { confidence = 'high', pivots = [] } = {}) => ({
  rubrics: RUBRIC_ORDER.map((id) => ({ id, score: scores[id] ?? 4, confidence: typeof confidence === 'string' ? confidence : (confidence[id] || 'high') })),
  synthesis: { pivots }
});

test('band clamps and rounds', () => {
  assert.equal(band(0), 1); assert.equal(band(6), 5); assert.equal(band(3.4), 3); assert.equal(band('5'), 5);
});

test('stop: three core red flags with high confidence', () => {
  const v = verdict(make({ problem: 1, customer: 2, alternatives: 2, monetization: 4 }));
  assert.equal(v.label, 'stop'); assert.equal(v.rule, 'stop-core');
  assert.deepEqual(v.decisive, ['problem', 'customer', 'alternatives']);
});

test('three core red flags without high confidence is validate, not stop', () => {
  const v = verdict(make({ problem: 1, customer: 2, alternatives: 2 }, { confidence: 'low' }));
  assert.equal(v.label, 'validate'); assert.equal(v.rule, 'validate-low');
});

test('pivot: two core red flags and a named pivot', () => {
  const v = verdict(make({ problem: 2, customer: 2 }, { pivots: ['Sell to the accountant instead'] }));
  assert.equal(v.label, 'pivot'); assert.deepEqual(v.decisive, ['problem', 'customer']);
});

test('pivot beats stop when the synthesis names a direction', () => {
  const v = verdict(make({ problem: 1, customer: 2, alternatives: 1 }, { pivots: ['Summaries for lecturers, sold to universities'] }));
  assert.equal(v.label, 'pivot');
});

test('two core red flags without a pivot is validate', () => {
  const v = verdict(make({ problem: 2, customer: 2 }));
  assert.equal(v.label, 'validate'); assert.equal(v.rule, 'validate-low');
});

test('one red flag anywhere is validate', () => {
  const v = verdict(make({ moat: 2 }));
  assert.equal(v.label, 'validate'); assert.deepEqual(v.decisive, ['moat']);
});

test('uncertain core blocks build', () => {
  const v = verdict(make({}, { confidence: { monetization: 'medium' } }));
  assert.equal(v.label, 'validate'); assert.equal(v.rule, 'validate-uncertain'); assert.deepEqual(v.decisive, ['monetization']);
});

test('build: no red flags, six strong, core sure', () => {
  const v = verdict(make({ market: 3, moat: 3, risks: 3, founder: 3 }));
  assert.equal(v.label, 'build'); assert.equal(v.counts.highs, 6);
});

test('fewer than six strong is validate by default', () => {
  const v = verdict(make({ market: 3, moat: 3, risks: 3, founder: 3, distribution: 3 }));
  assert.equal(v.label, 'validate'); assert.equal(v.rule, 'validate-default');
  assert.equal(v.decisive.length, 5);
});

test('core set and thresholds are what verdict.md says', () => {
  assert.deepEqual(CORE, ['problem', 'customer', 'alternatives', 'monetization']);
  assert.deepEqual(RULES, { low: 2, high: 4, stopCoreRed: 3, pivotCoreRed: 2, buildHighs: 6 });
});
