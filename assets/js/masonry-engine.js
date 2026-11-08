/* CivilLab · MasonryEngine
   Unreinforced masonry walls, EN 1996-1-1 against BS 5628-1.
   Units: mm for thickness, m for height and length, kN/m and kN/m2 for loads,
   MPa for strength. Vertical load N is per metre run and positive in compression.
   Vertical, EC6: fk = K fb^0.7 fm^0.3 (eq 3.1, recommended K), fd = fk/gamma_M,
     hef = rho_n h (5.5.1.2), tef from 5.5.1.3, ei = M/N + einit >= 0.05t with
     einit = hef/450, Phi_i = 1 - 2ei/t, and at mid height Annex G:
     Phi_m = A1 exp(-u^2/2), A1 = 1 - 2emk/t, u = (lambda - 0.063)/(0.73 - 1.17emk/t),
     lambda = (hef/tef) sqrt(fk/E) with E = 1000 fk, NRd = Phi t fd.
   Vertical, BS 5628-1: beta = 1.1(1 - 2em/t), em = 0.6ex + ea,
     ea = t[(hef/tef)^2/2400 - 0.015], ex >= 0.05t (Annex B), N = beta t fk/gamma_m.
     The same fk is used so that only the method differs.
   Lateral: the bending coefficient alpha2 for a panel simply supported on four
     edges comes from yield line theory through the affinity theorem, which is
     the basis of EC6 Annex E and BS 5628 Table 9. Precompression adds to the
     flexural strength parallel to the bed joints (EC6 6.3.1(3)). Arching uses a
     three pin arch with the EC6 6.3.2 thrust Nad = 1.5 fd t/10 and rise 0.9t. */
