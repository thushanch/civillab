/* Engine tests for TimberEngine, hand values from EN 1995-1-1, EN 338 and BS 5268-2 */
const E = require('../assets/js/timber-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const base = { code:'ec5', cls:'C24', b:47, h:200, L:3.6, wk:1.5, Nk:0, gF:1.4, duration:'medium', service:1,
               ksys:false, kLe:1, lb:50, kc90:1, lateral:'joists' };

console.log('=== Factors ===');
ok('kmod medium, class 1', E.KMOD[1].medium, 0.8);
ok('kmod permanent, class 3', E.KMOD[3].permanent, 0.5);
ok('kh = 1 at 150 and above', E.kh(200), 1);
ok('kh = (150/100)^0.2 at 100', E.kh(100), Math.pow(1.5, 0.2), 1e-12);
ok('kh capped at 1.3', E.kh(20), 1.3);
ok('kcrit = 1 up to 0.75', E.kcrit(0.7), 1);
ok('kcrit = 1.56 - 0.75 lambda', E.kcrit(1), 0.81, 1e-12);
ok('kcrit = 1/lambda^2 above 1.4', E.kcrit(2), 0.25, 1e-12);
ok('kc = 1 at lambda_rel 0.3', E.kc(0.3), 1, 1e-12);

console.log('\n=== EC5 joist, C24 47 x 200, L 3.6 m, 1.5 kN/m ===');
{
  const r = E.solve(base);
  ok('fm,d = 0.8 x 24 / 1.3', r.fmd, 0.8 * 24 / 1.3, 1e-12);
  ok('fm,d = 14.77', r.fmd, 14.77, 0.01);
  ok('M = 1.4 x 1.5 x 3.6^2 / 8', r.a.M, 1.4 * 1.5 * 12.96 / 8, 1e-12);
  ok('sigma_m = M / W', r.sm, r.a.M * 1e6 / (47 * 200 * 200 / 6), 1e-12);
  const lef = 0.9 * 3600 + 400;
  ok('l_ef = 0.9L + 2h', r.lef, lef, 1e-9);
  const scrit = 0.78 * 47 * 47 * 7400 / (200 * lef);
  ok('sigma_m,crit = 0.78 b^2 E05 / (h lef)', r.scrit, scrit, 1e-9);
  ok('k_crit from lambda_rel,m', r.kcr, E.kcrit(Math.sqrt(24 / scrit)), 1e-12);
  ok('shear tau = 1.5 V / (0.67 b h)', r.tau, 1.5 * 1.4 * 1.5 * 1.8 * 1e3 / (0.67 * 47 * 200), 1e-12);
  ok('fv,d = 0.8 x 4.0 / 1.3', r.fvd, 3.2 / 1.3, 1e-12);
  ok('bearing length 50 + 30 + 30', r.lb, 110);
  ok('fc,90,d = 0.8 x 2.5 / 1.3', r.fc90d, 2 / 1.3, 1e-12);
  const sys = E.solve(Object.assign({}, base, { ksys:true }));
  ok('load sharing ksys 1.1 on bending only', sys.fmd / r.fmd, 1.1, 1e-12);
  ok('and not on shear', sys.fvd, r.fvd);
  const wet = E.solve(Object.assign({}, base, { service:3 }));
  ok('service class 3 kmod 0.65', wet.km, 0.65);
  const shallow = E.solve(Object.assign({}, base, { h:100 }));
  ok('kh raises fm,d for a shallow section', shallow.fmd, 0.8 * Math.pow(1.5, 0.2) * 24 / 1.3, 1e-12);
}

console.log('\n=== EC5 post, C24 100 x 100, 3 m, buckling ===');
{
  const r = E.solve(Object.assign({}, base, { b:100, h:100, L:3, wk:0, Nk:20 }));
  const lam = 3000 / (100 / Math.sqrt(12));
  const lr = lam / Math.PI * Math.sqrt(21 / 7400);
  ok('lambda = lef / i', r.lamz, lam, 1e-9);
  ok('lambda_rel = (lambda/pi) sqrt(fc0k/E05)', r.lrz, lr, 1e-12);
  ok('lambda_rel about 1.762', r.lrz, 1.762, 0.001);
  const k = 0.5 * (1 + 0.2 * (lr - 0.3) + lr * lr);
  ok('kc', r.kcz, 1 / (k + Math.sqrt(k * k - lr * lr)), 1e-12);
  ok('kc about 0.285', r.kcz, 0.285, 0.001);
  ok('column check sigma / (kc fc0d)', r.u.column, 1.4 * 20e3 / 1e4 / (r.kcz * 0.8 * 21 / 1.3), 1e-12);
  const bc = E.solve(Object.assign({}, base, { b:100, h:100, L:3, wk:0.5, Nk:20 }));
  ok('6.23 with a moment', bc.u.comp, Math.max(bc.sc / (bc.kcy * bc.fc0d) + bc.sm / bc.fmd, bc.sc / (bc.kcz * bc.fc0d) + 0.7 * bc.sm / bc.fmd), 1e-12);
  const t = E.solve(Object.assign({}, base, { b:100, h:100, L:3, wk:0, Nk:-20 }));
  ok('tension check sigma_t / ft,0,d', t.u.tension, 1.4 * 20e3 / 1e4 / (0.8 * E.kh(100) * 14 / 1.3), 1e-12);
}

console.log('\n=== BS 5268-2 ===');
{
  const r = E.solve(Object.assign({}, base, { code:'bs' }));
  ok('K7 = (300/h)^0.11', r.k7, Math.pow(1.5, 0.11), 1e-12);
  ok('K3 medium term 1.25', r.k3, 1.25);
  ok('permissible bending 7.5 K3 K7', r.smAdm, 7.5 * 1.25 * Math.pow(1.5, 0.11), 1e-12);
  ok('working load M unfactored', r.a.M, 1.5 * 12.96 / 8, 1e-12);
  ok('shear 1.5 V / bh', r.tau, 1.5 * 1.5 * 1.8e3 / (47 * 200), 1e-12);
  ok('Table 19 ratio h/b against 5 for joists', r.u.ltb, (200 / 47) / 5, 1e-12);
  const wet = E.solve(Object.assign({}, base, { code:'bs', service:3 }));
  ok('wet exposure K2 0.8 on bending', wet.smAdm / r.smAdm, 0.8, 1e-12);
  const kk = E.k12(9.875, 7200, 103.92);
  const se = Math.PI ** 2 * 7200 / 103.92 ** 2, a = 0.5 + 1.5196 * se / 19.75;
  ok('K12 from Annex B', kk.K12, a - Math.sqrt(a * a - se / 9.875), 1e-9);
  ok('K12 about 0.417', kk.K12, 0.417, 0.002);
  ok('K12 = 1 for a stocky post', E.k12(9.875, 7200, 5).K12 > 0.95, true);
}

console.log('\n=== Comparisons ===');
{
  const a = E.solve(base), b = E.solve(Object.assign({}, base, { cls:'C16' }));
  ok('C16 weaker than C24', b.fmd < a.fmd, true);
  ok('D40 bearing far stronger', E.solve(Object.assign({}, base, { cls:'D40' })).fc90d > 3 * a.fc90d, true);
  ok('short term stronger than permanent', E.solve(Object.assign({}, base, { duration:'short' })).fmd > E.solve(Object.assign({}, base, { duration:'permanent' })).fmd, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
