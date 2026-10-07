/* Engine tests for RCBeamEngine — EC2 and BS 8110 RC beam design
   All expected values are hand computed from EN 1992-1-1 and BS 8110 */
var RCB = require('../assets/js/rc-beam-engine.js');

var pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  if (tol == null) tol = 0;
  if (typeof got === 'boolean' || typeof exp === 'boolean') {
    if (got === exp) { pass++; console.log('  ok   ' + name + ' = ' + got); }
    else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp); }
    return;
  }
  var g = typeof got === 'number' ? got : parseFloat(got);
  if (Math.abs(g - exp) <= tol) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + ' +/- ' + tol); }
}

console.log('=== Material properties ===');
{
  var m = RCB.matProps(30, 500);
  // fcd = 0.85 * 30 / 1.5 = 17.0
  ok('fcd C30', m.fcd, 17.0, 0.01);
  // fyd = 500 / 1.15 = 434.78
  ok('fyd 500', m.fyd, 434.78, 0.01);
  ok('fcu C30', m.fcu, 35, 0.1);
  ok('Es', m.Es, 200000);
  ok('ecu', m.ecu, 0.0035);
}

console.log('\n=== Partial factors ===');
ok('alpha_cc', RCB.ACC, 0.85);
ok('gamma_c', RCB.GC, 1.5);
ok('gamma_s', RCB.GS, 1.15);

console.log('\n=== Flexure: singly reinforced, C30, 300x500, d=450, M=150 kNm ===');
{
  var r = RCB.flexure({ b:300, h:500, d:450, fck:30, fyk:500, MEd:150 });
  // K = 150e6 / (300 * 450^2 * 30) = 150e6 / 1.8225e9 = 0.08230
  ok('K singly', r.K, 0.0823, 0.001);
  ok('K < Kp', r.doubly, false);
  // z = 450 * [0.5 + sqrt(0.25 - 0.0823/1.134)]
  //   = 450 * [0.5 + sqrt(0.25 - 0.0726)]
  //   = 450 * [0.5 + sqrt(0.1774)]
  //   = 450 * [0.5 + 0.4212]
  //   = 450 * 0.9212 = 414.5
  ok('z singly', r.z, 414.5, 2);
  // As = 150e6 / (434.78 * 414.5) = 150e6 / 180227 = 832
  ok('As singly', r.AsReq, 832, 15);
  ok('lambda', r.lam, 0.8);
  ok('eta', r.eta, 1.0);
  ok('steel yields', r.steelYields, true);
}

console.log('\n=== Flexure: doubly reinforced, C30, 250x400, d=350, M=200 kNm ===');
{
  var r = RCB.flexure({ b:250, h:400, d:350, d2:50, fck:30, fyk:500, MEd:200 });
  // K = 200e6 / (250 * 350^2 * 30) = 200e6 / 918750000 = 0.2177
  ok('K doubly', r.K, 0.2177, 0.001);
  ok('K > Kp', r.doubly, true);
  // z from Kp: z = 350 * [0.5 + sqrt(0.25 - 0.167/1.134)]
  //           = 350 * [0.5 + sqrt(0.25 - 0.1473)]
  //           = 350 * [0.5 + sqrt(0.1027)]
  //           = 350 * [0.5 + 0.3204]
  //           = 350 * 0.8204 = 287.1
  ok('z doubly', r.z, 287, 3);
  ok('As2 > 0', r.As2Req > 0, true);
  ok('As1 > As singly', r.AsReq > r.As2Req, true);
}

console.log('\n=== Flexure: minimum steel check ===');
{
  var r = RCB.flexure({ b:300, h:500, d:450, fck:30, fyk:500, MEd:10 });
  // AsMin = max(0.26 * sqrt(30)/500 * 300 * 450, 0.0013 * 300 * 450)
  //       = max(0.26 * 5.477 / 500 * 135000, 175.5)
  //       = max(385.5, 175.5) = 385.5
  ok('AsMin EC2', r.AsMin, 385.5, 5);
  ok('AsMax = 0.04bh', r.AsMax, 0.04 * 300 * 500, 0.01);
}

