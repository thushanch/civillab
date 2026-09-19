/* engine tests for earth-engine.js */
const path = require('path');
const E = require(path.resolve(__dirname, '../assets/js/earth-engine.js'));

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
const RAD = Math.PI / 180;

/* ------------------------------------------------------------------ */
head('1. Rankine coefficients');
ok('Ka at phi = 30 is exactly 1/3', E.Ka(30), 1 / 3, 1e-12);
ok('Kp at phi = 30 is exactly 3', E.Kp(30), 3, 1e-12);
ok('Ka at phi = 0 is 1', E.Ka(0), 1, 1e-12);
ok('Kp at phi = 0 is 1', E.Kp(0), 1, 1e-12);
for (const phi of [0, 10, 20, 30, 35, 40, 45]) {
  ok('Ka Kp = 1 at phi = ' + phi, E.Ka(phi) * E.Kp(phi), 1, 1e-12);
  const t = Math.tan((45 - phi / 2) * RAD) ** 2;
  ok('Ka matches tan^2(45 - phi/2) at phi = ' + phi, E.Ka(phi), t, 1e-12);
}
ok('K0 by Jaky at phi = 30 is 0.5', E.K0(30), 0.5, 1e-12);
ok('K0 sits between Ka and Kp', E.K0(30) > E.Ka(30) && E.K0(30) < E.Kp(30), true);

head('2. sloping backfill reduces to the level case');
for (const phi of [20, 30, 40]) {
  ok('KaSloped at beta = 0 equals Rankine at phi = ' + phi,
     E.KaSloped(phi, 0), E.Ka(phi), 1e-12);
  ok('KpSloped at beta = 0 equals Rankine at phi = ' + phi,
     E.KpSloped(phi, 0), E.Kp(phi), 1e-12);
}
ok('a sloping backfill pushes harder', E.KaSloped(30, 15) > E.Ka(30), true);
console.log('       Ka at phi 30 is ' + E.Ka(30).toFixed(4) +
            ' level, ' + E.KaSloped(30, 15).toFixed(4) + ' at beta 15');

head('3. Coulomb collapses exactly onto Rankine');
for (const phi of [15, 20, 25, 30, 35, 40]) {
  ok('KaCoulomb with delta = beta = theta = 0 at phi = ' + phi,
     E.KaCoulomb(phi, 0, 0, 0), E.Ka(phi), 1e-12);
  ok('KpCoulomb with delta = beta = theta = 0 at phi = ' + phi,
     E.KpCoulomb(phi, 0, 0, 0), E.Kp(phi), 1e-12);
}
ok('wall friction lowers the active coefficient',
   E.KaCoulomb(30, 20, 0, 0) < E.Ka(30), true);
ok('wall friction raises the passive coefficient',
   E.KpCoulomb(30, 20, 0, 0) > E.Kp(30), true);
console.log('       phi 30: Ka ' + E.Ka(30).toFixed(4) + ' level, ' +
            E.KaCoulomb(30, 20, 0, 0).toFixed(4) + ' with delta 20');

head('4. the classic triangle, dry cohesionless');
{
  // gamma 18, H 6, phi 30 gives Pa = 0.5 Ka gamma H^2 = 108 kN/m at H/3
  const p = E.profile({ H:6, K:E.Ka(30), c:0, q:0, gamma:18, gammaSat:18, zw:Infinity });
  ok('Pa = 0.5 Ka gamma H^2', p.P, 0.5 * (1 / 3) * 18 * 36, 1e-6);
  ok('which is 108 kN per metre', p.P, 108, 1e-6);
  ok('acting at H/3 above the base', p.arm, 2, 1e-6);
  ok('no water thrust', p.Pw, 0, 1e-12);
  ok('no tension crack', p.z0, 0, 1e-12);
  ok('pressure at the base is Ka gamma H', p.saAt(6), (1 / 3) * 18 * 6, 1e-9);
}

