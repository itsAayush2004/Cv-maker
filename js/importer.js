/* Paste an existing CV/LinkedIn "About + Experience" text and get a draft memory.
 * Heuristic, offline, best-effort: you review the result before it is merged. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util;

  var HEADINGS = [
    ['summary', /^(summary|profile|about( me)?|professional summary|objective|career objective)$/i],
    ['experience', /^(experience|work experience|professional experience|employment( history)?|work history|career history)$/i],
    ['projects', /^(projects|personal projects|key projects|portfolio|selected work)$/i],
    ['education', /^(education|academics?|academic background|qualifications)$/i],
    ['skills', /^(skills|technical skills|core skills|key skills|tools|technologies|tech stack|competencies|expertise)$/i],
    ['certifications', /^(certifications?|certificates|licenses|courses)$/i],
    ['achievements', /^(achievements|awards|honou?rs|accomplishments)$/i],
    ['languages', /^(languages)$/i]
  ];

  var DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[\/.-]\d{4}|\d{4})\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[\/.-]\d{4}|\d{4}|present|current|now)/i;

  function parse(text) {
    var p = CVM.profile.emptyProfile();
    var lines = U.str(text, 60000).replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); });
    var nonEmpty = lines.filter(function (l) { return l.trim(); });
    if (!nonEmpty.length) return p;

    var all = lines.join('\n');
    var email = all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (email) p.basics.email = email[0];
    var phone = all.match(/(\+?\d[\d\s().-]{7,}\d)/);
    if (phone) p.basics.phone = phone[1].trim();
    (all.match(/(https?:\/\/[^\s|,]+|(?:www\.)?(?:linkedin\.com|github\.com|behance\.net|dribbble\.com|youtube\.com|artstation\.com)\/[^\s|,]+)/gi) || []).slice(0, 5)
      .forEach(function (u) { p.basics.links.push({ label: labelFor(u), url: u }); });
    p.basics.name = nonEmpty[0].trim().length < 60 && !/@|\d{4}/.test(nonEmpty[0]) ? nonEmpty[0].trim() : '';
    if (nonEmpty[1] && nonEmpty[1].length < 90 && !/@|\+?\d{6,}/.test(nonEmpty[1]) && !headingOf(nonEmpty[1])) p.basics.headline = nonEmpty[1].trim();

    var section = null, buckets = {};
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { (buckets[section] = buckets[section] || []).push(''); return; }
      var h = headingOf(line);
      if (h) { section = h; buckets[section] = buckets[section] || []; return; }
      if (section) buckets[section].push(line);
    });

    p.summary = (buckets.summary || []).filter(Boolean).join(' ').slice(0, 1500);
    p.skills = U.unique((buckets.skills || []).join(',').split(/[,;|•·\n]/).map(function (s) {
      return s.replace(/^[^:]{1,30}:\s*/, '').trim();
    }).filter(function (s) { return s && s.length < 40; })).map(function (s) { return { name: s, level: '', years: '' }; });
    p.experience = blocks(buckets.experience).map(function (b) { return toEntry(b, 'exp'); }).filter(Boolean);
    p.projects = blocks(buckets.projects).map(function (b) {
      var e = toEntry(b, 'prj');
      return e && { name: e.role || e.company, role: e.role && e.company ? e.company : '', link: '', start: e.start, end: e.end, bullets: e.bullets, tech: [] };
    }).filter(Boolean);
    p.education = blocks(buckets.education).map(function (b) {
      var e = toEntry(b, 'edu');
      return e && { school: e.company || e.role, degree: e.company ? e.role : '', field: '', start: e.start, end: e.end, grade: '', details: e.bullets };
    }).filter(Boolean);
    p.certifications = (buckets.certifications || []).filter(Boolean).map(function (l) { return { name: stripBullet(l), issuer: '', date: '' }; });
    p.achievements = (buckets.achievements || []).filter(Boolean).map(stripBullet);
    p.languages = (buckets.languages || []).join(',').split(/[,;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
    return CVM.profile.normalize(p);
  }

  function labelFor(u) {
    var m = u.match(/(linkedin|github|behance|dribbble|youtube|artstation)/i);
    return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : 'Website';
  }

  function headingOf(line) {
    var t = line.replace(/[:#*_\-=]+$/g, '').replace(/^[#*_\s]+/, '').trim();
    if (t.length > 40) return null;
    for (var i = 0; i < HEADINGS.length; i++) if (HEADINGS[i][1].test(t)) return HEADINGS[i][0];
    return null;
  }

  function isBullet(l) { return /^\s*[-•*▪●◦·–]\s+/.test(l); }
  function stripBullet(l) { return l.replace(/^\s*[-•*▪●◦·–]\s+/, '').trim(); }

  /** Split a section into entries: a new entry starts at a non-bullet line after bullets, or at a blank line. */
  function blocks(lines) {
    var out = [], cur = null, sawBullet = false;
    U.arr(lines).forEach(function (l) {
      if (!l) { if (cur && cur.length) { out.push(cur); cur = null; sawBullet = false; } return; }
      if (!isBullet(l) && cur && sawBullet) { out.push(cur); cur = null; sawBullet = false; }
      if (!cur) cur = [];
      cur.push(l);
      if (isBullet(l)) sawBullet = true;
    });
    if (cur && cur.length) out.push(cur);
    return out;
  }

  function toEntry(block, kind) {
    var head = block.filter(function (l) { return !isBullet(l); });
    var bullets = block.filter(isBullet).map(stripBullet);
    var start = '', end = '', current = false;
    var headText = head.join(' | ');
    var dr = headText.match(DATE_RANGE);
    if (dr) {
      start = dr[1]; end = dr[2];
      if (/present|current|now/i.test(end)) { current = true; end = ''; }
      headText = headText.replace(dr[0], '');
    }
    var parts = headText.split(/\s*(?:\||—|–| - | at | @ |,(?=\s*[A-Z]))\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    // Non-bullet lines beyond the first two are usually descriptions.
    if (head.length > 2 && !bullets.length) bullets = head.slice(2);
    if (!parts.length && !bullets.length) return null;
    return { role: parts[0] || '', company: parts[1] || '', location: parts[2] && parts[2].length < 40 ? parts[2] : '', start: start, end: end, current: current, bullets: bullets, tech: [] };
  }

  /** Merge an imported profile into the existing memory without losing anything. */
  function merge(base, incoming) {
    var a = CVM.profile.normalize(base), b = CVM.profile.normalize(incoming);
    Object.keys(a.basics).forEach(function (k) { if (k !== 'links' && !a.basics[k] && b.basics[k]) a.basics[k] = b.basics[k]; });
    b.basics.links.forEach(function (l) { if (!a.basics.links.some(function (x) { return x.url === l.url; })) a.basics.links.push(l); });
    if (!a.summary) a.summary = b.summary;
    var names = a.skills.map(function (s) { return s.name.toLowerCase(); });
    b.skills.forEach(function (s) { if (names.indexOf(s.name.toLowerCase()) < 0) a.skills.push(s); });
    function key(e) { return (U.str(e.role || e.name || e.degree) + '|' + U.str(e.company || e.school)).toLowerCase(); }
    ['experience', 'projects', 'education'].forEach(function (sec) {
      b[sec].forEach(function (e) {
        var same = a[sec].filter(function (x) { return key(x) === key(e); })[0];
        if (!same) a[sec].push(e);
        else if (same.bullets) e.bullets.forEach(function (bl) { if (same.bullets.indexOf(bl) < 0) same.bullets.push(bl); });
      });
    });
    b.certifications.forEach(function (c) { if (!a.certifications.some(function (x) { return x.name === c.name; })) a.certifications.push(c); });
    a.achievements = U.unique(a.achievements.concat(b.achievements));
    a.languages = U.unique(a.languages.concat(b.languages));
    if (b.memoryNotes && a.memoryNotes.indexOf(b.memoryNotes) < 0) a.memoryNotes = (a.memoryNotes + '\n' + b.memoryNotes).trim();
    return CVM.profile.normalize(a);
  }

  CVM.importer = { parse: parse, merge: merge };
})(typeof window !== 'undefined' ? window : globalThis);
