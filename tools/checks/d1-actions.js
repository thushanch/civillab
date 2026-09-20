/* Headless smoke test for D1 Actions and Load Combinations */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || path.resolve(__dirname, '../..');
const APP = 'apps/d1-actions';
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
    else { fail++; console.log('  FAIL ' + name + ' got "' + got + '" expected "' + exp + '"'); }
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

console.log('\n=== Default preset (office: Gk=5, Qk=2.5, Cat B) ===');
{
  // 6.10: 1.35*5 + 1.5*2.5 = 6.75 + 3.75 = 10.5
  ok('6.10 default', parseFloat(val('Eq 6.10')), 10.5, 0.02);

  // 6.10a: 1.35*5 + 1.5*0.7*2.5 = 6.75 + 2.625 = 9.375
  ok('6.10a default', parseFloat(val('Eq 6.10a')), 9.375, 0.02);

  // 6.10b: 0.925*1.35*5 + 1.5*2.5 = 6.24375 + 3.75 = 9.99375
  ok('6.10b default', parseFloat(val('Eq 6.10b')), 9.99, 0.02);

  // SLS: 5 + 2.5 = 7.5
  ok('SLS char default', parseFloat(val('SLS Char')), 7.5, 0.02);

  // SLS freq: 5 + 0.5*2.5 = 6.25
  ok('SLS Freq default', parseFloat(val('SLS Freq')), 6.25, 0.02);

  // SLS qp: 5 + 0.3*2.5 = 5.75
  ok('SLS Q-P default', parseFloat(val('SLS Q-P')), 5.75, 0.02);

  // BS: 1.4*5 + 1.6*2.5 = 7 + 4 = 11
  ok('BS ULS default', parseFloat(val('BS ULS')), 11.0, 0.02);
}

console.log('\n=== Change Gk ===');
{
  setInput('Gk', 10);
  // 6.10: 1.35*10 + 1.5*2.5 = 13.5 + 3.75 = 17.25
  ok('6.10 after Gk change', parseFloat(val('Eq 6.10')), 17.25, 0.02);
}

console.log('\n=== Change Qk1 ===');
{
  setInput('Qk1', 8);
  // 6.10: 1.35*10 + 1.5*8 = 13.5 + 12 = 25.5
  ok('6.10 after Qk change', parseFloat(val('Eq 6.10')), 25.5, 0.02);
}

console.log('\n=== Switch to storage preset ===');
{
  setSelect('preset', 'storage');
  ok('chips re-rendered', doc.querySelectorAll('.chip').length > 5, true);
  // storage: Gk=6, Qk=7.5, Cat E
  // 6.10: 1.35*6 + 1.5*7.5 = 8.1 + 11.25 = 19.35
  ok('6.10 storage', parseFloat(val('Eq 6.10')), 19.35, 0.02);

  // 6.10a should equal 6.10 because psi0=1 for Cat E
  ok('6.10a = 6.10 for storage', val('Eq 6.10a'), val('Eq 6.10'));
}

console.log('\n=== Switch to roof preset (wind + snow) ===');
{
  setSelect('preset', 'roof');
  // Gk=3, Qk1=0.6 Cat H, Qk2=1.2 wind, Qk3=0.5 snow
  // 6.10: 1.35*3 + 1.5*0.6 + 1.5*0.5*1.2 + 1.5*0.5*0.5
  //      = 4.05 + 0.9 + 0.9 + 0.375 = 6.225
  ok('6.10 roof', parseFloat(val('Eq 6.10')), 6.225, 0.02);

  // SLS char: 3 + 0.6 + 0.5*1.2 + 0.5*0.5 = 3 + 0.6 + 0.6 + 0.25 = 4.45
  ok('SLS char roof', parseFloat(val('SLS Char')), 4.45, 0.02);
}

console.log('\n=== Change building category to Cat C ===');
{
  setSelect('preset', 'office');
  setSelect('cat1', 'C');
  // Gk=5, Qk=2.5, Cat C: psi0=0.7, same as B so 6.10 unchanged
  ok('6.10 with Cat C', parseFloat(val('Eq 6.10')), 10.5, 0.02);
  // but psi1=0.7 for C vs 0.5 for B, so SLS freq changes
  // SLS freq: 5 + 0.7*2.5 = 6.75
  ok('SLS Freq Cat C', parseFloat(val('SLS Freq')), 6.75, 0.02);
}

console.log('\n=== Saving percentage shown ===');
{
  setSelect('preset', 'office');
  var saving = val('6.10a/b saving');
  ok('saving chip exists', saving !== '(missing)', true);
  ok('saving is positive', parseFloat(saving) > 0, true);
}

console.log('\n=== Add wind to office ===');
{
  setInput('Qk2', 1.0);
  var before610 = parseFloat(val('Eq 6.10'));
  // 6.10: 1.35*5 + 1.5*2.5 + 1.5*0.5*1.0 = 10.5 + 0.75 = 11.25
  ok('6.10 with wind added', before610, 11.25, 0.02);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + errs.length + ' page errors');
if (errs.length) console.log('errors:', errs);
process.exit(fail || errs.length ? 1 : 0);
