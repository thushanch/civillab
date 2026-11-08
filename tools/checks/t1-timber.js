/* interaction checks for T1 timber, numbers worked by hand */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // C24 47 x 200 joists, load sharing: fm,d = 0.8 x 1.1 x 24 / 1.3
  ok('fm,d with ksys', parseFloat(val('fm,d')), 0.8 * 1.1 * 24 / 1.3, 0.006);
  ok('sigma_m = 1.4 x 1.5 x 3.6^2/8 / (47 x 200^2/6)', parseFloat(val('σm')), 1.4 * 1.5 * 12.96 / 8 * 1e6 / (47 * 40000 / 6), 0.006);
  const lef = 0.9 * 3600 + 400, scrit = 0.78 * 47 * 47 * 7400 / (200 * lef);
  ok('kcrit = 1.56 - 0.75 lambda_rel,m', parseFloat(val('kcrit')), 1.56 - 0.75 * Math.sqrt(24 / scrit), 0.0006);

  const ks = doc.getElementById('ksys'); ks.checked = false;
  ks.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('fm,d without ksys', parseFloat(val('fm,d')), 0.8 * 24 / 1.3, 0.006);
  set('service', '3', 'change');
  ok('service class 3 kmod 0.65', val('kmod'), '0.65');

  set('code', 'bs', 'change');   // 7.5 x K3 1.25 x K7 (300/200)^0.11, K8 off now
  ok('BS permissible bending', parseFloat(val('σm,adm')), 7.5 * 1.25 * Math.pow(1.5, 0.11) * 0.8, 0.006);
  set('code', 'ec5', 'change');

  // post 100 x 100, 2.7 m: lambda = 93.5, lambda_rel = 1.586, kc = 0.344
  set('preset', 'post', 'change');
  const lam = 2700 * Math.sqrt(12) / 100, lr = lam / Math.PI * Math.sqrt(21 / 7400);
  const k = 0.5 * (1 + 0.2 * (lr - 0.3) + lr * lr);
  ok('kc for the post', parseFloat(val('kc')), 1 / (k + Math.sqrt(k * k - lr * lr)), 0.0006);

  set('preset', 'crush', 'change');
  ok('the soft support fails', val('Verdict'), 'Fails');
  ok('in bearing', sub('Verdict').indexOf('Bearing across the grain') === 0, true);
};
