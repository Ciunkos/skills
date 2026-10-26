# Indexnow

The IndexNow missing from Google Search Console. An agent uses your signed-in browser to request indexing, prioritizes useful pages, and remembers what happened.

```text
/indexnow example.com
/indexnow example.com changed pricing page
/indexnow https://example.com/pricing
/indexnow example.com --dry-run
/indexnow status example.com
/indexnow dlq example.com
/indexnow example.com --storage ~/search-history
```

Each normal run submits eligible pages until GSC reports its actual quota limit or the queue is exhausted. There is no assumed ten-request allowance and no daily submission cap. A previous quota error does not prevent the next invocation from trying again.

## Install

Install the Ciunkos plugin using the [repository instructions](https://github.com/Ciunkos/skills#install), then reload plugins. Use `/indexnow`, or `/ciunkos:indexnow` when another command has the same name.

For Codex, symlink this skill into the skills directory:

```sh
ln -s /absolute/path/to/ciunkos-skills/skills/indexnow ~/.agents/skills/indexnow
```

Start a new session to discover the skill. Codex can invoke it as `$indexnow`. Other Agent Skills runners can load the same folder. Browser access and filesystem tools are required for execution; uploading a package to a runner without them does not provide those capabilities.

Requirements: Node 20 or later, a writable directory, native Chrome window controls with screenshots and coordinate clicks, and owner or full-user access to the GSC property. No npm dependencies or Google API keys are needed. Use the equivalent native tools in your agent's harness.

## What it remembers

Default storage is `~/indexnow/<site>/`: structured state, an exact event journal, and a readable Markdown log. `--storage` selects another root and is remembered for that site. Keep the workspace accessible to future agent runs. Private working data stays outside this public skill.

It discovers sitemaps and links, tracks canonical language versions separately, favors your main language, and ranks page value with reasons. A change hint can prioritize an already indexed page for refreshing. Fingerprints help find changes; an agent must judge whether they are significant.

After accepted requests it waits 3 days, then 7 days, then 14 days for the final observation. A page still unindexed after three accepted requests enters a dead-letter queue (DLQ). A significant content or indexability fix can open another cycle while preserving the full history. Changed indexed pages track crawl freshness separately. Google's acceptance is not proof of indexing.

Logs over 50,000 words, roughly 100 text pages, are archived losslessly. The active log retains the latest 20 run summaries. The journal retains exact history.

## Run daily with your agent

Configure your own agent's scheduler. This skill does not create schedules. Use the same account, browser profile, storage location, and skill installation on every run. The computer and browser connection need to be available when your scheduler runs.

Copyable scheduling prompt:

```text
Use $indexnow to process example.com using its remembered storage, defaulting to ~/indexnow.
Inspect due requests, discover and assess new or changed pages, and request indexing for eligible URLs.
Continue until GSC displays an actual quota error or the eligible queue and discovery work are exhausted.
Do not assume a daily request count or a reset time. Try again even if the previous run hit quota.
Preserve submission history, retry timing, localized versions, and the DLQ.
Report accepted requests, observed indexing progress, new DLQ entries, and required user action.
Stay quiet when nothing changed and no action is needed, if this scheduler supports quiet results.
```

Replace the domain and skill invocation syntax for your runner. Prefer one scheduled run per site and avoid overlapping runs. An account-wide GSC quota may affect multiple sites. The next invocation tries eligible requests again and respects GSC's answer.

## Interrupted runs

The helper reports an active run rather than silently launching a competing one. Once the previous agent has stopped, recover that run and start another. A click with an unknown outcome stays pending until evidence establishes what happened. A page still being unindexed does not prove that Google rejected the earlier request.

## Browser troubleshooting

The preferred submission path is native Chrome navigation, keyboard refresh, a fresh window screenshot, and a native coordinate click. It succeeded in a controlled attempt after browser-tab clicks failed; the exact cause remains unknown. Generic errors do not establish quota exhaustion or a CAPTCHA block. If a CAPTCHA appears, the user completes it. See [the browser procedure](references/browser.md) for the sequence and tool examples. Do not resubmit accepted URLs to test the method.

See [the workspace reference](references/workspace.md) for helper inputs and recovery, and [the protocol reference](references/indexnow.md) for Bing IndexNow and Google's interfaces.
