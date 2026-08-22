/* ============================================================
   CivilLab · plastic-engine.js
   Plastic collapse by the mechanism (kinematic) method.
   Uniform plastic moment Mp throughout. Loads are the nominal
   values; λ is the collapse load factor. Beam hinge positions
   are fractions of L measured from the left (fixed) end.
   ============================================================ */
const PlasticEngine = (() => {
  const S2 = Math.SQRT2;

  function solve(c) {
    const Mp = c.Mp;
    switch (c.kind) {
      case 'ssP': return {
        lambda: 4 * Mp / (c.P * c.L), hinges: [0.5],
        work: 'λP·(L/2)θ = Mp·2θ', name: 'Simply supported · central P',
        collapse: `Pc = ${(4 * Mp / c.L).toFixed(1)} kN` };
      case 'propP': return {
        lambda: 6 * Mp / (c.P * c.L), hinges: [0, 0.5],
        work: 'λP·(L/2)θ = Mp(θ + 2θ)', name: 'Propped cantilever · central P',
        collapse: `Pc = ${(6 * Mp / c.L).toFixed(1)} kN` };
      case 'fixP': return {
        lambda: 8 * Mp / (c.P * c.L), hinges: [0, 0.5, 1],
        work: 'λP·(L/2)θ = Mp(θ + 2θ + θ)', name: 'Fixed ends · central P',
        collapse: `Pc = ${(8 * Mp / c.L).toFixed(1)} kN` };
      case 'fixU': return {
        lambda: 16 * Mp / (c.w * c.L * c.L), hinges: [0, 0.5, 1],
        work: 'λw·L·(Lθ/4) = 4Mpθ', name: 'Fixed ends · UDL',
        collapse: `wc = ${(16 * Mp / (c.L * c.L)).toFixed(2)} kN/m` };
      case 'propU': {
        const xs = 2 - S2;   // 0.5858 from the fixed end
        return {
          lambda: (6 + 4 * S2) * Mp / (c.w * c.L * c.L), hinges: [0, xs],
          work: 'minimised over the sagging hinge position x',
          name: 'Propped cantilever · UDL', xs,
          collapse: `wc = ${((6 + 4 * S2) * Mp / (c.L * c.L)).toFixed(2)} kN/m` };
      }
      case 'frame': {
        const beam = 8 * Mp / (c.V * c.l);
        const sway = 4 * Mp / (c.H * c.h);
        const comb = 6 * Mp / (c.V * c.l / 2 + c.H * c.h);
        const bars = [
          { name: 'Beam', lam: beam, work: 'λV(l/2)θ = 4Mpθ' },
          { name: 'Sway', lam: sway, work: 'λH·hθ = 4Mpθ' },
          { name: 'Combined', lam: comb, work: 'λ(V·l/2 + H·h)θ = 6Mpθ' }];
        let g = bars[0];
        for (const b of bars) if (b.lam < g.lam) g = b;
        return { lambda: g.lam, governing: g.name, bars, work: g.work,
                 name: 'Portal frame · fixed bases',
                 collapse: `λc = ${g.lam.toFixed(2)}` };
      }
    }
  }
  return { solve };
})();
if (typeof module !== 'undefined' && typeof exports !== 'undefined') exports.PlasticEngine = PlasticEngine;

/* ============================================================
   CivilLab · dyn-engine.js (same file, second global)
   Structural dynamics. Units: mass in tonnes (Mg), stiffness in
   kN/m, so ωn = √(k/m) rad/s directly. ζ is the damping ratio.
   Shear building masses/stiffnesses listed bottom → top; the
   eigenproblem is solved with a Jacobi sweep on the
   mass-normalised stiffness matrix.
   ============================================================ */
const DynEngine = (() => {

  function sdof(m, k, z) {
    const wn = Math.sqrt(k / m);
    const wd = wn * Math.sqrt(Math.max(0, 1 - z * z));
    return { wn, wd, fn: wn / (2 * Math.PI), T: 2 * Math.PI / wn,
             logdec: z < 1 ? 2 * Math.PI * z / Math.sqrt(1 - z * z) : Infinity };
  }
  function freeResp(m, k, z, u0, v0, t) {
    const { wn, wd } = sdof(m, k, z);
    if (z < 0.999) {
      const e = Math.exp(-z * wn * t);
      return e * (u0 * Math.cos(wd * t) + ((v0 + z * wn * u0) / wd) * Math.sin(wd * t));
    }
    const e = Math.exp(-wn * t);
    return e * (u0 + (v0 + wn * u0) * t);   // critically damped
  }

  function jacobi(Ain) {
    const n = Ain.length;
    const A = Ain.map(r => [...r]);
    let V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-18) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
        const cth = Math.cos(th), sth = Math.sin(th);
        for (let i = 0; i < n; i++) {
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = cth * aip - sth * aiq;
          A[i][q] = sth * aip + cth * aiq;
        }
        for (let i = 0; i < n; i++) {
          const api = A[p][i], aqi = A[q][i];
          A[p][i] = cth * api - sth * aqi;
          A[q][i] = sth * api + cth * aqi;
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = cth * vip - sth * viq;
          V[i][q] = sth * vip + cth * viq;
        }
      }
    }
    return { evals: A.map((r, i) => r[i]), vecs: V };  // vecs columns are eigenvectors
  }

  function shear(ms, ks) {
    const n = ms.length;
    const K = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      K[i][i] = ks[i] + (i + 1 < n ? ks[i + 1] : 0);
      if (i + 1 < n) { K[i][i + 1] = -ks[i + 1]; K[i + 1][i] = -ks[i + 1]; }
    }
    const A = K.map((row, i) => row.map((v, j) => v / Math.sqrt(ms[i] * ms[j])));
    const { evals, vecs } = jacobi(A);
    const order = evals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
    const omegas = order.map(i => Math.sqrt(Math.max(evals[i], 0)));
    const modes = order.map(oi => {
      let phi = ms.map((m, r) => vecs[r][oi] / Math.sqrt(m));
      let mref = 0;
      for (const v of phi) if (Math.abs(v) > Math.abs(mref)) mref = v;
      return phi.map(v => v / mref);
    });
    return { omegas, modes, fns: omegas.map(w => w / (2 * Math.PI)) };
  }

  return { sdof, freeResp, shear, jacobi };
})();
if (typeof module !== 'undefined' && typeof exports !== 'undefined') exports.DynEngine = DynEngine;
