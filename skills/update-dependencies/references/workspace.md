# Workspace and helper

`node scripts/deps.mjs <command> [args] [--storage DIR] [--run ID] [--input FILE|-] [--only ECOSYSTEM] [--dry-run] [--unsafe]`

Every command prints JSON. Commands that record something take a JSON object with `--input -` (stdin) or `--input file.json`, and need the `--run` ID from `start`.

| Command | Input | Effect |
|---|---|---|
| `discover` | | Scan `roots`, run detectors, merge repositories into `settings.json`, record `discover`. A `.git` with no commits (an accidental `git init` in a home folder) is walked past, not taken as a repository. |
| `status` | | Workspace paths, repository count, skips, holds, open intents, last run summary. Read-only. |
| `log [repo]` | | The global `log.md`, or one repository's `repos/<repo>/log.md`. Read-only. |
| `start [repo...]` | | Open a run (`--dry-run`, `--unsafe` are recorded). Discovers first when no repositories are recorded. Fails if another run is open. |
| `plan <repo>` | `{ "allowDirty": true }` only when the user asked | Preflight and targets, see below. Records `plan` and settings holds. |
| `inspect <pkg> <from> <to>` | `--repo R` to record it | npm tarball and metadata diff. Records `review` when `--run` and `--repo` are given. |
| `held` | `{repo, name, from, to, reason}` | A deliberate non-upgrade (concern, hold, note, dry run). |
| `skip` | `{repo, reason}` | Skip a whole repository for this run. |
| `intent` | `{repo, name, from, to, files[]}` | Write-ahead entry before touching files. Returns `intentId`. Refused in a dry run, for a repository not in settings, and without `files` (relative paths inside the repository). Use the plan item's `name` as is (detail may follow after a space); a group names its packages: `react group (react, react-dom)`. |
| `applied` | `{intentId, notes?, migration?}` | The change is in the working tree. |
| `rolledBack` | `{intentId, reason}` | Files were restored from git. |
| `verified` | `{repo, ok, checks:[{cmd, ok, detail?}]}` | Results of the repository's checks. |
| `assert <repo>` | | Compare the working tree with the run's record (see below). Records `asserted`; any later `applied` or `rolledBack` makes it stale. |
| `finish` | `{status?, summary, incomplete?}` | Close the run. Refused while intents are open or a changed repository has no passing assert; `incomplete: "<why>"` closes it as incomplete. |
| `recover` | | Close an interrupted run; every open intent becomes a rollback to perform, with its files listed. |

## plan output

```json
{ "repo": "web", "path": "/Users/me/web", "notes": "", "ecosystems": ["npm", "github-actions"],
  "references": ["references/detectors/npm.md", "references/detectors/github-actions.md"],
  "items": [
    { "ecosystem": "npm", "project": ".", "section": "devDependencies", "name": "vite", "from": "6.4.1", "to": "7.2.2", "kind": "major", "newSpec": "^7.2.2", "publishedAt": "…", "latest": "7.3.0" },
    { "ecosystem": "github-actions", "file": ".github/workflows/ci.yml", "name": "actions/checkout", "from": "v4", "to": "<sha> # v7.0.1", "kind": "major", "uses": "actions/checkout@<sha> # v7.0.1" },
    { "ecosystem": "npm", "project": ".", "name": ".npmrc", "from": "missing", "to": "min-release-age=7", "kind": "config" }
  ],
  "held": [], "review": [], "errors": [] }
```

Targets come only from versions the registry still serves and never above the `latest` dist-tag: unpublished versions stay in the registry's `time` map forever and must not be picked.

`latest` higher than `to` means the newer release is still inside the age window; it is picked up by a later run.

## Storage (default `~/dependencies`, `--storage` is remembered in `preferences.json`)

- `settings.json`: user-owned. Discovery only adds repositories and refreshes `path` and `ecosystems`.
  ```json
  { "version": 1, "roots": ["~"], "exclude": ["**/node_modules/**", "~/Library/**", "~/old-laptop", "/Volumes/Backup"],
    "minReleaseAgeDays": 7,
    "repos": { "web": { "path": "/Users/me/web", "ecosystems": ["npm"], "skip": false,
               "notes": "Keep React 18 until the design system ships 19 support.",
               "commands": { "check": "npm run check", "build": "npm run build" },
               "packages": { "react": { "hold": "^18", "reason": "design system" } } } },
    "packages": { "some-lib": { "hold": "<3.0.0", "reason": "3.0 moved to BSL license", "until": "2027-01-01" } },
    "ignoreAdvisories": { "GHSA-xxxx-xxxx-xxxx": { "reason": "dev-only, not bundled", "repos": ["web"] } } }
  ```
  `exclude` bans paths outright: discovery never walks them, entries it added under them are dropped, and `start`, `plan`, and the agent never touch them. A plain path (`"~/old-laptop"`, `"/Volumes/Backup"`) bans that directory and everything below it; a glob (`**`, `*`, `?`, with `~` for home) matches absolute paths. Entries under an excluded path that carry user data (notes, commands, holds, skip) are kept but ignored; `status` lists them as `excludedEntries`.
  A hold is a version range the package must stay inside: `^18`, `<3.0.0`, `3.x`, `1.2.3 - 1.9.0`, an exact version, or several joined with `||`. `until` makes a hold expire; `--unsafe` also ignores expired holds.
- `events.jsonl`: append-only, fsynced journal of every recorded step. `state.json` is its folded snapshot and can be rebuilt from it.
- `repos/<repo>/log.md`: readable per-repository history: plan, reviews, holds, applies, rollbacks, checks.
- `log.md`: one summary per run.
- `.lock`: one run at a time across all repositories; a lock left by a dead process is cleared automatically.

## assert output

```json
{ "repo": "web", "ok": false,
  "errors": ["a: applied 2.0.0 but package-lock.json has 1.0.0 (a later step restored an older lockfile?)",
             "zod: held at 3.23.8 but the lockfile has 3.25.76 (moved by another step, such as npm audit fix or a group install)"],
  "warnings": ["openai: changed 4.73.0 → 4.104.0 with no recorded outcome; inspect it and record it"] }
```

Errors: a planned item with no outcome; an applied npm item whose lockfile version differs (resolved past the target means a missing cooldown); an applied item of another ecosystem whose file lacks the target; a held or rolled-back package that moved; a direct dependency that went down without an outcome; an npm project without `min-release-age`; no passing `verified` after the last change. Warnings: direct changes without an outcome, transitive downgrades.
