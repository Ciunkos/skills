/* verdict.mjs — the fixed rule that turns ten rubric scores into a verdict.
   Pure ESM, no Node APIs: the skill runs it through check.mjs, the online
   worker imports it directly. A verdict must be explainable from the scores
   alone, so nothing here reads the prose. */
import { RUBRIC_ORDER, CORE } from './i18n.mjs';

export const VERDICTS = ['build', 'validate', 'pivot', 'stop'];

/* Score 1–5 → band key 1–5 (labels live in i18n). Kept as a function so the
   mapping can change in one place. */
export const band = (score) => Math.min(5, Math.max(1, Math.round(Number(score) || 0)));

/* Index rubrics by id, in canonical order; missing ones are an error upstream. */
export const byId = (rubrics) => Object.fromEntries((rubrics || []).map((r) => [r.id, r]));

/* Thresholds in one place. */
export const RULES = {
  low: 2,            // score at or below this is a red flag
  high: 4,           // score at or above this counts as strong
  stopCoreRed: 3,    // core rubrics at or below `low` with high confidence
  pivotCoreRed: 2,
  buildHighs: 6      // rubrics at or above `high` needed to build
};

export function verdict(report) {
  const r = byId(report.rubrics);
  const ids = RUBRIC_ORDER.filter((id) => r[id]);
  const isLow = (id) => r[id].score <= RULES.low;
  const isHigh = (id) => r[id].score >= RULES.high;
  const sure = (id) => r[id].confidence === 'high';
  const coreRed = CORE.filter((id) => r[id] && isLow(id) && sure(id));
  const lows = ids.filter(isLow);
  const highs = ids.filter(isHigh);
  const coreUnsure = CORE.filter((id) => r[id] && !sure(id));
  const pivots = (report.synthesis && report.synthesis.pivots) || [];
  const counts = { coreRed: coreRed.length, lows: lows.length, highs: highs.length, coreUnsure: coreUnsure.length };

  if (coreRed.length >= RULES.stopCoreRed) return { label: 'stop', rule: 'stop-core', decisive: coreRed, counts };
  if (coreRed.length >= RULES.pivotCoreRed && pivots.length) return { label: 'pivot', rule: 'pivot-core', decisive: coreRed, counts };
  if (lows.length) return { label: 'validate', rule: 'validate-low', decisive: lows, counts };
  if (coreUnsure.length) return { label: 'validate', rule: 'validate-uncertain', decisive: coreUnsure, counts };
  if (highs.length >= RULES.buildHighs) return { label: 'build', rule: 'build-strong', decisive: highs, counts };
  return { label: 'validate', rule: 'validate-default', decisive: ids.filter((id) => !isHigh(id)), counts };
}

/* Scorecard rows in canonical order: { id, score, band, confidence }. */
export const scorecard = (report) => {
  const r = byId(report.rubrics);
  return RUBRIC_ORDER.filter((id) => r[id]).map((id) => ({ id, score: r[id].score, band: band(r[id].score), confidence: r[id].confidence }));
};
