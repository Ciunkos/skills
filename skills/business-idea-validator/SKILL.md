---
name: business-idea-validator
description: Validate a business or startup idea against ten rubrics (problem, customer, market, alternatives, monetization, distribution, feasibility, defensibility, founder fit, risks), each scored 1 to 5 with evidence and confidence, and get a fixed-rule verdict (Build, Validate first, Pivot, Stop) with the riskiest assumption, three cheap experiments and open questions, as Markdown and JSON, in English or Polish. Use when asked to validate, assess, score, stress-test or sanity-check a business idea, startup idea, product idea, SaaS idea or side project, or when the user types /business-idea-validator with an idea. Not for market research reports, pitch decks or financial models.
license: MIT
compatibility: Any agent that can read files and run Node 20+ (for scripts/check.mjs). Subagents are optional.
metadata:
  version: "0.1.0"
  author: Przemysław Zalewski
  homepage: https://ciunkos.com/business-idea-validator
  usage: "<idea text or path to a file> [--lang en|pl] [--quick] [--out <dir>]"
---

# Business idea validator

Usage: `/business-idea-validator <idea text or path to a file> [--lang en|pl] [--quick] [--out <dir>]`

Score one business idea on ten rubrics, apply a fixed verdict rule, write a report. The judgment is in the scores and their reasoning; the verdict is arithmetic over the scores so that two ideas get the same treatment and a reader can check it by hand.

Run from a working directory of the user's choice (`--out <dir>`, default the current directory). Never write into this skill's folder.

## Files you will use

- `references/rubrics/01-problem.md` … `10-risks.md`: one file per rubric. Read the one you are scoring.
- `references/report-style.md`: writing rules. Read once before any scoring.
- `references/intake.md`: when to ask the founder questions first.
- `references/verdict.md`: the rule, for your understanding; the code is `scripts/verdict.mjs`.
- `assets/rubric-output.schema.json`: the exact JSON one rubric pass returns.
- `assets/report.schema.json`: the whole report.
- `assets/examples/fieldnote/`: a complete example (invented idea) of `idea.md`, `report.json`, `report.md`.
- `scripts/check.mjs`: validates, computes the verdict, renders Markdown. `${CLAUDE_SKILL_DIR}` points at this folder in Claude Code; elsewhere use the path the skill was installed to.

## Steps

### 1. Intake

Take the idea from the argument, the prompt, or a file path. Decide the report language: the language of the idea text, unless `--lang` says otherwise.

Apply `references/intake.md`. If the text is thin (under about 40 words, or missing who it is for, what it does, or how it makes money), ask the founder once, up to five questions in one message, and wait. If you cannot ask (non-interactive, or `--quick`), continue with assumptions and say so in the report.

Store what you have as `idea.text` and `idea.answers` (`for`, `money`, `today`, `advantage`, `stage`; only the ones given).

### 2. Score the ten rubrics

Read `references/report-style.md` first. Then, for each rubric in the order `problem, customer, market, alternatives, monetization, distribution, feasibility, moat, founder, risks`:

- Give the pass the idea text, the answers, the rubric file, the style rules and the output schema.
- The pass returns one JSON object matching `assets/rubric-output.schema.json`: `id`, `score` 1 to 5, `confidence` low/medium/high, `evidence` (exact quotes), `assumptions`, `reasoning` (at most 120 words), `questions`, `improve`.

Run the passes in parallel through the `business-idea-rubric` subagent when the Agent tool is available (one agent per rubric, brief it with the file paths and the idea; ask it to return only the JSON). Otherwise score them yourself, one rubric at a time, reading the rubric file fresh each time so the anchors stay in front of you.

Save the ten results to `<out>/rubrics/<id>.json` as you go. Validate each one: `node ${CLAUDE_SKILL_DIR}/scripts/check.mjs --rubric <out>/rubrics/<id>.json`. Fix any problem it reports (usually a list that is too long or reasoning over 120 words) before moving on.

### 3. Critic pass

Skip with `--quick`. Otherwise give the `business-idea-critic` subagent (or do it yourself) all ten results, the idea, and the rubric files. Its job: try to refute every score of 1, 2 or 5 using the anchors and the text, and flag any rubric where the confidence does not match how much the text says. It returns `{ "changes": [{ "id", "from", "to", "why" }], "notes": "" }`. Apply the changes to the rubric results and keep the critic object for the report.

### 4. Synthesis

With the final scores, write the synthesis object (`assets/report.schema.json`, `synthesis`): `summary` (three sentences), `riskiestAssumption` (one), `experiments` (one to three, 14 days max, each with a numeric metric), `pivots` (only real ones; empty is fine), `openQuestions` (the rubric questions, deduplicated, most important first). Follow the synthesis rules in `references/report-style.md`.

### 5. Assemble and render

Write `<out>/report.json` with `version: "1"`, `lang`, `idea`, `rubrics` (all ten), `critic` (if run), `synthesis`, `meta` (`model`: the model you are running on as you know it, `createdAt`: ISO date, `generator`: "skill"). Leave `verdict` out or as an empty object; the script computes it.

Run `node ${CLAUDE_SKILL_DIR}/scripts/check.mjs <out>/report.json`. It validates everything, writes the verdict into the file and writes `<out>/report.md`. Fix problems until it prints `OK`.

### 6. Hand over

Tell the user: the verdict and the rule that produced it, the riskiest assumption, the first experiment, and where the two files are. Keep it under ten lines; the report has the rest. Do not restate the scorecard in chat.

## Rules that override everything above

- Quote, do not paraphrase, in `evidence`. Anything not in the text is an assumption and is labeled as such.
- No invented numbers. Market sizes and prices are "assuming …" with a range.
- The verdict comes from `scripts/check.mjs`. Never write it by hand and never argue with it in the report; if it looks wrong, a score is wrong, fix the score with a reason.
- Report language follows the idea text (or `--lang`). JSON keys stay English.
- Style: short sentences, no em dashes, no hype, no "not just X but Y".
