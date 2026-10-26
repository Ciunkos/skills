# Changelog

## 0.1.1

Submissions now prefer native Chrome navigation, keyboard refresh, and a coordinate click from a fresh window screenshot, with tool-neutral instructions and a short Codex example. Troubleshooting distinguishes generic failures from quota messages and visible CAPTCHAs, preserves uncertain intents and confirmed acceptances, and describes the successful controlled attempt without claiming a proven cause. Existing workspaces and commands stay unchanged.

## 0.1.0

Request Google indexing through your signed-in Search Console browser, with a persistent queue that favors valuable pages and significant changes. Each run continues until GSC reports its actual quota or eligible work is exhausted, and keeps retry history, localized URLs, and a dead-letter queue under ~/indexnow by default. Configure daily runs with your own agent's scheduler using the README prompt.

