/* interaction checks for Tr2 highway alignment, AASHTO 2011 metric */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const ssd = (V, G) => 0.278 * V * 2.5 + V * V / (254 * (3.4 / 9.81 + G / 100));

  ok('SSD at 100 km/h', parseFloat(val('SSD')), ssd(100, 0), 0.5);
  ok('Rmin = 100^2 / 127(0.08 + 0.12)', parseFloat(val('Rmin')), 1e4 / (127 * 0.2), 0.5);
  ok('M needed = R(1 - cos(S/2R))', parseFloat(val('M needed')), 500 * (1 - Math.cos(ssd(100, 0) / 1000)), 0.06);
  ok('crest Lmin = A S^2 / 658', parseFloat(val('Crest Lmin')), 5 * ssd(100, 0) ** 2 / 658, 0.5);
  ok('passes', val('Verdict'), 'Passes');

  set('Vr', 110);   // fmax 0.11: Rmin = 12100 / (127 x 0.19) = 501 > 500
  ok('Rmin at 110 km/h', parseFloat(val('Rmin')), 12100 / (127 * 0.19), 0.5);
  ok('radius now too small', val('Verdict'), 'Fails');
  set('Vr', 100);

  set('Gr', -6);    // braking on a 6 per cent downgrade
  ok('SSD on a downgrade', parseFloat(val('SSD')), ssd(100, -6), 0.5);

  set('preset', 'sag', 'change');   // A = 7, L = A S^2 / (120 + 3.5S)
  const S = ssd(90, 0);
  ok('sag Lmin', parseFloat(val('Sag Lmin')), 7 * S * S / (120 + 3.5 * S), 0.5);
  ok('the 200 m sag is too short', val('Verdict'), 'Fails');
};
