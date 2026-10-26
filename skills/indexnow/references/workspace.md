# Workspace and helper contract

Use Node 20 or later. No dependency installation is needed. The helper's path is `scripts/indexnow.mjs` inside this installed skill. Below, `<helper>` means that absolute path; `<run>` is the returned run ID.

```text
node <helper> start example.com [--storage /absolute/directory] [--dry-run] [--input input.json]
node <helper> configure example.com --run <run> --input input.json
node <helper> import example.com --run <run> --input input.json
node <helper> report example.com --run <run> --input report.json
node <helper> discover example.com --run <run> --take 20
node <helper> fetch example.com --run <run> --input input.json
node <helper> work example.com --take 20
node <helper> next example.com --run <run> --take 20
node <helper> view https://example.com/pricing
node <helper> assess example.com --run <run> --input input.json
node <helper> inspect example.com --run <run> --input input.json
node <helper> begin example.com --run <run> --input input.json
node <helper> result example.com --run <run> --input input.json
node <helper> finish example.com --run <run> --input input.json
node <helper> status example.com
node <helper> dlq example.com
```

`--take` bounds a returned, discovery, or fetch batch, never the run's total submissions. Repeat batches. `work` and `dlq` accept `--offset` for paging. After assessing a work batch, reassess from offset zero because completed assessments leave that list. Status returns full counts and the latest 20 accepted URLs, errors, and DLQ entries; the Markdown log and journal hold full lists. Pass the same storage override on calls within a run until it has been remembered. The usual remembered root is automatic on subsequent calls.

JSON can be supplied with `--input <file>` or `--input -` for stdin. Prefer structured tool arguments or a single-quoted heredoc over interpolating user text into shell code. Input files belong in the external workspace. All helper results are JSON; errors exit nonzero. Do not manually edit state or journal files.

## Inputs

| Command | JSON fields |
|---|---|
| start | Optional `hint` with the user's raw text |
| configure | `property`, `primaryLanguage`, `crawlLinks` (boolean), any subset |
| import | `items`: objects with `url`, optional `source`; sitemap objects also have `kind: "sitemap"` |
| report | `status` (indexed, not_indexed, excluded), `reason` (the GSC label; required unless indexed), ISO `reportedAt`; `items` with absolute `url` and optional ISO `lastCrawlAt`, or `csv` with the path of an unzipped GSC export |
| fetch | `urls`: absolute or site-relative URLs to fetch now, up to `--take` |
| hint | `text`; an ID is generated unless supplied as `id` |
| assess | `url`; optional `businessValue` (1, 2, 3) plus `valueReason`; `language`; `hintIds` |
| assess, revision | Also `significant: true`, stable `revisionKey`, `reason`, and `evidence`; optional ISO `changedAt` when the actual publication time is known; use `significant: false` to dismiss a fingerprint change |
| inspect | `url`, `indexed` (true, false, or null), `evidence`; optional `indexable`, `reason`, `googleCanonical`, ISO `lastCrawlAt` |
| begin | `url`; returns a generated `intentId` |
| result | `url`, `intentId`, `outcome` (accepted, quota, rejected, uncertain), `evidence`; optional ISO `acceptedAt` if established by evidence |
| preview | `url`; records an eligible dry-run proposal without submission |
| defer | `url`, `reason`; skip this URL for this invocation |
| finish | `reason` (exhausted, interrupted, blocked, dry_run), optional `note` |
| recover | Optional `note`; requires the interrupted run's `--run` ID |

For example, after resolving "changed pricing page" to a URL, use a revision key such as `hint:<hint-id>`. For a confirmed content change, use the saved content hash as the revision key. Reusing the same key does not reset a cycle. A new key requires fresh meaningful evidence. A timestamp alone is not evidence of a significant revision.

For submission, follow [the native browser sequence](browser.md): refresh and capture the current window before `begin`, then coordinate-click immediately afterward. Save outcome screenshot proof in the external workspace and include its path in `result.evidence`. Preserve confirmed acceptance, including manual acceptance evidence, rather than resubmitting to test a method.

## Discovery

A run starts from robots.txt. Sitemaps, including nested indexes and GSC-submitted ones, register their URLs and `lastmod` without fetching pages, and they are processed before the homepage. A later `lastmod` creates a change candidate for review. Internal links from a fetched page are followed only when no sitemap registered any page or `crawlLinks` is true; otherwise linked pages are registered and left alone. `start` resets the pending discovery queue, so a backlog from an earlier version does not run.

`fetch` reads named pages now, regardless of the seven-day revisit interval, and records HTTP status, canonical, noindex, robots, title, language, and the content fingerprint. `next` returns `fetchedAt` for each action. Fetch a candidate before inspecting it when that value is missing or older than seven days.

## Files and recovery

The default root is `~/indexnow`. Each site has `state.json`, `events.jsonl`, `log.md`, and a gitignore excluding working data. An explicit `--storage` selects a root containing those site subdirectories. `~/indexnow/preferences.json` remembers site-to-root mappings. State contains no browser credentials.

The journal is append-only and fsynced before an atomic snapshot update. A crash after journaling can be replayed. An incomplete final journal line is quarantined before the next write. Completed events are not discarded. Per-operation process locks protect writes; the active run ID also prevents two browser runs from sharing a site. A helper lock belonging to a dead process can be recovered automatically. An unreadable lock needs inspection, not blind removal. Acceptance timing defaults to the recorded click intent, preserving the original date when a later run reconciles the result. Evidence can supply a more precise acceptance time.

If the previous agent is no longer running, use `recover` with its run ID, then `start`. Pending intents remain in `work` for evidence-based reconciliation. The new active run may record a result for an old intent once its outcome is established. Repeating the same accepted result does not increment attempts twice.

Raw fingerprints ignore scripts, navigation, timestamps in time elements, and other common boilerplate. They include main text, title, canonical, and noindex state. A fingerprint change only prompts agent review. Check the actual diff or rendered page before declaring it significant. PDF and other non-HTML pages remain discoverable but need manual browser assessment.

Log compaction triggers after 50,000 words, approximately 100 text pages. It archives the prior Markdown without alteration and retains the latest 20 run summaries. Exact URL history, acceptance dates, revision cycles, and unresolved intents survive in structured state and the journal.

## Queue decisions

Scoring adds 100 for an unresolved attached hint, 50 when the GSC report lists the page as not indexed, 40 for a significant revision, 30 when this skill has no accepted request, 10/20/30 for business value, and 10 for the main language. It adds one point per eligible waiting day without a cap, then subtracts 15 per accepted request in the current cycle. Ties use the oldest eligibility date, then URL. These are queue preferences, not predictions of Google's choices. Unknown history before this workspace is not evidence of never having been submitted.

Accepted requests schedule the next observation after 3, 7, and 14 days respectively. Before retrying, obtain a fresh inspection in the current run. An unchanged indexed URL is checked again after seven days, but is not submitted merely for being old. A previously indexed URL that becomes unindexed opens a new cycle. A significant revision can reopen a DLQ cycle and preserves all earlier events and lifetime totals.

The queue suppresses pending intents, unresolved current blockers, DLQ entries, not-yet-due retries, and URLs already deferred or rejected in this invocation. A report recorded within seven days also suppresses pages it lists as indexed, unless a hint or revision is attached or an accepted request awaits observation, and pages it lists as excluded, unless a hint or revision is attached or a fetch after the report found the page indexable. Report rows never set inspection results. Unknown GSC results never become assumed indexing failures. Browser or state errors are reasons to save progress; they are not substitutes for Google's quota message.
