/* actions-engine.js — EN 1990 + EN 1991 load combinations engine
   Units: kN, kN/m, kN/m2 — all actions are characteristic values
   Sign convention: all loads positive downward (gravity)
   BS comparison: BS 6399 / BS 8110 partial factors alongside Eurocode

   The engine produces factored design actions for ULS and SLS from
   characteristic permanent (Gk), leading variable (Qk1) and up to
   two accompanying variable actions (Qk2, Qk3).  Wind and snow may
   act upward (negative values allowed).

   EN 1990 Table A1.2(B) — STR/GEO, Set B (UK NA values):
     Eq 6.10:   gamma_G * Gk  +  gamma_Q * Qk1  +  Sum(gamma_Q * psi0_i * Qki)
     Eq 6.10a:  gamma_G * Gk  +  gamma_Q * psi0_1 * Qk1  +  Sum(gamma_Q * psi0_i * Qki)
     Eq 6.10b:  xi * gamma_G * Gk  +  gamma_Q * Qk1  +  Sum(gamma_Q * psi0_i * Qki)
   UK NA to EN 1990: xi = 0.925

   Favourable permanent uses gamma_G,inf = 1.0
   Favourable variable uses gamma_Q = 0 (variable actions are not applied if beneficial)

   SLS combinations (EN 1990 clause 6.5.3):
     Characteristic:     Gk + Qk1 + Sum(psi0_i * Qki)
     Frequent:           Gk + psi1_1 * Qk1 + Sum(psi2_i * Qki)
     Quasi-permanent:    Gk + Sum(psi2_i * Qki)

   BS 8110 / BS 6399 comparison:
     ULS:  1.4 Gk + 1.6 Qk  (or 1.0 Gk + 1.4 Wk when wind assists)
     SLS:  1.0 Gk + 1.0 Qk
*/
const ActionsEngine = (() => {
  const PSI = {
    A: { name: 'Domestic / residential',       psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    B: { name: 'Office',                       psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    C: { name: 'Congregation',                 psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    D: { name: 'Shopping',                     psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    E: { name: 'Storage',                      psi0: 1.0, psi1: 0.9, psi2: 0.8 },
    F: { name: 'Traffic (≤ 30 kN)',            psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    G: { name: 'Traffic (30–160 kN)',          psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    H: { name: 'Roofs',                        psi0: 0.7, psi1: 0.0, psi2: 0.0 },
    wind: { name: 'Wind (EN 1991-1-4)',        psi0: 0.5, psi1: 0.2, psi2: 0.0 },
    snow: { name: 'Snow (altitude ≤ 1000 m)',  psi0: 0.5, psi1: 0.2, psi2: 0.0 },
    snowH:{ name: 'Snow (altitude > 1000 m)',  psi0: 0.7, psi1: 0.5, psi2: 0.2 }
  };

  const GG = 1.35;
  const GQ = 1.5;
  const XI = 0.925;
  const GG_FAV = 1.0;

  function psiFor(cat) {
    return PSI[cat] || PSI.A;
  }

  function solve(inp) {
    var Gk    = inp.Gk   || 0;
    var Qk1   = inp.Qk1  || 0;
    var cat1  = inp.cat1  || 'A';
    var Qk2   = inp.Qk2  || 0;
    var cat2  = inp.cat2  || 'wind';
    var Qk3   = inp.Qk3  || 0;
    var cat3  = inp.cat3  || 'snow';

    var p1 = psiFor(cat1);
    var p2 = psiFor(cat2);
    var p3 = psiFor(cat3);

    var actions = [
      { label: 'Imposed (leading)', Qk: Qk1, cat: cat1, psi: p1 },
      { label: 'Variable 2',        Qk: Qk2, cat: cat2, psi: p2 },
      { label: 'Variable 3',        Qk: Qk3, cat: cat3, psi: p3 }
    ];

    var uls = computeULS(Gk, actions);
    var sls = computeSLS(Gk, actions);
    var bs  = computeBS(Gk, actions);

    return {
      Gk: Gk,
      actions: actions,
      psi1: p1, psi2: p2, psi3: p3,
      uls: uls,
      sls: sls,
      bs: bs,
      GG: GG, GQ: GQ, XI: XI, GG_FAV: GG_FAV
    };
  }

  function computeULS(Gk, actions) {
    var Qk1  = actions[0].Qk;
    var psi1 = actions[0].psi;

    var accomp610  = 0;
    var accomp610a = 0;
    var accomp610b = 0;
    for (var i = 1; i < actions.length; i++) {
      var q = actions[i].Qk;
      var p = actions[i].psi;
      accomp610  += GQ * p.psi0 * q;
      accomp610a += GQ * p.psi0 * q;
      accomp610b += GQ * p.psi0 * q;
    }

    var gPart   = GG * Gk;
    var gPartA  = GG * Gk;
    var gPartB  = XI * GG * Gk;

    var q1Part   = GQ * Qk1;
    var q1PartA  = GQ * psi1.psi0 * Qk1;
    var q1PartB  = GQ * Qk1;

    var e610  = gPart  + q1Part  + accomp610;
    var e610a = gPartA + q1PartA + accomp610a;
    var e610b = gPartB + q1PartB + accomp610b;

    var governing = 'eq610';
    var ed = e610;
    if (e610a < e610 && e610b < e610) {
      governing = 'eq610';
      ed = e610;
    } else {
      var maxAB = Math.max(e610a, e610b);
      if (maxAB > e610) {
        governing = 'eq610';
        ed = e610;
      } else {
        governing = e610a >= e610b ? 'eq610a' : 'eq610b';
        ed = maxAB;
      }
    }

    var altMin = Math.min(e610a, e610b);
    governing = 'eq610';
    ed = e610;

    return {
      eq610: {
        label: 'Eq. 6.10',
        gPart:  gPart,
        q1Part: q1Part,
        accomp: accomp610,
        total:  e610,
        terms: [
          { factor: GG,    label: 'γ_G',  char: Gk,  val: gPart },
          { factor: GQ,    label: 'γ_Q',  char: Qk1, val: q1Part },
          buildAccTerms(actions, 'psi0', GQ, false)
        ]
      },
      eq610a: {
        label: 'Eq. 6.10a',
        gPart:  gPartA,
        q1Part: q1PartA,
        accomp: accomp610a,
        total:  e610a,
        terms: [
          { factor: GG,          label: 'γ_G',       char: Gk,  val: gPartA },
          { factor: GQ * psi1.psi0, label: 'γ_Q·ψ₀', char: Qk1, val: q1PartA },
          buildAccTerms(actions, 'psi0', GQ, false)
        ]
      },
      eq610b: {
        label: 'Eq. 6.10b',
        gPart:  gPartB,
        q1Part: q1PartB,
        accomp: accomp610b,
        total:  e610b,
        terms: [
          { factor: XI * GG,  label: 'ξ·γ_G',  char: Gk,  val: gPartB },
          { factor: GQ,       label: 'γ_Q',     char: Qk1, val: q1PartB },
          buildAccTerms(actions, 'psi0', GQ, false)
        ]
      },
      governing: governing,
      ed: e610,
      maxAB: Math.max(e610a, e610b),
      minAB: Math.min(e610a, e610b),
      ratio610aTo610: e610 !== 0 ? e610a / e610 : 0,
      ratio610bTo610: e610 !== 0 ? e610b / e610 : 0
    };
  }

  function computeSLS(Gk, actions) {
    var Qk1  = actions[0].Qk;
    var psi1 = actions[0].psi;

    var charAccomp = 0, freqAccomp = 0, qpAccomp = 0;
    for (var i = 1; i < actions.length; i++) {
      var q = actions[i].Qk;
      var p = actions[i].psi;
      charAccomp += p.psi0 * q;
      freqAccomp += p.psi2 * q;
      qpAccomp   += p.psi2 * q;
    }

    var charTotal = Gk + Qk1 + charAccomp;
    var freqTotal = Gk + psi1.psi1 * Qk1 + freqAccomp;
    var qpTotal   = Gk + psi1.psi2 * Qk1 + qpAccomp;

    return {
      char: {
        label: 'Characteristic',
        gPart: Gk,
        q1Part: Qk1,
        accomp: charAccomp,
        total: charTotal
      },
      freq: {
        label: 'Frequent',
        gPart: Gk,
        q1Part: psi1.psi1 * Qk1,
        accomp: freqAccomp,
        total: freqTotal,
        psiUsed: psi1.psi1
      },
      qp: {
        label: 'Quasi-permanent',
        gPart: Gk,
        q1Part: psi1.psi2 * Qk1,
        accomp: qpAccomp,
        total: qpTotal,
        psiUsed: psi1.psi2
      }
    };
  }

  function computeBS(Gk, actions) {
    var Qk1 = actions[0].Qk;
    var Qk2 = actions.length > 1 ? actions[1].Qk : 0;
    var Qk3 = actions.length > 2 ? actions[2].Qk : 0;

    var ulsGrav = 1.4 * Gk + 1.6 * Qk1;
    var ulsWind = 1.0 * Gk + 1.4 * Qk2;
    var ulsComb = 1.2 * Gk + 1.2 * Qk1 + 1.2 * Qk2;
    var sls     = 1.0 * Gk + 1.0 * Qk1;

    return {
      ulsGrav: {
        label: '1.4 Gk + 1.6 Qk',
        gPart: 1.4 * Gk,
        q1Part: 1.6 * Qk1,
        total: ulsGrav,
        gFactor: 1.4,
        qFactor: 1.6
      },
      ulsWind: {
        label: '1.0 Gk + 1.4 Wk',
        gPart: 1.0 * Gk,
        q1Part: 1.4 * Qk2,
        total: ulsWind,
        gFactor: 1.0,
        qFactor: 1.4
      },
      ulsComb: {
        label: '1.2(Gk + Qk + Wk)',
        gPart: 1.2 * Gk,
        q1Part: 1.2 * Qk1,
        accomp: 1.2 * Qk2,
        total: ulsComb,
        gFactor: 1.2,
        qFactor: 1.2
      },
      sls: {
        label: '1.0 Gk + 1.0 Qk',
        gPart: 1.0 * Gk,
        q1Part: 1.0 * Qk1,
        total: sls,
        gFactor: 1.0,
        qFactor: 1.0
      }
    };
  }

  function buildAccTerms(actions, psiKey, gq, isSLS) {
    var parts = [];
    for (var i = 1; i < actions.length; i++) {
      var q = actions[i].Qk;
      var p = actions[i].psi;
      var psiVal = p[psiKey];
      var factor = isSLS ? psiVal : gq * psiVal;
      parts.push({ factor: factor, label: actions[i].label, char: q, val: factor * q });
    }
    return parts;
  }

  return { solve: solve, PSI: PSI, GG: GG, GQ: GQ, XI: XI, GG_FAV: GG_FAV, psiFor: psiFor };
})();
if (typeof module !== 'undefined') module.exports = ActionsEngine;
