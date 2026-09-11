/* engine tests for consol-engine.js */
const path = require('path');
const E = require(path.resolve(__dirname, '../assets/js/consol-engine.js'));

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
head('1. the two time factors every textbook quotes');
ok('T at U = 50 % is 0.197', E.Tv(0.5), 0.197, 5e-4);
ok('T at U = 90 % is 0.848', E.Tv(0.9), 0.848, 5e-4);
ok('U at T = 0.197 is 50 %', E.Uavg(0.197), 0.5, 5e-4);
ok('U at T = 0.848 is 90 %', E.Uavg(0.848), 0.9, 5e-4);
console.log('       T50 = ' + E.Tv(0.5).toFixed(5) + '   T90 = ' + E.Tv(0.9).toFixed(5));

head('2. the series and the textbook approximations agree');
// T = (pi/4) U^2 below 60 per cent, 1.781 - 0.933 log(100 - U%) above
ok('approximation at U = 50 %', E.TvApprox(0.5), Math.PI / 4 * 0.25, 1e-12);
ok('approximation at U = 90 %', E.TvApprox(0.9), 1.781 - 0.933, 1e-12);
for (const U of [0.1, 0.2, 0.3, 0.4, 0.5]) {
  const a = E.TvApprox(U), t = E.Tv(U);
  ok('series within 2 % of pi/4 U^2 at U = ' + U, Math.abs(a - t) / t < 0.02, true);
}
for (const U of [0.7, 0.8, 0.9, 0.95]) {
  const a = E.TvApprox(U), t = E.Tv(U);
  ok('series within 2 % of the log form at U = ' + U, Math.abs(a - t) / t < 0.02, true);
}

head('3. the degree of consolidation behaves');
ok('U is zero at t = 0', E.Uavg(0), 0);
ok('U is zero for negative T', E.Uavg(-1), 0);
ok('U tends to 1', E.Uavg(5) > 0.999, true);
ok('U never exceeds 1', E.Uavg(50) <= 1, true);
let mono = true;
for (let i = 1; i <= 60; i++) if (E.Uavg(i * 0.03) <= E.Uavg((i - 1) * 0.03)) mono = false;
ok('U rises monotonically', mono, true);

head('4. pore pressure isochrones satisfy the boundaries');
{
  // double drainage, Z runs 0 to 2, u must vanish at both faces
  const T = 0.2;
  ok('u = 0 at the top face', Math.abs(E.uRatio(0, T)) < 1e-9, true);
  ok('u = 0 at the bottom face', Math.abs(E.uRatio(2, T)) < 1e-9, true);
  ok('u is largest at mid depth', E.uRatio(1, T) > E.uRatio(0.5, T), true);
  // and the profile is symmetric about mid depth
  let worst = 0;
  for (const Z of [0.2, 0.5, 0.9, 1.4]) worst = Math.max(worst, Math.abs(E.uRatio(Z, T) - E.uRatio(2 - Z, T)));
  ok('the isochrone is symmetric about mid depth', worst < 1e-9, true);
}
{
  // single drainage, Z runs 0 to 1, the base is impermeable so du/dZ = 0 there
  const T = 0.2, h = 1e-5;
  ok('u = 0 at the drained face', Math.abs(E.uRatio(0, T)) < 1e-9, true);
  const slope = (E.uRatio(1, T) - E.uRatio(1 - h, T)) / h;
  ok('the gradient dies at the impermeable base', Math.abs(slope) < 1e-4, true);
  ok('u is largest at the impermeable base', E.uRatio(1, T) > E.uRatio(0.8, T), true);
}
{
  // very early on, the middle of the layer has not felt the drainage yet
  ok('u/u0 is still 1 at mid depth when T is tiny', E.uRatio(1, 1e-4), 1, 1e-3);
  ok('u/u0 has almost gone when T is large', Math.abs(E.uRatio(1, 3)) < 1e-3, true);
}

