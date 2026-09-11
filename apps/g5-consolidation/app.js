/* CivilLab · G5 Consolidation over Time */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const prof = document.getElementById('prof');
  const curve = document.getElementById('curve');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const DAY = 86400;

  /* ---------- presets, factories so nothing is shared ---------- */
  const PRESETS = {
    soft:  { label:'Soft clay under a fill',  f:()=>({ H:4,  cvExp:-6.5, ds:100, drainage:'two', method:'cc',
                                                       Cc:0.30, Cs:0.06, e0:0.90, s0:100, sp:100, mv:2e-4, Ca:0.015, tExp:1.5 }) },
    oc:    { label:'Overconsolidated clay',   f:()=>({ H:5,  cvExp:-6.0, ds:150, drainage:'two', method:'cc',
                                                       Cc:0.25, Cs:0.05, e0:0.75, s0:100, sp:250, mv:1.5e-4, Ca:0.010, tExp:1.5 }) },
    thick: { label:'Thick layer, one way',    f:()=>({ H:8,  cvExp:-7.0, ds:120, drainage:'one', method:'cc',
                                                       Cc:0.35, Cs:0.07, e0:1.00, s0:120, sp:120, mv:2.5e-4, Ca:0.020, tExp:2.5 }) },
    mv:    { label:'Quick check with mv',     f:()=>({ H:4,  cvExp:-6.5, ds:100, drainage:'two', method:'mv',
                                                       Cc:0.30, Cs:0.06, e0:0.90, s0:100, sp:100, mv:2e-4, Ca:0.015, tExp:1.5 }) }
  };

  const state = Object.assign({ preset:'soft', base:'soft', ghosts:true, playing:false },
                              PRESETS.soft.f());

  const cvOf = () => Math.pow(10, state.cvExp);
  const tOf = () => Math.pow(10, state.tExp) * DAY;

  const solveNow = () => ConsolEngine.solve({
    H: state.H, cv: cvOf(), ds: state.ds, drainage: state.drainage,
    method: state.method, Cc: state.Cc, Cs: state.Cs, e0: state.e0,
    s0: state.s0, sp: state.sp, mv: state.mv, Ca: state.Ca, t: tOf() });

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
  const L10 = x => Math.log(x) / Math.LN10;

  /* =====================================================================
     Figure 1 · the layer and its pore pressure isochrones
     ===================================================================== */
  const PL = 46, PR = 418, PT = 132, PB = 340;
  const COLX0 = PL, COLX1 = PL + 62;          // the soil column
  const PX0 = PL + 96;                        // the isochrone plot
  const UX = r => PX0 + r * (PR - PX0);       // u/u0 from 0 to 1
  const ZY = f => PT + f * (PB - PT);         // f is 0 at the top of the clay

  function drawProfile(r) {
    clearSvg(prof);
    prof.appendChild(s('defs', {}, marker('cLoad', C.load), marker('cWat', C.water, 5.5)));
    prof.appendChild(txt(PL - 6, 22, 'Excess pore pressure',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));
    prof.appendChild(txt(PR, 22, `T = ${fmt(r.T, 3)}`,
      { an:'end', fs:11.5, fw:600, fill:C.ocean, halo:0 }));

    /* how much of the load each phase is carrying, at the slowest point */
    const um = r.uAtDepth(r.twoWay ? 0.5 : 1);
    prof.appendChild(txt(232, 52,
      `at the slowest point, water still carries ${fmt(um * 100, 0)} % of Δσ`,
      { fs:11, fw:600, fill:C.water, halo:0 }));
    prof.appendChild(txt(232, 70,
      `so the soil skeleton has taken ${fmt((1 - um) * 100, 0)} %`,
      { fs:11, fill:C.muted, halo:0 }));

    /* the applied load arriving on top */
    for (let i = 0; i <= 4; i++) {
      const x = COLX0 + (COLX1 - COLX0) * i / 4;
      prof.appendChild(line(x, PT - 28, x, PT - 6,
        { stroke:C.load, 'stroke-width':2, 'marker-end':'url(#cLoad)' }));
    }
    prof.appendChild(txt((COLX0 + COLX1) / 2, PT - 38, `Δσ = ${fmt(state.ds, 0)} kPa`,
      { fs:12, fw:600, fill:C.load, halo:0 }));

    /* the clay layer, and the drained faces */
    prof.appendChild(s('rect', { x:COLX0, y:PT, width:COLX1 - COLX0, height:PB - PT,
      fill:C.pale, 'fill-opacity':.30, stroke:C.ocean, 'stroke-width':1.6 }));
    prof.appendChild(txt((COLX0 + COLX1) / 2, (PT + PB) / 2 - 6, 'CLAY',
      { fs:12, fw:600, fill:C.ocean, halo:3 }));
    prof.appendChild(txt((COLX0 + COLX1) / 2, (PT + PB) / 2 + 10, `H = ${fmt(state.H, 1)} m`,
      { fs:11, fill:C.ocean, halo:3 }));

    const drainFace = (y, up) => {
      prof.appendChild(s('rect', { x:COLX0, y: up ? y - 12 : y, width:COLX1 - COLX0, height:12,
        fill:C.water, 'fill-opacity':.35 }));
      for (let i = 0; i < 3; i++) {
        const x = COLX0 + (COLX1 - COLX0) * (i + 0.5) / 3;
        prof.appendChild(line(x, up ? y - 2 : y + 2, x, up ? y - 16 : y + 16,
          { stroke:C.water, 'stroke-width':1.8, 'marker-end':'url(#cWat)' }));
      }
    };
    drainFace(PT, true);
    if (r.twoWay) drainFace(PB, false);
    else {
      prof.appendChild(line(COLX0, PB, COLX1, PB, { stroke:C.ocean, 'stroke-width':3 }));
      prof.appendChild(txt((COLX0 + COLX1) / 2, PB + 16, 'impermeable',
        { fs:10, fill:C.muted, halo:0 }));
    }
    prof.appendChild(txt((COLX0 + COLX1) / 2, PB + 52,
      r.twoWay ? 'drained both faces' : 'drained at the top only',
      { fs:10.5, fill:C.water, fw:600, halo:0 }));

    /* the isochrone plot */
    for (let i = 0; i <= 5; i++) {
      const x = UX(i / 5);
      prof.appendChild(line(x, PT, x, PB, { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.7 }));
      prof.appendChild(txt(x, PB + 16, fmt(i / 5, 1), { fs:10, halo:0 }));
    }
    prof.appendChild(line(PX0, PT, PX0, PB, { stroke:C.axis, 'stroke-width':1.4 }));
    prof.appendChild(line(PX0, PB, PR, PB, { stroke:C.axis, 'stroke-width':1.4 }));
    prof.appendChild(txt((PX0 + PR) / 2, PB + 34, 'u / u₀  excess pore pressure',
      { fs:11.5, halo:0 }));

    /* ghost isochrones at fixed degrees of consolidation */
    if (state.ghosts) {
      const Us = [0.1, 0.3, 0.5, 0.7, 0.9];
      Us.forEach((U, m) => {
        const T = ConsolEngine.Tv(U);
        const pts = ConsolEngine.isochrone(T, 40, r.twoWay)
          .map(p => `${UX(clamp(p.u, 0, 1))},${ZY(p.z)}`).join(' ');
        prof.appendChild(s('polyline', { points:pts, fill:'none', stroke:C.contour,
          'stroke-width':1.2 }));
        /* fan the labels down the curves so they never sit on top of each other */
        const zf = 0.30 + 0.09 * m;
        const uu = clamp(ConsolEngine.uRatio((r.twoWay ? 2 : 1) * zf, T), 0, 1);
        /* near the right hand edge the label has to sit inside the curve */
        const right = uu > 0.82;
        prof.appendChild(txt(UX(uu) + (right ? -5 : 5), ZY(zf) + 4,
          `${fmt(U * 100, 0)}%`,
          { an: right ? 'end' : 'start', fs:9.5, fill:C.muted, halo:2.5 }));
      });
    }

    /* the isochrone now */
    const iso = r.isochrone(60);
    const pts = iso.map(p => `${UX(clamp(p.u, 0, 1))},${ZY(p.z)}`);
    prof.appendChild(s('polygon', {
      points: `${UX(0)},${ZY(0)} ${pts.join(' ')} ${UX(0)},${ZY(1)}`,
      fill:C.water, 'fill-opacity':.14 }));
    prof.appendChild(s('polyline', { points:pts.join(' '), fill:'none',
      stroke:C.water, 'stroke-width':2.6 }));

    prof.appendChild(txt(PX0 + 4, PB + 52,
      `t = ${fmtTime(r.t)}   ·   U = ${fmt(r.U * 100, 1)} %   ·   H_dr = ${fmt(r.Hdr, 2)} m`,
      { an:'start', fs:12, fw:600, fill:C.green, halo:0 }));
  }

  /* =====================================================================
     Figure 2 · settlement against log time
     ===================================================================== */
  const CL = 62, CR = 540, CT = 54, CB = 344, CVH = 430;

  function drawCurve(r) {
    clearSvg(curve);
    curve.appendChild(s('defs', {}, marker('sGrn', C.green, 5.5)));
    curve.appendChild(txt(CL - 6, 22, 'Settlement against time',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    const pts = r.curve(140);
    const tLo = L10(Math.max(1e-6, pts[0].t / DAY)), tHi = L10(pts[pts.length - 1].t / DAY);
    const lo = Math.floor(Math.min(tLo, state.tExp)) - 0.2;
    const hi = Math.ceil(Math.max(tHi, state.tExp)) + 0.2;
    const TX = lt => CL + (lt - lo) / (hi - lo) * (CR - CL);
    /* with no load there is no settlement axis to speak of, so fall back to a
       nominal range and let the U gridlines carry the figure */
    const tiny = r.Sc * 1000 < 0.05;
    const Smax = tiny ? 1 : r.Sc * 1000 * 1.08;
    const SY = mm => CT + mm / Smax * (CB - CT);

    /* grid */
    for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) {
      curve.appendChild(line(TX(e), CT, TX(e), CB,
        { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.7 }));
      curve.appendChild(txt(TX(e), CB + 17,
        e < 0 ? Math.pow(10, e).toFixed(-e) : String(Math.pow(10, e)), { fs:10.5, halo:0 }));
      for (let m = 2; m <= 9; m++) {
        const x = TX(e + L10(m));
        if (x > CL && x < CR) curve.appendChild(line(x, CB, x, CB - 4,
          { stroke:C.axis, 'stroke-width':.8 }));
      }
    }
    for (let f = 0; f <= 1.001; f += 0.25) {
      const mm = tiny ? Smax * f : r.Sc * 1000 * f;
      curve.appendChild(line(CL, SY(mm), CR, SY(mm),
        { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.7 }));
      if (!tiny)
        curve.appendChild(txt(CL - 8, SY(mm) + 4, fmt(mm, 0), { an:'end', fs:10.5, halo:0 }));
      curve.appendChild(txt(CR + 0, SY(mm) - 5, `U = ${fmt(f * 100, 0)} %`,
        { an:'end', fs:9.5, fill:C.muted, halo:2.5 }));
    }
    curve.appendChild(line(CL, CT, CL, CB, { stroke:C.axis, 'stroke-width':1.4 }));
    curve.appendChild(line(CL, CB, CR, CB, { stroke:C.axis, 'stroke-width':1.4 }));
    curve.appendChild(txt((CL + CR) / 2, CB + 38, 'time (days, log scale)', { fs:11.5, halo:0 }));
    curve.appendChild(txt(16, (CT + CB) / 2, 'settlement (mm)', { fs:11.5, halo:0, rot:-90 }));

    /* the curve, settlement grows downward as it should */
    curve.appendChild(s('polyline', {
      points: pts.map(p => `${TX(L10(p.t / DAY))},${SY(p.S * 1000)}`).join(' '),
      fill:'none', stroke:C.green, 'stroke-width':2.6, 'stroke-linejoin':'round' }));

    /* t50 and t90 guides */
    /* t50 and t90 sit only 0.63 of a decade apart, so their labels are
       staggered or they collide on a wide axis */
    [[r.t50, 't₅₀', CT + 14], [r.t90, 't₉₀', CT - 6]].forEach(([tt, lab, ly]) => {
      if (!isFinite(tt) || tt <= 0) return;
      const x = TX(L10(tt / DAY));
      if (x < CL || x > CR) return;
      curve.appendChild(line(x, CT, x, CB,
        { stroke:C.green, 'stroke-width':1.2, 'stroke-dasharray':'5 4', 'stroke-opacity':.8 }));
      curve.appendChild(txt(clamp(x, CL + 34, CR - 34), ly, `${lab} ${fmtTime(tt)}`,
        { fs:10.5, fw:600, fill:C.green, halo:2.5 }));
    });

    /* the marker at the current time, draggable */
    const mx = TX(state.tExp), my = SY(r.St * 1000);
    curve.appendChild(line(mx, CT, mx, CB, { stroke:C.load, 'stroke-width':1.4,
      'stroke-dasharray':'4 4' }));
    const g = s('g', { 'data-drag':'t', style:'cursor:ew-resize' });
    g.appendChild(s('rect', { x:mx - 16, y:CT, width:32, height:CB - CT, fill:'transparent' }));
    g.appendChild(s('circle', { cx:mx, cy:my, r:6.5, fill:C.load, stroke:'#fff', 'stroke-width':1.8 }));
    curve.appendChild(g);
    /* kept clear of the U labels down the right edge, and dropped below the
       marker when it sits up against the t90 caption */
    curve.appendChild(txt(clamp(mx, CL + 70, CR - 108),
      my < CT + 30 ? my + 40 : my - 14,
      `${fmt(r.St * 1000, 1)} mm at ${fmtTime(r.t)}`,
      { fs:11.5, fw:600, fill:C.load }));

    curve.appendChild(txt((CL + CR) / 2, CVH - 12,
      `T = cv·t/H²dr = ${fmt(r.T, 4)}   ·   U = ${fmt(r.U * 100, 1)} %   ·   drag the marker`,
      { fs:11.5, fw:600, fill:C.ocean, halo:0 }));
  }

  function fmtTime(sec) {
    const d = sec / DAY;
    if (d < 1 / 24) return `${fmt(sec / 60, 0)} min`;
    if (d < 1) return `${fmt(d * 24, 1)} h`;
    if (d < 730) return `${fmt(d, d < 10 ? 1 : 0)} days`;
    return `${fmt(d / 365.25, 1)} years`;
  }

  /* ---------- results chips ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function drawChips(r) {
    let h =
      chip('Ultimate Sc', `${fmt(r.Sc * 1000, 1)} mm`,
           state.method === 'mv' ? 'mv · Δσ · H' : 'compression index method', 'ok') +
      chip('Settlement now', `${fmt(r.St * 1000, 1)} mm`, `U = ${fmt(r.U * 100, 1)} %`) +
      chip('Time factor T', fmt(r.T, 4), 'cv · t / H²dr') +
      chip('Drainage path', `${fmt(r.Hdr, 2)} m`, r.twoWay ? 'drained both faces' : 'drained one face') +
      chip('t₅₀', fmtTime(r.t50), `T₅₀ = ${fmt(r.Tv50, 3)}`) +
      chip('t₉₀', fmtTime(r.t90), `T₉₀ = ${fmt(r.Tv90, 3)}`) +
      chip('cv', `${cvOf().toExponential(1)}`, 'm²/s');
    if (r.overconsolidated)
      h += chip('State', 'Overconsolidated', `σp′ = ${fmt(state.sp, 0)} kPa`, 'warn');
    if (r.Ss > 1e-9)
      h += chip('Creep so far', `${fmt(r.Ss * 1000, 1)} mm`, 'secondary, past t₉₀') +
           chip('Total now', `${fmt(r.Stotal * 1000, 1)} mm`, 'primary plus creep', 'warn');
    resultsEl.innerHTML = h;
  }

  let last = null;
  function renderAll() {
    const r = solveNow();
    last = r;
    drawProfile(r);
    drawCurve(r);
    drawChips(r);
    const n = document.getElementById('tNote');
    if (n) n.textContent = `t = ${fmtTime(tOf())}   ·   U = ${fmt(r.U * 100, 1)} %`;
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
      <h3>Layer</h3>
      ${row('H', 'Clay thickness H (m)', 1, 15, 0.5, state.H)}
      <div class="ctl"><select id="drainage">
        <option value="two"${state.drainage === 'two' ? ' selected' : ''}>Drained top and bottom</option>
        <option value="one"${state.drainage === 'one' ? ' selected' : ''}>Drained at the top only</option>
      </select></div>
      ${row('cvExp', 'log₁₀ cv (cv in m²/s)', -8, -5, 0.1, state.cvExp)}
      <h3>Load</h3>
      ${row('ds', 'Stress increase Δσ (kPa)', 0, 400, 5, state.ds)}
      <h3>Compressibility</h3>
      <div class="ctl"><select id="method">
        <option value="cc"${state.method === 'cc' ? ' selected' : ''}>Compression index Cc</option>
        <option value="mv"${state.method === 'mv' ? ' selected' : ''}>Coefficient mv</option>
      </select></div>
      ${state.method === 'mv' ? row('mv', 'mv (m²/kN)', 0.00002, 0.001, 0.00002, state.mv)
        : row('Cc', 'Compression index Cc', 0.05, 0.8, 0.01, state.Cc) +
          row('Cs', 'Swelling index Cs', 0.01, 0.2, 0.01, state.Cs) +
          row('e0', 'Initial void ratio e₀', 0.4, 2, 0.05, state.e0) +
          row('s0', 'Initial stress σ₀′ (kPa)', 10, 400, 5, state.s0) +
          row('sp', 'Preconsolidation σp′ (kPa)', 10, 600, 5, state.sp)}
      ${row('Ca', 'Secondary Cα', 0, 0.05, 0.005, state.Ca)}
      <h3>Time</h3>
      ${row('tExp', 'log₁₀ t (t in days)', -2, 5, 0.02, state.tExp)}
      <div id="tNote" style="font-size:12.5px;font-weight:600;color:#14416B;margin:2px 0 6px"></div>
      <div class="addrow">
        <button class="btn small" id="play">${state.playing ? 'Stop' : 'Play'}</button>
        <button class="btn ghost small" id="t50">Go to t₅₀</button>
        <button class="btn ghost small" id="t90">Go to t₉₀</button>
      </div>
      <label class="chk"><input type="checkbox" id="ghosts"${state.ghosts ? ' checked' : ''}>
        <span>Show isochrones at 10 to 90 percent</span></label>`;
  }

  const LIM = { H:[1,15], cvExp:[-8,-5], ds:[0,400], Cc:[0.05,0.8], Cs:[0.01,0.2],
                e0:[0.4,2], s0:[10,400], sp:[10,600], mv:[0.00002,0.001],
                Ca:[0,0.05], tExp:[-2,5] };
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
    for (const suf of ['r', 'n']) {
      const el = document.getElementById(k + suf);
      if (el && el !== e.target && document.activeElement !== el) el.value = state[k];
    }
    if (k !== 'tExp') setCustom();
    renderAll();
  });

  controls.addEventListener('change', e => {
    if (e.target.id === 'preset') {
      const p = PRESETS[e.target.value];
      if (!p) { state.preset = ''; return; }
      stop();
      Object.assign(state, p.f());
      state.preset = state.base = e.target.value;
      renderControls(); renderAll();
    } else if (e.target.id === 'drainage' || e.target.id === 'method') {
      state[e.target.id] = e.target.value;
      setCustom(); renderControls();
      const m = document.getElementById(e.target.id); if (m) m.value = state[e.target.id];
      renderAll();
    } else if (e.target.id === 'ghosts') {
      state.ghosts = e.target.checked;
      renderAll();
    }
  });

  /* ---------- animation, always user initiated ---------- */
  let raf = 0;
  function stop() {
    state.playing = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const b = document.getElementById('play'); if (b) b.textContent = 'Play';
  }
  function step() {
    if (!state.playing) return;
    state.tExp += 0.035;
    if (state.tExp > 5) state.tExp = -2;
    syncKey('tExp');
    renderAll();
    raf = requestAnimationFrame(step);
  }

  controls.addEventListener('click', e => {
    if (e.target.id === 'play') {
      if (state.playing) { stop(); return; }
      state.playing = true;
      e.target.textContent = 'Stop';
      raf = requestAnimationFrame(step);
    } else if (e.target.id === 't50' || e.target.id === 't90') {
      stop();
      const r = solveNow();
      const tt = e.target.id === 't50' ? r.t50 : r.t90;
      if (isFinite(tt) && tt > 0) {
        state.tExp = clamp(L10(tt / DAY), -2, 5);
        syncKey('tExp');
        renderAll();
      }
    }
  });

  /* ---------- drag the time marker ---------- */
  let dragging = false;
  const hit = el => { while (el && el !== curve) { if (el.getAttribute && el.getAttribute('data-drag')) return true; el = el.parentNode; } return false; };
  curve.addEventListener('pointerdown', e => {
    if (!hit(e.target)) return;
    stop();
    dragging = true;
    try { curve.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  curve.addEventListener('pointermove', e => {
    if (!dragging) return;
    const b = curve.getBoundingClientRect();
    if (!b.width) return;
    const px = (e.clientX - b.left) * (560 / b.width);
    const r = last;
    const pts = r.curve(8);
    const tLo = L10(Math.max(1e-6, pts[0].t / DAY)), tHi = L10(pts[pts.length - 1].t / DAY);
    const lo = Math.floor(Math.min(tLo, state.tExp)) - 0.2;
    const hi = Math.ceil(Math.max(tHi, state.tExp)) + 0.2;
    const v = lo + (px - CL) / (CR - CL) * (hi - lo);
    if (!isFinite(v)) return;
    state.tExp = clamp(snap(v, 0.02), -2, 5);
    syncKey('tExp');
    renderAll();
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    try { curve.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  curve.addEventListener('pointerup', endDrag);
  curve.addEventListener('pointercancel', endDrag);

  /* ---------- boot ---------- */
  renderControls();
  renderAll();
})();
