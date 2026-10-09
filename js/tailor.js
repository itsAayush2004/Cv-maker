/* Tailoring engine: turns the master profile + a job analysis into a one-job CV.
 * Rules it follows (from ATS/recruiter guidance):
 *  - Only uses facts that exist in your memory. It never invents skills, employers, dates or numbers.
 *  - Reorders bullets so the most job-relevant (and quantified) ones come first; trims older roles.
 *  - Lists matched skills first, using the job post's own spelling of each term.
 *  - Mirrors the target job title in the headline when your memory supports it.
 *  - Reports gaps (keywords you don't have) so you can decide — honestly — what to add. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util, DB = CVM.skillsDb;

  function keywordAliases(k) {
    if (k.category === 'title' || k.category === 'phrase' || k.inferred) return [k.term];
    return U.unique(DB.aliasesOf(k.term).concat([k.display]));
  }

  /** Does text contain keyword k (under any alias)? Uses the same rules as job analysis. */
  function textHas(text, k) {
    if (!text) return false;
    if (k.category === 'title') return titleSimilarity(text, k.term) >= 0.67;
    if (k.category === 'phrase' || k.inferred) return U.hasTerm(text, k.term);
    if (DB.findSkills(text).some(function (s) { return s.name === k.term; })) return true;
    return k.display && k.display !== k.term && U.hasTerm(text, k.display);
  }

  function titleWords(t) {
    return U.words(t).filter(function (w) { return w.length > 1 && !/^(of|and|the|for|at|in|a|an|to|with|i|ii|iii|jr|sr)$/.test(w); });
  }

  function titleSimilarity(text, title) {
    var tw = titleWords(title);
    if (!tw.length) return 0;
    var lower = U.str(text).toLowerCase();
    var hit = tw.filter(function (w) { return U.hasTerm(lower, w); }).length;
    return hit / tw.length;
  }

  // ---------------- evidence: what does the profile prove you have? ----------------
  function profileCorpus(p) {
    var parts = [p.basics.headline, p.summary, p.memoryNotes];
    p.skills.forEach(function (s) { parts.push(s.name); });
    p.experience.forEach(function (e) { parts.push(e.role, e.company, e.bullets.join('\n'), e.tech.join(', ')); });
    p.projects.forEach(function (e) { parts.push(e.name, e.role, e.bullets.join('\n'), e.tech.join(', ')); });
    p.education.forEach(function (e) { parts.push(e.degree, e.field, e.details.join('\n')); });
    p.certifications.forEach(function (c) { parts.push(c.name, c.issuer); });
    p.achievements.forEach(function (a) { parts.push(a); });
    return parts.filter(Boolean).join('\n');
  }

  // ---------------- bullet scoring ----------------
  var METRIC_RE = /(\d+(\.\d+)?\s*(%|x\b|k\b|m\b|\+)|[$₹€£]\s?\d|\b\d{2,}\b|\b(doubled|tripled|halved)\b)/i;

  function scoreBullet(text, ctxTech, keywords) {
    var score = 0, hits = [];
    keywords.forEach(function (k) {
      if (k.category === 'title') return;
      if (textHas(text, k)) { score += k.weight; hits.push(k.term); }
      else if (ctxTech && textHas(ctxTech, k)) score += k.weight * 0.15;
    });
    if (METRIC_RE.test(text)) score += 2.5;
    var first = U.words(text)[0] || '';
    if (DB.ACTION_VERBS.indexOf(first) >= 0) score += 1;
    var len = U.words(text).length;
    if (len < 6) score -= 1;
    if (len > 40) score -= 1.5;
    return { score: score, hits: hits };
  }

  function rankBullets(bullets, tech, keywords, max) {
    var ctx = U.arr(tech).join(', ');
    var scored = bullets.map(function (b, i) {
      var s = scoreBullet(b, ctx, keywords);
      return { text: b, score: s.score, hits: s.hits, idx: i };
    });
    scored.sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
    return scored.slice(0, max);
  }

  var SENIORITY_RE = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|intern|associate|entry[\s-]level|mid[\s-]level|i{1,3})\b\s*/gi;

  // ---------------- experience timeline ----------------
  function totalYears(p, now) {
    var months = Object.create(null);
    p.experience.forEach(function (e) {
      var a = U.parseDate(e.start);
      if (!a || a.present) return;
      var n = U.monthsBetween(e.start, e.end, e.current, now);
      var y = a.y, m = a.m || 1;
      for (var i = 0; i < n; i++) {
        months[y * 12 + m] = 1;
        m++; if (m > 12) { m = 1; y++; }
      }
    });
    return Math.floor(Object.keys(months).length / 12);
  }

  function sortByRecency(list) {
    function key(e) {
      if (e.current) return 999999;
      var d = U.parseDate(e.end) || U.parseDate(e.start);
      return d && !d.present ? d.y * 12 + (d.m || 6) : (d && d.present ? 999999 : 0);
    }
    return list.slice().sort(function (a, b) { return key(b) - key(a); });
  }

  // ---------------- skills ----------------
  function buildSkills(p, analysis, corpus) {
    var keywords = analysis.keywords || [];
    var picked = [], seen = Object.create(null);
    function add(name, category, matched) {
      var c = DB.canonical(name), k = c.toLowerCase();
      if (!c || seen[k]) return;
      seen[k] = 1;
      picked.push({ name: name, canonical: c, category: category || DB.categoryOf(c), matched: !!matched });
    }
    // 1. JD keywords you have evidence for — written the way the job post writes them.
    keywords.forEach(function (k) {
      if (k.category === 'title' || k.category === 'phrase' || k.category === 'soft') return;
      if (textHas(corpus, k)) add(k.display || k.term, k.category === 'tool' && k.inferred ? 'tool' : k.category, true);
    });
    // 2. Your remaining listed skills (dictionary-known first, they're searchable keywords).
    var rest = p.skills.map(function (s) { return s.name; });
    rest.sort(function (a, b) { return (DB.categoryOf(a) === 'phrase') - (DB.categoryOf(b) === 'phrase'); });
    rest.forEach(function (s) { add(s, null, false); });
    // 3. Soft skills only when the job asks for them and you have evidence.
    var soft = keywords.filter(function (k) { return k.category === 'soft' && textHas(corpus, k); }).map(function (k) { return k.term; });

    var groups = { 'Languages & Frameworks': [], 'Tools & Platforms': [], 'Expertise': [] };
    picked.forEach(function (s) {
      var g = s.category === 'language' || s.category === 'framework' ? 'Languages & Frameworks'
        : s.category === 'tool' ? 'Tools & Platforms' : s.category === 'soft' ? null : 'Expertise';
      if (g) groups[g].push(s);
    });
    var out = [];
    Object.keys(groups).forEach(function (g) {
      // Matched first, then the rest; cap so the section stays scannable.
      var items = groups[g].filter(function (s) { return s.matched; }).concat(groups[g].filter(function (s) { return !s.matched; }));
      if (items.length) out.push({ group: g, items: items.slice(0, 14).map(function (s) { return s.name; }) });
    });
    if (soft.length) out.push({ group: 'Strengths', items: soft.slice(0, 6) });
    return out;
  }

  // ---------------- summary ----------------
  function buildSummary(p, analysis, ctx) {
    var years = ctx.years;
    var role = ctx.headline || p.basics.headline || 'Professional';
    var matchedTop = ctx.matchedSkills.slice(0, 4);
    var parts = [];
    var lead = role;
    if (years >= 1) lead += ' with ' + years + '+ year' + (years > 1 ? 's' : '') + ' of experience' + (matchedTop.length ? ' in ' + joinNatural(matchedTop) : '');
    else if (matchedTop.length) lead += ' skilled in ' + joinNatural(matchedTop);
    parts.push(lead + '.');
    if (ctx.bestBullet) {
      var b = ctx.bestBullet.replace(/[.;\s]+$/, '');
      parts.push(b.charAt(0).toUpperCase() + b.slice(1) + '.');
    }
    if (p.summary) {
      // Keep the strongest sentence of the user's own summary (their voice, their facts).
      var sentences = p.summary.replace(/([.!?])\s+(?=[A-Z])/g, '$1\u0001').split('\u0001').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 20; });
      var best = sentences.map(function (s) {
        return { s: s, score: (analysis.keywords || []).reduce(function (acc, k) { return acc + (textHas(s, k) ? k.weight : 0); }, 0) };
      }).sort(function (a, b) { return b.score - a.score; })[0];
      if (best && parts.join(' ').indexOf(best.s) < 0) parts.push(best.s.replace(/\s+$/, ''));
    }
    return parts.join(' ').replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();
  }

  function joinNatural(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  /** Build the tailored CV model. options = settings (maxBulletsRecent, maxBulletsOlder, maxProjects, mirrorTitle, includeProjects). */
  function tailor(profile, analysis, options) {
    var p = CVM.profile.normalize(profile);
    var a = analysis && !analysis.empty ? analysis : { keywords: [], title: '', company: '', empty: true };
    var o = options || {};
    var keywords = a.keywords || [];
    var corpus = profileCorpus(p);
    var years = totalYears(p);

    // Headline: mirror the target title only if your memory backs it up (same field of work).
    // Seniority words ("Senior", "Lead"…) are only kept if one of your own titles already uses them.
    var headline = p.basics.headline;
    var titleNote = '';
    if (o.mirrorTitle !== false && a.title) {
      var ownTitles = [p.basics.headline].concat(p.experience.map(function (e) { return e.role; })).join(' ');
      var target = a.title.replace(SENIORITY_RE, function (w) { return U.hasTerm(ownTitles, w.trim()) ? w : ' '; }).replace(/\s+/g, ' ').trim();
      var evidence = ownTitles + ' ' + p.skills.map(function (s) { return s.name; }).join(' ');
      var sim = titleSimilarity(evidence, target);
      if (target && sim >= 0.6) {
        headline = target;
        titleNote = 'Headline set to "' + target + '" to mirror the job title (your memory supports it).';
      } else {
        titleNote = 'Kept your own headline — your memory doesn\'t clearly support "' + a.title + '". Add a matching role or headline in memory if accurate.';
      }
    }

    var exps = sortByRecency(p.experience);
    var allBullets = [];
    var experience = exps.map(function (e, i) {
      var max = i < 2 ? (o.maxBulletsRecent || 5) : (o.maxBulletsOlder || 3);
      var ranked = a.empty ? e.bullets.slice(0, max).map(function (t) { return { text: t, score: 0, hits: [] }; }) : rankBullets(e.bullets, e.tech, keywords, max);
      ranked.forEach(function (r) { allBullets.push(r); });
      return {
        role: e.role, company: e.company, location: e.location,
        dates: U.dateRange(e.start, e.end, e.current),
        bullets: ranked.map(function (r) { return r.text; }),
        relevance: ranked.reduce(function (s, r) { return s + Math.max(r.score, 0); }, 0)
      };
    });

    var projects = [];
    if (o.includeProjects !== false && (o.maxProjects === undefined || o.maxProjects > 0)) {
      projects = p.projects.map(function (pr) {
        var ranked = a.empty ? pr.bullets.slice(0, 3).map(function (t) { return { text: t, score: 0, hits: [] }; }) : rankBullets(pr.bullets, pr.tech, keywords, 3);
        var techScore = 0;
        keywords.forEach(function (k) { if (k.category !== 'title' && textHas(pr.tech.join(', ') + ' ' + pr.name, k)) techScore += k.weight * 0.5; });
        return {
          name: pr.name, role: pr.role, link: pr.link, dates: U.dateRange(pr.start, pr.end, false),
          tech: pr.tech, bullets: ranked.map(function (r) { return r.text; }), _ranked: ranked,
          relevance: ranked.reduce(function (s, r) { return s + Math.max(r.score, 0); }, 0) + techScore
        };
      });
      projects.sort(function (x, y) { return y.relevance - x.relevance; });
      projects = projects.slice(0, o.maxProjects === undefined ? 3 : o.maxProjects);
      projects.forEach(function (pr) { pr._ranked.forEach(function (r) { allBullets.push(r); }); delete pr._ranked; });
    }

    var skills = buildSkills(p, a, corpus);
    var matchedSkills = [];
    skills.forEach(function (g) { if (g.group !== 'Strengths') g.items.forEach(function (s) { if (keywords.some(function (k) { return (k.display === s || k.term === DB.canonical(s)); })) matchedSkills.push(s); }); });
    if (!matchedSkills.length && skills.length) matchedSkills = skills[0].items.slice(0, 3);

    allBullets.sort(function (x, y) { return y.score - x.score; });
    var best = allBullets.filter(function (b) { return METRIC_RE.test(b.text) && U.words(b.text).length <= 28; })[0];

    var summary = a.empty && p.summary ? p.summary : buildSummary(p, a, { years: years, headline: headline, matchedSkills: matchedSkills, bestBullet: best && best.text });
    if (!p.summary && !p.experience.length && !p.projects.length) summary = '';

    var cv = {
      meta: { jobTitle: a.title || '', company: a.company || '', generatedAt: new Date().toISOString(), titleNote: titleNote, engine: 'offline' },
      basics: { name: p.basics.name, headline: headline, email: p.basics.email, phone: p.basics.phone, location: p.basics.location, links: p.basics.links.slice(0, 4) },
      summary: summary,
      skills: skills,
      experience: experience.map(function (e) { delete e.relevance; return e; }),
      projects: projects.map(function (pr) { delete pr.relevance; return pr; }),
      education: p.education.map(function (e) {
        return { school: e.school, degree: [e.degree, e.field].filter(Boolean).join(', '), dates: U.dateRange(e.start, e.end, false), grade: e.grade, details: e.details.slice(0, 2) };
      }),
      certifications: p.certifications.map(function (c) {
        return { name: c.name, issuer: c.issuer, date: U.formatDate(c.date) };
      }),
      achievements: a.empty ? p.achievements.slice(0, 4) : rankBullets(p.achievements, [], keywords, 4).map(function (r) { return r.text; }),
      languages: p.languages
    };
    return cv;
  }

  // ---------------- plain text of a CV (what an ATS "sees") ----------------
  function cvText(cv) {
    var lines = [cv.basics.name, cv.basics.headline, [cv.basics.email, cv.basics.phone, cv.basics.location].filter(Boolean).join(' | ')];
    cv.basics.links.forEach(function (l) { lines.push(l.url); });
    if (cv.summary) lines.push('SUMMARY', cv.summary);
    if (cv.skills.length) { lines.push('SKILLS'); cv.skills.forEach(function (g) { lines.push(g.group + ': ' + g.items.join(', ')); }); }
    if (cv.experience.length) {
      lines.push('EXPERIENCE');
      cv.experience.forEach(function (e) { lines.push(e.role + ' — ' + e.company + (e.location ? ', ' + e.location : ''), e.dates); e.bullets.forEach(function (b) { lines.push('• ' + b); }); });
    }
    if (cv.projects.length) {
      lines.push('PROJECTS');
      cv.projects.forEach(function (pr) { lines.push(pr.name + (pr.role ? ' — ' + pr.role : '') + (pr.tech.length ? ' | ' + pr.tech.join(', ') : ''), pr.link, pr.dates); pr.bullets.forEach(function (b) { lines.push('• ' + b); }); });
    }
    if (cv.education.length) {
      lines.push('EDUCATION');
      cv.education.forEach(function (e) { lines.push(e.degree + ' — ' + e.school, e.dates, e.grade); e.details.forEach(function (d) { lines.push('• ' + d); }); });
    }
    if (cv.certifications.length) { lines.push('CERTIFICATIONS'); cv.certifications.forEach(function (c) { lines.push([c.name, c.issuer, c.date].filter(Boolean).join(' — ')); }); }
    if (cv.achievements.length) { lines.push('ACHIEVEMENTS'); cv.achievements.forEach(function (a) { lines.push('• ' + a); }); }
    if (cv.languages.length) { lines.push('LANGUAGES', cv.languages.join(', ')); }
    return lines.filter(function (l) { return l !== undefined && l !== null && String(l).trim() !== ''; }).join('\n');
  }

  // ---------------- match score + gap report ----------------
  function match(cv, analysis, profile) {
    var text = cvText(cv);
    var corpus = profile ? profileCorpus(CVM.profile.normalize(profile)) : text;
    var keywords = (analysis && analysis.keywords) || [];
    var total = 0, got = 0;
    var matched = [], missingButYouHave = [], gaps = [];
    keywords.forEach(function (k) {
      var w = k.priority === 'nice' ? k.weight * 0.6 : k.weight;
      total += w;
      if (textHas(text, k)) { got += w; matched.push(k); }
      else if (textHas(corpus, k)) missingButYouHave.push(k);
      else gaps.push(k);
    });
    var coverage = total ? Math.round(got / total * 100) : 0;
    var mustTotal = keywords.filter(function (k) { return k.priority === 'must'; });
    var mustGot = mustTotal.filter(function (k) { return matched.indexOf(k) >= 0; });
    return {
      coverage: coverage,
      mustHave: { got: mustGot.length, total: mustTotal.length },
      matched: matched, unused: missingButYouHave, gaps: gaps
    };
  }

  // ---------------- ATS format / content checks ----------------
  function checks(cv, analysis, settings) {
    var out = [];
    function add(status, label, detail) { out.push({ status: status, label: label, detail: detail || '' }); }
    var b = cv.basics;
    add(b.name ? 'pass' : 'fail', 'Name at the top', b.name ? '' : 'Add your name in My Memory → Basics.');
    add(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) ? 'pass' : 'fail', 'Valid email in the body (not a header/footer)', b.email ? '' : 'ATS tools pull contact details from the body text.');
    add(b.phone ? 'pass' : 'warn', 'Phone number', b.phone ? '' : 'Most recruiters expect a phone number.');
    add(b.location ? 'pass' : 'warn', 'Location (city, country)', b.location ? '' : 'Many ATS filters search by location.');
    add('pass', 'Single-column layout, standard headings, real text (no tables/images/icons)', 'Built-in: every template is ATS-safe.');

    var bullets = [];
    cv.experience.forEach(function (e) { bullets = bullets.concat(e.bullets); });
    cv.projects.forEach(function (p) { bullets = bullets.concat(p.bullets); });
    if (bullets.length) {
      var quantified = bullets.filter(function (x) { return METRIC_RE.test(x); }).length;
      var ratio = quantified / bullets.length;
      add(ratio >= 0.4 ? 'pass' : ratio >= 0.2 ? 'warn' : 'fail', 'Quantified impact (' + quantified + '/' + bullets.length + ' bullets have numbers)',
        ratio >= 0.4 ? '' : 'Add real numbers to bullets in memory: users, %, time saved, revenue, views, downloads.');
      var weak = bullets.filter(function (x) { var l = x.toLowerCase(); return DB.WEAK_STARTS.some(function (w) { return l.indexOf(w) === 0; }); });
      add(weak.length ? 'warn' : 'pass', 'Bullets start with strong action verbs', weak.length ? weak.length + ' start weakly, e.g. "' + weak[0].slice(0, 60) + '…" → try Built / Led / Shipped / Grew.' : '');
      var pronouns = bullets.filter(function (x) { return /\b(I|my|me)\b/.test(x); });
      add(pronouns.length ? 'warn' : 'pass', 'No first-person pronouns in bullets', pronouns.length ? pronouns.length + ' bullet(s) use I/my/me.' : '');
      var long = bullets.filter(function (x) { return U.words(x).length > 35; });
      add(long.length ? 'warn' : 'pass', 'Bullets are 1–2 lines', long.length ? long.length + ' bullet(s) are over 35 words.' : '');
    } else {
      add('fail', 'Experience or project bullets', 'Add at least one role or project with bullet points in memory.');
    }

    var words = U.words(cvText(cv)).length;
    add(words >= 250 && words <= 900 ? 'pass' : 'warn', 'Length: ' + words + ' words', words < 250 ? 'Thin — add more detail to memory.' : words > 900 ? 'Long — lower "bullets per role" in Settings for a tighter 1–2 pages.' : '');

    var dateIssues = cv.experience.filter(function (e) { return !e.dates; }).length;
    add(dateIssues ? 'warn' : 'pass', 'Dates on every role (consistent "Mon YYYY" format)', dateIssues ? dateIssues + ' role(s) have no dates.' : '');

    if (analysis && !analysis.empty) {
      var text = cvText(cv);
      var stuffed = (analysis.keywords || []).filter(function (k) { return k.category !== 'title' && U.countTerm(text, k.display || k.term) > 8; });
      add(stuffed.length ? 'warn' : 'pass', 'No keyword stuffing', stuffed.length ? 'Repeated a lot: ' + stuffed.map(function (k) { return k.term; }).join(', ') : '');
      if (analysis.title) {
        var sim = titleSimilarity(b.headline, analysis.title);
        add(sim >= 0.67 ? 'pass' : 'warn', 'Headline matches the job title', sim >= 0.67 ? '' : 'Recruiters search by title. Target: "' + analysis.title + '".');
      }
      if (analysis.yearsRequired) {
        var yrs = cv._years;
        if (typeof yrs === 'number') add(yrs >= analysis.yearsRequired ? 'pass' : 'warn', 'Experience: job asks ' + analysis.yearsRequired + '+ years', yrs >= analysis.yearsRequired ? 'You show ~' + yrs + ' years.' : 'Your dated roles show ~' + yrs + ' years — emphasise projects/freelance work if relevant.');
      }
    }
    add('info', 'File: submit .docx or text-based PDF named "' + U.slug(b.name || 'Your_Name') + '_CV.pdf"', 'Both exports here produce selectable text. Prefer .docx if the portal says "Word".');
    return out;
  }

  /** Combined 0-100 ATS score: 70% keyword coverage, 30% format/content checks. */
  function atsScore(matchResult, checkList) {
    var graded = checkList.filter(function (c) { return c.status !== 'info'; });
    var pts = graded.reduce(function (s, c) { return s + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0); }, 0);
    var fmt = graded.length ? pts / graded.length * 100 : 0;
    return Math.round(matchResult.coverage * 0.7 + fmt * 0.3);
  }

  /** One call does it all. Never throws: returns {cv, match, checks, score}. */
  function run(profile, jdText, settings) {
    var analysis = CVM.analyzer.analyze(jdText);
    var cv = tailor(profile, analysis, settings);
    return evaluate(cv, analysis, profile, settings);
  }

  /** Score any CV (offline- or AI-generated) against an analysis. */
  function evaluate(cv, analysis, profile, settings) {
    cv._years = totalYears(CVM.profile.normalize(profile));
    var m = match(cv, analysis, profile);
    var c = checks(cv, analysis, settings);
    return { analysis: analysis, cv: cv, match: m, checks: c, score: atsScore(m, c) };
  }

  CVM.tailor = {
    run: run, evaluate: evaluate, tailor: tailor, match: match, checks: checks, atsScore: atsScore, cvText: cvText,
    totalYears: totalYears, textHas: textHas, profileCorpus: profileCorpus, METRIC_RE: METRIC_RE
  };
})(typeof window !== 'undefined' ? window : globalThis);
