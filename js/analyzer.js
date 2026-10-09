/* Job description research: pulls out the title, company, seniority, years, education and — most
 * importantly — a weighted list of keywords an ATS will scan for. Required-section terms weigh more
 * than "nice to have" ones; terms in the job title weigh most. Fully offline and deterministic. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util, DB = CVM.skillsDb;

  var MAX_LEN = 60000;

  var SECTION_PATTERNS = [
    { key: 'required', re: /^(requirements?|required|must[\s-]have|what you need|who can apply|candidate requirements|eligibility|key skills|skills and qualifications|who we'?re looking for|minimum qualifications|basic qualifications|what you('| wi)ll (need|bring)|what we('re| are) looking for|who you are|qualifications|skills( required)?|you have|about you|your profile|ideal candidate)\b/i },
    { key: 'preferred', re: /^(strongly preferred|preferred|nice[\s-]to[\s-]have|bonus|pluses|plus|desired|good to have|preferred qualifications|extra credit|it'?s a plus)/i },
    { key: 'responsibilities', re: /^(about the (role|job|position)|responsibilities|what you('| wi)ll do|the role|role overview|your role|duties|key responsibilities|in this role|day[\s-]to[\s-]day|you will)\b/i },
    { key: 'benefits', re: /^(benefits|perks|what we offer|why (join|work)|compensation|salary|we offer)/i },
    { key: 'about', re: /^(about\b|who we are|our (company|mission|story)|company overview)/i }
  ];

  var STOP = ('a an and are as at be but by for from has have in into is it its of on or our that the their this to was we will with ' +
    'you your they them who what when where which while would can could should may might must able also any all both each more most ' +
    'other some such than too very via per etc using use used within across including include includes new well work working job role ' +
    'team teams company candidate candidates experience years year strong ability skills skill knowledge understanding plus preferred ' +
    'required requirements responsibilities qualifications looking join help make like get great good best one two three based level ' +
    'need needs us we\'re you\'ll you\'re ensure etc. e.g. i.e. about across day high highly excellent proven demonstrated equivalent ' +
    'related field degree opportunity environment business support provide providing time full part based remote hybrid office location').split(/\s+/);
  var STOPSET = Object.create(null);
  STOP.forEach(function (w) { STOPSET[w] = 1; });

  function cleanText(t) {
    return U.str(t, MAX_LEN).replace(/\r\n?/g, '\n').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  }

  function splitSections(text) {
    var lines = text.split('\n'), current = 'general', out = [];
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var heading = line.replace(/^[#*\s]+|[:*#\s]+$/g, '');
      var isHeadingLike = heading.length < 70 && (/:$/.test(line) || /^#+\s/.test(raw) || /^\*\*.*\*\*$/.test(line) || heading === heading.toUpperCase() || heading.split(' ').length <= 6);
      if (isHeadingLike) {
        for (var i = 0; i < SECTION_PATTERNS.length; i++) {
          if (SECTION_PATTERNS[i].re.test(heading)) { current = SECTION_PATTERNS[i].key; return; }
        }
      }
      // Inline markers like "Nice to have: Docker" switch weight for that line only.
      var section = current;
      if (/^(nice to have|bonus|preferred|a plus)\b/i.test(line) || /\b(is a plus|are a plus|nice to have|bonus points|preferred but not required)\b/i.test(line)) section = 'preferred';
      out.push({ text: line.replace(/^[-•*▪●◦·\d.)\s]+/, '').trim(), section: section });
    });
    return out;
  }

  // Words that are never useful keywords on their own (they are covered by the job title keyword).
  var GENERIC = ('developer developers engineer engineers manager managers designer designers artist artists animator animators rigger ' +
    'creator creators intern interns internship game games studio studios remote hybrid onsite fresher freshers experience years year ' +
    'senior junior lead trainee executive specialist associate role position job team company pvt ltd private limited llp inc ' +
    'cpu gpu ppo hr ctc lpa pay benefits salary stipend apply email contact work location india basic essential strong good similar creative store mca bca cse aaa').split(/\s+/);
  var GENERICSET = Object.create(null);
  GENERIC.forEach(function (w) { GENERICSET[w] = 1; });

  var ROLE_WORDS = /(engineer|developer|designer|manager|analyst|artist|editor|scientist|specialist|lead|architect|consultant|writer|producer|animator|creator|marketer|director|intern|officer|executive|coordinator|administrator|strategist|technician|associate|visuali[sz]er|programmer|tester|trainee|presenter|host|modell?er|rigger|freelancer)/i;
  var EMPLOYMENT = /^(remote|hybrid|on-?site|in[\s-]?office|fresher|freshers|full[\s-]?time|part[\s-]?time|internship|intern|contract|freelance|temporary|permanent|wfh|work from home|india|\d+\s*[-–+]?\s*\d*\+?\s*(years?|yrs?)(\s+(of\s+)?experience)?)$/i;

  /** "Unity Developer — BR Softech, Jaipur (Remote)" → { title: "Unity Developer", rest: "BR Softech" } */
  function splitTitle(raw) {
    var t = U.str(raw).replace(/[*_#]+/g, ' ').replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    var parts = t.split(/\s+[—–|]\s+|\s+-\s+|\s+@\s+|\s+at\s+(?=[A-Z])/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x && !EMPLOYMENT.test(x); });
    if (!parts.length) return { title: '', rest: '' };
    var title = parts[0].replace(/\s*[-–—]?\s*\d+\s*[-–+]?\s*\d*\+?\s*(years?|yrs?)(\s+(of\s+)?experience)?\s*$/i, '').trim();
    // The company is the last part that doesn't itself look like a role ("Reels & Video Editor – AI Content Creator — Lembark").
    var rest = '';
    for (var i = parts.length - 1; i >= 1; i--) {
      var cand = parts[i].split(',')[0].trim();
      if (cand && !ROLE_WORDS.test(cand) && !/^\d/.test(cand)) { rest = cand; break; }
    }
    return { title: title, rest: rest };
  }

  function guessTitle(text) {
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    function clean(l) { return l.replace(/^[#*_\s]+|[*#_\s:]+$/g, ''); }
    // 1. A header line near the top ("Unity Developer — BR Softech, Jaipur").
    for (var i = 0; i < Math.min(lines.length, 3); i++) {
      var l = clean(lines[i]);
      if (l.length > 2 && l.length < 110 && !/[.!?]$/.test(l) && ROLE_WORDS.test(l) && l.split(' ').length <= 14) return l;
    }
    // 2. An explicit label ("Job Title: …").
    var m = text.match(/(?:^|\n)\s*\**(?:job\s*title|position|role)\**\s*:\s*\**([^\n*]{3,90})/i);
    if (m) return m[1].trim();
    // 3. "We are looking for a Unity Developer who…"
    m = text.match(/(?:hiring|looking for|seeking)\s+(?:an?\s+)?(?:\w+\s+(?:and\s+)?){0,2}?((?:senior|junior|lead|principal|staff|associate|head of)?\s*[A-Z0-9][\w+#./&-]*(?:\s+[A-Z0-9&][\w+#./&-]*){0,5})/);
    if (m && ROLE_WORDS.test(m[1])) return m[1].trim();
    for (var j = 3; j < Math.min(lines.length, 6); j++) {
      var l2 = clean(lines[j]);
      if (l2.length > 2 && l2.length < 80 && !/[.!?]$/.test(l2) && ROLE_WORDS.test(l2)) return l2;
    }
    return '';
  }

  function guessCompany(text) {
    var m = text.match(/(?:company|employer|organi[sz]ation)\s*[:\-–]\s*([^\n]{2,60})/i)
      || text.match(/(?:^|\n)\s*\*?([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})\*?\s+(?:is|are)\s+(?:looking|hiring|seeking)/)
      || text.match(/\babout\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})\s*[:\n]/)
      || text.match(/\b(?:at|join)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})(?:,|\s+(?:is|we|as|and)\b|!|\.)/)
      || text.split('\n')[0].match(/\s(?:at|@|[-–|])\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})\s*$/);
    if (!m) return '';
    var c = m[1].trim().replace(/[.,!]+$/, '');
    return /^(the|our|a|an|us|you|we|this)$/i.test(c) ? '' : c;
  }

  function seniorityOf(title, text) {
    var s = (title + ' ' + text.slice(0, 600)).toLowerCase();
    if (/\b(intern|internship|trainee)\b/.test(s)) return 'Intern';
    if (/\b(junior|jr\.?|entry[\s-]level|graduate|fresher)\b/.test(s)) return 'Junior';
    if (/\b(principal|staff|distinguished)\b/.test(s)) return 'Principal/Staff';
    if (/\b(head of|director|vp|vice president|chief)\b/.test(s)) return 'Director+';
    if (/\b(lead|manager)\b/.test(title.toLowerCase())) return 'Lead/Manager';
    if (/\b(senior|sr\.?)\b/.test(s)) return 'Senior';
    return 'Mid-level';
  }

  function yearsRequired(text) {
    var re = /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)(?:'|’)?\s*(?:of)?\s*(?:professional|relevant|hands[\s-]on|industry|work)?\s*(?:experience|exp\b)?/gi;
    var m, best = null;
    while ((m = re.exec(text))) {
      var n = parseInt(m[1], 10);
      if (n > 0 && n < 30 && (best === null || n < best)) best = n; // the minimum stated requirement
    }
    return best;
  }

  function educationReq(text) {
    var t = text.toLowerCase();
    if (/\b(ph\.?d|doctorate)\b/.test(t)) return 'PhD';
    if (/\b(master'?s|m\.?s\.?c?|mba|m\.tech)\b/.test(t)) return "Master's";
    if (/\b(bachelor'?s|b\.?s\.?c?|b\.?a\.?|b\.?tech|b\.?e\.?|undergraduate degree|degree in)\b/.test(t)) return "Bachelor's";
    if (/\b(diploma|high school)\b/.test(t)) return 'Diploma';
    return '';
  }

  /** Repeated multi-word phrases the dictionary doesn't know (domain jargon like "payment gateway"). */
  function extractPhrases(lines, knownLower) {
    var counts = Object.create(null), sectionOf = Object.create(null);
    lines.forEach(function (l) {
      if (l.section === 'benefits' || l.section === 'about') return;
      l.text.split(/[,;:()|&\/•.!?]+|\s[-–—]\s/).forEach(function (seg) {
      var tokens = U.words(seg).map(function (w) { return w.replace(/[.'-]+$/, ''); });
      for (var n = 2; n <= 3; n++) {
        for (var i = 0; i + n <= tokens.length; i++) {
          var gram = tokens.slice(i, i + n);
          if (STOPSET[gram[0]] || STOPSET[gram[n - 1]] || gram.some(function (w) { return w.length < 2 || /^\d+$/.test(w) || GENERICSET[w]; })) continue;
          if (gram.filter(function (w) { return STOPSET[w]; }).length > 0) continue;
          var p = gram.join(' ');
          counts[p] = (counts[p] || 0) + 1;
          if (!sectionOf[p] || l.section === 'required') sectionOf[p] = l.section;
        }
      }
      });
    });
    var out = [];
    Object.keys(counts).forEach(function (p) {
      if (counts[p] < 2 || knownLower[p]) return;
      if (Object.keys(knownLower).some(function (k) { return p.indexOf(k) >= 0 || k.indexOf(p) >= 0; })) return;
      out.push({ term: p, count: counts[p], section: sectionOf[p] });
    });
    out.sort(function (a, b) { return b.count - a.count || b.term.length - a.term.length; });
    // Drop bigrams contained in a kept trigram with the same count.
    return out.filter(function (x, i) {
      return !out.some(function (y, j) { return j !== i && y.term.length > x.term.length && y.term.indexOf(x.term) >= 0 && y.count >= x.count; });
    }).slice(0, 12);
  }

  /** Capitalised product/tool names not in the dictionary (e.g. "Snowplow", "Contentful"). */
  function extractProperNouns(lines, knownLower, company, title, phrases) {
    var titleLower = U.words(title);
    var counts = Object.create(null), sectionOf = Object.create(null);
    var companyLower = U.str(company).toLowerCase();
    lines.forEach(function (l) {
      if (l.section === 'benefits' || l.section === 'about') return;
      var re = /(?:^|[\s(,\/])([A-Z][a-z]+[A-Z][A-Za-z]*|[A-Z]{2,6}s?|[A-Z][a-z]{2,}(?:\.(?:js|io|ai))?)(?=[\s),.\/;:]|$)/g, m;
      var first = true;
      while ((m = re.exec(l.text))) {
        var w = m[1];
        var atStart = first && l.text.indexOf(w) === 0;
        first = false;
        if (atStart) continue; // sentence-initial capital tells us nothing
        var lw = w.toLowerCase();
        if (GENERICSET[lw] || titleLower.indexOf(lw) >= 0 || (phrases || []).some(function (p) { return p.term.split(' ').indexOf(lw) >= 0; })) continue;
        if (w.length <= 2) continue;
        if (STOPSET[lw] || knownLower[lw] || lw === companyLower || /^(i|we|you|our|the|this|join|apply|equal|monday|friday|january|december)$/.test(lw)) continue;
        counts[w] = (counts[w] || 0) + 1;
        if (!sectionOf[w] || l.section === 'required') sectionOf[w] = l.section;
      }
    });
    return Object.keys(counts).filter(function (w) {
      return /[A-Z].*[A-Z]|\.(js|io|ai)$/.test(w) ? counts[w] >= 1 : counts[w] >= 2;
    }).map(function (w) { return { term: w, count: counts[w], section: sectionOf[w] }; }).slice(0, 10);
  }

  function sectionWeight(section) {
    return { required: 1.6, responsibilities: 1.25, general: 1.1, preferred: 0.8, about: 0.4, benefits: 0.1 }[section] || 1;
  }

  /** Main entry: analyse a job description. Never throws; returns an empty analysis for empty input. */
  function analyze(jdText) {
    var text = cleanText(jdText);
    var result = {
      title: '', company: '', seniority: '', yearsRequired: null, education: '',
      keywords: [], hardSkills: [], softSkills: [], responsibilities: [], wordCount: 0, empty: true, rawText: ''
    };
    if (text.trim().length < 20) return result;
    result.empty = false;
    result.rawText = text;
    result.wordCount = U.words(text).length;
    var lines = splitSections(text);
    var split = splitTitle(guessTitle(text));
    result.title = split.title;
    result.company = guessCompany(text);
    if (split.rest && (!result.company || result.company.length > split.rest.length + 15 || text.indexOf(result.company) > 400)) result.company = split.rest;
    result.seniority = seniorityOf(result.title, text);
    result.yearsRequired = yearsRequired(text);
    result.education = educationReq(text);
    result.responsibilities = lines.filter(function (l) { return l.section === 'responsibilities' && l.text.length > 25; })
      .map(function (l) { return l.text; }).slice(0, 15);

    // Score every known skill by where and how often it appears.
    var byName = Object.create(null);
    var companyRe = result.company && result.company.length > 2 ? U.termRegex(result.company) : null;
    lines.forEach(function (l) {
      if (l.section === 'benefits' || l.section === 'about') return;
      DB.findSkills(companyRe ? l.text.replace(companyRe, '$1 ; ') : l.text).forEach(function (s) {
        var k = byName[s.name] || (byName[s.name] = { term: s.name, display: s.matched, category: s.category, count: 0, weight: 0, required: false, preferred: false });
        k.count += s.count;
        k.weight += DB.CATEGORY_WEIGHT[s.category] * sectionWeight(l.section) * Math.min(s.count, 3);
        if (l.section === 'required') k.required = true;
        if (l.section === 'preferred') k.preferred = true;
        // Prefer the JD's own spelling (ATS often matches literally).
        if (s.matched && s.matched.length > 1 && s.matched !== s.name && s.matched.toLowerCase() !== s.name.toLowerCase()) k.display = k.display || s.matched;
      });
    });
    var titleSkills = DB.findSkills(result.title);
    titleSkills.forEach(function (s) {
      if (byName[s.name]) { byName[s.name].weight += 6; byName[s.name].inTitle = true; }
    });

    var knownLower = Object.create(null);
    Object.keys(byName).forEach(function (n) { DB.aliasesOf(n).forEach(function (a) { knownLower[a.toLowerCase()] = 1; }); });

    // Blank out already-recognised skills and the company name so they aren't re-extracted as fragments.
    var companyWords = U.words(result.company);
    var blanked = lines.map(function (l) {
      var t = l.text;
      DB.findSkills(t).forEach(function (s) {
        DB.aliasesOf(s.name).concat([s.matched]).forEach(function (a) { t = t.replace(U.termRegex(a), '$1 ; '); });
      });
      if (result.company) t = t.replace(U.termRegex(result.company), '$1 ; ');
      companyWords.forEach(function (w) { if (w.length > 2) t = t.replace(U.termRegex(w), '$1 ; '); });
      return { text: t, section: l.section };
    });

    var phrases = extractPhrases(blanked, knownLower);
    phrases.forEach(function (p) {
      byName[p.term] = { term: p.term, display: p.term, category: 'phrase', count: p.count, weight: DB.CATEGORY_WEIGHT.phrase * sectionWeight(p.section) * Math.min(p.count, 3), required: p.section === 'required', preferred: p.section === 'preferred' };
    });
    extractProperNouns(blanked, knownLower, result.company, result.title, phrases).forEach(function (p) {
      if (byName[p.term]) return;
      byName[p.term] = { term: p.term, display: p.term, category: 'tool', count: p.count, weight: 2 * sectionWeight(p.section) * Math.min(p.count, 3), required: p.section === 'required', preferred: p.section === 'preferred', inferred: true };
    });

    // The job title itself is a keyword (recruiters search by title).
    if (result.title) {
      result.keywords.push({ term: result.title, display: result.title, category: 'title', count: 1, weight: 8, required: true, preferred: false, priority: 'must' });
    }

    var list = Object.keys(byName).map(function (k) { return byName[k]; });
    list.forEach(function (k) {
      k.display = k.display && k.display.length > 1 ? k.display : k.term;
      if (k.preferred && !k.required) k.priority = 'nice';
      else if (k.required || k.weight >= 6) k.priority = 'must';
      else k.priority = 'should';
      k.weight = Math.round(k.weight * 10) / 10;
    });
    list.sort(function (a, b) { return b.weight - a.weight; });
    result.keywords = result.keywords.concat(list.slice(0, 45));
    result.hardSkills = list.filter(function (k) { return k.category !== 'soft' && k.category !== 'phrase'; }).map(function (k) { return k.term; });
    result.softSkills = list.filter(function (k) { return k.category === 'soft'; }).map(function (k) { return k.term; });
    return result;
  }

  CVM.analyzer = { analyze: analyze, _splitTitle: splitTitle, _splitSections: splitSections, _guessTitle: guessTitle, _guessCompany: guessCompany, _yearsRequired: yearsRequired };
})(typeof window !== 'undefined' ? window : globalThis);
