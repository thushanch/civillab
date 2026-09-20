/* Engine tests for ActionsEngine — EN 1990 load combinations
   All expected values are hand computed from EN 1990 Table A1.2(B)
   with UK NA xi = 0.925 */
var AE = require('../assets/js/actions-engine.js');

var pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  if (tol == null) tol = 0;
  if (typeof got === 'boolean' || typeof exp === 'boolean') {
    var good = got === exp;
    if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
    else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp); }
    return;
  }
  if (typeof got === 'string' && typeof exp === 'string') {
    if (got === exp) { pass++; console.log('  ok   ' + name + ' = ' + got); }
    else { fail++; console.log('  FAIL ' + name + ' got "' + got + '" expected "' + exp + '"'); }
    return;
  }
  var g = typeof got === 'number' ? got : parseFloat(got);
  if (Math.abs(g - exp) <= tol) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + ' +/- ' + tol); }
}

console.log('=== Partial factors ===');
ok('gamma_G', AE.GG, 1.35);
ok('gamma_Q', AE.GQ, 1.5);
ok('xi (UK NA)', AE.XI, 0.925);
ok('gamma_G,inf', AE.GG_FAV, 1.0);

console.log('\n=== Psi factors table (EN 1991-1-1 Table A1.1, UK NA) ===');
ok('Cat A psi0', AE.PSI.A.psi0, 0.7);
ok('Cat A psi1', AE.PSI.A.psi1, 0.5);
ok('Cat A psi2', AE.PSI.A.psi2, 0.3);
ok('Cat E psi0', AE.PSI.E.psi0, 1.0);
ok('Cat E psi1', AE.PSI.E.psi1, 0.9);
ok('Cat E psi2', AE.PSI.E.psi2, 0.8);
ok('Wind psi0', AE.PSI.wind.psi0, 0.5);
ok('Wind psi1', AE.PSI.wind.psi1, 0.2);
ok('Wind psi2', AE.PSI.wind.psi2, 0.0);
ok('Snow psi0', AE.PSI.snow.psi0, 0.5);
ok('Cat H psi0', AE.PSI.H.psi0, 0.7);
ok('Cat H psi1', AE.PSI.H.psi1, 0.0);
ok('Cat H psi2', AE.PSI.H.psi2, 0.0);

console.log('\n=== Simple case: Gk=10, Qk=5, Cat A, no wind/snow ===');
{
  var r = AE.solve({ Gk:10, Qk1:5, cat1:'A', Qk2:0, cat2:'wind', Qk3:0, cat3:'snow' });

  // Eq 6.10: 1.35*10 + 1.5*5 = 13.5 + 7.5 = 21.0
  ok('6.10 total', r.uls.eq610.total, 21.0, 0.01);

  // Eq 6.10a: 1.35*10 + 1.5*0.7*5 = 13.5 + 5.25 = 18.75
  ok('6.10a total', r.uls.eq610a.total, 18.75, 0.01);

  // Eq 6.10b: 0.925*1.35*10 + 1.5*5 = 12.4875 + 7.5 = 19.9875
  ok('6.10b total', r.uls.eq610b.total, 19.9875, 0.01);

  // 6.10 governs (largest of the three)
  ok('6.10 > 6.10a', r.uls.eq610.total > r.uls.eq610a.total, true);
  ok('6.10 > 6.10b', r.uls.eq610.total > r.uls.eq610b.total, true);

  // SLS char: 10 + 5 = 15
  ok('SLS char total', r.sls.char.total, 15.0, 0.01);

  // SLS frequent: 10 + 0.5*5 = 12.5
  ok('SLS freq total', r.sls.freq.total, 12.5, 0.01);

  // SLS quasi-permanent: 10 + 0.3*5 = 11.5
  ok('SLS qp total', r.sls.qp.total, 11.5, 0.01);

  // BS: 1.4*10 + 1.6*5 = 14 + 8 = 22
  ok('BS ULS grav', r.bs.ulsGrav.total, 22.0, 0.01);

  // BS SLS: 1.0*10 + 1.0*5 = 15
  ok('BS SLS', r.bs.sls.total, 15.0, 0.01);
}

