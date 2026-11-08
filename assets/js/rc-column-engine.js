/* CivilLab · RCColumnEngine
   Reinforced concrete column design, EN 1992-1-1 with the UK NA against BS 8110-1.
   Units: mm, MPa, kN, kN·m, effective length in m.
   Signs: N positive in COMPRESSION (the column convention, opposite to the
   tension positive stress convention elsewhere in the suite). M positive when
   it compresses the top face. Section depth h is measured in the direction of
   bending, y down from the compression face, x across the width b.
   EC2: rectangular block eta·fcd over lambda·x, lambda = 0.8, eta = 1 (fck <= 50),
        fcd = 0.85 fck/1.5, fyd = fyk/1.15, eps_cu3 = 0.0035. When x > h the
        strain pivots about 3h/7 where it is held at eps_c2 = 0.002 (EC2 Fig 6.1).
   BS 8110: block 0.45 fcu over 0.9x, steel 0.87 fy, eps_cu = 0.0035, fcu = fck + 5,
        no pivot, so the sweep tends to Nuz = 0.45 fcu Ac + 0.87 fy Asc.
   Steel inside the compression block has the displaced concrete stress removed.
   Slenderness: EC2 5.8.3.1 and the nominal curvature method 5.8.8.
   BS 8110 3.8.1.3 and the additional moment 3.8.3. Biaxial: EC2 5.8.9(4)
   and BS 8110 3.8.4.5. */
