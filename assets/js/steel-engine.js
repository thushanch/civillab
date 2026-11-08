/* CivilLab · SteelEngine
   Steel member resistance, EN 1993-1-1 with the UK NA against BS 5950-1:2000.
   Units: mm for sections, m for lengths, kN and kN·m for actions, MPa, E = 210 GPa.
   Signs: N positive in COMPRESSION, negative in tension. M is the major axis
   moment, y-y in EC3 and x-x in BS 5950.
   Sections: rolled UB and UC from their nominal dimensions h b tw tf r, and hot
   finished square hollow sections b t. A, I, W, It and Iw are computed from
   the dimensions with the root fillets included, which matches the published
   tables to within a few per cent (It is the least exact).
   EC3: classification Table 5.2, tension 6.2.3, compression 6.3.1 with the
   Table 6.2 curves, bending 6.2.5 and lateral torsional buckling 6.3.2.3 for
   rolled sections with the UK NA (lambda_LT,0 = 0.4, beta = 0.75, f modifier),
   shear 6.2.6, interaction 6.3.3 with Annex B. Partial factors 1.0, 1.0, 1.25.
   BS 5950: Table 11 classes, 4.6 tension with Ke, 4.7 struts by Perry-Robertson
   (Annex C), 4.2.5 moment capacity, 4.3.6 simplified LTB with u = 0.9 and
   x = D/T, 4.8.3.3.1 simplified interaction. */
