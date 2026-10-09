/* Dependency-free .docx writer. Produces a minimal, standards-compliant Word file
 * (single column, built-in Heading styles, real Word bullet lists) — the format most ATS parse best. */
(function (root) {
  'use strict';
  var CVM = root.CVM = root.CVM || {};
  var U = CVM.util, X = U.escapeXml;

  // ---------- tiny ZIP (store, no compression) ----------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [], str = unescape(encodeURIComponent(s));
    for (var i = 0; i < str.length; i++) out.push(str.charCodeAt(i));
    return new Uint8Array(out);
  }

  function zip(files) {
    var chunks = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var local = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      chunks.push(new Uint8Array(local), name, data);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += local.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var all = chunks.concat(central, [end]);
    var total = all.reduce(function (s, c) { return s + c.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  // ---------- WordprocessingML ----------
  function run(text, opts) {
    opts = opts || {};
    var rpr = (opts.bold ? '<w:b/>' : '') + (opts.italic ? '<w:i/>' : '') + (opts.size ? '<w:sz w:val="' + opts.size + '"/>' : '') + (opts.color ? '<w:color w:val="' + opts.color + '"/>' : '');
    return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + X(text) + '</w:t></w:r>';
  }

  function para(runs, opts) {
    opts = opts || {};
    var ppr = '';
    if (opts.style) ppr += '<w:pStyle w:val="' + opts.style + '"/>';
    if (opts.bullet) ppr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (opts.tabRight) ppr += '<w:tabs><w:tab w:val="right" w:pos="' + opts.tabRight + '"/></w:tabs>';
    ppr += '<w:spacing w:before="' + (opts.before || 0) + '" w:after="' + (opts.after === undefined ? 40 : opts.after) + '"/>';
    if (opts.keepNext) ppr += '<w:keepNext/>';
    if (opts.align) ppr += '<w:jc w:val="' + opts.align + '"/>';
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + (Array.isArray(runs) ? runs.join('') : runs) + '</w:p>';
  }

  function tab() { return '<w:r><w:tab/></w:r>'; }

  function documentXml(cv, pageSize) {
    var letter = pageSize === 'Letter';
    var pgW = letter ? 12240 : 11906, pgH = letter ? 15840 : 16838, margin = 850;
    var right = pgW - margin * 2;
    var body = [];
    var b = cv.basics;
    body.push(para(run(b.name || 'Your Name', { bold: true, size: 40 }), { style: 'Title', after: 20 }));
    if (b.headline) body.push(para(run(b.headline, { bold: true, size: 23 }), { after: 20 }));
    var contact = [b.email, b.phone, b.location].concat(b.links.map(function (l) { return l.url.replace(/^https?:\/\/(www\.)?/, ''); })).filter(Boolean).join('  |  ');
    body.push(para(run(contact, { size: 19 }), { after: 80 }));

    function heading(t) { body.push(para(run(t.toUpperCase()), { style: 'Heading1', before: 160, after: 60, keepNext: true })); }
    function bullets(list) { U.arr(list).forEach(function (t) { body.push(para(run(t), { bullet: true, after: 20 })); }); }
    function itemHead(left, dates, sub) {
      var runs = [run(left, { bold: true })];
      if (sub) runs.push(run(' — ' + sub));
      if (dates) { runs.push(tab(), run(dates)); }
      body.push(para(runs, { tabRight: right, before: 60, after: 20, keepNext: true }));
    }

    if (cv.summary) { heading('Summary'); body.push(para(run(cv.summary))); }
    if (cv.skills.length) {
      heading('Skills');
      cv.skills.forEach(function (g) { body.push(para([run(g.group + ': ', { bold: true }), run(g.items.join(', '))], { after: 20 })); });
    }
    if (cv.experience.length) {
      heading('Experience');
      cv.experience.forEach(function (e) { itemHead(e.role, e.dates, [e.company, e.location].filter(Boolean).join(', ')); bullets(e.bullets); });
    }
    if (cv.projects.length) {
      heading('Projects');
      cv.projects.forEach(function (p) {
        itemHead(p.name, p.dates, [p.role, p.tech.join(', ')].filter(Boolean).join(' | '));
        if (p.link) body.push(para(run(p.link.replace(/^https?:\/\/(www\.)?/, ''), { size: 19 }), { after: 20 }));
        bullets(p.bullets);
      });
    }
    if (cv.education.length) {
      heading('Education');
      cv.education.forEach(function (e) {
        itemHead(e.degree || e.school, e.dates, e.degree ? e.school : '');
        if (e.grade) body.push(para(run(e.grade)));
        bullets(e.details);
      });
    }
    if (cv.certifications.length) { heading('Certifications'); bullets(cv.certifications.map(function (c) { return [c.name, c.issuer, c.date].filter(Boolean).join(' — '); })); }
    if (cv.achievements.length) { heading('Achievements'); bullets(cv.achievements); }
    if (cv.languages.length) { heading('Languages'); body.push(para(run(cv.languages.join(', ')))); }

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
      body.join('') +
      '<w:sectPr><w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"/><w:pgMar w:top="' + margin + '" w:right="' + margin + '" w:bottom="' + margin + '" w:left="' + margin + '" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="222222"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>' +
    '</w:styles>';

  var NUMBERING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>' +
    '<w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:lvl></w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

  var CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';

  var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';

  var DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>';

  function coreXml(cv) {
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + X((cv.basics.name || 'CV') + ' CV') + '</dc:title><dc:creator>' + X(cv.basics.name || '') + '</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
  }

  /** Returns a Uint8Array containing the .docx file. */
  function build(cv, pageSize) {
    return zip([
      { name: '[Content_Types].xml', data: CONTENT_TYPES },
      { name: '_rels/.rels', data: RELS },
      { name: 'docProps/core.xml', data: coreXml(cv) },
      { name: 'word/document.xml', data: documentXml(cv, pageSize) },
      { name: 'word/styles.xml', data: STYLES },
      { name: 'word/numbering.xml', data: NUMBERING },
      { name: 'word/_rels/document.xml.rels', data: DOC_RELS }
    ]);
  }

  CVM.docx = { build: build, _crc32: crc32, MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
})(typeof window !== 'undefined' ? window : globalThis);
