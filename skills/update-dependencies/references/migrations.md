# Majors and migrations

Breaking changes are migrated by default, the same day, in the same run. The aim is behavior parity: the repository does exactly what it did before, on the new version.

## Order

1. Read the migration guide and the breaking changes (see review.md). Note every item that touches this repository.
2. Upgrade with the ecosystem's tool (`npm install --ignore-scripts <name>@^<version>`), then reinstall from the lockfile (`npm ci --ignore-scripts`) to prove the lockfile is complete.
3. Run the official codemod when one exists (for example `npx <tool>-codemod` or the framework's upgrade command), with `--ignore-scripts` where npm is involved and only from the package's own documentation.
4. Build and typecheck; fix what the codemod missed, one category at a time.
5. Run the repository's tests and compare generated output with the previous build (prerendered HTML, bundles, snapshots). Differences must be explained: intended by the release, or fixed.
6. Record `applied` with `migration`: what changed in code and why.

## Rules learned the hard way

- **Peer groups move together**: React with react-dom and its types; ESLint with its plugins and configs; a framework with its official adapters. Plan them as one intent.
- **A plugin that does not support the new major** is a reason to replace it with a maintained fork or successor, or to keep the major back with a hold that names the blocker. Never paper over it with `--force`.
- **Vendored or rebuilt artifacts** (copied UMD files, prebuilt SDKs, hashed assets): rebuild them and check they still match their integrity or reproducibility checks. When the bytes change, they need a new versioned path if the old one was cached as immutable.
- **Transitive inputs count**: if a build depends on transitive packages (a bundled SDK, a compiler plugin), check that their locked versions did not move unexpectedly.
- **Removed APIs**: search for every removed export, option, and CLI flag named in the notes, including in config files, scripts, and CI workflows.
- **Runtime majors** (Node.js LTS, a Docker base image): update every declaration together (version files, engines, CI setup, Dockerfiles), then run the checks on the new runtime.
- **When parity cannot be reached** within the run, roll the major back, record why, and suggest a hold with the reason so the next run does not retry blindly.