const SteelEngine = (() => {
  const E = 210000, G = 81000;

  /* nominal dimensions, mm */
  const TABLE = {
    UB: [['203×133×25', 203.2, 133.2, 5.7, 7.8, 7.6], ['254×146×31', 251.4, 146.1, 6.0, 8.6, 7.6],
         ['305×165×40', 303.4, 165.0, 6.0, 10.2, 8.9], ['356×171×45', 351.4, 171.1, 7.0, 9.7, 10.2],
         ['406×178×54', 402.6, 177.7, 7.7, 10.9, 10.2], ['457×191×67', 453.4, 189.9, 8.5, 12.7, 10.2],
         ['533×210×92', 533.1, 209.3, 10.1, 15.6, 12.7], ['610×229×125', 612.2, 229.0, 11.9, 19.6, 12.7]],
    UC: [['152×152×23', 152.4, 152.2, 5.8, 6.8, 7.6], ['203×203×46', 203.2, 203.6, 7.2, 11.0, 10.2],
         ['254×254×73', 254.1, 254.6, 8.6, 14.2, 12.7], ['305×305×97', 307.9, 305.3, 9.9, 15.4, 15.2],
         ['356×368×129', 355.6, 368.6, 10.4, 17.5, 15.2]],
    SHS: [['100×100×5', 100, 5], ['150×150×8', 150, 8], ['200×200×10', 200, 10], ['250×250×12.5', 250, 12.5],
          ['300×300×16', 300, 16]]
  };

  function iSection(name, h, b, tw, tf, r) {
    const af = (1 - Math.PI / 4) * r * r;          // one fillet
    const yf = h / 2 - tf - 0.2234 * r;              // fillet centroid from the major axis
    const zf = tw / 2 + 0.2234 * r;                  // and from the minor axis
    const hw = h - 2 * tf;
    const A = 2 * b * tf + hw * tw + 4 * af;
    const Iy = (b * h ** 3 - (b - tw) * hw ** 3) / 12 + 4 * af * yf * yf;
    const Iz = (2 * tf * b ** 3 + hw * tw ** 3) / 12 + 4 * af * zf * zf;
    const Wply = b * tf * (h - tf) + tw * hw * hw / 4 + 4 * af * yf;
    const Wplz = tf * b * b / 2 + hw * tw * tw / 4 + 4 * af * zf;
    const It = (2 * b * tf ** 3 + hw * tw ** 3) / 3;
    const Iw = Iz * (h - tf) ** 2 / 4;
    return { family:'I', name, h, b, tw, tf, r, A, Iy, Iz, Wely: Iy / (h / 2), Welz: Iz / (b / 2), Wply, Wplz,
             It, Iw, iy: Math.sqrt(Iy / A), iz: Math.sqrt(Iz / A), tmax: tf,
             cf: (b - tw - 2 * r) / 2, cw: hw - 2 * r,
             Av: Math.max(A - 2 * b * tf + (tw + 2 * r) * tf, hw * tw) };
  }

  function shs(name, b, t) {
    const ro = 1.5 * t, ri = t;
    const A = 4 * t * (b - t) - (4 - Math.PI) * (ro * ro - ri * ri);
    /* sharp corners, less the outer corner material, plus the inner void
       corners that the rounding fills in */
    const k = 1 - Math.PI / 4, ao = k * ro * ro, ai = k * ri * ri;
    const yo = b / 2 - 0.2234 * ro, yi = b / 2 - t - 0.2234 * ri;
    const I = (b ** 4 - (b - 2 * t) ** 4) / 12 - 4 * ao * yo * yo + 4 * ai * yi * yi;
    const Wpl = (b ** 3 - (b - 2 * t) ** 3) / 4 - 4 * ao * yo + 4 * ai * yi;
    const It = 4 * Math.pow(b - t, 4) * t / (4 * (b - t));   // thin wall Bredt: 4 Am^2 t / perimeter
    return { family:'SHS', name, h:b, b, tw:t, tf:t, t, r:ro, A, Iy:I, Iz:I, Wely:I / (b / 2), Welz:I / (b / 2),
             Wply:Wpl, Wplz:Wpl, It, Iw:0, iy:Math.sqrt(I / A), iz:Math.sqrt(I / A), tmax:t,
             cf: b - 3 * t, cw: b - 3 * t, Av: A / 2 };
  }

  function section(family, idx) {
    const row = TABLE[family][Math.max(0, Math.min(TABLE[family].length - 1, idx))];
    return family === 'SHS' ? shs(row[0], row[1], row[2]) : iSection(...row);
  }

  /* yield strength by thickness, EN 10025-2 and BS 5950 Table 9 agree here */
  function fyFor(grade, t) {
    const base = grade === 'S355' ? 355 : 275;
    return t <= 16 ? base : t <= 40 ? base - 10 : base - 20;
  }

  /* ---------- EC3 ---------- */
  const ALPHA = { a0:0.13, a:0.21, b:0.34, c:0.49, d:0.76 };
  function chi(lam, curve) {
    const a = ALPHA[curve];
    const ph = 0.5 * (1 + a * (lam - 0.2) + lam * lam);
    return Math.min(1, 1 / (ph + Math.sqrt(Math.max(ph * ph - lam * lam, 0))));
  }

  function classify(s, fy, N) {
    const eps = Math.sqrt(235 / fy);
    const out = [];
    if (s.family === 'I') {
      const rf = s.cf / s.tf;
      const fCls = rf <= 9 * eps ? 1 : rf <= 10 * eps ? 2 : rf <= 14 * eps ? 3 : 4;
      out.push({ part:'flange outstand', c:s.cf, t:s.tf, ratio:rf, lim:[9 * eps, 10 * eps, 14 * eps], cls:fCls });
      const rw = s.cw / s.tw;
      /* plastic neutral axis position for the web, alpha, and psi for class 3 */
      const Nc = Math.max(N, 0) * 1e3;
      const alpha = Math.min(1, 0.5 * (1 + Nc / (fy * s.tw * s.cw)));
      const sigN = Nc / s.A;
      const sigM = fy - sigN;
      const psi = Math.max(-1, (sigN - sigM) / (sigN + sigM));
      const l1 = alpha > 0.5 ? 396 * eps / (13 * alpha - 1) : 36 * eps / alpha;
      const l2 = alpha > 0.5 ? 456 * eps / (13 * alpha - 1) : 41.5 * eps / alpha;
      const l3 = psi > -1 ? 42 * eps / (0.67 + 0.33 * psi) : 62 * eps * (1 - psi) * Math.sqrt(-psi);
      const wCls = rw <= l1 ? 1 : rw <= l2 ? 2 : rw <= l3 ? 3 : 4;
      out.push({ part: Nc > 0 ? 'web, bending and compression' : 'web in bending', c:s.cw, t:s.tw, ratio:rw, lim:[l1, l2, l3], cls:wCls, alpha, psi });
    } else {
      const r = s.cw / s.t;
      const pure = Math.max(N, 0) > 0;
      const lim = pure ? [33 * eps, 38 * eps, 42 * eps] : [72 * eps, 83 * eps, 124 * eps];
      const cls = r <= lim[0] ? 1 : r <= lim[1] ? 2 : r <= lim[2] ? 3 : 4;
      out.push({ part: pure ? 'wall in compression' : 'wall in bending', c:s.cw, t:s.t, ratio:r, lim, cls });
    }
    return { eps, parts: out, cls: Math.max(...out.map(p => p.cls)) };
  }

  function curves(s) {
    if (s.family === 'SHS') return { y:'a', z:'a', lt:'none' };
    const hb = s.h / s.b;
    return hb > 1.2 ? { y:'a', z:'b', lt: hb <= 2 ? 'b' : 'c' } : { y:'b', z:'c', lt:'b' };
  }

  /* C1 and the equivalent factors for the moment shape between restraints */
  function shape(kind, psi) {
    if (kind === 'udl') return { C1:1.127, kc:0.94, Cm:0.95, mLT:0.925, mx:0.95 };
    if (kind === 'point') return { C1:1.348, kc:0.90, Cm:0.90, mLT:0.85, mx:0.9 };
    if (kind === 'linear') {
      const C1 = Math.min(2.7, 1.88 - 1.40 * psi + 0.52 * psi * psi);
      return { C1, kc: 1 / (1.33 - 0.33 * psi), Cm: Math.max(0.4, 0.6 + 0.4 * psi),
               mLT: Math.max(0.44, 0.6 + 0.4 * psi), mx: Math.max(0.4, 0.6 + 0.4 * psi) };
    }
    return { C1:1, kc:1, Cm:1, mLT:1, mx:1 };
  }

  function ec3(s, inp) {
    const fy = fyFor(inp.grade, s.tmax), fu = inp.grade === 'S355' ? 470 : 410;
    const g0 = 1, g1 = 1, g2 = 1.25;
    const N = inp.N, M = Math.abs(inp.M), V = Math.abs(inp.V);
    const cl = classify(s, fy, N);
    const W = cl.cls <= 2 ? s.Wply : s.Wely;
    const cv = curves(s);
    /* tension, gross yield or net fracture */
    const Anet = s.A - inp.holes * inp.d0 * s.tf;
    const Npl = s.A * fy / g0 / 1e3, Nu = 0.9 * Anet * fu / g2 / 1e3;
    const NtRd = Math.min(Npl, Nu);
    /* compression */
    const Lcy = inp.ky * inp.L * 1000, Lcz = inp.kz * inp.L * 1000 / (inp.nRest + 1);
    const Ncry = Math.PI ** 2 * E * s.Iy / Lcy ** 2, Ncrz = Math.PI ** 2 * E * s.Iz / Lcz ** 2;
    const lamy = Math.sqrt(s.A * fy / Ncry), lamz = Math.sqrt(s.A * fy / Ncrz);
    const chiy = chi(lamy, cv.y), chiz = chi(lamz, cv.z);
    const NRk = s.A * fy / 1e3;
    const Nby = chiy * NRk / g1, Nbz = chiz * NRk / g1;
    /* bending and lateral torsional buckling between lateral restraints */
    const sh = shape(inp.shape, inp.psi);
    const Lb = inp.L * 1000 / (inp.nRest + 1);
    const Mrk = W * fy / 1e6;
    const McRd = Mrk / g0;
    let Mcr = Infinity, lamLT = 0, chiLT = 1, f = 1, chiMod = 1;
    if (s.family === 'I') {
      Mcr = sh.C1 * Math.PI ** 2 * E * s.Iz / Lb ** 2 * Math.sqrt(s.Iw / s.Iz + Lb ** 2 * G * s.It / (Math.PI ** 2 * E * s.Iz)) / 1e6;
      lamLT = Math.sqrt(Mrk / Mcr);
      const aLT = ALPHA[cv.lt], l0 = 0.4, beta = 0.75;
      const ph = 0.5 * (1 + aLT * (lamLT - l0) + beta * lamLT * lamLT);
      chiLT = Math.min(1, 1 / lamLT ** 2, 1 / (ph + Math.sqrt(Math.max(ph * ph - beta * lamLT * lamLT, 0))));
      f = Math.min(1, 1 - 0.5 * (1 - sh.kc) * (1 - 2 * (lamLT - 0.8) ** 2));
      chiMod = Math.min(1, chiLT / f, 1 / lamLT ** 2);
    }
    const MbRd = chiMod * Mrk / g1;
    const VplRd = s.Av * fy / Math.sqrt(3) / g0 / 1e3;
    /* interaction, Annex B, members susceptible to torsional deformation */
    const Nc = Math.max(N, 0);
    const ny = Nc / Nby, nz = Nc / Nbz;
    let kyy, kzy;
    if (cl.cls <= 2) {
      kyy = Math.min(sh.Cm * (1 + (lamy - 0.2) * ny), sh.Cm * (1 + 0.8 * ny));
      kzy = s.family === 'I' ? Math.max(1 - 0.1 * lamz / (sh.Cm - 0.25) * nz, 1 - 0.1 / (sh.Cm - 0.25) * nz) : 0.6 * kyy;
    } else {
      kyy = Math.min(sh.Cm * (1 + 0.6 * lamy * ny), sh.Cm * (1 + 0.6 * ny));
      kzy = s.family === 'I' ? Math.max(1 - 0.05 * lamz / (sh.Cm - 0.25) * nz, 1 - 0.05 / (sh.Cm - 0.25) * nz) : kyy;
    }
    if (s.family === 'I' && lamz < 0.4) kzy = Math.min(kzy, 0.6 + lamz);
    const i61 = ny + kyy * M / MbRd, i62 = nz + kzy * M / MbRd;
    return { code:'ec3', fy, fu, eps:cl.eps, cl, W, cv, Anet, Npl, Nu, NtRd, Lcy, Lcz, Ncry, Ncrz, lamy, lamz, chiy, chiz,
             NRk, Nby, Nbz, Lb, sh, Mrk, McRd, Mcr, lamLT, chiLT, f, chiMod, MbRd, VplRd, kyy, kzy, i61, i62,
             u: { tension: N < 0 ? -N / NtRd : 0, comp: Nc / Math.min(Nby, Nbz), bend: M / MbRd, section: M / McRd,
                  shear: V / VplRd, combined: Math.max(i61, i62) } };
  }

  /* ---------- BS 5950 ---------- */
  const ROB = { a:2.0, b:3.5, c:5.5, d:8.0 };
  function perry(py, lam, a) {
    const pE = Math.PI ** 2 * E / (lam * lam);
    const l0 = 0.2 * Math.sqrt(Math.PI ** 2 * E / py);
    const eta = Math.max(0, a * (lam - l0) / 1000);
    const ph = (py + (eta + 1) * pE) / 2;
    return Math.min(py, pE * py / (ph + Math.sqrt(ph * ph - pE * py)));
  }
  function bs(s, inp) {
    const py = fyFor(inp.grade, s.tmax);
    const N = inp.N, M = Math.abs(inp.M), V = Math.abs(inp.V);
    const eps = Math.sqrt(275 / py);
    let cls;
    if (s.family === 'I') {
      const bT = (s.b / 2) / s.tf, dt = (s.h - 2 * s.tf - 2 * s.r) / s.tw;
      const f = bT <= 9 * eps ? 1 : bT <= 10 * eps ? 2 : bT <= 15 * eps ? 3 : 4;
      const w = dt <= 80 * eps ? 1 : dt <= 100 * eps ? 2 : dt <= 120 * eps ? 3 : 4;
      cls = { parts:[{ part:'flange b/T', ratio:bT, lim:[9 * eps, 10 * eps, 15 * eps], cls:f },
                     { part:'web d/t', ratio:dt, lim:[80 * eps, 100 * eps, 120 * eps], cls:w }], cls:Math.max(f, w) };
    } else {
      const r = (s.b - 3 * s.t) / s.t;
      const c = r <= 28 * eps ? 1 : r <= 32 * eps ? 2 : r <= 40 * eps ? 3 : 4;
      cls = { parts:[{ part:'wall b/t', ratio:r, lim:[28 * eps, 32 * eps, 40 * eps], cls:c }], cls:c };
    }
    const S = s.Wply, Z = s.Wely;
    const Ke = inp.grade === 'S355' ? 1.1 : 1.2;
    const Anet = s.A - inp.holes * inp.d0 * s.tf;
    const Pt = py * Math.min(Ke * Anet, s.A) / 1e3;
    const LEx = inp.ky * inp.L * 1000, LEy = inp.kz * inp.L * 1000 / (inp.nRest + 1);
    const lx = LEx / s.iy, ly = LEy / s.iz;
    const cx = s.family === 'SHS' ? 'a' : 'a', cy = s.family === 'SHS' ? 'a' : (s.h / s.b > 1.2 ? 'b' : 'c');
    const pcx = perry(py, lx, ROB[cx]), pcy = perry(py, ly, ROB[cy]);
    const Pcx = s.A * pcx / 1e3, Pcy = s.A * pcy / 1e3;
    const Mc = Math.min(cls.cls <= 2 ? py * S : py * Z, 1.2 * py * Z) / 1e6;
    const sh = shape(inp.shape, inp.psi);
    let Mb = Mc, lamLT = 0, pb = py, v = 1;
    if (s.family === 'I') {
      const LE = inp.L * 1000 / (inp.nRest + 1);
      const lam = LE / s.iz, x = s.h / s.tf;
      v = 1 / Math.pow(1 + 0.05 * (lam / x) ** 2, 0.25);
      lamLT = 0.9 * v * lam;
      const pE = Math.PI ** 2 * E / (lamLT * lamLT), lL0 = 0.4 * Math.sqrt(Math.PI ** 2 * E / py);
      const eta = Math.max(0, 0.007 * (lamLT - lL0));
      const ph = (py + (eta + 1) * pE) / 2;
      pb = Math.min(py, pE * py / (ph + Math.sqrt(ph * ph - pE * py)));
      Mb = (cls.cls <= 2 ? pb * S : pb * Z) / 1e6;
    }
    const Pv = 0.6 * py * (s.family === 'I' ? s.h * s.tw : s.A / 2) / 1e3;
    const Fc = Math.max(N, 0);
    const i1 = Fc / Math.min(Pcx, Pcy) + sh.mx * M / (py * Z / 1e6);
    const i2 = Fc / Pcy + sh.mLT * M / Mb;
    return { code:'bs', fy:py, eps, cl:cls, Ke, Anet, Pt, lx, ly, pcx, pcy, Pcx, Pcy, Mc, lamLT, pb, v, Mb, Pv, sh, i1, i2,
             u: { tension: N < 0 ? -N / Pt : 0, comp: Fc / Math.min(Pcx, Pcy), bend: sh.mLT * M / Mb, section: M / Mc,
                  shear: V / Pv, combined: Math.max(i1, i2) } };
  }

  function solve(inp) {
    const s = section(inp.family, inp.idx);
    const r = inp.code === 'bs' ? bs(s, inp) : ec3(s, inp);
    return Object.assign({ s }, r);
  }

  return { solve, section, iSection, shs, fyFor, classify, chi, curves, shape, perry, ec3, bs, TABLE, ALPHA, E, G };
})();
if (typeof module !== 'undefined') module.exports = SteelEngine;
