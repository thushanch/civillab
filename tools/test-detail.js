/* Engine tests for DetailEngine, hand values from EN 1992-1-1 8.4, 8.7, 4.4,
   8.2, EN 1992-1-2 Tables 5.5 and 5.8, and BS 8110-1 3.12.8, Tables 3.3, 3.4 */
const E = require('../assets/js/detail-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Bond stress, C30 ===');
{
  const b = E.bond({ fck:30, phi:20, bond:'good' });
  const fctm = 0.3 * Math.pow(30, 2 / 3);
  ok('fctm = 0.30 fck^2/3', b.fctm, fctm, 1e-12);
  ok('fctm = 2.90', b.fctm, 2.90, 0.005);
  ok('fctk,0.05 = 0.7 fctm', b.fctk, 0.7 * fctm, 1e-12);
  ok('fctd = fctk / 1.5', b.fctd, 0.7 * fctm / 1.5, 1e-12);
  ok('fbd = 2.25 fctd = 3.04', b.fbd, 3.04, 0.005);
  ok('poor bond eta1 = 0.7', E.bond({ fck:30, phi:20, bond:'poor' }).fbd, 0.7 * b.fbd, 1e-12);
  ok('eta2 = (132 - 40)/100 for H40', E.bond({ fck:30, phi:40, bond:'good' }).eta2, 0.92, 1e-12);
  ok('eta2 = 1 up to 32', E.bond({ fck:30, phi:32, bond:'good' }).eta2, 1);
}

console.log('\n=== Basic anchorage, H20, C30, fyk 500 ===');
{
  const fbd = 2.25 * 0.7 * 0.3 * Math.pow(30, 2 / 3) / 1.5;
  const lb = 20 / 4 * (500 / 1.15) / fbd;
  const a = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:20 });
  ok('lb,rqd = (phi/4)(fyd/fbd)', a.lbrqd, lb, 1e-9);
  ok('lb,rqd about 715 mm, 36 phi', a.lbrqd, 715, 1);
  ok('all alphas 1 when cd = phi', a.a1 * a.a2 * a.a3 * a.a4 * a.a5, 1, 1e-12);
  ok('lbd = lb,rqd', a.lbd, lb, 1e-9);
  const a2 = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:40 });
  ok('alpha2 = 1 - 0.15(cd - phi)/phi = 0.85', a2.a2, 0.85, 1e-12);
  ok('lbd = 0.85 lb,rqd', a2.lbd, 0.85 * lb, 1e-9);
  const big = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:200 });
  ok('alpha2 floors at 0.7', big.a2, 0.7, 1e-12);
  const bent = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'bent', cd:80 });
  ok('bent with cd > 3phi gives alpha1 = 0.7', bent.a1, 0.7);
  ok('bent alpha2 = 1 - 0.15(cd - 3phi)/phi', bent.a2, 1 - 0.15 * 20 / 20, 1e-12);
  const bentClose = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'bent', cd:50 });
  ok('bent with small cd keeps alpha1 = 1', bentClose.a1, 1);
  const w = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:20, welded:true });
  ok('welded transverse bar alpha4 = 0.7', w.a4, 0.7);
  const p = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:200, pressure:10, K:0.1, lambda:3 });
  ok('alpha5 = 1 - 0.04p floors at 0.7', p.a5, 0.7, 1e-12);
  ok('alpha3 = 1 - K lambda floors at 0.7', p.a3, 0.7, 1e-12);
  ok('a2 a3 a5 held at 0.7', p.a235, 0.7, 1e-12);
  ok('floor flagged', p.floorHit, true);
  ok('lb,min = max(0.3 lb, 10 phi, 100)', a.lbmin, Math.max(0.3 * lb, 200, 100), 1e-9);
  const c = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:20, tension:false });
  ok('compression lb,min = max(0.6 lb, 10 phi, 100)', c.lbmin, 0.6 * lb, 1e-9);
  const half = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:20, stress:0.5 });
  ok('half the stress halves lb,rqd', half.lbrqd, lb / 2, 1e-9);
  ok('poor bond lb,rqd = lb / 0.7', E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'poor', shape:'straight', cd:20 }).lbrqd, lb / 0.7, 1e-9);
}

