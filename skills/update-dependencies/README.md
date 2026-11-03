# Update dependencies

Keeps every repository on your machine up to date without trusting releases blindly. An agent finds your repositories, upgrades what is at least a week old, reviews each npm release by diffing what was actually published, migrates breaking changes, runs your checks, and writes down every step.

```text
/update-dependencies
/update-dependencies web api
/update-dependencies --dry-run
/update-dependencies --discover
/update-dependencies --only github-actions
/update-dependencies --unsafe
/update-dependencies status
/update-dependencies log web
```

Without arguments it processes every recorded repository; the first run discovers them. Majors are migrated by default (codemods, then the migration guide, then the failing call sites) unless a hold or a note in your settings says otherwise. A release that looks wrong is held and reported, not installed.

## Install

Install the Ciunkos plugin using the [repository instructions](https://github.com/Ciunkos/skills#install), then reload plugins. Use `/update-dependencies`, or `/ciunkos:update-dependencies` when another command has the same name.

For Codex, symlink this skill into the skills directory:

```sh
ln -s /absolute/path/to/ciunkos-skills/skills/update-dependencies ~/.agents/skills/update-dependencies
```

Requirements: Node 20 or later, git, npm 11.10 or later for `min-release-age`, and network access to the npm registry, nodejs.org, Docker Hub, PyPI, CocoaPods trunk, and the GitHub API. Set `GITHUB_TOKEN` or `GH_TOKEN` for a higher GitHub API limit. No npm dependencies.

## What it covers

| Ecosystem | Found in | Upgrades to |
|---|---|---|
| npm | every `package.json` with its lockfile, nested projects included | newest release at least 7 days old, `^` ranges, `min-release-age` in `.npmrc` |
| Node.js | `.nvmrc`, `.node-version`, `engines`, `setup-node`, `FROM node:` | newest LTS major at least 7 days old |
| Docker | `FROM` in Dockerfiles | newer tag of the same flavor, pinned by digest |
| GitHub Actions | `uses:` in workflows and composite actions | newest release, pinned by commit SHA with the version as a comment |
| Python | `==` pins in requirements and pyproject; uv, Poetry, Pipenv locks | newest release at least 7 days old |
| Xcode | SwiftPM `Package.resolved`, CocoaPods `Podfile.lock` | newest release at least 7 days old |

New ecosystems are one detector module and one reference file each.

## Before anything is installed

For every npm upgrade it downloads both versions' tarballs, checks them against the registry's integrity hash, and compares them: new or changed install scripts, native binaries, obfuscated or high-entropy code, new reads of tokens and secrets, a different publisher or lost provenance, a license change, added dependencies, and size jumps. It reads the changelog section between the two versions and, for majors, the migration notes. Install scripts never run: every npm command uses `--ignore-scripts`.

## Settings and notes

Everything lives in `~/dependencies` (`--storage` picks another directory and is remembered):

- `settings.json`: the repositories, with `skip`, free-text `notes`, custom `commands`, and holds such as `"some-lib": { "hold": "<3.0.0", "reason": "3.0 moved to a non-OSI license" }`. Edit it any time; runs only add newly found repositories.
- `events.jsonl` and `state.json`: a write-ahead log of every planned, reviewed, applied, verified, held, and rolled back change, so an interrupted run can be recovered.
- `repos/<repo>/log.md`: a readable update and check log per repository. `log.md`: one summary per run.

Changes stay in each repository's working tree, with the log next to them in `~/dependencies`.

## Run it on a schedule

This skill does not create schedules. Point your agent's own scheduler at it, daily or weekly. A run never waits for input: decisions it cannot make are held and reported.

```text
Use $update-dependencies with its remembered storage, defaulting to ~/dependencies.
Process every recorded repository. Respect skips, holds, and notes in settings.json.
Review every upgrade before applying it and migrate breaking changes.
Report applied, held, and rolled back changes per repository, with reasons.
Stay quiet when nothing changed, if this scheduler supports quiet results.
```

## Interrupted runs

`/update-dependencies status` shows an open run and its open intents. The next run recovers it: every file an unfinished step touched is restored from git before anything else happens.
