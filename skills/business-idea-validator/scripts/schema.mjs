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
export const LIMITS = { evidence: 5, assumptions: 5, questions: 3, improve: 3, quoteChars: 300, reasoningWords: 120, itemChars: 400 };

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

/* Whole report: schema, limits per rubric, each rubric id once, synthesis sizes. */
export function checkReport(report, { reportSchema, rubricSchema, order }) {
  const out = check(report, reportSchema, { refs: { 'rubric-output.schema.json': rubricSchema } });
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
  return out;
}
