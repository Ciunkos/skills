/* Public sitemap and page discovery. Sitemaps register pages; single pages are fetched on request. No Google API calls or browser credentials. */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { normalizeUrl, inScope } from './model.mjs';

export const decode = (text) => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, key) => {
  if (key[0] !== '#') return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[key.toLowerCase()];
  const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
  return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : whole;
});
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4])]));
const textOnly = (html) => decode(html.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const safeUrl = (raw, base) => { if (typeof raw !== 'string' || !raw.trim()) return null; try { return normalizeUrl(raw, base); } catch { return null; } };

export const parseSitemap = (xml, base) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Sitemap DTDs and entity declarations are unsupported');
  const stack = [], urls = [], sitemaps = [], alternates = [], entries = [];
  let loc = '', lastmod = '', root = null, entry = null;
  for (const token of xml.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (token.startsWith('<![CDATA[')) { if (stack.at(-1)?.local === 'loc') loc += token.slice(9, -3); if (stack.at(-1)?.local === 'lastmod') lastmod += token.slice(9, -3); continue; }
    if (!token.startsWith('<')) { if (stack.at(-1)?.local === 'loc') loc += decode(token); if (stack.at(-1)?.local === 'lastmod') lastmod += decode(token); continue; }
    const closing = /^<\//.test(token), selfClosing = /\/>$/.test(token);
    const name = /^<\/?\s*([\w:.-]+)/.exec(token)?.[1];
    if (!name) continue;
    const [prefix, local] = name.includes(':') ? name.split(':') : ['', name];
    if (closing) {
      const top = stack.pop();
      if (!top || top.name !== name) throw new Error('Malformed sitemap XML');
      if (local === 'loc' && prefix === root?.prefix && stack.at(-1)?.prefix === prefix) {
        const url = safeUrl(loc.trim(), base);
        if (url && stack.at(-1)?.local === 'url') { urls.push(url); entry = { url, lastmod: null }; }
        if (url && stack.at(-1)?.local === 'sitemap') sitemaps.push(url);
      }
      if (local === 'lastmod' && stack.at(-1)?.local === 'url' && entry && Number.isFinite(Date.parse(lastmod.trim()))) entry.lastmod = new Date(lastmod.trim()).toISOString();
      if (local === 'url') { if (entry) entries.push(entry); entry = null; }
      continue;
    }
    root ||= { prefix, local };
    if (local === 'loc') loc = '';
    if (local === 'lastmod') lastmod = '';
    if (local === 'link' && stack.at(-1)?.local === 'url') {
      const a = attrs(token), url = safeUrl(a.href, base);
      if (url && a.hreflang) alternates.push({ url, language: a.hreflang });
    }
    if (!selfClosing) stack.push({ name, prefix, local });
  }
  if (stack.length || !['urlset', 'sitemapindex'].includes(root?.local)) throw new Error('Expected a complete sitemap urlset or sitemapindex');
  return { urls: [...new Set(urls)], sitemaps: [...new Set(sitemaps)], alternates, entries };
};

