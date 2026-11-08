/* interaction checks for M1 masonry, numbers worked by hand */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // inner leaf: clay group 1, fb 20, M6, cavity 102.5 + 102.5, h 2.7, concrete floors
  const fk = 0.55 * Math.pow(20, 0.7) * Math.pow(6, 0.3), t = 102.5;
  ok('fk', parseFloat(val('fk')), fk, 0.006);
  const tef = Math.cbrt(2 * t ** 3), SR = 2025 / tef;
  ok('hef / tef', parseFloat(val('hef / tef')), SR, 0.06);
  const nrd = e => {
    const ei = Math.max(e + 4.5, 0.05 * t), phiI = 1 - 2 * ei / t;
    const em = 0.6 * e + 4.5, ek = 0.002 * SR * Math.sqrt(t * em), emk = Math.max(em + ek, 0.05 * t);
    const lam = SR / Math.sqrt(1000), A1 = 1 - 2 * emk / t, u = (lam - 0.063) / (0.73 - 1.17 * emk / t);
    return Math.min(phiI, A1 * Math.exp(-u * u / 2)) * t * fk / 2.3;
  };
  ok('NRd with e = 15', parseFloat(val('NRd')), nrd(15), 0.6);
  set('er', 0);
  ok('NRd with e = 0', parseFloat(val('NRd')), nrd(0), 0.6);
  set('er', 15);

  set('code', 'bs', 'change');   // beta = 1.1(1 - 2em/t), em = 0.6 x 15 + t[(SR^2)/2400 - 0.015]
  const ea = t * (SR * SR / 2400 - 0.015), beta = 1.1 * (1 - 2 * (9 + ea) / t);
  ok('BS capacity beta t fk / 3.1', parseFloat(val('NRd')), beta * t * fk / 3.1, 0.6);
  set('code', 'ec6', 'change');

  // panel on four edges: mu = 0.4/1.1, affine height 2.7 / sqrt(mu)
  set('preset', 'panel', 'change');
  const mu = 0.4 / 1.1, a = 4.5, b = 2.7 / Math.sqrt(mu);
  const s = Math.min(a, b), l = Math.max(a, b), r = s / l;
  const qm = 24 / (s * s * (Math.sqrt(3 + r * r) - r) ** 2);
  ok('alpha2 from the yield lines', parseFloat(val('α2')), 1 / (qm * 4.5 * 4.5), 0.00006);
  const m2 = 1.1 / 2.3 * t * t / 6 / 1e3;
  ok('lateral resistance m2 q/m', parseFloat(val('Lateral qRd')), m2 * qm, 0.006);

  set('preset', 'slender', 'change');
  ok('slender wall fails', val('Verdict'), 'Fails');
  ok('slenderness 33 against 27', parseFloat(val('hef / tef')), 33, 0.06);
};
