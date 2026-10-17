# Report layout

The Markdown report is produced by `scripts/render.mjs` from `report.json`. This file documents the layout for agents and reviewers; it is not read by the renderer.

```
# Business idea validation

## Verdict: <Build | Validate first | Pivot | Stop>
<one line from i18n>
**Why this verdict.** <rule that fired, with the deciding rubrics>

## Scorecard
| ●●●●○ | Problem | Solid | high confidence |
… ten rows in canonical order …

## Summary
<three sentences>
**Riskiest assumption.** <one sentence>

## Cheapest experiments (next two weeks)
1. **Name** (days). What. Success metric: number.
2. …
3. …

## Pivot options            (only when non-empty)
## Open questions           (only when non-empty)

## Rubric by rubric
### Problem: 4/5, Solid (high confidence)
*Is the problem painful, frequent and urgent?*
<reasoning>
**Evidence from the idea text**  > quotes
**Assumptions made**             - list
**Questions to answer**          - list
**What would raise the score**   - list
… ×10 …

## Critic pass                (only when a critic ran)

## The idea
> the founder's text
**Additional answers**        (only when given)

---
Generated <date> with <model>. <disclaimer line>
```

Section titles, band names and verdict lines come from `scripts/i18n.mjs` (`en`, `pl`). Order is fixed so that two reports are comparable side by side.
