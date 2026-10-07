/* Headless smoke test for C1 RC Beam Designer */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const hp = path.join(ROOT, 'apps/c1-rc-beam/index.html');
let html = fs.readFileSync(hp, 'utf8')
  .replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
    '<script>' + fs.readFileSync(path.resolve(path.dirname(hp), src), 'utf8') + '</script>')
  .replace(/<link[^>]+>/g, '');
const errs = [];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){ w.addEventListener('error', e => errs.push(e.message)); } });
const doc = dom.window.document, w = dom.window;

var pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function near(name, got, exp, tol) {
  if (tol == null) tol = 1;
  var g = typeof got === 'number' ? got : parseFloat(got);
  if (Math.abs(g - exp) <= tol) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + ' +/- ' + tol); }
}
const val = key => {
  var c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.includes(key));
  return c ? c.querySelector('.v').textContent : '(missing)';
};

console.log('=== Boot ===');
ok('no page errors', errs.length === 0);
ok('fig has children', doc.getElementById('fig').children.length > 0);
ok('chips rendered', doc.querySelectorAll('.chip').length >= 6);
ok('controls rendered', doc.getElementById('controls').children.length > 0);

console.log('\n=== Default preset (singly reinforced) ===');
near('K', val('K'), 0.0823, 0.01);
ok('singly label', val('K').indexOf('(missing)') < 0);
near('As,req', val('As,req'), 832, 20);
ok('VRd,c present', val('VRd,c') !== '(missing)');
ok('VRd,max present', val('VRd,max') !== '(missing)');
ok('wk present', val('wk') !== '(missing)');
ok('L/d present', val('L/d') !== '(missing)');

console.log('\n=== Change MEd to 200 ===');
var mSlider = doc.getElementById('MEdr');
mSlider.value = '200';
mSlider.dispatchEvent(new w.Event('input', { bubbles:true }));
near('K after M=200', val('K'), 0.1098, 0.01);

console.log('\n=== Change b to 350 ===');
var bSlider = doc.getElementById('br');
bSlider.value = '350';
bSlider.dispatchEvent(new w.Event('input', { bubbles:true }));
var kStr = val('K');
var kVal = parseFloat(kStr);
ok('K decreased with wider b', kVal < 0.1098);

console.log('\n=== Switch to doubly preset ===');
var preset = doc.getElementById('preset');
preset.value = 'doubly';
preset.dispatchEvent(new w.Event('change', { bubbles:true }));
preset = doc.getElementById('preset');
ok('preset changed', preset.value === 'doubly');
var kNew = val('K');
ok('K > 0.167 (doubly)', parseFloat(kNew) > 0.167);

console.log('\n=== Tab switching ===');
var shearBtn = doc.querySelector('[data-tab="shear"]');
shearBtn.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
ok('shear tab active', doc.querySelector('[data-tab="shear"]').classList.contains('ghost') === false);
ok('VRd,c chip still rendered', val('VRd,c') !== '(missing)');

var deflBtn = doc.querySelector('[data-tab="deflection"]');
deflBtn.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
ok('deflection tab active', doc.querySelector('[data-tab="deflection"]').classList.contains('ghost') === false);

var crackBtn = doc.querySelector('[data-tab="cracking"]');
crackBtn.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
ok('cracking tab active', doc.querySelector('[data-tab="cracking"]').classList.contains('ghost') === false);

console.log('\n=== VEd change ===');
var flexBtn = doc.querySelector('[data-tab="flexure"]');
flexBtn.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
var vSlider = doc.getElementById('VEdr');
vSlider.value = '300';
vSlider.dispatchEvent(new w.Event('input', { bubbles:true }));
var vrdmax = parseFloat(val('VRd,max'));
ok('VRd,max is a number', !isNaN(vrdmax) && vrdmax > 0);

console.log('\n=== Cantilever preset ===');
preset = doc.getElementById('preset');
preset.value = 'cant';
preset.dispatchEvent(new w.Event('change', { bubbles:true }));
var ldStr = val('L/d');
ok('L/d present after cant', ldStr !== '(missing)');

console.log('\n=== Code toggle to BS ===');
var codeSel = doc.getElementById('code');
codeSel.value = 'bs';
codeSel.dispatchEvent(new w.Event('change', { bubbles:true }));
ok('BS chips appear', val('BS K') !== '(missing)');
ok('BS As present', val('BS As') !== '(missing)');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
