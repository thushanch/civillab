/* CivilLab · TimberEngine
   Solid timber members, EN 1995-1-1 with the UK NA against BS 5268-2.
   Units: mm for the section, m for spans, kN/m and kN for loads, MPa.
   Actions are CHARACTERISTIC. EC5 is a limit state code, so it multiplies them
   by gamma_F. BS 5268 is a permissible stress code and uses them unfactored.
   Axial N is positive in compression.
   EC5: strengths from EN 338:2009, f_d = kmod k_h k_sys f_k / gamma_M with
     gamma_M = 1.3, kmod Table 3.1, k_h 3.2(3), k_sys 6.6, k_cr = 0.67 for shear,
     k_crit 6.3.3 with l_ef = 0.9L + 2h for a UDL on the compression edge, k_c
     6.3.2 with beta_c = 0.2, bearing 6.1.5 with 30 mm added each side, the
     combined checks 6.19 to 6.24 with k_m = 0.7.
   BS 5268-2: grade stresses Table 8, K2 wet exposure Table 16, K3 duration
     Table 17, K7 depth 2.10.6, K8 load sharing 2.9, K12 from Annex B with
     eta = 0.005 lambda, combined 2.11.6, depth to breadth limits Table 19. */
const TimberEngine = (() => {
  const CLASSES = {
    C16: { fm:16, ft0:10, fc0:17, fc90:2.2, fv:3.2, E0:8000, E05:5400, rhok:310,
           bs:{ m:5.3, t:3.2, c:6.8, cp:2.2, v:0.67, E:8800, Emin:5800 } },
    C24: { fm:24, ft0:14, fc0:21, fc90:2.5, fv:4.0, E0:11000, E05:7400, rhok:350,
           bs:{ m:7.5, t:4.5, c:7.9, cp:2.4, v:0.71, E:10800, Emin:7200 } },
    C30: { fm:30, ft0:18, fc0:23, fc90:2.7, fv:4.0, E0:12000, E05:8000, rhok:380,
           bs:{ m:11.0, t:6.6, c:8.6, cp:2.7, v:0.67, E:12300, Emin:8200 } },
    D30: { fm:30, ft0:18, fc0:23, fc90:8.0, fv:4.0, E0:10000, E05:8000, rhok:530,
           bs:{ m:9.0, t:5.4, c:8.1, cp:2.8, v:1.4, E:9500, Emin:6000 } },
    D40: { fm:40, ft0:24, fc0:26, fc90:8.8, fv:4.0, E0:11000, E05:9400, rhok:590,
           bs:{ m:12.5, t:7.5, c:12.6, cp:3.9, v:2.0, E:10800, Emin:7500 } }
  };
  const KMOD = { 1:{ permanent:0.6, long:0.7, medium:0.8, short:0.9, inst:1.1 },
                 2:{ permanent:0.6, long:0.7, medium:0.8, short:0.9, inst:1.1 },
                 3:{ permanent:0.5, long:0.55, medium:0.65, short:0.7, inst:0.9 } };
  const K3 = { permanent:1.0, long:1.0, medium:1.25, short:1.5, inst:1.75 };
  const K2 = { m:0.8, t:0.8, c:0.6, cp:0.6, v:0.9, E:0.8 };
  const GM = 1.3;

  const kh = h => Math.min(Math.pow(150 / Math.min(h, 150), 0.2), 1.3);

  function kcrit(lamRel) {
    if (lamRel <= 0.75) return 1;
    if (lamRel <= 1.4) return 1.56 - 0.75 * lamRel;
    return 1 / (lamRel * lamRel);
  }
  function kc(lamRel) {
    const k = 0.5 * (1 + 0.2 * (lamRel - 0.3) + lamRel * lamRel);
    return Math.min(1, 1 / (k + Math.sqrt(Math.max(k * k - lamRel * lamRel, 0))));
  }
  function k12(sigC, Emin, lam) {
    const se = Math.PI ** 2 * Emin / (lam * lam), eta = 0.005 * lam;
    const a = 0.5 + (1 + eta) * se / (2 * sigC);
    return { K12: Math.min(1, a - Math.sqrt(Math.max(a * a - se / sigC, 0))), se, eta };
  }

  function actions(inp, gF) {
    const L = inp.L;
    return { M: gF * inp.wk * L * L / 8, V: gF * inp.wk * L / 2, N: gF * inp.Nk, F: gF * inp.wk * L / 2 };
  }

  function ec5(inp) {
    const c = CLASSES[inp.cls], b = inp.b, h = inp.h;
    const km = KMOD[inp.service][inp.duration];
    const k_h = kh(h), ks = inp.ksys ? 1.1 : 1;
    const A = b * h, Wy = b * h * h / 6;
    const a = actions(inp, inp.gF);
    const fmd = km * k_h * ks * c.fm / GM;
    const ftd = km * k_h * c.ft0 / GM;
    const fc0d = km * c.fc0 / GM, fc90d = km * c.fc90 / GM, fvd = km * c.fv / GM;
    /* bending with lateral torsional buckling */
    const sm = a.M * 1e6 / Wy;
    const lef = 0.9 * inp.L * 1000 + 2 * h;
    const scrit = 0.78 * b * b * c.E05 / (h * lef);
    const lamM = Math.sqrt(c.fm / scrit);
    const kcr = kcrit(lamM);
    /* shear and bearing */
    const tau = 1.5 * a.V * 1e3 / (0.67 * b * h);
    const lb = inp.lb + Math.min(30, inp.lb) * 2;
    const sc90 = a.F * 1e3 / (b * lb);
    /* axial, buckling about both axes */
    const lefC = inp.kLe * inp.L * 1000;
    const iy = h / Math.sqrt(12), iz = b / Math.sqrt(12);
    const lamy = lefC / iy, lamz = lefC / iz;
    const rel = l => l / Math.PI * Math.sqrt(c.fc0 / c.E05);
    const lry = rel(lamy), lrz = rel(lamz);
    const kcy = kc(lry), kcz = kc(lrz);
    const sc = Math.max(a.N, 0) * 1e3 / A, st = Math.max(-a.N, 0) * 1e3 / A;
    const comp = sc > 0 ? Math.max(sc / (kcy * fc0d) + sm / fmd, sc / (kcz * fc0d) + 0.7 * sm / fmd) : 0;
    const tens = st > 0 ? st / ftd + sm / fmd : 0;
    return { code:'ec5', c, km, k_h, ks, gF:inp.gF, a, A, Wy, fmd, ftd, fc0d, fc90d, fvd, sm, lef, scrit, lamM, kcr,
             tau, lb, sc90, lefC, lamy, lamz, lry, lrz, kcy, kcz, sc, st,
             u:{ bend: sm / fmd, ltb: sm / (kcr * fmd), shear: tau / fvd, bearing: sc90 / (inp.kc90 * fc90d),
                 comp, tension: tens, column: sc > 0 ? sc / (Math.min(kcy, kcz) * fc0d) : 0 } };
  }

  function bs(inp) {
    const c = CLASSES[inp.cls].bs, b = inp.b, h = inp.h;
    const k3 = K3[inp.duration], wet = inp.service === 3;
    const f = k => wet ? K2[k] : 1;
    const k7 = h <= 72 ? 1.17 : h < 300 ? Math.pow(300 / h, 0.11) : 1;
    const k8 = inp.ksys ? 1.1 : 1;
    const a = actions(inp, 1);
    const A = b * h, Z = b * h * h / 6;
    const smAdm = c.m * f('m') * k3 * k7 * k8, sm = a.M * 1e6 / Z;
    const vAdm = c.v * f('v') * k3 * k8, tau = 1.5 * a.V * 1e3 / A;
    const cpAdm = c.cp * f('cp') * k3 * k8, scp = a.F * 1e3 / (b * inp.lb);
    const Emin = (inp.ksys ? c.E : c.Emin) * f('E');
    const lefC = inp.kLe * inp.L * 1000;
    const lam = lefC / (Math.min(b, h) / Math.sqrt(12));
    const cAdmRaw = c.c * f('c') * k3 * k8;
    const kk = k12(cAdmRaw, Emin, lam);
    const cAdm = cAdmRaw * kk.K12;
    const sc = Math.max(a.N, 0) * 1e3 / A;
    const comb = sc > 0 ? sm / (smAdm * (1 - 1.5 * sc / kk.se * kk.K12)) + sc / cAdm : 0;
    /* Table 19, depth to breadth ratio by lateral support */
    const LIM = { none:2, ends:3, edge:4, joists:5, both:6 };
    const hb = h / b, lim = LIM[inp.lateral] || 2;
    return { code:'bs', c, k3, k7, k8, wet, a, A, Z, smAdm, sm, vAdm, tau, cpAdm, scp, Emin, lam, cAdmRaw,
             K12:kk.K12, se:kk.se, eta:kk.eta, cAdm, sc, comb, hb, lim,
             u:{ bend: sm / smAdm, ltb: hb / lim, shear: tau / vAdm, bearing: scp / cpAdm,
                 comp: comb, tension: 0, column: sc > 0 ? sc / cAdm : 0 } };
  }

  function solve(inp) { return inp.code === 'bs' ? bs(inp) : ec5(inp); }

  return { solve, ec5, bs, kh, kcrit, kc, k12, CLASSES, KMOD, K3, K2, GM };
})();
if (typeof module !== 'undefined') module.exports = TimberEngine;
