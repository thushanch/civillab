/* Engine tests for ConnEngine, hand values from EN 1993-1-8 Tables 3.4, 6.2,
   4.5.3 and 6.2.5, and BS 5950-1 6.3, 6.8, 4.13 */
const E = require('../assets/js/conn-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const base = { code:'ec3', nr:3, nc:1, p:70, g:60, e1:40, e2:40, t:10, steel:'S275', d:20, grade:'8.8', planes:1,
               V:200, ecc:0, N:0, tp:15, mT:40, nT:40, leff:150, boltsT:2 };

console.log('=== Bolt resistances, EN 1993-1-8 Table 3.4 ===');
{
  const r = E.boltGroup(base);
  ok('M20 8.8 shear 0.6 x 800 x 245 / 1.25 = 94.1 kN', r.FvRd, 94.08, 1e-9);
  ok('M20 8.8 tension 0.9 x 800 x 245 / 1.25 = 141.1 kN', r.FtRd, 141.12, 1e-9);
  ok('hole d0 = 22', r.d0, 22);
  ok('alpha_d end = e1 / 3d0', r.ad, Math.min(40 / 66, 70 / 66 - 0.25), 1e-12);
  ok('k1 edge = min(2.8 e2/d0 - 1.7, 2.5)', r.k1, Math.min(2.8 * 40 / 22 - 1.7, 2.5), 1e-12);
  ok('bearing = k1 ab fu d t / 1.25 = 99.4 kN', r.FbRd, 2.5 * (40 / 66) * 410 * 200 / 1.25 / 1e3, 1e-9);
  ok('10.9 shear uses alpha_v 0.5', E.boltGroup(Object.assign({}, base, { grade:'10.9' })).FvRd, 0.5 * 1000 * 245 / 1.25 / 1e3, 1e-9);
  ok('two shear planes double it', E.boltGroup(Object.assign({}, base, { planes:2 })).FvRd, 2 * 94.08, 1e-9);
  ok('M27 hole is d + 3', E.holeD(27), 30);
}

console.log('\n=== Elastic polar analysis ===');
{
  const g = E.polar(3, 1, 70, 60, 200, 0);
  ok('concentric: V / n each', g.Fmax, 200 / 3, 1e-12);
  const e = E.polar(3, 2, 70, 60, 120, 100);
  // Ip = 6 x 30^2 + 4 x 70^2 = 5400 + 19600 = 25000, M = 12000 kN mm
  ok('sum r^2', e.Ip, 25000, 1e-9);
  ok('moment V e', e.M, 12000, 1e-9);
  const Fx = 12000 * 70 / 25000, Fy = 120 / 6 + 12000 * 30 / 25000;
  ok('corner bolt resultant', e.Fmax, Math.hypot(Fx, Fy), 1e-12);
  ok('corner bolt is on the far column', e.crit.x > 0, true);
  ok('horizontal components balance', e.bolts.reduce((a, b) => a + b.Fx, 0), 0, 1e-9);
  ok('vertical components carry V', e.bolts.reduce((a, b) => a + b.Fy, 0), -120, 1e-9);
  ok('moments balance V e', e.bolts.reduce((a, b) => a + (b.Fx * b.y - b.Fy * b.x), 0), 12000, 1e-6);
}

console.log('\n=== Block tearing, 3.10.2 ===');
{
  const r = E.boltGroup(base);
  const Ant = (40 - 0.5 * 22) * 10, Anv = (40 + 140 - 2.5 * 22) * 10;
  ok('Ant', r.Ant, Ant, 1e-9);
  ok('Anv', r.Anv, Anv, 1e-9);
  ok('concentric Veff,1 = fu Ant/1.25 + fy Anv/sqrt3', r.Veff, (410 * Ant / 1.25 + 275 * Anv / Math.sqrt(3)) / 1e3, 1e-9);
  const e = E.boltGroup(Object.assign({}, base, { ecc:50 }));
  ok('eccentric halves the tension term', e.Veff, (0.5 * 410 * Ant / 1.25 + 275 * Anv / Math.sqrt(3)) / 1e3, 1e-9);
}

console.log('\n=== T-stub in tension, Table 6.2 ===');
{
  const r = E.boltGroup(Object.assign({}, base, { N:150 }));
  const Mpl = 0.25 * 150 * 225 * 275 / 1e6;   // kN m
  ok('Mpl = 0.25 leff tp^2 fy', r.Mpl, Mpl, 1e-12);
  ok('mode 1 = 4 Mpl / m', r.FT1, 4 * Mpl * 1e3 / 40, 1e-9);
  ok('n limited to 1.25 m', r.nEff, 40);
  ok('mode 2 = (2Mpl + n sum Ft)/(m + n)', r.FT2, (2 * Mpl * 1e3 + 40 * 2 * 141.12) / 80, 1e-9);
  ok('mode 3 = sum Ft', r.FT3, 2 * 141.12, 1e-9);
  ok('governing mode', r.mode, [r.FT1, r.FT2, r.FT3].indexOf(r.FT) + 1);
  ok('shear and tension interaction', r.comb, r.pg.Fmax / r.FvRd + (150 / 3) / (1.4 * r.FtRd), 1e-12);
  const thin = E.boltGroup(Object.assign({}, base, { N:150, tp:8 }));
  ok('a thin plate yields in mode 1', thin.mode, 1);
}

