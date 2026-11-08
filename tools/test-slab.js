/* Engine tests for SlabEngine, hand values from BS 8110 Tables 3.12 to 3.14,
   EN 1992-1-1 6.4 and BS 8110 3.7.7 */
const E = require('../assets/js/slab-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Design loads ===');
ok('EC2 n = 1.35 x 5 + 1.5 x 3', E.loads('ec2', 5, 3).n, 11.25, 1e-12);
ok('BS n = 1.4 x 5 + 1.6 x 3', E.loads('bs', 5, 3).n, 11.8, 1e-12);

console.log('\n=== Two way coefficients, Table 3.14 ===');
{
  const c = E.twoWayCoeffs(1, 1.0);
  ok('interior hogging at 1.0', c.sxN, 0.031);
  ok('interior sagging at 1.0', c.sxP, 0.024);
  const c2 = E.twoWayCoeffs(1, 1.25);
  ok('interpolated hogging at 1.25', c2.sxN, 0.044, 1e-12);
  ok('interpolated sagging at 1.25', c2.sxP, 0.0335, 1e-12);
  const c4 = E.twoWayCoeffs(4, 2.0);
  ok('two adjacent at 2.0 hogging', c4.sxN, 0.093, 1e-12);
  ok('long span hogging two adjacent', c4.syN, 0.045);
  ok('case 9 has no hogging', E.twoWayCoeffs(9, 1.5).sxN, null);
  ok('ratio over 2 flagged', E.twoWayCoeffs(1, 2.4).clamped, true);
  ok('ratio over 2 uses the 2.0 column', E.twoWayCoeffs(1, 2.4).sxP, 0.048, 1e-12);
  // BS 8110 eq 19: beta_sy = (24 + 2Nd + 1.5Nd^2)/1000 against the long span column
  const Nd = { 1:0, 2:1, 3:1, 4:2, 5:2, 6:2, 7:3, 8:3, 9:4 };
  for (const id of Object.keys(Nd))
    ok(`case ${id} long span sagging matches eq 19`, E.CASES[id].syP, E.betaSy(Nd[id]), 0.0006);
  // square panels with symmetric edges: short and long sagging agree
  ok('interior square panel symmetric', E.twoWayCoeffs(1, 1).sxP, E.CASES[1].syP, 1e-12);
  ok('four edges free square panel near symmetric', Math.abs(E.twoWayCoeffs(9, 1).sxP - E.CASES[9].syP) <= 0.0011, true);
  ok('coefficients rise with ly/lx', E.CASES[3].sxP.every((v, i, a) => i === 0 || v > a[i - 1]), true);
}

console.log('\n=== Simply supported panel, Table 3.13 (Grashof-Rankine) ===');
{
  const a = E.twoWayCoeffs(0, 1.0);
  ok('square: 1/16 each way', a.sxP, 1 / 16, 1e-12);
  ok('square: long 1/16', a.syP, 1 / 16, 1e-12);
  const b = E.twoWayCoeffs(0, 1.5);
  ok('alpha_sx at 1.5 = 0.104', b.sxP, 0.104, 0.0005);
  ok('alpha_sy at 1.5 = 0.046', b.syP, 0.046, 0.0005);
  ok('very long panel tends to wl^2/8', E.twoWayCoeffs(0, 6).sxP, 0.125, 0.001);
}

console.log('\n=== Bar spacing ===');
{
  const s = E.spacing(400, 10, 250);
  // 1000 x 78.54 / 400 = 196.3, so 175 mm in 25 mm steps
  ok('H10 for 400 mm2/m at 175', s.s, 175);
  ok('As provided = 1000 Ab / s', s.AsProv, 1000 * Math.PI * 25 / 175, 1e-9);
  ok('max spacing governs a light demand', E.spacing(100, 10, 250).s, 250);
  ok('very heavy demand flagged', E.spacing(5000, 10, 250).tooTight, true);
}