head('5. isochrone sampling');
{
  const iso = E.isochrone(0.2, 20, true);
  ok('21 points', iso.length, 21);
  ok('first point is the top face', iso[0].z, 0);
  ok('last point is the bottom face', iso[iso.length - 1].z, 1);
  ok('Z spans 0 to 2 for double drainage', iso[iso.length - 1].Z, 2, 1e-12);
  const one = E.isochrone(0.2, 20, false);
  ok('Z spans 0 to 1 for single drainage', one[one.length - 1].Z, 1, 1e-12);
}

head('6. primary settlement by the compression index');
{
  // Cc 0.30, e0 0.80, H 4 m, s0 100 kPa, ds 100 kPa, normally consolidated
  // Sc = 4 x 0.30/1.80 x log10(200/100) = 0.66667 x 0.30103 = 0.20069 m
  const r = E.settlement({ method:'cc', H:4, Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:100, ds:100 });
  ok('normally consolidated settlement', r.Sc, 4 * 0.30 / 1.80 * Math.log10(2), 1e-12);
  ok('which is 200.7 mm', r.Sc * 1000, 200.69, 0.02);
  ok('one leg only', r.legs.length, 1);
  ok('not flagged overconsolidated', r.overconsolidated, false);
}
{
  // doubling the load again adds another log10(2) worth
  const a = E.settlement({ method:'cc', H:4, Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:100, ds:100 });
  const b = E.settlement({ method:'cc', H:4, Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:100, ds:300 });
  ok('load 100 to 400 kPa is exactly twice the settlement of 100 to 200',
     b.Sc, 2 * a.Sc, 1e-12);
}
{
  // overconsolidated, sp 200, load crosses it: recompression then virgin
  const r = E.settlement({ method:'cc', H:4, Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:200, ds:300 });
  const S1 = 4 * 0.06 / 1.80 * Math.log10(200 / 100);
  const S2 = 4 * 0.30 / 1.80 * Math.log10(400 / 200);
  ok('two legs', r.legs.length, 2);
  ok('recompression leg', r.legs[0].S, S1, 1e-12);
  ok('virgin leg', r.legs[1].S, S2, 1e-12);
  ok('total is the sum', r.Sc, S1 + S2, 1e-12);
  ok('flagged overconsolidated', r.overconsolidated, true);
  ok('an overconsolidated clay settles less than a normally consolidated one',
     r.Sc < E.settlement({ method:'cc', H:4, Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:100, ds:300 }).Sc, true);
}
{
  // load stays below sp, recompression only
  const r = E.settlement({ method:'cc', H:4, Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:400, ds:100 });
  ok('stays on the recompression line', r.legs.length, 1);
  ok('uses Cs', r.Sc, 4 * 0.06 / 1.80 * Math.log10(2), 1e-12);
}

head('7. primary settlement by mv');
{
  const r = E.settlement({ method:'mv', H:4, mv:2e-4, ds:100 });
  ok('Sc = mv ds H', r.Sc, 2e-4 * 100 * 4, 1e-15);
  ok('which is 80 mm', r.Sc * 1000, 80, 1e-9);
}

head('8. time factors turn into real times');
{
  // H 4 m, double drainage so Hdr 2 m, cv 3e-7 m2/s
  // t90 = 0.848 x 4 / 3e-7 = 1.1307e7 s = 130.9 days
  const r = E.solve({ H:4, cv:3e-7, drainage:'two', method:'cc',
                      Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:100, ds:100, t:0 });
  ok('drainage path is half the layer', r.Hdr, 2);
  ok('t90 in seconds', r.t90, E.Tv(0.9) * 4 / 3e-7, 1);
  ok('t90 is about 131 days', r.t90 / 86400, 130.9, 0.5);
  console.log('       t50 = ' + (r.t50 / 86400).toFixed(1) + ' days, t90 = ' +
              (r.t90 / 86400).toFixed(1) + ' days');
  ok('U is zero at t = 0', r.U, 0);
  ok('settlement is zero at t = 0', r.St, 0);
}
{
  // single drainage doubles the path, so the time goes up by exactly four
  const two = E.solve({ H:4, cv:3e-7, drainage:'two', method:'mv', mv:2e-4, ds:100, t:0 });
  const one = E.solve({ H:4, cv:3e-7, drainage:'one', method:'mv', mv:2e-4, ds:100, t:0 });
  ok('single drainage path is the full layer', one.Hdr, 4);
  ok('single drainage takes exactly four times as long', one.t90 / two.t90, 4, 1e-9);
  ok('the ultimate settlement is the same either way', one.Sc, two.Sc, 1e-15);
}
{
  // at t = t90 the degree really is 90 per cent and the settlement 0.9 Sc
  const base = { H:4, cv:3e-7, drainage:'two', method:'mv', mv:2e-4, ds:100, t:0 };
  const r0 = E.solve(base);
  const r = E.solve(Object.assign({}, base, { t: r0.t90 }));
  ok('U at t90 is 0.900', r.U, 0.9, 1e-4);
  ok('settlement at t90 is 0.9 Sc', r.St, 0.9 * r.Sc, 1e-5);
  const r5 = E.solve(Object.assign({}, base, { t: r0.t50 }));
  ok('U at t50 is 0.500', r5.U, 0.5, 1e-4);
}

