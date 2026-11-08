/* CivilLab · DOSagEngine
   River self purification by the Streeter-Phelps model.
   Units: flow in m3/s, concentrations in mg/L, temperature in deg C, rates per
   day (base e), velocity in m/s, depth in m, distance in km.
   Mixing at the outfall by mass balance of flow, BOD, DO and temperature.
   BOD5 is converted to ultimate BOD by L = BOD5 / (1 - exp(-5 kd20)).
   Saturation DO from the APHA polynomial in absolute temperature.
   Rates corrected by kd = kd20 1.047^(T-20) and kr = kr20 1.024^(T-20).
   O'Connor and Dobbins reaeration kr20 = 3.93 u^0.5 / H^1.5 when chosen.
   Deficit  D(t) = kd L0/(kr - kd) (exp(-kd t) - exp(-kr t)) + D0 exp(-kr t)
   Critical tc = ln[(kr/kd)(1 - D0 (kr - kd)/(kd L0))] / (kr - kd)
            Dc = (kd/kr) L0 exp(-kd tc)
   with the kr = kd limits D = (kd L0 t + D0) exp(-kd t), tc = (1 - D0/L0)/kd.
   When tc comes out negative the deficit only falls, so the worst point is the
   outfall itself. */
const DOSagEngine = (() => {
  function dosat(T) {
    const K = T + 273.15;
    return Math.exp(-139.34411 + 1.575701e5 / K - 6.642308e7 / K ** 2 + 1.2438e10 / K ** 3 - 8.621949e11 / K ** 4);
  }
  const kAt = (k20, theta, T) => k20 * Math.pow(theta, T - 20);
  const oconnor = (u, H) => 3.93 * Math.sqrt(u) / Math.pow(H, 1.5);
  const ultimate = (bod5, kd20) => bod5 / (1 - Math.exp(-5 * kd20));

  function deficit(t, kd, kr, L0, D0) {
    if (Math.abs(kr - kd) < 1e-9) return (kd * L0 * t + D0) * Math.exp(-kd * t);
    return kd * L0 / (kr - kd) * (Math.exp(-kd * t) - Math.exp(-kr * t)) + D0 * Math.exp(-kr * t);
  }

  function critical(kd, kr, L0, D0) {
    let tc;
    if (Math.abs(kr - kd) < 1e-9) tc = (1 - D0 / L0) / kd;
    else {
      const arg = (kr / kd) * (1 - D0 * (kr - kd) / (kd * L0));
      tc = arg > 0 ? Math.log(arg) / (kr - kd) : 0;
    }
    if (!(tc > 0)) return { tc: 0, Dc: D0, atOutfall: true };
    return { tc, Dc: kd / kr * L0 * Math.exp(-kd * tc), atOutfall: false };
  }

  function mix(inp) {
    const Q = inp.Qw + inp.Qr;
    const Lw = inp.bod5 ? ultimate(inp.Lw, inp.kd20) : inp.Lw;
    const Lr = inp.bod5 ? ultimate(inp.Lr, inp.kd20) : inp.Lr;
    return { Q, Lw, Lr, L0: (inp.Qw * Lw + inp.Qr * Lr) / Q, DO0: (inp.Qw * inp.DOw + inp.Qr * inp.DOr) / Q,
             T: (inp.Qw * inp.Tw + inp.Qr * inp.Tr) / Q };
  }

  function run(inp) {
    const m = mix(inp);
    const sat = dosat(m.T);
    const D0 = Math.max(0, sat - m.DO0);
    const kr20 = inp.od ? oconnor(inp.u, inp.H) : inp.kr20;
    const kd = kAt(inp.kd20, 1.047, m.T), kr = kAt(kr20, 1.024, m.T);
    const c = critical(kd, kr, m.L0, D0);
    const toKm = t => inp.u * t * 86400 / 1000;
    return { m, sat, D0, kr20, kd, kr, f: kr / kd, tc: c.tc, Dc: c.Dc, atOutfall: c.atOutfall,
             DOmin: sat - c.Dc, xc: toKm(c.tc), toKm };
  }

  function solve(inp) {
    const r = run(inp);
    /* the largest waste BOD that keeps the minimum DO at the standard */
    let lo = 0, hi = Math.max(inp.Lw * 20, 2000), allow;
    if (run(Object.assign({}, inp, { Lw: 0 })).DOmin < inp.std) allow = 0;
    else {
      for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (run(Object.assign({}, inp, { Lw: mid })).DOmin >= inp.std) lo = mid; else hi = mid; }
      allow = lo;
    }
    const tEnd = Math.max(r.tc * 3, 4);
    const curve = [];
    for (let i = 0; i <= 160; i++) {
      const t = tEnd * i / 160, D = deficit(t, r.kd, r.kr, r.m.L0, r.D0);
      curve.push({ t, x: r.toKm(t), D, DO: r.sat - D, L: r.m.L0 * Math.exp(-r.kd * t) });
    }
    return Object.assign(r, { allow, curve, tEnd, u: { DO: inp.std / Math.max(r.DOmin, 1e-9), load: allow > 0 ? inp.Lw / allow : Infinity } });
  }

  return { solve, run, deficit, critical, dosat, kAt, oconnor, ultimate, mix };
})();
if (typeof module !== 'undefined') module.exports = DOSagEngine;