head('5. a surcharge adds a rectangle');
{
  const base = { H:6, K:E.Ka(30), c:0, gamma:18, gammaSat:18, zw:Infinity };
  const a = E.profile(Object.assign({ q:0 }, base));
  const b = E.profile(Object.assign({ q:20 }, base));
  // the extra thrust is Ka q H, and it sits at H/2
  ok('extra thrust is Ka q H', b.P - a.P, (1 / 3) * 20 * 6, 1e-6);
  const extraM = b.P * b.arm - a.P * a.arm;
  ok('the extra acts at H/2', extraM / (b.P - a.P), 3, 1e-6);
  ok('the resultant of the pair rises above H/3', b.arm > a.arm, true);
}

head('6. a water table splits the thrust');
{
  // water at the surface: effective thrust uses gamma', water is separate
  const gsat = 20, gsub = gsat - 9.81;
  const p = E.profile({ H:6, K:E.Ka(30), c:0, q:0, gamma:18, gammaSat:gsat, zw:0 });
  ok('effective thrust uses gamma prime', p.P, 0.5 * (1 / 3) * gsub * 36, 1e-6);
  ok('water thrust is 0.5 gamma_w H^2', p.Pw, 0.5 * 9.81 * 36, 1e-6);
  ok('both act at H/3', p.arm, 2, 1e-6);
  ok('and the water too', p.armW, 2, 1e-6);
  // a water table makes the total push bigger than the dry case
  const dry = E.profile({ H:6, K:E.Ka(30), c:0, q:0, gamma:18, gammaSat:18, zw:Infinity });
  ok('total push is larger than dry', p.P + p.Pw > dry.P, true);
  console.log('       dry ' + dry.P.toFixed(1) + ' kN/m against ' +
              (p.P + p.Pw).toFixed(1) + ' kN/m with the table at the surface');
}

head('7. cohesion opens a tension crack');
{
  // z0 = 2c/(gamma sqrt(Ka)); c 10, gamma 18, phi 30 gives 1.9245 m
  const ka = E.Ka(30);
  const z0 = E.crackDepth(10, 18, ka);
  ok('crack depth 2c/(gamma sqrt Ka)', z0, 2 * 10 / (18 * Math.sqrt(ka)), 1e-12);
  ok('which is 1.925 m', z0, 1.9245, 1e-3);
  const p = E.profile({ H:6, K:ka, c:10, q:0, gamma:18, gammaSat:18, zw:Infinity, n:20000 });
  ok('the engine reports the same crack', p.z0, z0, 1e-12);
  ok('no pressure just above the crack', p.saAt(z0 - 0.01), 0, 1e-9);
  ok('pressure just below it', p.saAt(z0 + 0.01) > 0, true);
  // below the crack the diagram is a triangle of height (H - z0)
  const expect = 0.5 * (ka * 18 * 6 - 2 * 10 * Math.sqrt(ka)) * (6 - z0);
  ok('thrust is the triangle below the crack', p.P, expect, 0.02);
  ok('cohesion reduces the thrust',
     p.P < E.profile({ H:6, K:ka, c:0, q:0, gamma:18, gammaSat:18, zw:Infinity }).P, true);
}

head('8. the integration agrees with the hand assembled shapes');
{
  // surcharge, water table part way down and cohesion, all at once
  const ka = E.Ka(32), gam = 19, gsat = 21, zw = 2.5, H = 7, q = 15, c = 5;
  const fine = E.profile({ H, K:ka, c, q, gamma:gam, gammaSat:gsat, zw, n:200000 });
  const coarse = E.profile({ H, K:ka, c, q, gamma:gam, gammaSat:gsat, zw, n:2000 });
  ok('2000 strips is within 0.1 % of 200000', Math.abs(coarse.P - fine.P) / fine.P < 1e-3, true);
  ok('and the lever arm too', Math.abs(coarse.arm - fine.arm) / fine.arm < 1e-3, true);
  // water thrust below the table is a closed form
  ok('water thrust is 0.5 gamma_w (H - zw)^2', fine.Pw, 0.5 * 9.81 * (H - zw) ** 2, 1e-4);
  ok('acting at (H - zw)/3 above the base', fine.armW, (H - zw) / 3, 1e-4);
}

