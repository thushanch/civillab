/* CivilLab · MixEngine
   Normal weight concrete mix design by the ACI 211.1 absolute volume method.
   Units: MPa cylinder strength, kg per cubic metre, mm for slump and
   aggregate size, moisture and absorption as fractions.
   Tables, non air entrained concrete:
     6.3.3  mixing water and entrapped air by slump and maximum aggregate size
     6.3.4a water to cement ratio by 28 day cylinder strength
     6.3.6  dry rodded coarse aggregate volume by size and sand fineness modulus
   Target mean strength:
     EN 206 / BS 8500 margin   fm = fck + 1.64 s
     ACI 318                   fcr = max(fc + 1.34 s, fc + 2.33 s - 3.45) up to 35 MPa,
                               fcr = max(fc + 1.34 s, 0.90 fc + 2.33 s) above 35 MPa
   The w/c is the smaller of the strength value and the durability limit, and
   the cement content is raised to any durability minimum. The fine aggregate
   fills whatever volume is left. Cement relative density 3.15. */
const MixEngine = (() => {
  const SIZES = [9.5, 12.5, 19, 25, 37.5, 50];
  const WATER = { '25-50':[207, 199, 190, 179, 166, 154], '75-100':[228, 216, 205, 193, 181, 169],
                  '150-175':[243, 228, 216, 202, 190, 178] };
  const AIR = [3, 2.5, 2, 1.5, 1, 0.5];
  const WC = [[15, 0.79], [20, 0.69], [25, 0.61], [30, 0.54], [35, 0.47], [40, 0.42]];
  const FMS = [2.4, 2.6, 2.8, 3.0];
  const CA = [[0.50, 0.48, 0.46, 0.44], [0.59, 0.57, 0.55, 0.53], [0.66, 0.64, 0.62, 0.60],
              [0.71, 0.69, 0.67, 0.65], [0.75, 0.73, 0.71, 0.69], [0.78, 0.76, 0.74, 0.72]];
  const SG_CEM = 3.15;

  function target(method, fck, sd) {
    if (method === 'aci') {
      const a = fck + 1.34 * sd;
      const b = fck <= 35 ? fck + 2.33 * sd - 3.45 : 0.9 * fck + 2.33 * sd;
      return { fm: Math.max(a, b), margin: Math.max(a, b) - fck, eq: a >= b ? '1.34s' : (fck <= 35 ? '2.33s − 3.45' : '0.90fc + 2.33s') };
    }
    return { fm: fck + 1.64 * sd, margin: 1.64 * sd, eq: '1.64s' };
  }

  /* linear in the table, extended on the end slopes, flagged when outside */
  function wcFor(f) {
    const T = WC;
    let i = 1;
    while (i < T.length - 1 && f > T[i][0]) i++;
    const [f0, w0] = T[i - 1], [f1, w1] = T[i];
    return { wc: w0 + (f - f0) / (f1 - f0) * (w1 - w0), outside: f < T[0][0] || f > T[T.length - 1][0] };
  }
  function strengthFor(wc) {
    const T = WC.slice().reverse();     // rising w/c
    const P = T.map(p => [p[1], p[0]]);
    let i = 1;
    while (i < P.length - 1 && wc > P[i][0]) i++;
    const [w0, f0] = P[i - 1], [w1, f1] = P[i];
    return f0 + (wc - w0) / (w1 - w0) * (f1 - f0);
  }

  function sizeIndex(d) { const i = SIZES.indexOf(d); return i < 0 ? 4 : i; }

  function water(slump, dmax) {
    const i = sizeIndex(dmax);
    return { W: WATER[slump][i], air: AIR[i] };
  }

  function coarseVol(dmax, FM) {
    const row = CA[sizeIndex(dmax)];
    const f = Math.max(2.4, Math.min(3.0, FM));
    let j = 1;
    while (j < FMS.length - 1 && f > FMS[j]) j++;
    return row[j - 1] + (f - FMS[j - 1]) / (FMS[j] - FMS[j - 1]) * (row[j] - row[j - 1]);
  }

  function solve(inp) {
    const t = target(inp.method, inp.fck, inp.sd);
    const ws = wcFor(t.fm);
    const wcStr = ws.wc;
    const wcAuto = Math.min(wcStr, inp.wcMax);
    const wc = inp.manual ? inp.wcUser : wcAuto;
    const wt = water(inp.slump, inp.dmax);
    const W = wt.W;
    const Cstr = W / wc;
    const C = Math.max(Cstr, inp.cMin);
    const wcEff = W / C;
    const Vca = coarseVol(inp.dmax, inp.FM);
    const CAm = Vca * inp.druw;
    const vol = { water: W / 1000, cement: C / (SG_CEM * 1000), coarse: CAm / (inp.sgCA * 1000), air: wt.air / 100 };
    vol.fine = 1 - vol.water - vol.cement - vol.coarse - vol.air;
    const FAm = vol.fine * inp.sgFA * 1000;
    const feasible = vol.fine > 0.15;
    /* batch weights with the aggregates at their stockpile moisture */
    const mc = inp.mcCA || 0, ac = inp.abCA || 0, mf = inp.mcFA || 0, af = inp.abFA || 0;
    const field = { cement: C, coarse: CAm * (1 + mc), fine: FAm * (1 + mf),
                    water: W - CAm * (mc - ac) - FAm * (mf - af) };
    const density = W + C + CAm + FAm;
    const fExp = strengthFor(wcEff);
    return { t, wcStr, wcOutside: ws.outside, wcAuto, wc, wcEff, governedBy: inp.manual ? 'hand' : (wcStr <= inp.wcMax ? 'strength' : 'durability'),
             W, air: wt.air, Cstr, C, cementRaised: C > Cstr + 1e-9, Vca, CA: CAm, FA: FAm, vol, feasible, field, density,
             ratio: { fine: FAm / C, coarse: CAm / C, water: wcEff }, perBag: 50 / C, fExp,
             strengthUtil: t.fm / fExp, durUtil: wcEff / inp.wcMax, cementUtil: inp.cMin / C };
  }

  return { solve, target, wcFor, strengthFor, water, coarseVol, SIZES, WC, FMS, SG_CEM };
})();
if (typeof module !== 'undefined') module.exports = MixEngine;
