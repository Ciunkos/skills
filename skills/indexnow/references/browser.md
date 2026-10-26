# GSC browser procedure

Use the user's authenticated Chrome session. Discover the harness's native app/window controls, screenshots, keyboard shortcuts, and coordinate clicks. Follow its API and coordinate conventions. Browser extensions and tab tools can help locate information; prefer native controls throughout the submission sequence.

## Authentication and property

Foreground the intended Chrome window and Search Console tab. Reuse the signed-in profile; do not extract browser credentials or tokens. If native controls are unavailable, report the limitation and preserve progress for user handoff. Do not silently replace the preferred submission method with a tab click.

Open Search Console and resolve the domain property (`sc-domain:example.com`) or the matching URL-prefix property (`https://www.example.com/`). Confirm the selected property covers the inspected URL. A domain property can cover subdomains, but the helper keeps discovery within the requested hostname and its www counterpart. Record out-of-scope language alternates as gaps for separate site runs.

Use the Sitemaps report to import submitted sitemap URLs into discovery. Report a missing or broken sitemap as a discovery issue. This skill does not change the website or register new sitemaps automatically.

## Page indexing report

Open Indexing, then Pages, for the resolved property. Note the date the report says it was last updated; pass it as `reportedAt`. The report is a sample that lags by days. It seeds the queue and never replaces an inspection, and a listed reason is not proof that a request was rejected.

1. In the table of reasons why pages are not indexed, open each reason with a nonzero count. Set rows per page to the maximum and page through the table, or use Export and read the unzipped CSV with the `csv` input. GSC shows at most 1,000 rows per reason. Record each reason with one `report` call, with the exact reason label and `lastCrawlAt` in ISO form when the column is readable.
2. Open the sample behind the indexed count (the link to view data about indexed pages) and record it as `indexed`.
3. Rows from other hosts of a domain property are skipped by the helper; list them as gaps for a separate run.

Map reasons to a status by meaning, reading labels in the user's language:

| Status | GSC reasons |
|---|---|
| not_indexed | Crawled, currently not indexed; Discovered, currently not indexed |
| excluded | Excluded by noindex tag; Alternate page with proper canonical tag; Duplicate without user-selected canonical; Duplicate, Google chose different canonical than user; Page with redirect; Redirect error; Blocked by robots.txt; Blocked due to unauthorized request (401); Blocked due to access forbidden (403); Not found (404); Server error (5xx); Soft 404 |
| indexed | The indexed pages sample |

Observed Polish labels include "Strona zeskanowana, ale jeszcze nie zindeksowana" for crawled, currently not indexed and "Alternatywna strona zawierająca prawidłowy tag strony kanonicznej" for the canonical alternate. An excluded page returns to the queue only after a hint, a significant revision, or a fresh `fetch` that finds it indexable. Browser-tab reading tools are fine here; the native sequence below applies to submission.

## Inspection evidence

Use native Chrome controls to enter the fully qualified URL in the property's inspection field. Wait for indexed data to load. Capture:

- Whether GSC says the URL is on Google, not on Google, or the result is unavailable.
- The last crawl timestamp and Google-selected canonical, when present.
- The indexing exclusion reason and any current live-test evidence used to decide indexability.

The indexed result describes Google's stored information. A successful live test demonstrates current fetchability, not inclusion in Google's index. Current HTTP, robots, noindex, and canonical problems need to be recorded. An outdated stored exclusion can require a live test before deciding whether the fix is ready.

Read current labels in the user's language. Do not assume an English UI or hard-code button positions. A Google-selected canonical different from the inspected URL is a canonical conflict to investigate. Do not try to force intentional duplicates into the index.

## Default submission

For a helper action of `submit`:

1. Use the authenticated Chrome session and foreground the intended GSC tab.
2. Navigate and inspect through native Chrome controls.
3. Refresh using the native keyboard shortcut. Wait until the correct inspected URL and result are visible.
4. Capture a fresh native-window screenshot and locate Request indexing in that image.
5. Record the helper's `begin` intent immediately before submission. Keep its ID.
6. Click that button using the native app/window coordinate-click tool.
7. Wait for the actual acceptance, rejection, or quota message. Save screenshot proof and record `result` with the matching intent ID, exact message, and proof location.
8. After acceptance, continue with another eligible URL. Stop for an explicit quota message; there is no local request-count limit.

Coordinates must come from the current native screenshot in the tool's coordinate space. Account for image scaling. If the window, layout, or scroll position changes, capture another screenshot before clicking. Never reuse test coordinates or assume a screen size. Keep browser-tab DOM/Playwright and browser-tab accessibility clicks out of this submission sequence.

### Optional Codex example

Other harnesses should use equivalent native-window APIs. In Codex's `cua_repl`, the successful sequence used these calls, with observation and helper recording between them:

```javascript
const chromeApp = await cua.getApp('com.google.Chrome');
// Select the intended tab and inspect through native controls first.
await chromeApp.pressKey('super+r');
// Wait for the correct URL and result, then obtain the current screenshot.
await chromeApp.getScreenshot();
// Derive x and y from that screenshot; record begin immediately before clicking.
await chromeApp.click([x, y]);
```

## Outcomes and troubleshooting

Possible outcomes:

| Outcome | Required evidence | Next step |
|---|---|---|
| accepted | GSC confirms the request was accepted or added to its indexing queue | Record, continue |
| quota | GSC explicitly says a quota or submission limit was exceeded | Record, end this invocation |
| rejected | GSC explicitly says the request failed or cannot proceed, including a generic submission error | Record, continue with another URL |
| uncertain | A click may have happened, but its result cannot be established | Keep pending, reconcile before another click on this URL |

A quota refusal does not count as an accepted request. It does not create a date-based lockout. On the next invocation, try an eligible URL and let GSC answer again. Do not switch accounts to evade a refusal.

The observed generic error was: "Ups, coś poszło nie tak. Podczas przesyłania prośby o zindeksowanie treści wystąpił problem. Spróbuj ponownie później." Treat it as a submission failure. It alone proves neither quota exhaustion nor bot detection, a reCAPTCHA block, or a visible challenge.

If a CAPTCHA actually appears, stop and tell the user to complete it. Never solve it. Do not add human-mimicking mouse movements, stealth techniques, token manipulation, or verification bypasses. For login, access, or browser failures, save progress and report the required action.

If a pending click survived an interrupted run, inspect the surviving page or other actual evidence before recording its result. Inspection saying "not indexed" cannot establish whether a request was previously accepted. When evidence is insufficient, retain the unresolved intent, report it for review, and work on other URLs. Never resubmit a confirmed accepted URL merely to test this method. Preserve any recorded manual acceptance too.

## Evidence behind this default

In a controlled attempt, browser-tab DOM/Playwright clicks repeatedly produced the generic error, and a browser-tab accessibility click also failed. The user succeeded manually after refreshing. The agent then succeeded with native Chrome navigation, a native refresh, and a coordinate click from a fresh native-window screenshot, without browser-tab DOM/Playwright interaction during submission or simulated human movement.

GSC confirmed "Przesłano prośbę o zindeksowanie" and entry into its priority indexing queue. This supports the preferred default; it is not a guarantee or proof of the underlying cause. Acceptance means queued for indexing, not confirmed indexed. Keep run-specific screenshots and history in the user's workspace, outside the public skill.
