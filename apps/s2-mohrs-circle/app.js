/* CivilLab · S2 Mohr's Circle for Stress */
(() => {
  const { s, fmt, clamp } = UI;
  const elSvg = document.getElementById('el');
  const ciSvg = document.getElementById('circ');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const RAD = Math.PI / 180;

  const C = {
    ocean: '#14416B', water: '#1E78B0', green: '#2E6B4F',
    midblue: '#2E6FA3', pale: '#9FC4E6', muted: '#5C6A72',
    axis: '#B9C0C5', contour: '#C9CEC7'
  };

  const S = { sx: 80, sy: 20, txy: 40, th: 0 };   // th in degrees

  const PRESETS = {
    general: { sx: 80, sy: 20, txy: 40 },
    uni:     { sx: 100, sy: 0, txy: 0 },
    shear:   { sx: 0, sy: 0, txy: 60 },
    biax:    { sx: 60, sy: -60, txy: 0 },
    hydro:   { sx: 70, sy: 70, txy: 0 }
  };

  /* ---------- svg helpers ---------- */
  function txt(x, y, str, o = {}) {
    const a = {
      x, y, 'font-size': o.fs || 12, fill: o.fill || C.muted,
      'text-anchor': o.an || 'middle', 'font-weight': o.fw || 400,
      'paint-order': 'stroke', stroke: '#fff',
      'stroke-width': o.halo == null ? 3 : o.halo, 'stroke-linejoin': 'round'
    };
    if (o.head) a['font-family'] = 'Poppins, Inter, sans-serif';
    return s('text', a, str);
  }
  const line = (x1, y1, x2, y2, a = {}) => s('line', Object.assign({ x1, y1, x2, y2 }, a));
  function marker(id, color, w = 6.5) {
    return s('marker',
      { id, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: w, markerHeight: w, orient: 'auto-start-reverse' },
      s('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
  }

  /* ============================================================
     Stress element (left figure)
     Physical frame: x right, y up, rotation θ anticlockwise.
     Screen mapping: sx = cx + x cosθ − y sinθ ; sy = cy − x sinθ − y cosθ
     ============================================================ */
  function renderElement() {
    const cx = 210, cy = 200, half = 74;
    const th = S.th * RAD, ct = Math.cos(th), st = Math.sin(th);
    const pt = (x, y) => [cx + x * ct - y * st, cy - x * st - y * ct];
    const t = MohrEngine.transform(S.sx, S.sy, S.txy, th);

    while (elSvg.firstChild) elSvg.removeChild(elSvg.firstChild);
    elSvg.appendChild(s('defs', {},
      marker('eSig', C.water), marker('eTau', C.midblue, 5.5), marker('eTh', C.green, 6)));

    elSvg.appendChild(txt(14, 22, 'Stress element', { an: 'start', fs: 13, fw: 600, fill: C.ocean, halo: 0, head: true }));

    /* fixed reference axes */
    elSvg.appendChild(line(cx - 152, cy, cx + 152, cy,
      { stroke: C.contour, 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
    elSvg.appendChild(line(cx, cy - 152, cx, cy + 152,
      { stroke: C.contour, 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
    elSvg.appendChild(txt(cx + 160, cy + 4, 'x', { fs: 11, halo: 0 }));
    elSvg.appendChild(txt(cx + 6, cy - 156, 'y', { an: 'start', fs: 11, halo: 0 }));

    /* rotated axes x', y' */
    let [ax1, ay1] = pt(-150, 0), [ax2, ay2] = pt(150, 0);
    elSvg.appendChild(line(ax1, ay1, ax2, ay2, { stroke: C.pale, 'stroke-width': 1.4 }));
    [ax1, ay1] = pt(0, -150); [ax2, ay2] = pt(0, 150);
    elSvg.appendChild(line(ax1, ay1, ax2, ay2, { stroke: C.pale, 'stroke-width': 1.4 }));
    let [lx, ly] = pt(162, 0);
    elSvg.appendChild(txt(lx, ly + 4, 'x\u2032', { fs: 12, fw: 600, fill: C.midblue }));
    [lx, ly] = pt(0, 162);
    elSvg.appendChild(txt(lx, ly + 4, 'y\u2032', { fs: 12, fw: 600, fill: C.midblue }));

    /* θ arc between x and x' axes */
    if (Math.abs(S.th) >= 3) {
      const r = 92;
      const a0 = 0, a1 = th;
      const p0 = [cx + r * Math.cos(a0), cy - r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy - r * Math.sin(a1)];
      elSvg.appendChild(s('path', {
        d: `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 ${S.th > 0 ? 0 : 1} ${p1[0]} ${p1[1]}`,
        fill: 'none', stroke: C.green, 'stroke-width': 2, 'marker-end': 'url(#eTh)'
      }));
      const am = th / 2, rl = r + 14;
      elSvg.appendChild(txt(cx + rl * Math.cos(am), cy - rl * Math.sin(am) + 4,
        `θ = ${fmt(S.th)}°`, { fs: 11.5, fw: 600, fill: C.green }));
    }

    /* reference square (unrotated, faint) */
    elSvg.appendChild(s('polygon', {
      points: `${cx - half},${cy - half} ${cx + half},${cy - half} ${cx + half},${cy + half} ${cx - half},${cy + half}`,
      fill: 'none', stroke: C.contour, 'stroke-width': 1.2, 'stroke-dasharray': '5 4'
    }));

    /* rotated element */
    const corners = [pt(-half, half), pt(half, half), pt(half, -half), pt(-half, -half)];
    elSvg.appendChild(s('polygon', {
      points: corners.map(p => p.join(',')).join(' '),
      fill: 'rgba(30,120,176,.08)', stroke: C.ocean, 'stroke-width': 2
    }));

    /* normal stress arrows (transformed values, on the rotated faces) */
    const arrLen = v => 14 + 34 * Math.min(1, Math.abs(v) / 200);
    function normalArrows(val, axis) {
      if (Math.abs(val) < 1) return 0;
      const len = arrLen(val), g = 10;
      const dirs = axis === 'x' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
      for (const [ux, uy] of dirs) {
        const base = half + g, tip = base + len;
        let a = [ux * base, uy * base], b = [ux * tip, uy * tip];
        if (val < 0) { const t2 = a; a = b; b = t2; }        // compression points inward
        const [x1, y1] = pt(a[0], a[1]), [x2, y2] = pt(b[0], b[1]);
        elSvg.appendChild(line(x1, y1, x2, y2,
          { stroke: C.water, 'stroke-width': 2.5, 'marker-end': 'url(#eSig)' }));
      }
      return len;
    }
    const lenX = normalArrows(t.sxp, 'x');
    const lenY = normalArrows(t.syp, 'y');

    /* shear arrows: positive τx'y' acts +y' on the +x' face */
    if (Math.abs(t.txyp) >= 1) {
      const a = 48, off = half + 8;
      const spec = [
        [[off, -a], [off, a]],        // right face  → +y'
        [[-off, a], [-off, -a]],      // left face   → −y'
        [[-a, off], [a, off]],        // top face    → +x'
        [[a, -off], [-a, -off]]       // bottom face → −x'
      ];
      for (let [A, B] of spec) {
        if (t.txyp < 0) { const t2 = A; A = B; B = t2; }
        const [x1, y1] = pt(A[0], A[1]), [x2, y2] = pt(B[0], B[1]);
        elSvg.appendChild(line(x1, y1, x2, y2,
          { stroke: C.midblue, 'stroke-width': 2.2, 'marker-end': 'url(#eTau)' }));
      }
      const [tx, ty] = pt(58, half + 22);
      elSvg.appendChild(txt(tx, ty, '\u03C4x\u2032y\u2032', { fs: 11.5, fw: 600, fill: C.midblue }));
    }
    if (lenX) {
      const [sx1, sy1] = pt(half + 10 + lenX + 18, 0);
      elSvg.appendChild(txt(sx1, sy1 + 4, '\u03C3x\u2032', { fs: 12, fw: 600, fill: C.water }));
    }
    if (lenY) {
      const [sx2, sy2] = pt(0, half + 10 + lenY + 16);
      elSvg.appendChild(txt(sx2, sy2 + 4, '\u03C3y\u2032', { fs: 12, fw: 600, fill: C.water }));
    }
  }

  /* ============================================================
     Mohr's circle (right figure)
     τ axis plotted positive downwards, so a physical rotation θ
     moves the stress point 2θ in the same visual sense.
     ============================================================ */
  function renderCircle() {
    const midY = 204, X0 = 60, X1 = 494, cx0 = (X0 + X1) / 2;
    const a = MohrEngine.analyse(S.sx, S.sy, S.txy);
    const t = MohrEngine.transform(S.sx, S.sy, S.txy, S.th * RAD);

    const lo = Math.min(a.s2, 0), hi = Math.max(a.s1, 0);
    const span = Math.max(hi - lo, 1), pad = 0.18 * span;
    const sHoriz = (X1 - X0) / (span + 2 * pad);
    const sVert = a.R > 1e-9 ? 150 / a.R : Infinity;
    const sc = Math.min(sHoriz, sVert);
    const x = v => cx0 + (v - (lo + hi) / 2) * sc;
    const y = tau => midY + tau * sc;
    const r = a.R * sc;

    while (ciSvg.firstChild) ciSvg.removeChild(ciSvg.firstChild);
    ciSvg.appendChild(s('defs', {}, marker('cAx', C.axis, 6)));

    ciSvg.appendChild(txt(14, 22, "Mohr's circle", { an: 'start', fs: 13, fw: 600, fill: C.ocean, halo: 0, head: true }));

    /* axes */
    ciSvg.appendChild(line(44, midY, 506, midY,
      { stroke: C.axis, 'stroke-width': 1.2, 'marker-end': 'url(#cAx)' }));
    ciSvg.appendChild(txt(506, midY - 8, '\u03C3 (MPa)', { an: 'end', fs: 11, halo: 0 }));
    const xt = clamp(x(0), X0, X1);
    ciSvg.appendChild(line(xt, 36, xt, 392,
      { stroke: C.axis, 'stroke-width': 1.2, 'marker-end': 'url(#cAx)' }));
    ciSvg.appendChild(txt(xt + 6, 402, '\u03C4 (MPa, positive \u2193)', { an: 'start', fs: 11, halo: 0 }));

    /* τmax guides */
    if (r > 3) {
      ciSvg.appendChild(line(x(a.C) - r, y(a.R), x(a.C) + r, y(a.R),
        { stroke: C.contour, 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
      ciSvg.appendChild(line(x(a.C) - r, y(-a.R), x(a.C) + r, y(-a.R),
        { stroke: C.contour, 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
      ciSvg.appendChild(txt(x(a.C), y(a.R) + 15, `\u03C4max = ${fmt(a.tmax)}`, { fs: 10.5 }));
    }

    /* the circle */
    if (r > 1) {
      ciSvg.appendChild(s('circle', {
        cx: x(a.C), cy: midY, r,
        fill: 'rgba(20,65,107,.05)', stroke: C.ocean, 'stroke-width': 2
      }));
    }
    ciSvg.appendChild(s('circle', { cx: x(a.C), cy: midY, r: 2.5, fill: C.ocean }));

    /* principal stress ticks */
    for (const [v, lab] of [[a.s1, '\u03C3\u2081'], [a.s2, '\u03C3\u2082']]) {
      ciSvg.appendChild(line(x(v), midY - 5, x(v), midY + 5, { stroke: C.ocean, 'stroke-width': 1.6 }));
      ciSvg.appendChild(txt(x(v), midY - 10, lab, { fs: 11.5, fw: 600, fill: C.ocean }));
    }

    /* X and Y reference points with their diameter */
    const XP = [x(S.sx), y(S.txy)], YP = [x(S.sy), y(-S.txy)];
    ciSvg.appendChild(line(XP[0], XP[1], YP[0], YP[1], { stroke: C.pale, 'stroke-width': 1.4 }));
    ciSvg.appendChild(s('circle', { cx: XP[0], cy: XP[1], r: 4, fill: C.water }));
    ciSvg.appendChild(s('circle', { cx: YP[0], cy: YP[1], r: 4, fill: '#fff', stroke: C.water, 'stroke-width': 2 }));
    ciSvg.appendChild(txt(XP[0] + 12, XP[1] + 4, 'X', { an: 'start', fs: 11.5, fw: 600, fill: C.water }));
    ciSvg.appendChild(txt(YP[0] - 12, YP[1] + 4, 'Y', { an: 'end', fs: 11.5, fw: 600, fill: C.water }));

    /* highlighted 2θ arc from X to the current plane */
    const twoTh = 2 * S.th;
    if (r > 3 && Math.abs(twoTh) > 1.5) {
      const PP = [x(t.sxp), y(t.txyp)];
      ciSvg.appendChild(s('path', {
        d: `M ${XP[0]} ${XP[1]} A ${r} ${r} 0 0 ${S.th > 0 ? 0 : 1} ${PP[0]} ${PP[1]}`,
        fill: 'none', stroke: C.green, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .85
      }));
      if (Math.abs(S.th) > 4) {
        const alpha = Math.atan2(-S.txy, (S.sx - S.sy) / 2);
        const am = alpha + S.th * RAD;
        ciSvg.appendChild(txt(x(a.C) + (r + 16) * Math.cos(am),
          midY - (r + 16) * Math.sin(am) + 4, '2\u03B8', { fs: 11.5, fw: 600, fill: C.green }));
      }
    }

    /* current plane points P (x' face) and P' (y' face) */
    const PP = [x(t.sxp), y(t.txyp)], QQ = [x(t.syp), y(-t.txyp)];
    ciSvg.appendChild(line(PP[0], PP[1], QQ[0], QQ[1], { stroke: C.green, 'stroke-width': 1.7 }));
    ciSvg.appendChild(s('circle', { cx: QQ[0], cy: QQ[1], r: 4, fill: '#fff', stroke: C.green, 'stroke-width': 2 }));
    ciSvg.appendChild(s('circle', { cx: PP[0], cy: PP[1], r: 5.2, fill: C.green, stroke: '#fff', 'stroke-width': 1.6 }));
    ciSvg.appendChild(txt(PP[0], PP[1] - 11, 'x\u2032 face', { fs: 11, fw: 600, fill: C.green }));
    ciSvg.appendChild(txt(QQ[0], QQ[1] + 18, 'y\u2032 face', { fs: 10.5, fill: C.green }));
  }

  /* ---------- results chips ---------- */
  function chip(k, v, sub, cls) {
    return `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
           `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  }
  function renderChips() {
    const a = MohrEngine.analyse(S.sx, S.sy, S.txy);
    const t = MohrEngine.transform(S.sx, S.sy, S.txy, S.th * RAD);
    resultsEl.innerHTML =
      chip('\u03C3\u2081 principal', `${fmt(a.s1)} MPa`, '', 'ok') +
      chip('\u03C3\u2082 principal', `${fmt(a.s2)} MPa`, '', 'ok') +
      chip('\u03C4max in-plane', `${fmt(a.tmax)} MPa`, '45° from principal planes') +
      chip('\u03B8p', `${fmt(a.thetaP / RAD)}°`, 'to \u03C3\u2081, anticlockwise') +
      chip('\u03C3x\u2032', `${fmt(t.sxp)} MPa`, 'on the θ plane') +
      chip('\u03C3y\u2032', `${fmt(t.syp)} MPa`, 'on the θ plane') +
      chip('\u03C4x\u2032y\u2032', `${fmt(t.txyp)} MPa`, 'on the θ plane');
  }

  function render() { renderElement(); renderCircle(); renderChips(); }

  /* ---------- events ---------- */
  function syncTwin(k) {
    const r = document.getElementById(k + '-r'), n = document.getElementById(k + '-n');
    if (r) r.value = S[k];
    if (n && document.activeElement !== n) n.value = S[k];
  }
  controls.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    const v = parseFloat(e.target.value);
    if (isNaN(v)) return;
    S[k] = k === 'th' ? clamp(v, -90, 90) : clamp(v, -200, 200);
    syncTwin(k);
    if (k !== 'th') {
      const p = document.getElementById('preset');
      if (p) p.value = 'custom';
    }
    render();
  });
  document.getElementById('preset').addEventListener('change', e => {
    const p = PRESETS[e.target.value];
    if (!p) return;
    Object.assign(S, p);
    ['sx', 'sy', 'txy'].forEach(syncTwin);
    render();
  });
  document.getElementById('zero').addEventListener('click', () => {
    S.th = 0; syncTwin('th'); render();
  });

  /* sweep animation */
  let raf = null;
  const sweepBtn = document.getElementById('sweep');
  sweepBtn.addEventListener('click', () => {
    if (raf) { cancelAnimationFrame(raf); raf = null; sweepBtn.textContent = 'Sweep θ'; return; }
    sweepBtn.textContent = 'Stop';
    const step = () => {
      S.th += 0.6;
      if (S.th > 90) S.th = -90;
      S.th = +S.th.toFixed(1);
      syncTwin('th');
      render();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });

  render();
})();
