/* Engine tests for MasonryEngine, hand values from EN 1996-1-1 3.6, 5.5,
   6.1, Annex G and BS 5628-1 Annex B, with the yield line limits */
const E = require('../assets/js/masonry-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Characteristic strength, eq 3.1 ===');
ok('fk = 0.55 x 20^0.7 x 10^0.3', E.fk('clay1', 20, 10).fk, 0.55 * Math.pow(20, 0.7) * Math.pow(10, 0.3), 1e-12);
ok('fk about 8.93', E.fk('clay1', 20, 10).fk, 8.93, 0.01);
ok('mortar capped at 2 fb', E.fk('conc1', 3.6, 12).fk, 0.55 * Math.pow(3.6, 0.7) * Math.pow(7.2, 0.3), 1e-12);
ok('group 2 clay K 0.45', E.fk('clay2', 20, 10).K, 0.45);

console.log('\n=== Effective height and thickness ===');
ok('rho2 0.75 with concrete floors', E.hef(2.7, 5, 0.75, 2).hef, 0.75 * 2700, 1e-9);
const h4 = E.hef(2.7, 4, 0.75, 4);
ok('four sided rho4 = rho2/(1 + (rho2 h/L)^2)', h4.rho, 0.75 / (1 + (0.75 * 2.7 / 4) ** 2), 1e-12);
ok('four sided tall wall rho4 = 0.5 L/h', E.hef(5, 3, 1, 4).rho, 0.3, 1e-12);
ok('three sided rho3', E.hef(2.7, 4, 0.75, 3).rho, 0.75 / (1 + (0.75 * 2.7 / 12) ** 2), 1e-12);
ok('cavity tef = cube root of t1^3 + t2^3', E.tef(100, 100, true), Math.cbrt(2e6), 1e-9);
ok('single leaf tef = t', E.tef(215, 0, false), 215);

console.log('\n=== Annex G reduction factor ===');
{
  // hef/tef 20, emk/t 0.1: lambda = 20 / sqrt 1000, A1 0.8, u = (lambda - 0.063)/0.613
  const g = E.phiG(20, 8, 10, 100);
  const lam = 20 / Math.sqrt(1000), u = (lam - 0.063) / (0.73 - 0.117);
  ok('lambda = (hef/tef) sqrt(fk/E), E = 1000 fk', g.lam, lam, 1e-12);
  ok('A1 = 1 - 2 emk/t', g.A1, 0.8, 1e-12);
  ok('u', g.u, u, 1e-12);
  ok('Phi_m = A1 exp(-u^2/2)', g.phim, 0.8 * Math.exp(-u * u / 2), 1e-12);
  ok('Phi_m about 0.520', g.phim, 0.520, 0.001);
  ok('stocky wall Phi_m near A1', E.phiG(3, 8, 10, 100).phim > 0.78, true);
}

console.log('\n=== Vertical resistance, EC6 ===');
{
  const p = { code:'ec6', unit:'clay1', fb:20, fm:10, gM:2.3, h:2.7, L:5, rho2:0.75, sides:2, t:102.5, t2:0, cavity:false, N:100, e:10, creep:1 };
  const r = E.vertical(p);
  const fkv = 0.55 * Math.pow(20, 0.7) * Math.pow(10, 0.3);
  ok('fd = fk / gamma_M', r.fd, fkv / 2.3, 1e-12);
  ok('hef', r.hef, 2025, 1e-9);
  ok('slenderness hef/tef', r.SR, 2025 / 102.5, 1e-12);
  ok('einit = hef/450', r.einit, 4.5, 1e-12);
  ok('Phi_i = 1 - 2(e + einit)/t', r.phiI, 1 - 2 * 14.5 / 102.5, 1e-12);
  const em = 0.6 * 10 + 4.5, ek = 0.002 * 1 * r.SR * Math.sqrt(102.5 * em);
  ok('creep eccentricity above slenderness 15', r.ek, ek, 1e-12);
  ok('emk = em + ek', r.emk, Math.max(em + ek, 0.05 * 102.5), 1e-12);
  ok('Phi = the smaller', r.Phi, Math.min(r.phiI, r.phim), 1e-12);
  ok('NRd = Phi t fd per metre', r.NRd, r.Phi * 102.5 * fkv / 2.3, 1e-9);
  ok('slenderness against 27', r.slender, r.SR / 27, 1e-12);
  const c = E.vertical(Object.assign({}, p, { e:0 }));
  ok('minimum eccentricity 0.05t at the top', c.ei, Math.max(4.5, 0.05 * 102.5), 1e-12);
  ok('bigger eccentricity, less capacity', E.vertical(Object.assign({}, p, { e:25 })).NRd < r.NRd, true);
}

