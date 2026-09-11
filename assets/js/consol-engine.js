/* CivilLab · consol-engine.js
   Terzaghi one dimensional consolidation.

   Physics
   - excess pore pressure obeys du/dt = cv d2u/dz2
   - with a uniform initial excess pressure u0 the solution is
       u(Z,T) = sum over m of (2 u0 / M) sin(M Z) exp(-M^2 T),  M = (2m+1) pi/2
     where Z = z / Hdr and T = cv t / Hdr^2
   - the same series covers both drainage cases, only Hdr and the range of Z
     change. Double drainage has Hdr = H/2 and Z runs 0 to 2, so sin(2M) = 0
     puts u = 0 at both faces. Single drainage has Hdr = H and Z runs 0 to 1,
     where cos(M) = 0 makes the base impermeable.
   - average degree of consolidation U = 1 - sum of (2/M^2) exp(-M^2 T)
   - primary settlement by the compression index method
       Sc = H Cc/(1+e0) log10((s0 + ds)/s0) for a normally consolidated clay,
     and in two parts through the preconsolidation pressure for an
     overconsolidated one, the recompression leg using Cs
   - or by the coefficient of volume compressibility, Sc = mv ds H
   - settlement at time t is S(t) = U(T) Sc
   - secondary compression after primary is Ss = H Calpha/(1+ep) log10(t2/t1)

   Units and conventions
   - lengths in metres, stresses in kPa, cv in m2/s, time in seconds
   - mv in m2/kN, settlement returned in metres
   - z is measured DOWN from the top of the clay layer
   - compression positive, which is the soil convention
*/
const ConsolEngine = (() => {

  const TERMS = 200;                       // plenty, the series converges fast

  /* M = (2m+1) pi/2 */
  const Mof = m => (2 * m + 1) * Math.PI / 2;

  /* average degree of consolidation from the time factor */
  function Uavg(T) {
    if (!(T > 0)) return 0;
    let sum = 0;
    for (let m = 0; m < TERMS; m++) {
      const M = Mof(m), e = Math.exp(-M * M * T);
      if (e < 1e-18 && m > 2) break;
      sum += (2 / (M * M)) * e;
    }
    return Math.min(1, Math.max(0, 1 - sum));
  }

  /* the standard textbook approximations, kept so the app can show them */
  function TvApprox(U) {
    if (U <= 0) return 0;
    if (U < 0.6) return Math.PI / 4 * U * U;
    return 1.781 - 0.933 * Math.log(100 - U * 100) / Math.LN10;
  }

  /* time factor from a target degree, inverted from the true series */
  function Tv(U) {
    if (U <= 0) return 0;
    if (U >= 1) return Infinity;
    let lo = 1e-8, hi = 3;
    while (Uavg(hi) < U && hi < 1e4) hi *= 2;
    for (let i = 0; i < 200; i++) {
      const mid = 0.5 * (lo + hi);
      if (Uavg(mid) < U) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  /* excess pore pressure ratio u/u0 at normalised depth Z and time factor T */
  function uRatio(Z, T) {
    if (!(T > 0)) return 1;
    let sum = 0;
    for (let m = 0; m < TERMS; m++) {
      const M = Mof(m), e = Math.exp(-M * M * T);
      if (e < 1e-18 && m > 2) break;
      sum += (2 / M) * Math.sin(M * Z) * e;
    }
    return sum;
  }

  /* one isochrone, n + 1 points down the layer */
  function isochrone(T, n, twoWay) {
    const Zmax = twoWay ? 2 : 1;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const Z = Zmax * i / n;
      out.push({ Z, z: Z / Zmax, u: uRatio(Z, T) });   // z is 0 to 1 down the layer
    }
    return out;
  }

  /* primary settlement, either method */
  function settlement(p) {
    const H = +p.H, ds = +p.ds;
    if (p.method === 'mv') return { Sc: (+p.mv) * ds * H, legs: [{ name:'mv Δσ H', S:(+p.mv) * ds * H }] };
    const e0 = +p.e0, Cc = +p.Cc, Cs = p.Cs == null ? +p.Cc / 5 : +p.Cs;
    const s0 = Math.max(1e-6, +p.s0), sp = Math.max(s0, +p.sp || s0);
    const s1 = s0 + ds;
    const L = Math.log(10);
    const legs = [];
    let Sc = 0;
    if (s1 <= sp + 1e-9) {
      // stays inside the overconsolidated range, recompression only
      const S = H * Cs / (1 + e0) * Math.log(s1 / s0) / L;
      legs.push({ name:'recompression, Cs', S }); Sc = S;
    } else if (s0 >= sp - 1e-9) {
      // already normally consolidated
      const S = H * Cc / (1 + e0) * Math.log(s1 / s0) / L;
      legs.push({ name:'virgin compression, Cc', S }); Sc = S;
    } else {
      const S1 = H * Cs / (1 + e0) * Math.log(sp / s0) / L;
      const S2 = H * Cc / (1 + e0) * Math.log(s1 / sp) / L;
      legs.push({ name:'recompression to σp′, Cs', S:S1 });
      legs.push({ name:'virgin compression beyond σp′, Cc', S:S2 });
      Sc = S1 + S2;
    }
    return { Sc, legs, s1, sp, overconsolidated: sp > s0 + 1e-9 };
  }

  /* secondary compression after the end of primary */
  function secondary(H, Ca, ep, t, tp) {
    if (!(Ca > 0) || !(t > tp) || !(tp > 0)) return 0;
    return H * Ca / (1 + ep) * Math.log(t / tp) / Math.LN10;
  }

  function solve(p) {
    const H = +p.H, cv = +p.cv, ds = +p.ds;
    const twoWay = p.drainage !== 'one';
    const Hdr = twoWay ? H / 2 : H;
    const t = Math.max(0, +p.t || 0);
    const T = Hdr > 0 && cv > 0 ? cv * t / (Hdr * Hdr) : 0;
    const U = Uavg(T);
    const st = settlement(p);
    const tFor = U2 => Tv(U2) * Hdr * Hdr / (cv > 0 ? cv : Infinity);
    const t50 = tFor(0.5), t90 = tFor(0.9), t95 = tFor(0.95);
    const Ss = secondary(H, +p.Ca || 0, +p.e0 || 0, t, t90);
    return {
      H, cv, Hdr, twoWay, ds, t, T, U,
      Sc: st.Sc, legs: st.legs, overconsolidated: st.overconsolidated,
      St: U * st.Sc,
      Ss, Stotal: U * st.Sc + Ss,
      t50, t90, t95,
      Tv50: Tv(0.5), Tv90: Tv(0.9),
      isochrone: n => isochrone(T, n || 40, twoWay),
      uAtDepth: zFrac => uRatio((twoWay ? 2 : 1) * zFrac, T),
      curve: n => {
        // settlement against log time, from 1 percent to 99.9 percent
        const out = [];
        const tA = Tv(0.01) * Hdr * Hdr / cv, tB = Tv(0.999) * Hdr * Hdr / cv;
        const la = Math.log(tA) / Math.LN10, lb = Math.log(tB) / Math.LN10;
        for (let i = 0; i <= (n || 120); i++) {
          const lt = la + (lb - la) * i / (n || 120);
          const tt = Math.pow(10, lt);
          const TT = cv * tt / (Hdr * Hdr);
          out.push({ t: tt, U: Uavg(TT), S: Uavg(TT) * st.Sc });
        }
        return out;
      }
    };
  }

  return { Uavg, Tv, TvApprox, uRatio, isochrone, settlement, secondary, solve };
})();
if (typeof module !== 'undefined') module.exports = ConsolEngine;
