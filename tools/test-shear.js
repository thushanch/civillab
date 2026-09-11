/* engine tests for shear-engine.js */
const path = require("path");
const ROOT = path.resolve(__dirname, "../assets/js") + "/";
global.MohrEngine = require(ROOT + 'mohr-engine.js');
const E = require(ROOT + 'shear-engine.js');

let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  tol = tol == null ? 1e-9 : tol;
  const good = (typeof exp === 'number')
    ? (got != null && isFinite(exp) ? Math.abs(got - exp) <= tol : got === exp)
    : got === exp;
  if (good) { pass++; console.log('  ok   ' + name + '  = ' + got); }
  else { fail++; console.log('  FAIL ' + name + '  got ' + got + '  expected ' + exp); }
}
const head = t => console.log('\n' + t);

/* ------------------------------------------------------------------ */
head('1. flow number Nphi = tan^2(45 + phi/2)');
ok('phi = 0  -> 1', E.Nphi(0), 1);
ok('phi = 30 -> 3', E.Nphi(30), 3, 1e-12);
ok('phi = 45 -> (1+sqrt2)^2 = 5.8284', E.Nphi(45), Math.pow(1 + Math.SQRT2, 2), 1e-12);
ok('phi = 60 -> 13.928', E.Nphi(60), (1 + Math.sin(Math.PI / 3)) / (1 - Math.sin(Math.PI / 3)), 1e-12);
// cross check against the tangent form
for (const p of [0, 10, 20, 30, 35, 40]) {
  const t = Math.pow(Math.tan((45 + p / 2) * Math.PI / 180), 2);
  ok('tan form agrees at phi = ' + p, E.Nphi(p), t, 1e-9);
}

head('2. failure criterion sigma1 = sigma3 Nphi + 2c sqrt(Nphi)');
ok('c=0 phi=30 s3=100 -> 300', E.failureS1(0, 30, 100), 300, 1e-9);
ok('c=10 phi=30 s3=100 -> 334.641', E.failureS1(10, 30, 100), 300 + 20 * Math.sqrt(3), 1e-9);
ok('phi=0 cu=50 s3=200 -> 300', E.failureS1(50, 0, 200), 300, 1e-12);
ok('c=0 phi=0 -> s1 = s3', E.failureS1(0, 0, 175), 175, 1e-12);
// with c = 0 the classic sin form must hold: sin(phi) = (s1-s3)/(s1+s3)
{
  const s3 = 120, phi = 32;
  const s1 = E.failureS1(0, phi, s3);
  ok('sin phi = (s1-s3)/(s1+s3)', (s1 - s3) / (s1 + s3), Math.sin(phi * Math.PI / 180), 1e-12);
}

head('3. drained deviator at failure');
ok('c=0 phi=30 s3=100, A=0 -> 200', E.failureDeviator(0, 30, 100, 0), 200, 1e-9);
ok('phi=0 c=50 -> 2c = 100', E.failureDeviator(50, 0, 200, 0), 100, 1e-9);
ok('matches failureS1 - s3', E.failureDeviator(15, 28, 90, 0),
   E.failureS1(15, 28, 90) - 90, 1e-9);

head('4. undrained deviator with Skempton A (B = 1, cell pressure held)');
// c=0, phi=30 (N=3), s3=200, A=1:  sd = 200(3-1)/(1+1(3-1)) = 400/3
ok('A=1 c=0 phi=30 s3=200 -> 133.333', E.failureDeviator(0, 30, 200, 1), 400 / 3, 1e-9);
ok('A=0 falls back to drained', E.failureDeviator(12, 33, 150, 0),
   E.failureS1(12, 33, 150) - 150, 1e-9);
ok('phi=0 gives 2c whatever A is', E.failureDeviator(45, 0, 300, 0.9), 90, 1e-9);
ok('phi=0 gives 2c for negative A too', E.failureDeviator(45, 0, 300, -0.4), 90, 1e-9);
// a negative A (dense sand, heavily overconsolidated clay) raises the strength
ok('A = -0.2 is stronger than A = 0',
   E.failureDeviator(0, 30, 200, -0.2) > E.failureDeviator(0, 30, 200, 0), true);
// if A is negative enough the denominator dies and the sample never fails
ok('A = -0.5 with N = 3 never fails', E.failureDeviator(0, 30, 200, -0.5), Infinity);

head('5. the effective circle is the total circle slid left by u');
{
  const r = E.solve({ mode:'cu', c:0, phi:30, s3:200, A:0.5, sd:100 });
  ok('u = A sd', r.u, 50, 1e-12);
  ok('total centre', r.tot.C, 250, 1e-12);
  ok('total radius', r.tot.R, 50, 1e-12);
  ok('effective centre is 50 to the left', r.eff.C, 200, 1e-12);
  ok('radius unchanged by u', r.eff.R, r.tot.R, 1e-12);
  ok('effective sigma3', r.s3e, 150, 1e-12);
  ok('effective sigma1', r.s1e, 250, 1e-12);
  ok('deviator is the same in both', r.s1e - r.s3e, r.s1 - r.s3, 1e-12);
}

