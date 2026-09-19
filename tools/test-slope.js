/* engine tests for slope-engine.js */
const path = require('path');
const E = require(path.resolve(__dirname, '../assets/js/slope-engine.js'));

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

/* the standard case used throughout: 10 m slope at 30 degrees */
const BASE = { Hs:10, beta:30, gamma:19, c:10, phi:25, ru:0,
               xc:8, yc:18, R:20, n:24, method:'bishop' };
const mk = o => E.solve(Object.assign({}, BASE, o || {}));

/* ------------------------------------------------------------------ */
head('1. the ground surface');
{
  const L = E.toeX(10, 30);
  ok('toe distance is Hs/tan(beta)', L, 10 / Math.tan(30 * Math.PI / 180), 1e-12);
  ok('which is 17.32 m', L, 17.3205, 1e-4);
  ok('crest is flat at Hs', E.ground(-5, 10, 30), 10);
  ok('top of the face', E.ground(0, 10, 30), 10);
  ok('bottom of the face', E.ground(L, 10, 30), 0, 1e-12);
  ok('mid face is half height', E.ground(L / 2, 10, 30), 5, 1e-12);
  ok('toe is flat at zero', E.ground(L + 5, 10, 30), 0);
  ok('a steeper slope has a shorter face', E.toeX(10, 45) < E.toeX(10, 30), true);
  ok('45 degrees gives a face of Hs', E.toeX(10, 45), 10, 1e-12);
}

head('2. the circle cuts the ground exactly twice');
{
  const xs = E.intersections({ xc:8, yc:18, R:20 }, 10, 30);
  ok('two intersections', xs.length, 2);
  ok('entry is behind the crest', xs[0] < 0, true);
  // this one exits part way down the face, so it is a slope circle rather
  // than a toe circle. Both are legitimate, the exit just has to be downslope.
  ok('exit is downslope of the entry', xs[1] > xs[0], true);
  ok('exit is on the face or past it', xs[1] > 0, true);
  // both must lie on the circle and on the ground
  for (const x of xs) {
    const yb = 18 - Math.sqrt(400 - (x - 8) * (x - 8));
    ok('intersection at x = ' + x.toFixed(3) + ' sits on the ground',
       Math.abs(yb - E.ground(x, 10, 30)) < 1e-6, true);
  }
  const none = E.intersections({ xc:8, yc:60, R:5 }, 10, 30);
  ok('a circle floating in the air misses the ground', none.length, 0);
}

head('3. the slices tile the mass');
{
  const r = mk();
  ok('solves', r.ok, true);
  const b = r.slices[0].b;
  ok('every slice is the same width', r.slices.every(s => Math.abs(s.b - b) < 1e-12), true);
  ok('slice widths span the whole chord',
     r.slices.length * b, r.x2 - r.x1, 1e-9);
  ok('every slice has positive height', r.slices.every(s => s.h > 0), true);
  ok('base length is b/cos(alpha)',
     r.slices.every(s => Math.abs(s.l - s.b / Math.cos(s.alpha)) < 1e-12), true);
  ok('weight is gamma b h',
     r.slices.every(s => Math.abs(s.W - 19 * s.b * s.h) < 1e-9), true);
  // the textbook pattern: steeply positive at the head where the base drops
  // away in the direction of sliding, negative at the toe where it rises
  ok('alpha is positive at the head', r.slices[0].alpha > 0, true);
  ok('alpha is negative at the toe', r.slices[r.slices.length - 1].alpha < 0, true);
  console.log('       alpha runs from ' + r.slices[0].alphaDeg.toFixed(1) +
              ' deg at the head to ' + r.slices[r.slices.length - 1].alphaDeg.toFixed(1) +
              ' deg at the toe');
}

head('4. the summed base lengths converge on the true arc length');
{
  // independent geometry: arc = R (theta2 - theta1), theta = asin((x-xc)/R)
  const xs = E.intersections({ xc:8, yc:18, R:20 }, 10, 30);
  const th = x => Math.asin((x - 8) / 20);
  const exact = 20 * (th(xs[1]) - th(xs[0]));
  const a1 = mk({ n:20 }).arc, a2 = mk({ n:80 }).arc, a3 = mk({ n:320 }).arc;
  ok('arc converges to R dtheta', Math.abs(a3 - exact) / exact < 2e-3, true);
  ok('and gets closer as the slices get thinner',
     Math.abs(a3 - exact) < Math.abs(a1 - exact), true);
  console.log('       exact arc = ' + exact.toFixed(4) +
              ', 20 slices ' + a1.toFixed(4) + ', 320 slices ' + a3.toFixed(4));
}

head('5. undrained, phi = 0: F is exactly proportional to cu and to 1/gamma');
{
  const u = { phi:0, ru:0, method:'fellenius' };
  const a = mk(Object.assign({ c:30 }, u));
  const b = mk(Object.assign({ c:60 }, u));
  ok('doubling cu doubles F', b.F / a.F, 2, 1e-12);
  const c = mk(Object.assign({ c:30, gamma:38 }, u));
  ok('doubling gamma halves F', c.F / a.F, 0.5, 1e-12);
  // and Bishop must agree with Fellenius when phi = 0, since m_a becomes cos a
  // and the c' b / cos a term is exactly c' l
  const fb = mk(Object.assign({ c:30 }, u, { method:'bishop' }));
  ok('Bishop equals Fellenius when phi is zero', fb.Bis, a.Fel, 1e-9);
}

