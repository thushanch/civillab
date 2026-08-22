/* ============================================================
   CivilLab · truss-engine.js
   Plane determinate trusses by the method of joints, solved as
   one linear system (member forces + 3 reaction components).

   Conventions: x right, y up, node loads P positive DOWNWARD (kN).
   Member force positive in TENSION. Pin at the left support
   (Rx, Ry), roller at the right support (Ry only).

   build(type, n, span, h) makes Warren, Pratt or Howe geometry:
     nodes  [{id, x, y}]
     members [[idA, idB], ...]
     pin, roller  node ids
   solve(geom, loads) with loads = {nodeId: Pdown}
     → { ok, forces:[{a, b, F}], reactions:{R0x, R0y, Rny}, msg }
   ============================================================ */
const TrussEngine = (() => {

  function build(type, n, span, h) {
    const s = span / n;
    const nodes = [], members = [];
    const B = i => 'B' + i, T = i => 'T' + i;
    for (let i = 0; i <= n; i++) nodes.push({ id: B(i), x: i * s, y: 0 });

    if (type === 'warren') {
      for (let i = 0; i < n; i++) nodes.push({ id: T(i), x: (i + 0.5) * s, y: h });
      for (let i = 0; i < n; i++) members.push([B(i), B(i + 1)]);
      for (let i = 0; i < n - 1; i++) members.push([T(i), T(i + 1)]);
      for (let i = 0; i < n; i++) { members.push([B(i), T(i)]); members.push([T(i), B(i + 1)]); }
    } else {
      // pratt and howe share the layout, diagonals mirrored
      for (let i = 1; i <= n - 1; i++) nodes.push({ id: T(i), x: i * s, y: h });
      for (let i = 0; i < n; i++) members.push([B(i), B(i + 1)]);
      for (let i = 1; i <= n - 2; i++) members.push([T(i), T(i + 1)]);
      for (let i = 1; i <= n - 1; i++) members.push([B(i), T(i)]);            // verticals
      members.push([B(0), T(1)], [B(n), T(n - 1)]);                            // end diagonals
      for (let i = 1; i <= n - 2; i++) {
        const towardCentre = (i + 0.5) <= n / 2;
        if (type === 'pratt') members.push(towardCentre ? [T(i), B(i + 1)] : [B(i), T(i + 1)]);
        else                  members.push(towardCentre ? [B(i), T(i + 1)] : [T(i), B(i + 1)]);
      }
    }
    return { nodes, members, pin: B(0), roller: B(n), type, n, span, h };
  }

  function solve(geom, loads) {
    const { nodes, members, pin, roller } = geom;
    const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
    const j = nodes.length, m = members.length, U = m + 3;
    if (m + 3 !== 2 * j)
      return { ok: false, msg: `not determinate: m + r = ${m + 3}, 2j = ${2 * j}` };

    // rows: 2 per joint (ΣFx, ΣFy). cols: member forces, then R0x, R0y, Rny
    const A = Array.from({ length: 2 * j }, () => new Array(U).fill(0));
    const b = new Array(2 * j).fill(0);

    members.forEach(([a, c], k) => {
      const na = nodes[idx.get(a)], nc = nodes[idx.get(c)];
      const L = Math.hypot(nc.x - na.x, nc.y - na.y);
      const ux = (nc.x - na.x) / L, uy = (nc.y - na.y) / L;
      A[2 * idx.get(a)][k] += ux;  A[2 * idx.get(a) + 1][k] += uy;
      A[2 * idx.get(c)][k] -= ux;  A[2 * idx.get(c) + 1][k] -= uy;
    });
    A[2 * idx.get(pin)][m] = 1;          // R0x
    A[2 * idx.get(pin) + 1][m + 1] = 1;  // R0y
    A[2 * idx.get(roller) + 1][m + 2] = 1; // Rny

    for (const id in loads) {
      const i = idx.get(id);
      if (i == null) continue;
      b[2 * i + 1] += loads[id];         // ext force is −P (down); move to RHS → +P
    }

    // gaussian elimination with partial pivoting
    const M = A.map((row, r) => [...row, b[r]]);
    for (let col = 0; col < U; col++) {
      let p = col;
      for (let r = col + 1; r < 2 * j; r++) if (Math.abs(M[r][col]) > Math.abs(M[p][col])) p = r;
      if (Math.abs(M[p][col]) < 1e-10) return { ok: false, msg: 'mechanism or ill-conditioned geometry' };
      [M[col], M[p]] = [M[p], M[col]];
      for (let r = 0; r < 2 * j; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        if (f === 0) continue;
        for (let c = col; c <= U; c++) M[r][c] -= f * M[col][c];
      }
    }
    const x = M.map((row, r) => r < U ? row[U] / row[r] : 0);
    // rows were swapped in place; recover: after full elimination the matrix
    // is diagonal with pivots on M[col][col], so x[col] = M[col][U]/M[col][col]
    const sol = new Array(U);
    for (let col = 0; col < U; col++) sol[col] = M[col][U] / M[col][col];
    void x;

    const forces = members.map(([a, c], k) => ({ a, b: c, F: sol[k] }));
    return {
      ok: true, forces,
      reactions: { R0x: sol[m], R0y: sol[m + 1], Rny: sol[m + 2] }
    };
  }

  return { build, solve };
})();
if (typeof module !== 'undefined') module.exports = TrussEngine;
