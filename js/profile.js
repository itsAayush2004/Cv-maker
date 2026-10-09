/* The "memory": one master profile holding everything about you, plus a history of tailored applications.
 * normalize() repairs any shape of input (old versions, hand-edited JSON, partial imports) into a valid
 * profile, so a bad file can never break the app. Storage keeps rolling backups and survives quota errors. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util;

  var SCHEMA_VERSION = 2;
  var KEY = 'cvforge.v2.state';
  var BACKUP_KEY = 'cvforge.v2.backups';
  var MAX_BACKUPS = 15;
  var MAX_HISTORY = 100;

  function emptyProfile() {
    return {
      basics: { name: '', headline: '', email: '', phone: '', location: '', links: [] },
      summary: '',
      skills: [],
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      achievements: [],
      languages: [],
      memoryNotes: '',
      updatedAt: null
    };
  }

  function bulletList(v) {
    // Accept ["a","b"], [{text:"a"}], or "a\nb".
    if (typeof v === 'string') v = v.split(/\r?\n/);
    return U.arr(v).map(function (b) {
      var t = typeof b === 'string' ? b : (b && typeof b === 'object' ? b.text : '');
      return U.str(t, 600).replace(/^\s*[-•*▪●◦·]\s*/, '').trim();
    }).filter(Boolean).slice(0, 40);
  }

  function strList(v, max) {
    if (typeof v === 'string') v = v.split(/[,\n;]/);
    return U.unique(U.arr(v).map(function (x) {
      return U.str(typeof x === 'object' && x ? (x.name || x.text) : x, max || 120).trim();
    }).filter(Boolean));
  }

  function normSkill(s) {
    if (typeof s === 'string') s = { name: s };
    if (!s || typeof s !== 'object') return null;
    var name = U.str(s.name, 80).trim();
    if (!name) return null;
    return { name: name, level: U.str(s.level, 30).trim(), years: U.str(s.years, 10).trim() };
  }

  function normExperience(e) {
    if (!e || typeof e !== 'object') return null;
    var out = {
      id: U.str(e.id, 60) || U.uid('exp'),
      role: U.str(e.role || e.title || e.position, 140).trim(),
      company: U.str(e.company || e.organization || e.employer, 140).trim(),
      location: U.str(e.location, 100).trim(),
      start: U.str(e.start || e.startDate, 30).trim(),
      end: U.str(e.end || e.endDate, 30).trim(),
      current: !!e.current || /present|current/i.test(U.str(e.end || e.endDate)),
      bullets: bulletList(e.bullets || e.highlights || e.description),
      tech: strList(e.tech || e.skills || e.keywords, 60)
    };
    if (out.current) out.end = '';
    return out.role || out.company || out.bullets.length ? out : null;
  }

  function normProject(p) {
    if (!p || typeof p !== 'object') return null;
    var out = {
      id: U.str(p.id, 60) || U.uid('prj'),
      name: U.str(p.name || p.title, 140).trim(),
      role: U.str(p.role, 100).trim(),
      link: U.str(p.link || p.url, 300).trim(),
      start: U.str(p.start || p.startDate, 30).trim(),
      end: U.str(p.end || p.endDate, 30).trim(),
      bullets: bulletList(p.bullets || p.highlights || p.description),
      tech: strList(p.tech || p.skills || p.keywords, 60)
    };
    return out.name || out.bullets.length ? out : null;
  }

  function normEducation(e) {
    if (!e || typeof e !== 'object') return null;
    var out = {
      id: U.str(e.id, 60) || U.uid('edu'),
      school: U.str(e.school || e.institution, 160).trim(),
      degree: U.str(e.degree || e.studyType, 140).trim(),
      field: U.str(e.field || e.area, 140).trim(),
      start: U.str(e.start || e.startDate, 30).trim(),
      end: U.str(e.end || e.endDate, 30).trim(),
      grade: U.str(e.grade || e.score || e.gpa, 40).trim(),
      details: bulletList(e.details || e.courses)
    };
    return out.school || out.degree ? out : null;
  }

  function normCert(c) {
    if (typeof c === 'string') c = { name: c };
    if (!c || typeof c !== 'object') return null;
    var out = { name: U.str(c.name || c.title, 160).trim(), issuer: U.str(c.issuer, 120).trim(), date: U.str(c.date, 30).trim() };
    return out.name ? out : null;
  }

  function normLink(l) {
    if (typeof l === 'string') l = { url: l };
    if (!l || typeof l !== 'object') return null;
    var url = U.str(l.url, 300).trim();
    if (!url) return null;
    return { label: U.str(l.label || l.network, 40).trim(), url: url };
  }

  function compact(list, fn, max) {
    return U.arr(list).map(function (x) { return U.safe(function () { return fn(x); }, null, 'normalize'); })
      .filter(Boolean).slice(0, max || 60);
  }

  /** Coerce anything (including JSON Resume format) into a valid profile. Never throws. */
  function normalize(input) {
    var p = emptyProfile();
    if (!input || typeof input !== 'object') return p;
    var b = input.basics || {};
    p.basics.name = U.str(b.name, 120).trim();
    p.basics.headline = U.str(b.headline || b.label, 160).trim();
    p.basics.email = U.str(b.email, 160).trim();
    p.basics.phone = U.str(b.phone, 60).trim();
    var loc = b.location;
    p.basics.location = U.str(typeof loc === 'object' && loc ? [loc.city, loc.region, loc.countryCode].filter(Boolean).join(', ') : loc, 120).trim();
    var links = U.arr(b.links).concat(U.arr(b.profiles));
    if (b.url) links.unshift({ label: 'Website', url: b.url });
    p.basics.links = compact(links, normLink, 8);
    p.summary = U.str(input.summary || b.summary, 2000).trim();
    p.skills = compact(flattenSkills(input.skills), normSkill, 120);
    var seen = Object.create(null);
    p.skills = p.skills.filter(function (s) { var k = s.name.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
    p.experience = compact(input.experience || input.work, normExperience, 30);
    p.projects = compact(input.projects, normProject, 40);
    p.education = compact(input.education, normEducation, 12);
    p.certifications = compact(input.certifications || input.certificates, normCert, 30);
    p.achievements = bulletList(input.achievements || input.awards && U.arr(input.awards).map(function (a) { return a && (a.title || a); }));
    p.languages = strList(U.arr(input.languages).map(function (l) {
      return typeof l === 'object' && l ? [l.language || l.name, l.fluency].filter(Boolean).join(' (') + (l.fluency ? ')' : '') : l;
    }), 60);
    p.memoryNotes = U.str(input.memoryNotes, 20000);
    p.updatedAt = U.str(input.updatedAt, 40) || null;
    return p;
  }

  function flattenSkills(skills) {
    // JSON Resume: [{name:"Web", keywords:["HTML","CSS"]}] → flat list.
    var out = [];
    U.arr(typeof skills === 'string' ? skills.split(/[,\n]/) : skills).forEach(function (s) {
      if (s && typeof s === 'object' && Array.isArray(s.keywords) && s.keywords.length) {
        s.keywords.forEach(function (k) { out.push({ name: k, level: s.level }); });
      } else out.push(s);
    });
    return out;
  }

  function emptyState() {
    return { version: SCHEMA_VERSION, profile: emptyProfile(), job: { text: '', url: '' }, history: [], settings: defaultSettings() };
  }

  function defaultSettings() {
    return {
      pageSize: 'A4', template: 'classic', maxBulletsRecent: 5, maxBulletsOlder: 3, maxProjects: 3,
      mirrorTitle: true, includeProjects: true, aiEnabled: false, aiModel: 'claude-opus-5-5', aiResearch: true
    };
  }

  function normalizeState(s) {
    var st = emptyState();
    if (!s || typeof s !== 'object') return st;
    st.profile = normalize(s.profile);
    st.job = { text: U.str(s.job && s.job.text, 60000), url: U.str(s.job && s.job.url, 500) };
    st.history = U.arr(s.history).filter(function (h) { return h && typeof h === 'object' && h.id; }).slice(0, MAX_HISTORY).map(function (h) {
      return {
        id: U.str(h.id, 60), date: U.str(h.date, 40), title: U.str(h.title, 160), company: U.str(h.company, 160),
        score: U.clamp(h.score, 0, 100), status: U.str(h.status, 30) || 'drafted', jobText: U.str(h.jobText, 60000),
        cv: h.cv && typeof h.cv === 'object' ? h.cv : null, notes: U.str(h.notes, 4000)
      };
    });
    var d = defaultSettings(), cfg = s.settings || {};
    Object.keys(d).forEach(function (k) {
      if (cfg[k] !== undefined && typeof cfg[k] === typeof d[k]) st.settings[k] = cfg[k];
    });
    st.settings.maxBulletsRecent = U.clamp(st.settings.maxBulletsRecent, 1, 10);
    st.settings.maxBulletsOlder = U.clamp(st.settings.maxBulletsOlder, 1, 10);
    st.settings.maxProjects = U.clamp(st.settings.maxProjects, 0, 8);
    if (['A4', 'Letter'].indexOf(st.settings.pageSize) < 0) st.settings.pageSize = 'A4';
    if (['classic', 'compact', 'modern'].indexOf(st.settings.template) < 0) st.settings.template = 'classic';
    return st;
  }

  // ---------- storage (localStorage when available, in-memory otherwise) ----------
  var memoryFallback = {};
  var storageOk = (function () {
    try {
      var k = '__cvforge_test__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function rawGet(k) {
    if (storageOk) { try { return root.localStorage.getItem(k); } catch (e) { /* fall through */ } }
    return Object.prototype.hasOwnProperty.call(memoryFallback, k) ? memoryFallback[k] : null;
  }

  function rawSet(k, v) {
    memoryFallback[k] = v;
    if (!storageOk) return false;
    try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }

  function load() {
    var raw = rawGet(KEY);
    if (!raw) return { state: emptyState(), recovered: false, fresh: true };
    try {
      return { state: normalizeState(JSON.parse(raw)), recovered: false, fresh: false };
    } catch (e) {
      // Main record corrupted — fall back to the newest readable backup.
      var backups = listBackups();
      for (var i = 0; i < backups.length; i++) {
        try { return { state: normalizeState(JSON.parse(backups[i].data)), recovered: true, fresh: false }; } catch (e2) { /* next */ }
      }
      return { state: emptyState(), recovered: true, fresh: true };
    }
  }

  var lastBackupAt = 0;
  /** Persist state. Returns {ok, persistent}. Takes a backup at most every 2 minutes (or when forced). */
  function save(state, forceBackup) {
    var data;
    try { data = JSON.stringify(state); } catch (e) { return { ok: false, persistent: false }; }
    var ok = rawSet(KEY, data);
    if (!ok && storageOk) {
      // Quota exceeded: drop stored CV snapshots from old history entries and retry once.
      var slim = U.clone(state) || state;
      U.arr(slim.history).forEach(function (h, i) { if (i > 10) { h.cv = null; h.jobText = U.str(h.jobText).slice(0, 2000); } });
      try { ok = rawSet(KEY, JSON.stringify(slim)); } catch (e) { ok = false; }
      if (!ok) { try { root.localStorage.removeItem(BACKUP_KEY); } catch (e) { /* ignore */ } ok = rawSet(KEY, data); }
    }
    var now = Date.now();
    if (ok && (forceBackup || now - lastBackupAt > 120000)) {
      lastBackupAt = now;
      addBackup(data);
    }
    return { ok: true, persistent: ok && storageOk };
  }

  function listBackups() {
    try { return U.arr(JSON.parse(rawGet(BACKUP_KEY) || '[]')).filter(function (b) { return b && b.data; }); } catch (e) { return []; }
  }

  function addBackup(data) {
    var list = listBackups();
    if (list.length && list[0].data === data) return;
    list.unshift({ at: new Date().toISOString(), data: data });
    while (list.length > MAX_BACKUPS) list.pop();
    while (list.length > 1 && !rawSet(BACKUP_KEY, JSON.stringify(list))) list.pop();
  }

  function profileStats(p) {
    var bullets = 0;
    p.experience.forEach(function (e) { bullets += e.bullets.length; });
    p.projects.forEach(function (e) { bullets += e.bullets.length; });
    var checks = [
      !!p.basics.name, !!p.basics.email, !!p.basics.phone, !!p.basics.location, !!p.basics.headline,
      p.skills.length >= 8, p.experience.length + p.projects.length >= 2, bullets >= 8, p.education.length >= 1, p.basics.links.length >= 1
    ];
    var done = checks.filter(Boolean).length;
    return { bullets: bullets, completeness: Math.round(done / checks.length * 100) };
  }

  CVM.profile = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    emptyProfile: emptyProfile,
    emptyState: emptyState,
    defaultSettings: defaultSettings,
    normalize: normalize,
    normalizeState: normalizeState,
    load: load,
    save: save,
    listBackups: listBackups,
    storageAvailable: function () { return storageOk; },
    stats: profileStats
  };
})(typeof window !== 'undefined' ? window : globalThis);
