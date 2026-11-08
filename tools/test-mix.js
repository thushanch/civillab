/* Engine tests for MixEngine against the ACI 211.1 tables and the classic
   absolute volume worked example (24 MPa, 75 to 100 mm slump, 37.5 mm stone) */
const E = require('../assets/js/mix-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Target mean strength ===');
ok('EN margin 1.64 s', E.target('en', 30, 5).fm, 38.2, 1e-12);
ok('ACI 1.34s governs at s 3', E.target('aci', 30, 3).fm, 34.02, 1e-12);
ok('ACI 2.33s - 3.45 governs at s 5', E.target('aci', 30, 5).fm, 30 + 11.65 - 3.45, 1e-12);
ok('ACI above 35 uses 0.90 fc + 2.33 s', E.target('aci', 40, 5).fm, Math.max(46.7, 36 + 11.65), 1e-12);

console.log('\n=== Table 6.3.4a, w/c ===');
ok('30 MPa gives 0.54', E.wcFor(30).wc, 0.54, 1e-12);
ok('40 MPa gives 0.42', E.wcFor(40).wc, 0.42, 1e-12);
ok('24 MPa interpolates to 0.626', E.wcFor(24).wc, 0.626, 1e-12);
ok('beyond 40 flagged', E.wcFor(44).outside, true);
ok('inverse: 0.54 gives 30 MPa', E.strengthFor(0.54), 30, 1e-9);
ok('inverse round trip at 27 MPa', E.strengthFor(E.wcFor(27).wc), 27, 1e-9);
ok('strength falls as w/c rises', E.strengthFor(0.6) < E.strengthFor(0.5), true);

console.log('\n=== Tables 6.3.3 and 6.3.6 ===');
ok('water 181 at 75-100 and 37.5', E.water('75-100', 37.5).W, 181);
ok('air 1% at 37.5', E.water('75-100', 37.5).air, 1);
ok('water 216 at 150-175 and 19', E.water('150-175', 19).W, 216);
ok('more slump, more water', E.water('150-175', 25).W > E.water('25-50', 25).W, true);
ok('bigger stone, less water', E.water('75-100', 50).W < E.water('75-100', 9.5).W, true);
ok('coarse volume 0.71 at 37.5 and FM 2.8', E.coarseVol(37.5, 2.8), 0.71, 1e-12);
ok('coarse volume 0.63 at 19 and FM 2.7', E.coarseVol(19, 2.7), 0.63, 1e-12);
ok('finer sand takes more stone', E.coarseVol(25, 2.4) > E.coarseVol(25, 3.0), true);

console.log('\n=== Worked example, absolute volume ===');
{
  const r = E.solve({ method:'en', fck:24, sd:0, slump:'75-100', dmax:37.5, FM:2.8, druw:1600,
                      sgCA:2.68, sgFA:2.64, wcMax:0.7, cMin:0, manual:false });
  ok('fm = fck when s = 0', r.t.fm, 24);
  ok('w/c 0.626', r.wc, 0.626, 1e-12);
  ok('cement = 181 / 0.626 = 289', r.C, 181 / 0.626, 1e-9);
  ok('coarse = 0.71 x 1600 = 1136', r.CA, 1136, 1e-9);
  const vf = 1 - 0.181 - r.C / 3150 - 1136 / 2680 - 0.01;
  ok('fine volume is what is left', r.vol.fine, vf, 1e-12);
  ok('fine mass = 775 kg', r.FA, vf * 2640, 1e-9);
  ok('fine mass about 775', r.FA, 775, 1);
  ok('volumes sum to one', r.vol.water + r.vol.cement + r.vol.coarse + r.vol.air + r.vol.fine, 1, 1e-12);
  ok('density = sum of masses', r.density, 181 + r.C + 1136 + r.FA, 1e-9);
  ok('strength governs', r.governedBy, 'strength');
  ok('strength check exactly at the limit', r.strengthUtil, 1, 1e-9);
}

console.log('\n=== Durability limits ===');
{
  const base = { method:'en', fck:20, sd:4, slump:'75-100', dmax:19, FM:2.6, druw:1600,
                 sgCA:2.65, sgFA:2.62, manual:false };
  const r = E.solve(Object.assign({}, base, { wcMax:0.55, cMin:0 }));
  // fm = 26.56, w/c from strength 0.588, durability 0.55 governs
  ok('durability w/c governs', r.governedBy, 'durability');
  ok('w/c = 0.55', r.wc, 0.55);
  ok('then strength has spare', r.strengthUtil < 1, true);
  const m = E.solve(Object.assign({}, base, { wcMax:0.7, cMin:400 }));
  ok('minimum cement raises C', m.C, 400);
  ok('and lowers the effective w/c', m.wcEff, 205 / 400, 1e-12);
  ok('cement raised flagged', m.cementRaised, true);
  const h = E.solve(Object.assign({}, base, { wcMax:0.55, cMin:0, manual:true, wcUser:0.65 }));
  ok('hand w/c used', h.wc, 0.65);
  ok('hand w/c fails strength', h.strengthUtil > 1, true);
  ok('hand w/c fails durability', h.durUtil > 1, true);
}

console.log('\n=== Moisture correction ===');
{
  const r = E.solve({ method:'en', fck:24, sd:0, slump:'75-100', dmax:37.5, FM:2.8, druw:1600,
                      sgCA:2.68, sgFA:2.64, wcMax:0.7, cMin:0, manual:false,
                      mcCA:0.02, abCA:0.005, mcFA:0.06, abFA:0.007 });
  ok('wet coarse weighs more', r.field.coarse, 1136 * 1.02, 1e-9);
  ok('wet sand weighs more', r.field.fine, r.FA * 1.06, 1e-9);
  ok('batch water reduced by free moisture', r.field.water, 181 - 1136 * 0.015 - r.FA * 0.053, 1e-9);
  ok('total batch mass unchanged', r.field.water + r.field.coarse + r.field.fine + r.field.cement,
     181 + r.C + 1136 + r.FA + 1136 * 0.005 + r.FA * 0.007, 1e-9);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
