/* interaction checks for St1 steel member capacity */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const E = 210000, G = 81000, SE = w.eval('SteelEngine');

  // 457x191x67 S275, Mc,Rd = Wpl fy
  const s = SE.section('UB', 5);
  ok('Mc,Rd = Wpl fy', parseFloat(val('Mc,Rd')), s.Wply * 275 / 1e6, 0.6);
  ok('Vpl,Rd = Av fy / sqrt 3', parseFloat(val('Vpl,Rd')), s.Av * 275 / Math.sqrt(3) / 1e3, 0.6);
  const mcr = (L, C1) => C1 * Math.PI ** 2 * E * s.Iz / L ** 2 *
    Math.sqrt(s.Iw / s.Iz + L ** 2 * G * s.It / (Math.PI ** 2 * E * s.Iz)) / 1e6;
  ok('Mcr over 3 m with C1 1.127', parseFloat(val('Mcr')), mcr(3000, 1.127), 0.6);
  ok('verdict passes', val('Verdict'), 'Passes');

  set('nRestr', 0);   // no restraint, Lb = 6 m
  ok('Mcr over 6 m', parseFloat(val('Mcr')), mcr(6000, 1.127), 0.6);
  ok('preset went custom', doc.getElementById('preset').value, 'custom');

  // tie: 305x165x40, four 22 mm holes through the flanges
  set('preset', 'tie', 'change');
  const t = SE.section('UB', 2), Anet = t.A - 4 * 22 * 10.2;
  ok('Nu,Rd = 0.9 Anet fu / 1.25', parseFloat(val('Nt,Rd')), 0.9 * Anet * 410 / 1.25 / 1e3, 0.6);
  ok('net fracture governs', sub('Nt,Rd'), 'net fracture');
  set('code', 'bs', 'change');
  ok('BS Pt = py Ke Anet', parseFloat(val('Pt')), 275 * Math.min(1.2 * Anet, t.A) / 1e3, 0.6);
  set('code', 'ec3', 'change');

  // column: 254x254x73 S355, L 4 m, weak axis on curve c
  set('preset', 'column', 'change');
  const c = SE.section('UC', 2);
  const lam = Math.sqrt(c.A * 355 / (Math.PI ** 2 * E * c.Iz / 16e6));
  const ph = 0.5 * (1 + 0.49 * (lam - 0.2) + lam * lam);
  const chi = 1 / (ph + Math.sqrt(ph * ph - lam * lam));
  ok('Nb,z,Rd on curve c', parseFloat(val('Nb,Rd')), chi * c.A * 355 / 1e3, 0.6);

  set('Nr', 3200);
  ok('overloaded column fails', val('Verdict'), 'Fails');
};
