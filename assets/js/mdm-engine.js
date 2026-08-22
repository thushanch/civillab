/* ============================================================
   CivilLab · mdm-engine.js
   Moment distribution (Hardy Cross) for continuous beams.

   Sign convention: end moments CLOCKWISE POSITIVE acting on the
   member (Hibbeler). Internal sagging moment at the left end of a
   span equals m_AB; at the right end it equals −m_BA.
   FEMs, UDL w down: −wL²/12 / +wL²/12.
   Point load P at a (b = L−a): −Pab²/L² / +Pa²b/L².
   Ends: 'fixed' (DF 0, absorbs carry-overs) or 'pin' (DF 1,
   balanced each cycle). Interior joints are continuous over
   simple supports. Stiffness 4EI/L throughout, carry-over 0.5.
   ============================================================ */
const MDMEngine = (() => {

  function create(cfg) {
    const n = cfg.spans.length;
    const ends = new Array(2 * n).fill(0);
    cfg.spans.forEach((sp, i) => {
      let fAB = 0, fBA = 0;
      if (sp.w) { fAB += -sp.w * sp.L * sp.L / 12; fBA += sp.w * sp.L * sp.L / 12; }
      if (sp.P) {
        const a = sp.a, b = sp.L - a;
        fAB += -sp.P * a * b * b / (sp.L * sp.L);
        fBA += sp.P * a * a * b / (sp.L * sp.L);
      }
      ends[2 * i] = fAB; ends[2 * i + 1] = fBA;
    });
    const joints = [];
    for (let j = 0; j <= n; j++) {
      const mem = [];
      if (j > 0) mem.push(2 * (j - 1) + 1);
      if (j < n) mem.push(2 * j);
      let balance = true;
      if (j === 0 && cfg.left === 'fixed') balance = false;
      if (j === n && cfg.right === 'fixed') balance = false;
      const kk = mem.map(e => { const sp = cfg.spans[e >> 1]; return 4 * (sp.EI || 1) / sp.L; });
      const sum = kk.reduce((a, b) => a + b, 0);
      const DF = mem.map((e, q) => balance ? kk[q] / sum : 0);
      joints.push({ j, mem, DF, balance });
    }
    const model = {
      cfg, n, ends, joints,
      rows: [{ type: 'FEM', vals: [...ends] }],
      converged: !joints.some(j => j.balance),
      phase: 'BAL',
      maxRef: Math.max(...ends.map(Math.abs), 1e-9),
      lastBal: null, cycles: 0
    };
    if (model.converged) model.rows.push({ type: 'Total', vals: [...model.ends] });
    return model;
  }

  function step(model) {
    if (model.converged) return false;
    if (model.phase === 'BAL') {
      const add = new Array(2 * model.n).fill(0);
      let maxU = 0;
      for (const jt of model.joints) {
        if (!jt.balance) continue;
        const U = jt.mem.reduce((s2, e) => s2 + model.ends[e], 0);
        maxU = Math.max(maxU, Math.abs(U));
        jt.mem.forEach((e, q) => { add[e] += -U * jt.DF[q]; });
      }
      for (let e = 0; e < add.length; e++) model.ends[e] += add[e];
      model.rows.push({ type: 'Balance', vals: add });
      model.lastBal = add;
      model.phase = 'CO';
      model.cycles++;
      if (maxU < Math.max(model.maxRef * 1e-4, 1e-8)) {
        model.converged = true;
        model.rows.push({ type: 'Total', vals: [...model.ends] });
      }
      return true;
    }
    const add = new Array(2 * model.n).fill(0);
    for (let e = 0; e < add.length; e++) {
      const other = (e % 2 === 0) ? e + 1 : e - 1;
      add[other] += 0.5 * model.lastBal[e];
    }
    for (let e = 0; e < add.length; e++) model.ends[e] += add[e];
    model.rows.push({ type: 'Carry over', vals: add });
    model.phase = 'BAL';
    return true;
  }

  function run(model) {
    let guard = 0;
    while (!model.converged && guard++ < 120) step(model);
    return model;
  }

  /* internal sagging BMD and support results from the current ends */
  function results(model) {
    const spans = model.cfg.spans, n = model.n;
    const offs = [0];
    for (const sp of spans) offs.push(offs[offs.length - 1] + sp.L);
    const samples = [];
    let Mmax = { M: -Infinity }, Mmin = { M: Infinity };
    spans.forEach((sp, i) => {
      const mAB = model.ends[2 * i], mBA = model.ends[2 * i + 1];
      const NP = 64;
      for (let q = 0; q <= NP; q++) {
        const x = sp.L * q / NP, t = x / sp.L;
        let M0 = 0;
        if (sp.w) M0 += sp.w * x * (sp.L - x) / 2;
        if (sp.P) M0 += x < sp.a ? sp.P * (sp.L - sp.a) * x / sp.L
                                 : sp.P * sp.a * (sp.L - x) / sp.L;
        const M = M0 + mAB * (1 - t) - mBA * t;
        const pnt = { x: offs[i] + x, M, span: i };
        samples.push(pnt);
        if (M > Mmax.M) Mmax = pnt;
        if (M < Mmin.M) Mmin = pnt;
      }
    });
    // internal support moments (sagging +) at each joint
    const supM = [];
    for (let j = 0; j <= n; j++)
      supM.push(j < n ? model.ends[2 * j] : -model.ends[2 * n - 1]);
    // reactions: R_j = V_B of the left span + V_A of the right span
    const VA = [], VB = [];
    spans.forEach((sp, i) => {
      let W = 0, V0A = 0;
      if (sp.w) { W += sp.w * sp.L; V0A += sp.w * sp.L / 2; }
      if (sp.P) { W += sp.P; V0A += sp.P * (sp.L - sp.a) / sp.L; }
      const vA = V0A - (model.ends[2 * i] + model.ends[2 * i + 1]) / sp.L;
      VA.push(vA); VB.push(W - vA);
    });
    const R = [];
    for (let j = 0; j <= n; j++)
      R.push((j > 0 ? VB[j - 1] : 0) + (j < n ? VA[j] : 0));
    return { samples, Mmax, Mmin, supM, R, offs, Ltot: offs[n] };
  }

  return { create, step, run, results };
})();
if (typeof module !== 'undefined') module.exports = MDMEngine;
