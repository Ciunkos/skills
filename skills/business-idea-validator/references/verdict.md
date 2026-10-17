# Verdict rule

The verdict is not a model opinion. It is a fixed rule applied to the ten scores, implemented once in `scripts/verdict.mjs` and used by both this skill and the online version. A reader can check it by hand from the scorecard, which is the point: the model's judgment lives in the scores and their reasoning, and the rule is the same for every idea.

## Bands

| Score | Band | Meaning |
|---|---|---|
| 1 | Red flag | The rubric fails outright; this alone is a reason not to build yet. |
| 2 | Weak | Serious doubt; needs a change to the idea, not just more detail. |
| 3 | Unclear | Could go either way; the text does not settle it. |
| 4 | Solid | Holds up; small open questions. |
| 5 | Strong | Holds up with evidence in the text. |

## Core rubrics

`problem`, `customer`, `alternatives`, `monetization`. If these four do not hold, nothing else matters. The other six shape *how* to proceed, not *whether*.

## Confidence

Each rubric also carries `confidence`: high, medium or low. It measures how much the idea text and the founder's answers actually say about that rubric. A low score with low confidence is a question, not a judgment. The rule uses confidence so that a thin description leads to "validate first", not to "stop".

## The rule, in order

1. **Stop** when 3 or more core rubrics score 2 or lower *with high confidence*.
2. **Pivot** when 2 or more core rubrics score 2 or lower with high confidence *and* the synthesis names at least one pivot option.
3. **Validate first** when any rubric scores 2 or lower.
4. **Validate first** when any core rubric is not rated with high confidence.
5. **Build** when no rubric scores 2 or lower and at least 6 rubrics score 4 or higher.
6. Otherwise **Validate first** (no red flags, but not strong enough).

Thresholds live in `RULES` in `scripts/verdict.mjs`. Change them there, add a test case, and bump the version; do not restate them anywhere else.

## What the report prints

"Why this verdict": the rule that fired, with the rubrics that decided it. Templates are in `scripts/i18n.mjs` under `rule`.

## Calibration notes

- A thin two-sentence idea should land on "Validate first" with mostly low confidence. If it lands on Stop, the rubric passes were overconfident; if on Build, they were generous.
- A detailed idea with a clear buyer, a paying category and a named channel should reach Build only when the alternatives rubric is at least 4. Ideas rarely fail on size; they fail on "why switch".
- Pivot requires a named alternative direction. Without one it is Stop or Validate first, never Pivot by default.