console.log('\n=== BS 5950 bolts ===');
{
  const r = E.boltGroup(Object.assign({}, base, { code:'bs' }));
  ok('Ps = ps As = 375 x 245', r.Ps, 375 * 245 / 1e3, 1e-9);
  ok('Pbb = d t pbb', r.Pbb, 20 * 10 * 1000 / 1e3, 1e-9);
  ok('Pbs = min(d t pbs, 0.5 e t pbs)', r.Pbs, Math.min(20 * 10 * 460, 0.5 * 40 * 10 * 460) / 1e3, 1e-9);
  ok('Pnom = 0.8 pt At', r.Pnom, 0.8 * 560 * 245 / 1e3, 1e-9);
  ok('block shear 0.6 py t [Lv + Ke(Lt - k D)]', r.Pr, 0.6 * 275 * 10 * (180 + 1.2 * (40 - 0.5 * 22)) / 1e3, 1e-9);
}

console.log('\n=== Fillet welds ===');
{
  const w0 = E.weldPerMm('ec3', 'S275', 5.6, 0);
  ok('8 mm S275 simplified 1.25 kN/mm', w0.w, 410 / Math.sqrt(3) / (0.85 * 1.25) * 5.6 / 1e3, 1e-12);
  ok('about 1.25', w0.w, 1.248, 0.001);
  const w90 = E.weldPerMm('ec3', 'S275', 5.6, Math.PI / 2);
  ok('transverse 1.225 times stronger', w90.w / w0.w, Math.sqrt(1.5), 1e-12);
  ok('S355 beta_w 0.9', E.weldPerMm('ec3', 'S355', 5.6, 0).w, 470 / Math.sqrt(3) / (0.9 * 1.25) * 5.6 / 1e3, 1e-12);
  ok('BS longitudinal pw a', E.weldPerMm('bs', 'S275', 5.6, 0).w, 220 * 5.6 / 1e3, 1e-12);
  ok('BS transverse K = 1.25', E.weldPerMm('bs', 'S275', 5.6, Math.PI / 2).K, 1.25, 1e-12);
  const g = E.weld({ code:'ec3', steel:'S275', s:8, L:200, b:150, V:100, ecc:0 });
  ok('concentric weld shares V over 2L', g.w, 100 / 400, 1e-12);
  ok('and the force runs along the weld', g.theta, 0, 1e-12);
  const e = E.weld({ code:'ec3', steel:'S275', s:8, L:200, b:150, V:100, ecc:150 });
  const Ip = 2 * (200 ** 3 / 12 + 200 * 75 ** 2);
  ok('polar moment of the two lines', e.Ip, Ip, 1e-9);
  ok('worst point resultant', e.w, Math.hypot(15000 * 100 / Ip, 100 / 400 + 15000 * 75 / Ip), 1e-12);
  ok('directional resistance at that angle', e.Rd, E.weldPerMm('ec3', 'S275', 5.6, e.theta).w, 1e-12);
  ok('directional never below the simplified value', e.Rd >= e.simple - 1e-12, true);
}

console.log('\n=== Base plate ===');
{
  const p = { code:'ec3', colIdx:2, B:450, D:450, tp:20, steel:'S275', fck:30, padRatio:1, NEd:1500 };
  const r = E.basePlate(p);
  ok('fjd = (2/3) fcd at Ac1 = Ac0', r.fjd, 2 / 3 * 17, 1e-12);
  ok('fy of a 20 mm plate is 265', r.fyp, 265);
  ok('c = tp sqrt(fy / 3 fjd)', r.c, 20 * Math.sqrt(265 / (3 * 2 / 3 * 17)), 1e-12);
  ok('Nj,Rd = Aeff fjd', r.NjRd, r.Aeff * r.fjd / 1e3, 1e-9);
  ok('thickness for NEd carries it exactly', E.basePlate(Object.assign({}, p, { tp:r.tpReq })).NjRd, 1500, 1);
  ok('a bigger pad raises fjd', E.basePlate(Object.assign({}, p, { padRatio:4 })).fjd, 2 / 3 * 17 * 2, 1e-12);
  const b = E.basePlate(Object.assign({}, p, { code:'bs' }));
  ok('BS bearing 0.6 fcu', b.fjd, 21, 1e-12);
  ok('BS c = tp / sqrt(3w/pyp)', b.c, 20 / Math.sqrt(63 / 265), 1e-12);
  ok('effective area never more than the plate', r.Aeff <= 450 * 450, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
