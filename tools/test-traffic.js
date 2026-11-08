/* Engine tests for TrafficEngine against the closed forms */
const E = require('../assets/js/traffic-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const peak = (m, kj) => { let best = 0, kb = 0;
  for (let i = 1; i < 200000; i++) { const k = kj * i / 200000, q = m.q(k); if (q > best) { best = q; kb = k; } }
  return { q: best, k: kb }; };

console.log('=== Greenshields ===');
{
  const m = E.model('greenshields', 100, 150);
  ok('qmax = vf kj / 4 = 3750', m.qmax, 3750);
  ok('at k = kj/2', m.kc, 75);
  ok('speed at capacity vf/2', m.vc, 50);
  ok('q(kc) = qmax', m.q(75), 3750, 1e-9);
  ok('numerical peak agrees', peak(m, 150).q, 3750, 1e-3);
  ok('v = 0 at jam', m.v(150), 0);
  ok('q = 0 at jam', m.q(150), 0);
  ok('v = vf at k = 0', m.v(0), 100);
  ok('q = k v everywhere', m.q(40), 40 * m.v(40), 1e-12);
  ok('inverse speed to density', m.kOfV(60), 60, 1e-12);
  const d = E.densitiesForFlow(100, 150, 2400);
  ok('two densities for one flow, low', m.q(d.low), 2400, 1e-9);
  ok('two densities for one flow, high', m.q(d.high), 2400, 1e-9);
  ok('symmetric about kj/2', d.low + d.high, 150, 1e-12);
  ok('no density beyond capacity', E.densitiesForFlow(100, 150, 4000), null);
}

console.log('\n=== Greenberg and Underwood ===');
{
  const g = E.model('greenberg', 100, 150);
  ok('Greenberg qmax = vm kj / e', g.qmax, 50 * 150 / Math.E, 1e-9);
  ok('at k = kj / e', g.kc, 150 / Math.E, 1e-12);
  ok('Greenberg numerical peak', peak(g, 150).q, g.qmax, 1e-3);
  ok('Greenberg speed at capacity vm', g.v(g.kc), 50, 1e-9);
  const u = E.model('underwood', 100, 150);
  ok('Underwood qmax = vf ko / e', u.qmax, 100 * 75 / Math.E, 1e-9);
  ok('Underwood numerical peak', peak(u, 150).q, u.qmax, 1e-3);
  ok('Underwood never stops', u.v(150) > 0, true);
  ok('Underwood inverse', u.kOfV(u.v(40)), 40, 1e-9);
}

console.log('\n=== States and shockwaves ===');
{
  const r = E.solve({ model:'greenshields', vf:100, kj:150, kA:30, kB:120 });
  ok('state A flow', r.A.q, 30 * 80, 1e-9);
  ok('state B flow', r.B.q, 120 * 20, 1e-9);
  ok('headway = 3600 / q', r.A.headway, 3600 / 2400, 1e-12);
  ok('spacing = 1000 / k', r.A.spacing, 1000 / 30, 1e-12);
  ok('A uncongested', r.A.regime, 'uncongested');
  ok('B congested', r.B.regime, 'congested');
  ok('equal flows, the shock stands still', r.uw, 0, 1e-9);
  const s = E.solve({ model:'greenshields', vf:100, kj:150, kA:40, kB:150 });
  ok('queue forming behind a stop moves upstream', s.uw < 0, true);
  ok('uw = (qB - qA)/(kB - kA)', s.uw, (0 - 40 * (100 - 40 * 100 / 150)) / 110, 1e-9);
  // Greenshields shock speed = vf (1 - (kA + kB)/kj)
  ok('Greenshields shock closed form', s.uw, 100 * (1 - 190 / 150), 1e-9);
  ok('v/c ratio', E.solve({ model:'greenshields', vf:100, kj:150, kA:75, kB:75 }).A.vc, 1, 1e-12);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
