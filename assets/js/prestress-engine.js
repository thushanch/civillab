/* CivilLab · PrestressEngine
   Simply supported prestressed concrete beam, checked at midspan.
   Units: section in mm (from SectionEngine), span in m, loads in kN/m,
   forces in kN, stresses in MPa, Ep in MPa, strains as plain numbers.
   Signs: stress COMPRESSION POSITIVE, the usual prestressed convention, which
   flips the suite's tension positive rule. Eccentricity e is measured DOWN
   from the centroid, so a tendon below the centroid has e > 0.
   Losses follow EN 1992-1-1 5.10 for both codes:
     friction 5.10.5.2  dP = Pmax (1 - exp(-mu(theta + k x))) to midspan
     draw-in            lset = sqrt(slip Ep Ap / p), p the friction loss per mm
     elastic 5.10.5.1   Ap (Ep/Ecm(t)) sigma_c at the tendon, halved when post
                        tensioned tendons are stressed one after another
     long term 5.10.6   eq 5.46 with relaxation from eq 3.29 (class 2) at
                        500 000 hours
   The code toggle changes the allowable stresses:
     EC2  transfer 0.6 fck(t) and fctm(t), service 0.6 fck and zero or fctm
     BS 8110 4.3.5 and 4.3.4  transfer 0.5 fci and 1.0 or 0.45/0.36 sqrt fci,
                        service 0.33 fcu and zero or 0.45/0.36 sqrt fcu */
