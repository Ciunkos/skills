# Changelog

## 0.1.0

First public release.

- Ten rubrics with scoring anchors, a fixed verdict rule (Build, Validate first, Pivot, Stop) and a critic pass.
- Markdown and JSON report in English or Polish, with the riskiest assumption, up to three experiments and open questions.
- `scripts/check.mjs` validates a report against the schemas, computes the verdict and renders Markdown.
- Report footer is a plain AI disclaimer: generated with AI, can make mistakes, scores are a starting point.
