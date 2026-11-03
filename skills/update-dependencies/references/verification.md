# Verification and rollback

## Which checks

Use `commands` from the repository's settings when present. Otherwise detect them:

- npm: the `scripts` that exist among `typecheck`, `check`, `lint`, `test:unit`, `test`, `build`, in that order. `npm test` that needs a browser (Playwright) is run when the browsers are installed locally; otherwise say it was not run.
- Prefer commands that do not reach production: skip `deploy`, `predeploy`, `postdeploy`, release, and publish scripts, and anything that calls remote APIs with real credentials.
- Repositories with reproducibility checks (vendored builds, generated files checked against hashes) run them too.
- Other ecosystems: `swift build`/`xcodebuild -scheme … build` when a scheme is obvious, `pytest` when configured, `docker build` for a changed Dockerfile when Docker is available.

Record every command with its result in `verified`. A check that cannot run (missing toolchain, needs credentials) is recorded with `ok: false` and the reason, not silently skipped.

## Compare before and after

- Installed versions: every locked version that changed must be in the plan; anything else (a transitive downgrade, a surprise major) is investigated and explained.
  A transitive downgrade right after `.npmrc` gained `min-release-age` is usually the cooldown at work: the old lockfile held a release younger than the window, and npm moved it back to the newest compliant one. Check the publish dates (`npm view <pkg> time`) and say so in the notes; it is expected, not a regression. A downgrade you cannot explain this way is rolled back.
- `npm audit`: compare counts. New advisories after an upgrade are a finding.
- Generated output: diff it when the repository commits build output or has snapshot tests.

## Rollback

Restore exactly the files listed in the intent from git (`git checkout -- <files>`), reinstall from the lockfile (`npm ci --ignore-scripts`), rerun the failing check to confirm the repository is back to green, and record `rolledBack` with the error that caused it. Never reset or clean the whole repository.