const MasonryEngine = (() => {
  const K = { clay1:0.55, clay2:0.45, conc1:0.55, conc2:0.52, cs1:0.55 };

  function fk(unit, fb, fm) {
    const k = K[unit] || 0.55, fmU = Math.min(fm, 20, 2 * fb);
    return { K:k, fk: k * Math.pow(fb, 0.7) * Math.pow(fmU, 0.3) };
  }

  function hef(h, L, rho2, sides) {
    let rho = rho2;
    if (sides === 4) rho = h <= L ? rho2 / (1 + (rho2 * h / L) ** 2) : 0.5 * L / h;
    else if (sides === 3) rho = h <= 3.5 * L ? rho2 / (1 + (rho2 * h / (3 * L)) ** 2) : 1.5 * L / h;
    return { rho, hef: rho * h * 1000 };
  }

  const tef = (t, t2, cavity, kt) => cavity ? Math.cbrt((kt || 1) * t ** 3 + t2 ** 3) : t;

  function phiG(SR, fkv, emk, t) {
    const lam = SR * Math.sqrt(fkv / (1000 * fkv));
    const A1 = 1 - 2 * emk / t;
    const u = (lam - 0.063) / (0.73 - 1.17 * emk / t);
    return { lam, A1, u, phim: Math.max(0, A1 * Math.exp(-u * u / 2)) };
  }

  function vertical(p) {
    const f = fk(p.unit, p.fb, p.fm);
    const H = hef(p.h, p.L, p.rho2, p.sides);
    const te = tef(p.t, p.t2, p.cavity);
    const tL = p.t;                      // loaded leaf
    const SR = H.hef / te;
    const N = p.N;
    if (p.code === 'bs') {
      const ex = Math.max(p.e, 0.05 * tL);
      const ea = Math.max(0, tL * (SR * SR / 2400 - 0.015));
      const em = 0.6 * ex + ea;
      const beta = Math.max(0, Math.min(1, 1.1 * (1 - 2 * em / tL), 1.1 * (1 - 2 * ex / tL)));
      const NR = beta * tL * f.fk / p.gM;
      return { code:'bs', K:f.K, fk:f.fk, fd:f.fk / p.gM, rho:H.rho, hef:H.hef, tef:te, SR, ex, ea, em, beta,
               Phi:beta, NRd:NR, util:N / NR, slender: SR / 27 };
    }
    const fd = f.fk / p.gM;
    const einit = H.hef / 450;
    const ei = Math.max(p.e + einit, 0.05 * tL);
    const phiI = Math.max(0, 1 - 2 * ei / tL);
    const em = 0.6 * p.e + einit;
    const ek = SR > 15 ? 0.002 * (p.creep || 1) * SR * Math.sqrt(tL * Math.max(em, 0)) : 0;
    const emk = Math.max(em + ek, 0.05 * tL);
    const g = phiG(SR, f.fk, emk, tL);
    const Phi = Math.min(phiI, g.phim);
    const NRd = Phi * tL * fd;
    return { code:'ec6', K:f.K, fk:f.fk, fd, rho:H.rho, hef:H.hef, tef:te, SR, einit, ei, phiI, em, ek, emk,
             lam:g.lam, A1:g.A1, u:g.u, phim:g.phim, Phi, NRd, util:N / NRd, slender: SR / 27,
             govern: phiI <= g.phim ? 'top' : 'mid height' };
  }

  /* isotropic simply supported a x b slab by yield lines: q = 24m / (b^2 (sqrt(3 + (b/a)^2) - b/a)^2), b <= a */
  function ssSlab(a, b) {
    const s = Math.min(a, b), l = Math.max(a, b), r = s / l;
    return 24 / (s * s * (Math.sqrt(3 + r * r) - r) ** 2);
  }

  /* panel L long, h high, simply supported on four edges. m2 is the moment of
     resistance for horizontal spanning (failure perpendicular to the bed
     joints), m1 = mu m2 for vertical spanning. Affinity: the vertical
     dimension becomes h / sqrt(mu) in an isotropic slab of strength m2 */
  function yieldLine(L, h, mu) {
    const qOverM = ssSlab(L, h / Math.sqrt(mu));
    return { qOverM, alpha2: 1 / (qOverM * L * L) };
  }

  function lateral(p) {
    const tL = p.t;
    const Z = tL * tL / 6;                       // mm3 per mm run
    const gM = p.gM;
    const sigd = p.code === 'bs' ? Math.max(0, p.Ngk) / tL : Math.max(0, p.Ngk) / tL;   // N/mm2 from kN/m over mm
    const fx1 = p.fxk1 / gM + sigd, fx2 = p.fxk2 / gM;
    const m1 = fx1 * Z / 1e3, m2 = fx2 * Z / 1e3;   // kN m per m
    const mu = fx1 / fx2;
    const W = p.W, L = p.L, h = p.h;
    let qR, alpha2 = null, mode, Nad, r;
    if (p.span === 'vertical') { qR = 8 * m1 / (h * h); mode = 'spans vertically'; }
    else if (p.span === 'horizontal') { qR = 8 * m2 / (L * L); mode = 'spans horizontally'; }
    else if (p.span === 'four') {
      const y = yieldLine(L, h, mu);
      alpha2 = y.alpha2; qR = m2 * y.qOverM; mode = 'two way, yield lines';
    } else {
      const f = fk(p.unit, p.fb, p.fm);
      const fd = f.fk / gM;
      Nad = 1.5 * fd * tL / 10;                 // N per mm run
      r = 0.9 * tL;
      qR = 8 * Nad * r / (h * h * 1e6) * 1e3;   // kN/m2
      mode = 'arching between rigid supports';
    }
    return { sigd, fx1, fx2, Z, m1, m2, mu, alpha2, qR, mode, Nad, r, util: W / qR,
             MEd2: alpha2 != null ? alpha2 * W * L * L : null };
  }

  return { fk, hef, tef, phiG, vertical, lateral, yieldLine, ssSlab, K };
})();
if (typeof module !== 'undefined') module.exports = MasonryEngine;
