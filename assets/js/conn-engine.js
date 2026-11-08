/* CivilLab · ConnEngine
   Steel connections, EN 1993-1-8 with the UK NA against BS 5950-1:2000.
   Units: mm, MPa, kN, kN·m. gamma_M0 = 1.0, gamma_M2 = 1.25.
   Bolt group: a rectangular grid nr rows by nc columns at pitch p (vertical)
     and gauge g (horizontal), loaded by a vertical shear V at an eccentricity
     ecc from the group centroid, analysed elastically: each bolt takes V/n
     plus M r / sum r^2 at right angles to its radius. Tension N is shared by
     a T-stub of thickness tp, bolt distance m, edge distance n and effective
     length leff, checked in the three EC3 Table 6.2 modes.
   Welds: two parallel vertical fillet welds of length L, b apart, carrying V
     at ecc from their centroid. The worst point is resolved into the
     directional components, so the resistance per mm is
     fu a / (beta_w gamma_M2 sqrt(2 sin^2 theta + 3 cos^2 theta)),
     theta between the force and the weld axis.
   Base plate: effective area method, EC3 6.2.5 with fjd = (2/3) fcd sqrt(Ac1/Ac0)
     capped at 3, c = tp sqrt(fy / (3 fjd gamma_M0)). BS 5950 4.13.2.2 with a
     bearing strength of 0.6 fcu and tp = c sqrt(3w/pyp). */