export const parseRobots = (text) => {
  const groups = [], sitemaps = [];
  let agents = [], rules = [], hasRules = false;
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; hasRules = false; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(), colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (key === 'sitemap') { sitemaps.push(value); continue; }
    if (key === 'user-agent') { if (hasRules) flush(); agents.push(value.toLowerCase()); }
    else if (['allow', 'disallow'].includes(key) && agents.length) { rules.push({ allow: key === 'allow', pattern: value }); hasRules = true; }
  }
  flush(); return { groups, sitemaps };
};
export const robotsAllowed = (robots, url, agent = 'indexnow') => {
  const matching = robots.groups.flatMap((g) => g.agents.filter((a) => a === '*' || agent.toLowerCase().includes(a)).map((a) => ({ ...g, length: a === '*' ? 0 : a.length })));
  const specificity = Math.max(-1, ...matching.map((g) => g.length));
  const u = new URL(url), path = u.pathname + u.search;
  const rules = matching.filter((g) => g.length === specificity).flatMap((g) => g.rules).filter((r) => r.pattern).filter((r) => {
    const escaped = r.pattern.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}`).test(path);
  }).sort((a, b) => b.pattern.replace(/[\*$]/g, '').length - a.pattern.replace(/[\*$]/g, '').length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
};

export const parsePage = (html, url, headers = {}) => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const tags = [...clean.matchAll(/<(?:link|meta|html|a)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map((m) => ({ tag: /^<(\w+)/.exec(m[0])[1].toLowerCase(), a: attrs(m[0]) }));
  const canonical = safeUrl(tags.find((x) => x.tag === 'link' && x.a.rel?.split(/\s+/).includes('canonical'))?.a.href || url, url);
  const robots = tags.filter((x) => x.tag === 'meta' && ['robots', 'googlebot'].includes(x.a.name?.toLowerCase())).map((x) => x.a.content).join(',') + ',' + (headers['x-robots-tag'] || '');
  const noindex = /\b(noindex|none)\b/i.test(robots);
  const main = /<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)\s*>/i.exec(clean)?.[1] || clean.replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const content = textOnly(main.replace(/<time\b[^>]*>[\s\S]*?<\/time\s*>/gi, ''));
  const title = textOnly(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(clean)?.[1] || '');
  const language = tags.find((x) => x.tag === 'html')?.a.lang || null;
  const alternates = tags.filter((x) => x.tag === 'link' && x.a.hreflang && x.a.href).map((x) => ({ url: safeUrl(x.a.href, url), language: x.a.hreflang })).filter((x) => x.url);
  const links = tags.filter((x) => x.tag === 'a' && x.a.href).map((x) => safeUrl(x.a.href, url)).filter(Boolean);
  const blockedReason = noindex ? 'Page declares noindex' : canonical !== url ? `Page declares another canonical: ${canonical}` : null;
  const contentHash = createHash('sha256').update(JSON.stringify({ content, title, canonical, noindex })).digest('hex');
  return { page: { url, title, language, alternates, canonical, contentHash, contentPreview: content.slice(0, 2000), indexable: !blockedReason, blockedReason }, links: [...new Set(links)] };
};

export const makeDiscoverer = ({ fetcher = fetch, version = '0.1.0', maxBytes = 10_000_000 } = {}) => {
  const cache = new Map();
  const read = async (url, state, allowed = async () => true) => {
    let current = url;
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (!inScope(state, current)) throw new Error('Redirect leaves site scope');
      if (!await allowed(current)) throw new Error('Redirect or URL disallowed by robots.txt');
      const r = await fetcher(current, { redirect: 'manual', headers: { 'user-agent': `indexnow/${version} (public sitemap discovery)` }, signal: AbortSignal.timeout(20_000) });
      if ([301, 302, 303, 307, 308].includes(r.status)) {
        const location = r.headers.get('location');
        if (!location) throw new Error('Redirect without Location');
        await r.body?.cancel(); current = normalizeUrl(location, current); continue;
      }
      const chunks = []; let size = 0;
      for await (const chunk of r.body || []) { size += chunk.length; if (size > maxBytes) throw new Error('Response exceeds discovery file size limit'); chunks.push(chunk); }
      let bytes = Buffer.concat(chunks);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes, { maxOutputLength: maxBytes });
      return { url: current, status: r.status, headers: Object.fromEntries(r.headers), text: bytes.toString('utf8') };
    }
    throw new Error('Too many redirects');
  };
  const robotsFor = async (url, state) => {
    const origin = new URL(url).origin;
    if (!cache.has(origin)) {
      const r = await read(`${origin}/robots.txt`, state);
      if (r.status !== 404 && r.status !== 410 && (r.status < 200 || r.status >= 300)) throw new Error(`Cannot read robots.txt (${r.status})`);
      cache.set(origin, parseRobots([404, 410].includes(r.status) ? '' : r.text));
    }
    return cache.get(origin);
  };
  return async (state, task) => {
    const result = { task, tasks: [], pages: [] };
    try {
      const robots = await robotsFor(task.url, state);
      if (!robotsAllowed(robots, task.url)) throw new Error('Discovery disallowed by robots.txt');
      if (task.kind === 'robots') {
        const maps = robots.sitemaps.length ? robots.sitemaps : ['/sitemap.xml', '/sitemap_index.xml'];
        result.tasks = maps.map((url) => ({ url: normalizeUrl(url, task.url), kind: 'sitemap' })).filter((x) => inScope(state, x.url));
        return result;
      }
      const r = await read(task.url, state, async (url) => robotsAllowed(await robotsFor(url, state), url));
      if (task.kind === 'sitemap') {
        if (r.status !== 200) throw new Error(`Sitemap HTTP ${r.status}`);
        /* Sitemap entries are registered, not fetched. Candidates are fetched individually before inspection. */
        const map = parseSitemap(r.text, r.url);
        result.tasks = map.sitemaps.map((url) => ({ url, kind: 'sitemap' })).filter((x) => inScope(state, x.url));
        result.pages = [...map.entries, ...map.alternates.map((x) => ({ url: x.url, lastmod: null }))].filter((x) => inScope(state, x.url)).map(({ url, lastmod }) => ({ url, lastmod, source: task.url }));
      } else {
        if (r.url !== task.url) {
          result.pages.push({ url: r.url, source: task.url }); result.tasks.push({ url: r.url, kind: 'page' });
          result.page = { url: task.url, httpStatus: r.status, indexable: false, blockedReason: `Redirects to ${r.url}` };
          return result;
        }
        if (r.status !== 200) {
          result.page = { url: task.url, httpStatus: r.status, indexable: false, blockedReason: `HTTP ${r.status}` };
          return result;
        }
        if (!/html/i.test(r.headers['content-type'] || '')) throw new Error('Page is not HTML; inspect manually if it should be indexed');
        const parsed = parsePage(r.text, r.url, r.headers);
        result.page = { ...parsed.page, httpStatus: r.status };
        if (!robotsAllowed(robots, r.url, 'Googlebot')) { result.page.indexable = false; result.page.blockedReason = 'Googlebot disallowed by robots.txt'; }
        const urls = [...parsed.links, ...parsed.page.alternates.map((x) => x.url)].filter((url) => inScope(state, url) && robotsAllowed(robots, url));
        result.pages = urls.map((url) => ({ url, source: task.url }));
        result.tasks = urls.map((url) => ({ url, kind: 'page' }));
      }
    } catch (e) { result.error = e.message; }
    return result;
  };
};
