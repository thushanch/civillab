/* CivilLab · G4 Flow Nets and Seepage */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const VW = 960, VH = 560;
  const PADX = 60, GROUND = 196, SOILMAX = 268, WATERMAX = 124;

  /* ---------- presets, factories so nothing is shared ---------- */
  const PRESETS = {
    pile:  { label:'Sheet pile in sand',       f:()=>({ kind:'sheetpile', W:24, D:9,  d:4.5, B:8, H:6,  kexp:-4.0, Nf:5, Nd:10, Gs:2.65, e:0.65 }) },
    deep:  { label:'Deep cutoff, safe exit',   f:()=>({ kind:'sheetpile', W:24, D:9,  d:7.0, B:8, H:6,  kexp:-4.0, Nf:5, Nd:12, Gs:2.65, e:0.65 }) },
    risky: { label:'Shallow pile, piping risk',f:()=>({ kind:'sheetpile', W:24, D:9,  d:2.0, B:8, H:7,  kexp:-3.5, Nf:4, Nd:8,  Gs:2.65, e:0.80 }) },
    dam:   { label:'Concrete dam, no cutoff',  f:()=>({ kind:'dam',       W:30, D:10, d:0,   B:12,H:7,  kexp:-5.0, Nf:5, Nd:12, Gs:2.68, e:0.60 }) },
    damcut:{ label:'Dam with a heel cutoff',   f:()=>({ kind:'dam',       W:30, D:10, d:5,   B:12,H:7,  kexp:-5.0, Nf:5, Nd:12, Gs:2.68, e:0.60 }) }
  };

  const state = Object.assign({ preset:'pile', base:'pile', fine:false, net:true }, PRESETS.pile.f());

  const kOf = () => Math.pow(10, state.kexp);

  function solveNow() {
    const n = state.fine ? { nx:112, ny:56, iter:12000 } : { nx:64, ny:32, iter:6000 };
    return SeepageEngine.solve({
      kind: state.kind, W: state.W, D: state.D,
      d: Math.min(state.d, state.D - 0.25), B: state.B,
      H: state.H, k: kOf(), nx: n.nx, ny: n.ny, iter: n.iter });
  }

  /* ---------- svg helpers, same in every app ---------- */
  function txt(x, y, str, o = {}) {
    const a = { x, y, 'font-size': o.fs || 12, fill: o.fill || C.muted,
      'text-anchor': o.an || 'middle', 'font-weight': o.fw || 400 };
    if (o.halo !== 0) { a['paint-order'] = 'stroke'; a.stroke = '#fff';
      a['stroke-width'] = o.halo || 3; a['stroke-linejoin'] = 'round'; }
    if (o.head) a['font-family'] = 'Poppins, Inter, sans-serif';
    if (o.rot) a.transform = `rotate(${o.rot} ${x} ${y})`;
    return s('text', a, str);
  }
  const line = (x1, y1, x2, y2, a = {}) => s('line', Object.assign({ x1, y1, x2, y2 }, a));
  function marker(id, color, w = 6.5) {
    return s('marker', { id, viewBox:'0 0 10 10', refX:8.5, refY:5,
      markerWidth:w, markerHeight:w, orient:'auto-start-reverse' },
      s('path', { d:'M0,0 L10,5 L0,10 z', fill:color }));
  }
  const clearSvg = el => { while (el.firstChild) el.removeChild(el.firstChild); };

  /* ---------- render ---------- */
  let last = null;

  function render() {
    const r = solveNow();
    last = r;
    const g = r.g;

    /* one scale for both axes, or the net stops being square */
    const sc = Math.min((VW - 2 * PADX) / g.W, SOILMAX / g.D);
    const wPx = g.W * sc, hPx = g.D * sc;
    const X0 = (VW - wPx) / 2;
    const SX = x => X0 + x * sc;
    const SZ = z => GROUND + (g.D - z) * sc;      // z measured up from the base
    const baseY = GROUND + hPx;

    /* the water can be far deeper than the drawing area, so it gets its own
       scale when it has to, and the figure says so */
    const wantPx = state.H * sc;
    const wsc = wantPx <= WATERMAX ? sc : WATERMAX / state.H;
    const waterSquashed = wsc < sc - 1e-9;

    clearSvg(fig);
    fig.appendChild(s('defs', {},
      marker('fLoad', C.load), marker('fGreen', C.green, 5.5), marker('fWat', C.water, 5.5),
      s('pattern', { id:'rock', width:8, height:8, patternUnits:'userSpaceOnUse',
        patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:8, stroke:C.contour, 'stroke-width':1.6 }))));

    fig.appendChild(txt(PADX - 6, 24,
      g.kind === 'dam' ? 'Seepage under a dam' : 'Seepage under a sheet pile',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));
    fig.appendChild(txt(VW - PADX, 24,
      `${state.fine ? 112 : 64} × ${state.fine ? 56 : 32} grid`,
      { an:'end', fs:11, fill:C.muted, halo:0 }));

    /* soil block */
    fig.appendChild(s('rect', { x:X0, y:GROUND, width:wPx, height:hPx,
      fill:C.pale, 'fill-opacity':.16, stroke:C.hair, 'stroke-width':1 }));

    /* impermeable base */
    fig.appendChild(line(X0, baseY, X0 + wPx, baseY, { stroke:C.ocean, 'stroke-width':2.6 }));
    fig.appendChild(s('rect', { x:X0, y:baseY, width:wPx, height:14, fill:'url(#rock)' }));
    fig.appendChild(txt(X0 + wPx / 2, baseY + 30, 'impermeable stratum',
      { fs:11, fill:C.muted, halo:0 }));

    /* water bodies */
    const upTop = GROUND - state.H * wsc;
    fig.appendChild(s('rect', { x:X0, y:upTop, width:SX(g.W / 2) - X0, height:GROUND - upTop,
      fill:C.water, 'fill-opacity':.16 }));
    fig.appendChild(line(X0, upTop, SX(g.W / 2), upTop, { stroke:C.water, 'stroke-width':2 }));
    fig.appendChild(line(SX(g.W / 2), GROUND, X0 + wPx, GROUND, { stroke:C.water, 'stroke-width':2 }));

    /* the head difference, which is what the student applies */
    const hx = X0 + 30;
    fig.appendChild(line(hx, upTop, hx, GROUND, { stroke:C.load, 'stroke-width':1.8,
      'marker-start':'url(#fLoad)', 'marker-end':'url(#fLoad)' }));
    fig.appendChild(txt(hx + 8, (upTop + GROUND) / 2 + 4, `H = ${fmt(state.H, 1)} m`,
      { an:'start', fs:12.5, fw:600, fill:C.load }));
    if (waterSquashed) fig.appendChild(txt(X0 + wPx / 2, upTop - 10,
      'water levels drawn at a reduced scale', { fs:10.5, fill:C.muted, halo:2.5 }));

    /* the flow net */
    if (state.net) {
      for (const e of r.equipotentials(state.Nd))
        for (const sg of e.segs)
          fig.appendChild(line(SX(sg[0][0]), SZ(sg[0][1]), SX(sg[1][0]), SZ(sg[1][1]),
            { stroke:C.midblue, 'stroke-width':1.15, 'stroke-opacity':.85 }));
      for (const f of r.flowlines(state.Nf))
        for (const sg of f.segs)
          fig.appendChild(line(SX(sg[0][0]), SZ(sg[0][1]), SX(sg[1][0]), SZ(sg[1][1]),
            { stroke:C.water, 'stroke-width':1.9 }));
      fig.appendChild(txt(X0 + 12, baseY - 12,
        `${state.Nf} flow channels, ${state.Nd} drops`,
        { an:'start', fs:11, fill:C.water, fw:600 }));
    }

    /* the structure */
    const cx = SX(g.W / 2);
    if (g.kind === 'sheetpile') {
      const tipY = SZ(g.D - Math.min(state.d, g.D - 0.25));
      const grp = s('g', { 'data-drag':'pile', style:'cursor:ns-resize' });
      grp.appendChild(s('rect', { x:cx - 12, y:GROUND - 46, width:24, height:tipY - GROUND + 60,
        fill:'transparent' }));
      grp.appendChild(line(cx, GROUND - 40, cx, tipY,
        { stroke:C.ocean, 'stroke-width':6, 'stroke-linecap':'round' }));
      grp.appendChild(s('circle', { cx, cy:tipY, r:5, fill:'#fff', stroke:C.ocean, 'stroke-width':2 }));
      fig.appendChild(grp);
      fig.appendChild(txt(cx + 14, GROUND - 26, `d = ${fmt(state.d, 1)} m`,
        { an:'start', fs:12, fw:600, fill:C.ocean }));
      fig.appendChild(txt(cx + 14, GROUND - 10, 'drag the tip', { an:'start', fs:10, fill:C.muted }));
    } else {
      const bx0 = SX(g.W / 2 - state.B / 2), bx1 = SX(g.W / 2 + state.B / 2);
      const top = GROUND - 108;
      fig.appendChild(s('polygon', {
        points: `${bx0},${GROUND} ${bx1},${GROUND} ${bx1 - (bx1 - bx0) * 0.30},${top} ${bx0 + (bx1 - bx0) * 0.12},${top}`,
        fill:'#fff', stroke:C.ocean, 'stroke-width':2.2, 'stroke-linejoin':'round' }));
      fig.appendChild(txt((bx0 + bx1) / 2, top + 58, 'dam', { fs:12.5, fw:600, fill:C.ocean, halo:3 }));
      fig.appendChild(txt((bx0 + bx1) / 2, GROUND - 8, `B = ${fmt(state.B, 1)} m`,
        { fs:11.5, fw:600, fill:C.ocean }));
      if (state.d > 0.05) {
        const tipY = SZ(g.D - Math.min(state.d, g.D - 0.25));
        const grp = s('g', { 'data-drag':'pile', style:'cursor:ns-resize' });
        grp.appendChild(s('rect', { x:bx0 - 12, y:GROUND, width:24, height:tipY - GROUND + 14, fill:'transparent' }));
        grp.appendChild(line(bx0, GROUND, bx0, tipY, { stroke:C.ocean, 'stroke-width':5, 'stroke-linecap':'round' }));
        grp.appendChild(s('circle', { cx:bx0, cy:tipY, r:4.5, fill:'#fff', stroke:C.ocean, 'stroke-width':2 }));
        fig.appendChild(grp);
        fig.appendChild(txt(bx0 - 10, (GROUND + tipY) / 2, `d = ${fmt(state.d, 1)} m`,
          { an:'end', fs:11.5, fw:600, fill:C.ocean }));
      }
      /* uplift pressure diagram, drawn inside the dam pushing up on its base */
      if (r.uplift && r.uplift.pts.length > 1) {
        const umax = Math.max(...r.uplift.pts.map(p => p.u), 1e-9);
        const hMax = 78;
        const pts = r.uplift.pts.map(p => `${SX(p.x)},${GROUND - p.u / umax * hMax}`);
        fig.appendChild(s('polygon', {
          points: `${SX(r.uplift.pts[0].x)},${GROUND} ${pts.join(' ')} ${SX(r.uplift.pts[r.uplift.pts.length - 1].x)},${GROUND}`,
          fill:C.load, 'fill-opacity':.16, stroke:C.load, 'stroke-width':1.8 }));
        for (let n = 0; n < r.uplift.pts.length; n += Math.ceil(r.uplift.pts.length / 6)) {
          const p = r.uplift.pts[n];
          fig.appendChild(line(SX(p.x), GROUND - 2, SX(p.x), GROUND - p.u / umax * hMax + 2,
            { stroke:C.load, 'stroke-width':1, 'stroke-opacity':.55, 'marker-start':'url(#fLoad)' }));
        }
        fig.appendChild(txt((bx0 + bx1) / 2, top + 26,
          `uplift ${fmt(r.uplift.force, 0)} kN/m`, { fs:11.5, fw:600, fill:C.load }));
      }
    }

    /* exit gradient at the downstream face */
    const ic = SeepageEngine.criticalGradient(state.Gs, state.e);
    const fos = r.iExit > 1e-9 ? ic / r.iExit : Infinity;
    const safe = fos >= 3;
    const ex = SX(Math.min(g.W - 0.2, r.xExit));
    fig.appendChild(line(ex, GROUND + 26, ex, GROUND + 2,
      { stroke: safe ? C.green : C.load, 'stroke-width':2.2, 'marker-end':'url(#' + (safe ? 'fGreen' : 'fLoad') + ')' }));
    fig.appendChild(txt(ex + 8, GROUND + 42,
      `exit gradient ${fmt(r.iExit, 2)}`,
      { an:'start', fs:11.5, fw:600, fill: safe ? C.green : C.load }));

    /* verdict */
    fig.appendChild(txt(VW / 2, VH - 14,
      `q = k·H·Nf/Nd = ${fmt(kOf() * state.H * r.shape * 1e6, 2)} × 10⁻⁶ m³/s per metre run` +
      `   ·   true Nf/Nd = ${fmt(r.shape, 3)}`,
      { fs:12, fw:600, fill:C.ocean, halo:0 }));
  }

  /* ---------- results chips ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function drawChips(r) {
    const ic = SeepageEngine.criticalGradient(state.Gs, state.e);
    const fos = r.iExit > 1e-9 ? ic / r.iExit : Infinity;
    const perDay = r.q * 86400;
    let h =
      chip('Discharge q', `${fmt(r.q * 1e6, 2)} ×10⁻⁶`, 'm³/s per metre run', 'ok') +
      chip('q per day', `${fmt(perDay * 1000, 1)} L`, 'litres per day per metre') +
      chip('Form factor', fmt(r.shape, 3), 'Nf/Nd from the solved field') +
      chip('Net you drew', fmt(state.Nf / state.Nd, 3), `${state.Nf} channels / ${state.Nd} drops`,
           Math.abs(state.Nf / state.Nd - r.shape) / Math.max(r.shape, 1e-9) < 0.12 ? 'ok' : 'warn') +
      chip('Head drop per drop', `${fmt(state.H / state.Nd, 2)} m`, 'H / Nd') +
      chip('Exit gradient', fmt(r.iExit, 3), 'steepest at the downstream face') +
      chip('Critical gradient', fmt(ic, 3), '(Gs − 1)/(1 + e)') +
      chip('FoS on piping', fos > 99 ? '> 99' : fmt(fos, 2), 'i_c / i_e, aim for 3',
           fos >= 3 ? 'ok' : 'warn');
    if (r.uplift)
      h += chip('Uplift force', `${fmt(r.uplift.force, 0)} kN/m`, 'on the dam base', 'warn') +
           chip('Acts at', `${fmt(r.uplift.arm, 2)} m`, 'from the heel, upstream of mid base');
    resultsEl.innerHTML = h;
  }

  const renderAll = () => { render(); drawChips(last); syncNote(); };

  function syncNote() {
    const n = document.getElementById('kNote');
    if (n) n.textContent = `k = ${kOf().toExponential(1)} m/s` +
      `  (${kOf() > 1e-3 ? 'gravel' : kOf() > 1e-5 ? 'sand' : kOf() > 1e-7 ? 'silty sand' : 'silt or clay'})`;
  }

  /* ---------- controls ---------- */
  function renderControls() {
    const opts = Object.entries(PRESETS)
      .map(([k, p]) => `<option value="${k}"${k === state.preset ? ' selected' : ''}>${p.label}</option>`).join('');
    const row = (id, lab, min, max, st, val) => `<div class="ctl"><label for="${id}n">${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    controls.innerHTML = `
      <h3>Case</h3>
      <div class="ctl"><select id="preset"><option value="">Custom</option>${opts}</select></div>
      <div class="ctl"><select id="kind">
        <option value="sheetpile"${state.kind === 'sheetpile' ? ' selected' : ''}>Sheet pile wall</option>
        <option value="dam"${state.kind === 'dam' ? ' selected' : ''}>Dam with a cutoff</option>
      </select></div>
      <h3>Geometry</h3>
      ${row('H', 'Head difference H (m)', 0, 20, 0.5, state.H)}
      ${row('d', 'Cutoff penetration d (m)', 0, Math.max(1, state.D - 0.5), 0.25, state.d)}
      ${state.kind === 'dam' ? row('B', 'Dam base width B (m)', 2, 24, 0.5, state.B) : ''}
      ${row('D', 'Permeable layer D (m)', 3, 20, 0.5, state.D)}
      ${row('W', 'Domain width W (m)', 10, 40, 1, state.W)}
      <h3>Soil</h3>
      ${row('kexp', 'log₁₀ k (k in m/s)', -8, -2, 0.1, state.kexp)}
      <div id="kNote" style="font-size:12.5px;font-weight:600;color:#14416B;margin:2px 0 6px"></div>
      ${row('Gs', 'Specific gravity Gs', 2.5, 2.8, 0.01, state.Gs)}
      ${row('e', 'Void ratio e', 0.3, 1.2, 0.05, state.e)}
      <h3>The net you draw</h3>
      ${row('Nf', 'Flow channels Nf', 2, 8, 1, state.Nf)}
      ${row('Nd', 'Equipotential drops Nd', 4, 18, 1, state.Nd)}
      <label class="chk"><input type="checkbox" id="net"${state.net ? ' checked' : ''}>
        <span>Draw the flow net</span></label>
      <label class="chk"><input type="checkbox" id="fine"${state.fine ? ' checked' : ''}>
        <span>Fine grid, slower but more accurate</span></label>`;
  }

  const LIM = { H:[0,20], d:[0,19.5], B:[2,24], D:[3,20], W:[10,40],
                kexp:[-8,-2], Gs:[2.5,2.8], e:[0.3,1.2], Nf:[2,8], Nd:[4,18] };
  const setCustom = () => { state.preset = ''; const e = document.getElementById('preset'); if (e) e.value = ''; };
  function syncKey(k) {
    for (const suf of ['r', 'n']) {
      const el = document.getElementById(k + suf);
      if (el && document.activeElement !== el) el.value = state[k];
    }
  }

  controls.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k || !LIM[k]) return;
    const v = parseFloat(e.target.value);
    if (isNaN(v)) return;
    state[k] = clamp(v, LIM[k][0], LIM[k][1]);
    if (k === 'D') state.d = Math.min(state.d, state.D - 0.5);
    for (const suf of ['r', 'n']) {
      const el = document.getElementById(k + suf);
      if (el && el !== e.target && document.activeElement !== el) el.value = state[k];
    }
    if (k === 'D') syncKey('d');
    setCustom();
    renderAll();
  });

  controls.addEventListener('change', e => {
    if (e.target.id === 'preset') {
      const p = PRESETS[e.target.value];
      if (!p) { state.preset = ''; return; }
      Object.assign(state, p.f());
      state.preset = state.base = e.target.value;
      renderControls(); renderAll();
    } else if (e.target.id === 'kind') {
      state.kind = e.target.value;
      setCustom(); renderControls();
      const m = document.getElementById('kind'); if (m) m.value = state.kind;
      renderAll();
    } else if (e.target.id === 'net' || e.target.id === 'fine') {
      state[e.target.id] = e.target.checked;
      renderAll();
    }
  });

  /* ---------- drag the cutoff tip ---------- */
  let dragging = false;
  const closestG = el => {
    while (el && el !== fig) {
      if (el.getAttribute && el.getAttribute('data-drag')) return el;
      el = el.parentNode;
    }
    return null;
  };
  fig.addEventListener('pointerdown', e => {
    if (!closestG(e.target)) return;
    dragging = true;
    try { fig.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  fig.addEventListener('pointermove', e => {
    if (!dragging) return;
    const b = fig.getBoundingClientRect();
    if (!b.height) return;
    const py = (e.clientY - b.top) * (VH / b.height);
    const sc = Math.min((VW - 2 * PADX) / state.W, SOILMAX / state.D);
    const dNew = clamp(snap((py - GROUND) / sc, 0.25), 0, state.D - 0.5);
    if (!isFinite(dNew) || dNew === state.d) return;
    state.d = dNew;
    syncKey('d');
    setCustom();
    renderAll();
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    try { fig.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  fig.addEventListener('pointerup', endDrag);
  fig.addEventListener('pointercancel', endDrag);

  /* ---------- boot ---------- */
  renderControls();
  renderAll();
})();