const ConnEngine = (() => {
  const SE = (typeof SteelEngine !== 'undefined') ? SteelEngine : require('./steel-engine.js');
  const GM0 = 1.0, GM2 = 1.25;

  const BOLTS = { 12:84.3, 16:157, 20:245, 22:303, 24:353, 27:459, 30:561 };
  const GRADES = { '4.6':{ fub:400, fyb:240, av:0.6, ps:160, pbb:460, pt:240 },
                   '8.8':{ fub:800, fyb:640, av:0.6, ps:375, pbb:1000, pt:560 },
                   '10.9':{ fub:1000, fyb:900, av:0.5, ps:400, pbb:1300, pt:700 } };
  const STEEL = { S275:{ fy:275, fu:410, bw:0.85, pbs:460, pw:220 }, S355:{ fy:355, fu:470, bw:0.9, pbs:550, pw:250 } };
  const holeD = d => d + (d <= 24 ? 2 : 3);
  const plateFy = (grade, t) => SE.fyFor(grade, t);

  /* elastic polar analysis of the bolt group */
  function polar(nr, nc, p, g, V, ecc) {
    const bolts = [];
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++)
      bolts.push({ x: (j - (nc - 1) / 2) * g, y: ((nr - 1) / 2 - i) * p, row:i, col:j });
    const n = bolts.length;
    const Ip = bolts.reduce((a, b) => a + b.x * b.x + b.y * b.y, 0);
    const M = V * ecc;                       // kN·mm, clockwise for V down with ecc to the right
    bolts.forEach(b => {
      /* direct share acts down, the moment adds a component normal to the radius */
      const fx = Ip > 0 ? M * b.y / Ip : 0, fy = -V / n - (Ip > 0 ? M * b.x / Ip : 0);
      b.Fx = fx; b.Fy = fy; b.F = Math.hypot(fx, fy);
    });
    const crit = bolts.reduce((a, b) => b.F > a.F ? b : a, bolts[0]);
    return { bolts, n, Ip, M, crit, Fmax: crit.F };
  }

  function boltGroup(p) {
    const gr = GRADES[p.grade], st = STEEL[p.steel], As = BOLTS[p.d], d0 = holeD(p.d);
    const pg = polar(p.nr, p.nc, p.p, p.g, p.V, p.ecc);
    const fyP = plateFy(p.steel, p.t);
    const Ntot = Math.max(0, p.N || 0);
    if (p.code === 'bs') {
      const Ps = gr.ps * As * p.planes / 1e3;
      const kbs = 1;
      const Pbb = p.d * p.t * gr.pbb / 1e3;
      const Pbs = Math.min(kbs * p.d * p.t * st.pbs, 0.5 * kbs * p.e1 * p.t * st.pbs) / 1e3;
      const Pbear = Math.min(Pbb, Pbs);
      const Pnom = 0.8 * gr.pt * As / 1e3;
      const Ft = Ntot / pg.n;
      const comb = pg.Fmax / Ps + Ft / Pnom;
      /* block shear 6.2.4, one or two lines of bolts */
      const Lv = p.e1 + (p.nr - 1) * p.p, Lt = p.e2 + (p.nc - 1) * p.g, k = p.nc > 1 ? 2.5 : 0.5;
      const Ke = p.steel === 'S355' ? 1.1 : 1.2;
      const Pr = 0.6 * fyP * p.t * (Lv + Ke * (Lt - k * d0)) / 1e3;
      return { code:'bs', pg, As, d0, Ps, Pbb, Pbs, Pbear, Pnom, Ft, comb, Lv, Lt, Pr, fyP,
               u:{ shear: pg.Fmax / Ps, bearing: pg.Fmax / Pbear, tension: Ft / Pnom, combined: comb / 1.4, block: p.V / Pr } };
    }
    const FvRd = gr.av * gr.fub * As / GM2 / 1e3 * p.planes;
    /* bearing, the critical corner bolt is an end and edge bolt */
    const ad = Math.min(p.e1 / (3 * d0), p.nr > 1 ? p.p / (3 * d0) - 0.25 : Infinity);
    const ab = Math.min(ad, gr.fub / st.fu, 1);
    const k1 = Math.min(2.8 * p.e2 / d0 - 1.7, p.nc > 1 ? 1.4 * p.g / d0 - 1.7 : Infinity, 2.5);
    const FbRd = Math.max(0, k1) * ab * st.fu * p.d * p.t / GM2 / 1e3;
    const FtRd = 0.9 * gr.fub * As / GM2 / 1e3;
    const Ft = Ntot / pg.n;
    const comb = pg.Fmax / FvRd + Ft / (1.4 * FtRd);
    /* block tearing 3.10.2, eccentric form when the group carries a moment */
    const Ant = (p.e2 + (p.nc - 1) * p.g - (p.nc - 0.5) * d0) * p.t;
    const Anv = (p.e1 + (p.nr - 1) * p.p - (p.nr - 0.5) * d0) * p.t;
    const ecc = Math.abs(p.ecc) > 1e-9;
    const Veff = ((ecc ? 0.5 : 1) * st.fu * Ant / GM2 + fyP * Anv / Math.sqrt(3) / GM0) / 1e3;
    /* T-stub in tension, Table 6.2 */
    const Mpl = 0.25 * p.leff * p.tp * p.tp * plateFy(p.steel, p.tp) / GM0 / 1e6;   // kN·m
    const nEff = Math.min(p.nT, 1.25 * p.mT);
    const sumFt = FtRd * (p.boltsT || 2);
    const FT1 = 4 * Mpl * 1e3 / p.mT;
    const FT2 = (2 * Mpl * 1e3 + nEff * sumFt) / (p.mT + nEff);
    const FT3 = sumFt;
    const FT = Math.min(FT1, FT2, FT3);
    const mode = FT === FT1 ? 1 : FT === FT2 ? 2 : 3;
    return { code:'ec3', pg, As, d0, FvRd, ad, ab, k1, FbRd, FtRd, Ft, comb, Ant, Anv, Veff, fyP,
             Mpl, nEff, FT1, FT2, FT3, FT, mode,
             u:{ shear: pg.Fmax / FvRd, bearing: pg.Fmax / FbRd, tension: Ft / FtRd, combined: comb,
                 block: p.V / Veff, tstub: Ntot / FT } };
  }

  /* fillet weld resistance per mm at angle theta to the weld axis */
  function weldPerMm(code, steel, a, theta) {
    const st = STEEL[steel];
    if (code === 'bs') {
      const K = 1 / Math.sqrt(Math.cos(theta) ** 2 + Math.sin(theta) ** 2 / 1.5625);
      return { w: K * st.pw * a / 1e3, K, base: st.pw * a / 1e3 };
    }
    const k = Math.sqrt(2 * Math.sin(theta) ** 2 + 3 * Math.cos(theta) ** 2);
    return { w: st.fu * a / (st.bw * GM2 * k) / 1e3, K: Math.sqrt(3) / k,
             base: st.fu / Math.sqrt(3) / (st.bw * GM2) * a / 1e3 };
  }

  function weld(p) {
    const a = 0.7 * p.s;
    const L = p.L, b = p.b;
    const Lw = 2 * L;
    const Ip = 2 * (L ** 3 / 12 + L * (b / 2) ** 2);   // mm^3, polar moment of the lines
    const M = p.V * p.ecc;                               // kN·mm
    /* the worst point is the top or bottom of the weld furthest from the load */
    const x = b / 2, y = L / 2;
    const wx = M * y / Ip, wy = p.V / Lw + M * x / Ip;   // kN per mm
    const w = Math.hypot(wx, wy);
    const theta = Math.atan2(Math.abs(wx), Math.abs(wy));   // from the vertical weld axis
    const r = weldPerMm(p.code, p.steel, a, theta);
    const simple = weldPerMm(p.code, p.steel, a, 0);
    return { a, Lw, Ip, M, wx, wy, w, theta, Rd: r.w, K: r.K, simple: simple.w, util: w / r.w, utilSimple: w / simple.w };
  }

  function basePlate(p) {
    const col = SE.section('UC', p.colIdx);
    const fyp = plateFy(p.steel, p.tp);
    const ratio = Math.min(Math.max(p.padRatio, 1), 9);
    const fjd = p.code === 'bs' ? 0.6 * (p.fck + 5) : (2 / 3) * (0.85 * p.fck / 1.5) * Math.sqrt(ratio);
    const c = p.code === 'bs' ? p.tp / Math.sqrt(3 * fjd / fyp) : p.tp * Math.sqrt(fyp / (3 * fjd * GM0));
    /* effective area around the I section footprint, clipped to the plate */
    const ce = Math.min(c, (p.B - col.b) / 2, (p.D - col.h) / 2);
    const fl = (col.b + 2 * Math.min(c, (p.B - col.b) / 2)) * (col.tf + Math.min(c, (p.D - col.h) / 2) + Math.min(c, (col.h - 2 * col.tf) / 2));
    const webH = Math.max(0, col.h - 2 * col.tf - 2 * c);
    const Aeff = 2 * fl + webH * (col.tw + 2 * Math.min(c, (p.B - col.tw) / 2));
    const NjRd = Aeff * fjd / 1e3;
    /* the thickness that would just carry NEd, by bisection on tp */
    let lo = 1, hi = 200;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const r = basePlateArea(col, p, mid, fjd);
      if (r * fjd / 1e3 >= p.NEd) hi = mid; else lo = mid;
    }
    return { col, fyp, fjd, c, ce, Aeff, NjRd, tpReq: hi, util: p.NEd / NjRd, webH, Afoot: col.A };
  }
  function basePlateArea(col, p, tp, fjd) {
    const fyp = plateFy(p.steel, tp);
    const c = p.code === 'bs' ? tp / Math.sqrt(3 * fjd / fyp) : tp * Math.sqrt(fyp / (3 * fjd * GM0));
    const fl = (col.b + 2 * Math.min(c, (p.B - col.b) / 2)) * (col.tf + Math.min(c, (p.D - col.h) / 2) + Math.min(c, (col.h - 2 * col.tf) / 2));
    const webH = Math.max(0, col.h - 2 * col.tf - 2 * c);
    return 2 * fl + webH * (col.tw + 2 * Math.min(c, (p.B - col.tw) / 2));
  }

  return { boltGroup, polar, weld, weldPerMm, basePlate, BOLTS, GRADES, STEEL, holeD, GM0, GM2 };
})();
if (typeof module !== 'undefined') module.exports = ConnEngine;
