/* CivilLab headless page check.
   Usage: node tools/smoke.js [apps/<dir>]     no argument checks every app.
   Loads a page in jsdom with every script inlined, then reports page errors,
   whether each figure svg actually drew, and how many chips rendered.
   Apps with an extra assertion file in tools/checks/<app>.js run that too. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('jsdom is missing. Run:  npm install');
  process.exit(2);
}

function load(app) {
  const hp = path.join(ROOT, app, 'index.html');
  const html = fs.readFileSync(hp, 'utf8')
    .replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
      '<script>' + fs.readFileSync(path.resolve(path.dirname(hp), src), 'utf8') + '</script>')
    .replace(/<link[^>]+>/g, '');
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.addEventListener('error', e => errs.push(e.message || String(e.error)));
      const ce = w.console.error;
      w.console.error = (...a) => { errs.push(a.join(' ')); ce.apply(w.console, a); };
    }
  });
  return { dom, doc: dom.window.document, w: dom.window, errs };
}

function checkApp(app) {
  const { dom, doc, w, errs } = load(app);
  const svgs = [...doc.querySelectorAll('.figwrap svg')];
  const chips = doc.querySelectorAll('.chip');
  let pass = 0, fail = 0;
  const ok = (n, g, e) => {
    if (String(g) === String(e)) { pass++; console.log('    ok   ' + n + ' = ' + g); }
    else { fail++; console.log('    FAIL ' + n + ' got ' + g + ' expected ' + e); }
  };

  console.log('\n' + app);
  console.log('  page errors ' + errs.length + (errs.length ? '  :: ' + errs.slice(0, 3).join(' | ') : ''));
  console.log('  figures     ' + svgs.map(s => (s.id || '?') + ':' + s.childNodes.length).join('  '));
  console.log('  chips       ' + chips.length);

  let bad = errs.length;
  if (!svgs.length) { console.log('  NO FIGURE SVG'); bad++; }
  if (svgs.some(s => s.childNodes.length === 0)) { console.log('  AN SVG DREW NOTHING'); bad++; }
  if (!chips.length) { console.log('  NO CHIPS'); bad++; }

  const extra = path.join(__dirname, 'checks', path.basename(app) + '.js');
  if (!bad && fs.existsSync(extra)) {
    console.log('  interaction checks');
    try { require(extra)(doc, w, ok); }
    catch (e) { console.log('    THREW ' + e.message); fail++; }
    console.log('    ' + pass + ' passed, ' + fail + ' failed');
    bad += fail;
  }
  dom.window.close();
  return bad;
}

const arg = process.argv[2];
const apps = arg ? [arg.replace(/[\/]+$/, '')]
  : fs.readdirSync(path.join(ROOT, 'apps')).sort().map(d => 'apps/' + d);
let bad = 0;
for (const a of apps) bad += checkApp(a);
console.log('\n' + (apps.length - (bad ? 1 : 0)) + '/' + apps.length +
  ' apps checked, ' + bad + ' problems');
process.exit(bad ? 1 : 0);
