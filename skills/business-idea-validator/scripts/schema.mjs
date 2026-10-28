/* schema.mjs — a small JSON Schema checker for the subset the skill uses:
   type, enum, required, additionalProperties, properties, items, $ref to a
   sibling schema. Pure ESM, no Node APIs, so both the CLI and the worker can
   reject a malformed rubric before it reaches a report. Returns a list of
   problems as "path: message"; empty list means valid. */

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

export function check(value, schema, { refs = {}, path = '$' } = {}) {
  const out = [];
  if (!schema || typeof schema !== 'object') return out;
  if (schema.$ref) {
    const target = refs[schema.$ref];
    if (!target) return [`${path}: unknown $ref ${schema.$ref}`];
    return check(value, target, { refs, path });
  }
  if (schema.type) {
    const t = typeOf(value);
    const ok = schema.type === 'integer' ? isInt(value) : t === schema.type;
    if (!ok) return [`${path}: expected ${schema.type}, got ${t}`];
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) out.push(`${path}: not one of ${schema.enum.join(', ')}`);
  if (schema.type === 'object' && value && typeof value === 'object') {
    for (const k of schema.required || []) if (!(k in value)) out.push(`${path}.${k}: required`);
    for (const [k, v] of Object.entries(value)) {
      const sub = schema.properties && schema.properties[k];
      if (sub) out.push(...check(v, sub, { refs, path: `${path}.${k}` }));
      else if (schema.additionalProperties === false) out.push(`${path}.${k}: not allowed`);
    }
  }
  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((v, i) => out.push(...check(v, schema.items, { refs, path: `${path}[${i}]` })));
  }
  return out;
}

/* Size limits the schema cannot express (structured outputs accept no
   minLength/maxItems). Applied to one rubric result. */
export const LIMITS = { evidence: 5, assumptions: 5, questions: 3, improve: 3, quoteChars: 300, reasoningWords: 160, itemChars: 400, openQuestions: 8 };

export function checkRubricLimits(r, path = '$') {
  const out = [];
  const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
  for (const k of ['evidence', 'assumptions', 'questions', 'improve']) {
    const arr = r[k] || [];
    if (arr.length > LIMITS[k]) out.push(`${path}.${k}: more than ${LIMITS[k]} items`);
    arr.forEach((s, i) => { if (String(s).length > (k === 'evidence' ? LIMITS.quoteChars : LIMITS.itemChars)) out.push(`${path}.${k}[${i}]: too long`); });
  }
  if (words(r.reasoning) > LIMITS.reasoningWords) out.push(`${path}.reasoning: more than ${LIMITS.reasoningWords} words`);
  if (!String(r.reasoning || '').trim()) out.push(`${path}.reasoning: empty`);
  return out;
}

/* Limits for the optional web scan. Links must be plain http(s): they end up as
   href in a report page, so anything else (javascript:, data:) is a problem. */
export const SCAN_LIMITS = { queries: 8, statusQuo: 3, competitors: 8, communities: 5, itemChars: 300 };
export const isHttpUrl = (u) => /^https?:\/\/[^\s<>"']+$/i.test(String(u || ''));

export function checkScan(scan, path = '$') {
  const out = [];
  if (!scan || typeof scan !== 'object') return out;
  const arr = (k) => (Array.isArray(scan[k]) ? scan[k] : []);
  for (const k of ['queries', 'statusQuo', 'competitors', 'communities']) {
    if (arr(k).length > SCAN_LIMITS[k]) out.push(`${path}.${k}: more than ${SCAN_LIMITS[k]} items`);
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(scan.searchedAt || ''))) out.push(`${path}.searchedAt: not an ISO date`);
  const long = (p, v) => { if (String(v || '').length > SCAN_LIMITS.itemChars) out.push(`${p}: too long`); };
  arr('competitors').forEach((c = {}, i) => {
    const p = `${path}.competitors[${i}]`;
    if (!isHttpUrl(c.url)) out.push(`${p}.url: not an http(s) link`);
    if (c.priceUrl && !isHttpUrl(c.priceUrl)) out.push(`${p}.priceUrl: not an http(s) link`);
    if (c.price && !c.priceUrl) out.push(`${p}.price: no priceUrl to read it from`);
    for (const k of ['name', 'forWhom', 'price', 'difference']) long(`${p}.${k}`, c[k]);
  });
  arr('communities').forEach((c = {}, i) => {
    const p = `${path}.communities[${i}]`;
    if (!isHttpUrl(c.url)) out.push(`${p}.url: not an http(s) link`);
    for (const k of ['name', 'why']) long(`${p}.${k}`, c[k]);
  });
  return out;
}

/* Whole report: schema, limits per rubric, each rubric id once, synthesis sizes, the scan when present. */
export function checkReport(report, { reportSchema, rubricSchema, scanSchema, order }) {
  const out = check(report, reportSchema, { refs: { 'rubric-output.schema.json': rubricSchema, 'scan.schema.json': scanSchema } });
  if (report.scan) out.push(...checkScan(report.scan, '$.scan'));
  if (!Array.isArray(report.rubrics)) return out;
  const seen = new Set();
  report.rubrics.forEach((r, i) => {
    out.push(...checkRubricLimits(r, `$.rubrics[${i}]`));
    if (seen.has(r.id)) out.push(`$.rubrics[${i}]: duplicate id ${r.id}`);
    seen.add(r.id);
  });
  for (const id of order) if (!seen.has(id)) out.push(`$.rubrics: missing ${id}`);
  const s = report.synthesis || {};
  if (Array.isArray(s.experiments)) {
    if (s.experiments.length < 1 || s.experiments.length > 3) out.push('$.synthesis.experiments: 1 to 3 items');
    s.experiments.forEach((e, i) => { if (e && e.days > 14) out.push(`$.synthesis.experiments[${i}].days: at most 14`); });
  }
  if (Array.isArray(s.openQuestions) && s.openQuestions.length > LIMITS.openQuestions) out.push(`$.synthesis.openQuestions: at most ${LIMITS.openQuestions} items`);
  return out;
}
