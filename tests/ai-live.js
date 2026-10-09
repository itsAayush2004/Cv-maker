// Live test of AI mode against the real Anthropic API.
//
//   ANTHROPIC_API_KEY must come from your environment (shell, CI secret, cloud-environment secret).
//   Never put the key in a file in this repo — tests/secrets.test.js fails the build if one appears.
//
//   npm run test:ai                     # 6 jobs, no web research
//   AI_JOBS=all AI_RESEARCH=1 npm run test:ai
//   AI_MODEL=claude-sonnet-5-5 npm run test:ai
//
// For each job it builds the offline CV, runs the AI research + rewrite, then audits the result:
// invented numbers, skills not in memory, changed employers/titles/dates, refusals and errors.
// The full report (with your CV text) goes to private/ai-report.md, which is git-ignored.
const fs = require('fs');
const path = require('path');

const KEY = process.env.ANTHROPIC_API_KEY || '';
if (!KEY) {
  console.log('SKIPPED: set ANTHROPIC_API_KEY in your environment (never in a file) to run the live AI test.');
  process.exit(0);
}
const redact = (s) => String(s).split(KEY).join('[key]').replace(/sk-ant-[\w-]+/g, '[key]');

const CVM = require('./load.js');
require('../js/ai.js');
CVM.ai.setSdk(require('@anthropic-ai/sdk').default);
CVM.ai.setKey(KEY); // in-memory only (no localStorage in Node)

const ROOT = path.join(__dirname, '..');
const privateMemory = path.join(ROOT, 'private', 'aayush-memory.json');
const state = fs.existsSync(privateMemory)
  ? CVM.profile.normalizeState(JSON.parse(fs.readFileSync(privateMemory, 'utf8')))
  : CVM.profile.normalizeState({ profile: CVM.STARTER_PROFILE, settings: { maxProjects: 4 } });
const profile = state.profile;
const corpus = CVM.tailor.profileCorpus(profile);

const JOB_DIR = path.join(__dirname, 'fixtures', 'jobs');
const allJobs = fs.readdirSync(JOB_DIR).sort();
const DEFAULT_JOBS = ['game-unity-brsoftech-jaipur.txt', 'game-unreal-intern-xogar-bengaluru.txt', 'web-fullstack-praverse-vadodara.txt',
  'web-react-native-intern-logical-jaipur.txt', 'anim-blender-rigger-cbx.txt', 'smm-manager-dietitian-mohali.txt'];
const jobs = process.env.AI_JOBS === 'all' ? allJobs : (process.env.AI_JOBS ? process.env.AI_JOBS.split(',') : DEFAULT_JOBS);
const research = process.env.AI_RESEARCH === '1';
const model = process.env.AI_MODEL || CVM.ai.DEFAULT_MODEL;

function audit(offline, ai) {
  const issues = [];
  const lines = [ai.summary].concat(...ai.experience.map((e) => e.bullets), ...ai.projects.map((p) => p.bullets));
  for (const l of lines) {
    const bad = CVM.ai.inventedNumbers(l, corpus);
    if (bad.length) issues.push(`invented number(s) ${bad.join(', ')} in: "${l}"`);
  }
  for (const g of ai.skills) for (const s of g.items) {
    const backed = CVM.util.hasTerm(corpus, s) || CVM.skillsDb.findSkills(s).some((k) => CVM.tailor.textHas(corpus, { term: k.name, display: s, category: k.category }));
    if (!backed) issues.push(`skill not in memory: ${s}`);
  }
  offline.experience.forEach((e, i) => {
    const a = ai.experience[i];
    if (!a || a.role !== e.role || a.company !== e.company || a.dates !== e.dates) issues.push(`experience ${i} identity changed`);
  });
  if (ai.education.map((e) => e.school + e.degree + e.dates).join() !== offline.education.map((e) => e.school + e.degree + e.dates).join()) issues.push('education changed');
  return issues;
}

(async () => {
  const rows = [];
  const detail = [];
  for (const f of jobs) {
    const jd = fs.readFileSync(path.join(JOB_DIR, f), 'utf8');
    const off = CVM.tailor.run(profile, jd, state.settings);
    const t0 = Date.now();
    const statuses = [];
    const res = await CVM.ai.enhance(profile, off.analysis, jd, CVM.util.clone(off.cv), { research, model, onStatus: (s) => statuses.push(s) });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (res.error) {
      rows.push(`| ${f} | ${off.score} | ERROR | — | ${redact(res.error)} |`);
      console.log(`✗ ${f}: ${redact(res.error)}`);
      continue;
    }
    const ai = CVM.tailor.evaluate(res.cv, off.analysis, profile, state.settings);
    const issues = audit(off.cv, ai.cv);
    const rejected = (ai.cv.meta.aiRejected || []).length;
    rows.push(`| ${f} | ${off.score} | ${ai.score} | ${ai.match.coverage}% (was ${off.match.coverage}%) | ${issues.length ? issues.length + ' issue(s)' : 'clean'}${rejected ? `, ${rejected} invented line(s) blocked` : ''} | ${secs}s |`);
    console.log(`${issues.length ? '!' : '✓'} ${f}: offline ${off.score} → AI ${ai.score} (${secs}s)${rejected ? `, blocked ${rejected} line(s) with invented numbers` : ''}`);
    fs.mkdirSync(path.join(ROOT, 'private', 'ai-run'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'private', 'ai-run', f.replace('.txt', '.offline.txt')), CVM.tailor.cvText(off.cv));
    fs.writeFileSync(path.join(ROOT, 'private', 'ai-run', f.replace('.txt', '.ai.txt')), CVM.tailor.cvText(ai.cv));
    detail.push(`## ${f}\n\n**Headline:** ${off.cv.basics.headline} → ${ai.cv.basics.headline}\n\n**Summary (AI):** ${ai.cv.summary}\n\n` +
      `**Audit:** ${issues.length ? issues.map((x) => '\n- ' + x).join('') : 'clean'}\n\n` +
      (rejected ? `**Blocked lines (invented numbers):**${ai.cv.meta.aiRejected.map((x) => '\n- ' + x).join('')}\n\n` : '') +
      `**AI notes:**${(ai.cv.meta.aiNotes || []).map((x) => '\n- ' + x).join('') || ' none'}\n\n` +
      (res.research ? `<details><summary>Research</summary>\n\n${res.research}\n\n</details>\n\n` : '') +
      `**Bullets, offline → AI:**\n\n` + off.cv.experience.concat(off.cv.projects).map((e, i) => {
        const a = ai.cv.experience.concat(ai.cv.projects)[i];
        return `*${e.role || e.name}*\n` + e.bullets.map((b) => `- before: ${b}`).join('\n') + '\n' + (a ? a.bullets.map((b) => `- after: ${b}`).join('\n') : '');
      }).join('\n\n'));
  }
  const report = `# AI mode live test\n\nModel: ${model} · research: ${research ? 'on' : 'off'} · ${new Date().toISOString()}\n\n` +
    `| Job | Offline score | AI score | Keyword coverage | Audit | Time |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n\n${detail.join('\n\n---\n\n')}\n`;
  fs.mkdirSync(path.join(ROOT, 'private'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'private', 'ai-report.md'), redact(report));
  console.log('\nReport: private/ai-report.md (git-ignored)');
  if (rows.some((r) => r.includes('ERROR'))) process.exitCode = 1;
})().catch((e) => { console.error(redact(e && e.stack || e)); process.exit(1); });
