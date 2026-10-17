# skills

Agent Skills by [Przemysław Zalewski](https://ciunkos.com), published in the [Agent Skills](https://agentskills.io) format and as a Claude Code plugin.

> Placeholder: the GitHub owner and the package name are not final. Search for `OWNER` before publishing.

| Skill | What it does |
|---|---|
| [business-idea-validator](skills/business-idea-validator/) | Scores a business idea on ten rubrics (1 to 5, with quoted evidence and confidence) and applies a fixed verdict rule: Build, Validate first, Pivot or Stop. Returns Markdown and JSON, in English or Polish. Also runs online at [ciunkos.com/business-idea-validator](https://ciunkos.com/business-idea-validator). |

## Install

**Claude Code**

```
/plugin marketplace add OWNER/skills
/plugin install ciunkos@ciunkos
```

Then `/business-idea-validator <your idea>`.

**Any agent that reads Agent Skills** (Codex, Cursor, Windsurf, custom): copy or symlink `skills/<name>` into the place your agent loads skills from (for example `~/.agents/skills/` or `~/.claude/skills/`). Each skill is self-contained: `SKILL.md`, `references/`, `assets/`, `scripts/`.

**Claude Desktop / claude.ai:** upload the skill folder as a custom skill. Subagents are not available there; the skill runs the rubric passes inline.

## Develop

Zero dependencies, Node 20 or newer.

```
node --test                                   # all tests
npx skills-ref validate skills/business-idea-validator
claude plugin validate --strict .             # with Claude Code installed
node skills/business-idea-validator/scripts/check.mjs skills/business-idea-validator/assets/examples/fieldnote/report.json --stdout
```

Rules for contributors are in `AGENTS.md`.

## License

MIT, see `LICENSE`.
