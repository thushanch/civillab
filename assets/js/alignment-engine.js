/* CivilLab · AlignmentEngine
   Highway geometric design, AASHTO A Policy on Geometric Design (2011), metric.
   Units: speed V in km/h, lengths in m, grades in per cent (+ uphill in the
   direction of travel), superelevation and friction as decimals, angles in
   degrees in the inputs and radians inside.
   Stopping sight distance  SSD = 0.278 V t + V^2 / (254 (a/9.81 + G))
   Minimum radius           Rmin = V^2 / (127 (e + f))
   Sightline offset         M = R (1 - cos(S / 2R)) when S <= Lc,
                            M = R (1 - cos(Lc/2R)) + (S - Lc)/2 sin(Lc/2R) when S > Lc
   Crest curve, eye 1.08 m and object 0.60 m:
                            L = A S^2 / 658 (S < L),  L = 2S - 658/A (S > L)
   Sag curve, headlight 0.6 m and 1 degree beam:
                            L = A S^2 / (120 + 3.5S) (S < L),  L = 2S - (120 + 3.5S)/A (S > L)
   A = |g2 - g1| in per cent. */
const AlignmentEngine = (() => {
  const FMAX = [[15, .40], [20, .35], [30, .28], [40, .23], [50, .19], [60, .17], [70, .15],
                [80, .14], [90, .13], [100, .12], [110, .11], [120, .09], [130, .08]];
  function fmax(V) {
    if (V <= FMAX[0][0]) return FMAX[0][1];
    for (let i = 1; i < FMAX.length; i++)
      if (V <= FMAX[i][0]) return FMAX[i - 1][1] + (V - FMAX[i - 1][0]) / (FMAX[i][0] - FMAX[i - 1][0]) * (FMAX[i][1] - FMAX[i - 1][1]);
    return FMAX[FMAX.length - 1][1];
  }

  function ssd(V, t, a, Gpct) {
    const react = 0.278 * V * t;
    const brake = V * V / (254 * (a / 9.81 + Gpct / 100));
    return { react, brake, S: react + brake };
  }

  const rmin = (V, e, f) => V * V / (127 * (e + f));

  function hso(R, S, Lc) {
    if (S <= Lc) return R * (1 - Math.cos(S / (2 * R)));
    return R * (1 - Math.cos(Lc / (2 * R))) + (S - Lc) / 2 * Math.sin(Lc / (2 * R));
  }
  /* sight distance available for an obstruction M from the lane centre */
  function sightFromOffset(R, M, Lc) {
    const lo = 0, hi = 4000;
    let a = lo, b = hi;
    if (hso(R, hi, Lc) < M) return hi;
    for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (hso(R, m, Lc) < M) a = m; else b = m; }
    return (a + b) / 2;
  }

  function crestL(A, S) {
    if (A <= 0) return 0;
    const L1 = A * S * S / 658;
    return L1 >= S ? L1 : Math.max(0, 2 * S - 658 / A);
  }
  function sagL(A, S) {
    if (A <= 0) return 0;
    const L1 = A * S * S / (120 + 3.5 * S);
    return L1 >= S ? L1 : Math.max(0, 2 * S - (120 + 3.5 * S) / A);
  }
  function crestS(A, L) {
    if (A <= 0) return Infinity;
    const S1 = Math.sqrt(658 * L / A);
    return S1 <= L ? S1 : (L + 658 / A) / 2;
  }
  function sagS(A, L) {
    if (A <= 0) return Infinity;
    const S1 = (3.5 * L + Math.sqrt(12.25 * L * L + 480 * A * L)) / (2 * A);
    if (S1 <= L) return S1;
    return 2 * A - 3.5 > 0 ? (A * L + 120) / (2 * A - 3.5) : Infinity;
  }

  function solve(inp) {
    const sd = ssd(inp.V, inp.t, inp.a, inp.G);
    const f = inp.fAuto ? fmax(inp.V) : inp.f;
    const Rm = rmin(inp.V, inp.e, f);
    const Lc = inp.R * inp.delta * Math.PI / 180;
    const Mneed = hso(inp.R, sd.S, Lc);
    const Savail = sightFromOffset(inp.R, inp.M, Lc);
    const A = Math.abs(inp.g2 - inp.g1);
    const crest = inp.g2 < inp.g1;
    const Lmin = crest ? crestL(A, sd.S) : sagL(A, sd.S);
    const Sv = crest ? crestS(A, inp.L) : sagS(A, inp.L);
    return { sd, f, Rm, Lc, Mneed, Savail, A, crest, Lmin, Sv, K: A > 0 ? inp.L / A : Infinity, Kmin: A > 0 ? Lmin / A : 0,
             u:{ radius: Rm / inp.R, hsight: sd.S / Savail, vsight: inp.L > 0 ? Lmin / inp.L : (Lmin > 0 ? Infinity : 0) } };
  }

  return { solve, ssd, rmin, fmax, hso, sightFromOffset, crestL, sagL, crestS, sagS };
})();
if (typeof module !== 'undefined') module.exports = AlignmentEngine;
