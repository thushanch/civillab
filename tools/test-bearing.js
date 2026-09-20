/* engine tests for bearing-engine.js */
const B = require('../assets/js/bearing-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  if (tol == null) tol = 0;
  if (typeof got === 'boolean' || typeof exp === 'boolean') {
    const good = got === exp;
    if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
    else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp); }
    return;
  }
  const g = typeof got === 'number' ? got : parseFloat(got);
  const good = Math.abs(g - exp) <= tol;
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + ' +/- ' + tol); }
}

console.log('=== General bearing capacity factors ===');
{
  const f0 = B.generalFactors(0);
  ok('Nc at phi=0 is pi+2', f0.Nc, Math.PI + 2, 1e-10);
  ok('Nq at phi=0 is 1', f0.Nq, 1, 1e-10);
  ok('Ng at phi=0 is 0', f0.Ng, 0, 1e-10);

  const f30 = B.generalFactors(30);
  ok('Nq at phi=30', f30.Nq, 18.40, 0.02);
  ok('Nc at phi=30', f30.Nc, 30.14, 0.05);
  ok('Ng at phi=30 (Vesic)', f30.Ng, 22.40, 0.05);

  const f45 = B.generalFactors(45);
  ok('Nq at phi=45', f45.Nq, 134.88, 0.2);
  ok('Nc at phi=45', f45.Nc, 133.88, 0.2);

  const f10 = B.generalFactors(10);
  ok('Nq at phi=10', f10.Nq, 2.47, 0.02);

  const f20 = B.generalFactors(20);
  ok('Nq at phi=20', f20.Nq, 6.40, 0.02);
}

console.log('\n=== Terzaghi bearing capacity factors ===');
{
  const f0 = B.terzaghiFactors(0);
  ok('Terzaghi Nc at phi=0 is 5.7', f0.Nc, 5.7, 1e-10);
  ok('Terzaghi Nq at phi=0 is 1', f0.Nq, 1, 1e-10);
  ok('Terzaghi Ng at phi=0 is 0', f0.Ng, 0, 1e-10);

  const f30 = B.terzaghiFactors(30);
  ok('Terzaghi Nq at phi=30', f30.Nq, 22.46, 0.1);
  ok('Terzaghi Nc at phi=30', f30.Nc, 37.16, 0.2);
  ok('Terzaghi Ng at phi=30', f30.Ng, 19.7, 0.01);

  ok('Terzaghi Nq > general Nq at phi=30',
    f30.Nq > B.generalFactors(30).Nq, true);
  ok('Terzaghi Nc > general Nc at phi=30',
    f30.Nc > B.generalFactors(30).Nc, true);
}

console.log('\n=== Strip footing on phi=0 clay, surface (D=0) ===');
{
  const r = B.solve({ method:'general', shape:'strip',
    B:2, D:0, gamma:18, c:50, phi:0 });
  ok('qu = cNc for phi=0 strip at surface',
    r.qu, 50 * (Math.PI + 2), 0.01);
  ok('term1 is cNc', r.term1, 50 * (Math.PI + 2), 0.01);
  ok('term2 is zero at D=0', r.term2, 0, 1e-10);
  ok('term3 is zero', r.term3, 0, 1e-10);
  ok('strip shape factors are all 1',
    r.sf.sc === 1 && r.sf.sq === 1 && r.sf.sg === 1, true);
}

console.log('\n=== Strip footing on phi=0 clay, embedded (D=1) ===');
{
  const r = B.solve({ method:'general', shape:'strip',
    B:2, D:1, gamma:18, c:50, phi:0 });
  const dc = 1 + 0.4 * (1 / 2);
  ok('term1 includes dc', r.term1, 50 * (Math.PI + 2) * dc, 0.01);
  ok('term2 = gammaD (dq=1 at phi=0)', r.term2, 18, 0.01);
  ok('depth factor dc = 1.2 at D/B=0.5', r.df.dc, 1.2, 1e-10);
  ok('depth factor dq = 1 at phi=0', r.df.dq, 1, 1e-10);
}

