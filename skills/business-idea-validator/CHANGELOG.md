# Changelog

## 0.2.0

Market scan: who already does this, and where the customers gather.

- New optional step 1b (`references/scan.md`): when the agent has a web search tool, it runs 4 to 8 searches and records up to 8 competitors (link, who it is for, entry price read on the pricing page, free plan, how the idea differs) and up to 5 public communities. No individual people, no articles or "best tools" lists as competitors. `--offline` skips it.
- The rubric passes for market, alternatives, monetization, distribution and defensibility read the scan as dated data and cite it as "Web scan, <date>". A scan that names the alternatives can settle the alternatives rubric with high confidence.
- The report gets two sections, "Who already does this" and "Where to find your first ten conversations", in English and Polish. Links that are not http(s) print as plain text.
- `assets/scan.schema.json`, `check.mjs --scan`, and an optional `scan` field in `report.json`. Reports without a scan stay valid.
- The FieldNote example carries a real scan of 28 October 2026.

## 0.1.0

First public release.

- Ten rubrics with scoring anchors, a fixed verdict rule (Build, Validate first, Pivot, Stop) and a critic pass.
- Markdown and JSON report in English or Polish, with the riskiest assumption, up to three experiments and open questions.
- `scripts/check.mjs` validates a report against the schemas, computes the verdict and renders Markdown.
- Report footer is a plain AI disclaimer: generated with AI, can make mistakes, scores are a starting point.
