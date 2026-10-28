# business-idea-validator

A skill that scores a business idea on ten rubrics and returns a verdict you can check by hand.

## What you get

- `report.md`: verdict (Build, Validate first, Pivot, Stop) with the rule that produced it, a ten-row scorecard, a three-sentence summary, the riskiest assumption, up to three experiments for the next two weeks with pass/fail numbers, pivot options, open questions, a dated web scan of competitors and communities (when the agent can search), and one section per rubric with evidence quoted from your text, assumptions, reasoning and what would raise the score.
- `report.json`: the same data, validated against `assets/report.schema.json`.

English or Polish, following the language of the idea.

## How to run it

In Claude Code, after installing the plugin:

```
/business-idea-validator A mobile app for small landscaping crews to log job photos and hours per site and send the invoice the same day. Owners pay 29 EUR a month per crew.
```

Or point it at a file: `/business-idea-validator ./idea.md --lang pl --out ./validation`.

Options: `--lang en|pl` (default: the language of the idea), `--quick` (skip the critic pass and the intake questions), `--out <dir>` (default: current directory).

In any other agent that supports Agent Skills, load `SKILL.md` and follow it. The only runtime need is Node 20+ for `scripts/check.mjs`.

## How it decides

Ten rubrics, each scored 1 to 5 with a confidence level. Four of them are core: problem, customer, alternatives, monetization. The verdict is a fixed rule over the scores (`references/verdict.md`, code in `scripts/verdict.mjs`): three core red flags with high confidence is Stop; two plus a named pivot is Pivot; any red flag or an uncertain core is Validate first; no red flags and six strong rubrics is Build. The report prints which rubrics decided it.

## Example

`assets/examples/fieldnote/` holds an invented idea with its full report. Regenerate the Markdown with:

```
node scripts/check.mjs assets/examples/fieldnote/report.json --stdout
```

## Limits

- It searches the web only when your agent has a web search tool (`--offline` skips it). The scan lists who already does this, with a link and the published price for each, and public places where your customers gather. It never lists individual people. Market sizes are still not looked up: they are arithmetic with stated assumptions.
- It is generated with AI and can be wrong. Treat the scores as a starting point and the experiments as the output, not the verdict.