head('6. loading a drained test up to failure');
{
  const base = { mode:'cd', c:0, phi:30, s3:100, A:0, cu:0 };
  const half = E.solve(Object.assign({}, base, { sd:100 }));
  ok('half loaded, not failed', half.failed, false);
  ok('margin is 2 at half the failure deviator', half.margin, 2, 1e-9);
  ok('mobilised phi is below phi', half.phiMob < 30, true);
  // sin(phiMob) = R/C = 50/150 = 1/3  ->  19.471 deg
  ok('mobilised phi = asin(1/3)', half.phiMob, Math.asin(1 / 3) * 180 / Math.PI, 1e-9);

  const at = E.solve(Object.assign({}, base, { sd:200 }));
  ok('at failure', at.failed, true);
  ok('margin is 1', at.margin, 1, 1e-9);
  ok('mobilised phi has reached phi', at.phiMob, 30, 1e-9);
  ok('utilisation is 1', at.utilisation, 1, 1e-9);
  ok('effective s1 at failure', at.s1e, 300, 1e-9);
}

head('7. the tangent point sits on the envelope');
{
  // c=0, phi=30, s3=100 at failure: centre 200, R 100
  const r = E.solve({ mode:'cd', c:0, phi:30, s3:100, A:0, sd:200 });
  const T = r.atFailure.tangent;
  ok('tangent sigma = C - R sin phi', T.s, 200 - 100 * 0.5, 1e-9);
  ok('tangent tau = R cos phi', T.t, 100 * Math.cos(Math.PI / 6), 1e-9);
  ok('tangent lies on tau = c + sigma tan phi', T.t, E.tauF(0, 30, T.s), 1e-9);
  // and with cohesion
  const r2 = E.solve({ mode:'cd', c:20, phi:25, s3:80, A:0, sd:E.failureDeviator(20, 25, 80, 0) });
  const T2 = r2.atFailure.tangent;
  ok('with cohesion, tangent on the envelope', T2.t, E.tauF(20, 25, T2.s), 1e-9);
  // the tangent point must actually be on the circle
  ok('tangent is on the circle',
     Math.hypot(T2.s - r2.atFailure.C, T2.t), r2.atFailure.R, 1e-9);
}

head('8. failure plane at 45 + phi/2 from the major principal plane');
ok('phi = 30 -> 60 deg', E.solve({ mode:'cd', c:0, phi:30, s3:100, A:0, sd:10 }).theta, 60, 1e-12);
ok('phi = 0  -> 45 deg', E.solve({ mode:'uu', cu:50, s3:100, sd:10 }).theta, 45, 1e-12);
ok('phi = 36 -> 63 deg', E.solve({ mode:'cd', c:0, phi:36, s3:100, A:0, sd:10 }).theta, 63, 1e-12);

head('9. unconsolidated undrained, total stress with phi = 0');
{
  const r = E.solve({ mode:'uu', cu:60, s3:150, sd:80 });
  ok('phi is zero', r.phi, 0);
  ok('deviator at failure is 2 cu', r.sdf, 120, 1e-12);
  ok('effective stresses are not known', r.s3e, null);
  ok('pore pressure is not known', r.u, null);
  ok('the envelope acts on the total circle', r.act, r.tot);
  ok('mobilised cohesion is the radius', r.cMob, 40, 1e-12);
  const at = E.solve({ mode:'uu', cu:60, s3:150, sd:120 });
  ok('at failure the radius equals cu', at.tot.R, 60, 1e-12);
  ok('at failure', at.failed, true);
  ok('cell pressure does not change the UU strength',
     E.solve({ mode:'uu', cu:60, s3:400, sd:80 }).sdf, 120, 1e-12);
}

head('10. undrained effective stress path reaches the same envelope');
{
  // c=0, phi=30, s3=200, A=1 -> sd_f = 133.333, u_f = 133.333
  const r = E.solve({ mode:'cu', c:0, phi:30, s3:200, A:1, sd:400 / 3 });
  ok('failed', r.failed, true);
  ok('u at failure', r.u, 400 / 3, 1e-9);
  ok('effective sigma3', r.s3e, 200 - 400 / 3, 1e-9);
  ok('effective sigma1', r.s1e, 200, 1e-9);
  // the effective ratio must be exactly Nphi
  ok('s1e/s3e = Nphi', r.s1e / r.s3e, 3, 1e-9);
  ok('mobilised phi has reached phi', r.phiMob, 30, 1e-9);
  ok('total circle sits to the right of the effective one', r.tot.C > r.eff.C, true);
}

head('11. guards');
{
  const z = E.solve({ mode:'cd', c:0, phi:30, s3:100, A:0, sd:0 });
  ok('zero deviator gives a point circle', z.tot.R, 0, 1e-12);
  ok('zero deviator margin is infinite', z.margin, Infinity);
  ok('negative deviator is clamped to zero', E.solve({ mode:'cd', c:0, phi:30, s3:100, A:0, sd:-50 }).sd, 0);
  const nf = E.solve({ mode:'cu', c:0, phi:30, s3:200, A:-0.6, sd:100 });
  ok('never fails is flagged', nf.neverFails, true);
  ok('never fails has no failure circle', nf.atFailure, null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
