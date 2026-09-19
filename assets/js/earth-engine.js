/* CivilLab · earth-engine.js
   Lateral earth pressure and retaining wall stability.

   Physics
   - Rankine, level backfill: Ka = tan^2(45 - phi/2) = (1 - sin phi)/(1 + sin phi)
     and Kp = 1/Ka. At rest uses Jaky, K0 = 1 - sin phi.
   - Rankine with a backfill sloping at beta, the thrust acting parallel to
     the surface:
       Ka = cos(b) (cos b - sqrt(cos^2 b - cos^2 phi))
                  /(cos b + sqrt(cos^2 b - cos^2 phi))
   - Coulomb, with wall friction delta and a back face leaning theta from
     vertical:
       Ka = cos^2(phi - theta)
          / [ cos^2(theta) cos(delta + theta)
              (1 + sqrt( sin(phi+delta) sin(phi-beta)
                       / (cos(delta+theta) cos(theta-beta)) ))^2 ]
     With theta = delta = beta = 0 this collapses exactly onto Rankine.
   - active pressure at depth z: sigma_a = Ka sigma_v' - 2c sqrt(Ka), held at
     zero above the tension crack z0 = 2c/(gamma sqrt(Ka))
   - passive: sigma_p = Kp sigma_v' + 2c sqrt(Kp)
   - water is carried separately, u = gamma_w (z - zw), and below the water
     table the vertical effective stress grows at gamma' = gamma_sat - gamma_w
   - the thrust is integrated down the wall rather than assembled from standard
     shapes, so a tension crack, a water table and a surcharge all come out of
     the same loop with the correct resultant and lever arm

   Stability, all moments taken about the toe
   - sliding   F = (sum V tan(delta_b) + c_b B + Pp) / sum H
   - overturning F = resisting moments / overturning moments
   - bearing   x = (Mr - Mo)/sum V, e = B/2 - x,
               q = sum V / B (1 +/- 6e/B) while e <= B/6,
               and q_max = 2 sum V / (3 x) once the resultant leaves the
               middle third and the heel lifts off

   Units and conventions
   - lengths in metres, unit weights in kN/m3, stresses and pressures in kPa,
     forces in kN per metre run, moments in kNm per metre run
   - angles in degrees at the boundary, radians inside
   - x is measured from the toe of the base, z down from the top of the fill
   - COMPRESSION POSITIVE, the soil convention
*/
const EarthEngine = (() => {

  const RAD = Math.PI / 180;
  const GW = 9.81;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- earth pressure coefficients ---------- */
  const Ka = phi => { const s = Math.sin(clamp(phi, 0, 89) * RAD); return (1 - s) / (1 + s); };
  const Kp = phi => { const s = Math.sin(clamp(phi, 0, 89) * RAD); return (1 + s) / (1 - s); };
  const K0 = phi => 1 - Math.sin(clamp(phi, 0, 89) * RAD);

  /* Rankine with a sloping backfill. Beta cannot exceed phi or the fill is
     already sliding on its own, so it is held just below. */
  function KaSloped(phi, beta) {
    const p = clamp(phi, 0, 89) * RAD;
    const b = clamp(beta, 0, Math.max(0, phi - 0.01)) * RAD;
    const cb = Math.cos(b), cp = Math.cos(p);
    const r = Math.sqrt(Math.max(0, cb * cb - cp * cp));
    const den = cb + r;
    return den > 1e-12 ? cb * (cb - r) / den : Ka(phi);
  }
  function KpSloped(phi, beta) {
    const p = clamp(phi, 0, 89) * RAD;
    const b = clamp(beta, 0, Math.max(0, phi - 0.01)) * RAD;
    const cb = Math.cos(b), cp = Math.cos(p);
    const r = Math.sqrt(Math.max(0, cb * cb - cp * cp));
    const den = cb - r;
    return den > 1e-12 ? cb * (cb + r) / den : Kp(phi);
  }

  function KaCoulomb(phi, delta, beta, theta) {
    const p = clamp(phi, 0, 89) * RAD, d = clamp(delta, 0, phi) * RAD;
    const b = clamp(beta, 0, Math.max(0, phi - 0.01)) * RAD, t = (theta || 0) * RAD;
    const num = Math.cos(p - t) ** 2;
    const inner = Math.sin(p + d) * Math.sin(p - b) /
                  (Math.cos(d + t) * Math.cos(t - b));
    const root = Math.sqrt(Math.max(0, inner));
    const den = Math.cos(t) ** 2 * Math.cos(d + t) * (1 + root) ** 2;
    return den > 1e-12 ? num / den : Ka(phi);
  }
  function KpCoulomb(phi, delta, beta, theta) {
    const p = clamp(phi, 0, 89) * RAD, d = clamp(delta, 0, phi) * RAD;
    const b = clamp(beta, 0, Math.max(0, phi - 0.01)) * RAD, t = (theta || 0) * RAD;
    const num = Math.cos(p + t) ** 2;
    const inner = Math.sin(p + d) * Math.sin(p + b) /
                  (Math.cos(d - t) * Math.cos(t - b));
    const root = Math.sqrt(Math.max(0, inner));
    const den = Math.cos(t) ** 2 * Math.cos(d - t) * (1 - root) ** 2;
    return den > 1e-12 ? num / den : Kp(phi);
  }

  /* depth of the tension crack, where the active pressure first turns positive */
  const crackDepth = (c, gamma, ka) =>
    (c > 0 && gamma > 0 && ka > 0) ? 2 * c / (gamma * Math.sqrt(ka)) : 0;

  /* ---------- the pressure profile down the wall ----------
     One integration covers the surcharge, the tension crack and the water
     table together, so there are no special cases to assemble by hand. */
  function profile(p) {
    const H = +p.H, ka = +p.K, c = +p.c || 0, q = +p.q || 0;
    const gam = +p.gamma, gsat = +p.gammaSat || +p.gamma;
    const zw = p.zw == null ? Infinity : +p.zw;
    const N = p.n || 2000, dz = H / N;
    const gsub = Math.max(0, gsat - GW);
    const sq = Math.sqrt(Math.max(0, ka));
    let P = 0, M = 0, Pw = 0, Mw = 0;
    const pts = [];
    const step = Math.max(1, Math.round(N / (p.pts || 160)));
    for (let i = 0; i < N; i++) {
      const z = (i + 0.5) * dz;
      const sv = z <= zw ? q + gam * z
                         : q + gam * Math.min(zw, z) + gsub * (z - Math.min(zw, z));
      const sa = Math.max(0, ka * sv - 2 * c * sq);
      const u = z > zw ? GW * (z - zw) : 0;
      P += sa * dz;  M += sa * dz * (H - z);      // arm measured above the base
      Pw += u * dz;  Mw += u * dz * (H - z);
      if (i % step === 0 || i === N - 1) pts.push({ z, sa, u, sv });
    }
    return {
      P, Pw, arm: P > 1e-12 ? M / P : 0, armW: Pw > 1e-12 ? Mw / Pw : 0,
      pts, z0: crackDepth(c, gam, ka),
      saAt: z => {
        const sv = z <= zw ? q + gam * z
                           : q + gam * Math.min(zw, z) + gsub * (z - Math.min(zw, z));
        return Math.max(0, ka * sv - 2 * c * sq);
      },
      uAt: z => z > zw ? GW * (z - zw) : 0
    };
  }

  /* ---------- the whole wall ---------- */
  function solve(inp) {
    const H = +inp.H, B = +inp.B, tb = +inp.tb, ts = +inp.ts, Lt = +inp.Lt;
    const heel = Math.max(0, B - Lt - ts);
    const stemH = Math.max(0, H - tb);
    const gam = +inp.gamma, gsat = +inp.gammaSat || gam, gc = +inp.gammaC || 24;
    const phi = +inp.phi, c = +inp.c || 0, beta = +inp.beta || 0, q = +inp.q || 0;
    const zw = inp.zw == null ? Infinity : +inp.zw;
    const theory = inp.theory || 'rankine';
    const delta = clamp(+inp.delta || 0, 0, phi);

    /* the coefficient, and the direction the thrust leans */
    const kaUse = theory === 'coulomb' ? KaCoulomb(phi, delta, beta, 0)
                : beta > 0 ? KaSloped(phi, beta) : Ka(phi);
    const lean = (theory === 'coulomb' ? delta : beta) * RAD;

    const pr = profile({ H, K: kaUse, c, q, gamma: gam, gammaSat: gsat, zw,
                         n: inp.n || 2000, pts: inp.pts || 160 });
    const Pa = pr.P, Pw = pr.Pw;
    const Ph = Pa * Math.cos(lean) + Pw;        // water always pushes horizontally
    const Pv = Pa * Math.sin(lean);

    /* passive in front of the toe */
    const Df = Math.max(0, +inp.Df || 0);
    const gF = +inp.gammaF || gam, phiF = inp.phiF == null ? phi : +inp.phiF;
    const cF = inp.cF == null ? c : +inp.cF;
    const kp = Kp(phiF);
    const Pp = 0.5 * kp * gF * Df * Df + 2 * cF * Math.sqrt(kp) * Df;
    const PpArm = Df > 0 ? (0.5 * kp * gF * Df * Df * (Df / 3) +
                            2 * cF * Math.sqrt(kp) * Df * (Df / 2)) / Math.max(1e-12, Pp) : 0;
    const usePassive = inp.usePassive !== false;
    const PpUse = usePassive ? Pp : 0;

    /* weights and their lever arms about the toe */
    const soilOnHeel = (() => {
      // integrate the fill over the heel so the water table is honoured
      const n = 400, dz = stemH / n, gsub = Math.max(0, gsat - GW);
      let W = 0;
      for (let i = 0; i < n; i++) {
        const z = (i + 0.5) * dz;               // measured from the top of the fill
        W += (z <= zw ? gam : gsat) * dz;
      }
      return W * heel;
    })();
    const parts = [
      { name:'Stem', W: ts * stemH * gc, x: Lt + ts / 2 },
      { name:'Base', W: B * tb * gc, x: B / 2 },
      { name:'Soil on heel', W: soilOnHeel, x: Lt + ts + heel / 2 },
      { name:'Surcharge on heel', W: q * heel, x: Lt + ts + heel / 2 },
      { name:'Vertical thrust', W: Pv, x: B }
    ].filter(p => p.W > 1e-12);

    const V = parts.reduce((t, p) => t + p.W, 0);
    const Mr = parts.reduce((t, p) => t + p.W * p.x, 0) + PpUse * PpArm;
    const Mo = Pa * Math.cos(lean) * pr.arm + Pw * pr.armW;

    /* sliding */
    const deltaB = clamp(inp.deltaB == null ? phi * 2 / 3 : +inp.deltaB, 0, 89);
    const cB = +inp.cB || 0;
    const slideR = V * Math.tan(deltaB * RAD) + cB * B + PpUse;
    const FoSslide = Ph > 1e-12 ? slideR / Ph : Infinity;

    /* overturning */
    const FoSover = Mo > 1e-12 ? Mr / Mo : Infinity;

    /* bearing */
    const xbar = V > 1e-12 ? (Mr - Mo) / V : 0;
    const e = B / 2 - xbar;
    const middleThird = Math.abs(e) <= B / 6 + 1e-12;
    /* qToe and qHeel are the physical pressures at the two ends. They only
       come out in that order while e is positive, so qmax and qmin are taken
       as the larger and smaller rather than assumed. */
    const offBase = !(xbar > 1e-9 && xbar < B - 1e-9);
    let qToe, qHeel;
    if (V <= 1e-12) { qToe = 0; qHeel = 0; }
    else if (middleThird) {
      qToe = V / B * (1 + 6 * e / B);
      qHeel = V / B * (1 - 6 * e / B);
    } else if (e > 0) {
      // resultant towards the toe, so the heel lifts off and a width 3x carries it
      qToe = offBase ? Infinity : 2 * V / (3 * xbar);
      qHeel = 0;
    } else {
      // resultant towards the heel, so it is the toe that lifts off
      const xh = B - xbar;
      qHeel = offBase ? Infinity : 2 * V / (3 * xh);
      qToe = 0;
    }
    const qmax = Math.max(qToe, qHeel), qmin = Math.min(qToe, qHeel);

    return {
      H, B, tb, ts, Lt, heel, stemH,
      Ka: kaUse, Kp: kp, K0: K0(phi), lean: lean / RAD,
      profile: pr, Pa, Pw, Ph, Pv, arm: pr.arm, armW: pr.armW, z0: pr.z0,
      Pp, PpArm, PpUse,
      parts, V, Mr, Mo, xbar, e, middleThird, qmax, qmin, qToe, qHeel, offBase,
      FoSslide, FoSover, slideR,
      deltaB, cB
    };
  }

  return { Ka, Kp, K0, KaSloped, KpSloped, KaCoulomb, KpCoulomb,
           crackDepth, profile, solve, GW, RAD };
})();
if (typeof module !== 'undefined') module.exports = EarthEngine;
