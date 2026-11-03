# Node.js runtime

Declarations: `.nvmrc`, `.node-version`, `engines.node` in package.json, `node-version:` in `actions/setup-node` steps, and `FROM node:` in Dockerfiles. The target is the newest LTS major whose release is at least `minReleaseAgeDays` old, from nodejs.org/dist/index.json. Odd majors and Current releases are never targets.

- Move every declaration in a repository together. Prefer `node-version-file: .nvmrc` in workflows so CI follows the file.
- `.nvmrc` and `.node-version`: the major (`26`), unless the repository pins full versions, then the full version.
- `engines.node` is a compatibility statement: raise it only to the versions the repository's own dependencies require, and say so.
- Dockerfiles: change the tag's major and pin the digest (see docker.md).
- Verify on the new runtime: `node --version` first, then the repository's checks. Hosted builds (Cloudflare Pages, Vercel, Netlify) read `.node-version`/`.nvmrc`; mention that the next deployment builds on the new major.