console.log('\n=== With wind: Gk=25, Qk=10 Cat B, Wk=8 ===');
{
  var r = AE.solve({ Gk:25, Qk1:10, cat1:'B', Qk2:8, cat2:'wind', Qk3:0, cat3:'snow' });

  // Eq 6.10: 1.35*25 + 1.5*10 + 1.5*0.5*8 = 33.75 + 15 + 6 = 54.75
  ok('6.10 with wind', r.uls.eq610.total, 54.75, 0.01);

  // Eq 6.10a: 1.35*25 + 1.5*0.7*10 + 1.5*0.5*8 = 33.75 + 10.5 + 6 = 50.25
  ok('6.10a with wind', r.uls.eq610a.total, 50.25, 0.01);

  // Eq 6.10b: 0.925*1.35*25 + 1.5*10 + 1.5*0.5*8 = 31.21875 + 15 + 6 = 52.21875
  ok('6.10b with wind', r.uls.eq610b.total, 52.21875, 0.01);

  // SLS char: 25 + 10 + 0.5*8 = 39
  ok('SLS char wind', r.sls.char.total, 39.0, 0.01);

  // SLS freq: 25 + 0.5*10 + 0.0*8 = 30
  ok('SLS freq wind', r.sls.freq.total, 30.0, 0.01);

  // SLS qp: 25 + 0.3*10 + 0.0*8 = 28
  ok('SLS qp wind', r.sls.qp.total, 28.0, 0.01);

  // BS: 1.4*25 + 1.6*10 = 51
  ok('BS grav', r.bs.ulsGrav.total, 51.0, 0.01);

  // BS wind: 1.0*25 + 1.4*8 = 36.2
  ok('BS wind', r.bs.ulsWind.total, 36.2, 0.01);

  // BS comb: 1.2*(25+10+8) = 51.6
  ok('BS comb', r.bs.ulsComb.total, 51.6, 0.01);
}

console.log('\n=== Storage cat E: psi0 = 1.0 so 6.10a = 6.10 ===');
{
  var r = AE.solve({ Gk:20, Qk1:15, cat1:'E', Qk2:0, cat2:'wind' });

  // Eq 6.10: 1.35*20 + 1.5*15 = 27 + 22.5 = 49.5
  ok('6.10 storage', r.uls.eq610.total, 49.5, 0.01);

  // Eq 6.10a: 1.35*20 + 1.5*1.0*15 = 27 + 22.5 = 49.5  (psi0=1 for E)
  ok('6.10a storage = 6.10', r.uls.eq610a.total, 49.5, 0.01);

  // Eq 6.10b: 0.925*1.35*20 + 1.5*15 = 24.975 + 22.5 = 47.475
  ok('6.10b storage', r.uls.eq610b.total, 47.475, 0.01);

  // SLS frequent: 20 + 0.9*15 = 33.5
  ok('SLS freq storage', r.sls.freq.total, 33.5, 0.01);

  // SLS qp: 20 + 0.8*15 = 32
  ok('SLS qp storage', r.sls.qp.total, 32.0, 0.01);
}

console.log('\n=== Wind + snow combined ===');
{
  var r = AE.solve({ Gk:30, Qk1:12, cat1:'A', Qk2:6, cat2:'wind', Qk3:4, cat3:'snow' });

  // Eq 6.10: 1.35*30 + 1.5*12 + 1.5*0.5*6 + 1.5*0.5*4
  //        = 40.5 + 18 + 4.5 + 3 = 66
  ok('6.10 three actions', r.uls.eq610.total, 66.0, 0.01);

  // Eq 6.10a: 1.35*30 + 1.5*0.7*12 + 1.5*0.5*6 + 1.5*0.5*4
  //         = 40.5 + 12.6 + 4.5 + 3 = 60.6
  ok('6.10a three actions', r.uls.eq610a.total, 60.6, 0.01);

  // Eq 6.10b: 0.925*1.35*30 + 1.5*12 + 1.5*0.5*6 + 1.5*0.5*4
  //         = 37.4625 + 18 + 4.5 + 3 = 62.9625
  ok('6.10b three actions', r.uls.eq610b.total, 62.9625, 0.01);

  // SLS char: 30 + 12 + 0.5*6 + 0.5*4 = 47
  ok('SLS char 3 actions', r.sls.char.total, 47.0, 0.01);

  // SLS freq: 30 + 0.5*12 + 0.0*6 + 0.0*4 = 36
  ok('SLS freq 3 actions', r.sls.freq.total, 36.0, 0.01);

  // SLS qp: 30 + 0.3*12 + 0.0*6 + 0.0*4 = 33.6
  ok('SLS qp 3 actions', r.sls.qp.total, 33.6, 0.01);
}

