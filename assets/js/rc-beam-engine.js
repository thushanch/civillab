/* rc-beam-engine.js — RC beam design to EN 1992-1-1 (EC2) and BS 8110
   Units: mm for dimensions, MPa for stress, kN and kN·m for forces

   Sign convention: tension positive, compression negative in steel strain.
   Bending moment MEd positive for sagging.

   EC2 rectangular stress block:
     lambda = 0.8  for fck <= 50 MPa
     eta    = 1.0  for fck <= 50 MPa
     fcd    = alpha_cc * fck / gamma_c   (alpha_cc = 0.85 UK NA, gamma_c = 1.5)
     fyd    = fyk / gamma_s              (gamma_s = 1.15)
     ecu    = 0.0035
     es     = 200000 MPa (200 GPa)

   Flexure:
     K  = MEd / (b * d^2 * fck)
     K' = 0.167 (singly reinforced limit, from x/d = 0.45 redistribution delta = 1.0)
     z  = d * [0.5 + sqrt(0.25 - K/1.134)]  capped at 0.95d
     As = MEd / (fyd * z)
     Doubly reinforced: As2 = (K - K') * fck * b * d^2 / (fyd * (d - d2))
                         As1 = K' * fck * b * d^2 / (fyd * z') + As2

   Shear (variable strut angle, EC2 cl 6.2):
     VRd,c = [CRd,c * k * (100 * rho_l * fck)^(1/3)] * bw * d
     VRd,max = alpha_cw * bw * z * nu1 * fcd / (cot_theta + tan_theta)
     Asw/s = VEd / (z * fywd * cot_theta)

   BS 8110 comparison:
     fcu = fck + ~5 MPa (approximate)
     K = M / (b * d^2 * fcu), K' = 0.156
     z = d * [0.5 + sqrt(0.25 - K/0.9)]
     As = M / (0.87 * fy * z)
     Shear: vc table, vs = (v - vc) * b * d, links Asv/sv = vs/(0.87*fyv*d)
*/
const RCBeamEngine = (() => {
  var ACC  = 0.85;
  var GC   = 1.5;
  var GS   = 1.15;
  var ES   = 200000;
  var ECU  = 0.0035;

  function matProps(fck, fyk) {
    var fcd = ACC * fck / GC;
    var fyd = fyk / GS;
    var fcu = fck <= 50 ? fck + 5 : fck + 8;
    return { fck:fck, fyk:fyk, fcd:fcd, fyd:fyd, fcu:fcu, Es:ES, ecu:ECU };
  }

  function flexure(inp) {
    var b    = inp.b;
    var h    = inp.h;
    var d    = inp.d;
    var d2   = inp.d2 || 50;
    var fck  = inp.fck;
    var fyk  = inp.fyk || 500;
    var MEd  = inp.MEd;
    var As1  = inp.As1 || 0;
    var As2  = inp.As2 || 0;
    var mode = inp.mode || 'design';

    var m = matProps(fck, fyk);
    var lam = fck <= 50 ? 0.8 : 0.8 - (fck - 50) / 400;
    var eta = fck <= 50 ? 1.0 : 1.0 - (fck - 50) / 200;

    var K  = MEd * 1e6 / (b * d * d * fck);
    var Kp = 0.167;
    var doubly = K > Kp;

    var z, x, AsReq, As2Req, MRd;

    if (mode === 'design') {
      if (!doubly) {
        z = d * (0.5 + Math.sqrt(Math.max(0, 0.25 - K / 1.134)));
        z = Math.min(z, 0.95 * d);
        x = (d - z) / (lam / 2);
        AsReq = MEd * 1e6 / (m.fyd * z);
        As2Req = 0;
      } else {
        z = d * (0.5 + Math.sqrt(Math.max(0, 0.25 - Kp / 1.134)));
        z = Math.min(z, 0.95 * d);
        x = (d - z) / (lam / 2);
        As2Req = (K - Kp) * fck * b * d * d / (m.fyd * (d - d2));
        AsReq = Kp * fck * b * d * d / (m.fyd * z) + As2Req;
      }
      MRd = MEd;
    } else {
      var fc = eta * m.fcd;
      if (As2 > 0) {
        var a = lam * fc * b;
        var c0 = As1 * m.fyd - As2 * m.fyd;
        x = c0 / (lam * fc * b);
        if (x < 0) x = 0;
        var xd = x / d;
        z = d - lam * x / 2;
        MRd = (As1 * m.fyd * (d - lam * x / 2) + As2 * m.fyd * (lam * x / 2 - d2)) / 1e6;
        if (MRd < 0) MRd = 0;
      } else {
        x = As1 * m.fyd / (lam * fc * b);
        z = d - lam * x / 2;
        MRd = As1 * m.fyd * z / 1e6;
      }
      AsReq = As1;
      As2Req = As2;
      K = MRd * 1e6 / (b * d * d * fck);
      doubly = As2 > 0;
    }

    var xd = x / d;
    var esi = ECU * (d - x) / x;
    var esYield = m.fyd / ES;
    var steelYields = esi >= esYield;

    var AsMin = Math.max(0.26 * Math.pow(fck, 0.5) / fyk * b * d, 0.0013 * b * d);
    var AsMax = 0.04 * b * h;

    var util = mode === 'design' ? 1.0 : (MEd > 0 ? MEd / MRd : 0);

    return {
      mat: m, b:b, h:h, d:d, d2:d2,
      K:K, Kp:Kp, doubly:doubly,
      x:x, xd:xd, z:z,
      lam:lam, eta:eta,
      AsReq:AsReq, As2Req:As2Req,
      AsMin:AsMin, AsMax:AsMax,
      MRd:MRd, MEd:MEd,
      esi:esi, steelYields:steelYields,
      util:util
    };
  }

  function shear(inp) {
    var bw   = inp.bw || inp.b;
    var d    = inp.d;
    var fck  = inp.fck;
    var fyk  = inp.fyk || 500;
    var fywd = inp.fywd || (fyk / GS);
    var VEd  = inp.VEd;
    var As1  = inp.As1 || 0;
    var theta = inp.theta || 21.8;

    var m = matProps(fck, fyk);
    var z = 0.9 * d;

    var rhoL = Math.min(As1 / (bw * d), 0.02);
    var k = Math.min(1 + Math.sqrt(200 / d), 2.0);
    var CRdc = 0.18 / GC;
    var vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);

    var VRdc = Math.max(CRdc * k * Math.pow(100 * rhoL * fck, 1.0/3.0), vmin) * bw * d / 1000;

    var thetaRad = theta * Math.PI / 180;
    var cotTh = 1 / Math.tan(thetaRad);
    var tanTh = Math.tan(thetaRad);

    var nu1 = 0.6 * (1 - fck / 250);
    var acw = 1.0;

    var VRdmax = acw * bw * z * nu1 * m.fcd / (cotTh + tanTh) / 1000;

    var AswReq = VEd * 1000 / (z * fywd * cotTh);

    var AswMin = 0.08 * Math.sqrt(fck) / fyk * bw;

    var AswUse = Math.max(AswReq, AswMin);

    var needsLinks = VEd > VRdc;
    var adequate = VEd <= VRdmax;

    var thetaOpt = 0.5 * Math.asin(Math.min(1, VEd * 1000 * 2 / (acw * bw * z * nu1 * m.fcd)));
    var thetaOptDeg = thetaOpt * 180 / Math.PI;
    thetaOptDeg = Math.max(21.8, Math.min(45, thetaOptDeg));

    return {
      mat: m, bw:bw, d:d, z:z,
      rhoL:rhoL, k:k,
      VRdc:VRdc, VRdmax:VRdmax,
      VEd:VEd, theta:theta,
      cotTh:cotTh,
      AswReq:AswReq, AswMin:AswMin, AswUse:AswUse,
      needsLinks:needsLinks, adequate:adequate,
      thetaOpt:thetaOptDeg,
      nu1:nu1, acw:acw,
      util: adequate ? VEd / VRdmax : VEd / VRdmax
    };
  }

  function deflection(inp) {
    var b    = inp.b;
    var d    = inp.d;
    var h    = inp.h;
    var L    = inp.L;
    var fck  = inp.fck;
    var fyk  = inp.fyk || 500;
    var As1  = inp.As1 || 0;
    var As2  = inp.As2 || 0;
    var type = inp.type || 'ss';

    var rho  = As1 / (b * d);
    var rhop = As2 / (b * d);
    var rho0 = Math.sqrt(fck) / 1000;

    var Kb;
    if (type === 'ss') Kb = 1.0;
    else if (type === 'end') Kb = 1.3;
    else if (type === 'int') Kb = 1.5;
    else if (type === 'cant') Kb = 0.4;
    else Kb = 1.0;

    var basic;
    if (rho <= rho0) {
      basic = 11 + 1.5 * Math.sqrt(fck) * rho0 / rho +
              3.2 * Math.sqrt(fck) * Math.pow(Math.max(0, rho0 / rho - 1), 1.5);
    } else {
      basic = 11 + 1.5 * Math.sqrt(fck) * rho0 / (rho - rhop) +
              (1.0 / 12) * Math.sqrt(fck) * Math.sqrt(rhop / rho0);
    }

    var modAs = 310 / (fyk / GS * (As1 > 0 ? As1 / As1 : 1));
    modAs = Math.min(modAs, 1.5);

    var modAs2 = rhop > 0 ? 1 : 1;

    var modFlange = (b > 0) ? 1.0 : 1.0;

    var allowable = Kb * basic * modAs;
    var actual = L * 1000 / d;
    var ok = actual <= allowable;

    return {
      b:b, d:d, h:h, L:L,
      rho:rho, rhop:rhop, rho0:rho0,
      Kb:Kb, basic:basic, type:type,
      modAs:modAs,
      allowable:allowable,
      actual:actual,
      ok:ok,
      util: actual / allowable
    };
  }

  function cracking(inp) {
    var b     = inp.b;
    var d     = inp.d;
    var h     = inp.h;
    var cover = inp.cover || 30;
    var phi   = inp.phi || 16;
    var fck   = inp.fck;
    var fyk   = inp.fyk || 500;
    var As1   = inp.As1 || 0;
    var MEd   = inp.MEd;
    var wkLim = inp.wkLim || 0.3;

    var m = matProps(fck, fyk);
    var hcef = Math.min(2.5 * (h - d), (h - d * 2 / 3 + h) / 3, h / 2);
    hcef = Math.max(hcef, 2.5 * (h - d));
    var Acef = b * hcef;
    var rhoEff = As1 > 0 ? As1 / Acef : 0.001;

    var fctEff = 0.3 * Math.pow(fck, 2.0 / 3.0);
    if (fck <= 50) fctEff = 0.3 * Math.pow(fck, 2.0 / 3.0);

    var srMax;
    var k1 = 0.8;
    var k2 = 0.5;
    var k3 = 3.4;
    var k4 = 0.425;
    srMax = k3 * cover + k1 * k2 * k4 * phi / rhoEff;

    var z = 0.9 * d;
    var sigS = As1 > 0 ? MEd * 1e6 / (As1 * z) : 0;

    var kt = 0.4;
    var alpha_e = ES / (22000 * Math.pow(fck / 10, 0.3));

    var esmEcm = Math.max(
      (sigS - kt * fctEff / rhoEff * (1 + alpha_e * rhoEff)) / ES,
      0.6 * sigS / ES
    );

    var wk = srMax * esmEcm;

    var sMax;
    if (sigS <= 160) sMax = 300;
    else if (sigS <= 200) sMax = 250;
    else if (sigS <= 240) sMax = 200;
    else if (sigS <= 280) sMax = 150;
    else if (sigS <= 320) sMax = 100;
    else sMax = 50;

    return {
      cover:cover, phi:phi,
      hcef:hcef, Acef:Acef, rhoEff:rhoEff,
      fctEff:fctEff,
      srMax:srMax, sigS:sigS,
      esmEcm:esmEcm,
      wk:wk, wkLim:wkLim,
      wkOk: wk <= wkLim,
      sMax:sMax,
      util: wkLim > 0 ? wk / wkLim : 0
    };
  }

  function bsFlexure(inp) {
    var b   = inp.b;
    var d   = inp.d;
    var fcu = inp.fcu || (inp.fck + 5);
    var fy  = inp.fyk || 500;
    var M   = inp.MEd;

    var K  = M * 1e6 / (b * d * d * fcu);
    var Kp = 0.156;
    var doubly = K > Kp;

    var z = d * (0.5 + Math.sqrt(Math.max(0, 0.25 - K / 0.9)));
    z = Math.min(z, 0.95 * d);

    var As = M * 1e6 / (0.87 * fy * z);

    return {
      K:K, Kp:Kp, doubly:doubly, z:z,
      As:As, fcu:fcu
    };
  }

  function bsShear(inp) {
    var b   = inp.bw || inp.b;
    var d   = inp.d;
    var fcu = inp.fcu || (inp.fck + 5);
    var V   = inp.VEd;
    var As1 = inp.As1 || 0;

    var v = V * 1000 / (b * d);

    var rho = 100 * As1 / (b * d);
    rho = Math.min(rho, 3);
    var vc = 0.79 * Math.pow(rho, 1.0 / 3.0) * Math.pow(400 / d, 0.25) / 1.25;
    vc = Math.min(vc, 0.8 * Math.sqrt(fcu));

    var vmax = 0.8 * Math.sqrt(fcu);
    vmax = Math.min(vmax, 5.0);

    return {
      v:v, vc:vc, vmax:vmax,
      needsLinks: v > vc,
      adequate: v <= vmax,
      fcu:fcu
    };
  }

  return {
    flexure: flexure,
    shear: shear,
    deflection: deflection,
    cracking: cracking,
    bsFlexure: bsFlexure,
    bsShear: bsShear,
    matProps: matProps,
    ACC: ACC, GC: GC, GS: GS, ES: ES, ECU: ECU
  };
})();
if (typeof module !== 'undefined') module.exports = RCBeamEngine;
