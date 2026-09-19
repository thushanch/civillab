/* CivilLab · slope-engine.js
   Slope stability of a circular slip by the method of slices.

   Physics
   - the sliding mass is cut into vertical slices and moments are taken about
     the centre of the circle, so the factor of safety is
       F = (resisting moment) / (disturbing moment)
     and because every slice base lies on the same circle the radius cancels,
     leaving F = sum of base shear strengths / sum of W sin(alpha)
   - Fellenius, the ordinary method of slices, resolves the slice weight
     normal to its own base and ignores the forces between slices:
       F = sum[ c' l + (W cos a - u l) tan(phi') ] / sum[ W sin a ]
   - Bishop simplified keeps vertical equilibrium of each slice, which puts F
     on both sides and needs iteration:
       F = sum[ (c' b + (W - u b) tan(phi')) / m_a ] / sum[ W sin a ],
       m_a = cos a + sin a tan(phi') / F
   - pore pressure is set by the pore pressure ratio ru, so u = ru gamma h,
     which is how slope charts are drawn
   - with phi' = 0 the strength is cu on every base, so F reduces to
     sum(cu l) / sum(W sin a), the undrained circular arc result

   Units and conventions
   - lengths in metres, unit weight in kN/m3, strengths in kPa, angles in
     degrees at the boundary and radians inside
   - x runs right from the toe of the slope, y runs up from the toe level
   - the slope descends to the right, so the mass rotates anticlockwise and
     slides down and out towards the toe. Alpha follows the usual convention,
     positive where the base slopes down in the direction of sliding, which is
     at the head of the slip, and negative at the exit near the toe where the
     base rises. That makes sin(alpha) = (xc - x)/R, not the other way round,
     and it is what puts the toe slices in resistance rather than in drive.
   - COMPRESSION POSITIVE, the soil convention

   Geometry
   - a simple slope: a level crest at height Hs, a face at angle beta, and a
     level toe. The crest runs left from x = 0 and the toe runs right from
     x = Hs/tan(beta).
*/
const SlopeEngine = (() => {

  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ground surface: crest, face, toe */
  function ground(x, Hs, betaDeg) {
    const L = Hs / Math.tan(clamp(betaDeg, 1, 89) * RAD);
    if (x <= 0) return Hs;
    if (x >= L) return 0;
    return Hs - x * (Hs / L);
  }
  const toeX = (Hs, betaDeg) => Hs / Math.tan(clamp(betaDeg, 1, 89) * RAD);

  /* where the circle cuts the ground, found by bisection on f = ground - circle */
  function intersections(c, Hs, beta) {
    const { xc, yc, R } = c;
    const bot = x => {
      const dx = x - xc, s = R * R - dx * dx;
      return s <= 0 ? null : yc - Math.sqrt(s);
    };
    const f = x => { const b = bot(x); return b == null ? null : ground(x, Hs, beta) - b; };
    const xa = xc - R, xb = xc + R;
    const N = 600, out = [];
    let px = xa, pv = f(xa);
    for (let i = 1; i <= N; i++) {
      const x = xa + (xb - xa) * i / N, v = f(x);
      if (pv != null && v != null && pv * v < 0) {
        let lo = px, hi = x;
        for (let k = 0; k < 80; k++) {
          const m = 0.5 * (lo + hi);
          if (f(lo) * f(m) <= 0) hi = m; else lo = m;
        }
        out.push(0.5 * (lo + hi));
      }
      px = x; pv = v;
    }
    return out;
  }

  /* cut the mass into slices */
  function slices(inp) {
    const Hs = +inp.Hs, beta = +inp.beta, n = inp.n || 20;
    const c = { xc: +inp.xc, yc: +inp.yc, R: +inp.R };
    const xs = intersections(c, Hs, beta);
    if (xs.length < 2) return { ok: false, why: 'the circle does not cut the ground twice' };
    const x1 = xs[0], x2 = xs[xs.length - 1];
    const gam = +inp.gamma, ru = +inp.ru || 0;
    const out = [];
    const b = (x2 - x1) / n;
    for (let i = 0; i < n; i++) {
      const xm = x1 + b * (i + 0.5);
      const dx = xm - c.xc, s = c.R * c.R - dx * dx;
      if (s <= 0) continue;
      const yb = c.yc - Math.sqrt(s);
      const yt = ground(xm, Hs, beta);
      const h = yt - yb;
      if (!(h > 0)) continue;
      const sinA = clamp(-dx / c.R, -1, 1);   // positive at the head, negative at the toe
      const a = Math.asin(sinA);
      const cosA = Math.cos(a);
      const l = b / cosA;
      const W = gam * b * h;
      const u = ru * gam * h;
      out.push({ i, x: xm, b, h, yb, yt, W, alpha: a, alphaDeg: a / RAD, l, u });
    }
    if (!out.length) return { ok: false, why: 'the circle does not enclose any soil' };
    const arc = out.reduce((t, s2) => t + s2.l, 0);
    return { ok: true, x1, x2, list: out, arc, c, Hs, beta };
  }

  /* the two methods */
  function fellenius(sl, cP, phiDeg) {
    const tp = Math.tan(clamp(phiDeg, 0, 89) * RAD);
    let num = 0, den = 0;
    for (const s of sl.list) {
      const N = s.W * Math.cos(s.alpha);
      num += cP * s.l + Math.max(0, N - s.u * s.l) * tp;
      den += s.W * Math.sin(s.alpha);
    }
    return { F: den > 1e-12 ? num / den : Infinity, num, den, iters: 0, converged: true };
  }

  function bishop(sl, cP, phiDeg, seed) {
    const tp = Math.tan(clamp(phiDeg, 0, 89) * RAD);
    let den = 0;
    for (const s of sl.list) den += s.W * Math.sin(s.alpha);
    if (!(Math.abs(den) > 1e-12)) return { F: Infinity, num: 0, den, iters: 0, converged: true };
    let F = seed || 1.2, it = 0, conv = false, minMa = Infinity;
    for (; it < 120; it++) {
      let num = 0; minMa = Infinity;
      for (const s of sl.list) {
        const ma = Math.cos(s.alpha) + Math.sin(s.alpha) * tp / F;
        if (ma < minMa) minMa = ma;
        if (Math.abs(ma) < 1e-6) continue;
        num += (cP * s.b + Math.max(0, s.W - s.u * s.b) * tp) / ma;
      }
      const Fn = num / den;
      if (!isFinite(Fn) || Fn < 0) return { F: NaN, den, iters: it, converged: false, minMa };
      // a soil with no strength at all really does give F = 0, and iterating
      // on it would divide by zero, so take the answer and stop
      if (Fn < 1e-12) return { F: 0, den, iters: it + 1, converged: true, minMa };
      if (Math.abs(Fn - F) < 1e-10) { F = Fn; conv = true; it++; break; }
      F = Fn;
    }
    return { F, den, iters: it, converged: conv, minMa };
  }

  function solve(inp) {
    const sl = slices(inp);
    if (!sl.ok) return { ok: false, why: sl.why };
    const cP = +inp.c, phi = +inp.phi;
    const fel = fellenius(sl, cP, phi);
    const bis = bishop(sl, cP, phi, fel.F > 0 && isFinite(fel.F) ? fel.F : 1.2);
    const W = sl.list.reduce((t, s) => t + s.W, 0);
    return {
      ok: true, sl, slices: sl.list, arc: sl.arc, x1: sl.x1, x2: sl.x2,
      W, Fel: fel.F, Bis: bis.F, bisIters: bis.iters, bisConverged: bis.converged,
      minMa: bis.minMa,
      F: inp.method === 'fellenius' ? fel.F : bis.F,
      disturbing: fel.den
    };
  }

  /* grid search for the most critical circle, keeping the radius tied to a
     circle that still passes below the toe */
  function critical(inp, opts) {
    opts = opts || {};
    const nx = opts.nx || 9, ny = opts.ny || 9, nr = opts.nr || 7;
    const Hs = +inp.Hs, L = toeX(Hs, +inp.beta);
    let best = null;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const xc = -0.4 * Hs + (L + 0.8 * Hs) * i / (nx - 1);
        const yc = Hs * (1.1 + 1.4 * j / (ny - 1));
        for (let k = 0; k < nr; k++) {
          const R = (yc - 0) * (0.85 + 0.5 * k / (nr - 1));
          const r = solve(Object.assign({}, inp, { xc, yc, R }));
          if (!r.ok || !isFinite(r.F) || r.F <= 0) continue;
          if (r.disturbing <= 0) continue;
          if (!best || r.F < best.F) best = { F: r.F, xc, yc, R };
        }
      }
    }
    return best;
  }

  return { ground, toeX, intersections, slices, fellenius, bishop, solve, critical, RAD };
})();
if (typeof module !== 'undefined') module.exports = SlopeEngine;
