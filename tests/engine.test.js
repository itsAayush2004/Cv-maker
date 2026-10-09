// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const CVM = require('./load.js');

const settings = CVM.profile.defaultSettings();

test('skill detection: aliases, symbols and overlaps', () => {
  const found = CVM.skillsDb.findSkills('React Native, C++, C#, .NET, Node.js, CI/CD via GitHub Actions, k8s').map((s) => s.name);
  for (const s of ['React Native', 'C++', 'C#', '.NET', 'Node.js', 'CI/CD', 'GitHub Actions', 'Kubernetes']) assert.ok(found.includes(s), s);
  assert.ok(!found.includes('React'), 'React must not double-count inside React Native');
  assert.ok(!found.includes('Git'), 'Git must not double-count inside GitHub Actions');
});

test('skill detection: ambiguous English words are not skills', () => {
  const found = CVM.skillsDb.findSkills('You will go beyond, express ideas, take notion of spring and slack off. Rust never sleeps... wait.').map((s) => s.name);
  for (const s of ['Go', 'Express', 'Notion', 'Spring Boot', 'Slack']) assert.ok(!found.includes(s), s);
});

test('analyzer extracts title, company, years, education and weighted keywords', () => {
  const a = CVM.analyzer.analyze(CVM.EXAMPLE_JOB);
  assert.equal(a.title, 'Senior Frontend Engineer');
  assert.equal(a.company, 'Northwind Labs');
  assert.equal(a.yearsRequired, 5);
  assert.equal(a.education, "Bachelor's");
  assert.equal(a.seniority, 'Senior');
  const react = a.keywords.find((k) => k.term === 'React');
  const aws = a.keywords.find((k) => k.term === 'AWS');
  assert.equal(react.priority, 'must');
  assert.equal(aws.priority, 'nice');
  assert.ok(react.weight > aws.weight);
  assert.ok(!a.keywords.some((k) => /northwind|labs/i.test(k.term) && k.category !== 'title'), 'company name is not a keyword');
  assert.ok(!a.keywords.some((k) => /insurance|budget/i.test(k.term)), 'benefits are ignored');
});

test('analyzer never throws on junk input', () => {
  for (const junk of [null, undefined, '', 42, {}, [], 'x', '\u0000\u0001', 'a'.repeat(200000), '((((((', '\n\n\n']) {
    const a = CVM.analyzer.analyze(junk);
    assert.ok(Array.isArray(a.keywords));
  }
});

test('profile.normalize repairs any shape and accepts JSON Resume', () => {
  assert.deepEqual(CVM.profile.normalize(null).experience, []);
  const p = CVM.profile.normalize({
    basics: { name: 'Sam', label: 'Designer', location: { city: 'Pune', countryCode: 'IN' }, profiles: [{ network: 'GitHub', url: 'https://github.com/sam' }] },
    work: [{ position: 'UI Designer', name: 'X', company: 'Acme', startDate: '2020-01', endDate: 'Present', highlights: ['Did a thing'] }, 'garbage', null],
    skills: [{ name: 'Design', keywords: ['Figma', 'Sketch'] }, 'Photoshop', 7],
    education: [{ institution: 'IIT', studyType: 'B.Des' }]
  });
  assert.equal(p.basics.headline, 'Designer');
  assert.equal(p.basics.location, 'Pune, IN');
  assert.equal(p.experience.length, 1);
  assert.equal(p.experience[0].current, true);
  assert.deepEqual(p.skills.map((s) => s.name), ['Figma', 'Sketch', 'Photoshop']);
  assert.equal(p.education[0].school, 'IIT');
});

test('tailoring is honest: no skills or seniority the memory does not support', () => {
  const r = CVM.tailor.run(CVM.EXAMPLE_PROFILE, CVM.EXAMPLE_JOB, settings);
  const skills = r.cv.skills.flatMap((g) => g.items);
  assert.ok(!skills.includes('Cypress') && !skills.includes('Playwright'), 'missing skills are not added');
  assert.ok(r.match.gaps.some((k) => k.term === 'Cypress'), 'missing skills are reported as gaps');
  assert.ok(!/senior/i.test(r.cv.basics.headline), 'does not claim seniority the profile lacks');
  assert.equal(r.cv.basics.headline, 'Frontend Engineer');
  assert.ok(skills.indexOf('React') < skills.indexOf('Python') || !skills.includes('Python'), 'matched skills come first');
});

test('tailoring ranks job-relevant bullets first and trims to limits', () => {
  const r = CVM.tailor.run(CVM.EXAMPLE_PROFILE, CVM.EXAMPLE_JOB, { ...settings, maxBulletsRecent: 2 });
  assert.equal(r.cv.experience[0].bullets.length, 2);
  assert.ok(!r.cv.experience[0].bullets.some((b) => /on-call/.test(b)), 'weak, irrelevant bullet is dropped');
  assert.ok(r.score > 0 && r.score <= 100);
});

test('every bullet on the CV comes from memory (offline engine never invents text)', () => {
  const r = CVM.tailor.run(CVM.STARTER_PROFILE, 'Unity Game Developer\nRequirements:\n- Unity, C#, Blender\n- 3+ years', settings);
  const memory = new Set([...CVM.STARTER_PROFILE.experience, ...CVM.STARTER_PROFILE.projects].flatMap((e) => e.bullets));
  for (const e of [...r.cv.experience, ...r.cv.projects]) for (const b of e.bullets) assert.ok(memory.has(b), b);
});