head('9. cv drives the rate and nothing else');
{
  const a = E.solve({ H:4, cv:3e-7, drainage:'two', method:'mv', mv:2e-4, ds:100, t:0 });
  const b = E.solve({ H:4, cv:6e-7, drainage:'two', method:'mv', mv:2e-4, ds:100, t:0 });
  ok('doubling cv halves the time', b.t90 / a.t90, 0.5, 1e-12);
  ok('but leaves the ultimate settlement alone', b.Sc, a.Sc, 1e-15);
  const c = E.solve({ H:8, cv:3e-7, drainage:'two', method:'mv', mv:2e-4, ds:100, t:0 });
  ok('doubling the layer quadruples the time', c.t90 / a.t90, 4, 1e-12);
  ok('and doubles the ultimate settlement', c.Sc / a.Sc, 2, 1e-12);
}

head('10. secondary compression');
{
  // Ss = H Ca/(1+ep) log10(t2/t1), one log cycle past t90
  const H = 4, Ca = 0.02, ep = 0.75, tp = 100;
  ok('one log cycle', E.secondary(H, Ca, ep, 1000, tp), H * Ca / (1 + ep), 1e-12);
  ok('two log cycles is twice as much', E.secondary(H, Ca, ep, 10000, tp),
     2 * H * Ca / (1 + ep), 1e-12);
  ok('nothing before primary ends', E.secondary(H, Ca, ep, 50, tp), 0);
  ok('nothing when Calpha is zero', E.secondary(H, 0, ep, 1000, tp), 0);
}

head('11. the settlement curve');
{
  const r = E.solve({ H:4, cv:3e-7, drainage:'two', method:'cc',
                      Cc:0.30, Cs:0.06, e0:0.80, s0:100, sp:100, ds:100, t:0 });
  const c = r.curve(60);
  ok('61 points', c.length, 61);
  ok('starts near zero settlement', c[0].U < 0.02, true);
  ok('ends near full settlement', c[c.length - 1].U > 0.99, true);
  let rising = true;
  for (let i = 1; i < c.length; i++) if (c[i].S < c[i - 1].S || c[i].t <= c[i - 1].t) rising = false;
  ok('settlement and time both rise through the curve', rising, true);
  ok('the last settlement approaches Sc', c[c.length - 1].S / r.Sc > 0.99, true);
}

head('12. guards');
{
  const z = E.solve({ H:4, cv:0, drainage:'two', method:'mv', mv:2e-4, ds:100, t:1e6 });
  ok('zero cv gives no consolidation', z.U, 0);
  ok('zero cv gives no settlement yet', z.St, 0);
  const n = E.solve({ H:4, cv:3e-7, drainage:'two', method:'mv', mv:2e-4, ds:0, t:1e7 });
  ok('zero load gives zero settlement', n.Sc, 0);
  ok('but the clock still runs', n.U > 0, true);
  ok('negative time is clamped', E.solve({ H:4, cv:3e-7, drainage:'two', method:'mv',
     mv:2e-4, ds:100, t:-5 }).t, 0);
  ok('T at U = 0 is 0', E.Tv(0), 0);
  ok('T at U = 1 is infinite', E.Tv(1), Infinity);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
