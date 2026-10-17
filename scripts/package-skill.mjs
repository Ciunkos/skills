#!/usr/bin/env node
/* package-skill.mjs — build the `.skill` file a release attaches: a zip with one folder named after the
   skill and SKILL.md at its top, ready to upload to claude.ai or Claude Desktop without a terminal.
   Only files git tracks go in (an ignored `.env` never rides along) and the tests stay out.

   node scripts/package-skill.mjs <skill>... [--out dist]
   node scripts/package-skill.mjs --all [--out dist]

   Writes <out>/<skill>-<version>.skill and <out>/<skill>.skill (the second gives a link that never goes stale:
   releases/latest/download/<skill>.skill). No dependencies: zip written by hand with node:zlib. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';
import { join, resolve } from 'node:path';
import { skillVersion } from './release-lib.mjs';

/* Minimal zip: local headers, deflate, central directory. Fixed DOS date keeps builds reproducible. */
export function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  const DATE = 0x5a21, TIME = 0; // 2025-01-01 00:00
  for (const { name, data } of files) {
    const n = Buffer.from(name, 'utf8'), body = deflateRawSync(data), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(TIME, 10); local.writeUInt16LE(DATE, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(TIME, 12); cen.writeUInt16LE(DATE, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, n, body); central.push(cen, n);
    offset += 30 + n.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/* Tracked (or new, not ignored) files of one skill, without tests. */
export function skillFiles(skill, root = '.') {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', `skills/${skill}`], { cwd: root, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).filter((f) => !/\/tests\//.test(f) && existsSync(join(root, f))).sort();
}

export function packageSkill(skill, outDir = 'dist', root = '.') {
  const version = skillVersion(readFileSync(join(root, 'skills', skill, 'SKILL.md'), 'utf8'));
  if (!version) throw new Error(`${skill}: no metadata.version in SKILL.md`);
  const files = skillFiles(skill, root).map((f) => ({ name: f.replace(/^skills\//, ''), data: readFileSync(join(root, f)) }));
  const buf = zip(files);
  const out = resolve(root, outDir);
  mkdirSync(out, { recursive: true });
  const named = join(out, `${skill}-${version}.skill`), stable = join(out, `${skill}.skill`);
  writeFileSync(named, buf); writeFileSync(stable, buf);
  return { skill, version, files: files.length, paths: [named, stable] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), o = args.indexOf('--out');
  const outDir = o >= 0 ? args[o + 1] : 'dist';
  const skills = args.includes('--all') ? readdirSync('skills').filter((s) => existsSync(join('skills', s, 'SKILL.md'))) : args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  for (const s of skills) { const r = packageSkill(s, outDir); console.log(`${r.skill} ${r.version}: ${r.files} files → ${r.paths.join(', ')}`); }
}
