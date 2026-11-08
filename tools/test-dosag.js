/* Engine tests for DOSagEngine against the Streeter-Phelps closed forms */
const E = require('../assets/js/dosag-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Saturation and rates ===');
ok('DOsat 20 C = 9.09', E.dosat(20), 9.09, 0.01);
ok('DOsat 25 C = 8.26', E.dosat(25), 8.26, 0.01);
ok('DOsat 0 C = 14.62', E.dosat(0), 14.62, 0.02);
ok('kd at 20 unchanged', E.kAt(0.23, 1.047, 20), 0.23, 1e-12);
ok('kd at 30 = 0.23 x 1.047^10', E.kAt(0.23, 1.047, 30), 0.23 * Math.pow(1.047, 10), 1e-12);
ok("O'Connor-Dobbins 3.93 u^0.5 / H^1.5", E.oconnor(0.3, 3), 3.93 * Math.sqrt(0.3) / Math.pow(3, 1.5), 1e-12);
ok('BOD5 to ultimate at k 0.23', E.ultimate(200, 0.23), 200 / (1 - Math.exp(-1.15)), 1e-9);
ok('ultimate about 293', E.ultimate(200, 0.23), 292.7, 0.1);

console.log('\n=== Deficit and the critical point ===');
{
  const kd = 0.3, kr = 0.6, L0 = 30, D0 = 1;
  ok('D(0) = D0', E.deficit(0, kd, kr, L0, D0), 1, 1e-12);
  const c = E.critical(kd, kr, L0, D0);
  const tc = Math.log((kr / kd) * (1 - D0 * (kr - kd) / (kd * L0))) / (kr - kd);
  ok('tc closed form', c.tc, tc, 1e-12);
  ok('Dc = (kd/kr) L0 exp(-kd tc)', c.Dc, kd / kr * L0 * Math.exp(-kd * tc), 1e-12);
  ok('Dc equals D(tc)', c.Dc, E.deficit(c.tc, kd, kr, L0, D0), 1e-9);
  const h = 1e-5, slope = (E.deficit(c.tc + h, kd, kr, L0, D0) - E.deficit(c.tc - h, kd, kr, L0, D0)) / (2 * h);
  ok('dD/dt = 0 at tc', slope, 0, 1e-6);
  ok('deficit decays far downstream', E.deficit(40, kd, kr, L0, D0) < 0.05, true);
  const eq = E.critical(0.3, 0.3, 30, 1);
  ok('kr = kd limit tc = (1 - D0/L0)/kd', eq.tc, (1 - 1 / 30) / 0.3, 1e-12);
  ok('kr = kd limit matches a nearly equal kr', E.deficit(2, 0.3, 0.3, 30, 1), E.deficit(2, 0.3, 0.3 + 1e-7, 30, 1), 1e-5);
  const out = E.critical(0.2, 0.8, 5, 6);
  ok('large initial deficit, worst at the outfall', out.atOutfall, true);
  ok('then Dc = D0', out.Dc, 6);
}

console.log('\n=== Mixing ===');
{
  const m = E.mix({ Qw:0.2, Lw:100, DOw:1, Tw:25, Qr:1.8, Lr:2, DOr:8, Tr:20, bod5:false, kd20:0.23 });
  ok('flow adds', m.Q, 2.0, 1e-12);
  ok('BOD mass balance', m.L0, (20 + 3.6) / 2, 1e-12);
  ok('DO mass balance', m.DO0, (0.2 + 14.4) / 2, 1e-12);
  ok('temperature mass balance', m.T, (5 + 36) / 2, 1e-12);
}

console.log('\n=== Solve ===');
{
  const inp = { Qw:0.2, Lw:200, DOw:1, Tw:25, Qr:2.0, Lr:3, DOr:7.8, Tr:26, bod5:true, kd20:0.23, kr20:0.4, od:true, u:0.3, H:2.5, std:4 };
  const r = E.solve(inp);
  ok('ultimate BOD of the mix', r.m.L0, (0.2 * E.ultimate(200, 0.23) + 2 * E.ultimate(3, 0.23)) / 2.2, 1e-9);
  ok('kr from O\'Connor-Dobbins, corrected', r.kr, E.oconnor(0.3, 2.5) * Math.pow(1.024, r.m.T - 20), 1e-12);
  ok('minimum DO = DOsat - Dc', r.DOmin, r.sat - r.Dc, 1e-12);
  ok('distance = u tc', r.xc, 0.3 * r.tc * 86.4, 1e-9);
  ok('untreated sewage drives the river low', r.DOmin < 4, true);
  ok('the allowed load just meets the standard', E.run(Object.assign({}, inp, { Lw:r.allow })).DOmin, 4, 1e-6);
  ok('curve starts at the mixed DO', r.curve[0].DO, r.m.DO0, 1e-9);
  ok('curve minimum agrees with Dc', Math.min(...r.curve.map(q => q.DO)), r.DOmin, 0.02);
  const treated = E.solve(Object.assign({}, inp, { Lw:20 }));
  ok('secondary treatment keeps it above 4', treated.DOmin > 4, true);
  ok('faster shallower river recovers sooner', E.solve(Object.assign({}, inp, { u:0.8, H:1 })).DOmin > r.DOmin, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
