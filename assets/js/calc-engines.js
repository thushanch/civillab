/* ============================================================
   CivilLab · torsion-engine.js
   Circular shafts in torsion. Units: d in mm, T in kN·m, L in m,
   G in GPa. τ in MPa, θ in radians. Hollow bore di stays constant
   along a tapered shaft (only the outer diameter tapers).
   ============================================================ */
const TorsionEngine = (() => {
  const J = (dOut, dIn = 0) => Math.PI / 32 * (dOut ** 4 - dIn ** 4);   // mm⁴

  function solve({ d1, d2 = null, di = 0, T, L, G }) {
    // taper: outer varies linearly d1 → d2 (d2 null or = d1 means uniform)
    const dEnd = (d2 == null || Math.abs(d2 - d1) < 1e-9) ? d1 : d2;
    const Tnmm = T * 1e6, Lmm = L * 1e3, Gmpa = G * 1e3;
    const dMin = Math.min(d1, dEnd);
    const tauMax = Tnmm * (dMin / 2) / J(dMin, di);       // MPa, at the thin end
    let theta;
    if (dEnd === d1) theta = Tnmm * Lmm / (Gmpa * J(d1, di));
    else {
      const N = 400; let sum = 0;
      for (let i = 0; i < N; i++) {
        const xi = (i + 0.5) / N;
        sum += 1 / J(d1 + (dEnd - d1) * xi, di);
      }
      theta = Tnmm * Lmm * sum / N / Gmpa;
    }
    const tauAt = r => Tnmm * r / J(dMin, di);            // linear in r at thin end
    return { J1: J(d1, di), Jmin: J(dMin, di), tauMax, theta, dMin, tauAt };
  }
  return { solve, J };
})();
if (typeof module !== 'undefined' && typeof exports !== 'undefined') exports.TorsionEngine = TorsionEngine;

/* ============================================================
   CivilLab · column-engine.js (same file, second global)
   Euler buckling. E in GPa, I in 10⁶ mm⁴, A in mm², L in m,
   fy in MPa. EI in kN·m² equals numerically E[GPa]·I[10⁶mm⁴].
   ============================================================ */
const ColumnEngine = (() => {
  const K = { pp: 1.0, ff: 0.5, fp: 0.6992, fr: 2.0 };
  // pp pinned-pinned, ff fixed-fixed, fp fixed-pinned, fr fixed-free

  function solve({ end, E, I6, A, L, fy }) {
    const k = K[end];
    const EI = E * I6;                          // kN·m²
    const Le = k * L;                           // m
    const Pcr = Math.PI ** 2 * EI / (Le * Le);  // kN
    const r = Math.sqrt(I6 * 1e6 / A);          // mm
    const lam = Le * 1e3 / r;                   // slenderness
    const sigCr = Pcr * 1e3 / A;                // MPa
    const Psquash = fy * A / 1e3;               // kN
    const governing = sigCr < fy ? 'euler' : 'squash';
    const Pu = Math.min(Pcr, Psquash);
    const lamLimit = Math.PI * Math.sqrt(E * 1e3 / fy);   // λ where Euler = fy
    return { k, EI, Le, Pcr, r, lam, sigCr, Psquash, Pu, governing, lamLimit };
  }

  /* normalised buckled shape, xi in 0..1 measured from the base */
  function shape(end, xi) {
    if (end === 'pp') return Math.sin(Math.PI * xi);
    if (end === 'fr') return 1 - Math.cos(Math.PI * xi / 2);            // fixed base, free top
    if (end === 'ff') return (1 - Math.cos(2 * Math.PI * xi)) / 2;
    // fixed base, pinned top: v = kL − kx + sin kx − kL cos kx, kL = 4.4934
    const kL = 4.4934, kx = kL * xi;
    return (kL - kx + Math.sin(kx) - kL * Math.cos(kx)) / 2.2;          // rough normalise
  }
  return { solve, shape, K };
})();
if (typeof module !== 'undefined' && typeof exports !== 'undefined') exports.ColumnEngine = ColumnEngine;

/* ============================================================
   CivilLab · soil-engine.js (same file, third global)
   Three-phase soil relationships. γw = 9.81 kN/m³.
   Compression-free basics: e void ratio, w water content (decimal),
   Gs specific gravity. Se = wGs governs saturation.
   ============================================================ */
const SoilEngine = (() => {
  const GW = 9.81;
  function phase(e, w, Gs) {
    const wSat = e / Gs;                 // water content at S = 1
    const capped = w > wSat + 1e-12;
    const wUse = Math.min(w, wSat);
    const S = wUse * Gs / e;             // 0..1
    const n = e / (1 + e);
    const gdry = Gs * GW / (1 + e);
    const gbulk = (Gs + S * e) * GW / (1 + e);
    const gsat = (Gs + e) * GW / (1 + e);
    const gsub = gsat - GW;
    return { e, w: wUse, wSat, capped, Gs, S, n, gdry, gbulk, gsat, gsub, GW };
  }
  return { phase, GW };
})();
if (typeof module !== 'undefined' && typeof exports !== 'undefined') exports.SoilEngine = SoilEngine;