head('6. dry, c = 0: F does not depend on the unit weight at all');
{
  // both the resisting and the disturbing sums scale with gamma, so it cancels
  const a = mk({ c:0, ru:0, gamma:16 });
  const b = mk({ c:0, ru:0, gamma:24 });
  ok('Fellenius is unchanged by gamma', b.Fel, a.Fel, 1e-12);
  ok('Bishop is unchanged by gamma', b.Bis, a.Bis, 1e-9);
  // and F scales with tan(phi)
  const p20 = mk({ c:0, ru:0, phi:20, method:'fellenius' }).Fel;
  const p40 = mk({ c:0, ru:0, phi:40, method:'fellenius' }).Fel;
  ok('Fellenius F is proportional to tan(phi) when c = 0',
     p40 / p20, Math.tan(40 * Math.PI / 180) / Math.tan(20 * Math.PI / 180), 1e-12);
}

head('7. Bishop satisfies its own fixed point equation');
{
  const r = mk();
  const tp = Math.tan(25 * Math.PI / 180);
  let num = 0, den = 0;
  for (const s of r.slices) {
    const ma = Math.cos(s.alpha) + Math.sin(s.alpha) * tp / r.Bis;
    num += (10 * s.b + Math.max(0, s.W - s.u * s.b) * tp) / ma;
    den += s.W * Math.sin(s.alpha);
  }
  ok('substituting F back reproduces F', num / den, r.Bis, 1e-8);
  ok('it converged', r.bisConverged, true);
  ok('in a sensible number of iterations', r.bisIters > 0 && r.bisIters < 60, true);
  console.log('       Bishop F = ' + r.Bis.toFixed(4) + ' after ' + r.bisIters + ' iterations');
}

head('8. Bishop sits above Fellenius, which is the known conservatism');
{
  for (const phi of [15, 25, 35]) {
    const r = mk({ phi });
    ok('Bishop >= Fellenius at phi = ' + phi, r.Bis >= r.Fel - 1e-9, true);
    console.log('       phi ' + phi + ': Fellenius ' + r.Fel.toFixed(3) +
                ', Bishop ' + r.Bis.toFixed(3) +
                ', difference ' + ((r.Bis / r.Fel - 1) * 100).toFixed(1) + ' %');
  }
}

head('9. pore pressure and slope angle move F the right way');
{
  const dry = mk({ ru:0 }), wet = mk({ ru:0.3 }), wetter = mk({ ru:0.5 });
  ok('pore pressure lowers F', wet.F < dry.F, true);
  ok('more pore pressure lowers it further', wetter.F < wet.F, true);
  console.log('       ru 0 gives ' + dry.F.toFixed(3) + ', 0.3 gives ' +
              wet.F.toFixed(3) + ', 0.5 gives ' + wetter.F.toFixed(3));
  const flat = mk({ beta:20 }), steep = mk({ beta:40 });
  ok('a steeper slope is less stable', steep.F < flat.F, true);
  // height has to be judged on each slope's own critical circle, because one
  // fixed circle is not the same slip surface once the geometry moves
  const cLow = E.critical(Object.assign({}, BASE, { Hs:6 }), { nx:7, ny:7, nr:5 });
  const cHigh = E.critical(Object.assign({}, BASE, { Hs:14 }), { nx:7, ny:7, nr:5 });
  ok('a higher slope is less stable on its own critical circle',
     cHigh.F < cLow.F, true);
  console.log('       critical F at Hs 6 m is ' + cLow.F.toFixed(3) +
              ', at 14 m it is ' + cHigh.F.toFixed(3));
  ok('more cohesion helps', mk({ c:30 }).F > mk({ c:10 }).F, true);
  ok('more friction helps', mk({ phi:35 }).F > mk({ phi:25 }).F, true);
}

head('10. the answer settles as the slices get thinner');
{
  const f = n => mk({ n }).F;
  const a = f(8), b = f(24), c = f(96), d = f(384);
  const d1 = Math.abs(b - a), d2 = Math.abs(c - b), d3 = Math.abs(d - c);
  ok('each refinement moves less than the last', d2 < d1 && d3 < d2, true);
  ok('settled to better than 1 percent by 96 slices', d3 / d < 0.01, true);
  console.log('       F at 8, 24, 96, 384 slices: ' +
              [a, b, c, d].map(v => v.toFixed(4)).join('  '));
}

head('11. the critical circle search');
{
  const best = E.critical(Object.assign({}, BASE), { nx:7, ny:7, nr:5 });
  ok('a critical circle is found', best != null, true);
  ok('it is no worse than the trial circle', best.F <= mk().F + 1e-9, true);
  const check = mk({ xc:best.xc, yc:best.yc, R:best.R });
  ok('re-solving the critical circle reproduces its F', check.F, best.F, 1e-9);
  console.log('       critical F = ' + best.F.toFixed(3) +
              ' at xc ' + best.xc.toFixed(2) + ', yc ' + best.yc.toFixed(2) +
              ', R ' + best.R.toFixed(2) + '  (trial circle F = ' + mk().F.toFixed(3) + ')');
}

head('12. guards');
{
  const miss = E.solve(Object.assign({}, BASE, { xc:8, yc:60, R:5 }));
  ok('a circle that misses the ground is reported', miss.ok, false);
  ok('with a reason', typeof miss.why, 'string');
  const zero = mk({ c:0, phi:0 });
  ok('no strength gives F = 0', zero.F, 0, 1e-12);
  const huge = mk({ c:1000 });
  ok('a very strong soil gives a large F', huge.F > 10, true);
  ok('F is finite', isFinite(mk().F), true);
  ok('the disturbing sum is positive for a real slip', mk().disturbing > 0, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
