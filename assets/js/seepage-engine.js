/* CivilLab · seepage-engine.js
   Confined seepage under a sheet pile or a dam, solved as a flow net.

   Physics
   - steady confined flow in a homogeneous isotropic soil obeys Laplace,
     d2h/dx2 + d2h/dz2 = 0, where h is total head
   - the stream function psi is the harmonic conjugate of h, so contours of h
     (equipotentials) and contours of psi (flow lines) cross at right angles
     and together they are the flow net
   - discharge per metre run is q = k H Nf/Nd, and because psi is the discharge
     measured across the flow, the full range of psi over the domain IS q.
     That gives an independent check on the numerics.
   - exit gradient at the downstream face is i_e = -dh/dz at the surface
   - critical gradient i_c = (Gs - 1)/(1 + e) = gamma'/gamma_w, and the factor
     of safety against piping is i_c/i_e
   - the datum for h is the downstream ground surface, so h = H upstream and
     h = 0 downstream. Pressure head at an elevation z is therefore h + D - z,
     and directly under a dam base sitting on the ground (z = D) it is just h.
     Uplift pressure there is u = gamma_w h.

   Units and conventions
   - lengths in metres, k in m/s, heads in metres of water, q in m3/s per metre
   - x runs left to right across the domain, z is measured UP from the
     impermeable base, so the ground surface is at z = D
   - upstream is the left half and carries total head H, downstream is the
     right half and carries head 0, so water flows left to right
   - gamma_w is taken as 9.81 kN/m3

   Geometry
   - 'sheetpile': a thin impermeable wall on the centreline driven a depth d
     down from the ground surface
   - 'dam': an impermeable base of width B centred on the domain, sitting on
     the ground surface, with an optional cutoff of depth d below its heel

   Boundaries
   - ground surface upstream of the structure: h = H
   - ground surface downstream of the structure: h = 0
   - the impermeable base, the two sides, the wall faces and the underside of a
     dam base: no flow, dh/dn = 0
*/
const SeepageEngine = (() => {

  const GW = 9.81;                    // unit weight of water, kN/m3
  const FREE = 0, FIXED = 1, SOLID = 2;

  /* ---------- a general finite difference Laplace solver ----------
     type[]  FREE solved, FIXED held at val[], SOLID excluded
     No-flow boundaries fall out automatically: a FREE node simply averages
     the neighbours that exist, which is the mirror image condition.        */
  function laplace(nx, ny, dx, dz, type, val, opts) {
    opts = opts || {};
    const iter = opts.iter || 4000, tol = opts.tol == null ? 1e-11 : opts.tol;
    const W = nx + 1, N = W * (ny + 1);
    const h = new Float64Array(N);
    for (let i = 0; i < N; i++) h[i] = type[i] === FIXED ? val[i] : (opts.seed || 0);
    const ax = 1 / (dx * dx), az = 1 / (dz * dz);
    const omega = opts.omega || 1.9;
    let last = Infinity;
    for (let it = 0; it < iter; it++) {
      let err = 0;
      for (let j = 0; j <= ny; j++) {
        for (let i = 0; i <= nx; i++) {
          const p = j * W + i;
          if (type[p] !== FREE) continue;
          let sum = 0, den = 0;
          // each existing non-solid neighbour contributes, a missing one is
          // mirrored, which is exactly the zero flux condition
          const L = i > 0 ? p - 1 : -1, R = i < nx ? p + 1 : -1;
          const D = j > 0 ? p - W : -1, U = j < ny ? p + W : -1;
          const okL = L >= 0 && type[L] !== SOLID, okR = R >= 0 && type[R] !== SOLID;
          const okD = D >= 0 && type[D] !== SOLID, okU = U >= 0 && type[U] !== SOLID;
          if (okL) { sum += ax * h[L]; den += ax; } else if (okR) { sum += ax * h[R]; den += ax; }
          if (okR) { sum += ax * h[R]; den += ax; } else if (okL) { sum += ax * h[L]; den += ax; }
          if (okD) { sum += az * h[D]; den += az; } else if (okU) { sum += az * h[U]; den += az; }
          if (okU) { sum += az * h[U]; den += az; } else if (okD) { sum += az * h[D]; den += az; }
          if (den === 0) continue;
          const nv = sum / den;
          const d = nv - h[p];
          h[p] += omega * d;
          const ad = Math.abs(d);
          if (ad > err) err = ad;
        }
      }
      if (err < tol) { last = err; break; }
      last = err;
    }
    return { h, residual: last };
  }

  /* ---------- geometry ---------- */
  function build(inp) {
    const kind = inp.kind || 'sheetpile';
    const W = +inp.W, D = +inp.D, d = Math.max(0, +inp.d || 0);
    const B = +inp.B || 0;
    const nx = inp.nx || 120, ny = inp.ny || 60;
    const dx = W / nx, dz = D / ny;
    const NW = nx + 1, N = NW * (ny + 1);
    const type = new Uint8Array(N), val = new Float64Array(N);
    const H = +inp.H;

    const xAt = i => i * dx, zAt = j => j * dz;
    const iw = Math.round(nx / 2);                       // centreline column

    // structure footprint on the surface, and the solid column of the cutoff
    let i0 = iw, i1 = iw;                                 // no-flow run on surface
    if (kind === 'dam') {
      const half = Math.max(dx, B / 2);
      i0 = Math.max(0, Math.round((W / 2 - half) / dx));
      i1 = Math.min(nx, Math.round((W / 2 + half) / dx));
    }
    const cutCol = kind === 'dam' ? i0 : iw;              // cutoff sits at the heel
    const jTip = d > 0 ? Math.max(0, Math.round((D - d) / dz)) : ny + 1;

    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const p = j * NW + i;
        type[p] = FREE;
        // the wall or cutoff occupies one column from the surface down to the tip
        if (d > 0 && i === cutCol && j >= jTip && j <= ny) type[p] = SOLID;
      }
    }
    // the very top of the wall column must stay solid, but the surface nodes
    // either side are the head boundaries
    for (let i = 0; i <= nx; i++) {
      const p = ny * NW + i;
      if (type[p] === SOLID) continue;
      if (i < i0) { type[p] = FIXED; val[p] = H; }        // upstream ground
      else if (i > i1) { type[p] = FIXED; val[p] = 0; }   // downstream ground
      else type[p] = FREE;                                // under a dam base, no flow
    }
    return { kind, W, D, d, B, H, k: +inp.k, nx, ny, dx, dz, NW, type, val,
             iw, i0, i1, cutCol, jTip, xAt, zAt };
  }

  /* ---------- discharge across the two ground surfaces ---------- */
  function surfaceFlux(g, h) {
    const { nx, ny, NW, dx, dz, k, i0, i1, type } = g;
    let qIn = 0, qOut = 0;
    for (let i = 0; i <= nx; i++) {
      const p = ny * NW + i;
      if (type[p] !== FIXED) continue;
      const below = p - NW;
      if (type[below] === SOLID) continue;
      // vertical gradient just under the surface node
      const dhdz = (h[p] - h[below]) / dz;
      const wgt = (i === 0 || i === nx) ? 0.5 * dx : dx;
      const flux = -k * dhdz * wgt;         // positive means flow upward out
      if (i < i0) qIn += flux; else if (i > i1) qOut += flux;
    }
    return { qIn: -qIn, qOut: qOut };       // qIn positive entering the ground
  }

  /* ---------- marching squares contouring ---------- */
  function contour(g, f, level) {
    const { nx, ny, NW, type, xAt, zAt } = g;
    const segs = [];
    const ok = p => type[p] !== SOLID;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * NW + i, b = a + 1, c = a + NW + 1, e = a + NW;
        if (!ok(a) || !ok(b) || !ok(c) || !ok(e)) continue;
        const va = f[a], vb = f[b], vc = f[c], vd = f[e];
        let idx = 0;
        if (va > level) idx |= 1;
        if (vb > level) idx |= 2;
        if (vc > level) idx |= 4;
        if (vd > level) idx |= 8;
        if (idx === 0 || idx === 15) continue;
        const x0 = xAt(i), x1 = xAt(i + 1), z0 = zAt(j), z1 = zAt(j + 1);
        const lerp = (p, q, vp, vq) => p + (q - p) * ((level - vp) / (vq - vp));
        const B_ = () => [lerp(x0, x1, va, vb), z0];
        const R_ = () => [x1, lerp(z0, z1, vb, vc)];
        const T_ = () => [lerp(x0, x1, vd, vc), z1];
        const L_ = () => [x0, lerp(z0, z1, va, vd)];
        const push = (p, q) => segs.push([p, q]);
        switch (idx) {
          case 1: case 14: push(L_(), B_()); break;
          case 2: case 13: push(B_(), R_()); break;
          case 3: case 12: push(L_(), R_()); break;
          case 4: case 11: push(R_(), T_()); break;
          case 5:          push(L_(), T_()); push(B_(), R_()); break;
          case 6: case 9:  push(B_(), T_()); break;
          case 7: case 8:  push(L_(), T_()); break;
          case 10:         push(L_(), B_()); push(R_(), T_()); break;
        }
      }
    }
    return segs;
  }

  /* ---------- the whole problem ---------- */
  function solve(inp) {
    const g = build(inp);
    const { nx, ny, NW, dx, dz, D, H, k, type, val } = g;

    const hs = laplace(nx, ny, dx, dz, type, val, { seed: H / 2, iter: inp.iter || 6000 });
    const h = hs.h;

    const { qIn, qOut } = surfaceFlux(g, h);
    const q = 0.5 * (qIn + qOut);
    const conservation = Math.abs(qIn - qOut) / Math.max(1e-30, Math.abs(q));

    /* stream function: the outer no flow boundary is one streamline, the
       structure is the other. psi runs from 0 on the structure to q on the
       base, so its range reproduces the discharge.                        */
    const t2 = new Uint8Array(type), v2 = new Float64Array(NW * (ny + 1));
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const p = j * NW + i;
        if (type[p] === SOLID) { t2[p] = SOLID; continue; }
        t2[p] = FREE;
        const onBase = j === 0, onSide = i === 0 || i === nx;
        if (onBase || onSide) { t2[p] = FIXED; v2[p] = q; }
      }
    }
    // the structure surface is the psi = 0 streamline
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const p = j * NW + i;
        if (type[p] !== SOLID) continue;
        for (const nb of [p - 1, p + 1, p - NW, p + NW]) {
          if (nb < 0 || nb >= t2.length) continue;
          if (type[nb] !== SOLID) { t2[nb] = FIXED; v2[nb] = 0; }
        }
      }
    }
    if (g.kind === 'dam') {
      for (let i = g.i0; i <= g.i1; i++) {
        const p = ny * NW + i;
        if (type[p] !== SOLID) { t2[p] = FIXED; v2[p] = 0; }
      }
    }
    const ps = laplace(nx, ny, dx, dz, t2, v2, { seed: q / 2, iter: inp.iter || 6000 });
    const psi = ps.h;

    /* exit gradient, taken at the downstream ground surface next to the
       structure where it is worst */
    let iExit = 0, xExit = 0;
    for (let i = g.i1 + 1; i <= nx; i++) {
      const p = ny * NW + i, below = p - NW;
      if (type[p] !== FIXED || type[below] === SOLID) continue;
      const grad = (h[below] - h[p]) / dz;        // head falls upward, so positive
      if (grad > iExit) { iExit = grad; xExit = g.xAt(i); }
    }

    /* uplift under a dam base */
    let uplift = null;
    if (g.kind === 'dam') {
      const pts = [];
      let force = 0, moment = 0;
      for (let i = g.i0; i <= g.i1; i++) {
        const p = ny * NW + i;
        if (type[p] === SOLID) continue;
        const head = h[p];                       // head above the tailwater
        const press = GW * head;                 // pressure head at z = D is h
        const x = g.xAt(i);
        pts.push({ x, head, u: Math.max(0, press) });
      }
      for (let n = 1; n < pts.length; n++) {
        const w = pts[n].x - pts[n - 1].x, um = 0.5 * (pts[n].u + pts[n - 1].u);
        force += um * w;
        moment += um * w * (0.5 * (pts[n].x + pts[n - 1].x) - g.xAt(g.i0));
      }
      uplift = { pts, force, arm: force > 1e-12 ? moment / force : 0,
                 meanHead: pts.length ? pts.reduce((a, p) => a + p.head, 0) / pts.length : 0 };
    }

    return {
      g, h, psi, q, qIn, qOut, conservation,
      shape: k > 0 && H > 0 ? q / (k * H) : 0,      // Nf/Nd, the form factor
      iExit, xExit, uplift,
      residual: Math.max(hs.residual, ps.residual),
      headAt: (x, z) => sample(g, h, x, z),
      psiAt: (x, z) => sample(g, psi, x, z),
      equipotentials: nd => {
        const out = [];
        for (let m = 1; m < nd; m++) out.push({ level: H * (1 - m / nd), segs: contour(g, h, H * (1 - m / nd)) });
        return out;
      },
      flowlines: nf => {
        const out = [];
        for (let m = 1; m < nf; m++) out.push({ level: q * m / nf, segs: contour(g, psi, q * m / nf) });
        return out;
      }
    };
  }

  function sample(g, f, x, z) {
    const { nx, ny, NW, dx, dz } = g;
    const fi = Math.min(nx - 1e-9, Math.max(0, x / dx));
    const fj = Math.min(ny - 1e-9, Math.max(0, z / dz));
    const i = Math.floor(fi), j = Math.floor(fj);
    const tx = fi - i, tz = fj - j;
    const p = j * NW + i;
    const a = f[p], b = f[p + 1], c = f[p + NW], e = f[p + NW + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
  }

  /* critical hydraulic gradient, the point at which upward seepage floats the grains */
  function criticalGradient(Gs, e) { return (Gs - 1) / (1 + e); }

  return { solve, build, laplace, contour, criticalGradient, GW, FREE, FIXED, SOLID };
})();
if (typeof module !== 'undefined') module.exports = SeepageEngine;
