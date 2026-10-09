// Loads the browser scripts into Node's global scope, in the same order as index.html.
const path = require('path');
const files = ['js/util.js', 'js/skills-db.js', 'js/profile.js', 'js/analyzer.js', 'js/tailor.js', 'js/render.js', 'js/docx.js', 'js/importer.js', 'data/profiles.js'];
for (const f of files) require(path.join(__dirname, '..', f));
module.exports = globalThis.CVM;