console.log('\n=== Proportionality checks ===');
{
  var r1 = AE.solve({ Gk:10, Qk1:5, cat1:'A' });
  var r2 = AE.solve({ Gk:20, Qk1:10, cat1:'A' });

  // doubling all loads doubles all results
  ok('6.10 proportional', r2.uls.eq610.total / r1.uls.eq610.total, 2.0, 0.001);
  ok('6.10a proportional', r2.uls.eq610a.total / r1.uls.eq610a.total, 2.0, 0.001);
  ok('6.10b proportional', r2.uls.eq610b.total / r1.uls.eq610b.total, 2.0, 0.001);
  ok('SLS char proportional', r2.sls.char.total / r1.sls.char.total, 2.0, 0.001);
  ok('BS proportional', r2.bs.ulsGrav.total / r1.bs.ulsGrav.total, 2.0, 0.001);
}

console.log('\n=== Zero variable action ===');
{
  var r = AE.solve({ Gk:10, Qk1:0, cat1:'A' });

  // 6.10: 1.35*10 = 13.5
  ok('6.10 no variable', r.uls.eq610.total, 13.5, 0.01);

  // 6.10a = 6.10 when Qk = 0
  ok('6.10a = 6.10 no variable', r.uls.eq610a.total, 13.5, 0.01);

  // 6.10b: 0.925*1.35*10 = 12.4875
  ok('6.10b no variable', r.uls.eq610b.total, 12.4875, 0.01);
}

console.log('\n=== Governing expression logic ===');
{
  // eq 6.10 always >= max(6.10a, 6.10b) since
  // 6.10a reduces Q term and 6.10b reduces G term
  var r = AE.solve({ Gk:10, Qk1:5, cat1:'A' });
  ok('6.10 >= 6.10a', r.uls.eq610.total >= r.uls.eq610a.total, true);
  ok('6.10 >= 6.10b', r.uls.eq610.total >= r.uls.eq610b.total, true);

  // With storage (psi0 = 1), 6.10a = 6.10
  var r2 = AE.solve({ Gk:10, Qk1:5, cat1:'E' });
  ok('6.10a = 6.10 storage', r2.uls.eq610a.total, r2.uls.eq610.total, 0.001);

  // maxAB is always <= 6.10
  ok('maxAB <= 6.10', r.uls.maxAB <= r.uls.eq610.total, true);
}

console.log('\n=== G and Q parts sum to total ===');
{
  var r = AE.solve({ Gk:25, Qk1:10, cat1:'B', Qk2:5, cat2:'wind' });
  var u = r.uls.eq610;
  ok('6.10 parts sum', u.gPart + u.q1Part + u.accomp, u.total, 0.001);

  var ua = r.uls.eq610a;
  ok('6.10a parts sum', ua.gPart + ua.q1Part + ua.accomp, ua.total, 0.001);

  var ub = r.uls.eq610b;
  ok('6.10b parts sum', ub.gPart + ub.q1Part + ub.accomp, ub.total, 0.001);

  var sc = r.sls.char;
  ok('SLS char parts sum', sc.gPart + sc.q1Part + sc.accomp, sc.total, 0.001);

  var sf = r.sls.freq;
  ok('SLS freq parts sum', sf.gPart + sf.q1Part + sf.accomp, sf.total, 0.001);
}

console.log('\n=== SLS ordering: char >= freq >= qp ===');
{
  var r = AE.solve({ Gk:20, Qk1:10, cat1:'A', Qk2:5, cat2:'wind' });
  ok('char >= freq', r.sls.char.total >= r.sls.freq.total, true);
  ok('freq >= qp', r.sls.freq.total >= r.sls.qp.total, true);
}

console.log('\n=== BS vs EC comparison: typical gravity case ===');
{
  var r = AE.solve({ Gk:10, Qk1:5, cat1:'A' });
  // BS: 1.4*10 + 1.6*5 = 22.0
  // EC 6.10: 1.35*10 + 1.5*5 = 21.0
  ok('BS > EC 6.10 for light Q', r.bs.ulsGrav.total > r.uls.eq610.total, true);

  // For heavy Q relative to G, check ratio
  var r2 = AE.solve({ Gk:5, Qk1:15, cat1:'A' });
  // BS: 1.4*5 + 1.6*15 = 7 + 24 = 31
  // EC: 1.35*5 + 1.5*15 = 6.75 + 22.5 = 29.25
  ok('BS heavier for high Q/G ratio', r2.bs.ulsGrav.total, 31.0, 0.01);
  ok('EC lighter for high Q/G ratio', r2.uls.eq610.total, 29.25, 0.01);
}

console.log('\n=== psiFor returns correct object ===');
{
  var p = AE.psiFor('C');
  ok('Cat C name', p.name, 'Congregation');
  ok('Cat C psi0', p.psi0, 0.7);
  ok('Cat C psi1', p.psi1, 0.7);
  ok('Cat C psi2', p.psi2, 0.6);

  var pw = AE.psiFor('wind');
  ok('Wind name', pw.name, 'Wind (EN 1991-1-4)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