console.log('\n=== One way slab, simply supported ===');
{
  const r = E.solve({ code:'ec2', type:'one', support:'ss', lx:4, ly:12, h:175, cover:25, phi:10,
                      fck:30, fyk:500, gsup:1.5, qk:3 });
  const gk = 1.5 + 25 * 0.175;          // 5.875
  const n = 1.35 * gk + 1.5 * 3;          // 12.43
  ok('self weight added to gk', r.gk, gk, 1e-12);
  ok('n', r.n, n, 1e-12);
  ok('M = nL^2/8', r.strips[0].M, n * 16 / 8, 1e-9);
  ok('dx = h - c - phi/2', r.dx, 145);
  ok('dy one bar deeper in', r.dy, 135);
  ok('max main spacing min(2h, 250)', r.sMain, 250);
  const K = n * 2 * 1e6 / (1000 * 145 * 145 * 30);
  ok('K for the midspan strip', r.strips[0].K, K, 1e-12);
  ok('As provided covers As required', r.strips[0].AsProv >= r.strips[0].AsReq, true);
  ok('shear V = 0.5 n L', r.shear.V, 0.5 * n * 4, 1e-9);
  ok('distribution steel at least 20% of main', r.strips[1].AsProv >= 0.2 * r.strips[0].AsProv - 1e-9, true);
  ok('deflection uses the ss factor', r.dfl.Kb, 1.0);
  ok('deflection actual L/d', r.dfl.actual, 4000 / 145, 1e-9);
}

console.log('\n=== One way continuous, Table 3.12 ===');
{
  const r = E.solve({ code:'ec2', type:'one', support:'cont', lx:4, ly:12, h:175, cover:25, phi:10,
                      fck:30, fyk:500, gsup:1.5, qk:3 });
  const F = r.n * 4;
  ok('end span 0.086 F L', r.strips[0].M, 0.086 * F * 4, 1e-9);
  ok('first interior support 0.086 F L', r.strips[1].M, 0.086 * F * 4, 1e-9);
  ok('interior span 0.063 F L', r.strips[2].M, 0.063 * F * 4, 1e-9);
  ok('first interior shear 0.6 F', r.shear.V, 0.6 * F, 1e-9);
  ok('end span factor 1.3', r.dfl.Kb, 1.3);
  ok('support strip is hogging', r.strips[1].sag, false);
  const bs = E.solve({ code:'bs', type:'one', support:'cont', lx:4, ly:12, h:175, cover:25, phi:10,
                       fck:30, fyk:500, gsup:1.5, qk:3 });
  ok('BS uses 1.4 and 1.6', bs.n, 1.4 * bs.gk + 1.6 * 3, 1e-12);
  ok('BS min steel 0.13% bh', bs.strips[3].AsMin, 0.0013 * 1000 * 175, 1e-9);
}

console.log('\n=== Two way panel, case 4 ===');
{
  const r = E.solve({ code:'ec2', type:'two', caseId:4, lx:5, ly:6, h:200, cover:25, phi:12,
                      fck:30, fyk:500, gsup:1.5, qk:3 });
  const c = E.twoWayCoeffs(4, 1.2);
  ok('four strips', r.strips.length, 4);
  ok('msx hogging = beta n lx^2', r.strips[0].M, c.sxN * r.n * 25, 1e-9);
  ok('msy sagging = beta n lx^2', r.strips[3].M, 0.034 * r.n * 25, 1e-9);
  ok('long span bars sit at dy', r.strips[3].d, 200 - 25 - 6 - 12);
  ok('one continuous long edge gives the end span factor', r.dfl.Kb, 1.3);
  ok('no one way shear check', r.shear, null);
  const swapped = E.solve({ code:'ec2', type:'two', caseId:4, lx:6, ly:5, h:200, cover:25, phi:12,
                            fck:30, fyk:500, gsup:1.5, qk:3 });
  ok('short span chosen whatever the order', swapped.lx, 5);
  const ss = E.solve({ code:'ec2', type:'two', caseId:0, lx:4.5, ly:6, h:175, cover:25, phi:10,
                       fck:30, fyk:500, gsup:1.5, qk:3 });
  ok('ss panel has only sagging strips', ss.strips.every(s => s.sag), true);
  ok('ss panel deflection factor 1.0', ss.dfl.Kb, 1.0);
}

