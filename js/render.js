/* Renderers. The CV HTML is deliberately plain: one column, real headings, real bullet lists,
 * no tables, columns, icons, images or text in headers/footers — the things that break ATS parsers. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util, E = U.escapeHtml;

  function linkText(url) { return U.str(url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }

  function contactLine(b) {
    var parts = [b.email, b.phone, b.location].filter(Boolean).map(E);
    b.links.forEach(function (l) { parts.push(E(linkText(l.url))); });
    return parts.join(' &nbsp;|&nbsp; ');
  }

  /** HTML for the CV page (inside .cv-page). template: classic | compact | modern */
  function cvHtml(cv, template) {
    var h = [];
    var b = cv.basics;
    h.push('<article class="cv cv--' + E(template || 'classic') + '">');
    h.push('<header class="cv-head"><h1 class="cv-name">' + E(b.name || 'Your Name') + '</h1>');
    if (b.headline) h.push('<p class="cv-headline">' + E(b.headline) + '</p>');
    h.push('<p class="cv-contact">' + contactLine(b) + '</p></header>');

    var parts = {
      summary: function () { return cv.summary ? section('Summary', '<p>' + E(cv.summary) + '</p>') : ''; },
      skills: function () {
        return cv.skills.length ? section('Skills', cv.skills.map(function (g) {
          return '<p class="cv-skill"><strong>' + E(g.group) + ':</strong> ' + E(g.items.join(', ')) + '</p>';
        }).join('')) : '';
      },
      experience: function () {
        return cv.experience.length ? section('Experience', cv.experience.map(function (e) {
          return '<div class="cv-item"><p class="cv-item-head"><strong>' + E(e.role) + '</strong>' + (e.company ? ' — ' + E(e.company) : '') +
            (e.location ? ', ' + E(e.location) : '') + (e.dates ? '<span class="cv-dates">' + E(e.dates) + '</span>' : '') + '</p>' + list(e.bullets) + '</div>';
        }).join('')) : '';
      },
      projects: function () {
        return cv.projects.length ? section('Projects', cv.projects.map(function (p) {
          var meta = [p.role, p.tech.length ? p.tech.join(', ') : ''].filter(Boolean).join(' | ');
          return '<div class="cv-item"><p class="cv-item-head"><strong>' + E(p.name) + '</strong>' + (meta ? ' — ' + E(meta) : '') +
            (p.dates ? '<span class="cv-dates">' + E(p.dates) + '</span>' : '') + '</p>' +
            (p.link ? '<p class="cv-link">' + E(linkText(p.link)) + '</p>' : '') + list(p.bullets) + '</div>';
        }).join('')) : '';
      },
      education: function () {
        return cv.education.length ? section('Education', cv.education.map(function (e) {
          return '<div class="cv-item"><p class="cv-item-head"><strong>' + E(e.degree || e.school) + '</strong>' + (e.degree && e.school ? ' — ' + E(e.school) : '') +
            (e.dates ? '<span class="cv-dates">' + E(e.dates) + '</span>' : '') + '</p>' + (e.grade ? '<p>' + E(e.grade) + '</p>' : '') + list(e.details) + '</div>';
        }).join('')) : '';
      },
      certifications: function () { return cv.certifications.length ? section('Certifications', list(cv.certifications.map(function (c) { return [c.name, c.issuer, c.date].filter(Boolean).join(' — '); }))) : ''; },
      achievements: function () { return cv.achievements.length ? section('Achievements', list(cv.achievements)) : ''; },
      languages: function () { return cv.languages.length ? section('Languages', '<p>' + E(cv.languages.join(', ')) + '</p>') : ''; }
    };
    order(cv).forEach(function (k) { if (parts[k]) h.push(parts[k]()); });
    h.push('</article>');
    return h.join('');
  }

  var DEFAULT_ORDER = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'languages'];
  /** Section order for a CV (validated: unknown keys dropped, missing ones appended). */
  function order(cv) {
    var o = Array.isArray(cv && cv.order) ? cv.order.filter(function (k) { return DEFAULT_ORDER.indexOf(k) >= 0; }) : [];
    DEFAULT_ORDER.forEach(function (k) { if (o.indexOf(k) < 0) o.push(k); });
    return o;
  }

  function section(title, body) { return '<section class="cv-sec"><h2>' + E(title) + '</h2>' + body + '</section>'; }
  function list(items) { return items && items.length ? '<ul>' + items.map(function (b) { return '<li>' + E(b) + '</li>'; }).join('') + '</ul>' : ''; }

  /** Print CSS shared by the in-app preview and the standalone export. */
  function cvCss(pageSize) {
    var size = pageSize === 'Letter' ? 'letter' : 'A4';
    return '@page{size:' + size + ';margin:14mm 16mm}' +
      '.cv{font-family:Calibri,Carlito,"Segoe UI",Arial,Helvetica,sans-serif;color:#111;font-size:10.5pt;line-height:1.38}' +
      '.cv h1{font-size:21pt;margin:0 0 2pt;letter-spacing:.2pt}.cv-headline{font-size:11.5pt;margin:0 0 3pt;font-weight:600}' +
      '.cv-contact{margin:0 0 6pt;font-size:9.5pt}.cv-sec{margin-top:9pt}' +
      '.cv h2{font-size:11pt;text-transform:uppercase;letter-spacing:.8pt;border-bottom:1px solid #222;margin:0 0 4pt;padding-bottom:1pt}' +
      '.cv p{margin:0 0 3pt}.cv ul{margin:2pt 0 4pt;padding-left:15pt}.cv li{margin:0 0 2pt}' +
      '.cv-item{margin-bottom:5pt;break-inside:avoid-page}.cv-item-head{display:block}.cv-dates{float:right;font-weight:400;padding-left:8pt}' +
      '.cv-link{font-size:9.5pt;color:#333}.cv-skill{margin-bottom:2pt}' +
      '.cv--compact{font-size:9.8pt;line-height:1.28}.cv--compact h1{font-size:18pt}.cv--compact .cv-sec{margin-top:6pt}.cv--compact li{margin:0}' +
      '.cv--modern h1{color:#123b6d}.cv--modern h2{color:#123b6d;border-bottom:2px solid #123b6d}.cv--modern .cv-headline{color:#123b6d}' +
      '.cv--classic{font-family:Georgia,"Times New Roman",serif}.cv--classic h1{font-weight:700}';
  }

  /** Standalone HTML document of the CV (for "Save as PDF" in any browser). */
  function cvDocument(cv, template, pageSize) {
    var title = (cv.basics.name || 'CV') + (cv.meta.jobTitle ? ' — ' + cv.meta.jobTitle : '');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + E(title) + '</title>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fff}main{max-width:780px;margin:24px auto;padding:0 20px}@media print{main{margin:0;padding:0;max-width:none}}' +
      cvCss(pageSize) + '</style></head><body><main>' + cvHtml(cv, template) + '</main></body></html>';
  }

  function markdown(cv) {
    var b = cv.basics, md = [];
    md.push('# ' + (b.name || 'Your Name'));
    if (b.headline) md.push('**' + b.headline + '**');
    md.push([b.email, b.phone, b.location].concat(b.links.map(function (l) { return l.url; })).filter(Boolean).join(' | '));
    var parts = {
      summary: function () { if (cv.summary) md.push('## Summary', cv.summary); },
      skills: function () { if (cv.skills.length) md.push('## Skills', cv.skills.map(function (g) { return '- **' + g.group + ':** ' + g.items.join(', '); }).join('\n')); },
      experience: function () {
        if (!cv.experience.length) return;
        md.push('## Experience');
        cv.experience.forEach(function (e) {
          md.push('### ' + e.role + (e.company ? ' — ' + e.company : '') + (e.location ? ', ' + e.location : '') + (e.dates ? '\n_' + e.dates + '_' : ''));
          if (e.bullets.length) md.push(e.bullets.map(function (x) { return '- ' + x; }).join('\n'));
        });
      },
      projects: function () {
        if (!cv.projects.length) return;
        md.push('## Projects');
        cv.projects.forEach(function (p) {
          md.push('### ' + p.name + (p.role ? ' — ' + p.role : '') + (p.tech.length ? '\n_' + p.tech.join(', ') + '_' : '') + (p.link ? '\n' + p.link : ''));
          if (p.bullets.length) md.push(p.bullets.map(function (x) { return '- ' + x; }).join('\n'));
        });
      },
      education: function () {
        if (!cv.education.length) return;
        md.push('## Education');
        cv.education.forEach(function (e) { md.push('### ' + (e.degree || e.school) + (e.degree && e.school ? ' — ' + e.school : '') + (e.dates ? '\n_' + e.dates + '_' : '') + (e.grade ? '\n' + e.grade : '')); });
      },
      certifications: function () { if (cv.certifications.length) md.push('## Certifications', cv.certifications.map(function (c) { return '- ' + [c.name, c.issuer, c.date].filter(Boolean).join(' — '); }).join('\n')); },
      achievements: function () { if (cv.achievements.length) md.push('## Achievements', cv.achievements.map(function (a) { return '- ' + a; }).join('\n')); },
      languages: function () { if (cv.languages.length) md.push('## Languages', cv.languages.join(', ')); }
    };
    order(cv).forEach(function (k) { if (parts[k]) parts[k](); });
    return md.join('\n\n') + '\n';
  }

  /** A self-contained personal portfolio page generated from the full memory (not one job). */
  function portfolio(profile) {
    var p = CVM.profile.normalize(profile), b = p.basics;
    var links = b.links.map(function (l) { return '<a href="' + E(safeUrl(l.url)) + '" rel="noopener">' + E(l.label || linkText(l.url)) + '</a>'; }).join('');
    var projects = p.projects.map(function (pr) {
      return '<article class="card"><h3>' + (pr.link ? '<a href="' + E(safeUrl(pr.link)) + '" rel="noopener">' + E(pr.name) + '</a>' : E(pr.name)) + '</h3>' +
        (pr.role ? '<p class="muted">' + E(pr.role) + '</p>' : '') + list(pr.bullets) +
        (pr.tech.length ? '<p class="tags">' + pr.tech.map(function (t) { return '<span>' + E(t) + '</span>'; }).join('') + '</p>' : '') + '</article>';
    }).join('');
    var exp = p.experience.map(function (e) {
      return '<article class="row"><div class="when">' + E(U.dateRange(e.start, e.end, e.current)) + '</div><div><h3>' + E(e.role) + (e.company ? ' · ' + E(e.company) : '') + '</h3>' + list(e.bullets) + '</div></article>';
    }).join('');
    var skills = p.skills.map(function (s) { return '<span>' + E(s.name) + '</span>'; }).join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + E(b.name || 'Portfolio') + '</title><meta name="description" content="' + E(b.headline || p.summary.slice(0, 150)) + '"><style>' +
      ':root{--bg:#0f1115;--fg:#e9ecf1;--mut:#9aa3b2;--card:#171a21;--line:#262b35;--acc:#7cc4ff}' +
      '@media (prefers-color-scheme:light){:root{--bg:#fafafa;--fg:#14171c;--mut:#5b6472;--card:#fff;--line:#e3e6eb;--acc:#0b63c5}}' +
      '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      'main{max-width:900px;margin:0 auto;padding:56px 20px}h1{font-size:clamp(2rem,6vw,3.2rem);margin:0;line-height:1.1}h2{margin:48px 0 16px;font-size:1.1rem;text-transform:uppercase;letter-spacing:.12em;color:var(--mut)}' +
      'h3{margin:0 0 6px;font-size:1.05rem}a{color:var(--acc)}.lead{font-size:1.2rem;color:var(--mut);margin:8px 0 16px}.links{display:flex;flex-wrap:wrap;gap:14px}' +
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}' +
      '.muted{color:var(--mut);margin:0 0 6px}ul{padding-left:18px;margin:6px 0}.tags,.skills{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}' +
      '.tags span,.skills span{border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:.85rem;color:var(--mut)}' +
      '.row{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:14px 0;border-top:1px solid var(--line)}.when{color:var(--mut);font-size:.9rem}' +
      '@media (max-width:600px){.row{grid-template-columns:1fr;gap:4px}}</style></head><body><main>' +
      '<header><h1>' + E(b.name || 'Your Name') + '</h1><p class="lead">' + E(b.headline) + (b.location ? ' · ' + E(b.location) : '') + '</p>' +
      '<div class="links">' + (b.email ? '<a href="mailto:' + E(b.email) + '">' + E(b.email) + '</a>' : '') + links + '</div></header>' +
      (p.summary ? '<h2>About</h2><p>' + E(p.summary) + '</p>' : '') +
      (projects ? '<h2>Projects</h2><div class="grid">' + projects + '</div>' : '') +
      (exp ? '<h2>Experience</h2>' + exp : '') +
      (skills ? '<h2>Skills</h2><p class="skills">' + skills + '</p>' : '') +
      '</main></body></html>';
  }

  function safeUrl(u) {
    u = U.str(u).trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u;
    return '#';
  }

  CVM.render = { order: order, cvHtml: cvHtml, cvCss: cvCss, cvDocument: cvDocument, markdown: markdown, text: function (cv) { return CVM.tailor.cvText(cv); }, portfolio: portfolio, safeUrl: safeUrl };
})(typeof window !== 'undefined' ? window : globalThis);
