# Changelog

## 0.2.0

The queue is now seeded from Search Console instead of a crawl. A new `report` command records rows from the Page indexing report, so pages Google lists as crawled or discovered but not indexed are inspected first, and pages it lists as indexed or excluded are skipped for seven days unless a hint, a revision, or a fresh fetch says otherwise. Sitemaps register pages with their `lastmod` without fetching them; a later `lastmod` becomes a change candidate. Internal links are crawled only when a site has no sitemap or `configure` sets `crawlLinks`. A new `fetch` command reads named candidates before inspection, and `next` reports when each page was last fetched. A run starts from robots.txt and drops the pending fetch backlog of earlier versions. Existing workspaces replay unchanged, and the log shows the report counts.

## 0.1.1

Submissions now prefer native Chrome navigation, keyboard refresh, and a coordinate click from a fresh window screenshot, with tool-neutral instructions and a short Codex example. Troubleshooting distinguishes generic failures from quota messages and visible CAPTCHAs, preserves uncertain intents and confirmed acceptances, and describes the successful controlled attempt without claiming a proven cause. Existing workspaces and commands stay unchanged.

## 0.1.0

Request Google indexing through your signed-in Search Console browser, with a persistent queue that favors valuable pages and significant changes. Each run continues until GSC reports its actual quota or eligible work is exhausted, and keeps retry history, localized URLs, and a dead-letter queue under ~/indexnow by default. Configure daily runs with your own agent's scheduler using the README prompt.

