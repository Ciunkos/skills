#!/usr/bin/env node
/* check.mjs — the only script that touches the file system. Validates a report
   (or a single rubric result) against the schemas, computes the verdict from the
   scores, and renders Markdown.

   node check.mjs report.json            → prints problems or OK, writes verdict into the file, writes report.md next to it
   node check.mjs report.json --lang pl  → render in Polish regardless of report.lang
   node check.mjs report.json --stdout   → print Markdown instead of writing report.md
   node check.mjs --rubric rubric.json   → validate one rubric result only
   Exit code 1 on any problem. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, checkReport, checkRubricLimits } from './schema.mjs';
import { verdict } from './verdict.mjs';
import { renderMarkdown } from './render.mjs';
import { RUBRIC_ORDER, LANGS } from './i18n.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const schema = (name) => JSON.parse(readFileSync(join(here, '..', 'assets', name), 'utf8'));

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const file = args.find((a) => !a.startsWith('--') && !['--lang', '--rubric'].includes(args[args.indexOf(a) - 1]));

const fail = (lines) => { for (const l of lines) console.error('  ' + l); process.exit(1); };

if (flag('--rubric')) {
  const r = JSON.parse(readFileSync(resolve(flag('--rubric')), 'utf8'));
  const problems = [...check(r, schema('rubric-output.schema.json')), ...checkRubricLimits(r)];
  if (problems.length) { console.error('rubric result has problems:'); fail(problems); }
  console.log('OK: rubric result valid');
  process.exit(0);
}

if (!file) { console.error('usage: node check.mjs report.json [--lang en|pl] [--stdout]'); process.exit(1); }
const path = resolve(file);
const report = JSON.parse(readFileSync(path, 'utf8'));
const lang = flag('--lang') || report.lang;
if (!LANGS.includes(lang)) { console.error(`unknown lang ${lang}`); process.exit(1); }

/* The verdict is always recomputed: the rule is the source of truth, not what a model wrote. */
report.verdict = verdict(report);
const problems = checkReport(report, { reportSchema: schema('report.schema.json'), rubricSchema: schema('rubric-output.schema.json'), order: RUBRIC_ORDER });
if (problems.length) { console.error('report has problems:'); fail(problems); }

writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
const mdText = renderMarkdown(report, lang);
if (flag('--stdout')) { process.stdout.write(mdText); }
else {
  const out = path.replace(/\.json$/, '') + (lang === report.lang ? '' : '.' + lang) + '.md';
  writeFileSync(out, mdText);
  console.log(`OK: verdict ${report.verdict.label} (${report.verdict.rule}); wrote ${out}`);
}
