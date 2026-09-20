/* CivilLab · bearing-engine.js
   Shallow foundation bearing capacity.

   Two methods:
   - Terzaghi (1943): Nc = 5.7 at phi = 0, original shape factors, no depth
     factors. The Nq formula uses the Terzaghi log-spiral assumption:
       a = exp((3pi/4 - phi/2) tan phi)
       Nq = a^2 / (2 cos^2(45 + phi/2))
       Nc = (Nq - 1) cot phi, or 5.7 at phi = 0
       Ng from the Kumbhojkar (1993) tabulation of the original analysis
   - General (Hansen 1970 / Vesic 1973): Nc = pi + 2 = 5.14 at phi = 0,
     shape, depth and inclination factors applied to each term:
       Nq = tan^2(45 + phi/2) exp(pi tan phi)
       Nc = (Nq - 1) cot phi, or pi + 2 at phi = 0
       Ng = 2(Nq + 1) tan phi   (Vesic 1973)

   Bearing capacity equation:
     qu = c Nc sc dc + q Nq sq dq + 0.5 gamma B' Ng sg dg

   Shape factors (Hansen): sc = 1 + (B'/L')(Nq/Nc), sq = 1 + (B'/L') sin phi,
     sg = 1 - 0.4(B'/L'). Strip: all 1.
   Terzaghi shape: strip 1/1, square 1.3/0.8, circle 1.3/0.6.

   Depth factors (Hansen, general only):
     dc = 1 + 0.4 k, dq = 1 + 2 tan phi (1 - sin phi)^2 k, dg = 1
     where k = D/B' for D/B' <= 1, k = arctan(D/B') otherwise.

   Water table: three cases. zw <= D affects both q and gamma_eff.
   D < zw <= D+B interpolates gamma_eff. zw > D+B has no effect.

   Eccentricity: Meyerhof effective area, B' = B - 2eB, L' = L - 2eL.

   Units: m, kN/m3, kPa, degrees at boundary, radians inside.
   COMPRESSION POSITIVE (the soil convention).
*/
const BearingEngine = (() => {

  const RAD = Math.PI / 180;
  const GW = 9.81;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Terzaghi Ng table (Kumbhojkar 1993) ---------- */
  const TNG = [
    [0,0],[5,0.5],[10,1.2],[15,2.5],[20,5.0],[25,9.7],
    [30,19.7],[34,36.0],[35,42.4],[40,100.4],[45,297.5],[50,1153.2]
  ];
  function terzaghiNg(phi) {
    if (phi <= 0) return 0;
    if (phi >= 50) return TNG[TNG.length - 1][1];
    for (let i = 1; i < TNG.length; i++) {
      if (phi <= TNG[i][0]) {
        const t = (phi - TNG[i - 1][0]) / (TNG[i][0] - TNG[i - 1][0]);
        return TNG[i - 1][1] + t * (TNG[i][1] - TNG[i - 1][1]);
      }
    }
    return TNG[TNG.length - 1][1];
  }

  /* ---------- bearing capacity factors ---------- */
  function terzaghiFactors(phi) {
    const p = clamp(phi, 0, 50) * RAD;
    if (phi < 0.01) return { Nc: 5.7, Nq: 1, Ng: 0 };
    const a = Math.exp((0.75 * Math.PI - p / 2) * Math.tan(p));
    const cp = Math.cos(Math.PI / 4 + p / 2);
    const Nq = a * a / (2 * cp * cp);
    const Nc = (Nq - 1) / Math.tan(p);
    const Ng = terzaghiNg(phi);
    return { Nc, Nq, Ng };
  }

  function generalFactors(phi) {
    const p = clamp(phi, 0, 50) * RAD;
    if (phi < 0.01) return { Nc: Math.PI + 2, Nq: 1, Ng: 0 };
    const tp = Math.tan(Math.PI / 4 + p / 2);
    const Nq = tp * tp * Math.exp(Math.PI * Math.tan(p));
    const Nc = (Nq - 1) / Math.tan(p);
    const Ng = 2 * (Nq + 1) * Math.tan(p);
    return { Nc, Nq, Ng };
  }

  /* ---------- shape factors ---------- */
  function shapeFactors(method, shape, Bp, Lp, N, phi) {
    if (method === 'terzaghi') {
      if (shape === 'strip')  return { sc: 1, sq: 1, sg: 1 };
      if (shape === 'circle') return { sc: 1.3, sq: 1, sg: 0.6 };
      if (shape === 'square') return { sc: 1.3, sq: 1, sg: 0.8 };
      const r = Bp / Math.max(0.01, Lp);
      return { sc: 1 + 0.3 * r, sq: 1, sg: 1 - 0.2 * r };
    }
    if (shape === 'strip') return { sc: 1, sq: 1, sg: 1 };
    const ratio = Bp / Math.max(0.01, isFinite(Lp) ? Lp : 1e6);
    const sp = Math.sin(clamp(phi, 0, 50) * RAD);
    return {
      sc: 1 + ratio * (N.Nq / Math.max(0.01, N.Nc)),
      sq: 1 + ratio * sp,
      sg: Math.max(0.6, 1 - 0.4 * ratio)
    };
  }

  /* ---------- depth factors (Hansen, general method only) ---------- */
  function depthFactors(D, Bp, phi) {
    const r = D / Math.max(0.01, Bp);
    const p = clamp(phi, 0, 50) * RAD;
    const sp = Math.sin(p), tp = Math.tan(p);
    const k = r <= 1 ? r : Math.atan(r);
    return {
      dc: 1 + 0.4 * k,
      dq: phi < 0.01 ? 1 : 1 + 2 * tp * (1 - sp) * (1 - sp) * k,
      dg: 1
    };
  }

  /* ---------- water table ---------- */
  function waterEffect(gamma, gammaSat, D, B, zw) {
    const gsub = Math.max(0, gammaSat - GW);
    if (!isFinite(zw) || zw >= D + B) {
      return { q: gamma * D, gammaEff: gamma, wcase: 3 };
    }
    if (zw <= D) {
      const q = gamma * Math.min(zw, D) + gsub * Math.max(0, D - zw);
      return { q, gammaEff: gsub, wcase: 1 };
    }
    const q = gamma * D;
    const t = (zw - D) / Math.max(0.01, B);
    const gammaEff = gsub + (gamma - gsub) * t;
    return { q, gammaEff, wcase: 2 };
  }

  /* ---------- failure wedge geometry for drawing ----------
     The Prandtl mechanism below the footing, right half only.
     Returns: active zone triangle, log-spiral points, passive endpoint. */
  /* The Prandtl failure mechanism (right half, x from footing centre, z down).
     Pole at (B/2, 0).  Active zone boundary goes at alpha = 45+phi/2 from
     horizontal.  The log-spiral sweeps clockwise by pi/2 from the bottom of
     the active zone to the top of the passive zone.  Then a straight line
     goes at beta = 45-phi/2 from horizontal back to the surface (z = 0). */
  function wedgeGeometry(B, phi) {
    const p = clamp(Math.max(phi, 0.5), 0.5, 50) * RAD;
    const alpha = Math.PI / 4 + p / 2;
    const d = (B / 2) * Math.tan(alpha);
    const r0 = (B / 2) / Math.cos(alpha);
    const nPts = 24;
    const spiral = [];
    for (let i = 0; i <= nPts; i++) {
      const psi = i / nPts * (Math.PI / 2);
      const r = r0 * Math.exp(psi * Math.tan(p));
      const ang = alpha + psi;
      spiral.push({
        x: B / 2 - r * Math.cos(ang),
        z: r * Math.sin(ang)
      });
    }
    const last = spiral[spiral.length - 1];
    const beta = Math.PI / 4 - p / 2;
    const surfaceX = beta > 1e-6 ? last.x + last.z / Math.tan(beta) : last.x + 100;
    return { d, alpha: alpha / RAD, spiral, surfaceX, beta: beta / RAD };
  }

  /* ---------- Boussinesq vertical stress under a strip footing ----------
     Returns dsz/q at depth z below the centre of a strip of width B. */
  function boussinesqStrip(B, z) {
    if (z < 1e-9) return 1;
    const theta = Math.atan(B / (2 * z));
    return (1 / Math.PI) * (2 * theta + Math.sin(2 * theta));
  }

  /* ---------- main solver ---------- */
  function solve(inp) {
    const method = inp.method || 'general';
    const shape = inp.shape || 'strip';
    const B = Math.max(0.3, +inp.B || 1);
    const L = shape === 'strip' ? Infinity :
              (shape === 'circle' || shape === 'square') ? B :
              Math.max(B, +inp.L || B);
    const D = Math.max(0, +inp.D || 0);
    const gamma = Math.max(1, +inp.gamma || 18);
    const gammaSat = Math.max(gamma, +inp.gammaSat || gamma);
    const c = Math.max(0, +inp.c || 0);
    const phi = clamp(+inp.phi || 0, 0, 50);
    const zw = inp.zw == null ? Infinity : Math.max(0, +inp.zw);
    const eB = clamp(+inp.eB || 0, 0, B / 2 - 0.01);
    const eL = (shape === 'strip' || shape === 'circle' || shape === 'square')
      ? 0 : clamp(+inp.eL || 0, 0, L / 2 - 0.01);
    const FoS = Math.max(1, +inp.FoS || 3);
    const qApp = Math.max(0, +inp.qApp || 0);

    const Bp = B - 2 * eB;
    const Lp = isFinite(L) ? L - 2 * eL : Infinity;

    const N = method === 'terzaghi' ? terzaghiFactors(phi) : generalFactors(phi);
    const sf = shapeFactors(method, shape, Bp, Lp, N, phi);
    const df = method === 'terzaghi'
      ? { dc: 1, dq: 1, dg: 1 }
      : depthFactors(D, Bp, phi);
    const wt = waterEffect(gamma, gammaSat, D, B, zw);

    const term1 = c * N.Nc * sf.sc * df.dc;
    const term2 = wt.q * N.Nq * sf.sq * df.dq;
    const term3 = 0.5 * wt.gammaEff * Bp * N.Ng * sf.sg * df.dg;
    const qu = term1 + term2 + term3;
    const qa = qu / FoS;
    const actualFoS = qApp > 1e-9 ? qu / qApp : Infinity;
    const safe = qApp <= qa + 1e-9;

    const qnet = qu - wt.q;
    const qaNet = qnet / FoS;

    const wedge = wedgeGeometry(B, phi);

    return {
      method, shape, B, L, D, Bp, Lp, eB, eL,
      gamma, gammaSat, c, phi, zw,
      N, sf, df,
      q: wt.q, gammaEff: wt.gammaEff, waterCase: wt.wcase,
      term1, term2, term3,
      qu, qa, qnet, qaNet, qApp, FoS, actualFoS, safe,
      wedge
    };
  }

  return {
    solve, generalFactors, terzaghiFactors, terzaghiNg,
    shapeFactors, depthFactors, waterEffect, wedgeGeometry,
    boussinesqStrip, GW, RAD
  };
})();
if (typeof module !== 'undefined') module.exports = BearingEngine;
