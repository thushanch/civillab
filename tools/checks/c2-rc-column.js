/* interaction checks for C2 RC column designer, numbers worked by hand */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // short preset: 300 x 300, 4H25 (1963.5 mm2), C30/500, NEd 1000, Mx 60, l0 3 m
  const As = 4 * Math.PI * 12.5 * 12.5;
  // uniform strain 0.002 holds the steel at 400 MPa: N0 = 17(Ac - As) + 400 As
  ok('N0 EC2', parseFloat(val('N0')), (17 * (90000 - As) + 400 * As) / 1e3, 1);
  // short: MEd = M + NEd l0/400 = 60 + 1000 x 0.0075
  ok('MEd,x short', parseFloat(val('MEd,x')), 67.5, 0.05);
  const fyd = 500 / 1.15, n = 1000e3 / (90000 * 17), om = As * fyd / (90000 * 17);
  const lim = 20 / 1.2 * Math.sqrt(1 + 2 * om) * 2.2 / Math.sqrt(n);
  ok('lambda / lambda_lim', val('λ / λlim'), (3000 * Math.sqrt(12) / 300).toFixed(1) + ' / ' + lim.toFixed(1));
  ok('verdict passes', val('Verdict'), 'Passes');

  // l0 = 6 m makes it slender, nominal curvature by hand
  set('l0n', 6);
  const lam = 6000 * Math.sqrt(12) / 300, d = 300 - 52.5;
  const Kr = (1 + om - n) / (1 + om - 0.4), Kphi = 1 + (0.35 + 0.15 - lam / 150);
  const e2 = Kr * Kphi * (fyd / 2e5) / (0.45 * d) * 36e6 / 10;
  const M02 = 60 + 15, M01 = -30 + 15;
  const MEd = Math.max(Math.max(0.6 * M02 + 0.4 * M01, 0.4 * M02) + e2, M02, M01 + e2 / 2, 20);
  ok('MEd,x slender', parseFloat(val('MEd,x')), MEd, 0.06);
  ok('slender flagged', doc.querySelector('.chip.warn') !== null, true);
  ok('preset went custom', doc.getElementById('preset').value, 'custom');

  // BS 8110 squash load: 0.45 fcu (Ac - As) + 0.87 fy As with fcu 35
  set('code', 'bs', 'change');
  ok('N0 BS', parseFloat(val('N0')), (15.75 * (90000 - As) + 435 * As) / 1e3, 1);
  ok('EC2 comparison chip', val('EC2 MRd,x') !== '(missing)', true);

  set('code', 'ec2', 'change');
  set('preset', 'biax', 'change');
  doc.querySelector('[data-tab="biax"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('biaxial tab draws a contour', doc.querySelectorAll('#fig path').length > 0, true);
  ok('biaxial below one', parseFloat(val('Biaxial')) < 1, true);
};
