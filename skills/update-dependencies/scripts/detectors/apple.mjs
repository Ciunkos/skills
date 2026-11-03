/* Xcode projects: SwiftPM pins in Package.resolved (inside .xcodeproj/.xcworkspace or next to
   Package.swift) and CocoaPods versions in Podfile.lock. Targets: GitHub releases for SwiftPM
   packages hosted there, CocoaPods trunk for pods. Updating goes through Xcode/SwiftPM or
   `pod update <name>` so the resolved files stay consistent. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickTarget, parse } from '../semver.mjs';
import { repoOf } from '../github.mjs';

export const id = 'apple';
export const reference = 'references/detectors/apple.md';

export const detect = (repo, files) => {
  const found = [];
  for (const f of files) {
    let text = '';
    if (/(^|\/)Package\.resolved$/.test(f)) {
      try { text = readFileSync(join(repo, f), 'utf8'); } catch { continue; }
      let doc;
      try { doc = JSON.parse(text); } catch { continue; }
      const pins = (doc.pins || doc.object?.pins || []).map((p) => ({ name: p.identity || p.package, location: p.location || p.repositoryURL, version: p.state?.version, revision: p.state?.revision }));
      if (pins.length) found.push({ ecosystem: id, manager: 'swiftpm', file: f, pins });
    } else if (/(^|\/)Podfile\.lock$/.test(f)) {
      try { text = readFileSync(join(repo, f), 'utf8'); } catch { continue; }
      const pods = new Map();
      for (const m of text.matchAll(/^\s{2}- "?([A-Za-z0-9_+.-]+)(?:\/[^\s(]+)? \(([0-9][^)]*)\)/gm)) if (!pods.has(m[1])) pods.set(m[1], m[2]);
      if (pods.size) found.push({ ecosystem: id, manager: 'cocoapods', file: f, pins: [...pods].map(([name, version]) => ({ name, version })) });
    }
  }
  return found;
};

export const outdated = async (repo, finding, { github, fetcher = fetch, minAgeDays = 7, now = Date.now() }) => {
  const items = [];
  for (const pin of finding.pins) {
    if (!pin.version || !parse(pin.version)) continue;
    let times = {};
    if (finding.manager === 'swiftpm') {
      const gh = repoOf(pin.location);
      if (!gh) { items.push({ ecosystem: id, file: finding.file, name: pin.name, from: pin.version, to: null, kind: 'review', note: `not on GitHub (${pin.location}); check by hand` }); continue; }
      times = Object.fromEntries((await github.releases(gh)).map((r) => [r.tag.replace(/^v/, ''), r.at]));
    } else {
      const res = await fetcher(`https://trunk.cocoapods.org/api/v1/pods/${encodeURIComponent(pin.name)}`);
      if (!res.ok) continue;
      times = Object.fromEntries(((await res.json()).versions || []).map((v) => [v.name, v.created_at]));
    }
    const target = pickTarget({ times, current: pin.version, minAgeDays, now });
    if (target) items.push({ ecosystem: id, manager: finding.manager, file: finding.file, name: pin.name, from: pin.version, to: target.version, kind: target.kind, publishedAt: target.publishedAt });
  }
  return items;
};
