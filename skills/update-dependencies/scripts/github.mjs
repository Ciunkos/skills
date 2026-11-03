/* Read-only GitHub API helper for actions and Swift packages: releases, tags, and the commit a
   tag points to. Uses GITHUB_TOKEN or GH_TOKEN when present (higher rate limit), never writes. */

export const makeGithub = ({ fetcher = fetch, token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN } = {}) => {
  const get = async (path) => {
    const res = await fetcher(`https://api.github.com${path}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'update-dependencies-skill', ...(token ? { authorization: `Bearer ${token}` } : {}) }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status}`);
    return res.json();
  };
  /* Releases (not drafts, not prereleases) with their publish date, newest first. */
  const releases = async (repo) => ((await get(`/repos/${repo}/releases?per_page=100`)) || [])
    .filter((r) => !r.draft && !r.prerelease).map((r) => ({ tag: r.tag_name, at: r.published_at }));
  const tags = async (repo) => ((await get(`/repos/${repo}/tags?per_page=100`)) || []).map((t) => ({ tag: t.name, sha: t.commit.sha }));
  /* Annotated tags point at a tag object; follow it to the commit. */
  const commitOf = async (repo, tag) => {
    const ref = await get(`/repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`);
    if (!ref) return null;
    if (ref.object.type === 'commit') return ref.object.sha;
    const obj = await get(`/repos/${repo}/git/tags/${ref.object.sha}`);
    return obj?.object?.sha || null;
  };
  return { releases, tags, commitOf };
};

/* "https://github.com/owner/repo(.git)" or "owner/repo" → "owner/repo". */
export const repoOf = (location) => {
  const m = /github\.com[/:]([^/]+\/[^/#?]+?)(?:\.git)?(?:[/#?]|$)/.exec(String(location)) || /^([\w.-]+\/[\w.-]+)$/.exec(String(location));
  return m ? m[1] : null;
};
