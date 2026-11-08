/* Engine tests for PrestressEngine, hand values from first principles and
   EN 1992-1-1 5.10, 3.1.2 and BS 8110-1 4.3. Compression positive. */
const E = require('../assets/js/prestress-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const rect = { A:180000, I:5.4e9, Ztop:18e6, Zbot:18e6, ytop:300, ybot:300 };

console.log('=== Material ===');
ok('Ecm(30) = 22(3.8)^0.3 GPa', E.Ecm(30), 22000 * Math.pow(3.8, 0.3), 1e-9);
ok('Ecm(30) about 32.8 GPa', E.Ecm(30) / 1000, 32.84, 0.01);
ok('fctm(30) = 2.90', E.fctm(30), 2.896, 0.001);

console.log('\n=== Fibre stresses, 300 x 600 ===');
ok('P/A - Pe/Z at the top', E.fibre(1000, 150, 0, rect, -1), 1e6 / 180000 - 1e6 * 150 / 18e6, 1e-12);
ok('top = -2.78 MPa, tension', E.fibre(1000, 150, 0, rect, -1), -2.778, 0.001);
ok('bottom = 13.89 MPa', E.fibre(1000, 150, 0, rect, +1), 13.889, 0.001);
ok('concentric force is uniform', E.fibre(1000, 0, 0, rect, -1), E.fibre(1000, 0, 0, rect, +1), 1e-12);
ok('sagging moment adds M/Z at the top', E.fibre(1000, 150, 100, rect, -1) - E.fibre(1000, 150, 0, rect, -1), 100e6 / 18e6, 1e-12);
ok('and removes it at the bottom', E.fibre(1000, 150, 100, rect, +1) - E.fibre(1000, 150, 0, rect, +1), -100e6 / 18e6, 1e-12);
ok('top + bottom = 2P/A for a symmetric section', E.fibre(800, 120, 60, rect, -1) + E.fibre(800, 120, 60, rect, +1), 2 * 8e5 / 180000, 1e-12);

console.log('\n=== Allowable stresses ===');
{
  const a = E.limits('ec2', 'post', 50, 35, 'zero');
  ok('EC2 transfer 0.6 fck(t)', a.trC, 21);
  ok('EC2 transfer tension fctm(t)', a.trT, -E.fctm(35), 1e-12);
  ok('EC2 service 0.6 fck', a.svC, 30);
  ok('EC2 zero tension in service', a.svT, 0);
  const b = E.limits('bs', 'pre', 45, 35, 'fctm');
  ok('BS transfer 0.5 fci, fci = fck(t) + 5', b.trC, 20);
  ok('BS class 2 pre-tensioned transfer 0.45 sqrt fci', b.trT, -0.45 * Math.sqrt(40), 1e-12);
  ok('BS service 0.33 fcu', b.svC, 0.33 * 50, 1e-12);
  ok('BS class 2 post-tensioned 0.36 sqrt fcu', E.limits('bs', 'post', 45, 35, 'fctm').svT, -0.36 * Math.sqrt(50), 1e-12);
  ok('BS class 1 transfer 1 MPa', E.limits('bs', 'post', 45, 35, 'zero').trT, -1);
}

console.log('\n=== Friction and draw-in ===');
{
  const base = { type:'post', Pj:1000, Ap:1000, Ep:195000, L:20, e:250, eEnd:50, mu:0.19, k:0.005, slip:6,
                 fck:50, fckt:35, fpk:1860, rho1000:2.5, ecs:0, phi:0 };
  const l = E.losses(base, rect, 0, 0);
  ok('theta to midspan = 4 x drape / L', l.theta, 4 * 200 / 20000, 1e-15);
  ok('friction = Pmax(1 - exp(-mu(theta + kx)))', l.dFric, 1000 * (1 - Math.exp(-0.19 * (0.04 + 0.05))), 1e-9);
  ok('friction about 16.95 kN', l.dFric, 16.95, 0.01);
  // p = 1.695 N/mm, lset = sqrt(6 x 195000 x 1000 / 1.695) = 26.3 m > L: whole tendon shifts
  const p = l.dFric * 1e3 / 10000, area = 6 * 195000 * 1000;
  ok('lset = sqrt(slip Ep Ap / p)', l.lset, Math.sqrt(area / p), 1e-6);
  ok('past the far end: pL + (area - pL^2)/L', l.dSet, (p * 20000 + (area - p * 4e8) / 20000) / 1e3, 1e-9);
  const steep = E.losses(Object.assign({}, base, { mu:0.3, k:0.01, e:450, eEnd:-200, slip:4 }), rect, 0, 0);
  const p2 = steep.dFric * 1e3 / 10000;
  ok('steeper friction keeps lset inside the span', steep.lset < 20000, true);
  ok('then dSet = 2p(lset - L/2)', steep.dSet, steep.lset > 10000 ? 2 * p2 * (steep.lset - 10000) / 1e3 : 0, 1e-9);
  const pre = E.losses(Object.assign({}, base, { type:'pre' }), rect, 0, 0);
  ok('pre-tensioned has no friction', pre.dFric, 0);
  ok('pre-tensioned has no draw-in', pre.dSet, 0);
}

console.log('\n=== Elastic shortening ===');
{
  const base = { type:'pre', Pj:1000, Ap:1000, Ep:195000, L:10, e:150, eEnd:150, mu:0.19, k:0.005, slip:6,
                 fck:50, fckt:35, fpk:1860, rho1000:2.5, ecs:0, phi:0 };
  const Mg = 56.25;
  const l = E.losses(base, rect, Mg, Mg);
  const scp = 1e6 / 180000 + 1e6 * 150 * 150 / 5.4e9 - 56.25e6 * 150 / 5.4e9;
  ok('sigma_c at the tendon', l.scp, scp, 1e-12);
  ok('dPel = Ap Ep/Ecm(t) sigma_c', l.dEl, 1000 * 195000 / E.Ecm(35) * scp / 1000, 1e-9);
  const post = E.losses(Object.assign({}, base, { type:'post', mu:0, k:0, slip:0 }), rect, Mg, Mg);
  ok('sequential post-tensioning halves it', post.dEl, l.dEl / 2, 1e-9);
  ok('P0 = Pj - dPel when pre-tensioned', l.P0, 1000 - l.dEl, 1e-9);
}

console.log('\n=== Long term losses, eq 5.46 ===');
{
  const base = { type:'pre', Pj:1000, Ap:1000, Ep:195000, L:10, e:150, eEnd:150, mu:0, k:0, slip:0,
                 fck:50, fckt:35, fpk:1860, rho1000:2.5, ecs:400e-6, phi:2 };
  const l = E.losses(base, rect, 56.25, 80);
  const spi = l.P0 * 1e3 / 1000, mu = spi / 1860;
  const dRel = spi * 0.66 * 2.5 * Math.exp(9.1 * mu) * Math.pow(500, 0.75 * (1 - mu)) * 1e-5;
  ok('relaxation from eq 3.29', l.dRel, dRel, 1e-9);
  const Ec = E.Ecm(50);
  const scQP = l.P0 * 1e3 / 180000 + l.P0 * 1e3 * 22500 / 5.4e9 - 80e6 * 150 / 5.4e9;
  const num = 400e-6 * 195000 + 0.8 * dRel + 195000 / Ec * 2 * scQP;
  const den = 1 + 195000 / Ec * (1000 / 180000) * (1 + 180000 * 22500 / 5.4e9) * (1 + 0.8 * 2);
  ok('eq 5.46 loss', l.dLong, 1000 * num / den / 1000, 1e-9);
  ok('the three parts add up', l.dShr + l.dRelx + l.dCreep, l.dLong, 1e-9);
  ok('shrinkage part = Ap ecs Ep / den', l.dShr, 1000 * 400e-6 * 195000 / den / 1000, 1e-9);
  ok('Pe = P0 - long term', l.Pe, l.P0 - l.dLong, 1e-9);
  ok('eta between 0.7 and 1', l.eta > 0.7 && l.eta < 1, true);
  const none = E.losses(Object.assign({}, base, { ecs:0, phi:0, rho1000:0 }), rect, 56.25, 80);
  ok('no shrinkage, creep or relaxation, no long term loss', none.dLong, 0, 1e-12);
}

console.log('\n=== Magnel region and the force range ===');
{
  const r = E.solve({ code:'ec2', type:'pre', shape:'rect', dims:{ b:300, h:600 }, L:10, wsdl:2, wq:8, psi2:0.3,
                      Pj:1000, Ap:1000, Ep:195000, e:175, eEnd:175, mu:0, k:0, slip:0,
                      fck:50, fckt:35, fpk:1860, rho1000:2.5, ecs:400e-6, phi:2, mode:'zero', cp:100 });
  ok('self weight = A x 25', r.wg, 4.5, 1e-12);
  ok('Mg = wg L^2/8', r.Mg, 56.25, 1e-12);
  ok('Ms = total L^2/8', r.Ms, 14.5 * 12.5, 1e-12);
  ok('Mqp uses psi2', r.Mqp, (4.5 + 2 + 2.4) * 12.5, 1e-12);
  ok('region is not empty', r.mg.poly.length >= 3, true);
  // the force range at e must reproduce the fibre checks at its ends
  const pr = r.pr;
  ok('force range found', pr.ok, true);
  const lim = r.lim, eta = r.ls.eta, sec = r.sec;
  const worst = P0 => Math.min(
    E.fibre(P0, 175, r.Mg, sec, -1) - lim.trT, lim.trC - E.fibre(P0, 175, r.Mg, sec, +1),
    E.fibre(eta * P0, 175, r.Ms, sec, +1) - lim.svT, lim.svC - E.fibre(eta * P0, 175, r.Ms, sec, -1),
    lim.trC - E.fibre(P0, 175, r.Mg, sec, -1), E.fibre(P0, 175, r.Mg, sec, +1) - lim.trT,
    lim.svC - E.fibre(eta * P0, 175, r.Ms, sec, +1), E.fibre(eta * P0, 175, r.Ms, sec, -1) - lim.svT);
  ok('at Pmin the tightest limit is just met', worst(pr.Pmin), 0, 1e-6);
  ok('at Pmax the tightest limit is just met', worst(pr.Pmax), 0, 1e-6);
  ok('between them every limit has room', worst((pr.Pmin + pr.Pmax) / 2) > 0, true);
  ok('jacking stress ratio = Pj/Ap / min(0.8fpk, 0.792fpk)', r.jack, 1000 / (0.9 * 0.88 * 1860), 1e-12);
  ok('service bottom stress', r.st.svBot, E.fibre(r.ls.Pe, 175, r.Ms, sec, +1), 1e-12);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
