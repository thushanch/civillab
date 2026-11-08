/* interaction checks for C3 RC slab designer, numbers worked by hand */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const tab = t => doc.querySelector(`[data-tab="${t}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  // one way continuous, L 4 m, h 175: gk = 1.5 + 25(0.175) = 5.875, n = 1.35 gk + 1.5(3)
  ok('n', parseFloat(val('Design load n')), 12.43, 0.005);
  // end span 0.086 F L = 0.086 x 12.431 x 16 = 17.11 kNm/m, d = 145, K = M/(b d^2 fck)
  ok('worst K', parseFloat(val('Worst K')), 17.105e6 / (1000 * 145 * 145 * 30), 0.0001);
  // As,min = 0.26 sqrt(30)/500 x 1000 x 145 = 413 governs, H10 at 1000 x 78.5/413 = 190, so 175
  ok('main bars', val('Main span bars'), 'H10 @ 175');
  // V = 0.6 F = 29.8 kN/m against vmin = 0.035 x 2^1.5 x sqrt 30 = 0.542 MPa x 145 = 78.6 kN/m
  ok('support shear', parseFloat(val('Support shear')), 0.6 * 12.43125 * 4, 0.06);
  ok('VRd,c from vmin', sub('Support shear'), 'VRd,c = 78.6 kN/m');

  set('qkn', 5);   // n = 1.35 x 5.875 + 7.5 = 15.43, K = 0.086 x 15.43 x 16 / (630.75)
  ok('K after qk 5', parseFloat(val('Worst K')), 0.086 * 15.43125 * 16e6 / (1000 * 145 * 145 * 30), 0.0001);
  ok('preset went custom', doc.getElementById('preset').value, 'custom');

  set('code', 'bs', 'change');   // n = 1.4 x 5.875 + 1.6 x 5 = 16.225
  ok('BS n', parseFloat(val('Design load n')), 16.23, 0.005);
  set('code', 'ec2', 'change');

  // punching, d = (145 + 135)/2 = 140, u1 = 1600 + 4 pi 140, vEd = 1.15 x 500e3 / (u1 d)
  tab('punch');
  const u1 = 1600 + 4 * Math.PI * 140;
  ok('vEd,1', parseFloat(val('vEd,1')), 1.15 * 500e3 / (u1 * 140), 0.0006);
  // k = 2, vRd,c = 0.12 x 2 x (100 x 0.008 x 30)^1/3 = 0.692
  ok('vRd,c', sub('vEd,1'), 'vRd,c = ' + (0.24 * Math.cbrt(24)).toFixed(3) + ' MPa');
  ok('links needed', val('Punching links'), 'Needed');

  set('preset', 'twoway', 'change');   // case 4, lx 5 ly 6 h 200, sxN = 0.063 at ly/lx 1.2
  const n2 = 1.35 * 6.5 + 1.5 * 3;
  ok('two way worst K is the hogging short strip', parseFloat(val('Worst K')),
     0.063 * n2 * 25e6 / (1000 * 169 * 169 * 30), 0.0001);
  ok('table lists four strips', doc.querySelectorAll('#tablewrap tbody tr').length, 4);
};
