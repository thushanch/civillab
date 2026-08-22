/* CivilLab · S1 Beam SFD & BMD Studio */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  /* ---------------- colours (brand tokens) ---------------- */
  const C = {
    ocean: '#14416B', water: '#1E78B0', green: '#2E6B4F',
    load: '#B03A2E', muted: '#5C6A72', axis: '#B9C0C5', contour: '#C9CEC7'
  };

  /* ---------------- layout constants ---------------- */
  const W = 960, H = 620, PADL = 64, PADR = 30;
  const BEAM_Y = 100, RULER_Y = 196;
  const SFD = { title: 226, zero: 296, amp: 56 };
  const BMD = { title: 386, zero: 488, amp: 84 };
  const TRK = { top: 238, bot: 574 };

  /* ---------------- state ---------------- */
  let uid = 1;
  const nid = () => 'ld' + (uid++);
  const pt = (P, a) => ({ id: nid(), type: 'point', P, a });
  const ud = (w, x1, x2) => ({ id: nid(), type: 'udl', w, x1, x2 });
  const mo = (M, a) => ({ id: nid(), type: 'moment', M, a });

  const PRESETS = {
    mix:  { label: 'Point + partial UDL',        mode: 'ss',    L: 8,  loads: () => [pt(20, 3), ud(10, 5, 8)] },
    pmid: { label: 'Central point load',          mode: 'ss',    L: 8,  loads: () => [pt(20, 4)] },
    udlf: { label: 'Full-span UDL',               mode: 'ss',    L: 6,  loads: () => [ud(10, 0, 6)] },
    mmid: { label: 'Moment at midspan',           mode: 'ss',    L: 8,  loads: () => [mo(24, 4)] },
    ctip: { label: 'Cantilever · tip load',       mode: 'cantl', L: 4,  loads: () => [pt(15, 4)] },
    cudl: { label: 'Cantilever · full UDL',       mode: 'cantl', L: 4,  loads: () => [ud(12, 0, 4)] },
    over: { label: 'Overhanging · full UDL',      mode: 'over',  L: 10, xA: 2, xB: 8, loads: () => [ud(8, 0, 10)] }
  };

  const state = {
    presetKey: 'mix', mode: 'ss', L: 8, xA: 1, xB: 7,
    bmdDown: true, loads: PRESETS.mix.loads()
  };

  /* map UI mode to what the engine expects */
  function engineState() {
    if (state.mode === 'ss')   return { L: state.L, config: 'ss', xA: 0, xB: state.L, loads: state.loads };
    if (state.mode === 'over') return { L: state.L, config: 'ss', xA: state.xA, xB: state.xB, loads: state.loads };
    return { L: state.L, config: 'cant', cantSide: state.mode === 'cantl' ? 'left' : 'right', loads: state.loads };
  }

  /* ---------------- scales ---------------- */
  const xpx = x => PADL + (x / state.L) * (W - PADL - PADR);
  const xval = px => clamp((px - PADL) / (W - PADL - PADR) * state.L, 0, state.L);
  const evX = e => { const r = fig.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); };

  let res = null;                  // last solve
  const DIAG = {};                 // per-diagram scale meta for the tracker
  let trk = null;                  // tracker nodes

  /* ---------------- svg helpers ---------------- */
  function txt(x, y, str, o = {}) {
    const a = {
      x, y, 'font-size': o.fs || 12, fill: o.fill || C.muted,
      'text-anchor': o.an || 'middle', 'font-weight': o.fw || 400
    };
    if (o.halo !== 0) {
      a['paint-order'] = 'stroke'; a.stroke = '#fff';
      a['stroke-width'] = o.halo || 3; a['stroke-linejoin'] = 'round';
    }
    if (o.head) a['font-family'] = 'Poppins, Inter, sans-serif';
    return s('text', a, str);
  }
  const line = (x1, y1, x2, y2, a = {}) => s('line', Object.assign({ x1, y1, x2, y2 }, a));

  function marker(id, color, w = 7) {
    return s('marker',
      { id, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: w, markerHeight: w, orient: 'auto-start-reverse' },
      s('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
  }
  function drawDefs() {
    fig.appendChild(s('defs', {},
      marker('mLoad', C.load), marker('mLoadS', C.load, 5.5),
      marker('mReact', C.green), marker('mMom', C.load, 6)));
  }

  /* ---------------- beam panel ---------------- */
  function drawBeamPanel() {
    const L = state.L, R = res.reactions;
    fig.appendChild(txt(PADL, 22, 'Loading', { an: 'start', fs: 13, fw: 600, fill: C.ocean, halo: 0, head: true }));

    /* ruler */
    fig.appendChild(line(xpx(0), RULER_Y, xpx(L), RULER_Y, { stroke: C.axis, 'stroke-width': 1 }));
    const step = L <= 12 ? 1 : 2;
    for (let x = 0; x <= L + 1e-9; x += step) {
      fig.appendChild(line(xpx(x), RULER_Y - 3, xpx(x), RULER_Y + 3, { stroke: C.axis, 'stroke-width': 1 }));
      fig.appendChild(txt(xpx(x), RULER_Y + 15, fmt(x, 0), { fs: 10.5, halo: 0 }));
    }
    fig.appendChild(txt(W - PADR, RULER_Y + 15, 'x (m)', { an: 'end', fs: 10.5, halo: 0 }));

    /* supports + reactions */
    if (R.type === 'ss') {
      support(xpx(R.xA), false);
      support(xpx(R.xB), true);
      reactionArrow(R.xA, R.RA, 'RA');
      reactionArrow(R.xB, R.RB, 'RB');
    } else {
      fixedSupport(R.side);
      reactionArrow(R.x0, R.R, 'R');
      fig.appendChild(txt(xpx(R.x0), BEAM_Y + 86,
        `Mfix = ${fmt(R.MR)} kN·m`, { fs: 11, fw: 600, fill: C.green }));
    }

    /* beam */
    fig.appendChild(line(xpx(0), BEAM_Y, xpx(L), BEAM_Y,
      { stroke: C.ocean, 'stroke-width': 7, 'stroke-linecap': 'butt' }));

    /* loads (drawn last, draggable) */
    for (const ld of state.loads) {
      if (ld.type === 'point') drawPoint(ld);
      else if (ld.type === 'udl') drawUdl(ld);
      else drawMoment(ld);
    }
  }

  function support(x, roller) {
    const g = s('g');
    g.appendChild(s('polygon', {
      points: `${x},${BEAM_Y + 3} ${x - 13},${BEAM_Y + 25} ${x + 13},${BEAM_Y + 25}`,
      fill: C.ocean
    }));
    let gy = BEAM_Y + 26;
    if (roller) {
      g.appendChild(s('circle', { cx: x - 6, cy: BEAM_Y + 30, r: 4, fill: '#fff', stroke: C.ocean, 'stroke-width': 1.6 }));
      g.appendChild(s('circle', { cx: x + 6, cy: BEAM_Y + 30, r: 4, fill: '#fff', stroke: C.ocean, 'stroke-width': 1.6 }));
      gy = BEAM_Y + 35;
    }
    g.appendChild(line(x - 17, gy, x + 17, gy, { stroke: C.ocean, 'stroke-width': 1.6 }));
    for (let i = -12; i <= 12; i += 8)
      g.appendChild(line(x + i, gy, x + i - 5, gy + 6, { stroke: C.contour, 'stroke-width': 1.4 }));
    fig.appendChild(g);
  }

  function fixedSupport(side) {
    const x = side === 'left' ? xpx(0) : xpx(state.L);
    const out = side === 'left' ? -1 : 1;
    const g = s('g');
    g.appendChild(line(x, BEAM_Y - 28, x, BEAM_Y + 28, { stroke: C.ocean, 'stroke-width': 5 }));
    for (let y = BEAM_Y - 24; y <= BEAM_Y + 24; y += 10)
      g.appendChild(line(x + out * 3, y, x + out * 12, y + 8, { stroke: C.contour, 'stroke-width': 1.4 }));
    fig.appendChild(g);
  }

  function reactionArrow(xd, val, label) {
    const x = xpx(xd), up = val >= 0;
    const y1 = up ? BEAM_Y + 60 : BEAM_Y + 42;
    const y2 = up ? BEAM_Y + 42 : BEAM_Y + 60;
    fig.appendChild(line(x, y1, x, y2,
      { stroke: C.green, 'stroke-width': 2.4, 'marker-end': 'url(#mReact)' }));
    fig.appendChild(txt(x, BEAM_Y + 74, `${label} = ${fmt(val)} kN`,
      { fs: 11, fw: 600, fill: C.green }));
  }

  function drawPoint(ld) {
    const x = xpx(ld.a), g = s('g', { 'data-id': ld.id });
    g.appendChild(s('rect', { x: x - 12, y: BEAM_Y - 72, width: 24, height: 70, fill: 'transparent' }));
    if (ld.P >= 0)
      g.appendChild(line(x, BEAM_Y - 58, x, BEAM_Y - 6, { stroke: C.load, 'stroke-width': 2.6, 'marker-end': 'url(#mLoad)' }));
    else
      g.appendChild(line(x, BEAM_Y - 6, x, BEAM_Y - 58, { stroke: C.load, 'stroke-width': 2.6, 'marker-end': 'url(#mLoad)' }));
    g.appendChild(txt(x, BEAM_Y - 64, `${fmt(ld.P)} kN`, { fs: 11.5, fw: 600, fill: C.load }));
    fig.appendChild(g);
  }

  function drawUdl(ld) {
    const x1 = xpx(ld.x1), x2 = xpx(ld.x2), top = BEAM_Y - 44;
    const g = s('g', { 'data-id': ld.id });
    g.appendChild(s('rect', { x: x1, y: top, width: x2 - x1, height: 40, fill: 'rgba(176,58,46,.07)' }));
    g.appendChild(line(x1, top, x2, top, { stroke: C.load, 'stroke-width': 2 }));
    const n = Math.max(2, Math.round((x2 - x1) / 30) + 1);
    for (let i = 0; i < n; i++) {
      const x = x1 + (x2 - x1) * i / (n - 1);
      if (ld.w >= 0)
        g.appendChild(line(x, top + 2, x, BEAM_Y - 7, { stroke: C.load, 'stroke-width': 1.6, 'marker-end': 'url(#mLoadS)' }));
      else
        g.appendChild(line(x, BEAM_Y - 7, x, top + 2, { stroke: C.load, 'stroke-width': 1.6, 'marker-end': 'url(#mLoadS)' }));
    }
    g.appendChild(txt((x1 + x2) / 2, top - 8, `${fmt(ld.w)} kN/m`, { fs: 11.5, fw: 600, fill: C.load }));
    fig.appendChild(g);
  }

  function drawMoment(ld) {
    const x = xpx(ld.a), cy = BEAM_Y - 24, r = 15;
    const g = s('g', { 'data-id': ld.id });
    g.appendChild(s('circle', { cx: x, cy, r: 22, fill: 'transparent' }));
    const RAD = Math.PI / 180, a0 = -50 * RAD, a1 = 230 * RAD;
    const P = a => [x + r * Math.cos(a), cy - r * Math.sin(a)];
    const ccw = ld.M >= 0;
    const [sx, sy] = ccw ? P(a0) : P(a1);
    const [ex, ey] = ccw ? P(a1) : P(a0);
    g.appendChild(s('path', {
      d: `M ${sx} ${sy} A ${r} ${r} 0 1 ${ccw ? 0 : 1} ${ex} ${ey}`,
      fill: 'none', stroke: C.load, 'stroke-width': 2.4, 'marker-end': 'url(#mMom)'
    }));
    g.appendChild(s('circle', { cx: x, cy: BEAM_Y, r: 3, fill: C.load }));
    g.appendChild(txt(x, cy - r - 9, `${fmt(ld.M)} kN·m`, { fs: 11.5, fw: 600, fill: C.load }));
    fig.appendChild(g);
  }

  /* ---------------- SFD / BMD panels ---------------- */
  function drawDiagram(P, key, color, unit) {
    const S = res.samples;
    let vmax = 0;
    for (const p of S) vmax = Math.max(vmax, Math.abs(p[key]));
    const sc = P.amp / Math.max(vmax, 1e-9);
    const down = (key === 'M' && state.bmdDown);
    const dir = down ? 1 : -1;
    const y = v => P.zero + dir * v * sc;
    DIAG[key] = { zero: P.zero, sc, dir };

    fig.appendChild(txt(PADL, P.title,
      key === 'V' ? 'Shear force V (kN)' : 'Bending moment M (kN·m)',
      { an: 'start', fs: 13, fw: 600, fill: C.ocean, halo: 0, head: true }));
    if (key === 'M')
      fig.appendChild(txt(W - PADR, P.title,
        down ? 'sagging drawn downwards (tension side)' : 'sagging drawn upwards',
        { an: 'end', fs: 10.5, halo: 0 }));

    fig.appendChild(line(PADL, P.zero, W - PADR, P.zero, { stroke: C.axis, 'stroke-width': 1 }));
    fig.appendChild(txt(PADL - 8, P.zero + 4, '0', { an: 'end', fs: 10.5, halo: 0 }));

    let d = `M ${xpx(S[0].x).toFixed(2)} ${y(S[0][key]).toFixed(2)}`;
    for (let i = 1; i < S.length; i++)
      d += ` L ${xpx(S[i].x).toFixed(2)} ${y(S[i][key]).toFixed(2)}`;
    const dFill = d + ` L ${xpx(S[S.length - 1].x).toFixed(2)} ${P.zero}` +
                      ` L ${xpx(S[0].x).toFixed(2)} ${P.zero} Z`;
    fig.appendChild(s('path', { d: dFill, fill: color, 'fill-opacity': .13, stroke: 'none' }));
    fig.appendChild(s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));

    /* extreme labels */
    const marks = key === 'V' ? [res.Vmax, res.Vmin] : [res.Mmax, res.Mmin];
    const seen = new Set();
    for (const m of marks) {
      const v = m[key];
      if (Math.abs(v) < Math.max(vmax * 1e-3, 1e-6)) continue;
      const kx = v.toFixed(4) + '@' + m.x.toFixed(3);
      if (seen.has(kx)) continue;
      seen.add(kx);
      const px = xpx(m.x), py = y(v);
      const lx = clamp(px, PADL + 40, W - PADR - 46);
      fig.appendChild(s('circle', { cx: px, cy: py, r: 3, fill: color }));
      fig.appendChild(txt(lx, py <= P.zero ? py - 8 : py + 16,
        `${fmt(v)} at ${fmt(m.x, 2)} m`, { fs: 11.5, fw: 600, fill: color }));
    }
    void unit;
  }

  /* ---------------- tracker ---------------- */
  function buildTracker() {
    trk = {
      g: s('g', { visibility: 'hidden', 'pointer-events': 'none' }),
      vline: line(0, TRK.top, 0, TRK.bot, { stroke: '#7C8792', 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
      dv: s('circle', { r: 3.6, fill: '#fff', stroke: C.water, 'stroke-width': 2 }),
      dm: s('circle', { r: 3.6, fill: '#fff', stroke: C.green, 'stroke-width': 2 }),
      t: txt(W - PADR, SFD.title, '', { an: 'end', fs: 12, fw: 500, fill: '#1C2A33' })
    };
    trk.g.append(trk.vline, trk.dv, trk.dm, trk.t);
    fig.appendChild(trk.g);
  }
  function probe(x) {
    const S = res.samples;
    if (x <= S[0].x) return S[0];
    if (x >= S[S.length - 1].x) return S[S.length - 1];
    let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (hi + lo) >> 1; (S[m].x <= x ? lo = m : hi = m); }
    const a = S[lo], b = S[hi], t = (x - a.x) / Math.max(b.x - a.x, 1e-12);
    return { x, V: a.V + t * (b.V - a.V), M: a.M + t * (b.M - a.M) };
  }
  function showTracker(x) {
    if (!res || !trk) return;
    const p = probe(x), px = xpx(x);
    trk.g.setAttribute('visibility', 'visible');
    trk.vline.setAttribute('x1', px); trk.vline.setAttribute('x2', px);
    trk.dv.setAttribute('cx', px);
    trk.dv.setAttribute('cy', DIAG.V.zero + DIAG.V.dir * p.V * DIAG.V.sc);
    trk.dm.setAttribute('cx', px);
    trk.dm.setAttribute('cy', DIAG.M.zero + DIAG.M.dir * p.M * DIAG.M.sc);
    trk.t.textContent = `x = ${fmt(x, 2)} m    V = ${fmt(p.V)} kN    M = ${fmt(p.M)} kN·m`;
  }
  const hideTracker = () => trk && trk.g.setAttribute('visibility', 'hidden');

  /* ---------------- results chips ---------------- */
  function chip(k, v, sub, cls) {
    return `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
           `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  }
  function updateResults() {
    const R = res.reactions, tol = 1e-4;
    let out = '';
    if (R.type === 'ss') {
      out += chip('Reaction RA', `${fmt(R.RA)} kN`, `at x = ${fmt(R.xA)} m`, 'ok');
      out += chip('Reaction RB', `${fmt(R.RB)} kN`, `at x = ${fmt(R.xB)} m`, 'ok');
    } else {
      out += chip('Reaction R', `${fmt(R.R)} kN`, `${R.side} wall`, 'ok');
      out += chip('Fixing moment', `${fmt(R.MR)} kN·m`, 'at the wall', 'ok');
    }
    if (res.Mmax.M > tol)
      out += chip('Max sagging M', `${fmt(res.Mmax.M)} kN·m`, `at x = ${fmt(res.Mmax.x, 2)} m`);
    if (res.Mmin.M < -tol)
      out += chip('Max hogging M', `${fmt(res.Mmin.M)} kN·m`, `at x = ${fmt(res.Mmin.x, 2)} m`, 'warn');
    const vAbs = Math.abs(res.Vmax.V) >= Math.abs(res.Vmin.V) ? res.Vmax : res.Vmin;
    out += chip('Max |V|', `${fmt(Math.abs(vAbs.V))} kN`, `at x = ${fmt(vAbs.x, 2)} m`);
    resultsEl.innerHTML = out;
  }

  /* ---------------- figure render ---------------- */
  function renderFigure() {
    res = BeamEngine.solve(engineState());
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    drawDefs();
    drawBeamPanel();
    drawDiagram(SFD, 'V', C.water, 'kN');
    drawDiagram(BMD, 'M', C.green, 'kN·m');
    buildTracker();
    updateResults();
  }

  /* ---------------- controls ---------------- */
  function loadCard(ld) {
    const L = state.L;
    const del = `<button class="del" data-del="${ld.id}" title="Remove load">✕</button>`;
    const num = (k, lab, val, step, min, max) =>
      `<div class="mini"><label>${lab}</label>` +
      `<input type="number" step="${step}" ${min != null ? `min="${min}"` : ''} ` +
      `${max != null ? `max="${max}"` : ''} value="${val}" data-ld="${ld.id}" data-k="${k}"></div>`;
    if (ld.type === 'point')
      return `<div class="loadcard"><div class="head"><span class="badge point">Point</span>${del}</div>
        <div class="grid2">${num('P', 'P (kN)', ld.P, 1)}${num('a', 'x (m)', ld.a, 0.1, 0, L)}</div></div>`;
    if (ld.type === 'udl')
      return `<div class="loadcard"><div class="head"><span class="badge udl">UDL</span>${del}</div>
        <div class="grid3">${num('w', 'w (kN/m)', ld.w, 1)}${num('x1', 'from (m)', ld.x1, 0.1, 0, L)}${num('x2', 'to (m)', ld.x2, 0.1, 0, L)}</div></div>`;
    return `<div class="loadcard"><div class="head"><span class="badge moment">Moment</span>${del}</div>
      <div class="grid2">${num('M', 'M (kN·m, + ccw)', ld.M, 1)}${num('a', 'x (m)', ld.a, 0.1, 0, L)}</div></div>`;
  }

  function renderControls() {
    const presetOpts = Object.entries(PRESETS)
      .map(([k, p]) => `<option value="${k}" ${state.presetKey === k ? 'selected' : ''}>${p.label}</option>`)
      .join('') + `<option value="custom" ${state.presetKey === 'custom' ? 'selected' : ''}>Custom</option>`;
    const modeOpts = [
      ['ss', 'Simply supported'], ['over', 'Overhanging (two supports)'],
      ['cantl', 'Cantilever · fixed left'], ['cantr', 'Cantilever · fixed right']
    ].map(([v, t]) => `<option value="${v}" ${state.mode === v ? 'selected' : ''}>${t}</option>`).join('');

    controls.innerHTML = `
      <h3>Presets</h3>
      <div class="ctl"><select id="preset">${presetOpts}</select></div>

      <h3>Beam</h3>
      <div class="ctl"><label for="mode">Configuration</label><select id="mode">${modeOpts}</select></div>
      <div class="ctl"><label for="Ln">Length L (m)</label>
        <div class="row">
          <input type="range" id="Lr" min="2" max="16" step="0.5" value="${state.L}">
          <input type="number" id="Ln" min="2" max="16" step="0.5" value="${state.L}">
        </div>
      </div>
      ${state.mode === 'over' ? `
      <div class="grid2">
        <div class="mini"><label>Support A at (m)</label>
          <input type="number" id="xA" step="0.1" min="0" max="${state.L}" value="${state.xA}"></div>
        <div class="mini"><label>Support B at (m)</label>
          <input type="number" id="xB" step="0.1" min="0" max="${state.L}" value="${state.xB}"></div>
      </div>` : ''}
      <div class="ctl"><label class="chk">
        <input type="checkbox" id="bmdDown" ${state.bmdDown ? 'checked' : ''}>
        <span>Draw BMD on the tension side (sagging downwards)</span></label>
      </div>

      <h3>Loads</h3>
      <div id="loadlist">${state.loads.map(loadCard).join('')}</div>
      <div class="addrow">
        <button class="btn ghost small" data-add="point">+ Point load</button>
        <button class="btn ghost small" data-add="udl">+ UDL</button>
        <button class="btn ghost small" data-add="moment">+ Moment</button>
      </div>`;
  }

  function markCustom() {
    state.presetKey = 'custom';
    const p = document.getElementById('preset');
    if (p) p.value = 'custom';
  }

  function clampLoads() {
    const L = state.L;
    for (const ld of state.loads) {
      if (ld.type === 'udl') {
        ld.x1 = clamp(ld.x1, 0, L - 0.1);
        ld.x2 = clamp(ld.x2, ld.x1 + 0.1, L);
      } else ld.a = clamp(ld.a, 0, L);
    }
    state.xB = clamp(state.xB, 0.5, L);
    state.xA = clamp(state.xA, 0, state.xB - 0.5);
  }

  function syncLoadInputs(ld) {
    for (const k of ['P', 'w', 'M', 'a', 'x1', 'x2']) {
      if (!(k in ld)) continue;
      const inp = controls.querySelector(`input[data-ld="${ld.id}"][data-k="${k}"]`);
      if (inp && document.activeElement !== inp) inp.value = ld[k];
    }
  }

  function applyPreset(key) {
    if (key === 'custom') { state.presetKey = 'custom'; return; }
    const P = PRESETS[key];
    state.presetKey = key;
    state.mode = P.mode;
    state.L = P.L;
    state.xA = P.xA != null ? P.xA : 1;
    state.xB = P.xB != null ? P.xB : P.L - 1;
    state.loads = P.loads();
    renderControls();
    renderFigure();
  }

  /* ---------------- events: controls ---------------- */
  controls.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'Lr' || t.id === 'Ln') {
      state.L = clamp(parseFloat(t.value) || 2, 2, 16);
      const other = document.getElementById(t.id === 'Lr' ? 'Ln' : 'Lr');
      if (other) other.value = state.L;
      clampLoads();
      for (const ld of state.loads) syncLoadInputs(ld);
      const xA = document.getElementById('xA'), xB = document.getElementById('xB');
      if (xA) xA.value = state.xA; if (xB) xB.value = state.xB;
      renderFigure(); markCustom(); return;
    }
    if (t.id === 'xA' || t.id === 'xB') {
      const v = parseFloat(t.value); if (isNaN(v)) return;
      if (t.id === 'xA') state.xA = v; else state.xB = v;
      clampLoads(); renderFigure(); markCustom(); return;
    }
    if (t.id === 'bmdDown') { state.bmdDown = t.checked; renderFigure(); return; }
    if (t.dataset.ld) {
      const ld = state.loads.find(l => l.id === t.dataset.ld);
      const k = t.dataset.k, v = parseFloat(t.value);
      if (!ld || isNaN(v)) return;
      if (k === 'a') ld.a = clamp(v, 0, state.L);
      else if (k === 'x1') ld.x1 = clamp(v, 0, ld.x2 - 0.1);
      else if (k === 'x2') ld.x2 = clamp(v, ld.x1 + 0.1, state.L);
      else ld[k] = clamp(v, -500, 500);
      renderFigure(); markCustom();
    }
  });

  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'mode') {
      state.mode = t.value;
      if (state.mode === 'over') {
        state.xA = clamp(state.xA, 0, state.L - 1);
        state.xB = clamp(state.xB, state.xA + 0.5, state.L);
        if (state.xB - state.xA < 0.5) { state.xA = 1; state.xB = state.L - 1; }
      }
      renderControls(); renderFigure(); markCustom();
    }
    if (t.id === 'preset') applyPreset(t.value);
  });

  controls.addEventListener('click', e => {
    const add = e.target.dataset && e.target.dataset.add;
    const del = e.target.dataset && e.target.dataset.del;
    if (add) {
      const L = state.L;
      if (add === 'point') state.loads.push(pt(10, snap(L / 2, 0.1)));
      if (add === 'udl') state.loads.push(ud(5, snap(L * 0.25, 0.1), snap(L * 0.75, 0.1)));
      if (add === 'moment') state.loads.push(mo(10, snap(L / 2, 0.1)));
      renderControls(); renderFigure(); markCustom();
    }
    if (del) {
      state.loads = state.loads.filter(l => l.id !== del);
      renderControls(); renderFigure(); markCustom();
    }
  });

  /* ---------------- events: figure drag + tracker ---------------- */
  let drag = null;
  fig.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-id]');
    if (!g) return;
    const ld = state.loads.find(l => l.id === g.getAttribute('data-id'));
    if (!ld) return;
    e.preventDefault();
    fig.setPointerCapture(e.pointerId);
    const gx = xval(evX(e));
    drag = ld.type === 'udl' ? { ld, off: ld.x1 - gx } : { ld };
    markCustom();
  });
  fig.addEventListener('pointermove', e => {
    const x = xval(evX(e));
    if (drag) {
      const ld = drag.ld;
      if (ld.type === 'udl') {
        const len = ld.x2 - ld.x1;
        const nx1 = snap(clamp(x + drag.off, 0, state.L - len), 0.1);
        ld.x1 = +nx1.toFixed(2);
        ld.x2 = +(nx1 + len).toFixed(2);
      } else {
        ld.a = +snap(clamp(x, 0, state.L), 0.1).toFixed(2);
      }
      renderFigure();
      syncLoadInputs(ld);
    }
    showTracker(x);
  });
  fig.addEventListener('pointerup', () => { drag = null; });
  fig.addEventListener('pointercancel', () => { drag = null; });
  fig.addEventListener('pointerleave', () => { if (!drag) hideTracker(); });

  /* ---------------- boot ---------------- */
  renderControls();
  renderFigure();
})();
