# Workspace and helper

`node scripts/deps.mjs <command> [args] [--storage DIR] [--run ID] [--input FILE|-] [--only ECOSYSTEM] [--dry-run] [--unsafe]`

Every command prints JSON. Commands that record something take a JSON object with `--input -` (stdin) or `--input file.json`, and need the `--run` ID from `start`.

| Command | Input | Effect |
|---|---|---|
| `discover` | | Scan `roots`, run detectors, merge repositories into `settings.json`, record `discover`. |
| `status` | | Workspace paths, repository count, skips, holds, open intents, last run summary. Read-only. |
| `log [repo]` | | The global `log.md`, or one repository's `repos/<repo>/log.md`. Read-only. |
| `start [repo...]` | | Open a run (`--dry-run`, `--unsafe` are recorded). Discovers first when no repositories are recorded. Fails if another run is open. |
| `plan <repo>` | `{ "allowDirty": true }` only when the user asked | Preflight and targets, see below. Records `plan` and settings holds. |
| `inspect <pkg> <from> <to>` | `--repo R` to record it | npm tarball and metadata diff. Records `review` when `--run` and `--repo` are given. |
| `held` | `{repo, name, from, to, reason}` | A deliberate non-upgrade (concern, hold, note, dry run). |
| `skip` | `{repo, reason}` | Skip a whole repository for this run. |
| `intent` | `{repo, name, from, to, files[]}` | Write-ahead entry before touching files. Returns `intentId`. Refused in a dry run. |
| `applied` | `{intentId, notes?, migration?}` | The change is in the working tree. |
| `rolledBack` | `{intentId, reason}` | Files were restored from git. |
| `verified` | `{repo, ok, checks:[{cmd, ok, detail?}]}` | Results of the repository's checks. |
| `finish` | `{status?, summary}` | Close the run. Refused while intents are open. |
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

`latest` higher than `to` means the newer release is still inside the age window; it is picked up by a later run.

## Storage (default `~/dependencies`, `--storage` is remembered in `preferences.json`)

- `settings.json`: user-owned. Discovery only adds repositories and refreshes `path` and `ecosystems`.
  ```json
  { "version": 1, "roots": ["~"], "exclude": ["**/node_modules/**", "~/Library/**", "~/archive/**"],
    "minReleaseAgeDays": 7,
    "repos": { "web": { "path": "/Users/me/web", "ecosystems": ["npm"], "skip": false,
               "notes": "Keep React 18 until the design system ships 19 support.",
               "commands": { "check": "npm run check", "build": "npm run build" },
               "packages": { "react": { "hold": "^18", "reason": "design system" } } } },
    "packages": { "some-lib": { "hold": "<3.0.0", "reason": "3.0 moved to BSL license", "until": "2027-01-01" } },
    "ignoreAdvisories": { "GHSA-xxxx-xxxx-xxxx": { "reason": "dev-only, not bundled", "repos": ["web"] } } }
  ```
  A hold is a version range the package must stay inside: `^18`, `<3.0.0`, `3.x`, `1.2.3 - 1.9.0`, an exact version, or several joined with `||`. `until` makes a hold expire; `--unsafe` also ignores expired holds.
- `events.jsonl`: append-only, fsynced journal of every recorded step. `state.json` is its folded snapshot and can be rebuilt from it.
- `repos/<repo>/log.md`: readable per-repository history: plan, reviews, holds, applies, rollbacks, checks.
- `log.md`: one summary per run.
- `.lock`: one run at a time across all repositories; a lock left by a dead process is cleared automatically.
