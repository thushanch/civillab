/* Engine tests for RCColumnEngine. Expected values are worked by hand here,
   independently of the engine, from EN 1992-1-1 and BS 8110-1. */
const E = require('../assets/js/rc-column-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' ? got === exp : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const A20 = Math.PI * 100;     // one H20, 314.16 mm²

console.log('=== Materials ===');
{
  const m = E.material('ec2', 30, 500);
  ok('EC2 fcd = 0.85*30/1.5', m.fc, 17, 1e-9);
  ok('EC2 fyd = 500/1.15', m.fyd, 434.7826, 1e-4);
  ok('EC2 lambda', m.lam, 0.8);
  const b = E.material('bs', 30, 500);
  ok('BS fcu = fck + 5', b.fcu, 35);
  ok('BS block 0.45 fcu', b.fc, 15.75, 1e-9);
  ok('BS block depth 0.9x', b.lam, 0.9);
  ok('BS steel 0.87 fy', b.fyd, 435, 1e-9);
}

console.log('\n=== Layout ===');
{
  const L = E.layout({ b: 300, h: 300, cover: 30, link: 10, phi: 20, nx: 2, ny: 2 });
  ok('4 corner bars', L.n, 4);
  ok('As = 4 H20', L.As, 4 * A20, 1e-9);
  ok('d2 = 30 + 10 + 10', L.d2, 50);
  ok('two layers', L.layers.length, 2);
  const L2 = E.layout({ b: 300, h: 500, cover: 30, link: 10, phi: 20, nx: 3, ny: 4 });
  ok('bar count 2nx + 2ny - 4', L2.n, 2 * 3 + 2 * 4 - 4);
  ok('layer sum equals As', L2.layers.reduce((a, l) => a + l.As, 0), L2.As, 1e-9);
  ok('top layer at d2', L2.layers[0].y, 50);
  ok('bottom layer at h - d2', L2.layers[3].y, 450);
  ok('intermediate layer evenly spaced', L2.layers[1].y, 50 + 400 / 3, 1e-9);
}

console.log('\n=== Plain concrete point, x = 200, 300 x 500 ===');
{
  // N = 17*300*0.8*200 = 816 kN, M = 816*(250 - 80) = 138.72 kNm
  const m = E.material('ec2', 30, 500);
  const r = E.section(300, 500, [], m, 200);
  ok('N plain', r.N, 816, 1e-9);
  ok('M plain', r.M, 138.72, 1e-9);
}

console.log('\n=== Reinforced point, x = 200, 3H20 each face at 50 and 450 ===');
{
  // top eps = 0.0035*150/200 = 0.002625, yields 434.78, minus 17 displaced
  // bottom eps = -0.004375, yields in tension
  const m = E.material('ec2', 30, 500);
  const As = 3 * A20, fyd = 500 / 1.15;
  const layers = [{ y: 50, As }, { y: 450, As }];
  const r = E.section(300, 500, layers, m, 200);
  const Fc = 816e3, Fs2 = (fyd - 17) * As, Fs1 = -fyd * As;
  ok('N at x=200', r.N, (Fc + Fs2 + Fs1) / 1e3, 1e-9);
  ok('M at x=200', r.M, (Fc * 170 + Fs2 * 200 - Fs1 * 200) / 1e6, 1e-9);
  ok('N value', r.N, 799.98, 0.05);
  ok('M value', r.M, 299.43, 0.05);
}

console.log('\n=== Pure bending, the same section, solved by hand ===');
{
  // 4080 x + As(700(x-50)/x - 17) = As fyd, top steel elastic and inside the block
  // gives 4080 x^2 + (683 As - As fyd) x - 35000 As = 0
  const As = 3 * A20, fyd = 500 / 1.15;
  const a = 4080, bq = 683 * As - As * fyd, c = -35000 * As;
  const x = (-bq + Math.sqrt(bq * bq - 4 * a * c)) / (2 * a);
  const ss = 700 * (x - 50) / x;
  const M = (a * x * (250 - 0.4 * x) + (ss - 17) * As * 200 + fyd * As * 200) / 1e6;
  const m = E.material('ec2', 30, 500);
  const it = E.interaction(300, 500, { layers: [{ y: 50, As }, { y: 450, As }], As: 2 * As }, m);
  ok('x at N = 0', it.xPure, x, 1e-4);
  ok('M at N = 0', it.pureM, M, 1e-4);
  ok('hand x is about 65.7 mm', x, 65.7, 0.1);
  ok('hand M is about 170.3 kNm', M, 170.3, 0.2);
}

console.log('\n=== Ends of the diagram, 300 x 300 with 4H20 ===');
{
  const L = E.layout({ b: 300, h: 300, cover: 30, link: 10, phi: 20, nx: 2, ny: 2 });
  const m = E.material('ec2', 30, 500);
  const it = E.interaction(300, 300, L, m);
  // uniform 0.002 strain: steel 400 MPa < fyd, so N0 = 17(Ac - As) + 400 As
  const N0 = (17 * (90000 - L.As) + 400 * L.As) / 1e3;
  ok('N0 with the eps_c2 pivot', it.N0, N0, 0.5);
  ok('N0 value about 2011 kN', it.N0, 2011.3, 0.6);
  ok('pure tension -As fyd', it.Nt, -L.As * 500 / 1.15 / 1e3, 1e-9);
  // balanced: x = 0.0035/(0.0035 + fyd/Es) d
  const xb = 0.0035 / (0.0035 + 500 / 1.15 / 200000) * 250;
  ok('balanced x', it.bal.x, xb, 1e-9);
  ok('balanced x = 0.617 d', it.bal.x / 250, 0.6169, 1e-3);
  const r = E.section(300, 300, L.layers, m, xb);
  ok('tension steel just yields at balance', r.steel[1].e, -500 / 1.15 / 200000, 1e-12);
  ok('balanced point carries the largest moment',
     it.pts.every(p => p.M <= it.bal.M * 1.03), true);
  ok('N rises monotonically with x', it.pts.slice(1).every((p, i) => p.N >= it.pts[i].N - 1e-6), true);
  ok('MRd at N0 is zero', it.MRd(it.N0 + 1) === null, true);
  const mid = it.MRd(800);
  ok('MRd(800) finds N = 800', mid.N, 800, 1e-6);
}

console.log('\n=== BS 8110 sweep tends to Nuz ===');
{
  const L = E.layout({ b: 300, h: 300, cover: 30, link: 10, phi: 20, nx: 2, ny: 2 });
  const m = E.material('bs', 30, 500);
  const it = E.interaction(300, 300, L, m);
  const Nuz = (15.75 * (90000 - L.As) + 435 * L.As) / 1e3;
  ok('BS N0 = 0.45 fcu (Ac - As) + 0.87 fy As', it.N0, Nuz, 0.5);
  ok('EC2 N0 above BS here, 17 > 15.75 outweighs 400 < 435', E.interaction(300, 300, L, E.material('ec2', 30, 500)).N0 > it.N0, true);
}

console.log('\n=== EC2 slenderness, 300 x 300, 4H20, l0 = 4 m, NEd = 1000 kN ===');
{
  const As = 4 * A20, fcd = 17, fyd = 500 / 1.15;
  const s = E.ec2Slender({ b: 300, h: 300, d: 250, As, fck: 30, fyk: 500, NEd: 1000, M: 30,
                           l0: 4, rm: 1, phiEf: 1 });
  const lam = 4000 * Math.sqrt(12) / 300;
  const n = 1000e3 / (90000 * fcd);
  ok('lambda = l0 sqrt12 / h', s.lam, lam, 1e-9);
  ok('lambda = 46.19', s.lam, 46.19, 0.01);
  ok('n = NEd / Ac fcd', s.n, n, 1e-9);
  ok('default lambda_lim = 20(0.7)(1.1)(0.7)/sqrt n', s.lamLim0, 10.78 / Math.sqrt(n), 1e-9);
  ok('default lambda_lim = 13.33', s.lamLim0, 13.33, 0.01);
  const omA = As * fyd / (90000 * fcd);
  ok('full lambda_lim with A = 1/1.2, B = sqrt(1 + 2 omega), C = 0.7', s.lamLim, 20 / 1.2 * Math.sqrt(1 + 2 * omA) * 0.7 / Math.sqrt(n), 1e-9);
  ok('full lambda_lim = 18.89', s.lamLim, 18.89, 0.01);
  ok('slender', s.slender, true);
  const om = As * fyd / (90000 * fcd), nu = 1 + om;
  const Kr = (nu - n) / (nu - 0.4);
  const Kphi = 1 + (0.35 + 30 / 200 - lam / 150) * 1;
  const e2 = Kr * Kphi * (fyd / 200000) / (0.45 * 250) * 16e6 / 10;
  ok('Kr', s.Kr, Kr, 1e-12);
  ok('Kr = 0.735', s.Kr, 0.735, 0.001);
  ok('Kphi = 1.192', s.Kphi, 1.192, 0.001);
  ok('e2', s.e2, e2, 1e-9);
  ok('e2 = 27.1 mm', s.e2, 27.1, 0.05);
  ok('M2 = NEd e2', s.M2, 1000 * e2 / 1000, 1e-9);
  ok('ei = l0/400 = 10 mm', s.ei, 10);
  ok('M02 = M + NEd ei', s.M02, 30 + 10, 1e-9);
  ok('MEd = M0e + M2 with rm = 1', s.MEd, 40 + s.M2, 1e-9);
  ok('e0 = max(h/30, 20)', s.e0, 20);
  const st = E.ec2Slender({ b: 300, h: 300, d: 250, As, fck: 30, fyk: 500, NEd: 1000, M: 30,
                            l0: 0.8, rm: 1, phiEf: 1 });
  ok('stocky column is short', st.slender, false);
  ok('short MEd = M + NEd ei', st.MEd, 32, 1e-9);
  const tiny = E.ec2Slender({ b: 300, h: 300, d: 250, As, fck: 30, fyk: 500, NEd: 1000, M: 0,
                              l0: 0.8, rm: 1, phiEf: 1 });
  ok('minimum moment NEd e0 governs at zero M', tiny.MEd, 20, 1e-9);
  const cp = E.ec2Slender({ b: 300, h: 300, d: 250, As, fck: 30, fyk: 500, NEd: 1000, M: 30,
                            l0: 4, rm: -1, phiEf: 1 });
  ok('double curvature raises lambda_lim by C = 2.7', cp.lamLim / s.lamLim, 2.7 / 0.7, 1e-9);
}

console.log('\n=== BS 8110 slenderness ===');
{
  const As = 4 * A20;
  const s = E.bsSlender({ b: 300, h: 300, d: 250, As, fck: 30, fyk: 500, NEd: 1000, M: 30, l0: 6, bMin: 300 });
  ok('le/h = 20', s.ratio, 20);
  ok('slender above 15', s.slender, true);
  const Nuz = (15.75 * (90000 - As) + 435 * As) / 1e3;
  const Nbal = 0.25 * 35 * 300 * 250 / 1e3;
  ok('Nuz', s.Nuz, Nuz, 1e-9);
  ok('Nbal = 0.25 fcu b d', s.Nbal, 656.25, 1e-9);
  ok('betaA = (le/b)^2/2000 = 0.2', s.betaA, 0.2, 1e-12);
  const K = (Nuz - 1000) / (Nuz - Nbal);
  ok('K', s.K, K, 1e-12);
  ok('au = betaA K h', s.au, 0.2 * K * 300, 1e-9);
  ok('Mt = M + N au', s.Mt, 30 + 1000 * 0.2 * K * 300 / 1000, 1e-9);
  ok('emin = 0.05h capped at 20', s.emin, 15);
}

console.log('\n=== Biaxial factors ===');
ok('a = 1 at 0.1', E.biaxialA(0.1), 1);
ok('a = 1.5 at 0.7', E.biaxialA(0.7), 1.5, 1e-12);
ok('a = 2 at 1.0', E.biaxialA(1.0), 2, 1e-12);
ok('a = 1.25 at 0.4', E.biaxialA(0.4), 1.25, 1e-12);
ok('BS beta = 1 at 0', E.bsBeta(0), 1);
ok('BS beta = 0.65 at 0.3', E.bsBeta(0.3), 0.65, 1e-12);
ok('BS beta = 0.3 at 0.8', E.bsBeta(0.8), 0.3);
ok('BS beta interpolated at 0.25', E.bsBeta(0.25), 0.71, 1e-12);

console.log('\n=== Full solve ===');
{
  const base = { code: 'ec2', b: 300, h: 400, cover: 30, link: 10, phi: 20, nx: 3, ny: 3,
                 fck: 30, fyk: 500, NEd: 1200, Mx: 80, My: 20, l0: 3.5, rm: 0.5, phiEf: 1 };
  const r = E.solve(base);
  ok('8 bars', r.layX.n, 8);
  ok('same As both axes', r.layY.As, r.layX.As, 1e-9);
  ok('MRdx at NEd sits on the curve', r.capX.N, 1200, 1e-6);
  ok('minor axis capacity is smaller', r.MRdy < r.MRdx, true);
  ok('ux = MEdx / MRdx', r.ux, r.MEdx / r.MRdx, 1e-12);
  ok('biaxial util = ux^a + uy^a', r.biax.util, Math.pow(r.ux, r.biax.a) + Math.pow(r.uy, r.biax.a), 1e-12);
  ok('NRd = Ac fcd + As fyd', r.NRd, (120000 * 17 + r.As * 500 / 1.15) / 1e3, 1e-9);
  ok('AsMin = max(0.1 NEd/fyd, 0.002 Ac)', r.AsMin, Math.max(0.1 * 1200e3 / (500 / 1.15), 240), 1e-9);
  ok('AsMax = 0.04 Ac', r.AsMax, 4800, 1e-9);
  const big = E.solve(Object.assign({}, base, { NEd: 5000 }));
  ok('beyond N0 the axial check fails', big.axialUtil > 1, true);
  ok('beyond N0 MRd is zero', big.MRdx, 0);
  const b2 = E.solve(Object.assign({}, base, { Mx: 160 }));
  ok('doubling Mx raises ux', b2.ux > r.ux, true);
  const bs = E.solve(Object.assign({}, base, { code: 'bs' }));
  ok('BS solve runs', isFinite(bs.ux), true);
  ok('BS biaxial enhances x', bs.biax.about === 'x', true);
  ok('BS enhanced moment above MEdx', bs.biax.Menh > bs.MEdx, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
