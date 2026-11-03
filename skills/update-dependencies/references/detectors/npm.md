# npm

Detected from every `package.json` outside `node_modules`, including nested projects (a `functions/` or `container/` folder with its own lockfile). Each project is planned and verified on its own.

## Conventions

- Ranges in `package.json` are carets: `"vite": "^7.2.2"`. An exact pin found in a manifest becomes a caret range unless the repository's notes or a hold say it must stay exact.
- `.npmrc` in every project with a lockfile has `min-release-age=7` (or the settings value), so npm itself only resolves releases that old, including transitive ones. `plan` reports a missing line as a `config` item. npm 11.10+ supports it; older npm ignores it, so check `npm --version`.
- Install from the lockfile with `npm ci --ignore-scripts`. Use `npm install --ignore-scripts` only to add or change dependencies:
  - update one: `npm install --ignore-scripts <name>@^<to>` (`--save-dev` for devDependencies);
  - refresh the lockfile after editing ranges or overrides: `npm install --ignore-scripts`.
- Never `npm update` across the board, `npm audit fix --force`, `--legacy-peer-deps`, or `--force`.

## Apply

1. Record the intent with `package.json` and the lockfile (and `.npmrc` if it changes).
2. Install the target. Check the lockfile: the package is at `to`, nothing else moved except its own dependency subtree; a version that went down is a finding.
3. `npm audit --json` before and after. A transitive advisory with a fixed release in range: `npm audit fix --ignore-scripts` (without `--force`), then check what moved. With a fix only outside the parent's range: an `overrides` entry, only after confirming the parent works with it and that the vulnerable code actually ships (a bundler that inlines a dependency ignores overrides).
4. An advisory with no fix: write why it is unreachable in the report; offer an `ignoreAdvisories` entry the user can add.

## Monorepos and workspaces

Run npm commands from the workspace root and target a workspace with `-w <name>`. Plan items list `project` relative to the repository.
