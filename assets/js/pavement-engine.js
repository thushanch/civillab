/* CivilLab · PavementEngine
   Flexible pavement, an empirical CBR thickness and a mechanistic strain check.
   Units: thickness in mm, moduli in MPa, wheel load in kN, tyre pressure in kPa,
   traffic in million standard axles (msa).
   Contact radius a = sqrt(P / (pi p)) for a single circular tyre print.
   CBR cover thickness, US Corps of Engineers:
     t = (0.23 log10 C + 0.15) sqrt(P / (8.1 CBR) - A / pi)
     in inches with P in lb and A in square inches, C the load repetitions.
     Applied in turn over the subgrade, the subbase and the base, so each layer
     is covered by enough stronger material above it.
   Mechanistic: subgrade modulus Es = 10 CBR (Heukelom and Klomp), the layers
     turned into an equivalent depth of subgrade by Odemark,
     he = 0.9 sum h_i (E_i / Es)^(1/3), then Boussinesq on the load axis:
     sigma_z / p = 1 - z^3 / (a^2 + z^2)^1.5 and
     eps_z = (1 + nu) p / E [1 - 2nu + 2nu z / sqrt(a^2 + z^2) - z^3 / (a^2 + z^2)^1.5]
     with nu = 0.4. The rutting life is the Asphalt Institute
     Nd = 1.365e-9 eps_z^-4.477. */
const PavementEngine = (() => {
  const LB = 224.809, PSI = 0.145038, IN = 25.4, NU = 0.4;

  const radius = (P, p) => Math.sqrt(P * 1e3 / (Math.PI * p / 1e3));   // mm

  function cbrThickness(P, p, CBR, C) {
    const Plb = P * LB, ppsi = p * PSI, A = Plb / ppsi;
    const f = 0.23 * Math.log10(Math.max(C, 10)) + 0.15;
    const inner = Plb / (8.1 * CBR) - A / Math.PI;
    return Math.max(0, f * Math.sqrt(Math.max(inner, 0)) * IN);
  }

  const sigmaRatio = (z, a) => 1 - Math.pow(z, 3) / Math.pow(a * a + z * z, 1.5);
  function strainZ(z, a, p, E) {
    const r = Math.sqrt(a * a + z * z);
    return (1 + NU) * (p / 1e3) / E * (1 - 2 * NU + 2 * NU * z / r - Math.pow(z / r, 3));
  }
  const Nrut = eps => 1.365e-9 * Math.pow(eps, -4.477);

  /* equivalent depth in subgrade material of a real depth d */
  function equivDepth(layers, Es, d) {
    let he = 0, top = 0;
    for (const L of layers) {
      const part = Math.max(0, Math.min(d, top + L.h) - top);
      he += part * Math.cbrt(L.E / Es);
      top += L.h;
      if (d <= top) break;
    }
    if (d > top) he += d - top;
    return 0.9 * he;
  }

  function solve(inp) {
    const layers = [{ name:'Asphalt surfacing', h:inp.h1, E:inp.E1 }, { name:'Granular base', h:inp.h2, E:inp.E2, CBR:inp.cbrBase },
                    { name:'Subbase', h:inp.h3, E:inp.E3, CBR:inp.cbrSub }];
    const Es = 10 * inp.CBR;
    const a = radius(inp.P, inp.p);
    const C = inp.N * 1e6;
    const total = inp.h1 + inp.h2 + inp.h3;
    /* cover each layer needs above it */
    const needSub = cbrThickness(inp.P, inp.p, inp.CBR, C);
    const needOverSub = cbrThickness(inp.P, inp.p, inp.cbrSub, C);
    const needOverBase = cbrThickness(inp.P, inp.p, inp.cbrBase, C);
    const he = equivDepth(layers, Es, total);
    const eps = strainZ(he, a, inp.p, Es);
    const Nd = Nrut(eps);
    const sigSub = sigmaRatio(he, a) * inp.p;
    const profile = [];
    for (let i = 0; i <= 120; i++) {
      const d = (total + 300) * i / 120;
      profile.push({ d, ratio: sigmaRatio(Math.max(equivDepth(layers, Es, d), 1e-6), a) });
    }
    return { layers, Es, a, C, total, needSub, needOverSub, needOverBase, he, eps, Nd, sigSub, profile,
             u:{ total: needSub / total, overSub: needOverSub / (inp.h1 + inp.h2), overBase: needOverBase / inp.h1, rut: C / Nd } };
  }

  return { solve, radius, cbrThickness, sigmaRatio, strainZ, Nrut, equivDepth, NU };
})();
if (typeof module !== 'undefined') module.exports = PavementEngine;