test('tailor works with an empty profile and empty job', () => {
  const r = CVM.tailor.run({}, '', settings);
  assert.equal(typeof r.score, 'number');
  assert.ok(r.checks.some((c) => c.status === 'fail'));
});

test('dates are formatted consistently', () => {
  assert.equal(CVM.util.formatDate('2021-03'), 'Mar 2021');
  assert.equal(CVM.util.formatDate('03/2021'), 'Mar 2021');
  assert.equal(CVM.util.formatDate('March 2021'), 'Mar 2021');
  assert.equal(CVM.util.formatDate('2019'), '2019');
  assert.equal(CVM.util.dateRange('2020-01', '', true), 'Jan 2020 – Present');
  assert.equal(CVM.util.formatDate('Summer of 69'), 'Summer of 69');
});

test('years of experience merges overlapping roles', () => {
  const p = CVM.profile.normalize({ experience: [
    { role: 'A', start: '2018-01', end: '2019-12' },
    { role: 'B', start: '2019-01', end: '2020-12' }
  ] });
  assert.equal(CVM.tailor.totalYears(p), 3);
});

test('renderers escape HTML and produce all formats', () => {
  const p = JSON.parse(JSON.stringify(CVM.EXAMPLE_PROFILE));
  p.basics.name = '<img src=x onerror=alert(1)>';
  const r = CVM.tailor.run(p, CVM.EXAMPLE_JOB, settings);
  const html = CVM.render.cvHtml(r.cv, 'modern');
  assert.ok(!html.includes('<img'), 'html is escaped');
  assert.ok(html.includes('<h2>Experience</h2>'));
  assert.ok(!/<table|<img/i.test(html), 'ATS-safe markup');
  assert.ok(CVM.render.markdown(r.cv).startsWith('# '));
  assert.ok(CVM.render.text(r.cv).includes('EXPERIENCE'));
  const port = CVM.render.portfolio(p);
  assert.ok(port.startsWith('<!doctype html>') && !port.includes('<img src=x'));
  assert.equal(CVM.render.safeUrl('javascript:alert(1)'), '#');
});

test('docx is a valid zip with the required parts', () => {
  const r = CVM.tailor.run(CVM.EXAMPLE_PROFILE, CVM.EXAMPLE_JOB, settings);
  const bytes = CVM.docx.build(r.cv, 'A4');
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const s = Buffer.from(bytes).toString('latin1');
  for (const part of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', '_rels/.rels']) assert.ok(s.includes(part), part);
  assert.equal(CVM.docx._crc32(Buffer.from('123456789')), 0xCBF43926);
});

test('importer parses a pasted CV into memory', () => {
  const text = `Priya Sharma
Motion Designer
priya@example.com | +91 98765 43210 | linkedin.com/in/priya

SUMMARY
Motion designer with 4 years in brand animation.

EXPERIENCE
Senior Motion Designer — Pixel Co
Jan 2022 – Present
• Animated 120+ explainer videos in After Effects
• Led a team of 3 designers

Motion Designer at Studio Nine
Jun 2019 – Dec 2021
- Built a template library that cut delivery time by 30%

SKILLS
After Effects, Blender, Figma, Premiere Pro

EDUCATION
B.Des — NID
2015 – 2019`;
  const p = CVM.importer.parse(text);
  assert.equal(p.basics.name, 'Priya Sharma');
  assert.equal(p.basics.email, 'priya@example.com');
  assert.equal(p.experience.length, 2);
  assert.equal(p.experience[0].company, 'Pixel Co');
  assert.equal(p.experience[0].current, true);
  assert.equal(p.experience[0].bullets.length, 2);
  assert.equal(p.experience[1].company, 'Studio Nine');
  assert.ok(p.skills.some((s) => s.name === 'Blender'));
  assert.equal(p.education.length, 1);
  const merged = CVM.importer.merge(p, p);
  assert.equal(merged.experience.length, 2, 'merge de-duplicates');
});

test('AI merge keeps only skills backed by memory', () => {
  global.CVM = CVM;
  require('../js/ai.js');
  const r = CVM.tailor.run(CVM.EXAMPLE_PROFILE, CVM.EXAMPLE_JOB, settings);
  const out = CVM.ai.merge(r.cv, {
    headline: 'Frontend Engineer', summary: 'A long enough summary sentence that should be accepted by the validator.',
    skills: [{ group: 'Core', items: ['React', 'Cypress', 'TypeScript', 'Kubernetes'] }],
    experience: [{ index: 0, bullets: ['Rewrote a bullet with enough characters'] }, { index: 99, bullets: ['ignored bullet text here'] }],
    projects: [], notes: ['Add Cypress if true']
  }, CVM.profile.normalize(CVM.EXAMPLE_PROFILE));
  assert.deepEqual(out.skills[0].items, ['React', 'TypeScript']);
  assert.equal(out.experience[0].bullets[0], 'Rewrote a bullet with enough characters');
  assert.equal(out.meta.engine, 'ai');
  const bad = CVM.ai.merge(r.cv, 'not an object', CVM.profile.normalize(CVM.EXAMPLE_PROFILE));
  assert.deepEqual(bad.experience, r.cv.experience, 'malformed AI output falls back to the draft');
});
