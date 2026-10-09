/* CV Forge — shared helpers. Loaded first; everything hangs off the CVM namespace.
 * Classic script (no ES modules) so the app also works when opened via file://. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};

  var util = {};

  util.str = function (v, max) {
    if (v === null || v === undefined) return '';
    var s = typeof v === 'string' ? v : (typeof v === 'number' || typeof v === 'boolean') ? String(v) : '';
    s = s.replace(/\u0000/g, '');
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  };

  util.arr = function (v) { return Array.isArray(v) ? v : []; };

  util.escapeHtml = function (s) {
    return util.str(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  util.escapeXml = function (s) {
    // Strip characters that are illegal in XML 1.0 so Word never refuses the file.
    return util.escapeHtml(util.str(s).replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ''));
  };

  util.escapeRegex = function (s) { return util.str(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  util.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  util.clamp = function (n, lo, hi) { n = Number(n); if (!isFinite(n)) n = lo; return Math.max(lo, Math.min(hi, n)); };

  util.clone = function (o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; }
  };

  util.unique = function (list) {
    var seen = Object.create(null), out = [];
    util.arr(list).forEach(function (x) {
      var k = util.str(x).toLowerCase().trim();
      if (k && !seen[k]) { seen[k] = 1; out.push(x); }
    });
    return out;
  };

  /** Matches a term as a whole "word" even when it contains symbols (C++, C#, .NET, Node.js). */
  util.termRegex = function (term) {
    var t = util.escapeRegex(util.str(term).trim()).replace(/\s+/g, '[\\s\\-/]+');
    return new RegExp('(^|[^a-z0-9+#])' + t + '(?=$|[^a-z0-9+#])', 'gi');
  };

  util.countTerm = function (text, term) {
    if (!text || !term) return 0;
    var m = util.str(text).match(util.termRegex(term));
    return m ? m.length : 0;
  };

  util.hasTerm = function (text, term) { return util.countTerm(text, term) > 0; };

  util.words = function (text) {
    return util.str(text).toLowerCase().match(/[a-z0-9][a-z0-9+#.\-']*/g) || [];
  };

  util.debounce = function (fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  /** Run fn; on any exception log it and return fallback. Nothing in the UI path should throw. */
  util.safe = function (fn, fallback, label) {
    try { return fn(); } catch (e) {
      if (CVM.onError) CVM.onError(e, label);
      else if (root.console) root.console.error(label || 'error', e);
      return fallback;
    }
  };

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  /** Parse "2021-03", "Mar 2021", "03/2021", "2021" → {y, m} or null. */
  util.parseDate = function (s) {
    s = util.str(s).trim().toLowerCase();
    if (!s) return null;
    if (/^(present|current|now|ongoing|today)$/.test(s)) return { present: true };
    var m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})/))) return { y: +m[1], m: util.clamp(+m[2], 1, 12) };
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{4})/))) return { y: +m[2], m: util.clamp(+m[1], 1, 12) };
    if ((m = s.match(/^([a-z]{3})[a-z]*\.?\s*,?\s*(\d{4})/))) {
      var mi = MONTHS.indexOf(m[1]);
      return { y: +m[2], m: mi >= 0 ? mi + 1 : 1 };
    }
    if ((m = s.match(/^(\d{4})$/))) return { y: +m[1], m: null };
    return null;
  };

  /** ATS-friendly, consistent "Mon YYYY" formatting. Unparseable input is passed through untouched. */
  util.formatDate = function (s) {
    var d = util.parseDate(s);
    if (!d) return util.str(s).trim();
    if (d.present) return 'Present';
    if (!d.m) return String(d.y);
    var name = MONTHS[d.m - 1];
    return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + d.y;
  };

  util.dateRange = function (start, end, current) {
    var a = util.formatDate(start);
    var b = current ? 'Present' : util.formatDate(end);
    if (a && b) return a + ' – ' + b;
    return a || b || '';
  };

  /** Months between two date strings (end defaults to now). */
  util.monthsBetween = function (start, end, current, now) {
    var a = util.parseDate(start);
    if (!a || a.present) return 0;
    var b = current ? { present: true } : util.parseDate(end);
    var n = now || new Date();
    var by = b && !b.present ? b.y : n.getFullYear();
    var bm = b && !b.present ? (b.m || 12) : n.getMonth() + 1;
    var months = (by - a.y) * 12 + (bm - (a.m || 1)) + 1;
    return Math.max(0, Math.min(months, 600));
  };

  util.download = function (filename, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };

  util.slug = function (s) {
    return util.str(s).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'CV';
  };

  CVM.util = util;
})(typeof window !== 'undefined' ? window : globalThis);