console.log('\n=== Terzaghi strip on phi=0 clay ===');
{
  const r = B.solve({ method:'terzaghi', shape:'strip',
    B:2, D:1, gamma:18, c:50, phi:0 });
  ok('Terzaghi qu = 5.7c + q', r.qu, 50 * 5.7 + 18, 0.01);
  ok('Terzaghi depth factors are 1',
    r.df.dc === 1 && r.df.dq === 1 && r.df.dg === 1, true);
}

console.log('\n=== General strip on sand, phi=30 at surface ===');
{
  const r = B.solve({ method:'general', shape:'strip',
    B:2, D:0, gamma:18, c:0, phi:30 });
  const Nq = B.generalFactors(30).Nq;
  const Ng = B.generalFactors(30).Ng;
  ok('term1 is zero for cohesionless', r.term1, 0, 1e-10);
  ok('term2 is zero at surface', r.term2, 0, 1e-10);
  ok('term3 = 0.5 gamma B Ng', r.term3, 0.5 * 18 * 2 * Ng, 0.1);
  ok('qu = term3 only', r.qu, r.term3, 1e-6);
}

console.log('\n=== General strip on sand, phi=30 embedded ===');
{
  const r = B.solve({ method:'general', shape:'strip',
    B:2, D:1.5, gamma:18, c:0, phi:30 });
  const Nq = B.generalFactors(30).Nq;
  const Ng = B.generalFactors(30).Ng;
  const df = B.depthFactors(1.5, 2, 30);
  ok('term2 = q Nq dq', r.term2, 18 * 1.5 * Nq * df.dq, 0.1);
  ok('term3 = 0.5 gamma B Ng (dg=1)', r.term3, 0.5 * 18 * 2 * Ng, 0.1);
  ok('qu = term2 + term3', r.qu, r.term2 + r.term3, 1e-6);
}

console.log('\n=== Shape factors ===');
{
  const rStrip = B.solve({ method:'general', shape:'strip', B:2, D:1, gamma:18, c:20, phi:25 });
  const rSq = B.solve({ method:'general', shape:'square', B:2, D:1, gamma:18, c:20, phi:25 });
  ok('square qu > strip qu (shape helps)', rSq.qu > rStrip.qu, true);
  ok('square sc > 1', rSq.sf.sc > 1, true);
  ok('square sg < 1', rSq.sf.sg < 1, true);
  ok('square sq > 1 when phi > 0', rSq.sf.sq > 1, true);

  const rCirc = B.solve({ method:'general', shape:'circle', B:2, D:1, gamma:18, c:20, phi:25 });
  ok('circle has same factors as square',
    Math.abs(rCirc.sf.sc - rSq.sf.sc) < 1e-10, true);
}

console.log('\n=== Terzaghi shape factors ===');
{
  const sf = B.shapeFactors('terzaghi', 'strip', 2, Infinity, {}, 30);
  ok('Terzaghi strip sc = 1', sf.sc, 1, 0);
  ok('Terzaghi strip sg = 1', sf.sg, 1, 0);
  const sfSq = B.shapeFactors('terzaghi', 'square', 2, 2, {}, 30);
  ok('Terzaghi square sc = 1.3', sfSq.sc, 1.3, 0);
  ok('Terzaghi square sg = 0.8', sfSq.sg, 0.8, 0);
  const sfC = B.shapeFactors('terzaghi', 'circle', 2, 2, {}, 30);
  ok('Terzaghi circle sc = 1.3', sfC.sc, 1.3, 0);
  ok('Terzaghi circle sg = 0.6', sfC.sg, 0.6, 0);
}

