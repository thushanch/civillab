/* Engine tests for AlignmentEngine against the AASHTO 2011 metric relationships */
const E = require('../assets/js/alignment-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Stopping sight distance ===');
{
  const s = E.ssd(100, 2.5, 3.4, 0);
  ok('reaction 0.278 V t', s.react, 69.5, 1e-9);
  ok('braking V^2 / (254 a/g)', s.brake, 10000 / (254 * 3.4 / 9.81), 1e-9);
  ok('SSD 183 m at 100 km/h (table 185)', s.S, 183.1, 0.2);
  ok('SSD at 50 km/h about 63 m (table 65)', E.ssd(50, 2.5, 3.4, 0).S, 63.15, 0.2);
  ok('downhill braking is longer', E.ssd(100, 2.5, 3.4, -6).brake > s.brake, true);
  ok('uphill braking is shorter', E.ssd(100, 2.5, 3.4, 6).brake < s.brake, true);
}

console.log('\n=== Radius ===');
ok('Rmin = V^2 / 127(e + f), 394 m at 100, e 8%', E.rmin(100, 0.08, 0.12), 393.7, 0.1);
ok('fmax 0.12 at 100 km/h', E.fmax(100), 0.12, 1e-12);
ok('fmax interpolated at 65', E.fmax(65), 0.16, 1e-12);
ok('fmax falls with speed', E.fmax(120) < E.fmax(60), true);

console.log('\n=== Horizontal sight line offset ===');
{
  const M = E.hso(400, 183, 1000);
  ok('M = R(1 - cos(S/2R))', M, 400 * (1 - Math.cos(183 / 800)), 1e-12);
  ok('about S^2 / 8R for flat curves', M, 183 * 183 / 3200, 0.05);
  ok('round trip offset to sight distance', E.sightFromOffset(400, M, 1000), 183, 1e-6);
  const Lc = 120;
  ok('S beyond the curve uses the long form', E.hso(400, 183, Lc), 400 * (1 - Math.cos(Lc / 800)) + (183 - Lc) / 2 * Math.sin(Lc / 800), 1e-12);
  ok('long form joins the short one at S = Lc', E.hso(400, Lc, Lc), 400 * (1 - Math.cos(Lc / 800)), 1e-12);
}

console.log('\n=== Vertical curves ===');
{
  // crest A = 5, S = 183: L = 5 x 183^2 / 658 = 254.5 > S
  ok('crest S < L', E.crestL(5, 183), 5 * 183 * 183 / 658, 1e-9);
  ok('crest K = L / A about 51 (table 52)', E.crestL(5, 183) / 5, 50.9, 0.1);
  // small A: S > L form
  ok('crest S > L clipped at zero', E.crestL(1, 183), Math.max(0, 2 * 183 - 658), 1e-9);
  ok('crest S > L positive case', E.crestL(2.5, 183), 2 * 183 - 658 / 2.5, 1e-9);
  ok('crest round trip L to S', E.crestS(5, E.crestL(5, 183)), 183, 1e-6);
  ok('sag S < L', E.sagL(6, 183), 6 * 183 * 183 / (120 + 3.5 * 183), 1e-9);
  ok('sag K = S^2/(120 + 3.5S) = 44.0 (table 45)', E.sagL(6, 183) / 6, 44.04, 0.05);
  ok('sag round trip', E.sagS(6, E.sagL(6, 183)), 183, 1e-6);
  ok('sag S > L', E.sagL(1.5, 183), Math.max(0, 2 * 183 - (120 + 3.5 * 183) / 1.5), 1e-9);
  ok('no curve needed with no grade change', E.crestL(0, 183), 0);
}

console.log('\n=== Solve ===');
{
  const r = E.solve({ V:100, t:2.5, a:3.4, G:0, e:0.08, fAuto:true, f:0.12, R:450, delta:40, M:8, g1:3, g2:-2, L:300 });
  ok('crest detected', r.crest, true);
  ok('A = 5', r.A, 5);
  ok('curve length R delta', r.Lc, 450 * 40 * Math.PI / 180, 1e-9);
  ok('radius check', r.u.radius, E.rmin(100, 0.08, 0.12) / 450, 1e-12);
  ok('vertical check Lmin / L', r.u.vsight, E.crestL(5, r.sd.S) / 300, 1e-12);
  ok('horizontal check SSD / available', r.u.hsight, r.sd.S / E.sightFromOffset(450, 8, r.Lc), 1e-12);
  const sag = E.solve({ V:100, t:2.5, a:3.4, G:0, e:0.08, fAuto:true, f:0.12, R:450, delta:40, M:8, g1:-4, g2:3, L:200 });
  ok('sag detected', sag.crest, false);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
