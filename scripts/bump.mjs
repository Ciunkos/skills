#!/usr/bin/env node
/* bump.mjs — give a skill its next version, and the pack with it. Commits nothing.

   node scripts/bump.mjs <skill> patch|minor|major

   - SKILL.md `metadata.version`, counted from the last released tag, so bumping twice before a push
     does not skip a number;
   - a `## <version>` section in the skill's CHANGELOG.md with a placeholder the release refuses to ship
     until someone writes it;
   - .claude-plugin/plugin.json moved from the last released pack by the largest step waiting to ship. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { skillVersion, setSkillVersion, addChangelogSection, next, latest, cmp, step, STEPS } from './release-lib.mjs';

const [skill, kind] = process.argv.slice(2);
if (!skill || !STEPS.includes(kind)) { console.error('usage: node scripts/bump.mjs <skill> patch|minor|major'); process.exit(1); }
const dir = join('skills', skill);
if (!existsSync(join(dir, 'SKILL.md'))) { console.error(`no skill ${skill}`); process.exit(1); }
const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).split('\n').filter(Boolean);

const md = readFileSync(join(dir, 'SKILL.md'), 'utf8');
const base = latest(tags, `${skill}-`) || skillVersion(md);
const v = next(base, kind);
writeFileSync(join(dir, 'SKILL.md'), setSkillVersion(md, v));
const cl = join(dir, 'CHANGELOG.md');
writeFileSync(cl, addChangelogSection(existsSync(cl) ? readFileSync(cl, 'utf8') : '# Changelog\n', v));

const pjPath = '.claude-plugin/plugin.json', pj = JSON.parse(readFileSync(pjPath, 'utf8'));
const packBase = latest(tags, '') || pj.version;
const s = base ? step(base, v) : kind;
let pv = next(packBase, s);
if (cmp(pj.version, pv) > 0) pv = pj.version; // already bumped further by another skill
pj.version = pv;
writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n');
console.log(`${skill}: ${base} → ${v}; pack → ${pv}. Write the CHANGELOG.md section, then commit.`);
