/* interaction checks for C5 mix design, numbers worked by hand from the ACI 211.1 tables */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // C25, s 5: fm = 25 + 8.2 = 33.2, w/c = 0.54 - (3.2/5)(0.07) = 0.4952, water 205
  ok('target fm', parseFloat(val('Target fm')), 33.2, 0.05);
  ok('w/c', parseFloat(val('w/c')), 0.4952, 0.0006);
  ok('cement = 205 / 0.4952', parseFloat(val('Cement')), 205 / 0.4952, 0.6);
  ok('stone = 0.63 x 1600', parseFloat(val('Stone')), 1008, 0.5);
  const fine = (1 - 0.205 - (205 / 0.4952) / 3150 - 1008 / 2650 - 0.02) * 2620;
  ok('sand fills the rest', parseFloat(val('Sand')), fine, 1);

  set('sdr', 0);      // fm = 25 wants w/c 0.61, but the preset caps it at 0.60
  ok('no scatter, the 0.60 cap governs', parseFloat(val('Cement')), 205 / 0.60, 0.6);
  ok('durability now governs', sub('w/c'), 'durability governs');
  set('sdr', 3);
  set('method', 'aci', 'change');   // max(25 + 4.02, 25 + 6.99 - 3.45) = 29.02
  ok('ACI target at s 3', parseFloat(val('Target fm')), 29.0, 0.05);
  ok('EN comparison 25 + 4.92', parseFloat(val('EN 206 target')), 29.9, 0.05);
  set('method', 'en', 'change');

  set('dmax', '37.5', 'change');   // water 181, w/c for 29.92 = 0.61 - (4.92/5)(0.07)
  ok('big stone water', parseFloat(val('Water')), 181, 0.5);
  ok('big stone cement', parseFloat(val('Cement')), 181 / (0.61 - 4.92 / 5 * 0.07), 0.6);

  set('preset', 'marine', 'change');   // w/c capped at 0.45, cement 205/0.45
  ok('durability caps w/c', val('w/c'), '0.450');
  ok('durability governs', sub('w/c'), 'durability governs');
  ok('cement from the cap', parseFloat(val('Cement')), 205 / 0.45, 0.6);

  set('wcUserr', 0.7);   // by hand, wetter than both limits
  ok('hand w/c fails', val('Verdict'), 'Fails');
  ok('hand flagged', sub('w/c'), 'set by hand');
};
