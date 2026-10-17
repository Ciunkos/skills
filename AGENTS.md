# Rules for working in this repository

Read before changing anything. These apply to people and agents alike.

## Content

- Everything here is original. Do not copy prompts, rubric text, agent definitions, scripts or report layouts from other skill packs, plugins or products, including ones installed on this machine. Reproducing a general pattern (a scorecard, a verdict rule, a changelog) is fine; reproducing wording or code is not.
- No real client, employer or private person is named anywhere, including examples, tests and commit messages. Example ideas are invented (the one shipped is "FieldNote", a made-up landscaping app).
- American English in skill text and code comments where English is used. Polish only in Polish-facing output (`scripts/i18n.mjs` `pl`) and in Polish example reports.
- Report style rules in `skills/business-idea-validator/references/report-style.md` apply to any text a model will emit, and to this repository's own prose: short sentences, no em dashes, no hype.

## Code

- Zero dependencies. Plain Node 20+, ES modules, `node --test`. No build step.
- `scripts/verdict.mjs`, `scripts/render.mjs`, `scripts/i18n.mjs`, `scripts/schema.mjs` must stay free of Node-only APIs (`node:*`, `process`, `fs`, `path`). They are bundled into a Cloudflare Worker as they are. `tests/purity.test.mjs` enforces this.
- `scripts/check.mjs` is the only file that reads or writes the disk.
- Arrow functions, small files, a header comment that says what the file is for.
- Nothing in this repository runs on its own, sends anything, or calls a network. The skill reads files and runs `check.mjs`; that is all.

## Skills

- One folder per skill under `skills/`, named exactly as the `name` in its `SKILL.md`, following the Agent Skills specification (`SKILL.md` with `name` and `description`; optional `references/`, `assets/`, `scripts/`).
- `SKILL.md` stays under 300 lines. Detail goes to `references/`.
- Subagent definitions live in `agents/` at the repository root, named `<skill>-<role>`.
- Any change a user can notice gets a version bump in `SKILL.md` (`metadata.version`) and a line in the skill's `CHANGELOG.md`, in the same commit. `.claude-plugin/plugin.json` carries the pack version.

## Verdict rule

The verdict thresholds live only in `RULES` inside `scripts/verdict.mjs`. Changing them requires a new case in `tests/verdict.test.mjs` and a changelog line. Do not restate thresholds in prose except in `references/verdict.md`, which must match.
