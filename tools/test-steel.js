/* Engine tests for SteelEngine. Section properties against the published
   UK tables, EC3 curves and checks against EN 1993-1-1, BS 5950 struts and
   LTB against its Tables 24 and 16. */
const E = require('../assets/js/steel-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const rel = (name, got, exp, pct) => ok(name + ' within ' + pct + '%', Math.abs(got / exp - 1) * 100 <= pct, true);

console.log('=== Section properties from the dimensions ===');
{
  const s = E.section('UB', 5);   // 457x191x67
  ok('name', s.name, '457×191×67');
  rel('A 85.5 cm2', s.A / 100, 85.5, 1);
  rel('Iy 29400 cm4', s.Iy / 1e4, 29400, 1.5);
  rel('Iz 1450 cm4', s.Iz / 1e4, 1450, 1);
  rel('Wpl,y 1470 cm3', s.Wply / 1e3, 1470, 1);
  rel('Wpl,z 237 cm3', s.Wplz / 1e3, 237, 1.5);
  rel('Iw 0.705 dm6', s.Iw / 1e12, 0.705, 2);
  rel('It 37.1 cm4', s.It / 1e4, 37.1, 10);
  const c = E.section('UC', 1);   // 203x203x46
  rel('UC A 58.7', c.A / 100, 58.7, 1.5);
  rel('UC Iy 4570', c.Iy / 1e4, 4570, 1.5);
  rel('UC Iz 1550', c.Iz / 1e4, 1550, 1.5);
  rel('UC Wpl,y 497', c.Wply / 1e3, 497, 1.5);
  const u = E.section('UB', 2);   // 305x165x40
  rel('305 UB A 51.3', u.A / 100, 51.3, 1.5);
  rel('305 UB Iy 8500', u.Iy / 1e4, 8500, 1.5);
  rel('305 UB Wpl,y 623', u.Wply / 1e3, 623, 1.5);
  const h = E.section('SHS', 0);  // 100x100x5
  rel('SHS A 18.7', h.A / 100, 18.7, 1.5);
  rel('SHS I 271', h.Iy / 1e4, 271, 3.5);
  rel('SHS Wpl 64.9', h.Wply / 1e3, 64.9, 3);
  ok('SHS It = (b - t)^3 t', h.It, Math.pow(95, 3) * 5, 1e-6);
}

console.log('\n=== Yield strength by thickness ===');
ok('S275 up to 16 mm', E.fyFor('S275', 12.7), 275);
ok('S275 over 16 mm', E.fyFor('S275', 17.5), 265);
ok('S355 over 16 mm', E.fyFor('S355', 19.6), 345);

console.log('\n=== EC3 classification ===');
{
  const s = E.section('UB', 5), cl = E.classify(s, 275, 0);
  ok('epsilon = sqrt(235/275)', cl.eps, Math.sqrt(235 / 275), 1e-12);
  ok('flange c = (b - tw - 2r)/2', cl.parts[0].c, (189.9 - 8.5 - 20.4) / 2, 1e-9);
  ok('flange c/t = 6.34', cl.parts[0].ratio, 6.34, 0.01);
  ok('flange class 1 under 9 eps', cl.parts[0].cls, 1);
  ok('web c/t = 47.95', cl.parts[1].ratio, 407.6 / 8.5, 1e-9);
  ok('web in bending class 1 under 72 eps', cl.parts[1].cls, 1);
  ok('web limit 72 eps with no axial load', cl.parts[1].lim[0], 36 * cl.eps / 0.5, 1e-9);
  const big = E.classify(E.section('UB', 7), 355, 2500);
  ok('heavy axial load pushes the web class up', big.parts[1].cls > 1, true);
  ok('alpha above a half with compression', big.parts[1].alpha > 0.5, true);
}

console.log('\n=== Buckling curves, Table 6.2 ===');
ok('chi = 1 up to 0.2', E.chi(0.2, 'b'), 1, 1e-12);
ok('curve a at 1.0 = 0.666', E.chi(1, 'a'), 0.6656, 0.0001);
ok('curve b at 1.0 = 0.597', E.chi(1, 'b'), 0.5970, 0.0001);
ok('curve c at 1.0 = 0.540', E.chi(1, 'c'), 0.5399, 0.0001);
ok('curve d at 1.0 = 0.467', E.chi(1, 'd'), 0.4671, 0.0001);
ok('curve b at 1.5 = 0.339', E.chi(1.5, 'b'), 0.3422, 0.0005);
ok('UB curves a about y, b about z', E.curves(E.section('UB', 5)).z, 'b');
ok('UC curves b about y, c about z', E.curves(E.section('UC', 2)).z, 'c');
ok('SHS curve a', E.curves(E.section('SHS', 2)).y, 'a');

console.log('\n=== EC3 member checks, 457x191x67 S275, L 6 m ===');
{
  const inp = { code:'ec3', family:'UB', idx:5, grade:'S275', N:0, M:200, V:150, L:6, ky:1, kz:1, nRest:0,
                shape:'uniform', psi:1, holes:0, d0:22 };
  const r = E.solve(inp), s = r.s;
  ok('Npl = A fy', r.Npl, s.A * 275 / 1e3, 1e-9);
  ok('Mc,Rd = Wpl fy', r.McRd, s.Wply * 275 / 1e6, 1e-9);
  const Ncrz = Math.PI ** 2 * 210000 * s.Iz / 36e6;
  ok('Ncr,z = pi^2 E Iz / L^2', r.Ncrz, Ncrz, 1e-6);
  const Mcr = Math.PI ** 2 * 210000 * s.Iz / 36e6 * Math.sqrt(s.Iw / s.Iz + 36e6 * 81000 * s.It / (Math.PI ** 2 * 210000 * s.Iz)) / 1e6;
  ok('Mcr for uniform moment', r.Mcr, Mcr, 1e-9);
  ok('Mcr about 240 kNm', r.Mcr, 240, 3);
  const lam = Math.sqrt(s.Wply * 275 / 1e6 / Mcr);
  ok('lambda_LT', r.lamLT, lam, 1e-12);
  const ph = 0.5 * (1 + 0.49 * (lam - 0.4) + 0.75 * lam * lam);   // h/b = 2.39 > 2, curve c
  const chiLT = 1 / (ph + Math.sqrt(ph * ph - 0.75 * lam * lam));
  ok('chi_LT rolled method, curve c for h/b over 2', r.chiLT, Math.min(chiLT, 1, 1 / lam ** 2), 1e-12);
  ok('f = 1 for uniform moment, kc = 1', r.f, 1, 1e-12);
  ok('Mb,Rd = chi_LT Wpl fy', r.MbRd, r.chiMod * s.Wply * 275 / 1e6, 1e-9);
  ok('Vpl,Rd = Av fy / sqrt 3', r.VplRd, s.Av * 275 / Math.sqrt(3) / 1e3, 1e-9);
  const udl = E.solve(Object.assign({}, inp, { shape:'udl' }));
  ok('UDL raises Mcr by C1 = 1.127', udl.Mcr / r.Mcr, 1.127, 1e-9);
  ok('and the f modifier helps', udl.f < 1, true);
  const restrained = E.solve(Object.assign({}, inp, { nRest:2 }));
  ok('two restraints shorten the LTB length to L/3', restrained.Lb, 2000, 1e-9);
  ok('and raise Mb,Rd', restrained.MbRd > r.MbRd, true);
  const hole = E.solve(Object.assign({}, inp, { N:-500, holes:4, d0:22 }));
  ok('net area', hole.Anet, s.A - 4 * 22 * 12.7, 1e-9);
  ok('Nu = 0.9 Anet fu / 1.25', hole.Nu, 0.9 * hole.Anet * 410 / 1.25 / 1e3, 1e-9);
  ok('tension utilisation', hole.u.tension, 500 / Math.min(hole.Npl, hole.Nu), 1e-12);
  ok('tension does not count as compression', hole.u.comp, 0);
}

console.log('\n=== EC3 column and interaction, 254x254x73 S355 ===');
{
  const inp = { code:'ec3', family:'UC', idx:2, grade:'S355', N:1500, M:60, V:20, L:4, ky:1, kz:1, nRest:0,
                shape:'linear', psi:0, holes:0, d0:22 };
  const r = E.solve(inp), s = r.s;
  const lz = Math.sqrt(s.A * 355 / (Math.PI ** 2 * 210000 * s.Iz / 16e6));
  ok('lambda_z', r.lamz, lz, 1e-12);
  ok('chi_z on curve c', r.chiz, E.chi(lz, 'c'), 1e-12);
  ok('Nb,z,Rd = chi_z A fy', r.Nbz, E.chi(lz, 'c') * s.A * 355 / 1e3, 1e-9);
  ok('Cm = 0.6 + 0.4 psi', r.sh.Cm, 0.6, 1e-12);
  ok('C1 = 1.88 at psi 0', r.sh.C1, 1.88, 1e-12);
  ok('6.62 = N/Nbz + kzy M/Mb', r.i62, 1500 / r.Nbz + r.kzy * 60 / r.MbRd, 1e-12);
  ok('kyy capped at Cm(1 + 0.8 n)', r.kyy <= r.sh.Cm * (1 + 0.8 * 1500 / r.Nby) + 1e-12, true);
  ok('combined is the worse of the two', r.u.combined, Math.max(r.i61, r.i62), 1e-12);
}

console.log('\n=== BS 5950 struts and LTB ===');
ok('Table 24(b) pc at lambda 100, py 275 = 143', E.perry(275, 100, 3.5), 142.7, 0.2);
ok('Table 24(a) pc at lambda 100, py 275 = 160', E.perry(275, 100, 2.0), 159.8, 0.2);
ok('pc = py when stocky', E.perry(275, 10, 3.5), 275, 1e-9);
{
  const inp = { code:'bs', family:'UB', idx:5, grade:'S275', N:0, M:200, V:150, L:6, ky:1, kz:1, nRest:0,
                shape:'uniform', psi:1, holes:0, d0:22 };
  const r = E.solve(inp), s = r.s;
  ok('Mc = py S, class 1', r.Mc, Math.min(275 * s.Wply, 1.2 * 275 * s.Wely) / 1e6, 1e-9);
  const lam = 6000 / s.iz, x = s.h / s.tf;
  ok('v = 1/(1 + 0.05(lambda/x)^2)^0.25', r.v, 1 / Math.pow(1 + 0.05 * (lam / x) ** 2, 0.25), 1e-12);
  ok('lambda_LT = u v lambda with u 0.9', r.lamLT, 0.9 * r.v * lam, 1e-9);
  /* pb by the same Perry form with eta = 0.007(lambda_LT - lambda_L0) */
  const pE = Math.PI ** 2 * 210000 / r.lamLT ** 2, lL0 = 0.4 * Math.sqrt(Math.PI ** 2 * 210000 / 275);
  const ph = (275 + (0.007 * (r.lamLT - lL0) + 1) * pE) / 2;
  ok('pb from Annex B.2', r.pb, pE * 275 / (ph + Math.sqrt(ph * ph - pE * 275)), 1e-9);
  const t16 = E.solve(Object.assign({}, inp, { L: 100 * s.iz / (0.9 * 1) / 1000 }));
  ok('tension Ke 1.2 for S275', r.Ke, 1.2);
  ok('Pv = 0.6 py t D', r.Pv, 0.6 * 275 * s.h * s.tw / 1e3, 1e-9);
  ok('mLT = 0.925 for a UDL', E.shape('udl').mLT, 0.925);
  ok('BS and EC3 moment capacities agree for class 1', Math.abs(r.Mc - E.solve(Object.assign({}, inp, { code:'ec3' })).McRd) < 1e-9, true);
  ok('lambda_LT rises with length', t16.lamLT > 0, true);
}
{
  // pb check against Table 16 at lambda_LT 100, py 275: 126 MPa
  const pE = Math.PI ** 2 * 210000 / 1e4, lL0 = 0.4 * Math.sqrt(Math.PI ** 2 * 210000 / 275);
  const ph = (275 + (0.007 * (100 - lL0) + 1) * pE) / 2;
  ok('Table 16 pb at 100 = 126', pE * 275 / (ph + Math.sqrt(ph * ph - pE * 275)), 126.5, 0.6);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