console.log('\n=== Vertical resistance, BS 5628 Annex B ===');
{
  const p = { code:'bs', unit:'clay1', fb:20, fm:10, gM:3.1, h:2.7, L:5, rho2:0.75, sides:2, t:102.5, t2:0, cavity:false, N:100, e:10 };
  const r = E.vertical(p);
  const SR = 2025 / 102.5, ea = 102.5 * (SR * SR / 2400 - 0.015), em = 0.6 * 10 + ea;
  ok('ea = t[(hef/tef)^2/2400 - 0.015]', r.ea, ea, 1e-12);
  ok('em = 0.6 ex + ea', r.em, em, 1e-12);
  ok('beta = 1.1(1 - 2em/t)', r.beta, Math.min(1, 1.1 * (1 - 2 * em / 102.5)), 1e-12);
  ok('capacity beta t fk / gamma_m', r.NRd, r.beta * 102.5 * r.fk / 3.1, 1e-9);
  const sl = E.vertical(Object.assign({}, p, { h:3.3, rho2:1, t:100, e:15 }));
  ok('beta never negative for a very slender wall', sl.beta, 0);
  ok('and then the wall has no capacity', sl.util === Infinity, true);
  ok('beta capped at 1 for a stocky wall', E.vertical(Object.assign({}, p, { h:0.5, e:0 })).beta <= 1, true);
}

console.log('\n=== Yield line coefficient for a panel on four edges ===');
{
  ok('square isotropic panel alpha2 = 1/24', E.yieldLine(4, 4, 1).alpha2, 1 / 24, 1e-12);
  // a very long panel spans vertically, q -> 8 m1 / h^2 with m1 = mu m2
  ok('long panel tends to one way vertical', E.yieldLine(1e5, 3, 0.4).qOverM, 8 * 0.4 / 9, 1e-4);
  ok('tall panel tends to one way horizontal', E.yieldLine(3, 1e5, 0.4).qOverM, 8 / 9, 1e-4);
  ok('weaker bed joint strength, less capacity', E.yieldLine(4, 3, 0.3).qOverM < E.yieldLine(4, 3, 0.6).qOverM, true);
}

console.log('\n=== Lateral resistance ===');
{
  const p = { code:'ec6', unit:'clay1', fb:20, fm:10, gM:2.3, h:2.7, L:4, t:102.5, W:0.8, fxk1:0.4, fxk2:1.1, Ngk:0, span:'vertical' };
  const r = E.lateral(p);
  const Z = 102.5 * 102.5 / 6;
  ok('m1 = fxk1/gamma_M x Z', r.m1, 0.4 / 2.3 * Z / 1e3, 1e-12);
  ok('vertical span q = 8 m1 / h^2', r.qR, 8 * r.m1 / 2.7 ** 2, 1e-12);
  const pre = E.lateral(Object.assign({}, p, { Ngk:20 }));
  ok('precompression adds sigma_d to fxd1', pre.fx1, 0.4 / 2.3 + 20 / 102.5, 1e-12);
  const four = E.lateral(Object.assign({}, p, { span:'four' }));
  ok('two way beats one way', four.qR > r.qR, true);
  ok('orthogonal ratio mu = fxd1/fxd2', four.mu, (0.4 / 2.3) / (1.1 / 2.3), 1e-12);
  const arch = E.lateral(Object.assign({}, p, { span:'arch' }));
  const fd = 0.55 * Math.pow(20, 0.7) * Math.pow(10, 0.3) / 2.3;
  ok('arch thrust 1.5 fd t / 10', arch.Nad, 1.5 * fd * 102.5 / 10, 1e-12);
  ok('arching q = 8 Nad (0.9t) / h^2', arch.qR, 8 * arch.Nad * 0.9 * 102.5 / 2.7e3 ** 2 * 1e3, 1e-12);
  ok('arching far stronger than bending', arch.qR > 3 * r.qR, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
