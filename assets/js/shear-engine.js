/* CivilLab · shear-engine.js
   Mohr-Coulomb shear strength of soil, triaxial test.
   Circle geometry is taken from MohrEngine, this file adds the failure
   envelope, the pore pressure and the failure criterion.

   Units and conventions
   - all stresses in kPa, angles in degrees at the boundary, radians inside
   - COMPRESSION POSITIVE, which is the soil convention and the opposite of
     the structural sign convention used everywhere else in CivilLab
   - sigma3 is the cell pressure and sigma1 = sigma3 + sd, where sd is the
     deviator stress, so sd is what the ram applies
   - effective stress sigma' = sigma - u, so the effective circle is the
     total circle slid left by u with the radius unchanged
   - failure envelope tau_f = c' + sigma' tan(phi')
   - at failure sigma1' = sigma3' Nphi + 2 c' sqrt(Nphi),
     with Nphi = tan^2(45 + phi'/2) = (1 + sin phi')/(1 - sin phi')
   - the failure plane makes 45 + phi'/2 with the major principal plane
   - pore pressure in an undrained test follows Skempton with B = 1 and the
     cell pressure held constant during shear, so u = A sd

   Test modes
   - 'cd' consolidated drained: no excess pore pressure, u = 0, so the
     effective circle and the total circle are the same one
   - 'cu' consolidated undrained with pore pressure measured: u = A sd,
     failure is still governed by the effective parameters c' and phi'
   - 'uu' unconsolidated undrained: total stress analysis with phi_u = 0
     and tau_f = cu, so the effective stresses are not known
*/
const ShearEngine = (() => {

  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* flow number, Nphi = tan^2(45 + phi/2) */
  function Nphi(phiDeg) {
    const s = Math.sin(clamp(phiDeg, 0, 89) * RAD);
    return (1 + s) / (1 - s);
  }

  /* the envelope itself */
  function tauF(c, phiDeg, sigma) {
    return c + sigma * Math.tan(clamp(phiDeg, 0, 89) * RAD);
  }

  /* effective major principal stress at failure for a given effective sigma3 */
  function failureS1(c, phiDeg, s3e) {
    const N = Nphi(phiDeg);
    return s3e * N + 2 * c * Math.sqrt(N);
  }

  /* Deviator stress at failure, allowing for pore pressure built up during
     shear as u = A sd.  Substituting sigma3' = sigma3 - A sd and
     sigma1' = sigma3 + sd - A sd into the failure criterion and solving:
        sd (1 + A(N - 1)) = sigma3 (N - 1) + 2 c sqrt(N)
     With A = 0 this collapses to the drained result, and with phi = 0
     (N = 1) it gives sd = 2c whatever A is, which is the undrained case. */
  function failureDeviator(c, phiDeg, s3, A) {
    const N = Nphi(phiDeg);
    const num = s3 * (N - 1) + 2 * c * Math.sqrt(N);
    const den = 1 + A * (N - 1);
    if (den <= 1e-9) return Infinity;      // dilation outruns loading, no failure
    const sd = num / den;
    return sd > 0 ? sd : 0;
  }

  /* one complete test state */
  function solve(inp) {
    const mode = inp.mode || 'cd';
    const uu = mode === 'uu';
    const c = uu ? +inp.cu : +inp.c;
    const phi = uu ? 0 : +inp.phi;
    const s3 = +inp.s3;
    const A = mode === 'cu' ? +inp.A : 0;
    const sd = Math.max(0, +inp.sd);

    const s1 = s3 + sd;
    const u = uu ? null : A * sd;

    /* total circle, geometry straight from MohrEngine */
    const tot = MohrEngine.analyse(s1, s3, 0);

    /* effective circle, the same circle slid left by u */
    const eff = uu ? null : { C: tot.C - u, R: tot.R, s1: s1 - u, s2: s3 - u };
    const s3e = uu ? null : s3 - u;
    const s1e = uu ? null : s1 - u;

    /* the circle the envelope acts on: effective for cd and cu, total for uu */
    const act = uu ? tot : eff;

    /* failure */
    const sdf = uu ? 2 * c : failureDeviator(c, phi, s3, A);
    const margin = sd > 1e-9 ? sdf / sd : Infinity;
    const failed = isFinite(sdf) && sd >= sdf - 1e-6;

    /* how far the acting circle sits from the envelope, measured along the
       envelope normal.  d = c cos(phi) + centre sin(phi), and the circle
       touches when d equals the radius. */
    const ph = phi * RAD;
    const d = c * Math.cos(ph) + act.C * Math.sin(ph);
    const utilisation = d > 1e-9 ? act.R / d : Infinity;

    /* mobilised friction angle, the phi the soil is actually using while the
       cohesion is held at c */
    let phiMob;
    if (phi <= 1e-9) phiMob = 0;
    else {
      const t = c / Math.tan(ph);
      const den = act.C + t;
      phiMob = den > 1e-9 ? Math.asin(clamp(act.R / den, -1, 1)) / RAD : 90;
    }
    const cMob = act.R;                      // mobilised cohesion when phi = 0

    /* the failure circle for this test, drawn as a ghost until it is reached */
    let atFailure = null;
    if (isFinite(sdf)) {
      const uf = uu ? null : A * sdf;
      const Cf = uu ? s3 + sdf / 2 : (s3 + sdf / 2) - uf;
      const Rf = sdf / 2;
      atFailure = {
        sd: sdf, u: uf, C: Cf, R: Rf,
        s3e: uu ? null : s3 - uf, s1e: uu ? null : s3 + sdf - uf,
        s1: s3 + sdf,
        tangent: { s: Cf - Rf * Math.sin(ph), t: Rf * Math.cos(ph) },
        theta: 45 + phi / 2
      };
    }

    return {
      mode, c, phi, s3, s1, sd, A, u,
      s3e, s1e, tot, eff, act,
      sdf, margin, failed, d, utilisation, atFailure,
      phiMob, cMob, Nphi: Nphi(phi),
      theta: 45 + phi / 2,
      neverFails: !isFinite(sdf)
    };
  }

  return { Nphi, tauF, failureS1, failureDeviator, solve, RAD };
})();
if (typeof module !== 'undefined') module.exports = ShearEngine;