const PrestressEngine = (() => {
  const SE = (typeof SectionEngine !== 'undefined') ? SectionEngine : require('./section-engine.js');

  const Ecm = fck => 22000 * Math.pow((fck + 8) / 10, 0.3);
  const fctm = fck => 0.3 * Math.pow(fck, 2 / 3);

  function limits(code, type, fck, fckt, mode) {
    if (code === 'bs') {
      const fcu = fck + 5, fci = fckt + 5, k = type === 'pre' ? 0.45 : 0.36;
      return { trC: 0.5 * fci, trT: mode === 'zero' ? -1.0 : -k * Math.sqrt(fci),
               svC: 0.33 * fcu, svT: mode === 'zero' ? 0 : -k * Math.sqrt(fcu) };
    }
    return { trC: 0.6 * fckt, trT: -fctm(fckt), svC: 0.6 * fck, svT: mode === 'zero' ? 0 : -fctm(fck) };
  }

  /* stress at the top (s = -1) or bottom (s = +1) fibre, compression positive */
  function fibre(P, e, M, sec, s) {
    const Z = s < 0 ? sec.Ztop : sec.Zbot;
    return P * 1e3 / sec.A + s * P * 1e3 * e / Z - s * M * 1e6 / Z;
  }

  function losses(p, sec, Mg, Mqp) {
    const Ap = p.Ap, Ep = p.Ep, L = p.L * 1000;
    const Pmax = p.Pj;
    let dFric = 0, dSet = 0, lset = 0, theta = 0;
    if (p.type === 'post') {
      const drape = p.e - p.eEnd;
      theta = 4 * Math.abs(drape) / L;
      dFric = Pmax * (1 - Math.exp(-p.mu * (theta + p.k * p.L / 2)));
      const pPer = dFric * 1e3 / (L / 2);              // N per mm
      /* draw-in reflects the friction line. Past the far end the whole
         tendon loses force and the reflected line shifts down uniformly
         until its area still equals slip x Ep x Ap */
      const area = p.slip * Ep * Ap;
      lset = pPer > 0 ? Math.sqrt(area / pPer) : Infinity;
      if (!isFinite(lset)) dSet = area / L / 1e3;
      else if (lset <= L / 2) dSet = 0;
      else if (lset <= L) dSet = 2 * pPer * (lset - L / 2) / 1e3;
      else dSet = (pPer * L + (area - pPer * L * L) / L) / 1e3;
    }
    const P1 = Pmax - dFric - dSet;
    const Ect = Ecm(p.fckt);
    const scp = P1 * 1e3 / sec.A + P1 * 1e3 * p.e * p.e / sec.I - Mg * 1e6 * p.e / sec.I;
    const dEl = Ap * (Ep / Ect) * scp * (p.type === 'post' ? 0.5 : 1) / 1e3;
    const P0 = P1 - dEl;
    /* long term, eq 5.46 */
    const Ec = Ecm(p.fck);
    const spi = P0 * 1e3 / Ap;
    const mu = spi / p.fpk;
    const dRel = spi * 0.66 * p.rho1000 * Math.exp(9.1 * mu) * Math.pow(500, 0.75 * (1 - mu)) * 1e-5;
    const scQP = P0 * 1e3 / sec.A + P0 * 1e3 * p.e * p.e / sec.I - Mqp * 1e6 * p.e / sec.I;
    const tS = p.ecs * Ep, tR = 0.8 * dRel, tC = (Ep / Ec) * p.phi * scQP;
    const den = 1 + (Ep / Ec) * (Ap / sec.A) * (1 + sec.A * p.e * p.e / sec.I) * (1 + 0.8 * p.phi);
    const dsp = (tS + tR + tC) / den;
    const dLong = Ap * dsp / 1e3;
    const share = v => (tS + tR + tC) !== 0 ? dLong * v / (tS + tR + tC) : 0;
    const Pe = P0 - dLong;
    return { Pmax, theta, dFric, lset, dSet, P1, Ect, scp, dEl, P0, Ec, spi, mu, dRel, scQP, den, dsp,
             dShr: share(tS), dRelx: share(tR), dCreep: share(tC), dLong, Pe, eta: Pe / P0,
             immediate: Pmax - P0, total: Pmax - Pe };
  }

  /* feasible region of (e, y = 1/P0) as a polygon, clipped from a box */
  function magnel(sec, Mg, Ms, eta, lim, box) {
    const cons = [];
    const add = (s, M, k, fmin, fmax, stage) => {
      const Z = s < 0 ? sec.Ztop : sec.Zbot;
      const a = k * 1e3 / sec.A, b = k * 1e3 * s / Z, m = -s * M * 1e6 / Z;
      cons.push({ a, b, c: m - fmin, tag: `${stage} ${s < 0 ? 'top' : 'bottom'} tension` });
      cons.push({ a: -a, b: -b, c: -(m - fmax), tag: `${stage} ${s < 0 ? 'top' : 'bottom'} compression` });
    };
    add(-1, Mg, 1, lim.trT, lim.trC, 'transfer');
    add(+1, Mg, 1, lim.trT, lim.trC, 'transfer');
    add(-1, Ms, eta, lim.svT, lim.svC, 'service');
    add(+1, Ms, eta, lim.svT, lim.svC, 'service');
    let poly = [[box.e0, box.y0], [box.e1, box.y0], [box.e1, box.y1], [box.e0, box.y1]];
    for (const c of cons) {
      const f = q => c.a + c.b * q[0] + c.c * q[1];
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
        if (fa >= 0) out.push(A);
        if ((fa >= 0) !== (fb >= 0)) {
          const t = fa / (fa - fb);
          out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]);
        }
      }
      poly = out;
      if (!poly.length) break;
    }
    return { cons, poly };
  }

  /* the P0 range that satisfies every limit at one eccentricity */
  function pRange(cons, e) {
    let ylo = 0, yhi = Infinity, ok = true;
    for (const c of cons) {
      const r = c.a + c.b * e;
      if (Math.abs(c.c) < 1e-15) { if (r < 0) ok = false; continue; }
      if (c.c > 0) ylo = Math.max(ylo, -r / c.c); else yhi = Math.min(yhi, r / -c.c);
    }
    ok = ok && ylo <= yhi;
    return { ok, Pmin: isFinite(yhi) ? 1 / yhi : 0, Pmax: ylo > 0 ? 1 / ylo : Infinity };
  }

  function solve(inp) {
    const sec = SE.build(inp.shape, inp.dims);
    const wg = sec.A * 25 / 1e6;
    const L = inp.L;
    const Mg = wg * L * L / 8;
    const Ms = (wg + inp.wsdl + inp.wq) * L * L / 8;
    const Mqp = (wg + inp.wsdl + inp.psi2 * inp.wq) * L * L / 8;
    const lim = limits(inp.code, inp.type, inp.fck, inp.fckt, inp.mode);
    const ls = losses(inp, sec, Mg, Mqp);
    const st = {
      trTop: fibre(ls.P0, inp.e, Mg, sec, -1), trBot: fibre(ls.P0, inp.e, Mg, sec, +1),
      svTop: fibre(ls.Pe, inp.e, Ms, sec, -1), svBot: fibre(ls.Pe, inp.e, Ms, sec, +1) };
    const util = (sg, fmin, fmax) => sg >= 0 ? sg / fmax : (fmin < 0 ? sg / fmin : Infinity);
    const u = { trTop: util(st.trTop, lim.trT, lim.trC), trBot: util(st.trBot, lim.trT, lim.trC),
                svTop: util(st.svTop, lim.svT, lim.svC), svBot: util(st.svBot, lim.svT, lim.svC) };
    const spmax = Math.min(0.8 * inp.fpk, 0.9 * 0.88 * inp.fpk);
    const jack = inp.Pj * 1e3 / inp.Ap / spmax;
    const eMax = sec.ybot - (inp.cp || 100);
    const box = { e0: -sec.ytop, e1: sec.ybot, y0: 0, y1: 4 / Math.max(ls.P0, 1) };
    const mg = magnel(sec, Mg, Ms, ls.eta, lim, box);
    const pr = pRange(mg.cons, inp.e);
    return { sec, wg, Mg, Ms, Mqp, lim, ls, st, u, spmax, jack, eMax, mg, box, pr };
  }

  return { solve, losses, magnel, pRange, limits, fibre, Ecm, fctm };
})();
if (typeof module !== 'undefined') module.exports = PrestressEngine;
