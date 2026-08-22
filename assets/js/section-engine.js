/* ============================================================
   CivilLab · section-engine.js
   Cross-section properties, shared by S3 bending stress,
   S4 shear stress, and later C1, C4, St1, T1.

   Units: all dimensions in mm. Returns A mm², ybar mm (centroid
   from the BOTTOM fibre), I mm⁴ about the NA, ytop/ybot mm,
   Ztop/Zbot mm³, plus bAt(y) width and QAt(y) first moment of the
   area ABOVE level y, where y is measured from the NA, up positive.

   Types and dims:
     rect   {b, h}
     ibeam  {bf, tf, tw, hw}         total depth = 2 tf + hw
     tee    {bf, tf, tw, hw}         flange on top, depth = hw + tf
     box    {b, h, t}                uniform wall t
     circle {do}
     pipe   {do, di}
   ============================================================ */
const SectionEngine = (() => {

  function build(type, d) {
    if (type === 'circle' || type === 'pipe') return circular(type, d);
    let rects = [];
    if (type === 'rect') rects = [{ w: d.b, y0: 0, y1: d.h }];
    else if (type === 'ibeam') rects = [
      { w: d.bf, y0: 0, y1: d.tf },
      { w: d.tw, y0: d.tf, y1: d.tf + d.hw },
      { w: d.bf, y0: d.tf + d.hw, y1: 2 * d.tf + d.hw }];
    else if (type === 'tee') rects = [
      { w: d.tw, y0: 0, y1: d.hw },
      { w: d.bf, y0: d.hw, y1: d.hw + d.tf }];
    else if (type === 'box') rects = [
      { w: d.b, y0: 0, y1: d.t },
      { w: d.b, y0: d.h - d.t, y1: d.h },
      { w: 2 * d.t, y0: d.t, y1: d.h - d.t }];   // both webs combined

    let A = 0, Sy = 0;
    for (const r of rects) { const a = r.w * (r.y1 - r.y0); A += a; Sy += a * (r.y0 + r.y1) / 2; }
    const ybar = Sy / A;
    let I = 0;
    for (const r of rects) {
      const h = r.y1 - r.y0, a = r.w * h, yc = (r.y0 + r.y1) / 2;
      I += r.w * h * h * h / 12 + a * (yc - ybar) ** 2;
    }
    const h = Math.max(...rects.map(r => r.y1));
    const ytop = h - ybar, ybot = ybar;

    const bAt = (y) => {           // width at level y (from NA)
      const yy = y + ybar;
      let b = 0;
      for (const r of rects) if (yy > r.y0 + 1e-9 && yy < r.y1 - 1e-9) b += r.w;
      if (b === 0)                 // exactly on a junction: take the larger face
        for (const r of rects) if (yy >= r.y0 - 1e-9 && yy <= r.y1 + 1e-9) b = Math.max(b, r.w);
      return b;
    };
    const QAt = (y) => {           // first moment of area above level y, about NA
      const yy = y + ybar;
      let Q = 0;
      for (const r of rects) {
        const y0 = Math.max(r.y0, yy);
        if (y0 < r.y1) { const a = r.w * (r.y1 - y0); Q += a * ((y0 + r.y1) / 2 - ybar); }
      }
      return Q;
    };
    return { type, dims: d, A, ybar, I, h, ytop, ybot, Ztop: I / ytop, Zbot: I / ybot, bAt, QAt, rects };
  }

  function circular(type, d) {
    const R = d.do / 2, ri = type === 'pipe' ? (d.di || 0) / 2 : 0;
    const A = Math.PI * (R * R - ri * ri);
    const I = Math.PI / 4 * (R ** 4 - ri ** 4);
    // Q of a full circle radius r above level y: (2/3)(r² − y²)^{3/2}
    const seg = (r, y) => Math.abs(y) >= r ? 0 : (2 / 3) * Math.pow(r * r - y * y, 1.5);
    const QAt = (y) => seg(R, y) - (ri > 0 ? seg(ri, y) : 0);
    const bAt = (y) => {
      const bo = Math.abs(y) < R ? 2 * Math.sqrt(R * R - y * y) : 0;
      const bi = ri > 0 && Math.abs(y) < ri ? 2 * Math.sqrt(ri * ri - y * y) : 0;
      return bo - bi;
    };
    return { type, dims: d, A, ybar: R, I, h: 2 * R, ytop: R, ybot: R, Ztop: I / R, Zbot: I / R, bAt, QAt, R, ri };
  }

  /* sensible default dimensions per type (mm) */
  const DEFAULTS = {
    rect:   { b: 150, h: 300 },
    ibeam:  { bf: 150, tf: 15, tw: 9, hw: 270 },
    tee:    { bf: 200, tf: 20, tw: 12, hw: 230 },
    box:    { b: 200, h: 300, t: 10 },
    circle: { do: 250 },
    pipe:   { do: 250, di: 200 }
  };

  return { build, DEFAULTS };
})();
if (typeof module !== 'undefined') module.exports = SectionEngine;
