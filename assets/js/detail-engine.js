/* CivilLab · DetailEngine
   Reinforcement detailing, EN 1992-1-1 and EN 1992-1-2 against BS 8110-1.
   Units: mm, MPa. Fire periods in minutes (R30 to R240).
   Anchorage: EC2 8.4. fbd = 2.25 eta1 eta2 fctd with fctd = fctk,0.05/1.5,
     lb,rqd = (phi/4)(sigma_sd/fbd), lbd = a1 a2 a3 a4 a5 lb,rqd >= lb,min,
     a2 a3 a5 >= 0.7, laps l0 = a1 a2 a3 a5 a6 lb,rqd >= l0,min (8.7.3).
     BS 8110 3.12.8: l = phi fs / (4 fbu), fbu = beta sqrt(fcu), beta = 0.5 in
     tension and 0.63 in compression for type 2 deformed bars, fcu = fck + 5.
   Cover: EC2 4.4.1, cnom = cmin + 10 with cmin = max(cmin,b, cmin,dur, 10).
     cmin,dur from the recommended Table 4.4N at the structural class of
     Table 4.3N (S4 for 50 years). The UK NA sends designers to BS 8500,
     which links cover to the concrete strength in more detail.
     Fire: EN 1992-1-2 tabulated axis distance, simply supported slabs
     Table 5.8 and beams Table 5.5. BS 8110 Tables 3.3 and 3.4.
   Spacing: EC2 8.2(2), clear gap >= max(phi, dg + 5, 20).
   The nominal cover is to the outermost steel, the links in a beam and the
   main bars in a slab. */
