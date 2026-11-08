/* CivilLab · SlabEngine
   RC slab design, EN 1992-1-1 with the UK NA against BS 8110-1.
   Units: mm for the section, m for spans, kN/m2 for loads, kN·m per metre
   width for moments, kN for the punching load, MPa for stress.
   Moments are per metre width, sagging positive, hogging at continuous edges
   reported as positive magnitudes and labelled hogging.
   Coefficients: one way continuous slabs from BS 8110 Table 3.12, two way
   restrained panels from Table 3.14 and simply supported panels from
   Table 3.13 (Grashof-Rankine, corners free). The Concrete Centre EC2 slab
   guidance uses the same coefficients, so both codes share them here and
   differ in the load factors and the section design.
   Panel orientation: lx is the short span, running across the figure, so
   the long edges are left and right and the short edges top and bottom.
   Per strip design calls RCBeamEngine, punching follows EC2 6.4 and
   BS 8110 3.7.7. */
const SlabEngine = (() => {
  const RCB = (typeof RCBeamEngine !== 'undefined') ? RCBeamEngine : require('./rc-beam-engine.js');

  const R = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0];
  /* case: [short span hogging, short span sagging, long span hogging, long span sagging]
     null where that edge type does not exist. disc lists the discontinuous edges */
  const CASES = {
    1: { name:'Interior panel', disc:[],
         sxN:[.031,.037,.042,.046,.050,.053,.059,.063], sxP:[.024,.028,.032,.035,.037,.040,.044,.048], syN:.032, syP:.024 },
    2: { name:'One short edge discontinuous', disc:['bottom'],
         sxN:[.039,.044,.048,.052,.055,.058,.063,.067], sxP:[.029,.033,.036,.039,.041,.043,.047,.050], syN:.037, syP:.028 },
    3: { name:'One long edge discontinuous', disc:['left'],
         sxN:[.039,.049,.056,.062,.068,.073,.082,.089], sxP:[.030,.036,.042,.047,.051,.055,.062,.067], syN:.037, syP:.028 },
    4: { name:'Two adjacent edges discontinuous', disc:['left','bottom'],
         sxN:[.047,.056,.063,.069,.074,.078,.087,.093], sxP:[.036,.042,.047,.051,.055,.059,.065,.070], syN:.045, syP:.034 },
    5: { name:'Two short edges discontinuous', disc:['top','bottom'],
         sxN:[.046,.050,.054,.057,.060,.062,.067,.070], sxP:[.034,.038,.040,.043,.045,.047,.050,.053], syN:null, syP:.034 },
    6: { name:'Two long edges discontinuous', disc:['left','right'],
         sxN:null, sxP:[.034,.046,.056,.065,.072,.078,.091,.100], syN:.045, syP:.034 },
    7: { name:'Three edges discontinuous, one long edge continuous', disc:['left','top','bottom'],
         sxN:[.057,.065,.071,.076,.081,.084,.092,.098], sxP:[.043,.048,.053,.057,.060,.063,.069,.074], syN:null, syP:.044 },
    8: { name:'Three edges discontinuous, one short edge continuous', disc:['left','right','bottom'],
         sxN:null, sxP:[.042,.054,.063,.071,.078,.084,.096,.105], syN:.058, syP:.044 },
    9: { name:'Four edges discontinuous', disc:['left','right','top','bottom'],
         sxN:null, sxP:[.055,.065,.074,.081,.087,.092,.103,.111], syN:null, syP:.056 },
    0: { name:'Simply supported, corners free', disc:['left','right','top','bottom'], ss:true }
  };

  function interp(arr, r) {
    if (r <= R[0]) return arr[0];
    for (let i = 1; i < R.length; i++)
      if (r <= R[i]) return arr[i - 1] + (r - R[i - 1]) / (R[i] - R[i - 1]) * (arr[i] - arr[i - 1]);
    return arr[arr.length - 1];
  }

  function twoWayCoeffs(id, ratio) {
    const c = CASES[id];
    const clamped = ratio > 2;
    const r = Math.max(1, Math.min(2, ratio));
    if (c.ss) {
      const r4 = Math.pow(ratio, 4);
      return { sxN:null, sxP: r4 / (8 * (1 + r4)), syN:null, syP: ratio * ratio / (8 * (1 + r4)), r: ratio, clamped:false };
    }
    return { sxN: c.sxN ? interp(c.sxN, r) : null, sxP: interp(c.sxP, r),
             syN: c.syN, syP: c.syP, r, clamped };
  }

  /* number of discontinuous edges gives the BS 8110 eq 19 long span value */
  const betaSy = Nd => (24 + 2 * Nd + 1.5 * Nd * Nd) / 1000;

  function loads(code, gk, qk) {
    const gG = code === 'bs' ? 1.4 : 1.35, gQ = code === 'bs' ? 1.6 : 1.5;
    return { gG, gQ, n: gG * gk + gQ * qk };
  }

  /* the widest bar spacing in 25 mm steps that still gives As, within sMax */
  function spacing(AsReq, phi, sMax) {
    const Ab = Math.PI * phi * phi / 4;
    const raw = AsReq > 0 ? 1000 * Ab / AsReq : Infinity;
    let s = Math.min(Math.floor(raw / 25) * 25, Math.floor(sMax / 25) * 25);
    const tooTight = s < 75;
    s = Math.max(s, 75);
    return { s, AsProv: 1000 * Ab / s, Ab, tooTight, limitedBy: raw > sMax ? 'max spacing' : 'strength' };
  }

  function designStrip(code, M, d, h, fck, fyk, phi, sMax) {
    let K, Kp, AsReq, AsMin, z;
    if (code === 'bs') {
      const f = RCB.bsFlexure({ b:1000, d, fck, fyk, MEd:M });
      K = f.K; Kp = f.Kp; AsReq = f.As; z = f.z;
      AsMin = 0.0013 * 1000 * h;
    } else {
      const f = RCB.flexure({ b:1000, h, d, fck, fyk, MEd:M });
      K = f.K; Kp = f.Kp; AsReq = f.AsReq; z = f.z; AsMin = f.AsMin;
    }
    const AsUse = Math.max(AsReq, AsMin);
    const sp = spacing(AsUse, phi, sMax);
    return { M, d, K, Kp, z, AsReq, AsMin, AsUse, s: sp.s, AsProv: sp.AsProv, tooTight: sp.tooTight,
             limitedBy: sp.limitedBy, util: K / Kp };
  }

  function solve(inp) {
    const code = inp.code === 'bs' ? 'bs' : 'ec2';
    const h = inp.h, phi = inp.phi;
    const gk = inp.gsup + 25 * h / 1000, qk = inp.qk;
    const L = loads(code, gk, qk);
    const n = L.n;
    const dx = h - inp.cover - phi / 2, dy = dx - phi;
    const sMain = code === 'bs' ? Math.min(3 * dx, 750) : Math.min(2 * h, 250);
    const sSec = code === 'bs' ? Math.min(3 * dx, 750) : Math.min(3 * h, 400);
    const strips = [];
    let shear = null, coeffs = null, defType = 'ss', Ls = inp.lx;
    const lx = Math.min(inp.lx, inp.ly), ly = Math.max(inp.lx, inp.ly);
    const ratio = ly / lx;
    const add = (key, name, coef, M, d, sM, sag, dir, clause) =>
      strips.push(Object.assign({ key, name, coef, sag, dir, clause }, designStrip(code, M, d, h, inp.fck, inp.fyk, phi, sM)));

    if (inp.type === 'one') {
      Ls = inp.lx;
      const F = n * Ls;
      if (inp.support === 'cont') {
        add('endMid', 'End span, near midspan', 0.086, 0.086 * F * Ls, dx, sMain, true, 'x', 'BS 8110 Table 3.12');
        add('firstSup', 'First interior support', 0.086, 0.086 * F * Ls, dx, sMain, false, 'x', 'Table 3.12');
        add('intMid', 'Interior span, midspan', 0.063, 0.063 * F * Ls, dx, sMain, true, 'x', 'Table 3.12');
        add('intSup', 'Interior support', 0.063, 0.063 * F * Ls, dx, sMain, false, 'x', 'Table 3.12');
        shear = { V: 0.6 * F, coef: 0.6, where: 'first interior support', As: strips[1].AsProv };
        defType = 'end';
      } else {
        add('mid', 'Midspan', 0.125, F * Ls / 8, dx, sMain, true, 'x', 'wL²/8');
        shear = { V: 0.5 * F, coef: 0.5, where: 'support', As: strips[0].AsProv };
        defType = 'ss';
      }
      add('dist', 'Distribution steel', 0, 0, dy, sSec, true, 'y', code === 'bs' ? 'BS 3.12.5.3' : 'EC2 9.3.1.1(2)');
      const dist = strips[strips.length - 1];
      const main = Math.max(...strips.filter(s => s.dir === 'x').map(s => s.AsProv));
      /* secondary steel at least 20 percent of the main steel, EC2 9.3.1.1(2) */
      if (code === 'ec2' && dist.AsUse < 0.2 * main) {
        const sp = spacing(0.2 * main, phi, sSec);
        Object.assign(dist, { AsUse: 0.2 * main, s: sp.s, AsProv: sp.AsProv });
      }
    } else {
      Ls = lx;
      coeffs = twoWayCoeffs(inp.caseId, ratio);
      const nl = n * lx * lx;
      if (coeffs.sxN != null) add('sxN', 'Short span, continuous edge', coeffs.sxN, coeffs.sxN * nl, dx, sMain, false, 'x', 'Table 3.14');
      add('sxP', 'Short span, midspan', coeffs.sxP, coeffs.sxP * nl, dx, sMain, true, 'x', coeffs.r && CASES[inp.caseId].ss ? 'Table 3.13' : 'Table 3.14');
      if (coeffs.syN != null) add('syN', 'Long span, continuous edge', coeffs.syN, coeffs.syN * nl, dy, sSec, false, 'y', 'Table 3.14');
      add('syP', 'Long span, midspan', coeffs.syP, coeffs.syP * nl, dy, sSec, true, 'y', CASES[inp.caseId].ss ? 'Table 3.13' : 'Table 3.14');
      const disc = CASES[inp.caseId].disc;
      const contLong = 2 - disc.filter(e => e === 'left' || e === 'right').length;
      defType = contLong === 2 ? 'int' : contLong === 1 ? 'end' : 'ss';
    }

    const sx = strips.filter(s => s.dir === 'x' && s.sag)[0];
    const dfl = RCB.deflection({ b:1000, d: dx, h, L: Ls, fck: inp.fck, fyk: inp.fyk,
                                 As1: sx.AsProv, AsReq: Math.max(sx.AsReq, 1e-9), type: defType });
    let shearChk = null;
    if (shear) {
      if (code === 'bs') {
        const b = RCB.bsShear({ bw:1000, d: dx, fck: inp.fck, VEd: shear.V, As1: shear.As });
        shearChk = { V: shear.V, cap: b.vc * 1000 * dx / 1000, v: b.v, vc: b.vc, util: b.v / b.vc, where: shear.where, coef: shear.coef };
      } else {
        const s = RCB.shear({ bw:1000, d: dx, fck: inp.fck, VEd: shear.V, As1: shear.As });
        shearChk = { V: shear.V, cap: s.VRdc, k: s.k, rho: s.rhoL, util: shear.V / s.VRdc, where: shear.where, coef: shear.coef };
      }
    }
    const worst = strips.reduce((a, s) => s.util > a.util ? s : a, strips[0]);
    return { code, n, gk, qk, L, dx, dy, sMain, sSec, lx, ly, ratio, Ls, coeffs, strips, worst,
             dfl, defType, shear: shearChk };
  }

  /* punching shear around a column. pos: 'int' | 'edge' | 'corner'.
     c1 is the column side perpendicular to a free edge, c2 parallel to it */
  function punch(inp) {
    const { c1, c2, d, VEd, fck, fyk } = inp;
    const pos = inp.pos || 'int';
    const rho = Math.min(inp.rhoL, 0.02);
    if (inp.code === 'bs') {
      const fcu = fck + 5;
      const fac = pos === 'int' ? 1.15 : 1.25;
      const Veff = fac * VEd;
      const u0 = pos === 'int' ? 2 * (c1 + c2) : pos === 'edge' ? 2 * c1 + c2 : c1 + c2;
      const u1 = pos === 'int' ? 2 * (c1 + c2) + 12 * d : pos === 'edge' ? 2 * c1 + c2 + 6 * d : c1 + c2 + 3 * d;
      const v0 = Veff * 1e3 / (u0 * d), vmax = Math.min(0.8 * Math.sqrt(fcu), 5);
      const vc = RCB.bsShear({ bw:1000, d, fcu, VEd:0, As1: rho * 1000 * d }).vc;
      const v1 = Veff * 1e3 / (u1 * d);
      const needLinks = v1 > vc;
      const uout = Veff * 1e3 / (vc * d);
      return { code:'bs', pos, fac, beta: fac, Veff, u0, u1, r1: 1.5 * d, v0, vmax, v1, vc, needLinks, uout,
               rout: outR(pos, uout, c1, c2, 'square', d),
               face: v0 / vmax, basic: v1 / vc, shape: 'square',
               maxLinks: v1 / (2 * vc) };
    }
    const beta = pos === 'int' ? 1.15 : pos === 'edge' ? 1.4 : 1.5;
    const fcd = 0.85 * fck / 1.5, nu = 0.6 * (1 - fck / 250);
    const u0 = pos === 'int' ? 2 * (c1 + c2) : pos === 'edge' ? Math.min(c2 + 3 * d, c2 + 2 * c1) : Math.min(3 * d, c1 + c2);
    const u1 = pos === 'int' ? 2 * (c1 + c2) + 4 * Math.PI * d : pos === 'edge' ? 2 * c1 + c2 + 2 * Math.PI * d : c1 + c2 + Math.PI * d;
    const v0 = beta * VEd * 1e3 / (u0 * d);
    const vmax = 0.5 * nu * fcd;
    const k = Math.min(1 + Math.sqrt(200 / d), 2);
    const vRdc = Math.max(0.12 * k * Math.pow(100 * rho * fck, 1 / 3), 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck));
    const v1 = beta * VEd * 1e3 / (u1 * d);
    const needLinks = v1 > vRdc;
    const uout = beta * VEd * 1e3 / (vRdc * d);
    const fywef = Math.min(250 + 0.25 * d, fyk / 1.15);
    const AswSr = needLinks ? (v1 - 0.75 * vRdc) * u1 / (1.5 * fywef) : 0;
    return { code:'ec2', pos, beta, u0, u1, r1: 2 * d, v0, vmax, nu, k, rho, v1, vc: vRdc, needLinks, uout,
             rout: outR(pos, uout, c1, c2, 'round', d), fywef, AswSr,
             face: v0 / vmax, basic: v1 / vRdc, shape: 'round', maxLinks: v1 / (2 * vRdc) };
  }

  /* distance from the column face to the perimeter that needs no links */
  function outR(pos, uout, c1, c2, shape, d) {
    if (shape === 'round') {
      if (pos === 'int') return (uout - 2 * (c1 + c2)) / (2 * Math.PI);
      if (pos === 'edge') return (uout - (2 * c1 + c2)) / Math.PI;
      return (uout - (c1 + c2)) / (Math.PI / 2);
    }
    if (pos === 'int') return (uout - 2 * (c1 + c2)) / 8;
    if (pos === 'edge') return (uout - (2 * c1 + c2)) / 4;
    return (uout - (c1 + c2)) / 2;
  }

  return { solve, punch, twoWayCoeffs, loads, spacing, betaSy, CASES, R };
})();
if (typeof module !== 'undefined') module.exports = SlabEngine;
