/* render.mjs — report JSON → Markdown, in English or Polish. Pure ESM, no
   Node APIs; the template is a function, not a file, so the worker can bundle
   it. Everything printed comes from the report object; the renderer adds
   labels and structure only. */
import { labels, fill, RUBRIC_ORDER } from './i18n.mjs';
import { band, byId } from './verdict.mjs';

/* Markdown-safe inline text: no raw HTML, no line breaks inside a cell. */
const md = (s) => String(s == null ? '' : s).replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›')).replace(/\|/g, '∣').replace(/\s*\n\s*/g, ' ').trim();
const block = (s) => String(s == null ? '' : s).replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›')).trim();
const list = (arr) => (arr && arr.length ? arr.map((x) => `- ${md(x)}`).join('\n') : '');
const quotes = (arr) => (arr && arr.length ? arr.map((x) => `> ${md(x)}`).join('\n>\n') : '');

const pips = (score) => '●'.repeat(band(score)) + '○'.repeat(5 - band(score));

export function renderMarkdown(report, lang = report.lang) {
  const L = labels(lang);
  const S = L.section;
  const r = byId(report.rubrics);
  const v = report.verdict;
  const V = L.verdict[v.label];
  const ruleText = fill(L.rule[v.rule] || v.rule, { n: v.decisive.length, ids: v.decisive.map((id) => L.rubric[id].name).join(', ') });
  const parts = [];

  parts.push(`# ${S.title}`);
  parts.push('');
  parts.push(`## ${S.verdict}: ${V.label}`);
  parts.push('');
  parts.push(block(V.line));
  parts.push('');
  parts.push(`**${S.why}.** ${block(ruleText)}`);
  parts.push('');

  parts.push(`## ${S.scorecard}`);
  parts.push('');
  parts.push(`| ${S.score} | ${S.cols.rubric} | ${S.cols.band} | ${S.cols.confidence} |`);
  parts.push('|---|---|---|---|');
  for (const id of RUBRIC_ORDER) {
    if (!r[id]) continue;
    const x = r[id];
    parts.push(`| ${pips(x.score)} | **${md(L.rubric[id].name)}** | ${md(L.band[band(x.score)])} | ${md(L.confidence[x.confidence])} |`);
  }
  parts.push('');

  const s = report.synthesis;
  parts.push(`## ${S.summary}`);
  parts.push('');
  parts.push(block(s.summary));
  parts.push('');
  parts.push(`**${S.riskiest}.** ${block(s.riskiestAssumption)}`);
  parts.push('');
  if (s.notes && String(s.notes).trim()) { parts.push(`**${S.notes}.** ${block(s.notes)}`); parts.push(''); }
  parts.push(`## ${S.experiments}`);
  parts.push('');
  s.experiments.forEach((e, i) => {
    parts.push(`${i + 1}. **${md(e.name)}** (${e.days} ${S.days}). ${md(e.what)} ${S.metric}: ${md(e.metric)}`);
  });
  parts.push('');
  if (s.pivots && s.pivots.length) { parts.push(`## ${S.pivots}`); parts.push(''); parts.push(list(s.pivots)); parts.push(''); }
  if (s.openQuestions && s.openQuestions.length) { parts.push(`## ${S.questions}`); parts.push(''); parts.push(list(s.openQuestions)); parts.push(''); }

  parts.push(`## ${S.rubrics}`);
  parts.push('');
  for (const id of RUBRIC_ORDER) {
    if (!r[id]) continue;
    const x = r[id];
    parts.push(`### ${md(L.rubric[id].name)}: ${x.score}/5, ${md(L.band[band(x.score)])} (${md(L.confidence[x.confidence])})`);
    parts.push('');
    parts.push(`*${md(L.rubric[id].question)}*`);
    parts.push('');
    parts.push(block(x.reasoning));
    parts.push('');
    if (x.evidence && x.evidence.length) { parts.push(`**${S.evidence}**`); parts.push(''); parts.push(quotes(x.evidence)); parts.push(''); }
    if (x.assumptions && x.assumptions.length) { parts.push(`**${S.assumptions}**`); parts.push(''); parts.push(list(x.assumptions)); parts.push(''); }
    if (x.questions && x.questions.length) { parts.push(`**${S.ask}**`); parts.push(''); parts.push(list(x.questions)); parts.push(''); }
    if (x.improve && x.improve.length) { parts.push(`**${S.improve}**`); parts.push(''); parts.push(list(x.improve)); parts.push(''); }
  }

  if (report.critic) {
    parts.push(`## ${S.critic}`);
    parts.push('');
    if (!report.critic.changes.length) parts.push(block(S.criticNone));
    else parts.push(report.critic.changes.map((c) => `- ${md(fill(S.criticChange, { id: L.rubric[c.id] ? L.rubric[c.id].name : c.id, from: c.from, to: c.to, why: c.why }))}`).join('\n'));
    if (report.critic.notes) { parts.push(''); parts.push(block(report.critic.notes)); }
    parts.push('');
  }

  parts.push(`## ${S.idea}`);
  parts.push('');
  parts.push(quotes([report.idea.text]).replace(/\n>\n/g, '\n>\n'));
  parts.push('');
  const a = report.idea.answers || {};
  const keys = Object.keys(S.answerKeys).filter((k) => a[k]);
  if (keys.length) { parts.push(`**${S.answers}**`); parts.push(''); parts.push(keys.map((k) => `- ${S.answerKeys[k]}: ${md(a[k])}`).join('\n')); parts.push(''); }

  parts.push('---');
  parts.push('');
  parts.push(block(fill(S.meta, { date: String(report.meta.createdAt).slice(0, 10), model: report.meta.model })));
  parts.push('');
  return parts.join('\n');
}
