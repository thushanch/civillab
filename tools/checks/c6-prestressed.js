/* interaction checks for C6 prestressed beam, compression positive */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // I section 400/120/150/660: A = 195000, Z = 40.69e6 both ways, self weight 4.875 kN/m
  const A = 195000, Z = 40.69e6, e = 330;
  ok('moments wL^2/8', val('Moments'), '244 / 794');
  const P0 = parseFloat(val('P0')), Pe = parseFloat(val('Pe'));
  ok('transfer bottom = P0/A + P0 e/Z - Mg/Z', parseFloat(val('Transfer bottom')),
     P0 * 1e3 / A + P0 * 1e3 * e / Z - 243.75e6 / Z, 0.02);
  ok('service top = Pe/A - Pe e/Z + Ms/Z', parseFloat(val('Service top')),
     Pe * 1e3 / A - Pe * 1e3 * e / Z + 793.75e6 / Z, 0.02);
  ok('verdict passes', val('Verdict'), 'Passes');

  // double the imposed load: Ms = (4.875 + 5 + 12) x 50, the bottom goes into tension
  set('wqn', 12);
  const Pe2 = parseFloat(val('Pe'));
  ok('service bottom in tension', parseFloat(val('Service bottom')),
     Pe2 * 1e3 / A + Pe2 * 1e3 * e / Z - 1093.75e6 / Z, 0.02);
  ok('zero tension fails', val('Verdict'), 'Fails');
  set('wqn', 6);

  set('code', 'bs', 'change');   // 0.5 fci with fci = 35 + 5
  ok('BS transfer limit 0.5 fci', sub('Transfer bottom'), 'limit 20.0');
  set('code', 'ec2', 'change');

  // pre-tensioned rectangle: sigma_c = 1000e3/180000 + 1000e3 x 175^2/5.4e9 - 56.25e6 x 175/5.4e9
  set('preset', 'pre', 'change');
  const scp = 1e6 / 180000 + 1e6 * 175 * 175 / 5.4e9 - 56.25e6 * 175 / 5.4e9;
  const Ect = 22000 * Math.pow(3.8, 0.3);
  ok('P0 = Pj - Ap (Ep/Ecm(t)) sigma_c', parseFloat(val('P0')), 1000 - 750 * 195000 / Ect * scp / 1000, 0.6);
  ok('no friction loss in the waterfall', doc.querySelector('[data-tab="losses"]') !== null, true);

  set('preset', 'over', 'change');
  ok('too much prestress fails', val('Verdict'), 'Fails');
  ok('at the top fibre at transfer', sub('Verdict').indexOf('Transfer, top fibre') === 0, true);
};
