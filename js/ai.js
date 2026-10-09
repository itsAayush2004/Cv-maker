/* Optional AI mode (Claude). Off by default — the offline engine always works without it.
 * When enabled with your own Anthropic API key it:
 *   1. researches the company/role on the web (hiring priorities, stack, culture keywords), and
 *   2. rewrites the tailored CV in the job's language — using ONLY facts from your memory.
 * Every AI result is validated; anything malformed or failing falls back to the offline CV. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util;

  // Pinned SDK build loaded on demand from a CDN only when AI mode is used.
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';
  var DEFAULT_MODEL = 'claude-opus-5-5';
  var KEY_STORE = 'cvforge.anthropicKey';

  var sdkPromise = null;
  /** Tests (Node) inject the npm SDK instead of the CDN build. */
  function setSdk(AnthropicClass) { sdkPromise = Promise.resolve(AnthropicClass); }
  function loadSdk() {
    if (!sdkPromise) {
      sdkPromise = import(SDK_URL).then(function (mod) { return mod.default || mod.Anthropic; })
        .catch(function (e) { sdkPromise = null; throw new Error('Could not load the Anthropic SDK (offline?). ' + (e && e.message || '')); });
    }
    return sdkPromise;
  }

  // The key lives only in this browser's localStorage (never in backups, exports or the repo).
  // Where storage is unavailable (private mode, Node tests) it is kept in memory for this session only.
  var memoryKey = '';
  function getKey() {
    try { var k = root.localStorage.getItem(KEY_STORE); if (k) return k; } catch (e) { /* fall through */ }
    return memoryKey;
  }
  function setKey(k) {
    k = U.str(k).trim();
    memoryKey = k;
    try { if (k) root.localStorage.setItem(KEY_STORE, k); else root.localStorage.removeItem(KEY_STORE); } catch (e) { /* memory only */ }
  }

  function client() {
    var key = getKey();
    if (!key) return Promise.reject(new Error('Add your Anthropic API key in Settings to use AI mode.'));
    return loadSdk().then(function (Anthropic) {
      // The key stays in this browser and goes only to api.anthropic.com.
      return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 240000 });
    });
  }

  function textOf(message) {
    return U.arr(message && message.content).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim();
  }

  function checkStop(message) {
    if (message && message.stop_reason === 'refusal') {
      throw new Error('The model declined this request' + (message.stop_details && message.stop_details.explanation ? ': ' + message.stop_details.explanation : '.'));
    }
    if (message && message.stop_reason === 'max_tokens') throw new Error('The AI response was cut off. Try again or shorten the job post.');
  }

  function friendlyError(e) {
    var status = e && e.status;
    if (status === 401) return 'Your Anthropic API key was rejected. Check it in Settings.';
    if (status === 429) return 'Rate limited by the API — wait a minute and try again.';
    if (status === 529 || status >= 500) return 'The API is busy right now. The offline CV is still ready.';
    if (status === 400) return 'The API rejected the request: ' + (e.message || 'bad request');
    return (e && e.message) || 'Unknown AI error';
  }

  /** Step 1 — web research on the company and role. Returns plain-text notes (or '' on failure). */
  function research(analysis, jobText, model) {
    return client().then(function (c) {
      var prompt = 'You are helping a candidate tailor their CV. Research this employer and role on the web and report what will help the CV pass ATS screening and impress the hiring manager.\n\n' +
        'Role: ' + (analysis.title || '(see posting)') + '\nCompany: ' + (analysis.company || '(see posting)') + '\n\nJob posting:\n<job_posting>\n' + U.str(jobText, 30000) + '\n</job_posting>\n\n' +
        'Report, concisely, as bullet lists:\n1. What the company does, its products, and its tech stack or tools (with sources).\n' +
        '2. The exact keywords and phrases this kind of role is screened on (include common synonyms/acronyms).\n' +
        '3. The top 5 things the hiring manager will look for, in priority order.\n4. Culture/values language worth echoing.\nKeep it under 400 words.';
      var messages = [{ role: 'user', content: prompt }];
      var tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];
      function step(n) {
        return c.beta.messages.create({
          model: model || DEFAULT_MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          output_config: { effort: 'medium' }, tools: tools, messages: messages
        }).then(function (msg) {
          checkStop(msg);
          if (msg.stop_reason === 'pause_turn' && n < 3) {
            messages = messages.concat([{ role: 'assistant', content: msg.content }]);
            return step(n + 1);
          }
          return textOf(msg);
        });
      }
      return step(0);
    });
  }

  var CV_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['headline', 'summary', 'skills', 'experience', 'projects', 'notes'],
    properties: {
      headline: { type: 'string' },
      summary: { type: 'string' },
      skills: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['group', 'items'], properties: { group: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } } },
      experience: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['index', 'bullets'], properties: { index: { type: 'integer' }, bullets: { type: 'array', items: { type: 'string' } } } } },
      projects: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['index', 'bullets'], properties: { index: { type: 'integer' }, bullets: { type: 'array', items: { type: 'string' } } } } },
      notes: { type: 'array', items: { type: 'string' } }
    }
  };

  var SYSTEM = 'You are an expert technical recruiter and CV writer who knows how applicant tracking systems (Workday, Greenhouse, Lever, iCIMS, Taleo) parse and rank CVs.\n' +
    'Absolute rule: use only facts present in the candidate memory. Never invent employers, titles, dates, degrees, tools, numbers or results. ' +
    'You may rephrase, merge, reorder and drop bullets, and use the job posting\'s exact wording for a skill only when the memory shows the candidate has that skill. ' +
    'If a metric is missing, do not make one up; leave the bullet unquantified and mention it in notes.\n' +
    'Style: each bullet starts with a strong past-tense action verb (present tense for current roles), states what was done, how (tools), and the result; 12-28 words; no first-person pronouns; no buzzword filler. ' +
    'Summary: 2-3 sentences, specific, aimed at this role. Skills: group into 2-4 groups, job-matched skills first, using the posting\'s spelling.';

  /** Step 2 — rewrite the offline CV draft. Returns a validated CV object (same shape as the offline one). */
  function rewrite(profile, analysis, jobText, draft, researchNotes, model) {
    return client().then(function (c) {
      var p = CVM.profile.normalize(profile);
      var memory = JSON.stringify({
        basics: { headline: p.basics.headline }, summary: p.summary, skills: p.skills.map(function (s) { return s.name; }),
        experience: draft.experience.map(function (e, i) {
          var src = p.experience.filter(function (x) { return x.role === e.role && x.company === e.company; })[0];
          return { index: i, role: e.role, company: e.company, dates: e.dates, allBullets: src ? src.bullets : e.bullets, tech: src ? src.tech : [] };
        }),
        projects: draft.projects.map(function (pr, i) {
          var src = p.projects.filter(function (x) { return x.name === pr.name; })[0];
          return { index: i, name: pr.name, allBullets: src ? src.bullets : pr.bullets, tech: pr.tech };
        }),
        achievements: p.achievements, extraMemoryNotes: p.memoryNotes.slice(0, 6000)
      });
      var keywords = (analysis.keywords || []).slice(0, 35).map(function (k) { return k.display + (k.priority === 'must' ? ' (must)' : k.priority === 'nice' ? ' (nice)' : ''); });
      var userMsg = '<job_posting>\n' + U.str(jobText, 30000) + '\n</job_posting>\n\n' +
        (researchNotes ? '<company_research>\n' + researchNotes + '\n</company_research>\n\n' : '') +
        '<ats_keywords>\n' + keywords.join(', ') + '\n</ats_keywords>\n\n<candidate_memory>\n' + memory + '\n</candidate_memory>\n\n' +
        'Write the tailored CV content. Return one entry per experience index (' + draft.experience.length + ' roles) and per project index (' + draft.projects.length + ' projects), ' +
        'keeping ' + draft.experience.map(function (e) { return e.bullets.length; }).join('/') + ' bullets per role respectively (at most). ' +
        'Headline: the target job title if the memory supports it, otherwise the candidate\'s accurate title. ' +
        'In notes, list honest suggestions: missing must-have keywords the candidate should add only if true, and bullets that need real numbers.';
      return c.beta.messages.create({
        model: model || DEFAULT_MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: CV_SCHEMA } },
        system: SYSTEM, messages: [{ role: 'user', content: userMsg }]
      }).then(function (msg) {
        checkStop(msg);
        var data = JSON.parse(textOf(msg));
        return merge(draft, data, p);
      });
    });
  }

  /** Apply AI output on top of the offline draft with strict validation. */
  /** Numbers in a line ("750+", "60-degree", "98.9") that do not appear anywhere in your memory = invented metrics. */
  function inventedNumbers(line, corpus) {
    var known = Object.create(null);
    (U.str(corpus).match(/\d+(?:[.,]\d+)?/g) || []).forEach(function (n) { known[n] = 1; });
    return (U.str(line).match(/\d+(?:[.,]\d+)?/g) || []).filter(function (n) { return !known[n]; });
  }

  function merge(draft, data, profile) {
    var cv = U.clone(draft);
    var corpus = CVM.tailor.profileCorpus(profile);
    var rejected = [];
    function clean(s, max) { return U.str(s, max || 400).replace(/\s+/g, ' ').trim(); }
    function honest(line) {
      var bad = inventedNumbers(line, corpus);
      if (bad.length) rejected.push(line);
      return !bad.length;
    }
    if (data && typeof data === 'object') {
      if (clean(data.headline, 120)) cv.basics.headline = clean(data.headline, 120);
      if (clean(data.summary, 900).length > 40 && honest(clean(data.summary, 900))) cv.summary = clean(data.summary, 900);
      var groups = U.arr(data.skills).map(function (g) {
        // Keep only skills that the memory actually supports.
        var items = U.unique(U.arr(g && g.items).map(function (s) { return clean(s, 60); }).filter(function (s) {
          return s && (U.hasTerm(corpus, s) || CVM.skillsDb.findSkills(s).some(function (k) { return CVM.tailor.textHas(corpus, { term: k.name, display: s, category: k.category }); }));
        }));
        return { group: clean(g && g.group, 40) || 'Skills', items: items.slice(0, 16) };
      }).filter(function (g) { return g.items.length; });
      if (groups.length) cv.skills = groups;
      U.arr(data.experience).forEach(function (e) {
        var i = e && e.index;
        if (typeof i === 'number' && cv.experience[i]) {
          var b = U.arr(e.bullets).map(function (x) { return clean(x); }).filter(function (x) { return x.length > 15 && honest(x); });
          if (b.length) cv.experience[i].bullets = b.slice(0, Math.max(cv.experience[i].bullets.length, 1) + 1);
        }
      });
      U.arr(data.projects).forEach(function (e) {
        var i = e && e.index;
        if (typeof i === 'number' && cv.projects[i]) {
          var b = U.arr(e.bullets).map(function (x) { return clean(x); }).filter(function (x) { return x.length > 15 && honest(x); });
          if (b.length) cv.projects[i].bullets = b.slice(0, 4);
        }
      });
      cv.meta.aiNotes = U.arr(data.notes).map(function (n) { return clean(n, 300); }).filter(Boolean).slice(0, 10);
    }
    cv.meta.aiRejected = rejected.slice(0, 10);
    cv.meta.engine = 'ai';
    return cv;
  }

  /** Full AI pipeline with graceful fallback: resolves {cv, research, error}. Never rejects. */
  function enhance(profile, analysis, jobText, draft, opts) {
    opts = opts || {};
    var notes = '';
    var researchStep = opts.research ? research(analysis, jobText, opts.model).catch(function (e) { notes = ''; opts.onStatus && opts.onStatus('Research skipped: ' + friendlyError(e)); return ''; }) : Promise.resolve('');
    return researchStep.then(function (r) {
      notes = r || '';
      opts.onStatus && opts.onStatus('Rewriting your CV for this job…');
      return rewrite(profile, analysis, jobText, draft, notes, opts.model);
    }).then(function (cv) {
      return { cv: cv, research: notes, error: null };
    }).catch(function (e) {
      return { cv: draft, research: notes, error: friendlyError(e) };
    });
  }

  CVM.ai = { enhance: enhance, research: research, rewrite: rewrite, merge: merge, inventedNumbers: inventedNumbers, getKey: getKey, setKey: setKey, setSdk: setSdk, DEFAULT_MODEL: DEFAULT_MODEL, SDK_URL: SDK_URL };
})(typeof window !== 'undefined' ? window : globalThis);
