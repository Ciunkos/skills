# skills

Agent Skills by [Przemysław Zalewski](https://ciunkos.com), published in the [Agent Skills](https://agentskills.io) format and as a Claude Code plugin. All of them, with install steps: [ciunkos.com/skills](https://ciunkos.com/skills).

| Skill | What it does |
|---|---|
| [business-idea-validator](skills/business-idea-validator/) | Scores a business idea on ten rubrics (1 to 5, with quoted evidence and confidence) and applies a fixed verdict rule: Build, Validate first, Pivot or Stop. Returns Markdown and JSON, in English or Polish. Also runs online at [ciunkos.com/business-idea-validator](https://ciunkos.com/business-idea-validator). |
| [przemo](skills/przemo/) | Przemo in your terminal. Reviews code hard (verdict, blockers, nits with `file:line`), answers hard calls, does the task (reads code, runs tests, fixes) and talks like Przemysław on Slack: short, dry, Polish by default, harsh on tools, warm to people. Answers at 2 AM too. The web version is [ciunkos.com/przemo](https://ciunkos.com/przemo). |

## Install

**Claude Code**, inside a session:

```
/plugin marketplace add Ciunkos/skills
/plugin install ciunkos@ciunkos
```

Or from a terminal:

```
claude plugin marketplace add Ciunkos/skills
claude plugin install ciunkos@ciunkos
```

Restart Claude Code, then `/przemo <question or task>` or `/business-idea-validator <your idea>`. If another plugin has a skill with the same name, use the full name: `/ciunkos:przemo`.

**Codex and other agents that read Agent Skills** (Cursor, Windsurf, custom): clone once and symlink the skills you want into the folder your agent loads skills from.

```
git clone https://github.com/Ciunkos/skills ~/ciunkos-skills
mkdir -p ~/.codex/skills
ln -s ~/ciunkos-skills/skills/przemo ~/.codex/skills/przemo
```

Other agents use other folders, for example `~/.agents/skills/` or `~/.claude/skills/`. Each skill is self-contained: `SKILL.md`, `references/`, `assets/`, `scripts/`.

**Claude Desktop and claude.ai:** download the `.skill` file from the [latest release](https://github.com/Ciunkos/skills/releases/latest) (for example `przemo.skill`) and upload it in Settings as a custom skill. Subagents are not available there; business-idea-validator runs the rubric passes inline.

## Update

**Claude Code**, from a terminal:

```
claude plugin marketplace update ciunkos
claude plugin update ciunkos@ciunkos
```

Then restart Claude Code. `claude plugin list` shows the installed version. The current version and what changed are on the [releases page](https://github.com/Ciunkos/skills/releases) and in each skill's `CHANGELOG.md`.

**Codex and other agents:** `git -C ~/ciunkos-skills pull`. The symlinks pick up the new version on the next session.

**Claude Desktop and claude.ai:** download the new `.skill` file from the latest release and upload it again in place of the old one.

## Uninstall

```
claude plugin uninstall ciunkos@ciunkos
claude plugin marketplace remove ciunkos
```

For Codex and other agents, delete the symlink (for example `rm ~/.codex/skills/przemo`) and the `~/ciunkos-skills` clone.

## Troubleshooting

- `Unknown command: /przemo`: restart Claude Code after installing or updating, then check `claude plugin list` shows `ciunkos@ciunkos` as enabled.
- An old version keeps running: run both update commands above, then restart.
- Two skills with the same name: call it by its full name, `/ciunkos:przemo`.

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