const DetailEngine = (() => {
  const GC = 1.5, GS = 1.15;

  function bond(p) {
    const fck = p.fck, phi = p.phi;
    const fctm = 0.30 * Math.pow(fck, 2 / 3);
    const fctk = 0.7 * fctm;
    const fctd = fctk / GC;
    const eta1 = p.bond === 'poor' ? 0.7 : 1.0;
    const eta2 = phi <= 32 ? 1.0 : (132 - phi) / 100;
    return { fctm, fctk, fctd, eta1, eta2, fbd: 2.25 * eta1 * eta2 * fctd };
  }

  const cl = (v, a, b) => Math.max(a, Math.min(b, v));

  function anchor(p) {
    const phi = p.phi, tension = p.tension !== false;
    const fyd = p.fyk / GS;
    const ssd = (p.stress == null ? 1 : p.stress) * fyd;
    if (p.code === 'bs') {
      const fcu = p.fck + 5, beta = tension ? 0.5 : 0.63;
      const fbu = beta * Math.sqrt(fcu);
      const fs = (p.stress == null ? 1 : p.stress) * 0.87 * p.fyk;
      const l = phi * fs / (4 * fbu);
      /* lap factors, BS 8110 3.12.8.13: 1.4 for a top bar in a deep pour or
         cover under 2 phi at a corner, 2.0 when both apply */
      const topPour = p.bond === 'poor', thin = p.cd < 2 * phi;
      const lapF = topPour && thin ? 2.0 : (topPour || thin ? 1.4 : 1.0);
      const lap = Math.max(lapF * l, 15 * phi, 300);
      return { code:'bs', fcu, beta, fbu, fs, lbrqd: l, lbd: l, lbmin: 0,
               lapF, l0: lap, l0min: Math.max(15 * phi, 300), mult: l / phi };
    }
    const b = bond(p);
    const lbrqd = phi / 4 * ssd / b.fbd;
    const cd = p.cd;
    const bent = p.shape === 'bent';
    let a1 = 1, a2 = 1;
    if (tension) {
      a1 = bent && cd > 3 * phi ? 0.7 : 1.0;
      a2 = bent ? cl(1 - 0.15 * (cd - 3 * phi) / phi, 0.7, 1) : cl(1 - 0.15 * (cd - phi) / phi, 0.7, 1);
    }
    const a3 = tension ? cl(1 - (p.K || 0) * (p.lambda || 0), 0.7, 1) : 1;
    const a4 = p.welded ? 0.7 : 1.0;
    const a5 = tension ? cl(1 - 0.04 * (p.pressure || 0), 0.7, 1) : 1;
    const a235 = Math.max(a2 * a3 * a5, 0.7);
    const lbmin = tension ? Math.max(0.3 * lbrqd, 10 * phi, 100) : Math.max(0.6 * lbrqd, 10 * phi, 100);
    const lbdRaw = a1 * a4 * a235 * lbrqd;
    const lbd = Math.max(lbdRaw, lbmin);
    const rho1 = p.lapped == null ? 50 : p.lapped;
    const a6 = cl(Math.sqrt(rho1 / 25), 1, 1.5);
    const l0min = Math.max(0.3 * a6 * lbrqd, 15 * phi, 200);
    const l0 = Math.max(a1 * a235 * a6 * lbrqd, l0min);
    return Object.assign({ code:'ec2', fyd, ssd, lbrqd, a1, a2, a3, a4, a5, a6, a235, floorHit: a2 * a3 * a5 < 0.7,
                           lbmin, lbdRaw, lbd, l0, l0min, mult: lbrqd / phi }, b);
  }

  /* ---------- cover ---------- */
  const EXPO = ['X0', 'XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3'];
  const COL = { X0:0, XC1:1, XC2:2, XC3:2, XC4:3, XD1:4, XS1:4, XD2:5, XS2:5, XD3:6, XS3:6 };
  /* Table 4.4N, rows S1 to S6 */
  const T44 = [[10, 10, 10, 15, 20, 25, 30], [10, 10, 15, 20, 25, 30, 35], [10, 10, 20, 25, 30, 35, 40],
               [10, 15, 25, 30, 35, 40, 45], [15, 20, 30, 35, 40, 45, 50], [20, 25, 35, 40, 45, 50, 55]];
  /* Table 4.3N, strength class that earns one class lower */
  const FCK_DROP = { X0:30, XC1:30, XC2:35, XC3:35, XC4:40, XD1:40, XD2:40, XS1:40, XD3:45, XS2:45, XS3:45 };
  /* BS 8110 Table 3.3, columns C30 to C50 by fcu, null where not allowed */
  const BS_COND = { X0:'mild', XC1:'mild', XC2:'moderate', XC3:'moderate', XC4:'severe', XD1:'severe',
                    XD2:'very severe', XS1:'very severe', XD3:'most severe', XS2:'most severe', XS3:'most severe' };
  const T33 = { 'mild':[25, 20, 20, 20, 20], 'moderate':[null, 35, 30, 25, 20], 'severe':[null, null, 40, 30, 25],
                'very severe':[null, null, 50, 40, 30], 'most severe':[null, null, null, null, 50] };
  /* EN 1992-1-2 Table 5.8 slabs, Table 5.5 beams as [bmin, a] pairs */
  const PERIODS = [30, 60, 90, 120, 180, 240];
  const SLAB_A = [10, 20, 30, 40, 55, 65];
  const BEAM = [[[80, 25], [120, 20], [160, 15], [200, 15]], [[120, 40], [160, 35], [200, 30], [300, 25]],
                [[150, 55], [200, 45], [300, 40], [400, 35]], [[200, 65], [240, 60], [300, 55], [500, 50]],
                [[240, 80], [300, 70], [400, 65], [600, 60]], [[280, 90], [350, 80], [500, 75], [700, 70]]];
  /* BS 8110 Table 3.4, simply supported beams and floors, 0.5 h to 4 h */
  const BS_FIRE = { beam:[20, 20, 20, 40, 60, 70], slab:[20, 20, 25, 35, 45, 55] };

  function fireAxis(member, R, b) {
    const i = Math.max(0, PERIODS.indexOf(R));
    if (member === 'slab') return { a: SLAB_A[i], ok: true };
    const row = BEAM[i];
    if (b < row[0][0]) return { a: row[0][1], ok: false, bmin: row[0][0] };
    for (let j = 1; j < row.length; j++)
      if (b <= row[j][0]) return { a: row[j - 1][1] + (b - row[j - 1][0]) / (row[j][0] - row[j - 1][0]) * (row[j][1] - row[j - 1][1]), ok: true };
    return { a: row[row.length - 1][1], ok: true };
  }

  function structuralClass(expo, fck, life100, slab) {
    let S = 4 + (life100 ? 2 : 0) - (fck >= FCK_DROP[expo] ? 1 : 0) - (slab ? 1 : 0);
    return Math.max(1, Math.min(6, S));
  }

  function cover(p) {
    const slab = p.member === 'slab';
    const outer = slab ? p.phi : p.phiLink;
    if (p.code === 'bs') {
      const fcu = p.fck + 5;
      const cond = BS_COND[p.exposure];
      const col = Math.max(0, Math.min(4, Math.floor((fcu - 30) / 5)));
      const dur = fcu < 30 ? null : T33[cond][col];
      const fire = BS_FIRE[slab ? 'slab' : 'beam'][Math.max(0, PERIODS.indexOf(p.R))];
      const bondC = slab ? p.phi : Math.max(p.phiLink, p.phi - p.phiLink);
      const parts = [{ key:'bond', name:'Bar size', c: bondC }, { key:'dur', name:`Durability, ${cond}`, c: dur == null ? NaN : dur },
                     { key:'fire', name:`Fire, ${p.R / 60} h`, c: fire }];
      const req = Math.max(...parts.map(q => isNaN(q.c) ? 0 : q.c));
      const gov = parts.reduce((a, q) => (q.c || 0) > (a.c || 0) ? q : a, parts[0]);
      return { code:'bs', cond, fcu, allowed: dur != null, parts, cnom: req, gov: gov.key, outer };
    }
    const S = structuralClass(p.exposure, p.fck, p.life100, slab);
    const cdur = T44[S - 1][COL[p.exposure]];
    const cminb = slab ? p.phi : Math.max(p.phiLink, p.phi - p.phiLink);
    const cmin = Math.max(cminb, cdur, 10);
    const dev = 10;
    const fa = fireAxis(p.member, p.R, p.b);
    /* the axis distance is to the main bar centre, so the cover to the
       outermost steel is a - phi/2, less the link in a beam */
    const cfire = fa.a - p.phi / 2 - (slab ? 0 : p.phiLink);
    const parts = [{ key:'bond', name:'Bond, cmin,b + Δc', c: cminb + dev }, { key:'dur', name:`Durability S${S}, cmin,dur + Δc`, c: cdur + dev },
                   { key:'fire', name:`Fire R${p.R}, a − φ/2${slab ? '' : ' − φlink'}`, c: cfire }];
    const cnom = Math.max(cmin + dev, cfire);
    const gov = cnom === cfire && cfire > cmin + dev ? 'fire' : (cdur >= cminb ? 'dur' : 'bond');
    return { code:'ec2', S, cdur, cminb, cmin, dev, a: fa.a, fireOk: fa.ok, bmin: fa.bmin, cfire, parts, cnom, gov, outer };
  }

  /* ---------- spacing ---------- */
  function spacing(p) {
    const need = p.code === 'bs' ? Math.max(p.phi, p.dg + 5) : Math.max(p.phi, p.dg + 5, 20);
    if (p.member === 'slab') {
      const clear = p.s - p.phi;
      return { need, clear, ok: clear >= need, nMax: null, inside: null };
    }
    const inside = p.b - 2 * p.cover - 2 * p.phiLink;
    const clear = p.n > 1 ? (inside - p.n * p.phi) / (p.n - 1) : inside - p.phi;
    const nMax = Math.max(1, Math.floor((inside + need) / (p.phi + need)));
    return { need, clear, ok: clear >= need, nMax, inside };
  }

  function solve(inp) {
    const code = inp.code === 'bs' ? 'bs' : 'ec2';
    const sp = spacing(Object.assign({}, inp, { code }));
    const cv = cover(Object.assign({}, inp, { code }));
    /* cd for the anchorage comes from the real section: half the clear gap
       or the cover to the bar, whichever is smaller */
    const cBar = inp.cover + (inp.member === 'slab' ? 0 : inp.phiLink);
    const cd = Math.max(0, Math.min(sp.clear / 2, cBar));
    const an = anchor(Object.assign({}, inp, { code, cd }));
    return { code, sp, cv, an, cd, cBar };
  }

  return { solve, bond, anchor, cover, spacing, fireAxis, structuralClass, EXPO, PERIODS, T44, BS_COND };
})();
if (typeof module !== 'undefined') module.exports = DetailEngine;