const RCColumnEngine = (() => {
  const ES = 200000, ECU = 0.0035, EC2 = 0.002;

  function material(code, fck, fyk) {
    if (code === 'bs') {
      const fcu = fck + 5;
      return { code, fck, fyk, fcu, fc: 0.45 * fcu, lam: 0.9, fyd: 0.87 * fyk, pivot: false,
               fcd: 0.45 * fcu };
    }
    const fcd = 0.85 * fck / 1.5;
    return { code: 'ec2', fck, fyk, fcu: fck + 5, fc: fcd, lam: 0.8, fyd: fyk / 1.15, pivot: true, fcd };
  }

  /* bars around the perimeter: nx along each b face (corners included),
     ny along each h face (corners included). Layers run down the depth h. */
  function layout(p) {
    const nx = Math.max(2, Math.round(p.nx)), ny = Math.max(2, Math.round(p.ny));
    const d2 = p.cover + (p.link == null ? 10 : p.link) + p.phi / 2;
    const Ab = Math.PI * p.phi * p.phi / 4;
    const bars = [], layers = [];
    for (let j = 0; j < ny; j++) {
      const y = d2 + (p.h - 2 * d2) * j / (ny - 1);
      const n = (j === 0 || j === ny - 1) ? nx : 2;
      const xs = n === 2 && nx > 2 && j > 0 && j < ny - 1 ? [d2, p.b - d2]
        : Array.from({ length: n }, (_, i) => d2 + (p.b - 2 * d2) * i / (n - 1));
      xs.forEach(x => bars.push({ x, y, A: Ab }));
      layers.push({ y, As: n * Ab });
    }
    const As = bars.length * Ab;
    return { bars, layers, As, n: bars.length, d2, d: p.h - d2, Ab };
  }

  /* resultant N, M for neutral axis depth x */
  function section(b, h, layers, m, x) {
    const strain = y => {
      if (m.pivot && x > h) return EC2 * (x - y) / (x - 3 * h / 7);
      return ECU * (x - y) / x;
    };
    const a = Math.min(m.lam * x, h);
    const Fc = m.fc * b * a;
    let N = Fc, M = Fc * (h / 2 - a / 2);
    const steel = layers.map(L => {
      const e = strain(L.y);
      let sg = Math.max(-m.fyd, Math.min(m.fyd, ES * e));
      const net = L.y < a ? sg - m.fc : sg;
      const F = net * L.As;
      N += F; M += F * (h / 2 - L.y);
      return { y: L.y, e, sg, F: F / 1e3 };
    });
    return { x, a, N: N / 1e3, M: M / 1e6, Fc: Fc / 1e3, steel,
             etop: strain(0), ebot: strain(h) };
  }

  const xMin = h => h * 1e-5, xMax = h => h * 1e4;

  /* x for which N(x) = target, by bisection in log x (N rises with x) */
  function xForN(b, h, layers, m, target) {
    let lo = Math.log(xMin(h)), hi = Math.log(xMax(h));
    const Nlo = section(b, h, layers, m, Math.exp(lo)).N, Nhi = section(b, h, layers, m, Math.exp(hi)).N;
    if (target < Nlo || target > Nhi) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (section(b, h, layers, m, Math.exp(mid)).N < target) lo = mid; else hi = mid;
    }
    return Math.exp((lo + hi) / 2);
  }

  function interaction(b, h, lay, m) {
    const pts = [];
    const n = 160, l0 = Math.log(xMin(h) * 10), l1 = Math.log(h * 40);
    const Nt = -lay.As * m.fyd / 1e3;
    pts.push({ x: 0, N: Nt, M: 0 });
    for (let i = 0; i <= n; i++) {
      const x = Math.exp(l0 + (l1 - l0) * i / n), r = section(b, h, lay.layers, m, x);
      pts.push({ x, N: r.N, M: r.M });
    }
    const top = section(b, h, lay.layers, m, xMax(h));
    pts.push({ x: Infinity, N: top.N, M: top.M });
    const dEff = Math.max(...lay.layers.map(L => L.y));
    const xb = ECU / (ECU + m.fyd / ES) * dEff;
    const bal = section(b, h, lay.layers, m, xb);
    const x0 = xForN(b, h, lay.layers, m, 0);
    const pure = x0 ? section(b, h, lay.layers, m, x0) : { M: 0, x: 0 };
    return { pts, N0: top.N, Nt, bal: { x: xb, N: bal.N, M: bal.M },
             pureM: pure.M, xPure: pure.x,
             MRd(N) { const x = xForN(b, h, lay.layers, m, N);
                      return x == null ? null : section(b, h, lay.layers, m, x); } };
  }

  /* EC2 5.8.9(4) exponent */
  function biaxialA(ratio) {
    const r = Math.max(0, ratio);
    if (r <= 0.1) return 1;
    if (r <= 0.7) return 1 + (r - 0.1) / 0.6 * 0.5;
    if (r <= 1) return 1.5 + (r - 0.7) / 0.3 * 0.5;
    return 2;
  }
  /* BS 8110 Table 3.22 */
  function bsBeta(ratio) {
    const T = [[0, 1], [0.1, 0.88], [0.2, 0.77], [0.3, 0.65], [0.4, 0.53], [0.5, 0.42], [0.6, 0.3]];
    const r = Math.max(0, ratio);
    if (r >= 0.6) return 0.3;
    for (let i = 1; i < T.length; i++)
      if (r <= T[i][0]) return T[i - 1][1] + (r - T[i - 1][0]) / (T[i][0] - T[i - 1][0]) * (T[i][1] - T[i - 1][1]);
    return 0.3;
  }

  /* EC2 slenderness and design moment about one axis. h is the depth in the
     plane of bending, d the effective depth, M the larger end moment */
  function ec2Slender(p) {
    const { b, h, d, As, fck, fyk, NEd, M, l0, rm, phiEf } = p;
    const fcd = 0.85 * fck / 1.5, fyd = fyk / 1.15, Ac = b * h;
    const i = h / Math.sqrt(12), lam = l0 * 1000 / i;
    const n = NEd * 1e3 / (Ac * fcd);
    const om = As * fyd / (Ac * fcd);
    const A = 1 / (1 + 0.2 * phiEf), B = Math.sqrt(1 + 2 * om), Cc = 1.7 - rm;
    const lamLim0 = 20 * 0.7 * 1.1 * 0.7 / Math.sqrt(Math.max(n, 1e-9));
    const lamLim = 20 * A * B * Cc / Math.sqrt(Math.max(n, 1e-9));
    const slender = lam > lamLim;
    const ei = l0 * 1000 / 400;
    const e0 = Math.max(h / 30, 20);
    const M02 = Math.abs(M) + NEd * ei / 1000;
    const M01 = rm * Math.abs(M) + NEd * ei / 1000;
    const Mmin = NEd * e0 / 1000;
    let e2 = 0, M2 = 0, Kr = 0, Kphi = 1, beta = 0, r0inv = 0, rinv = 0, nu = 1 + om, M0e = M02;
    let MEd;
    if (slender) {
      nu = 1 + om;
      Kr = Math.min(1, Math.max(0, (nu - n) / (nu - 0.4)));
      beta = 0.35 + fck / 200 - lam / 150;
      Kphi = Math.max(1, 1 + beta * phiEf);
      r0inv = (fyd / ES) / (0.45 * d);
      rinv = Kr * Kphi * r0inv;
      e2 = rinv * Math.pow(l0 * 1000, 2) / 10;
      M2 = NEd * e2 / 1000;
      M0e = Math.max(0.6 * M02 + 0.4 * M01, 0.4 * M02);
      MEd = Math.max(M0e + M2, M02, M01 + 0.5 * M2, Mmin);
    } else {
      MEd = Math.max(M02, Mmin);
    }
    return { i, lam, n, om, lamLim, lamLim0, A, B, C: Cc, slender, ei, e0, M02, M01, Mmin,
             nu, Kr, beta, Kphi, r0inv, rinv, e2, M2, M0e, MEd };
  }

  /* BS 8110 3.8.1.3 and 3.8.3, braced column */
  function bsSlender(p) {
    const { b, h, d, As, fck, fyk, NEd, M, l0, bMin } = p;
    const fcu = fck + 5, Ac = b * h;
    const ratio = l0 * 1000 / h;
    const slender = ratio > 15;
    const Nuz = (0.45 * fcu * (Ac - As) + 0.87 * fyk * As) / 1e3;
    const Nbal = 0.25 * fcu * b * d / 1e3;
    const K = Math.min(1, Math.max(0, (Nuz - NEd) / Math.max(Nuz - Nbal, 1e-9)));
    const bp = bMin == null ? h : bMin;
    const betaA = Math.pow(l0 * 1000 / bp, 2) / 2000;
    const au = slender ? betaA * K * h : 0;
    const Madd = NEd * au / 1000;
    const emin = Math.min(0.05 * h, 20);
    const Mt = Math.max(Math.abs(M) + Madd, NEd * emin / 1000);
    return { ratio, slender, Nuz, Nbal, K, betaA, au, Madd, emin, Mt };
  }

  /* everything the app needs for one column */
  function solve(inp) {
    const code = inp.code === 'bs' ? 'bs' : 'ec2';
    const m = material(code, inp.fck, inp.fyk);
    const layX = layout({ b: inp.b, h: inp.h, cover: inp.cover, link: inp.link, phi: inp.phi, nx: inp.nx, ny: inp.ny });
    const layY = layout({ b: inp.h, h: inp.b, cover: inp.cover, link: inp.link, phi: inp.phi, nx: inp.ny, ny: inp.nx });
    const ix = interaction(inp.b, inp.h, layX, m);
    const iy = interaction(inp.h, inp.b, layY, m);
    const Ac = inp.b * inp.h, As = layX.As;
    const NEd = inp.NEd;

    let sx, sy, MEdx, MEdy;
    if (code === 'ec2') {
      sx = ec2Slender({ b: inp.b, h: inp.h, d: layX.d, As, fck: inp.fck, fyk: inp.fyk, NEd,
                        M: inp.Mx, l0: inp.l0, rm: inp.rm, phiEf: inp.phiEf });
      sy = ec2Slender({ b: inp.h, h: inp.b, d: layY.d, As, fck: inp.fck, fyk: inp.fyk, NEd,
                        M: inp.My, l0: inp.l0, rm: inp.rm, phiEf: inp.phiEf });
      /* EC2 5.8.9(3): the imperfection need only act in one direction. It is
         put on the major axis, so the minor axis carries its own first order
         moment plus any second order moment */
      MEdx = sx.MEd; MEdy = Math.abs(inp.My) + sy.M2;
    } else {
      sx = bsSlender({ b: inp.b, h: inp.h, d: layX.d, As, fck: inp.fck, fyk: inp.fyk, NEd,
                       M: inp.Mx, l0: inp.l0, bMin: Math.min(inp.b, inp.h) });
      sy = bsSlender({ b: inp.h, h: inp.b, d: layY.d, As, fck: inp.fck, fyk: inp.fyk, NEd,
                       M: inp.My, l0: inp.l0, bMin: Math.min(inp.b, inp.h) });
      MEdx = sx.Mt; MEdy = Math.abs(inp.My) + sy.Madd;
    }

    const capX = ix.MRd(NEd), capY = iy.MRd(NEd);
    const MRdx = capX ? capX.M : 0, MRdy = capY ? capY.M : 0;
    const NRd = (Ac * m.fc + As * m.fyd) / 1e3;
    const axialUtil = NEd / ix.N0;
    const ux = MRdx > 1e-9 ? MEdx / MRdx : (NEd > ix.N0 || NEd < ix.Nt ? Infinity : 0);
    const uy = MRdy > 1e-9 ? MEdy / MRdy : (MEdy > 0 ? Infinity : 0);

    let biax;
    if (code === 'ec2') {
      const a = biaxialA(NEd / NRd);
      const util = Math.pow(Math.max(ux, 0), a) + Math.pow(Math.max(uy, 0), a);
      biax = { a, util, ratio: NEd / NRd };
    } else {
      /* BS: enhance the moment about the axis with the larger M/h' */
      const hp = layX.d, bp = layY.d;
      const ratio = NEd * 1e3 / (Ac * (inp.fck + 5));
      const be = bsBeta(ratio);
      let Menh, about;
      if (MEdx / hp >= MEdy / bp) { Menh = MEdx + be * hp / bp * MEdy; about = 'x'; }
      else { Menh = MEdy + be * bp / hp * MEdx; about = 'y'; }
      const cap = about === 'x' ? MRdx : MRdy;
      biax = { beta: be, Menh, about, util: cap > 1e-9 ? Menh / cap : Infinity, ratio };
    }

    const fyd = inp.fyk / 1.15;
    const AsMin = Math.max(0.10 * NEd * 1e3 / fyd, 0.002 * Ac);
    const AsMax = 0.04 * Ac;

    return { code, m, layX, layY, ix, iy, Ac, As, rho: As / Ac, NEd, sx, sy,
             MEdx, MEdy, MRdx, MRdy, capX, capY, NRd, axialUtil, ux, uy, biax,
             AsMin, AsMax };
  }

  return { solve, material, layout, section, interaction, xForN, ec2Slender, bsSlender,
           biaxialA, bsBeta, ES, ECU, EC2 };
})();
if (typeof module !== 'undefined') module.exports = RCColumnEngine;
