/* ============================================================
   CivilLab · mohr-engine.js
   Plane stress transformation, shared across apps
   (S2 Mohr's Circle now, G3 soil shear strength later).

   Conventions (Gere, plane stress)
   - sx, sy: normal stresses, tension positive
   - txy: shear stress, positive when it acts in +y on the +x face
   - th: plane rotation, anticlockwise positive, radians
   - On the circle, tau is plotted positive DOWNWARDS so that a
     physical rotation th moves the stress point 2·th around the
     circle in the same sense.
   ============================================================ */
const MohrEngine = (() => {

  function analyse(sx, sy, txy) {
    const C = (sx + sy) / 2;
    const dx = (sx - sy) / 2;
    const R = Math.hypot(dx, txy);
    return {
      C, R,
      s1: C + R,
      s2: C - R,
      tmax: R,
      thetaP: 0.5 * Math.atan2(2 * txy, sx - sy)   // plane of s1, radians ccw
    };
  }

  function transform(sx, sy, txy, th) {
    const C = (sx + sy) / 2;
    const dx = (sx - sy) / 2;
    const c = Math.cos(2 * th), s = Math.sin(2 * th);
    return {
      sxp: C + dx * c + txy * s,
      syp: C - dx * c - txy * s,
      txyp: -dx * s + txy * c
    };
  }

  return { analyse, transform };
})();
if (typeof module !== 'undefined') module.exports = MohrEngine;
