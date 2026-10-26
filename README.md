# skills

Agent Skills by [Przemysław Zalewski](https://ciunkos.com), published in the [Agent Skills](https://agentskills.io) format and as a Claude Code plugin. All of them, with install steps: [ciunkos.com/skills](https://ciunkos.com/skills). Each skill has its own page with the why, an example and install steps.

| Skill | What it does |
|---|---|
| [business-idea-validator](skills/business-idea-validator/) ([page](https://ciunkos.com/skills/business-idea-validator)) | Scores a business idea on ten rubrics (1 to 5, with quoted evidence and confidence) and applies a fixed verdict rule: Build, Validate first, Pivot or Stop. Returns Markdown and JSON, in English or Polish. Also runs online at [ciunkos.com/business-idea-validator](https://ciunkos.com/business-idea-validator). |
| [przemo](skills/przemo/) ([page](https://ciunkos.com/skills/przemo)) | Przemo in your terminal. Reviews code hard (verdict, blockers, nits with `file:line`), answers hard calls, does the task (reads code, runs tests, fixes) and talks like Przemysław on Slack: short, dry, Polish by default, harsh on tools, warm to people. Answers at 2 AM too. The web version is [ciunkos.com/przemo](https://ciunkos.com/przemo). |
| [indexnow](skills/indexnow/) ([page](https://ciunkos.com/skills/indexnow)) | The IndexNow missing from GSC. Uses your signed-in browser to prioritize indexing requests, continues until Google's actual quota response, and remembers retries and a dead-letter queue under `~/indexnow`. Includes a prompt for your own agent's scheduler. |

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

Run `/reload-plugins` (or start a new session), then `/przemo <question or task>`, `/business-idea-validator <your idea>`, or `/indexnow <domain> [hint]`. If another plugin has a skill with the same name, use the full name, such as `/ciunkos:indexnow`.

**Codex and other agents that read Agent Skills** (Cursor, Windsurf, custom): clone once and symlink the skills you want into the folder your agent loads skills from.

```
git clone https://github.com/Ciunkos/skills ~/ciunkos-skills
mkdir -p ~/.agents/skills
ln -s ~/ciunkos-skills/skills/przemo ~/.agents/skills/przemo
```

Codex reads `~/.agents/skills/` (and `.agents/skills/` inside a repository). Other agents use other folders, for example `~/.claude/skills/`. Each skill is self-contained: `SKILL.md`, `references/`, `assets/`, `scripts/`.

**Claude Desktop and claude.ai:** download the `.skill` file from the [latest release](https://github.com/Ciunkos/skills/releases/latest) (for example `przemo.skill`) and upload it in Settings as a custom skill. Subagents are not available there; business-idea-validator runs the rubric passes inline.

**ChatGPT** (Business, Enterprise, Healthcare and Edu workspaces): download the same `.skill` file, then in the sidebar open Plugins, the Skills tab, Create, Upload from your computer. ChatGPT scans the skill before it becomes available.

## Update

**Claude Code**, inside a session:

```
/plugin marketplace update ciunkos
/reload-plugins
```

The first command refreshes the marketplace and updates the plugins installed from it. The second loads the new version into the open session, no restart needed.

Or from a terminal:

```
claude plugin marketplace update ciunkos
claude plugin update ciunkos@ciunkos
```

Then run `/reload-plugins` in an open session, or start a new one.

**Automatic updates:** in a session open `/plugin`, go to the Marketplaces tab, select `ciunkos` and choose "Enable auto-update". Third-party marketplaces have it off by default. `claude plugin list` shows the installed version. The current version and what changed are on the [releases page](https://github.com/Ciunkos/skills/releases) and in each skill's `CHANGELOG.md`.

**Codex and other agents:** `git -C ~/ciunkos-skills pull`. The symlinks pick up the new version on the next session.

**Claude Desktop and claude.ai:** download the new `.skill` file from the latest release and upload it again in place of the old one.

## Uninstall

```
claude plugin uninstall ciunkos@ciunkos
claude plugin marketplace remove ciunkos
```

For Codex and other agents, delete the symlink (for example `rm ~/.agents/skills/przemo`) and the `~/ciunkos-skills` clone.

## Troubleshooting

- `Unknown command: /przemo`: run `/reload-plugins` or start a new session, then check `claude plugin list` shows `ciunkos@ciunkos` as enabled.
- An old version keeps running: `/plugin marketplace update ciunkos`, then `/reload-plugins`.
- Two skills with the same name: call it by its full name, `/ciunkos:przemo`.

## Develop

Zero dependencies, Node 20 or newer.

```
node --test                                   # all tests
npx skills-ref validate skills/business-idea-validator
npx skills-ref validate skills/przemo
npx skills-ref validate skills/indexnow
claude plugin validate --strict .             # with Claude Code installed
node skills/business-idea-validator/scripts/check.mjs skills/business-idea-validator/assets/examples/fieldnote/report.json --stdout
```

Rules for contributors are in `AGENTS.md`.

## License

MIT, see `LICENSE`.

## Releases

Every push to `main` that raises a version publishes a [GitHub Release](https://github.com/Ciunkos/skills/releases) with the notes from the skill's `CHANGELOG.md` and a `.skill` file you can upload to claude.ai or Claude Desktop. The stable download links are [business-idea-validator.skill](https://github.com/Ciunkos/skills/releases/latest/download/business-idea-validator.skill), [przemo.skill](https://github.com/Ciunkos/skills/releases/latest/download/przemo.skill), and [indexnow.skill](https://github.com/Ciunkos/skills/releases/latest/download/indexnow.skill). Indexnow needs a runner with local filesystem and authenticated browser tools; the package alone does not supply them.

To release a change: `node scripts/bump.mjs <skill> patch|minor|major`, write the new `## <version>` section in the skill's `CHANGELOG.md`, commit, push. `node scripts/release-plan.mjs --check` tells you before the push whether the release would go through.
