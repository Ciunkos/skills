# GitHub Actions

Every `uses: owner/repo[/path]@ref` in `.github/workflows/*.yml` and composite `action.yml` files. Local actions (`./…`) and `docker://` images are skipped.

- Target: the newest release at least `minReleaseAgeDays` old, pinned by full commit SHA with the tag as a trailing comment:
  `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`.
  A tag or branch ref (`@v4`, `@main`) is reported even when it is the newest release: tags can be moved, SHAs cannot.
- Use the `uses` value from `plan` verbatim; it was resolved from the release tag to its commit, following annotated tags.
- Read the action's release notes for majors: new Node runtimes, renamed inputs, removed outputs.
- Dependabot keeps SHA pins and their comments updated when the repository has a `github-actions` entry in `.github/dependabot.yml`; suggest one if it is missing.
- Changes to `.github/workflows/` need a token with the `workflow` scope to push; note it in the report when workflows changed.
- Set `GITHUB_TOKEN` or `GH_TOKEN` for the helper to avoid the unauthenticated API limit.