console.log('\n=== EC2 punching, interior 400 x 400, d 200, rho 1% ===');
{
  const p = E.punch({ code:'ec2', pos:'int', c1:400, c2:400, d:200, VEd:500, fck:30, fyk:500, rhoL:0.01 });
  ok('beta 1.15', p.beta, 1.15);
  ok('u0 = 2(c1 + c2)', p.u0, 1600);
  ok('vEd,0 = beta V / u0 d', p.v0, 1.15 * 500e3 / (1600 * 200), 1e-12);
  ok('vRd,max = 0.5 nu fcd', p.vmax, 0.5 * 0.528 * 17, 1e-12);
  ok('u1 = 2(c1 + c2) + 4 pi d', p.u1, 1600 + 800 * Math.PI, 1e-9);
  ok('k = 2 at d 200', p.k, 2);
  ok('vRd,c = 0.12 k (100 rho fck)^1/3', p.vc, 0.24 * Math.cbrt(30), 1e-12);
  ok('vRd,c = 0.746', p.vc, 0.746, 0.001);
  ok('vEd,1 = 0.699', p.v1, 0.699, 0.001);
  ok('no links needed', p.needLinks, false);
  const q = E.punch({ code:'ec2', pos:'int', c1:400, c2:400, d:200, VEd:700, fck:30, fyk:500, rhoL:0.01 });
  ok('links needed at 700 kN', q.needLinks, true);
  ok('uout = beta V / vRd,c d', q.uout, 1.15 * 700e3 / (q.vc * 200), 1e-9);
  ok('rout = (uout - 1600) / 2 pi', q.rout, (q.uout - 1600) / (2 * Math.PI), 1e-9);
  ok('rout about 604 mm', q.rout, 604, 1);
  ok('fywd,ef = 250 + 0.25d', q.fywef, 300);
  ok('Asw/sr = (vEd - 0.75 vRd,c) u1 / 1.5 fywd,ef', q.AswSr, (q.v1 - 0.75 * q.vc) * q.u1 / 450, 1e-12);
  ok('Asw/sr about 3.83', q.AswSr, 3.83, 0.01);
  const e = E.punch({ code:'ec2', pos:'edge', c1:400, c2:400, d:200, VEd:300, fck:30, fyk:500, rhoL:0.01 });
  ok('edge beta 1.4', e.beta, 1.4);
  ok('edge u0 = min(c2 + 3d, c2 + 2c1)', e.u0, 1000);
  ok('edge u1 = 2c1 + c2 + 2 pi d', e.u1, 1200 + 400 * Math.PI, 1e-9);
  const c = E.punch({ code:'ec2', pos:'corner', c1:400, c2:400, d:200, VEd:150, fck:30, fyk:500, rhoL:0.01 });
  ok('corner u0 = min(3d, c1 + c2)', c.u0, 600);
  ok('corner u1 = c1 + c2 + pi d', c.u1, 800 + 200 * Math.PI, 1e-9);
  const lo = E.punch({ code:'ec2', pos:'int', c1:400, c2:400, d:200, VEd:500, fck:30, fyk:500, rhoL:0.001 });
  ok('vmin floor 0.035 k^1.5 fck^0.5', lo.vc, 0.035 * Math.pow(2, 1.5) * Math.sqrt(30), 1e-12);
}

console.log('\n=== BS 8110 punching ===');
{
  const p = E.punch({ code:'bs', pos:'int', c1:400, c2:400, d:200, VEd:500, fck:30, fyk:500, rhoL:0.01 });
  ok('Veff = 1.15 V', p.Veff, 575, 1e-9);
  ok('perimeter at 1.5d: 2(c1 + c2) + 12d', p.u1, 4000);
  ok('v = Veff / u d', p.v1, 575e3 / (4000 * 200), 1e-12);
  // Table 3.8: 0.79 x 1 x (400/200)^1/4 / 1.25 x (35/25)^1/3
  ok('vc from Table 3.8', p.vc, 0.79 * Math.pow(2, 0.25) / 1.25 * Math.cbrt(1.4), 1e-12);
  ok('face limit min(0.8 sqrt fcu, 5)', p.vmax, 0.8 * Math.sqrt(35), 1e-12);
  const e = E.punch({ code:'bs', pos:'edge', c1:400, c2:400, d:200, VEd:300, fck:30, fyk:500, rhoL:0.01 });
  ok('edge perimeter 2c1 + c2 + 6d', e.u1, 2400);
  ok('edge Veff 1.25 V', e.Veff, 375, 1e-9);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
