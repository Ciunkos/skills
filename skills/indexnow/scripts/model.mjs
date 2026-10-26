/* Queue decisions and event replay. All timestamps come from the event, including in tests. */
const DAY = 86_400_000;
export const normalizeUrl = (value, base) => {
  const u = new URL(value, base);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('Use a public HTTP(S) URL without credentials');
  u.hash = '';
  return u.href;
};
export const siteName = (target) => new URL(normalizeUrl(target.includes('://') ? target : `https://${target}`)).hostname.replace(/^www\./, '');
export const inScope = (state, url) => siteName(url) === state.site;
export const createState = (target) => ({
  version: 1, seq: 0, site: siteName(target), origin: new URL(normalizeUrl(target.includes('://') ? target : `https://${target}`)).origin,
  settings: { property: null, primaryLanguage: null }, pages: {}, hints: [], runs: [], currentRun: null,
  discovery: { pending: [], fetched: {}, fetchedInRun: {}, failures: [] }, logFrom: 0,
});
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} requires nonempty text`);
  return value;
};
const date = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) throw new Error('Expected an ISO timestamp');
  return Date.parse(value);
};
const addDays = (at, days) => new Date(date(at) + days * DAY).toISOString();
const runFor = (s, id) => {
  const r = s.runs.find((r) => r.id === id);
  if (!r || s.currentRun !== id || r.status !== 'active') throw new Error('An active matching --run is required');
  return r;
};
const pageFor = (s, url) => {
  const p = s.pages[normalizeUrl(url)];
  if (!p) throw new Error('Discover or import the URL first');
  return p;
};
const ensurePage = (s, value, at, source = 'input') => {
  const url = normalizeUrl(value, s.origin);
  if (!inScope(s, url)) throw new Error('URL is outside this site; run that site separately');
  const p = s.pages[url] ||= {
    url, firstSeen: at, eligibleSince: at, sources: [], language: null, alternates: [], title: '',
    businessValue: 1, valueReason: 'Unassessed', indexable: null, blockedReason: null,
    contentHash: null, contentPreview: '', changeCandidate: null, inspection: null,
    everObservedIndexed: false, lifetimeAccepted: 0, hintIds: [], pending: null, lastOutcome: null,
    cycle: { id: 0, key: null, changedAt: null, reason: null, accepted: [], nextActionAt: at, status: 'queued' },
  };
  if (!p.sources.includes(source)) p.sources.push(source);
  return p;
};
const enqueue = (s, value, kind, at, force = false) => {
  const url = normalizeUrl(value, s.origin);
  if (!inScope(s, url)) return;
  const seen = s.discovery.fetched[`${kind}:${url}`];
  if (!force && kind === 'page' && seen && date(at) - date(seen) < 7 * DAY) return;
  if (!force && kind !== 'page' && s.discovery.fetchedInRun[`${kind}:${url}`] === s.currentRun) return;
  if (!s.discovery.pending.some((x) => x.url === url && x.kind === kind)) s.discovery.pending.push({ url, kind });
};
export const score = (s, p, now) => {
  const activeHint = p.hintIds.some((id) => s.hints.some((h) => h.id === id && !h.resolvedAt));
  const parts = {
    hint: activeHint ? 100 : 0, change: p.cycle.changedAt ? 40 : 0,
    unsubmitted: p.lifetimeAccepted === 0 ? 30 : 0, value: p.businessValue * 10,
    language: p.language && s.settings.primaryLanguage && p.language.toLowerCase() === s.settings.primaryLanguage.toLowerCase() ? 10 : 0,
    waiting: Math.max(0, Math.floor((date(now) - date(p.eligibleSince)) / DAY)),
    attempts: -15 * p.cycle.accepted.length,
  };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
};
const actionFor = (s, p, run, now) => {
  if (p.pending || p.blockedReason || p.cycle.status === 'dlq') return null;
  if (run.deferred.includes(p.url) || run.previewed.includes(p.url) || p.lastOutcome?.runId === run.id) return null;
  if (date(p.cycle.nextActionAt) > date(now)) return null;
  if (p.cycle.status === 'complete' && p.inspection && date(now) - date(p.inspection.at) < 7 * DAY) return null;
  if (p.inspection?.runId !== run.id) return 'inspect';
  if (p.inspection.indexed === null || p.cycle.status === 'complete' || p.cycle.accepted.length >= 3) return null;
  if (p.cycle.changedAt && p.inspection.indexed && !p.inspection.lastCrawlAt) return null;
  if (p.indexable !== true) return null;
  return run.dryRun ? 'would_submit' : 'submit';
};
export const queue = (s, runId, now, take = 20) => {
  const run = s.runs.find((r) => r.id === runId);
  if (!run || s.currentRun !== runId || run.status !== 'active') return [];
  return Object.values(s.pages).flatMap((p) => {
    const action = actionFor(s, p, run, now);
    return action ? [{ url: p.url, action, score: score(s, p, now), eligibleSince: p.eligibleSince, title: p.title, language: p.language, valueReason: p.valueReason, cycle: p.cycle, inspection: p.inspection }] : [];
  }).sort((a, b) => b.score.total - a.score.total || a.eligibleSince.localeCompare(b.eligibleSince) || a.url.localeCompare(b.url)).slice(0, take);
};
export const summary = (s) => {
  const counts = { total: 0, indexedObserved: 0, pending: 0, dlq: 0, blocked: 0, needsReview: 0, queued: 0 };
  for (const p of Object.values(s.pages)) {
    counts.total++;
    if (p.inspection?.indexed) counts.indexedObserved++;
    if (p.pending) counts.needsReview++;
    if (p.blockedReason) counts.blocked++;
    if (p.cycle.status in counts) counts[p.cycle.status]++;
  }
  const last = s.runs.at(-1), latestRun = last ? {
    id: last.id, at: last.at, endedAt: last.endedAt, status: last.status, dryRun: last.dryRun, inspected: last.inspected,
    acceptedCount: last.accepted.length, accepted: last.accepted.slice(-20), previewedCount: last.previewed.length,
    errorCount: last.errors.length, errors: last.errors.slice(-20), dlqCount: last.dlq.length, dlq: last.dlq.slice(-20), observations: last.observations.slice(-20), quota: last.quota, note: last.note,
  } : null;
  return { site: s.site, settings: s.settings, counts, discoveryRemaining: s.discovery.pending.length, currentRun: s.currentRun, latestRun, unresolvedHints: s.hints.filter((h) => !h.resolvedAt) };
};
export const applyEvent = (state, event) => {
  const s = structuredClone(state), d = event.data || {}, at = event.at;
  date(at);
  if (event.seq !== s.seq + 1) throw new Error('Journal sequence mismatch');
  switch (event.type) {
    case 'start': {
      if (s.currentRun) throw new Error('Site already has an active run; resume it or recover an interrupted run');
      if (s.runs.some((r) => r.id === d.id)) throw new Error('Run ID already exists');
      s.runs.push({ id: requireText(d.id, 'Run ID'), at, status: 'active', dryRun: !!d.dryRun, accepted: [], errors: [], dlq: [], observations: [], inspected: 0, previewed: [], deferred: [] });
      s.currentRun = d.id;
      enqueue(s, `${s.origin}/robots.txt`, 'robots', at);
      enqueue(s, `${s.origin}/`, 'page', at, true);
      for (const p of Object.values(s.pages)) enqueue(s, p.url, 'page', at);
      break;
    }
    case 'configure': {
      runFor(s, d.runId);
      for (const key of ['property', 'primaryLanguage']) if (key in d) s.settings[key] = requireText(d[key], key);
      break;
    }
    case 'import': {
      runFor(s, d.runId);
      for (const item of d.items || []) {
        if (item.kind === 'sitemap') enqueue(s, item.url, 'sitemap', at, true);
        else { const p = ensurePage(s, item.url, at, item.source || 'input'); enqueue(s, p.url, 'page', at, true); }
      }
      break;
    }
    case 'hint': {
      runFor(s, d.runId);
      if (!s.hints.some((h) => h.id === d.id)) s.hints.push({ id: requireText(d.id, 'Hint ID'), text: requireText(d.text, 'Hint'), at, resolvedAt: null });
      break;
    }
    case 'assess': {
      runFor(s, d.runId);
      const p = pageFor(s, d.url);
      if ('businessValue' in d) {
        if (![1, 2, 3].includes(d.businessValue)) throw new Error('businessValue must be 1, 2, or 3');
        p.businessValue = d.businessValue;
        p.valueReason = requireText(d.valueReason, 'Value evidence');
      }
      if (d.language) p.language = d.language;
      for (const id of d.hintIds || []) {
        if (!s.hints.some((h) => h.id === id)) throw new Error('Unknown hint ID');
        if (!p.hintIds.includes(id)) { p.hintIds.push(id); s.hints.find((h) => h.id === id).resolvedAt = null; }
      }
      if (d.significant) {
        requireText(d.reason, 'Significant change reason'); requireText(d.evidence, 'Change evidence'); requireText(d.revisionKey, 'Revision key');
        if (p.cycle.key !== d.revisionKey) {
          if (p.pending) throw new Error('Reconcile the pending submission before opening a revision');
          if (d.changedAt && date(d.changedAt) > date(at)) throw new Error('Change time is in the future');
          p.cycle = { id: p.cycle.id + 1, key: d.revisionKey, changedAt: d.changedAt || at, reason: d.reason, evidence: d.evidence, accepted: [], nextActionAt: at, status: 'queued' };
          p.eligibleSince = at;
          p.inspection = null;
          p.lastOutcome = null;
        }
      }
      if ('significant' in d) p.changeCandidate = null;
      break;
    }
    case 'discovered': {
      runFor(s, d.runId);
      const { url, kind } = d.task;
      if (!inScope(s, url)) throw new Error('Discovery task outside site');
      s.discovery.pending = s.discovery.pending.filter((x) => !(x.url === url && x.kind === kind));
      s.discovery.fetched[`${kind}:${url}`] = at;
      s.discovery.fetchedInRun[`${kind}:${url}`] = s.currentRun;
      if (d.error) s.discovery.failures.push({ url, kind, at, error: d.error });
      for (const task of d.tasks || []) enqueue(s, task.url, task.kind, at);
      for (const item of d.pages || []) ensurePage(s, item.url, at, item.source || url);
      if (d.page) {
        const p = ensurePage(s, d.page.url, at, url), oldHash = p.contentHash, wasIndexable = p.indexable, beforePreview = p.contentPreview;
        for (const key of ['title', 'language', 'alternates', 'contentHash', 'contentPreview', 'indexable', 'blockedReason', 'canonical', 'httpStatus']) if (key in d.page) p[key] = d.page[key];
        if (oldHash && oldHash !== p.contentHash) p.changeCandidate = { before: oldHash, after: p.contentHash, beforePreview, afterPreview: p.contentPreview, at, reason: 'Main content or indexability metadata changed; assess significance' };
        if (wasIndexable === false && p.indexable === true) p.changeCandidate = { before: oldHash, after: p.contentHash, at, reason: 'Indexability blocker cleared; assess significance' };
        if (!s.settings.primaryLanguage && new URL(p.url).pathname === '/' && p.language) s.settings.primaryLanguage = p.language;
      }
      break;
    }
    case 'inspect': {
      const r = runFor(s, d.runId), p = pageFor(s, d.url);
      const previous = p.inspection, previousStatus = p.cycle.status;
      if (![true, false, null].includes(d.indexed)) throw new Error('indexed must be true, false, or null');
      requireText(d.evidence, 'Inspection evidence');
      if (d.lastCrawlAt) { date(d.lastCrawlAt); if (date(d.lastCrawlAt) > date(at)) throw new Error('Crawl time is in the future'); }
      p.inspection = { indexed: d.indexed, lastCrawlAt: d.lastCrawlAt || null, googleCanonical: d.googleCanonical || null, evidence: d.evidence, at, runId: r.id };
      r.inspected++;
      if (typeof d.indexable === 'boolean') { p.indexable = d.indexable; p.blockedReason = d.indexable ? null : (d.reason || d.evidence); }
      if (d.googleCanonical && normalizeUrl(d.googleCanonical) !== p.url) p.blockedReason = `Google selected another canonical: ${d.googleCanonical}`;
      if (d.indexed) p.everObservedIndexed = true;
      const refreshed = d.indexed === true && (!p.cycle.changedAt || (d.lastCrawlAt && date(d.lastCrawlAt) >= date(p.cycle.changedAt)));
      if (refreshed) {
        p.cycle.status = 'complete';
        p.cycle.nextActionAt = addDays(at, 7);
        for (const h of s.hints) if (p.hintIds.includes(h.id) && Object.values(s.pages).filter((x) => x.hintIds.includes(h.id)).every((x) => x.cycle.status === 'complete')) h.resolvedAt = at;
      } else if (p.cycle.status === 'complete' && d.indexed === false) {
        p.cycle = { id: p.cycle.id + 1, key: `lost:${at}`, changedAt: null, reason: 'Previously indexed URL is now unindexed', accepted: [], nextActionAt: at, status: 'queued' };
        p.eligibleSince = at;
      } else if (d.indexed !== null && p.cycle.accepted.length >= 3 && date(at) >= date(p.cycle.nextActionAt) && (!d.indexed || d.lastCrawlAt)) {
        p.cycle.status = 'dlq';
        r.dlq.push({ url: p.url, at, reason: d.indexed ? 'Refresh not observed after three accepted requests' : 'Still unindexed after three accepted requests', evidence: d.evidence });
      }
      if (previous?.indexed !== d.indexed || previousStatus !== p.cycle.status) r.observations.push({ url: p.url, at, indexed: d.indexed, lastCrawlAt: p.inspection.lastCrawlAt, status: p.cycle.status, evidence: d.evidence });
      break;
    }
    case 'begin': {
      const r = runFor(s, d.runId), p = pageFor(s, d.url);
      if (actionFor(s, p, r, at) !== 'submit') throw new Error('URL needs a fresh inspection, eligibility, or its cooldown has not elapsed');
      if (Object.values(s.pages).some((x) => x.pending?.runId === r.id && x.lastOutcome?.intentId !== x.pending.id)) throw new Error('Record the current click outcome before another submission');
      p.pending = { id: requireText(d.intentId, 'Intent ID'), runId: r.id, at, cycleId: p.cycle.id };
      break;
    }
    case 'result': {
      const p = pageFor(s, d.url);
      if (p.lastOutcome?.intentId === d.intentId && p.lastOutcome.outcome === d.outcome) break;
      const r = runFor(s, d.runId);
      if (!p.pending || p.pending.id !== d.intentId) throw new Error('Matching submission intent required');
      if (r.dryRun) throw new Error('Dry-run cannot record submission outcomes');
      if (!['accepted', 'quota', 'rejected', 'uncertain'].includes(d.outcome)) throw new Error('Unknown submission outcome');
      requireText(d.evidence, 'Visible outcome evidence');
      p.lastOutcome = { intentId: d.intentId, runId: r.id, outcome: d.outcome, evidence: d.evidence, at };
      if (d.outcome === 'accepted') {
        const acceptedAt = d.acceptedAt || p.pending.at;
        if (date(acceptedAt) > date(at) || date(acceptedAt) < date(p.pending.at)) throw new Error('Acceptance time must be between the original intent and this observation');
        p.cycle.accepted.push({ at: acceptedAt, observedAt: at, intentId: d.intentId, evidence: d.evidence });
        p.lifetimeAccepted++;
        p.cycle.status = 'pending';
        p.cycle.nextActionAt = addDays(acceptedAt, [3, 7, 14][p.cycle.accepted.length - 1]);
        p.eligibleSince = p.cycle.nextActionAt;
        r.accepted.push({ url: p.url, at: acceptedAt, observedAt: at, intentId: d.intentId, reconciledFrom: p.pending.runId !== r.id ? p.pending.runId : null });
      } else if (d.outcome === 'quota') {
        r.status = 'quota'; r.quota = { at, evidence: d.evidence }; r.endedAt = at; s.currentRun = null;
      } else r.errors.push({ url: p.url, at, outcome: d.outcome, evidence: d.evidence });
      if (d.outcome !== 'uncertain') p.pending = null;
      break;
    }
    case 'defer': {
      const r = runFor(s, d.runId); pageFor(s, d.url);
      r.deferred.push(d.url); r.errors.push({ url: d.url, at, evidence: requireText(d.reason, 'Deferral reason') });
      break;
    }
    case 'preview': {
      const r = runFor(s, d.runId), p = pageFor(s, d.url);
      if (!r.dryRun || actionFor(s, p, r, at) !== 'would_submit') throw new Error('Preview requires an eligible dry-run URL');
      r.previewed.push(p.url);
      break;
    }
    case 'finish': {
      const r = runFor(s, d.runId);
      if (!['exhausted', 'interrupted', 'blocked', 'dry_run'].includes(d.reason)) throw new Error('Invalid finish reason');
      if (d.reason === 'exhausted' && queue(s, r.id, at, 1).length) throw new Error('Eligible work remains');
      if (d.reason === 'exhausted' && s.discovery.pending.length) throw new Error('Discovery remains; continue in batches');
      r.status = d.reason; r.note = d.note || ''; r.endedAt = at; s.currentRun = null;
      break;
    }
    case 'compact': s.logFrom = Math.max(0, s.runs.length - 20); s.compacted = true; break;
    default: throw new Error(`Unknown event: ${event.type}`);
  }
  s.seq = event.seq;
  return s;
};