console.log('\n=== Depth factors ===');
{
  const df = B.depthFactors(1, 2, 30);
  ok('dc > 1 at D/B=0.5', df.dc > 1, true);
  ok('dc = 1 + 0.4(0.5) = 1.2', df.dc, 1.2, 1e-10);
  ok('dg = 1 always', df.dg, 1, 0);
  ok('dq > 1 when phi > 0', df.dq > 1, true);

  const dfDeep = B.depthFactors(3, 2, 30);
  ok('deep footing uses arctan', dfDeep.dc, 1 + 0.4 * Math.atan(1.5), 1e-10);

  ok('depth increases qu',
    B.solve({ method:'general', shape:'strip', B:2, D:2, gamma:18, c:20, phi:25 }).qu >
    B.solve({ method:'general', shape:'strip', B:2, D:0.5, gamma:18, c:20, phi:25 }).qu, true);
}

console.log('\n=== Water table ===');
{
  const rDry = B.solve({ method:'general', shape:'strip', B:2, D:1.5, gamma:18, c:0, phi:30 });
  const rWet = B.solve({ method:'general', shape:'strip', B:2, D:1.5, gamma:18, gammaSat:20, c:0, phi:30, zw:0 });
  ok('water at surface drops qu', rWet.qu < rDry.qu, true);
  ok('water case 1 when zw <= D', rWet.waterCase, 1, 0);

  const rMid = B.solve({ method:'general', shape:'strip', B:2, D:1.5, gamma:18, gammaSat:20, c:0, phi:30, zw:2.0 });
  ok('water case 2 between D and D+B', rMid.waterCase, 2, 0);
  ok('intermediate water gives intermediate qu',
    rMid.qu > rWet.qu && rMid.qu < rDry.qu, true);

  const rDeep = B.solve({ method:'general', shape:'strip', B:2, D:1.5, gamma:18, gammaSat:20, c:0, phi:30, zw:10 });
  ok('water case 3 when deep', rDeep.waterCase, 3, 0);
  ok('deep water = dry case', Math.abs(rDeep.qu - rDry.qu) < 0.01, true);

  ok('overburden q drops with water at surface', rWet.q < rDry.q, true);
  ok('overburden q uses gamma_sub', rWet.q, (20 - 9.81) * 1.5, 0.01);
}

console.log('\n=== Eccentricity ===');
{
  const r0 = B.solve({ method:'general', shape:'strip', B:3, D:0, gamma:18, c:0, phi:30, eB:0 });
  const r1 = B.solve({ method:'general', shape:'strip', B:3, D:0, gamma:18, c:0, phi:30, eB:0.5 });
  ok('B\' = B - 2e', r1.Bp, 2, 1e-10);
  ok('eccentricity reduces qu', r1.qu < r0.qu, true);
  ok('eccentricity reduces term3', r1.term3 < r0.term3, true);
  ok('term2 unchanged at D=0', Math.abs(r1.term2 - r0.term2) < 1e-10, true);
}

console.log('\n=== Factor of safety ===');
{
  const r = B.solve({ method:'general', shape:'strip', B:2, D:1, gamma:18, c:50, phi:0, FoS:3 });
  ok('qa = qu / FoS', r.qa, r.qu / 3, 1e-6);
  ok('net qu = qu - q', r.qnet, r.qu - r.q, 1e-6);

  const r2 = B.solve({ method:'general', shape:'strip', B:2, D:1, gamma:18, c:50, phi:0, FoS:3, qApp:50 });
  ok('actual FoS = qu / qApp', r2.actualFoS, r2.qu / 50, 0.01);
  ok('safe when qApp <= qa', r2.safe, r2.qApp <= r2.qa);
}