head('9. a whole wall, level dry cohesionless backfill');
{
  const w = E.solve({ H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0,
                      gamma:18, gammaSat:18, gammaC:24, phi:30, c:0, beta:0, q:0,
                      zw:null, theory:'rankine', deltaB:20, cB:0, usePassive:false });
  ok('Ka is 1/3', w.Ka, 1 / 3, 1e-12);
  ok('thrust is 108 kN/m', w.Pa, 108, 1e-6);
  ok('all of it horizontal with a level fill', w.Ph, 108, 1e-6);
  ok('no vertical component', w.Pv, 0, 1e-12);
  // the thrust is integrated in 2000 strips, so this carries a few parts in
  // ten million of discretisation error rather than being exact
  ok('overturning moment is Pa H/3', w.Mo, 108 * 2, 1e-3);
  // weights: stem 0.4 x 5.5 x 24, base 3.5 x 0.5 x 24, soil 2.1 x 5.5 x 18
  const stem = 0.4 * 5.5 * 24, base = 3.5 * 0.5 * 24, soil = 2.1 * 5.5 * 18;
  ok('heel width', w.heel, 2.1, 1e-12);
  ok('vertical load is the three weights', w.V, stem + base + soil, 1e-6);
  console.log('       V = ' + w.V.toFixed(1) + ' kN/m, Mr = ' + w.Mr.toFixed(1) +
              ', Mo = ' + w.Mo.toFixed(1));
  ok('sliding resistance is V tan(delta_b)', w.slideR, w.V * Math.tan(20 * RAD), 1e-6);
  ok('sliding factor', w.FoSslide, w.V * Math.tan(20 * RAD) / 108, 1e-9);
  ok('overturning factor', w.FoSover, w.Mr / w.Mo, 1e-12);
  ok('resultant position', w.xbar, (w.Mr - w.Mo) / w.V, 1e-12);
  ok('eccentricity', w.e, 3.5 / 2 - w.xbar, 1e-12);
}

head('10. bearing pressure and the middle third');
{
  const base = { H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0,
                 gamma:18, gammaSat:18, gammaC:24, phi:30, c:0, beta:0, q:0,
                 zw:null, theory:'rankine', deltaB:20, cB:0, usePassive:false };
  const w = E.solve(base);
  if (w.middleThird) {
    ok('qmax and qmin average to V/B', (w.qmax + w.qmin) / 2, w.V / w.B, 1e-9);
    ok('qmax = V/B (1 + 6e/B)', w.qmax, w.V / w.B * (1 + 6 * w.e / w.B), 1e-9);
    ok('qmin is not negative', w.qmin >= 0, true);
  }
  console.log('       e = ' + w.e.toFixed(3) + ' m, B/6 = ' + (3.5 / 6).toFixed(3) +
              ', qmax ' + w.qmax.toFixed(1) + ' kPa, qmin ' + w.qmin.toFixed(1) + ' kPa');
  // a very narrow base throws the resultant out of the middle third
  const narrow = E.solve(Object.assign({}, base, { B:2.0, Lt:0.5 }));
  ok('a narrow base is less stable in overturning', narrow.FoSover < w.FoSover, true);
  // a wall with no thrust at all sits with e = 0 and a uniform pressure
  const still = E.solve(Object.assign({}, base, { phi:89 }));
  ok('a nearly frictionless push gives a tiny Ka', still.Ka < 1e-3, true);
}