console.log('\n=== Shear: C30, bw=300, d=450, VEd=200 kN, theta=21.8 ===');
{
  var r = RCB.shear({ bw:300, d:450, fck:30, fyk:500, VEd:200, As1:900, theta:21.8 });
  // k = min(1 + sqrt(200/450), 2) = min(1.667, 2) = 1.667
  ok('k shear', r.k, 1.667, 0.01);
  // rhoL = 900 / (300*450) = 0.00667
  ok('rhoL', r.rhoL, 0.00667, 0.0001);
  // VRdc: CRdc = 0.18/1.5 = 0.12
  //   0.12 * 1.667 * (100 * 0.00667 * 30)^(1/3) * 300 * 450 / 1000
  //   = 0.12 * 1.667 * (20)^0.333 * 135000 / 1000
  //   = 0.12 * 1.667 * 2.714 * 135 = 73.3
  ok('VRdc', r.VRdc, 73.3, 3);
  // nu1 = 0.6 * (1 - 30/250) = 0.6 * 0.88 = 0.528
  ok('nu1', r.nu1, 0.528, 0.001);
  // z = 0.9 * 450 = 405
  ok('z shear', r.z, 405, 0.1);
  // VRdmax at 21.8: cot = 2.5, tan = 0.4
  //   1.0 * 300 * 405 * 0.528 * 17.0 / (2.5 + 0.4) / 1000
  //   = 121500 * 0.528 * 17.0 / 2.9 / 1000
  //   = 121500 * 8.976 / 2.9 / 1000
  //   = 376.2
  ok('VRdmax at 21.8', r.VRdmax, 376, 5);
  ok('adequate', r.adequate, true);
  ok('needs links', r.needsLinks, true);
}

console.log('\n=== Shear: VRdmax increases with theta ===');
{
  var r1 = RCB.shear({ bw:300, d:450, fck:30, fyk:500, VEd:200, As1:900, theta:21.8 });
  var r2 = RCB.shear({ bw:300, d:450, fck:30, fyk:500, VEd:200, As1:900, theta:45 });
  // At 45: cot=1, tan=1, VRdmax = bw*z*nu1*fcd / 2
  ok('VRdmax higher at 45', r2.VRdmax > r1.VRdmax, true);
  // But AswReq is lower at 21.8 (larger cotTheta)
  ok('Asw lower at 21.8', r1.AswReq < r2.AswReq, true);
}

console.log('\n=== Shear: VRdmax at 45 degrees ===');
{
  var r = RCB.shear({ bw:300, d:450, fck:30, fyk:500, VEd:200, As1:900, theta:45 });
  // VRdmax = 300 * 405 * 0.528 * 17.0 / (1 + 1) / 1000
  //        = 121500 * 8.976 / 2 / 1000 = 545.3
  ok('VRdmax at 45', r.VRdmax, 545, 5);
}

console.log('\n=== Deflection: simply supported, C30, L=6m ===');
{
  var r = RCB.deflection({ b:300, d:450, h:500, L:6, fck:30, fyk:500, As1:900, type:'ss' });
  // rho = 900 / (300*450) = 0.00667
  // rho0 = sqrt(30)/1000 = 0.005477
  ok('rho', r.rho, 0.00667, 0.0001);
  ok('rho0', r.rho0, 0.005477, 0.0001);
  // Since rho > rho0, use the second formula
  // basic = 11 + 1.5*sqrt(30)*0.005477/(0.00667-0) + ...
  ok('basic > 11', r.basic > 11, true);
  ok('Kb = 1.0 for ss', r.Kb, 1.0);
  ok('actual = L*1000/d', r.actual, 6000/450, 0.01);
  ok('util defined', r.util > 0, true);
}

console.log('\n=== Deflection: cantilever has lower Kb ===');
{
  var r = RCB.deflection({ b:300, d:450, h:500, L:3, fck:30, fyk:500, As1:900, type:'cant' });
  ok('Kb = 0.4 for cant', r.Kb, 0.4);
  ok('actual = 3000/450', r.actual, 3000/450, 0.01);
}