console.log('\n=== Proportionality checks ===');
{
  const r1 = B.solve({ method:'general', shape:'strip', B:2, D:0, gamma:18, c:50, phi:0 });
  const r2 = B.solve({ method:'general', shape:'strip', B:2, D:0, gamma:18, c:100, phi:0 });
  ok('doubling c doubles term1', r2.term1 / r1.term1, 2, 1e-6);
  ok('doubling c does not change term2', Math.abs(r2.term2 - r1.term2) < 1e-6, true);

  const rB1 = B.solve({ method:'general', shape:'strip', B:1, D:0, gamma:18, c:0, phi:30 });
  const rB2 = B.solve({ method:'general', shape:'strip', B:2, D:0, gamma:18, c:0, phi:30 });
  ok('doubling B doubles term3 (strip)', rB2.term3 / rB1.term3, 2, 0.01);
  ok('doubling B does not change term2 at D=0',
    Math.abs(rB2.term2 - rB1.term2) < 1e-10, true);
}

console.log('\n=== Wedge geometry ===');
{
  const w = B.wedgeGeometry(2, 30);
  ok('active zone angle is 60 degrees', w.alpha, 60, 0.01);
  ok('wedge depth is (B/2)tan(alpha)', w.d, Math.tan(60 * Math.PI / 180), 0.001);
  ok('spiral has 25 points', w.spiral.length, 25, 0);
  ok('spiral starts at base of active zone',
    Math.abs(w.spiral[0].z - w.d) < 0.01, true);
  ok('spiral end is below the surface (z > 0)',
    w.spiral[w.spiral.length - 1].z > 0.01, true);
  ok('surface extent is wider than the footing', w.surfaceX > 1, true);

  const w0 = B.wedgeGeometry(2, 5);
  const w45 = B.wedgeGeometry(2, 45);
  ok('higher phi gives wider failure zone', w45.surfaceX > w0.surfaceX, true);
  ok('higher phi gives deeper active zone', w45.d > w0.d, true);
}

console.log('\n=== Boussinesq strip stress ===');
{
  ok('stress at z=0 is q', B.boussinesqStrip(2, 0), 1, 1e-6);
  ok('stress decays with depth', B.boussinesqStrip(2, 2) < 1, true);
  ok('stress at z=B is about 0.55', B.boussinesqStrip(2, 2), 0.55, 0.02);
  ok('stress at z=2B is about 0.31', B.boussinesqStrip(2, 4), 0.31, 0.02);
}

console.log('\n=== Cross-method comparison ===');
{
  const rG = B.solve({ method:'general', shape:'strip', B:2, D:0, gamma:18, c:50, phi:0 });
  const rT = B.solve({ method:'terzaghi', shape:'strip', B:2, D:0, gamma:18, c:50, phi:0 });
  ok('Terzaghi gives higher qu at phi=0 (5.7 > 5.14)',
    rT.qu > rG.qu, true);
  ok('difference is (5.7 - 5.14) * c',
    rT.qu - rG.qu, (5.7 - (Math.PI + 2)) * 50, 0.01);

  const rGs = B.solve({ method:'general', shape:'strip', B:2, D:1.5, gamma:18, c:0, phi:30 });
  const rTs = B.solve({ method:'terzaghi', shape:'strip', B:2, D:1.5, gamma:18, c:0, phi:30 });
  ok('Terzaghi Nq is larger at phi=30', rTs.N.Nq > rGs.N.Nq, true);
}

console.log('\n=== Rectangular footing ===');
{
  const r = B.solve({ method:'general', shape:'rect', B:2, L:4, D:1, gamma:18, c:20, phi:25 });
  ok('Lp = L when no eccentricity', r.Lp, 4, 1e-10);
  ok('shape factors use B/L',
    r.sf.sc > 1 && r.sf.sc <
      B.solve({ method:'general', shape:'square', B:2, D:1, gamma:18, c:20, phi:25 }).sf.sc, true);
  ok('rect qu between strip and square',
    r.qu > B.solve({ method:'general', shape:'strip', B:2, D:1, gamma:18, c:20, phi:25 }).qu &&
    r.qu < B.solve({ method:'general', shape:'square', B:2, D:1, gamma:18, c:20, phi:25 }).qu, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
