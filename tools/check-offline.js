/* CivilLab offline audit.
   Fails if any page or stylesheet reaches outside the repo, or if any local
   asset reference does not resolve.  The suite must run from file:// with no
   network at all. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let bad = 0, checked = 0;

const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (!/^(\.git|node_modules)$/.test(e.name)) walk(p); return; }
  if (!/\.(html|css|js)$/.test(e.name)) return;
  const t = fs.readFileSync(p, 'utf8');
  for (const m of t.matchAll(/https?:\/\/[^"'\s)]+/g)) {
    if (m[0].indexOf('www.w3.org') >= 0) continue;          // svg namespace
    console.log('  EXTERNAL  ' + m[0] + '   in ' + path.relative(ROOT, p));
    bad++;
  }
  if (!/\.html$/.test(e.name)) return;
  for (const m of t.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const r = m[1];
    if (/^(https?:|#|data:|mailto:)/.test(r)) continue;
    checked++;
    if (!fs.existsSync(path.resolve(path.dirname(p), r))) {
      console.log('  MISSING   ' + r + '   in ' + path.relative(ROOT, p)); bad++;
    }
  }
});
walk(ROOT);

const cssPath = path.join(ROOT, 'assets/css/civillab.css');
const css = fs.readFileSync(cssPath, 'utf8');
for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
  const r = m[1].replace(/["']/g, '');
  if (/^(https?:|data:)/.test(r)) continue;
  checked++;
  if (!fs.existsSync(path.resolve(path.dirname(cssPath), r))) {
    console.log('  MISSING FONT  ' + r); bad++;
  }
}
console.log('  ' + checked + ' local references checked, ' + bad + ' problems');
process.exit(bad ? 1 : 0);
