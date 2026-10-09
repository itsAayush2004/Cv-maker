/* CV Forge — UI controller. Every handler runs through safe() so one bad input can never take the app down,
 * and state is autosaved (with rolling backups) on every change. */
(function (root) {
  'use strict';
  var CVM = root.CVM, U = CVM.util, E = U.escapeHtml;
  var doc = root.document;
  var $ = function (sel, el) { return (el || doc).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };

  var state, current = null, cvDirty = true, aiBusy = false, lastResearch = '';
  var openSections = { basics: true, experience: true };

  // ---------------------------------------------------------------- errors & toasts
  function toast(msg, kind, ms) {
    var box = $('#toasts');
    if (!box) return;
    var t = doc.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || (kind === 'error' ? 6500 : 3200));
  }

  var lastErrAt = 0;
  CVM.onError = function (e, label) {
    if (root.console) root.console.error('[CV Forge]', label || '', e);
    var now = Date.now();
    if (now - lastErrAt > 1500) { lastErrAt = now; toast('Something went wrong' + (label ? ' (' + label + ')' : '') + ' — your data is safe. ' + ((e && e.message) || ''), 'error'); }
  };
  root.addEventListener('error', function (ev) { CVM.onError(ev.error || new Error(ev.message), 'unexpected'); });
  root.addEventListener('unhandledrejection', function (ev) { CVM.onError(ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason)), 'async'); });

  function safe(fn, label) { return function () { var a = arguments, self = this; return U.safe(function () { return fn.apply(self, a); }, undefined, label); }; }

  // ---------------------------------------------------------------- persistence
  var saveSoon = U.debounce(function () { persist(false); }, 400);
  function persist(forceBackup) {
    state.profile.updatedAt = new Date().toISOString();
    var r = CVM.profile.save(state, forceBackup);
    var el = $('#saveStatus');
    if (el) {
      el.textContent = r.persistent ? 'Saved ✓' : 'Not saved — export a backup!';
      el.classList.toggle('warn', !r.persistent);
      el.title = r.persistent ? 'Saved in this browser at ' + new Date().toLocaleTimeString() : 'This browser blocks storage (private mode?). Use Export backup to keep your data.';
    }
  }
  function changed() { cvDirty = true; saveSoon(); updateBadges(); }

  // ---------------------------------------------------------------- dialog
  function dialog(opts) {
    var dlg = $('#dialog');
    if (!dlg || typeof dlg.showModal !== 'function') {
      return Promise.resolve(root.confirm(opts.fallbackText || opts.title) ? (opts.buttons && opts.buttons[opts.buttons.length - 1].value) : null);
    }
    var inner = $('#dialogInner');
    inner.innerHTML = '<h3>' + E(opts.title) + '</h3>' + (opts.html || '') + '<div class="dialog-actions">' +
      (opts.buttons || [{ label: 'OK', value: 'ok', primary: true }]).map(function (b) {
        return '<button class="btn ' + (b.primary ? 'primary' : '') + (b.danger ? ' danger' : '') + '" value="' + E(b.value) + '">' + E(b.label) + '</button>';
      }).join('') + '</div>';
    return new Promise(function (resolve) {
      dlg.onclose = function () { resolve(dlg.returnValue || null); };
      dlg.returnValue = '';
      dlg.showModal();
      if (opts.onOpen) U.safe(function () { opts.onOpen(inner); }, null, 'dialog');
    });
  }

  // ---------------------------------------------------------------- tabs
  function showTab(name) {
    $$('.tab').forEach(function (t) { var on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    $$('.panel').forEach(function (p) { var on = p.id === 'tab-' + name; p.hidden = !on; p.classList.toggle('active', on); });
    if (name === 'job') renderAnalysis();
    if (name === 'cv') { if (cvDirty || !current) build(false); else renderCv(); }
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    try { root.sessionStorage.setItem('cvforge.tab', name); } catch (e) { /* ignore */ }
    root.scrollTo(0, 0);
  }

  function updateBadges() {
    var st = CVM.profile.stats(state.profile);
    $('#completeness').textContent = st.completeness + '%';
    $('#historyCount').textContent = String(state.history.length);
    $('#scorePill').textContent = current ? String(current.score) : '–';
  }

  // ---------------------------------------------------------------- memory form
  var ENTRY_DEFS = {
    experience: {
      label: 'Experience', item: 'role', titleOf: function (e) { return [e.role, e.company].filter(Boolean).join(' — ') || 'New role'; },
      blank: function () { return { id: U.uid('exp'), role: '', company: '', location: '', start: '', end: '', current: false, bullets: [], tech: [] }; },
      fields: [
        ['grid2', [['role', 'Job title', 'text'], ['company', 'Company / organisation', 'text']]],
        ['grid4', [['location', 'Location', 'text'], ['start', 'Start (e.g. 2022-03)', 'text'], ['end', 'End', 'text'], ['current', 'I work here now', 'bool']]],
        ['', [['tech', 'Tools & skills used (comma separated)', 'csv']]],
        ['', [['bullets', 'Achievements — one per line. Add them all; the best are picked per job. Start with a verb, include numbers.', 'lines', 6]]]
      ]
    },
    projects: {
      label: 'Projects', item: 'project', titleOf: function (e) { return e.name || 'New project'; },
      blank: function () { return { id: U.uid('prj'), name: '', role: '', link: '', start: '', end: '', bullets: [], tech: [] }; },
      fields: [
        ['grid3', [['name', 'Project name', 'text'], ['role', 'Your role', 'text'], ['link', 'Link', 'text']]],
        ['grid3', [['start', 'Start', 'text'], ['end', 'End', 'text'], ['tech', 'Tech / tools (comma separated)', 'csv']]],
        ['', [['bullets', 'What you built and the results — one per line', 'lines', 4]]]
      ]
    },
    education: {
      label: 'Education', item: 'education', titleOf: function (e) { return [e.degree, e.school].filter(Boolean).join(' — ') || 'New education'; },
      blank: function () { return { id: U.uid('edu'), school: '', degree: '', field: '', start: '', end: '', grade: '', details: [] }; },
      fields: [
        ['grid3', [['school', 'School / university', 'text'], ['degree', 'Degree', 'text'], ['field', 'Field of study', 'text']]],
        ['grid3', [['start', 'Start', 'text'], ['end', 'End (or expected)', 'text'], ['grade', 'Grade / GPA (optional)', 'text']]],
        ['', [['details', 'Relevant coursework, thesis, honours — one per line (optional)', 'lines', 2]]]
      ]
    }
  };

  function fieldHtml(path, label, kind, value, rows) {
    var id = 'f_' + path.replace(/\W/g, '_');
    if (kind === 'bool') return '<label class="field check"><input type="checkbox" id="' + id + '" data-path="' + path + '" data-kind="bool"' + (value ? ' checked' : '') + '> ' + E(label) + '</label>';
    var v = kind === 'lines' ? U.arr(value).join('\n') : kind === 'csv' ? U.arr(value).join(', ') : U.str(value);
    if (kind === 'lines' || kind === 'textarea' || kind === 'skills' || kind === 'certs') {
      return '<label class="field" for="' + id + '"><span>' + E(label) + '</span><textarea id="' + id + '" rows="' + (rows || 3) + '" data-path="' + path + '" data-kind="' + kind + '">' + E(v) + '</textarea></label>';
    }
    return '<label class="field" for="' + id + '"><span>' + E(label) + '</span><input id="' + id + '" type="' + (kind === 'email' ? 'email' : 'text') + '" data-path="' + path + '" data-kind="text" value="' + E(v) + '"></label>';
  }

  function section(key, title, count, body) {
    return '<details class="sec" data-sec="' + key + '"' + (openSections[key] ? ' open' : '') + '><summary>' + E(title) +
      '<span class="sec-count">' + E(count || '') + '</span></summary><div class="sec-body">' + body + '</div></details>';
  }

  function renderMemory() {
    var p = state.profile, h = [];
    var b = p.basics;
    h.push(section('basics', 'Basics & contact', '', [
      '<div class="grid2">' + fieldHtml('basics.name', 'Full name', 'text', b.name) + fieldHtml('basics.headline', 'Main headline / title', 'text', b.headline) + '</div>',
      fieldHtml('basics.headlines', 'Other accurate headlines, one per line (e.g. Website Developer · Backend Focused). The best fit is picked per job.', 'lines', b.headlines, 3),
      '<div class="grid3">' + fieldHtml('basics.email', 'Email', 'email', b.email) + fieldHtml('basics.phone', 'Phone', 'text', b.phone) + fieldHtml('basics.location', 'Location (City, Country)', 'text', b.location) + '</div>',
      '<div><div class="field"><span>Links (LinkedIn, GitHub, portfolio, YouTube…)</span></div>' +
        b.links.map(function (l, i) {
          return '<div class="link-row">' + fieldHtml('basics.links.' + i + '.label', 'Label', 'text', l.label) + fieldHtml('basics.links.' + i + '.url', 'URL', 'text', l.url) +
            '<button class="btn ghost small" type="button" data-action="remove-link" data-index="' + i + '" title="Remove link">✕</button></div>';
        }).join('') + '<button class="btn small" type="button" data-action="add-link" style="margin-top:8px">+ Add link</button></div>'
    ].join('')));

    h.push(section('summary', 'Professional summary', p.summary ? U.words(p.summary).length + ' words' : '',
      fieldHtml('summary', 'Your summary in your own words. Tip: write one per target role, separated by a blank line — the best match is used for each job.', 'textarea', p.summary, 8)));

    h.push(section('skills', 'Skills', p.skills.length + ' skills',
      fieldHtml('skills', 'All your skills, tools and technologies — comma or newline separated. Be exhaustive; only relevant ones are shown per job.', 'skills', p.skills.map(function (s) { return s.name; }).join(', '), 4) +
      '<div class="chips" id="skillChips">' + skillChips(p) + '</div>'));

    ['experience', 'projects', 'education'].forEach(function (key) {
      var def = ENTRY_DEFS[key], list = p[key];
      var body = list.map(function (e, i) {
        return '<div class="entry" data-entry="' + key + '.' + i + '"><div class="entry-head"><span class="entry-title" id="t_' + key + '_' + i + '">' + E(def.titleOf(e)) + '</span><span class="entry-tools">' +
          '<button class="btn ghost small" type="button" data-action="move" data-list="' + key + '" data-index="' + i + '" data-dir="-1" title="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn ghost small" type="button" data-action="move" data-list="' + key + '" data-index="' + i + '" data-dir="1" title="Move down"' + (i === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="btn ghost small danger" type="button" data-action="remove-entry" data-list="' + key + '" data-index="' + i + '" title="Delete">✕</button></span></div>' +
          def.fields.map(function (row) {
            var inner = row[1].map(function (f) { return fieldHtml(key + '.' + i + '.' + f[0], f[1], f[2], e[f[0]], f[3]); }).join('');
            return row[0] ? '<div class="' + row[0] + '">' + inner + '</div>' : inner;
          }).join('') + '</div>';
      }).join('');
      h.push(section(key, def.label, list.length + ' ' + def.item + (list.length === 1 ? '' : 's'),
        body + '<div><button class="btn" type="button" data-action="add-entry" data-list="' + key + '">+ Add ' + def.item + '</button></div>'));
    });

    h.push(section('certifications', 'Certifications & courses', p.certifications.length ? String(p.certifications.length) : '',
      fieldHtml('certifications', 'One per line: Name | Issuer | Date', 'certs', p.certifications.map(function (c) { return [c.name, c.issuer, c.date].filter(Boolean).join(' | '); }).join('\n'), 3)));
    h.push(section('achievements', 'Awards & achievements', p.achievements.length ? String(p.achievements.length) : '',
      fieldHtml('achievements', 'One per line (competitions, milestones, press, records…)', 'lines', p.achievements, 3)));
    h.push(section('languages', 'Languages', p.languages.length ? String(p.languages.length) : '',
      fieldHtml('languages', 'Comma separated, e.g. English (Fluent), Hindi (Native)', 'csv', p.languages)));
    h.push(section('notes', 'Extra memory (anything else about you)', p.memoryNotes ? U.words(p.memoryNotes).length + ' words' : '',
      fieldHtml('memoryNotes', 'Free notes: side gigs, numbers, tools you know, stories, goals. Skills mentioned here count as evidence when matching jobs — except lines starting with TODO or ?, which are reminders only.', 'textarea', p.memoryNotes, 6)));

    $('#memoryForm').innerHTML = h.join('');
    renderTips();
    updateBadges();
  }

  function skillChips(p) {
    return p.skills.slice(0, 80).map(function (s) {
      var cat = CVM.skillsDb.categoryOf(s.name);
      return '<span class="chip" title="' + (cat === 'phrase' ? 'Custom skill' : 'Recognised: ' + cat) + '">' + E(s.name) + '</span>';
    }).join('');
  }

  function renderTips() {
    var p = state.profile, st = CVM.profile.stats(p), tips = [];
    if (!p.basics.name && !p.experience.length) tips.push('New here? <b>Paste existing CV</b> to fill your memory in seconds, or use <b>More ▾ → Load Aayush starter draft</b>.');
    else {
      if (!p.basics.email || !p.basics.phone) tips.push('Add your email and phone — ATS systems read contact details from the CV body.');
      if (st.bullets < 8) tips.push('Add more achievement bullets (aim for 4–8 per role). The more you store, the better each CV can be tailored.');
      var all = [];
      p.experience.forEach(function (e) { all = all.concat(e.bullets); });
      var q = all.filter(function (x) { return CVM.tailor.METRIC_RE.test(x); }).length;
      if (all.length && q / all.length < 0.4) tips.push('Only ' + q + ' of ' + all.length + ' experience bullets have numbers. Add real metrics (users, %, time, revenue, views).');
      if (p.experience.some(function (e) { return !e.start; })) tips.push('Some roles have no start date — ATS systems use dates to compute years of experience.');
      var todos = (p.memoryNotes.match(/^\s*TODO/gim) || []).length;
      if (todos) tips.push('You have ' + todos + ' TODO note' + (todos > 1 ? 's' : '') + ' in “Extra memory” — filling them in will raise your scores.');
    }
    $('#memoryTips').innerHTML = tips.length ? '<div class="tip">💡 ' + tips[0] + '</div>' : '';
  }

  function setPath(obj, path, value) {
    var parts = path.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = /^\d+$/.test(parts[i]) ? +parts[i] : parts[i];
      if (o[k] === undefined || o[k] === null) return false;
      o = o[k];
    }
    o[parts[parts.length - 1]] = value;
    return true;
  }

  function onMemoryInput(ev) {
    var el = ev.target, path = el.dataset && el.dataset.path;
    if (!path) return;
    var kind = el.dataset.kind, v;
    var p = state.profile;
    if (kind === 'bool') v = el.checked;
    else if (kind === 'lines') v = el.value.split('\n').map(function (s) { return s.replace(/^\s*[-•*▪●◦·]\s*/, '').trim(); }).filter(Boolean);
    else if (kind === 'csv') v = U.unique(el.value.split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean));
    else v = U.str(el.value, 20000);

    if (kind === 'skills') {
      var names = U.unique(el.value.split(/[,\n;]/).map(function (s) { return s.trim(); }).filter(Boolean));
      var old = Object.create(null);
      p.skills.forEach(function (s) { old[s.name.toLowerCase()] = s; });
      p.skills = names.map(function (n) { return old[n.toLowerCase()] || { name: n.slice(0, 80), level: '', years: '' }; });
      var chips = $('#skillChips');
      if (chips) chips.innerHTML = skillChips(p);
    } else if (kind === 'certs') {
      p.certifications = el.value.split('\n').map(function (l) {
        var parts = l.split('|').map(function (x) { return x.trim(); });
        return { name: parts[0] || '', issuer: parts[1] || '', date: parts[2] || '' };
      }).filter(function (c) { return c.name; });
    } else {
      setPath(p, path, v);
      var m = path.match(/^(experience|projects|education)\.(\d+)\./);
      if (m) {
        var t = $('#t_' + m[1] + '_' + m[2]);
        if (t) t.textContent = ENTRY_DEFS[m[1]].titleOf(p[m[1]][+m[2]]);
        if (path.slice(-8) === '.current' && v) { p[m[1]][+m[2]].end = ''; var endEl = $('[data-path="' + m[1] + '.' + m[2] + '.end"]'); if (endEl) endEl.value = ''; }
      }
    }
    changed();
  }

  // ---------------------------------------------------------------- job analysis
  var analysisCache = { text: null, result: null };
  function analysis() {
    if (analysisCache.text !== state.job.text) {
      analysisCache = { text: state.job.text, result: CVM.analyzer.analyze(state.job.text) };
    }
    return analysisCache.result;
  }

  function renderAnalysis() {
    var view = $('#analysisView');
    var a = analysis();
    if (a.empty) { view.innerHTML = '<div class="empty"><p><b>Paste a job description</b> on the left.</p><p>You\'ll see the keywords an ATS will scan for, which ones your memory already covers, and the gaps.</p></div>'; return; }
    var corpus = CVM.tailor.profileCorpus(state.profile);
    var have = 0;
    function chip(k) {
      var ok = CVM.tailor.textHas(corpus, k);
      if (ok) have++;
      return '<span class="chip ' + (ok ? 'have' : 'gap') + '" title="' + (ok ? 'Found in your memory' : 'Not in your memory') + ' · weight ' + k.weight + '">' + (ok ? '✓ ' : '✗ ') + E(k.display || k.term) + '</span>';
    }
    var groups = [['must', 'Must-have'], ['should', 'Important'], ['nice', 'Nice to have']];
    var html = '<h3>Job research</h3><div class="facts">' +
      fact('Title', a.title || '—') + fact('Company', a.company || '—') + fact('Seniority', a.seniority || '—') +
      fact('Experience', a.yearsRequired ? a.yearsRequired + '+ years' : 'Not stated') + fact('Education', a.education || 'Not stated') + fact('Your years (dated roles)', CVM.tailor.totalYears(state.profile) + '') + '</div>';
    var kw = a.keywords.filter(function (k) { return k.category !== 'title'; });
    html += '<div class="legend"><span class="chip have">✓ in your memory</span><span class="chip gap">✗ missing</span></div>';
    groups.forEach(function (g) {
      var items = kw.filter(function (k) { return k.priority === g[0]; });
      if (items.length) html += '<div class="kw-group"><h4>' + g[1] + ' (' + items.length + ')</h4><div class="chips">' + items.map(chip).join('') + '</div></div>';
    });
    var pct = kw.length ? Math.round(have / kw.length * 100) : 0;
    html += '<p><b>' + have + ' of ' + kw.length + '</b> keywords are backed by your memory (' + pct + '%).</p>';
    html += '<p class="muted">Missing keywords: if you genuinely have the skill, add it to <b>My Memory</b> (a bullet that shows it in use is best). Never add skills you don\'t have — interviews will test them.</p>';
    if (a.responsibilities.length) html += '<details><summary class="muted">Responsibilities detected (' + a.responsibilities.length + ')</summary><ul>' + a.responsibilities.map(function (r) { return '<li>' + E(r) + '</li>'; }).join('') + '</ul></details>';
    view.innerHTML = html;
  }

  function fact(label, value) { return '<div class="fact"><b>' + E(label) + '</b>' + E(value) + '</div>'; }

  // ---------------------------------------------------------------- build & CV view
  /** Trim the weakest content until the rendered CV fits on one page (measured in the real layout). */
  function fitToOnePage(cv) {
    if (!state.settings.onePage) return { trimmed: 0 };
    var host = doc.createElement('div');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;';
    var letter = state.settings.pageSize === 'Letter';
    host.innerHTML = '<div style="width:' + (letter ? 184 : 178) + 'mm;background:#fff"></div><div style="height:' + (letter ? 251 : 269) + 'mm"></div>';
    doc.body.appendChild(host);
    var box = host.firstChild, limit = host.lastChild.offsetHeight, trimmed = 0;
    try {
      ensureCvStyle();
      for (var i = 0; i < 40; i++) {
        box.innerHTML = CVM.render.cvHtml(cv, state.settings.template);
        if (box.offsetHeight <= limit || !CVM.tailor.trimOnce(cv)) break;
        trimmed++;
      }
    } finally { host.remove(); }
    return { trimmed: trimmed };
  }

  function ensureCvStyle() {
    var style = doc.getElementById('cvStyle');
    if (!style) { style = doc.createElement('style'); style.id = 'cvStyle'; doc.head.appendChild(style); }
    style.textContent = CVM.render.cvCss(state.settings.pageSize).replace(/@page\{[^}]*\}/, '');
  }

  function build(switchTab) {
    var r = CVM.tailor.run(state.profile, state.job.text, state.settings);
    var fit = fitToOnePage(r.cv);
    if (fit.trimmed) r = CVM.tailor.evaluate(r.cv, r.analysis, state.profile, state.settings);
    r.cv.meta.trimmed = fit.trimmed;
    current = r;
    cvDirty = false;
    lastResearch = '';
    renderCv();
    updateBadges();
    if (switchTab) showTab('cv');
  }

  var reevaluate = U.debounce(safe(function () {
    if (!current) return;
    current = CVM.tailor.evaluate(current.cv, current.analysis, state.profile, state.settings);
    renderCvSide(); renderPreview(); updateBadges();
  }, 'rescore'), 350);

  function renderCv() {
    if (!current) { $('#cvSide').innerHTML = ''; $('#cvPreview').innerHTML = '<div class="empty">Fill in My Memory and paste a job to build your CV.</div>'; return; }
    renderCvSide();
    renderPreview();
  }

  function renderPreview() {
    var page = $('#cvPreview');
    page.classList.toggle('letter', state.settings.pageSize === 'Letter');
    ensureCvStyle();
    page.innerHTML = CVM.render.cvHtml(current.cv, state.settings.template);
    $$('.seg-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.template === state.settings.template); });
  }

  function renderCvSide() {
    var r = current, a = r.analysis, m = r.match;
    var color = r.score >= 80 ? 'var(--good)' : r.score >= 60 ? 'var(--warn)' : 'var(--bad)';
    var h = [];
    h.push('<div class="score"><div class="ring" style="--v:' + r.score + ';--c:' + color + '"><span>' + r.score + '</span></div><div><b>ATS score</b><br><span class="muted">' +
      (a.empty ? 'No job pasted — this is your general CV. Paste a job in step 2 for a tailored one.' : 'Keyword match ' + m.coverage + '% · must-haves ' + m.mustHave.got + '/' + m.mustHave.total) + '</span></div></div>');
    if (!a.empty) h.push('<div class="bar" title="Keyword coverage"><i style="width:' + m.coverage + '%"></i></div>');
    if (r.cv.meta.titleNote) h.push('<p class="muted" style="margin:0">' + E(r.cv.meta.titleNote) + '</p>');
    if (r.cv.meta.trimmed) h.push('<p class="muted" style="margin:0">Fitted to one page: left out ' + r.cv.meta.trimmed + ' lower-relevance line' + (r.cv.meta.trimmed > 1 ? 's' : '') + '. Turn off in Settings for a longer CV.</p>');

    h.push('<div><label class="field"><span>Headline</span><input id="cvHeadline" maxlength="140" value="' + E(r.cv.basics.headline) + '"></label></div>');
    h.push('<div><label class="field"><span>Summary <span class="hint">edit freely — score updates live</span></span><textarea id="cvSummary" rows="6" maxlength="1200">' + E(r.cv.summary) + '</textarea></label></div>');

    if (!a.empty) {
      if (m.gaps.length) h.push('<div><h3>Gaps (not in your memory)</h3><div class="chips">' + m.gaps.slice(0, 20).map(function (k) { return '<span class="chip gap">' + E(k.display || k.term) + ' <small>' + k.priority + '</small></span>'; }).join('') + '</div><p class="muted" style="margin-top:6px">Add only if true — then click Rebuild.</p></div>');
      if (m.unused.length) h.push('<div><h3>In memory, not on this CV</h3><div class="chips">' + m.unused.slice(0, 12).map(function (k) { return '<span class="chip unused">' + E(k.display || k.term) + '</span>'; }).join('') + '</div><p class="muted" style="margin-top:6px">Raise "bullets per role" in Settings or mention them in the summary.</p></div>');
      if (m.matched.length) h.push('<details><summary><b>Matched keywords (' + m.matched.length + ')</b></summary><div class="chips" style="margin-top:8px">' + m.matched.map(function (k) { return '<span class="chip have">' + E(k.display || k.term) + '</span>'; }).join('') + '</div></details>');
    }

    h.push('<div><h3>ATS checks</h3><ul class="checks">' + r.checks.map(function (c) {
      var ico = { pass: '✓', warn: '!', fail: '✗', info: 'i' }[c.status];
      return '<li class="' + c.status + '"><span class="ico">' + ico + '</span><span>' + E(c.label) + (c.detail ? '<small>' + E(c.detail) + '</small>' : '') + '</span></li>';
    }).join('') + '</ul></div>');

    var ai = '<div class="ai-box"><b>AI research &amp; rewrite (optional)</b>';
    if (!state.settings.aiEnabled) ai += '<span class="ai-status">Off. Turn on in Settings with your Anthropic API key to research the company on the web and rewrite bullets in the job\'s language — using only facts from your memory.</span>';
    else ai += '<button class="btn primary" type="button" data-action="ai-enhance"' + (aiBusy || a.empty ? ' disabled' : '') + '>' + (aiBusy ? '<span class="spinner"></span> Working…' : '✨ Research company & rewrite') + '</button><span class="ai-status" id="aiStatus">' +
      (a.empty ? 'Paste a job first.' : r.cv.meta.engine === 'ai' ? 'This CV was rewritten by AI. Review every line before sending.' : 'Uses your API key; your offline CV stays as the fallback.') + '</span>';
    if (r.cv.meta.aiRejected && r.cv.meta.aiRejected.length) ai += '<div><b>Blocked ' + r.cv.meta.aiRejected.length + ' AI line' + (r.cv.meta.aiRejected.length > 1 ? 's' : '') + '</b> (they contained numbers not in your memory)<ul>' + r.cv.meta.aiRejected.map(function (n) { return '<li>' + E(n) + '</li>'; }).join('') + '</ul></div>';
        if (r.cv.meta.aiNotes && r.cv.meta.aiNotes.length) ai += '<div><b>AI suggestions</b><ul>' + r.cv.meta.aiNotes.map(function (n) { return '<li>' + E(n) + '</li>'; }).join('') + '</ul></div>';
    if (lastResearch) ai += '<details><summary>Company research</summary><div class="research">' + E(lastResearch) + '</div></details>';
    ai += '</div>';
    h.push(ai);
    h.push('<div class="actions"><button class="btn" type="button" data-action="rebuild">↻ Rebuild from memory</button><button class="btn ghost" type="button" data-tab-link="job">Edit job</button><button class="btn ghost" type="button" data-tab-link="memory">Edit memory</button></div>');
    $('#cvSide').innerHTML = h.join('');
  }

  function aiEnhance() {
    if (aiBusy || !current) return;
    if (!CVM.ai.getKey()) { toast('Add your Anthropic API key in Settings first.', 'error'); showTab('settings'); return; }
    aiBusy = true;
    renderCvSide();
    var status = function (s) { var el = $('#aiStatus'); if (el) el.textContent = s; };
    status(state.settings.aiResearch ? 'Researching the company and role on the web…' : 'Rewriting your CV for this job…');
    var draft = U.clone(current.cv);
    CVM.ai.enhance(state.profile, current.analysis, state.job.text, draft, { research: state.settings.aiResearch, model: state.settings.aiModel, onStatus: status })
      .then(function (res) {
        aiBusy = false;
        lastResearch = res.research || '';
        if (res.error) { toast('AI step failed: ' + res.error + ' Your offline CV is unchanged.', 'error', 8000); renderCvSide(); return; }
        var before = current.score;
        current = CVM.tailor.evaluate(res.cv, current.analysis, state.profile, state.settings);
        renderCv(); updateBadges();
        toast('AI rewrite done. Score ' + before + ' → ' + current.score + '. Review every line before sending.', 'good', 6000);
      }).catch(function (e) { aiBusy = false; CVM.onError(e, 'AI'); renderCvSide(); });
  }

  // ---------------------------------------------------------------- exports
  function fileBase() {
    var n = U.slug(current.cv.basics.name || 'CV');
    var co = current.analysis.company ? '_' + U.slug(current.analysis.company) : '';
    return n + '_CV' + co;
  }

  function requireCv() {
    if (!current) { toast('Build a CV first.', 'error'); return false; }
    if (!current.cv.basics.name) { toast('Tip: add your name in My Memory → Basics.', 'error'); }
    return true;
  }

  function printPdf() {
    var html = CVM.render.cvDocument(current.cv, state.settings.template, state.settings.pageSize);
    var frame = $('#printFrame');
    var done = false;
    function fallback() {
      var w = root.open('', '_blank');
      if (!w) { U.download(fileBase() + '.html', html, 'text/html;charset=utf-8'); toast('Pop-up blocked: downloaded the CV as HTML — open it and press Ctrl/Cmd+P → Save as PDF.'); return; }
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* user can print manually */ } }, 400);
    }
    try {
      frame.onload = function () {
        if (done) return;
        done = true;
        setTimeout(function () {
          try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { fallback(); }
        }, 150);
      };
      frame.srcdoc = html;
      toast('In the print dialog choose "Save as PDF". Turn off "Headers and footers" for a clean file.', null, 6000);
    } catch (e) { fallback(); }
  }

  var EXPORTS = {
    'download-pdf': printPdf,
    'download-docx': function () { U.download(fileBase() + '.docx', new Blob([CVM.docx.build(current.cv, state.settings.pageSize)], { type: CVM.docx.MIME })); },
    'download-txt': function () { U.download(fileBase() + '.txt', CVM.render.text(current.cv)); },
    'download-md': function () { U.download(fileBase() + '.md', CVM.render.markdown(current.cv), 'text/markdown;charset=utf-8'); },
    'download-html': function () { U.download(fileBase() + '.html', CVM.render.cvDocument(current.cv, state.settings.template, state.settings.pageSize), 'text/html;charset=utf-8'); },
    'copy-text': function () {
      var t = CVM.render.text(current.cv);
      var ok = function () { toast('Copied CV text — paste into the application form.', 'good'); };
      if (root.navigator.clipboard && root.isSecureContext) root.navigator.clipboard.writeText(t).then(ok, function () { legacyCopy(t) && ok(); });
      else if (legacyCopy(t)) ok();
    }
  };

  function legacyCopy(t) {
    var ta = doc.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    doc.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (!ok) toast('Copy blocked by the browser — use the .txt download instead.', 'error');
    return ok;
  }

  // ---------------------------------------------------------------- history
  function saveApplication() {
    if (!requireCv()) return;
    var a = current.analysis;
    state.history.unshift({
      id: U.uid('app'), date: new Date().toISOString(), title: a.title || current.cv.basics.headline || 'General CV', company: a.company || '',
      score: current.score, status: 'drafted', jobText: state.job.text, cv: U.clone(current.cv), notes: state.job.url || ''
    });
    if (state.history.length > 100) state.history.length = 100;
    persist(true);
    updateBadges();
    toast('Saved to Applications.', 'good');
  }

  function renderHistory() {
    var v = $('#historyView');
    if (!state.history.length) { v.innerHTML = '<div class="card empty">No saved applications yet. Build a CV and click <b>Save to Applications</b>.</div>'; return; }
    var statuses = ['drafted', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
    v.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Role</th><th>Company</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>' +
      state.history.map(function (h, i) {
        var d = new Date(h.date);
        return '<tr><td>' + E(isNaN(d) ? '' : d.toLocaleDateString()) + '</td><td>' + E(h.title) + (h.notes ? '<br><a href="' + E(CVM.render.safeUrl(h.notes)) + '" target="_blank" rel="noopener" class="hint">job link</a>' : '') + '</td><td>' + E(h.company) + '</td><td><b>' + h.score + '</b></td>' +
          '<td><select data-history-status="' + i + '" aria-label="Status">' + statuses.map(function (s) { return '<option' + (s === h.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
          '<td class="actions"><button class="btn small" type="button" data-action="history-open" data-index="' + i + '"' + (h.cv ? '' : ' disabled') + '>Open</button>' +
          '<button class="btn small" type="button" data-action="history-docx" data-index="' + i + '"' + (h.cv ? '' : ' disabled') + '>.docx</button>' +
          '<button class="btn ghost small danger" type="button" data-action="history-delete" data-index="' + i + '">✕</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function historyCv(i) {
    var h = state.history[i];
    if (!h || !h.cv) return null;
    // Saved CVs may come from an older version or a hand-edited backup: re-shape defensively.
    var cv = h.cv;
    var shaped = {
      meta: cv.meta && typeof cv.meta === 'object' ? cv.meta : { engine: 'offline' },
      basics: { name: U.str(cv.basics && cv.basics.name), headline: U.str(cv.basics && cv.basics.headline), email: U.str(cv.basics && cv.basics.email), phone: U.str(cv.basics && cv.basics.phone), location: U.str(cv.basics && cv.basics.location), links: U.arr(cv.basics && cv.basics.links).filter(function (l) { return l && l.url; }) },
      summary: U.str(cv.summary),
      skills: U.arr(cv.skills).filter(function (g) { return g && Array.isArray(g.items); }),
      experience: U.arr(cv.experience).map(function (e) { return { role: U.str(e && e.role), company: U.str(e && e.company), location: U.str(e && e.location), dates: U.str(e && e.dates), bullets: U.arr(e && e.bullets).map(U.str) }; }),
      projects: U.arr(cv.projects).map(function (p) { return { name: U.str(p && p.name), role: U.str(p && p.role), link: U.str(p && p.link), dates: U.str(p && p.dates), tech: U.arr(p && p.tech).map(U.str), bullets: U.arr(p && p.bullets).map(U.str) }; }),
      education: U.arr(cv.education).map(function (e) { return { school: U.str(e && e.school), degree: U.str(e && e.degree), dates: U.str(e && e.dates), grade: U.str(e && e.grade), details: U.arr(e && e.details).map(U.str) }; }),
      certifications: U.arr(cv.certifications).map(function (c) { return { name: U.str(c && c.name), issuer: U.str(c && c.issuer), date: U.str(c && c.date) }; }),
      achievements: U.arr(cv.achievements).map(U.str),
      languages: U.arr(cv.languages).map(U.str)
    };
    return shaped;
  }

  // ---------------------------------------------------------------- settings
  function renderSettings() {
    var s = state.settings, key = CVM.ai.getKey();
    var backups = CVM.profile.listBackups();
    var models = [['claude-opus-5-5', 'Claude Opus 5.5 (best quality)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster, cheaper)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest)']];
    $('#settingsView').innerHTML =
      '<div class="card"><h3>CV layout</h3>' +
        '<label class="field"><span>Page size</span><select data-setting="pageSize"><option' + (s.pageSize === 'A4' ? ' selected' : '') + '>A4</option><option' + (s.pageSize === 'Letter' ? ' selected' : '') + '>Letter</option></select></label>' +
        '<label class="field"><span>Template</span><select data-setting="template">' + ['classic', 'modern', 'compact'].map(function (t) { return '<option value="' + t + '"' + (s.template === t ? ' selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; }).join('') + '</select></label>' +
        '<div class="grid3"><label class="field"><span>Bullets: 2 latest roles</span><input type="number" min="1" max="10" data-setting="maxBulletsRecent" value="' + s.maxBulletsRecent + '"></label>' +
        '<label class="field"><span>Bullets: older roles</span><input type="number" min="1" max="10" data-setting="maxBulletsOlder" value="' + s.maxBulletsOlder + '"></label>' +
        '<label class="field"><span>Max projects</span><input type="number" min="0" max="8" data-setting="maxProjects" value="' + s.maxProjects + '"></label></div>' +
        '<label class="field check"><input type="checkbox" data-setting="mirrorTitle"' + (s.mirrorTitle ? ' checked' : '') + '> Mirror the job title in my headline when my memory supports it</label>' +
        '<label class="field check"><input type="checkbox" data-setting="includeProjects"' + (s.includeProjects ? ' checked' : '') + '> Include a Projects section</label>' +
        '<label class="field check"><input type="checkbox" data-setting="onePage"' + (s.onePage ? ' checked' : '') + '> Fit the CV on one page (recommended for students and under 5 years)</label>' +
      '</div>' +
      '<div class="card"><h3>AI mode (optional)</h3><p class="muted">Off by default — everything works offline. With your own Anthropic API key, CV Forge can research the company on the web and rewrite your CV in the job\'s language. It is instructed to use only facts from your memory, and its skills are filtered against your memory. The key is stored only in this browser and sent only to Anthropic.</p>' +
        '<label class="field check"><input type="checkbox" data-setting="aiEnabled"' + (s.aiEnabled ? ' checked' : '') + '> Enable AI mode</label>' +
        '<label class="field"><span>Anthropic API key <a class="hint" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">get a key</a></span><input type="password" id="aiKey" autocomplete="off" placeholder="sk-ant-…" value="' + E(key) + '"></label>' +
        '<label class="field"><span>Model</span><select data-setting="aiModel">' + models.map(function (m) { return '<option value="' + m[0] + '"' + (s.aiModel === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="field check"><input type="checkbox" data-setting="aiResearch"' + (s.aiResearch ? ' checked' : '') + '> Research the company on the web first</label>' +
      '</div>' +
      '<div class="card"><h3>Your data</h3><p>' + (CVM.profile.storageAvailable() ? '✓ Saved automatically in this browser (nothing is uploaded).' : '⚠ This browser blocks storage. Use <b>Export backup</b> regularly.') + '</p>' +
        '<p class="muted">Export a backup JSON to move your memory to another device, or commit it somewhere private.</p>' +
        '<div class="actions"><button class="btn" type="button" data-action="export-json">Export backup</button><button class="btn" type="button" data-action="import-json">Import backup</button></div>' +
        '<h3 style="margin-top:8px">Automatic snapshots (' + backups.length + ')</h3>' +
        (backups.length ? '<div class="actions">' + backups.slice(0, 8).map(function (b, i) { return '<button class="btn small" type="button" data-action="restore-backup" data-index="' + i + '">' + E(new Date(b.at).toLocaleString()) + '</button>'; }).join('') + '</div>' : '<p class="muted">Snapshots are taken while you work.</p>') +
        '<button class="btn ghost danger" type="button" data-action="wipe-all">Delete all data…</button>' +
      '</div>';
  }

  function onSettingChange(el) {
    var k = el.dataset.setting, d = CVM.profile.defaultSettings();
    if (!(k in d)) return;
    var v = typeof d[k] === 'boolean' ? el.checked : typeof d[k] === 'number' ? U.clamp(parseInt(el.value, 10), 0, 10) : el.value;
    state.settings[k] = v;
    state = Object.assign(state, { settings: CVM.profile.normalizeState(state).settings });
    cvDirty = cvDirty || ['maxBulletsRecent', 'maxBulletsOlder', 'maxProjects', 'mirrorTitle', 'includeProjects', 'onePage', 'pageSize', 'template'].indexOf(k) >= 0;
    saveSoon();
  }

  // ---------------------------------------------------------------- import / export memory
  function exportJson() {
    var data = JSON.stringify({ app: 'CV Forge', exportedAt: new Date().toISOString(), version: CVM.profile.SCHEMA_VERSION, profile: state.profile, history: state.history, settings: state.settings, job: state.job }, null, 2);
    U.download('cv-forge-memory-' + new Date().toISOString().slice(0, 10) + '.json', data, 'application/json');
    toast('Backup downloaded. Keep it somewhere safe.', 'good');
  }

  function importJsonFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('That file is too large to be a CV Forge backup.', 'error'); return; }
    var reader = new FileReader();
    reader.onerror = function () { toast('Could not read the file.', 'error'); };
    reader.onload = safe(function () {
      var data;
      try { data = JSON.parse(String(reader.result)); } catch (e) { toast('Not valid JSON — nothing was changed.', 'error'); return; }
      var isState = data && (data.profile || data.history);
      var incoming = isState ? CVM.profile.normalizeState(data) : null;
      var profile = isState ? incoming.profile : CVM.profile.normalize(data); // also accepts JSON Resume files
      dialog({
        title: 'Import ' + (profile.basics.name ? '"' + profile.basics.name + '"' : 'backup'),
        html: '<p>Found ' + profile.experience.length + ' roles, ' + profile.projects.length + ' projects, ' + profile.skills.length + ' skills' + (isState ? ', ' + incoming.history.length + ' saved applications' : '') + '.</p><p class="muted">Merge keeps everything you already have and adds what\'s new. Replace swaps your memory for this file (a snapshot of the current one is kept).</p>',
        buttons: [{ label: 'Cancel', value: '' }, { label: 'Replace', value: 'replace', danger: true }, { label: 'Merge', value: 'merge', primary: true }]
      }).then(safe(function (choice) {
        if (!choice) return;
        persist(true);
        if (choice === 'replace') {
          state.profile = profile;
          if (isState) { state.history = incoming.history; state.settings = incoming.settings; }
        } else {
          state.profile = CVM.importer.merge(state.profile, profile);
          if (isState) {
            var ids = state.history.map(function (h) { return h.id; });
            state.history = state.history.concat(incoming.history.filter(function (h) { return ids.indexOf(h.id) < 0; })).slice(0, 100);
          }
        }
        changed(); persist(true); renderMemory();
        toast('Memory imported.', 'good');
      }, 'import'));
    }, 'import');
    reader.readAsText(file);
  }

  function importText() {
    dialog({
      title: 'Paste your existing CV',
      html: '<p class="muted">Paste the text of your CV or LinkedIn profile (copy from a PDF/Word file works). CV Forge will draft your memory from it — review afterwards.</p><label class="field"><textarea id="importText" rows="14" maxlength="60000" placeholder="Name\nTitle\nemail · phone\n\nEXPERIENCE\nRole — Company\nJan 2022 – Present\n• Did a thing that improved X by 30%\n…"></textarea></label>',
      buttons: [{ label: 'Cancel', value: '' }, { label: 'Add to memory', value: 'ok', primary: true }],
      onOpen: function (el) { var t = $('#importText', el); if (t) t.focus(); }
    }).then(safe(function (v) {
      if (v !== 'ok') return;
      var text = ($('#importText') || {}).value || '';
      if (text.trim().length < 30) { toast('Nothing to import.', 'error'); return; }
      var parsed = CVM.importer.parse(text);
      persist(true);
      state.profile = CVM.importer.merge(state.profile, parsed);
      changed(); renderMemory();
      toast('Imported ' + parsed.experience.length + ' roles, ' + parsed.projects.length + ' projects, ' + parsed.skills.length + ' skills. Please review each section.', 'good', 6000);
    }, 'import text'));
  }

  function loadProfile(p, label) {
    var hasData = state.profile.basics.name || state.profile.experience.length;
    var go = function (mode) {
      if (!mode) return;
      persist(true);
      state.profile = mode === 'merge' ? CVM.importer.merge(state.profile, p) : CVM.profile.normalize(p);
      changed(); renderMemory();
      toast(label + ' loaded.', 'good');
    };
    if (!hasData) return go('replace');
    dialog({ title: 'Load ' + label + '?', html: '<p>You already have data in your memory. A snapshot is kept either way.</p>',
      buttons: [{ label: 'Cancel', value: '' }, { label: 'Replace', value: 'replace', danger: true }, { label: 'Merge', value: 'merge', primary: true }] }).then(safe(go, 'load'));
  }

  // ---------------------------------------------------------------- actions
  var ACTIONS = {
    'import-text': importText,
    'import-json': function () { var f = $('#fileInput'); f.value = ''; f.click(); },
    'export-json': exportJson,
    'load-starter': function () { loadProfile(CVM.STARTER_PROFILE, 'Starter draft'); },
    'load-example': function () { loadProfile(CVM.EXAMPLE_PROFILE, 'Example profile'); },
    'export-portfolio': function () { U.download(U.slug(state.profile.basics.name || 'portfolio') + '_portfolio.html', CVM.render.portfolio(state.profile), 'text/html;charset=utf-8'); toast('Portfolio page downloaded — host it free on GitHub Pages or Netlify.', 'good'); },
    'clear-profile': function () {
      dialog({ title: 'Clear your memory?', html: '<p>This empties My Memory. A snapshot is kept in Settings → Automatic snapshots.</p>', buttons: [{ label: 'Cancel', value: '' }, { label: 'Clear', value: 'ok', danger: true }] })
        .then(safe(function (v) { if (v !== 'ok') return; persist(true); state.profile = CVM.profile.emptyProfile(); changed(); renderMemory(); }, 'clear'));
    },
    'add-link': function () { state.profile.basics.links.push({ label: '', url: '' }); changed(); renderMemory(); },
    'remove-link': function (el) { state.profile.basics.links.splice(+el.dataset.index, 1); changed(); renderMemory(); },
    'add-entry': function (el) {
      var key = el.dataset.list;
      state.profile[key].unshift(ENTRY_DEFS[key].blank());
      openSections[key] = true;
      changed(); renderMemory();
      var first = $('[data-path="' + key + '.0.' + ENTRY_DEFS[key].fields[0][1][0][0] + '"]');
      if (first) first.focus();
    },
    'remove-entry': function (el) {
      var key = el.dataset.list, i = +el.dataset.index, e = state.profile[key][i];
      dialog({ title: 'Delete "' + ENTRY_DEFS[key].titleOf(e) + '"?', html: '<p class="muted">A snapshot of your memory is kept.</p>', buttons: [{ label: 'Cancel', value: '' }, { label: 'Delete', value: 'ok', danger: true }] })
        .then(safe(function (v) { if (v !== 'ok') return; persist(true); state.profile[key].splice(i, 1); changed(); renderMemory(); }, 'delete'));
    },
    'move': function (el) {
      var list = state.profile[el.dataset.list], i = +el.dataset.index, j = i + (+el.dataset.dir);
      if (j < 0 || j >= list.length) return;
      var t = list[i]; list[i] = list[j]; list[j] = t;
      changed(); renderMemory();
    },
    'example-job': function () { state.job.text = CVM.EXAMPLE_JOB; $('#jobText').value = state.job.text; changed(); renderAnalysis(); },
    'build': function () {
      if (!state.profile.basics.name && !state.profile.experience.length && !state.profile.projects.length) { toast('Your memory is empty — add your details first (or load the starter draft).', 'error'); showTab('memory'); return; }
      build(true);
    },
    'rebuild': function () { build(false); toast('Rebuilt from memory.'); },
    'ai-enhance': aiEnhance,
    'save-application': saveApplication,
    'history-open': function (el) {
      var i = +el.dataset.index, h = state.history[i], cv = historyCv(i);
      if (!cv) return;
      state.job.text = h.jobText; $('#jobText').value = h.jobText;
      analysisCache = { text: null, result: null };
      current = CVM.tailor.evaluate(cv, analysis(), state.profile, state.settings);
      cvDirty = false; lastResearch = '';
      showTab('cv'); renderCv(); updateBadges();
    },
    'history-docx': function (el) {
      var cv = historyCv(+el.dataset.index);
      if (cv) U.download(U.slug(cv.basics.name || 'CV') + '_CV' + (state.history[+el.dataset.index].company ? '_' + U.slug(state.history[+el.dataset.index].company) : '') + '.docx', new Blob([CVM.docx.build(cv, state.settings.pageSize)], { type: CVM.docx.MIME }));
    },
    'history-delete': function (el) { state.history.splice(+el.dataset.index, 1); persist(true); renderHistory(); updateBadges(); },
    'restore-backup': function (el) {
      var b = CVM.profile.listBackups()[+el.dataset.index];
      if (!b) return;
      dialog({ title: 'Restore snapshot from ' + new Date(b.at).toLocaleString() + '?', html: '<p class="muted">Your current data becomes a new snapshot first, so this can be undone.</p>', buttons: [{ label: 'Cancel', value: '' }, { label: 'Restore', value: 'ok', primary: true }] })
        .then(safe(function (v) {
          if (v !== 'ok') return;
          var restored;
          try { restored = CVM.profile.normalizeState(JSON.parse(b.data)); } catch (e) { toast('That snapshot is unreadable.', 'error'); return; }
          persist(true); state = restored; current = null; cvDirty = true;
          persist(true); hydrate(); toast('Snapshot restored.', 'good');
        }, 'restore'));
    },
    'wipe-all': function () {
      dialog({ title: 'Delete ALL data?', html: '<p>This erases your memory, applications, settings, snapshots and API key from this browser. Export a backup first if unsure. This cannot be undone.</p>', buttons: [{ label: 'Cancel', value: '' }, { label: 'Delete everything', value: 'ok', danger: true }] })
        .then(safe(function (v) {
          if (v !== 'ok') return;
          try { Object.keys(root.localStorage).filter(function (k) { return k.indexOf('cvforge') === 0; }).forEach(function (k) { root.localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
          state = CVM.profile.emptyState(); current = null; cvDirty = true; hydrate(); toast('All data deleted.');
        }, 'wipe'));
    }
  };
  Object.keys(EXPORTS).forEach(function (k) { ACTIONS[k] = function () { if (requireCv()) EXPORTS[k](); }; });

  // ---------------------------------------------------------------- wiring
  function hydrate() {
    $('#jobText').value = state.job.text;
    $('#jobUrl').value = state.job.url;
    analysisCache = { text: null, result: null };
    renderMemory();
    var active = ($('.tab.active') || {}).dataset;
    showTab(active ? active.tab : 'memory');
  }

  function wire() {
    doc.addEventListener('click', safe(function (ev) {
      var t = ev.target.closest('[data-action],[data-tab],[data-tab-link],[data-template]');
      if (!t) return;
      if (t.dataset.tab) { showTab(t.dataset.tab); return; }
      if (t.dataset.tabLink) { showTab(t.dataset.tabLink); return; }
      if (t.dataset.template) { state.settings.template = t.dataset.template; saveSoon(); if (current) renderPreview(); return; }
      var fn = ACTIONS[t.dataset.action];
      if (fn) {
        var menu = t.closest('details.menu');
        if (menu) menu.open = false;
        fn(t);
      }
    }, 'click'));

    // Close dropdown menus when clicking elsewhere.
    doc.addEventListener('click', function (ev) {
      $$('details.menu[open]').forEach(function (m) { if (!m.contains(ev.target)) m.open = false; });
    });

    var form = $('#memoryForm');
    form.addEventListener('input', safe(onMemoryInput, 'edit'));
    form.addEventListener('change', safe(function (ev) { if (ev.target.dataset.kind === 'bool') onMemoryInput(ev); else if (ev.target.dataset.path) renderTips(); }, 'edit'));
    form.addEventListener('toggle', function (ev) { var s = ev.target.dataset && ev.target.dataset.sec; if (s) openSections[s] = ev.target.open; }, true);

    var analyzeSoon = U.debounce(safe(renderAnalysis, 'analyze'), 300);
    $('#jobText').addEventListener('input', safe(function (ev) { state.job.text = U.str(ev.target.value, 60000); changed(); analyzeSoon(); }, 'job'));
    $('#jobUrl').addEventListener('input', safe(function (ev) { state.job.url = U.str(ev.target.value, 500); saveSoon(); }, 'job'));

    $('#cvSide').addEventListener('input', safe(function (ev) {
      if (!current) return;
      if (ev.target.id === 'cvSummary') current.cv.summary = U.str(ev.target.value, 1200);
      else if (ev.target.id === 'cvHeadline') current.cv.basics.headline = U.str(ev.target.value, 140);
      else return;
      renderPreview();
      reevaluate();
    }, 'cv edit'));

    var settings = $('#settingsView');
    settings.addEventListener('change', safe(function (ev) {
      if (ev.target.dataset.setting) onSettingChange(ev.target);
      if (ev.target.id === 'aiKey') { CVM.ai.setKey(ev.target.value); toast(ev.target.value ? 'API key saved in this browser.' : 'API key removed.'); }
    }, 'settings'));

    $('#fileInput').addEventListener('change', safe(function (ev) { importJsonFile(ev.target.files && ev.target.files[0]); }, 'file'));

    $('#themeToggle').addEventListener('click', function () {
      var html = doc.documentElement;
      var dark = html.dataset.theme ? html.dataset.theme === 'dark' : root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches;
      html.dataset.theme = dark ? 'light' : 'dark';
      try { root.localStorage.setItem('cvforge.theme', html.dataset.theme); } catch (e) { /* ignore */ }
    });

    // Last-chance save when the tab is hidden or closed.
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') persist(false); });
    root.addEventListener('beforeunload', function () { persist(false); });
  }

  function init() {
    try { var th = root.localStorage.getItem('cvforge.theme'); if (th) doc.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }
    var loaded = CVM.profile.load();
    state = loaded.state;
    wire();
    hydrate();
    var tab = 'memory';
    try { tab = root.sessionStorage.getItem('cvforge.tab') || (loaded.fresh ? 'memory' : 'memory'); } catch (e) { /* ignore */ }
    if (['memory', 'job', 'cv', 'history', 'settings'].indexOf(tab) >= 0) showTab(tab);
    if (loaded.recovered) toast('Your saved data was damaged; restored the latest good snapshot.', 'error', 8000);
    if (!CVM.profile.storageAvailable()) toast('This browser blocks local storage — use Export backup to keep your work.', 'error', 8000);
    persist(false);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { U.safe(init, null, 'startup'); });
  else U.safe(init, null, 'startup');
})(window);
