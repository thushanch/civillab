/* Headless smoke test for F2 Bearing Capacity */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || path.resolve(__dirname, '../..');
const APP = 'apps/f2-bearing-capacity';
const hp = path.join(ROOT, APP, 'index.html');
let html = fs.readFileSync(hp, 'utf8')
  .replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
    '<script>' + fs.readFileSync(path.resolve(path.dirname(hp), src), 'utf8') + '</script>')
  .replace(/<link[^>]+>/g, '');
const errs = [];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w) { w.addEventListener('error', e => errs.push(e.message)); } });
const doc = dom.window.document, w = dom.window;

let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  if (tol == null) tol = 0;
  if (typeof got === 'boolean' || typeof exp === 'boolean') {
    if (got === exp) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp); }
    return;
  }
  if (typeof got === 'string' && typeof exp === 'string') {
    if (got === exp) { pass++; console.log('  ok   ' + name + ' = ' + got); }
    else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp); }
    return;
  }
  var g = typeof got === 'number' ? got : parseFloat(got);
  if (Math.abs(g - exp) <= tol) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + ' +/- ' + tol); }
}

function val(key) {
  var c = Array.from(doc.querySelectorAll('.chip'))
    .find(function(c) { return c.querySelector('.k').textContent.includes(key); });
  return c ? c.querySelector('.v').textContent : '(missing)';
}

function setInput(id, value) {
  var el = doc.getElementById(id + 'n');
  if (!el) el = doc.getElementById(id + 'r');
  if (!el) { console.log('  WARN input ' + id + ' not found'); return; }
  el.value = value;
  el.dispatchEvent(new w.Event('input', { bubbles:true }));
}

function setSelect(id, value) {
  var el = doc.getElementById(id);
  if (!el) { console.log('  WARN select ' + id + ' not found'); return; }
  el.value = value;
  el.dispatchEvent(new w.Event('change', { bubbles:true }));
}

console.log('=== Boot check ===');
ok('no page errors', errs.length, 0);
ok('chips rendered', doc.querySelectorAll('.chip').length > 5, true);
ok('fig svg has children', doc.getElementById('fig').childNodes.length > 3, true);
ok('cap svg has children', doc.getElementById('cap').childNodes.length > 3, true);

console.log('\n=== Default preset (strip on phi=0 clay) ===');
{
  /* Default: general, strip, B=1.5, D=1, c=75, phi=0, FoS=3 */
  var Nc = Math.PI + 2;
  var dc = 1 + 0.4 * (1 / 1.5);
  var qu_exp = 75 * Nc * dc + 18 * 1;
  ok('Nc is pi+2', parseFloat(val('Nc')), 5.14, 0.01);
  ok('Nq is 1', parseFloat(val('Nq')), 1, 0.01);
  ok('qu matches hand calc', parseFloat(val('qu')), qu_exp, 2);
  ok('qa is qu/3', parseFloat(val('qa')), qu_exp / 3, 1);
  ok('verdict is Safe', val('Verdict'), 'Safe');
}

console.log('\n=== Switch to Terzaghi ===');
{
  setSelect('method', 'terzaghi');
  ok('Nc is 5.70', parseFloat(val('Nc')), 5.70, 0.01);
  var qu_terz = 75 * 5.7 + 18;
  ok('qu matches Terzaghi', parseFloat(val('qu')), qu_terz, 2);
  setSelect('method', 'general');
}

console.log('\n=== Switch to sand preset ===');
{
  setSelect('preset', 'sand');
  ok('chips re-rendered after preset', doc.querySelectorAll('.chip').length > 5, true);
  ok('Nc at phi=30', parseFloat(val('Nc')), 30.14, 0.1);
  ok('Nq at phi=30', parseFloat(val('Nq')), 18.40, 0.1);
  ok('qu is positive', parseFloat(val('qu')) > 100, true);
}

console.log('\n=== Change phi to 0 ===');
{
  setInput('phi', 0);
  ok('Nc goes to pi+2', parseFloat(val('Nc')), 5.14, 0.01);
  ok('Nq goes to 1', parseFloat(val('Nq')), 1.0, 0.01);
  ok('Ng goes to 0', parseFloat(val('Nγ')), 0, 0.01);
}

console.log('\n=== Change phi to 30, strip at surface, c=0 ===');
{
  setSelect('shape', 'strip');
  setInput('phi', 30);
  setInput('c', 0);
  setInput('D', 0);
  var Ng30 = 22.40;
  var qu_surf = 0.5 * 18 * 2 * Ng30;
  ok('qu at surface c=0 phi=30 strip', parseFloat(val('qu')), qu_surf, 5);
}

console.log('\n=== Eccentricity ===');
{
  setSelect('preset', 'ecc');
  ok("B' shown in chips", val("B'") !== '(missing)', true);
  ok("B' is B - 2e", parseFloat(val("B'")), 2.2, 0.01);
}

console.log('\n=== Water table effect ===');
{
  setSelect('preset', 'wet');
  var qu_wet = parseFloat(val('qu'));
  ok('water case shown', val('Water') !== '(missing)', true);
  setInput('zw', 10);
  var qu_dry = parseFloat(val('qu'));
  ok('water reduces qu', qu_wet < qu_dry, true);
}

console.log('\n=== FoS change ===');
{
  setSelect('preset', 'sand');
  var qu_val = parseFloat(val('qu'));
  setInput('FoS', 2);
  var qa_val = parseFloat(val('qa'));
  ok('qa = qu / 2', qa_val, qu_val / 2, 1);
}

console.log('\n=== Shape: square vs strip ===');
{
  setSelect('preset', 'sand');
  var qu_sq = parseFloat(val('qu'));
  setSelect('shape', 'strip');
  var qu_st = parseFloat(val('qu'));
  ok('square qu > strip qu', qu_sq > qu_st, true);
}

console.log('\n=== Depth effect (general method) ===');
{
  setSelect('preset', 'sand');
  setInput('D', 0);
  var qu_shallow = parseFloat(val('qu'));
  setInput('D', 2);
  var qu_deep = parseFloat(val('qu'));
  ok('deeper footing has higher qu', qu_deep > qu_shallow, true);
}

console.log('\n=== Applied pressure verdict ===');
{
  setSelect('preset', 'clay');
  var qa_val2 = parseFloat(val('qa'));
  setInput('qApp', Math.round(qa_val2 + 50));
  ok('exceeding qa fails', val('Verdict'), 'Exceeds qa');
  setInput('qApp', 10);
  ok('low qApp is safe', val('Verdict'), 'Safe');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + errs.length + ' page errors');
if (errs.length) console.log('errors:', errs);
process.exit(fail || errs.length ? 1 : 0);
