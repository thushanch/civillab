/* interaction checks for En2 sedimentation, recomputed from Stokes and Vogel */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const mu = T => 2.414e-5 * Math.pow(10, 247.8 / (T + 133.15));
  const rho = T => 1000 * (1 - (T + 288.9414) / (508929.2 * (T + 68.12963)) * (T - 3.9863) ** 2);
  const vs = (dmm, T) => 9.81 * (2650 - rho(T)) * (dmm / 1000) ** 2 / (18 * mu(T));
  const vo = 10000 / 300 / 86400;

  ok('Stokes velocity of 20 micron silt', parseFloat(val('Settling velocity')), vs(0.02, 25), 0.006e-4);
  ok('overflow rate 33.33 m/d', parseFloat(val('Overflow rate')), 33.33, 0.006);
  ok('caught', val('Verdict'), 'Caught');

  set('dn', 0.01);   // a quarter of the velocity, removed in vs / vo
  ok('10 micron carried over', val('Verdict'), 'Carried over');
  ok('removed in the fraction vs/vo', parseFloat(sub('Verdict')), vs(0.01, 25) / vo * 100, 0.6);

  set('preset', 'cold', 'change');   // viscosity at 5 C is far higher
  ok('viscosity at 5 C', parseFloat(val('Viscosity')), mu(5) * 1000, 0.0006);
  ok('cold silt fraction', parseFloat(sub('Verdict')), vs(0.02, 5) / vo * 100, 0.6);

  set('preset', 'grit', 'change');   // 0.2 mm sand breaks Stokes
  ok('grit is transitional', sub('Reynolds number'), 'transitional');
  ok('and still caught', val('Verdict'), 'Caught');

  set('preset', 'clar', 'change');
  set('Qr', 20000);
  ok('doubling Q doubles the overflow rate', parseFloat(val('Overflow rate')), 66.67, 0.006);
};