head('11. the checks move the right way');
{
  const base = { H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0,
                 gamma:18, gammaSat:18, gammaC:24, phi:30, c:0, beta:0, q:0,
                 zw:null, theory:'rankine', deltaB:20, cB:0, usePassive:false };
  const w = E.solve(base);
  ok('a wider base helps overturning', E.solve(Object.assign({}, base, { B:5 })).FoSover > w.FoSover, true);
  ok('a wider base helps sliding', E.solve(Object.assign({}, base, { B:5 })).FoSslide > w.FoSslide, true);
  ok('a taller wall is worse', E.solve(Object.assign({}, base, { H:9 })).FoSover < w.FoSover, true);
  ok('a surcharge is worse for overturning',
     E.solve(Object.assign({}, base, { q:20 })).FoSover < w.FoSover, true);
  ok('a water table is much worse',
     E.solve(Object.assign({}, base, { zw:0, gammaSat:20 })).FoSslide < w.FoSslide, true);
  ok('more friction in the fill helps',
     E.solve(Object.assign({}, base, { phi:38 })).FoSover > w.FoSover, true);
  ok('passive resistance helps sliding',
     E.solve(Object.assign({}, base, { Df:1.2, usePassive:true })).FoSslide > w.FoSslide, true);
  ok('base adhesion helps sliding',
     E.solve(Object.assign({}, base, { cB:15 })).FoSslide > w.FoSslide, true);
  // A sloping backfill raises Ka and so raises the horizontal push, but the
  // Rankine thrust now leans at beta and its vertical component lands on the
  // virtual back plane at x = B, the far end of the heel. With a wide heel
  // that restoring moment more than pays for the extra push, so the net
  // overturning factor improves. Only the horizontal part is unambiguously
  // worse, so that is what gets asserted.
  const sl = E.solve(Object.assign({}, base, { beta:15 }));
  ok('a sloping backfill raises Ka', sl.Ka > w.Ka, true);
  ok('and raises the horizontal thrust', sl.Ph > w.Ph, true);
  ok('it also leans, giving a vertical component', sl.Pv > 0, true);
  ok('which lands at the back of the heel and steadies the wall',
     sl.FoSover > w.FoSover, true);
}

head('12. Coulomb in the wall matches Rankine when the wall is smooth');
{
  const base = { H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0,
                 gamma:18, gammaSat:18, gammaC:24, phi:30, c:0, beta:0, q:0,
                 zw:null, deltaB:20, cB:0, usePassive:false };
  const r = E.solve(Object.assign({}, base, { theory:'rankine' }));
  const c0 = E.solve(Object.assign({}, base, { theory:'coulomb', delta:0 }));
  ok('same coefficient', c0.Ka, r.Ka, 1e-12);
  ok('same thrust', c0.Pa, r.Pa, 1e-9);
  ok('same overturning factor', c0.FoSover, r.FoSover, 1e-9);
  const c20 = E.solve(Object.assign({}, base, { theory:'coulomb', delta:20 }));
  ok('wall friction lowers the horizontal push', c20.Ph < r.Ph, true);
  ok('and adds a vertical component', c20.Pv > 0, true);
  ok('so overturning improves', c20.FoSover > r.FoSover, true);
}

head('13. guards');
{
  const base = { H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0,
                 gamma:18, gammaSat:18, gammaC:24, phi:30, c:0, beta:0, q:0,
                 zw:null, theory:'rankine', deltaB:20, cB:0, usePassive:false };
  ok('beta is held below phi', isFinite(E.KaSloped(30, 45)), true);
  ok('delta is held at or below phi', isFinite(E.KaCoulomb(30, 45, 0, 0)), true);
  const noPush = E.solve(Object.assign({}, base, { H:0.5, tb:0.5 }));
  ok('a wall with no stem still solves', isFinite(noPush.V), true);
  ok('heel never goes negative', E.solve(Object.assign({}, base, { B:1.0 })).heel >= 0, true);
  ok('crack depth is zero without cohesion', E.crackDepth(0, 18, 1 / 3), 0);
  ok('crack depth is zero without weight', E.crackDepth(10, 0, 1 / 3), 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
