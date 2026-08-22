/* ============================================================
   CivilLab · beam-engine.js
   Determinate beam solver shared across apps
   (S1 SFD/BMD Studio now, S4 shear, S6 deflection later).

   Sign conventions
   - x measured from the left end, 0..L, metres
   - Point load P positive downward (kN)
   - UDL w positive downward (kN/m), acting from x1 to x2
   - Applied moment M positive anticlockwise (kN.m)
   - Shear V positive when the left segment resultant acts up,
     so dM/dx = V
   - Bending moment M sagging positive

   Configurations
   - config 'ss': two vertical supports at xA and xB
     (simply supported when xA=0, xB=L, otherwise overhanging)
   - config 'cant': fixed at one end (cantSide 'left' or 'right')
   ============================================================ */
const BeamEngine = (() => {

  function solve(state) {
    const L = state.L;
    const loads = (state.loads || []).filter(ok);
    const forces = [];   // vertical reactions {x, F}, up positive
    const couples = [];  // reaction couples {x, M}, ccw positive
    let reactions;

    // total applied vertical load (down positive)
    let W = 0;
    for (const ld of loads) {
      if (ld.type === 'point') W += ld.P;
      else if (ld.type === 'udl') W += ld.w * (ld.x2 - ld.x1);
    }

    if (state.config === 'ss') {
      const xA = state.xA, xB = state.xB;
      // moments about A (anticlockwise positive):
      // RB(xB-xA) - sum P(a-xA) - sum wLen(xc-xA) + sum Mapp = 0
      let num = 0;
      for (const ld of loads) {
        if (ld.type === 'point') num += ld.P * (ld.a - xA);
        else if (ld.type === 'udl') {
          const len = ld.x2 - ld.x1, xc = (ld.x1 + ld.x2) / 2;
          num += ld.w * len * (xc - xA);
        } else if (ld.type === 'moment') num -= ld.M;
      }
      const RB = num / (xB - xA);
      const RA = W - RB;
      forces.push({ x: xA, F: RA }, { x: xB, F: RB });
      reactions = { type: 'ss', RA, RB, xA, xB };
    } else {
      // cantilever, fixed at x0
      const x0 = state.cantSide === 'right' ? L : 0;
      let m = 0;
      for (const ld of loads) {
        if (ld.type === 'point') m += ld.P * (ld.a - x0);
        else if (ld.type === 'udl') {
          const len = ld.x2 - ld.x1, xc = (ld.x1 + ld.x2) / 2;
          m += ld.w * len * (xc - x0);
        } else if (ld.type === 'moment') m -= ld.M;
      }
      const R = W;      // upward reaction
      const MR = m;     // anticlockwise reaction couple
      forces.push({ x: x0, F: R });
      couples.push({ x: x0, M: MR });
      reactions = { type: 'cant', R, MR, x0, side: state.cantSide };
    }

    // ---- internal forces at a section x (left segment) ----
    const Vat = (x) => {
      let V = 0;
      for (const f of forces) if (f.x <= x) V += f.F;
      for (const ld of loads) {
        if (ld.type === 'point') { if (ld.a <= x) V -= ld.P; }
        else if (ld.type === 'udl') {
          const c = Math.min(Math.max(x, ld.x1), ld.x2);
          V -= ld.w * (c - ld.x1);
        }
      }
      return V;
    };
    const Mat = (x) => {
      let M = 0;
      for (const f of forces) if (f.x <= x) M += f.F * (x - f.x);
      for (const c of couples) if (c.x <= x) M -= c.M;
      for (const ld of loads) {
        if (ld.type === 'point') { if (ld.a <= x) M -= ld.P * (x - ld.a); }
        else if (ld.type === 'moment') { if (ld.a <= x) M -= ld.M; }
        else {
          const c = Math.min(Math.max(x, ld.x1), ld.x2);
          if (c > ld.x1) {
            const len = c - ld.x1, xc = (ld.x1 + c) / 2;
            M -= ld.w * len * (x - xc);
          }
        }
      }
      return M;
    };

    // ---- sample grid with points either side of every event ----
    const events = new Set([0, L]);
    for (const f of forces) events.add(f.x);
    for (const c of couples) events.add(c.x);
    for (const ld of loads) {
      if (ld.type === 'udl') { events.add(ld.x1); events.add(ld.x2); }
      else events.add(ld.a);
    }
    const e = Math.max(L * 1e-7, 1e-9);
    const xs = new Set();
    const N = 480;
    for (let i = 0; i <= N; i++) xs.add((L * i) / N);
    for (const ev of events) {
      xs.add(Math.min(L, Math.max(0, ev - e)));
      xs.add(Math.min(L, Math.max(0, ev + e)));
    }
    let X = [...xs].sort((a, b) => a - b);
    let S = X.map(x => ({ x, V: Vat(x), M: Mat(x) }));

    // refine BMD extremes at shear zero crossings (V is piecewise linear)
    const extra = [];
    for (let i = 0; i + 1 < S.length; i++) {
      const a = S[i], b = S[i + 1];
      if ((a.V > 0) !== (b.V > 0) && Math.abs(b.x - a.x) > 3 * e && a.V !== b.V) {
        extra.push(a.x + a.V * (b.x - a.x) / (a.V - b.V));
      }
    }
    for (const x0 of extra) S.push({ x: x0, V: Vat(x0), M: Mat(x0) });
    S.sort((p, q) => p.x - q.x);

    // extremes — scan interior samples only, so the closing jump of the
    // diagram at an end support does not report a fake zero extreme.
    // The x = 0±e and x = L∓e event samples remain in the scan.
    const inner = S.filter(p => p.x > e / 2 && p.x < L - e / 2);
    const scan = inner.length ? inner : S;
    let Vmax = scan[0], Vmin = scan[0], Mmax = scan[0], Mmin = scan[0];
    for (const p of scan) {
      if (p.V > Vmax.V) Vmax = p;
      if (p.V < Vmin.V) Vmin = p;
      if (p.M > Mmax.M) Mmax = p;
      if (p.M < Mmin.M) Mmin = p;
    }
    return { reactions, samples: S, Vmax, Vmin, Mmax, Mmin, W };
  }

  function ok(ld) {
    if (!ld) return false;
    if (ld.type === 'udl') return ld.x2 > ld.x1;
    return true;
  }

  /* Deflection by double integration of M/EI over the solved samples.
     v'' = M/EI with v measured upward, so sagging gives negative
     (downward) deflection. EI in kN·m², v in metres, th in radians.
     Boundary conditions: 'ss' → v = 0 at both supports;
     'cant' → v = 0 and v' = 0 at the fixed end. */
  function deflect(result, state, EI) {
    const S = result.samples, n = S.length;
    const thp = new Array(n).fill(0), vp = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      const dx = S[i].x - S[i - 1].x;
      thp[i] = thp[i - 1] + (S[i - 1].M + S[i].M) / (2 * EI) * dx;
      vp[i] = vp[i - 1] + (thp[i - 1] + thp[i]) / 2 * dx;
    }
    const at = (arr, x) => {
      if (x <= S[0].x) return arr[0];
      if (x >= S[n - 1].x) return arr[n - 1];
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (hi + lo) >> 1; (S[m].x <= x ? lo = m : hi = m); }
      const t = (x - S[lo].x) / Math.max(S[hi].x - S[lo].x, 1e-12);
      return arr[lo] + t * (arr[hi] - arr[lo]);
    };
    let c1, c2;
    if (state.config === 'ss') {
      const vA = at(vp, state.xA), vB = at(vp, state.xB);
      c2 = -(vB - vA) / (state.xB - state.xA);
      c1 = -vA - c2 * state.xA;
    } else {
      const x0 = state.cantSide === 'right' ? state.L : 0;
      c2 = -at(thp, x0);
      c1 = -at(vp, x0) - c2 * x0;
    }
    const out = S.map((p, i) => ({ x: p.x, th: thp[i] + c2, v: vp[i] + c1 + c2 * p.x }));
    let vmax = out[0], vmin = out[0], thmax = out[0];
    for (const p of out) {
      if (p.v > vmax.v) vmax = p;
      if (p.v < vmin.v) vmin = p;
      if (Math.abs(p.th) > Math.abs(thmax.th)) thmax = p;
    }
    return { samples: out, vmax, vmin, thmax };
  }

  return { solve, deflect };
})();
if (typeof module !== 'undefined') module.exports = BeamEngine;
