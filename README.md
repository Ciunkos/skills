# skills

Agent Skills by [Przemysław Zalewski](https://ciunkos.com), published in the [Agent Skills](https://agentskills.io) format and as a Claude Code plugin. All of them, with install steps: [ciunkos.com/skills](https://ciunkos.com/skills).

| Skill | What it does |
|---|---|
| [business-idea-validator](skills/business-idea-validator/) | Scores a business idea on ten rubrics (1 to 5, with quoted evidence and confidence) and applies a fixed verdict rule: Build, Validate first, Pivot or Stop. Returns Markdown and JSON, in English or Polish. Also runs online at [ciunkos.com/business-idea-validator](https://ciunkos.com/business-idea-validator). |
| [przemo](skills/przemo/) | Przemo in your terminal. Does the task (reads code, runs tests, fixes) and talks like Przemysław on Slack: short, dry, Polish by default, harsh on tools, warm to people. Answers at 2 AM too. The web version is [ciunkos.com/przemo](https://ciunkos.com/przemo). |

## Install

**Claude Code**

```
/plugin marketplace add Ciunkos/skills
/plugin install ciunkos@ciunkos
```

Then `/business-idea-validator <your idea>` or `/przemo <question or task>`.

**Any agent that reads Agent Skills** (Codex, Cursor, Windsurf, custom): copy or symlink `skills/<name>` into the place your agent loads skills from (for example `~/.codex/skills/`, `~/.agents/skills/` or `~/.claude/skills/`). Each skill is self-contained: `SKILL.md`, `references/`, `assets/`, `scripts/`.

**Claude Desktop / claude.ai:** upload the skill's `.skill` file from the latest release as a custom skill. Subagents are not available there; business-idea-validator runs the rubric passes inline.

## Develop

Zero dependencies, Node 20 or newer.

```
node --test                                   # all tests
npx skills-ref validate skills/business-idea-validator
npx skills-ref validate skills/przemo
claude plugin validate --strict .             # with Claude Code installed
node skills/business-idea-validator/scripts/check.mjs skills/business-idea-validator/assets/examples/fieldnote/report.json --stdout
```

Rules for contributors are in `AGENTS.md`.

## License

MIT, see `LICENSE`.

## Releases

Every push to `main` that raises a version publishes a [GitHub Release](https://github.com/Ciunkos/skills/releases) with the notes from the skill's `CHANGELOG.md` and a `.skill` file you can upload to claude.ai or Claude Desktop. The latest ones are always at [releases/latest/download/business-idea-validator.skill](https://github.com/Ciunkos/skills/releases/latest/download/business-idea-validator.skill) and [releases/latest/download/przemo.skill](https://github.com/Ciunkos/skills/releases/latest/download/przemo.skill).

To release a change: `node scripts/bump.mjs <skill> patch|minor|major`, write the new `## <version>` section in the skill's `CHANGELOG.md`, commit, push. `node scripts/release-plan.mjs --check` tells you before the push whether the release would go through.
