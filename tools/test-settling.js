/* Engine tests for SettlingEngine: water properties, Stokes, transitional drag,
   and the ideal settling tank */
const E = require('../assets/js/settling-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Water ===');
ok('density at 20 C = 998.2', E.rhoW(20), 998.2, 0.05);
ok('density at 4 C = 1000.0', E.rhoW(4), 1000.0, 0.01);
ok('viscosity at 20 C = 1.002e-3', E.muW(20), 1.002e-3, 0.002e-3);
ok('viscosity at 10 C = 1.307e-3', E.muW(10), 1.307e-3, 0.01e-3);
ok('viscosity at 30 C = 0.798e-3', E.muW(30), 0.798e-3, 0.005e-3);

console.log('\n=== Stokes ===');
{
  const s = E.settle(0.1, 2650, 20);
  const exp = 9.81 * (2650 - E.rhoW(20)) * 1e-8 / (18 * E.muW(20));
  ok('vs = g (rho_s - rho_w) d^2 / 18 mu', s.vStokes, exp, 1e-15);
  ok('0.1 mm sand about 9.0 mm/s', s.v * 1000, 8.99, 0.02);
  ok('Re below 1, Stokes holds', s.ReS < 1, true);
  ok('regime Stokes', s.regime, 'Stokes');
  ok('vs scales with d^2', E.settle(0.05, 2650, 20).v / s.v, 0.25, 1e-12);
  ok('colder water settles slower', E.settle(0.05, 2650, 5).v < E.settle(0.05, 2650, 25).v, true);
  ok('lighter floc settles slower', E.settle(0.1, 1100, 20).v < s.v, true);
}

console.log('\n=== Transitional drag ===');
{
  const s = E.settle(1, 2650, 20);
  ok('Stokes would give Re far above 1', s.ReS > 100, true);
  ok('regime transitional', s.regime, 'transitional');
  ok('much slower than Stokes', s.v < 0.3 * s.vStokes, true);
  const Cd = 24 / s.Re + 3 / Math.sqrt(s.Re) + 0.34;
  ok('self consistent with its own drag', s.v, Math.sqrt(4 * 9.81 * (2650 - s.rw) * 1e-3 / (3 * Cd * s.rw)), 1e-9);
  ok('1 mm sand about 0.15 m/s', s.v, 0.15, 0.03);
}

console.log('\n=== Ideal tank ===');
{
  const t = E.tank({ Q:10000, L:30, W:10, H:3 });
  ok('overflow rate Q / LW = 33.3 m/d', t.vomd, 10000 / 300, 1e-9);
  ok('in m/s', t.vo, 10000 / 300 / 86400, 1e-15);
  ok('horizontal velocity Q / WH', t.vh, 10000 / 30 / 86400, 1e-15);
  ok('detention 2.16 h', t.t, 900 / 10000 * 24, 1e-12);
  ok('fast particle wholly removed', E.removal(1e-3, t.vo), 1);
  ok('slow particle removed in vs / vo', E.removal(t.vo / 4, t.vo), 0.25, 1e-12);
  // depth does not matter for an ideal tank
  ok('overflow rate independent of depth', E.tank({ Q:10000, L:30, W:10, H:5 }).vo, t.vo, 1e-18);
}

console.log('\n=== Solve ===');
{
  const r = E.solve({ d:0.02, rhos:2650, T:20, Q:10000, L:30, W:10, H:3 });
  ok('removal fraction vs / vo', r.R, Math.min(1, r.main.v / r.tk.vo), 1e-12);
  ok('critical diameter carries vs = vo', E.settle(r.dcrit, 2650, 20).v, r.tk.vo, 1e-12);
  ok('overall averages the classes', r.overall, r.classes.reduce((a, c) => a + c.frac, 0) / r.classes.length, 1e-12);
  ok('scour velocity', r.vc, Math.sqrt(8 * 0.05 * (2650 / r.main.rw - 1) * 9.81 * 2e-5 / 0.025), 1e-12);
  ok('doubling Q halves the removal of slow particles', E.solve({ d:0.01, rhos:2650, T:20, Q:20000, L:30, W:10, H:3 }).R,
     E.solve({ d:0.01, rhos:2650, T:20, Q:10000, L:30, W:10, H:3 }).R / 2, 1e-12);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