console.log('\n=== Laps, EC2 8.7.3 ===');
{
  const fbd = 2.25 * 0.7 * 0.3 * Math.pow(30, 2 / 3) / 1.5;
  const lb = 20 / 4 * (500 / 1.15) / fbd;
  const a = E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', shape:'straight', cd:40, lapped:50 });
  ok('alpha6 = sqrt(50/25)', a.a6, Math.SQRT2, 1e-12);
  ok('l0 = a2 a6 lb,rqd', a.l0, 0.85 * Math.SQRT2 * lb, 1e-9);
  ok('alpha6 = 1.15 at 33 per cent', E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', cd:20, lapped:33 }).a6, Math.sqrt(33 / 25), 1e-12);
  ok('alpha6 = 1 below 25 per cent', E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', cd:20, lapped:20 }).a6, 1);
  ok('alpha6 capped at 1.5', E.anchor({ code:'ec2', fck:30, fyk:500, phi:20, bond:'good', cd:20, lapped:100 }).a6, 1.5);
  ok('l0,min = max(0.3 a6 lb, 15 phi, 200)', a.l0min, Math.max(0.3 * Math.SQRT2 * lb, 300, 200), 1e-9);
}

console.log('\n=== BS 8110 anchorage ===');
{
  const a = E.anchor({ code:'bs', fck:30, fyk:500, phi:20, bond:'good', cd:60 });
  // fbu = 0.5 sqrt 35 = 2.958, l = 20 x 0.87 x 500 / (4 x 2.958) = 735 mm
  ok('fbu = 0.5 sqrt fcu', a.fbu, 0.5 * Math.sqrt(35), 1e-12);
  ok('l = phi fs / 4 fbu', a.lbd, 20 * 435 / (4 * 0.5 * Math.sqrt(35)), 1e-9);
  ok('about 37 phi', a.mult, 36.8, 0.1);
  ok('plain lap factor 1', a.lapF, 1);
  ok('top bar lap factor 1.4', E.anchor({ code:'bs', fck:30, fyk:500, phi:20, bond:'poor', cd:60 }).lapF, 1.4);
  ok('top bar with thin cover 2.0', E.anchor({ code:'bs', fck:30, fyk:500, phi:20, bond:'poor', cd:30 }).lapF, 2.0);
  ok('compression beta 0.63', E.anchor({ code:'bs', fck:30, fyk:500, phi:20, bond:'good', cd:60, tension:false }).beta, 0.63);
}

console.log('\n=== Cover, EC2 4.4 ===');
{
  ok('S4 for XC3 C30 50 years', E.structuralClass('XC3', 30, false, false), 4);
  ok('one class down at C35 for XC3', E.structuralClass('XC3', 35, false, false), 3);
  ok('two classes up for 100 years', E.structuralClass('XC3', 30, true, false), 6);
  ok('slab geometry one down', E.structuralClass('XC3', 30, false, true), 3);
  ok('never below S1', E.structuralClass('X0', 50, false, true), 2);
  const c = E.cover({ code:'ec2', member:'beam', exposure:'XC3', fck:30, life100:false, phi:20, phiLink:10, R:60, b:300 });
  ok('cmin,dur = 25 at S4 XC3', c.cdur, 25);
  ok('cmin,b = max(link, phi - link)', c.cminb, 10);
  ok('fire a = 25 at R60, b 300', c.a, 25);
  ok('fire cover = a - phi/2 - link = 5', c.cfire, 5);
  ok('cnom = 25 + 10 = 35', c.cnom, 35);
  ok('durability governs', c.gov, 'dur');
  const xs = E.cover({ code:'ec2', member:'beam', exposure:'XS3', fck:30, life100:false, phi:20, phiLink:10, R:60, b:300 });
  ok('XS3 at S4 is 45, so 55 nominal', xs.cnom, 55);
  const fire = E.cover({ code:'ec2', member:'beam', exposure:'XC1', fck:30, life100:false, phi:20, phiLink:10, R:180, b:240 });
  ok('R180 b 240 needs a = 80', fire.a, 80);
  ok('fire cover 80 - 10 - 10 = 60 governs', fire.cnom, 60);
  ok('fire governs', fire.gov, 'fire');
  ok('beam axis interpolated at b 250, R60', E.fireAxis('beam', 60, 250).a, 30 + 50 / 100 * -5, 1e-12);
  ok('too narrow for R90 flagged', E.fireAxis('beam', 90, 120).ok, false);
  ok('slab R90 a = 30', E.fireAxis('slab', 90, 0).a, 30);
  const sl = E.cover({ code:'ec2', member:'slab', exposure:'XC1', fck:30, life100:false, phi:12, phiLink:0, R:60, b:1000 });
  ok('slab XC1 C30 S2: 10, bond 12, so 22', sl.cnom, 22);
}

console.log('\n=== Cover, BS 8110 Tables 3.3 and 3.4 ===');
{
  const c = E.cover({ code:'bs', member:'beam', exposure:'XC3', fck:30, phi:20, phiLink:10, R:60, b:300 });
  ok('moderate at C35 is 35', c.cnom, 35);
  ok('condition moderate', c.cond, 'moderate');
  const f = E.cover({ code:'bs', member:'beam', exposure:'XC1', fck:30, phi:20, phiLink:10, R:180, b:300 });
  ok('3 h beam needs 60', f.cnom, 60);
  const n = E.cover({ code:'bs', member:'beam', exposure:'XD3', fck:30, phi:20, phiLink:10, R:60, b:300 });
  ok('most severe not allowed at C35', n.allowed, false);
}

console.log('\n=== Spacing, EC2 8.2 ===');
{
  const s = E.spacing({ code:'ec2', member:'beam', b:300, cover:35, phiLink:10, phi:20, n:4, dg:20 });
  // inside 300 - 70 - 20 = 210, gaps (210 - 80)/3 = 43.3
  ok('inside width', s.inside, 210);
  ok('clear gap', s.clear, 130 / 3, 1e-12);
  ok('need max(phi, dg + 5, 20) = 25', s.need, 25);
  ok('fits', s.ok, true);
  ok('max bars (210 + 25)/(20 + 25) = 5', s.nMax, 5);
  ok('six do not fit', E.spacing({ code:'ec2', member:'beam', b:300, cover:35, phiLink:10, phi:20, n:6, dg:20 }).ok, false);
  ok('slab clear = s - phi', E.spacing({ code:'ec2', member:'slab', s:150, phi:12, dg:20 }).clear, 138);
  ok('BS has no 20 mm floor', E.spacing({ code:'bs', member:'beam', b:300, cover:35, phiLink:10, phi:10, n:2, dg:10 }).need, 15);
}

console.log('\n=== Solve ties cd to the section ===');
{
  const r = E.solve({ code:'ec2', member:'beam', b:300, n:3, phi:20, phiLink:10, cover:35, dg:20, fck:30, fyk:500,
                      bond:'good', shape:'straight', exposure:'XC3', R:60, life100:false, lapped:50 });
  // clear (210 - 60)/2 = 75, half 37.5, cover to bar 45, so cd = 37.5
  ok('cd = min(a/2, c)', r.cd, 37.5, 1e-12);
  ok('alpha2 from that cd', r.an.a2, 1 - 0.15 * 17.5 / 20, 1e-12);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
