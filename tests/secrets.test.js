// Guards against ever committing an API key or personal contact data to this public repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function trackedFiles() {
  try {
    return execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    return []; // not a git checkout: nothing to check
  }
}

test('no API keys in files that git would commit', () => {
  const offenders = [];
  for (const f of trackedFiles()) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p) || fs.statSync(p).size > 2_000_000) continue;
    const text = fs.readFileSync(p, 'utf8');
    // Real keys look like sk-ant-api03-<long base64>. The short "sk-ant-…" placeholder in the UI is fine.
    if (/sk-ant-[A-Za-z0-9]+-[A-Za-z0-9_-]{20,}/.test(text) || /ANTHROPIC_API_KEY\s*=\s*['"]?sk-/.test(text)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], 'API key found in: ' + offenders.join(', '));
});

test('private memory folder is git-ignored', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ignore, /^private\/$/m);
  assert.ok(!trackedFiles().some((f) => f.startsWith('private/')), 'a file under private/ is tracked');
});

test('backups and exports never contain the API key', () => {
  const CVM = require('./load.js');
  require('../js/ai.js');
  CVM.ai.setKey(['sk', 'ant', 'api03', 'TESTKEYTESTKEYTESTKEYTESTKEY'].join('-'));
  const state = CVM.profile.normalizeState({ profile: CVM.EXAMPLE_PROFILE, settings: { aiEnabled: true } });
  const exported = JSON.stringify({ profile: state.profile, history: state.history, settings: state.settings, job: state.job });
  assert.ok(!exported.includes('sk-ant'), 'key leaked into backup export');
  CVM.ai.setKey('');
});
