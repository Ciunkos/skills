#!/usr/bin/env node
/* release-plan.mjs — what a push to main releases, from version numbers and existing tags, plus the checks
   that keep those numbers honest. Same idea as many skill repos: the version in the file is the source,
   the tag is the record, a GitHub Release is made only for a version that has no tag yet.

   node scripts/release-plan.mjs                     print the plan as JSON
   node scripts/release-plan.mjs --check             only check; exit 1 on a problem
   node scripts/release-plan.mjs --publish [--dry-run] [--out dist]
                                                     package and create the releases (CI only)

   A skill is released as `<skill>-v<version>` with its `.skill` file. The pack (the Claude Code plugin,
   .claude-plugin/plugin.json) is released as `v<version>` with every skill's `.skill` file, also under the
   stable name `<skill>.skill`. Release notes are the CHANGELOG section of that version.

   Checks, each one a release that would otherwise go wrong quietly:
   - a skill changed since its release tag without a new version (tests and the CHANGELOG don't count);
   - a version lower than one already released;
   - a new version without a written `## <version>` section in the skill's CHANGELOG.md;
   - a skill released while the pack keeps its number (the marketplace offers updates only when it moves). */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { skillVersion, changelogSection, cmp, latest } from './release-lib.mjs';
import { packageSkill } from './package-skill.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const PUBLISH = args.includes('--publish'), DRY = args.includes('--dry-run'), CHECK = args.includes('--check');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist';

export function plan() {
  const tags = git('tag', '--list').split('\n').filter(Boolean);
  const problems = [], skills = [];
  for (const name of readdirSync('skills').filter((s) => existsSync(join('skills', s, 'SKILL.md'))).sort()) {
    const dir = join('skills', name);
    const version = skillVersion(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
    if (!version) { problems.push(`${name}: no metadata.version in SKILL.md`); continue; }
    const tag = `${name}-v${version}`, released = latest(tags, `${name}-`);
    const changelog = existsSync(join(dir, 'CHANGELOG.md')) ? readFileSync(join(dir, 'CHANGELOG.md'), 'utf8') : '';
    const notes = changelogSection(changelog, version);
    const isNew = !tags.includes(tag);
    if (isNew) {
      if (released && cmp(version, released) <= 0) problems.push(`${name}: ${version} is not above the released ${released}`);
      if (!notes) problems.push(`${name}: CHANGELOG.md has no written "## ${version}" section`);
    } else {
      /* Same version as a tag: the skill's shipped files must not have changed since. */
      const diff = git('diff', '--name-only', tag, 'HEAD', '--', dir, `:(exclude)${dir}/tests`, `:(exclude)${dir}/CHANGELOG.md`);
      if (diff) problems.push(`${name}: changed since ${tag} without a new version (node scripts/bump.mjs ${name} patch|minor|major):\n  ${diff.split('\n').join('\n  ')}`);
    }
    skills.push({ name, version, tag, release: isNew, notes: notes || '' });
  }
  const pj = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
  const packTag = `v${pj.version}`, packReleased = latest(tags, '');
  const packNew = !tags.includes(packTag);
  const toRelease = skills.filter((s) => s.release);
  if (toRelease.length && !packNew) problems.push(`pack: skills ${toRelease.map((s) => s.name).join(', ')} are released but plugin.json stays at ${pj.version}`);
  if (packNew && packReleased && cmp(pj.version, packReleased) <= 0) problems.push(`pack: ${pj.version} is not above the released ${packReleased}`);
  const pack = { name: pj.name, version: pj.version, tag: packTag, release: packNew,
    notes: skills.map((s) => `### ${s.name} ${s.version}\n\n${s.notes || '(no changes)'}`).join('\n\n') };
  return { sha: git('rev-parse', 'HEAD'), skills, pack, problems };
}

function gh(...a) { return DRY ? console.log('[dry-run] gh ' + a.join(' ')) : execFileSync('gh', a, { stdio: 'inherit' }); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = plan();
  if (p.problems.length) { console.error('Release blocked:\n- ' + p.problems.join('\n- ')); process.exit(1); }
  if (CHECK) { console.log('Release plan OK: ' + (p.skills.filter((s) => s.release).map((s) => s.tag).concat(p.pack.release ? [p.pack.tag] : []).join(', ') || 'nothing new')); process.exit(0); }
  if (!PUBLISH) { console.log(JSON.stringify(p, null, 2)); process.exit(0); }
  mkdirSync(OUT, { recursive: true });
  const built = Object.fromEntries(p.skills.map((s) => [s.name, packageSkill(s.name, OUT)]));
  for (const s of p.skills.filter((x) => x.release)) {
    const f = join(OUT, `${s.tag}.md`); writeFileSync(f, s.notes + '\n');
    gh('release', 'create', s.tag, '--target', p.sha, '--title', `${s.name} ${s.version}`, '--notes-file', f, built[s.name].paths[0]);
  }
  if (p.pack.release) {
    const f = join(OUT, `${p.pack.tag}.md`);
    writeFileSync(f, `Install in Claude Code:\n\n\`\`\`\n/plugin marketplace add Ciunkos/skills\n/plugin install ${p.pack.name}@${p.pack.name}\n\`\`\`\n\nOr upload a \`.skill\` file below to claude.ai or Claude Desktop.\n\n${p.pack.notes}\n`);
    gh('release', 'create', p.pack.tag, '--target', p.sha, '--title', `${p.pack.name} ${p.pack.version}`, '--latest', '--notes-file', f, ...Object.values(built).flatMap((b) => b.paths));
  }
  if (!p.skills.some((s) => s.release) && !p.pack.release) console.log('Nothing new to release.');
}
