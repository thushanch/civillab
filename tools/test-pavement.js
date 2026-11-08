/* Engine tests for PavementEngine against Boussinesq, Odemark, the Corps CBR
   equation and the Asphalt Institute rutting criterion */
const E = require('../assets/js/pavement-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}

console.log('=== Load and contact ===');
ok('a = sqrt(P / pi p), 40 kN at 550 kPa', E.radius(40, 550), Math.sqrt(40000 / (Math.PI * 0.55)), 1e-9);
ok('a about 152 mm', E.radius(40, 550), 152.1, 0.1);

console.log('\n=== Boussinesq on the axis ===');
ok('sigma/p = 1 at the surface', E.sigmaRatio(0, 150), 1);
ok('sigma/p at z = a', E.sigmaRatio(150, 150), 1 - 1 / Math.pow(2, 1.5), 1e-12);
ok('sigma/p = 0.646 at z = a', E.sigmaRatio(150, 150), 0.6464, 0.0001);
ok('decays with depth', E.sigmaRatio(600, 150) < E.sigmaRatio(300, 150), true);
// strain at the surface: (1 + nu) p / E (1 - 2 nu + 0 - 0) = 2(1 - nu^2) ... check the bracket
ok('surface strain (1 + nu)(1 - 2nu) p/E', E.strainZ(0, 150, 550, 50), 1.4 * 0.2 * 0.55 / 50, 1e-15);
ok('strain decays with depth', E.strainZ(1000, 150, 550, 50) < E.strainZ(300, 150, 550, 50), true);

console.log('\n=== Odemark equivalent depth ===');
{
  const layers = [{ h:100, E:3000 }, { h:200, E:400 }, { h:250, E:150 }];
  const he = 0.9 * (100 * Math.cbrt(60) + 200 * Math.cbrt(8) + 250 * Math.cbrt(3));
  ok('he = 0.9 sum h (E/Es)^1/3', E.equivDepth(layers, 50, 550), he, 1e-9);
  ok('he about 1037 mm', E.equivDepth(layers, 50, 550), 1036.9, 0.5);
  ok('part way into the first layer', E.equivDepth(layers, 50, 50), 0.9 * 50 * Math.cbrt(60), 1e-9);
  ok('below the layers subgrade counts one for one', E.equivDepth(layers, 50, 650) - E.equivDepth(layers, 50, 550), 90, 1e-9);
}

console.log('\n=== Corps CBR thickness ===');
{
  // 40 kN = 8992 lb at 79.8 psi, CBR 5, 5000 repetitions: about 13.6 in
  const Plb = 40 * 224.809, A = Plb / (550 * 0.145038);
  const t = (0.23 * Math.log10(5000) + 0.15) * Math.sqrt(Plb / 40.5 - A / Math.PI) * 25.4;
  ok('t over CBR 5', E.cbrThickness(40, 550, 5, 5000), t, 1e-9);
  ok('about 347 mm', E.cbrThickness(40, 550, 5, 5000), 347, 1);
  ok('weaker subgrade needs more', E.cbrThickness(40, 550, 3, 5000) > E.cbrThickness(40, 550, 5, 5000), true);
  ok('more traffic needs more', E.cbrThickness(40, 550, 5, 5e6) > E.cbrThickness(40, 550, 5, 5000), true);
  ok('a strong base needs little cover', E.cbrThickness(40, 550, 80, 5e6) < E.cbrThickness(40, 550, 30, 5e6), true);
  ok('never negative', E.cbrThickness(40, 550, 200, 100), 0);
}

console.log('\n=== Rutting life ===');
ok('Nd = 1.365e-9 eps^-4.477', E.Nrut(2e-4), 1.365e-9 * Math.pow(2e-4, -4.477), 1e-3);
ok('halving strain multiplies life by 2^4.477', E.Nrut(1e-4) / E.Nrut(2e-4), Math.pow(2, 4.477), 1e-6);

console.log('\n=== Solve ===');
{
  const inp = { h1:100, E1:3000, h2:200, E2:400, cbrBase:80, h3:250, E3:150, cbrSub:30, CBR:5, P:40, p:550, N:2 };
  const r = E.solve(inp);
  ok('subgrade modulus 10 CBR', r.Es, 50);
  ok('total thickness', r.total, 550);
  ok('strain at the top of the subgrade', r.eps, E.strainZ(r.he, r.a, 550, 50), 1e-15);
  ok('rutting utilisation N / Nd', r.u.rut, 2e6 / E.Nrut(r.eps), 1e-9);
  ok('stress profile starts at p', r.profile[0].ratio, 1, 1e-9);
  ok('stiffer asphalt cuts the subgrade strain', E.solve(Object.assign({}, inp, { E1:6000 })).eps < r.eps, true);
  ok('thicker base cuts it too', E.solve(Object.assign({}, inp, { h2:350 })).eps < r.eps, true);
  ok('cover over the subbase uses its CBR', r.needOverSub, E.cbrThickness(40, 550, 30, 2e6), 1e-9);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
