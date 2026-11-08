/* interaction checks for Tr3 pavement design, recomputed from the formulas */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const t = (CBR, C) => { const P = 40 * 224.809, A = P / (550 * 0.145038);
    return (0.23 * Math.log10(C) + 0.15) * Math.sqrt(P / (8.1 * CBR) - A / Math.PI) * 25.4; };
  const a = Math.sqrt(40000 / (Math.PI * 0.55));
  const eps = (he, Es) => { const R = Math.sqrt(a * a + he * he);
    return 1.4 * 0.55 / Es * (0.2 + 0.8 * he / R - (he / R) ** 3); };

  ok('contact radius', parseFloat(val('Contact radius')), a, 0.5);
  ok('CBR thickness over CBR 5 at 2 msa', parseFloat(val('Thickness needed')), t(5, 2e6), 0.5);
  const he = 0.9 * (100 * Math.cbrt(60) + 200 * 2 + 300 * Math.cbrt(3));
  ok('Odemark depth', parseFloat(val('Odemark depth')), he, 0.5);
  ok('subgrade strain', parseFloat(val('Subgrade strain')), eps(he, 50) * 1e6, 0.5);
  ok('rutting life', parseFloat(val('Rutting life')), 1.365e-9 * Math.pow(eps(he, 50), -4.477) / 1e6, 0.01);
  ok('passes', val('Verdict'), 'Passes');

  set('CBRr', 2);   // soft clay: Es 20 MPa, the thickness needed jumps
  ok('soft subgrade thickness', parseFloat(val('Thickness needed')), t(2, 2e6), 0.5);
  ok('soft subgrade fails', val('Verdict'), 'Fails');
  set('CBRr', 5);

  set('E1r', 6000);   // stiffer asphalt lowers the strain
  const he2 = 0.9 * (100 * Math.cbrt(120) + 200 * 2 + 300 * Math.cbrt(3));
  ok('stiffer asphalt strain', parseFloat(val('Subgrade strain')), eps(he2, 50) * 1e6, 0.5);
};