console.log('\n=== Cracking: C30, 300x500, d=450, M=150 ===');
{
  var r = RCB.cracking({ b:300, d:450, h:500, cover:30, phi:16, fck:30, fyk:500, As1:900, MEd:150 });
  ok('srMax > 0', r.srMax > 0, true);
  ok('wk > 0', r.wk > 0, true);
  ok('wk is reasonable', r.wk < 1, true);
  ok('sigS > 0', r.sigS > 0, true);
  // sigS = 150e6 / (900 * 0.9*450) = 150e6 / 364500 = 411.5
  ok('sigS value', r.sigS, 411.5, 5);
  ok('sMax defined', r.sMax > 0, true);
}

console.log('\n=== Cracking: higher steel stress gives wider crack ===');
{
  var r1 = RCB.cracking({ b:300, d:450, h:500, cover:30, phi:16, fck:30, fyk:500, As1:1200, MEd:150 });
  var r2 = RCB.cracking({ b:300, d:450, h:500, cover:30, phi:16, fck:30, fyk:500, As1:900, MEd:150 });
  ok('more As gives lower wk', r1.wk < r2.wk, true);
}

console.log('\n=== BS 8110 flexure: C30 (fcu=35), 300x500, d=450, M=150 ===');
{
  var r = RCB.bsFlexure({ b:300, d:450, fcu:35, fyk:500, MEd:150 });
  // K = 150e6 / (300 * 450^2 * 35) = 150e6 / 2126250000 = 0.0706
  ok('BS K', r.K, 0.0706, 0.001);
  ok('BS not doubly', r.doubly, false);
  // z = 450 * [0.5 + sqrt(0.25 - 0.0706/0.9)]
  //   = 450 * [0.5 + sqrt(0.25 - 0.0784)]
  //   = 450 * [0.5 + sqrt(0.1716)]
  //   = 450 * [0.5 + 0.414] = 450 * 0.914 = 411.5
  ok('BS z', r.z, 411.5, 3);
  // As = 150e6 / (0.87 * 500 * 411.5) = 150e6 / 179003 = 838
  ok('BS As', r.As, 838, 15);
}

console.log('\n=== BS 8110 shear ===');
{
  var r = RCB.bsShear({ bw:300, d:450, fck:30, fyk:500, VEd:200, As1:900 });
  // v = 200*1000 / (300*450) = 1.481
  ok('BS v', r.v, 1.481, 0.01);
  ok('BS vc > 0', r.vc > 0, true);
  ok('BS vmax', r.vmax, Math.min(0.8 * Math.sqrt(35), 5), 0.01);
}

console.log('\n=== Proportionality: doubling MEd doubles K ===');
{
  var r1 = RCB.flexure({ b:300, h:500, d:450, fck:30, fyk:500, MEd:100 });
  var r2 = RCB.flexure({ b:300, h:500, d:450, fck:30, fyk:500, MEd:200 });
  ok('K proportional', r2.K / r1.K, 2.0, 0.001);
}

console.log('\n=== EC2 vs BS comparison ===');
{
  var ec = RCB.flexure({ b:300, h:500, d:450, fck:30, fyk:500, MEd:150 });
  var bs = RCB.bsFlexure({ b:300, d:450, fcu:35, fyk:500, MEd:150 });
  ok('EC2 K > BS K (fck < fcu)', ec.K > bs.K, true);
  ok('both give similar As', Math.abs(ec.AsReq - bs.As) / ec.AsReq < 0.1, true);
}

console.log('\n=== Zero moment gives zero As ===');
{
  var r = RCB.flexure({ b:300, h:500, d:450, fck:30, fyk:500, MEd:0 });
  ok('K = 0', r.K, 0, 0.001);
  ok('As = 0', r.AsReq, 0, 0.1);
}

console.log('\n=== Higher fck gives lower K for same moment ===');
{
  var r1 = RCB.flexure({ b:300, h:500, d:450, fck:25, fyk:500, MEd:150 });
  var r2 = RCB.flexure({ b:300, h:500, d:450, fck:40, fyk:500, MEd:150 });
  ok('higher fck lower K', r2.K < r1.K, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
