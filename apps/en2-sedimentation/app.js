/* CivilLab · En2 Sedimentation and Settling */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };
  const SHADE = ['#C6DCEF', '#9FC4E6', '#6FA6D4', '#2E6FA3', '#1E78B0', '#14416B', '#0B2A47'];

  const PRESETS = {
    clar:  { label:'Primary clarifier, silt', f:()=>({ d:0.02, rhos:2650, T:25, Q:10000, L:30, W:10, H:3 }) },
    grit:  { label:'Grit chamber, sand', f:()=>({ d:0.2, rhos:2650, T:25, Q:20000, L:15, W:2, H:1.2 }) },
    floc:  { label:'Alum floc, light and large', f:()=>({ d:0.5, rhos:1020, T:25, Q:10000, L:30, W:10, H:3 }) },
    cold:  { label:'Same silt in cold water', f:()=>({ d:0.02, rhos:2650, T:5, Q:10000, L:30, W:10, H:3 }) },
    clay:  { label:'Clay without coagulant', f:()=>({ d:0.002, rhos:2650, T:25, Q:10000, L:30, W:10, H:3 }) }
  };
  const state = Object.assign({ preset:'clar' }, PRESETS.clar.f());
  let anim = null, t0 = 0, simT = 0.37;

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
  const add = el => (fig.appendChild(el), el);

  /* a fixed swarm: each particle has a size class, an entry height and a start offset */
  const SWARM = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 84; i++) SWARM.push({ cls: i % 7, y0: rnd() * 0.96, off: rnd() });

  function drawTank(r) {
    const X0 = 420, X1 = 920, Y0 = 70, Y1 = 270;
    const kx = (X1 - X0) / state.L, ky = (Y1 - Y0) / state.H;
    add(txt(400, 30, `Tank in section, vertical scale × ${fmt(ky / kx, 1)}`, { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(s('rect', { x:X0, y:Y0, width:X1 - X0, height:Y1 - Y0, fill:'#EEF4F9', stroke:C.ocean, 'stroke-width':1.6 }));
    add(s('rect', { x:X0, y:Y1 - 8, width:X1 - X0, height:8, fill:'#B9A07E', 'fill-opacity':.6 }));
    add(line(X0 - 46, Y0 + 30, X0 - 4, Y0 + 30, { stroke:C.water, 'stroke-width':3, 'marker-end':'url(#aW)' }));
    add(txt(X0 - 26, Y0 + 20, 'in', { fs:10.5, fill:C.water }));
    add(line(X1 + 4, Y0 + 8, X1 + 40, Y0 + 8, { stroke:C.water, 'stroke-width':3, 'marker-end':'url(#aW)' }));
    add(txt(X1 + 22, Y0 - 2, 'out', { fs:10.5, fill:C.water }));
    add(txt((X0 + X1) / 2, Y1 + 18, `L ${state.L} m, H ${state.H} m, sludge collects on the floor`, { fs:10.5 }));
    /* the trajectory of the chosen particle from the surface */
    const vs = r.main.v, vh = r.tk.vh;
    const xEnd = Math.min(state.L, vh * state.H / Math.max(vs, 1e-12));
    const yEnd = xEnd >= state.L ? vs * state.L / vh : state.H;
    add(line(X0, Y0, X0 + xEnd * kx, Y0 + yEnd * ky, { stroke: r.captured ? C.green : C.load, 'stroke-width':2, 'stroke-dasharray':'7 4' }));
    add(txt(X0 + xEnd * kx + (r.captured ? 0 : -6), Y0 + yEnd * ky + (r.captured ? -8 : 14),
      r.captured ? 'caught' : 'carried over', { an: r.captured ? 'middle' : 'end', fs:11, fw:600, fill: r.captured ? C.green : C.load }));
    /* the swarm, each class at its own settling velocity */
    const tDet = state.L / vh;                       // seconds to cross
    let caught = 0, lost = 0;
    SWARM.forEach(p => {
      const v = r.classes[p.cls].v;
      const age = ((simT + p.off) % 1) * tDet * 1.25;
      const x = vh * age, y = p.y0 * state.H + v * age;
      let px, py, op = 0.9;
      if (y >= state.H && x <= state.L) {
        const xs = vh * (state.H - p.y0 * state.H) / Math.max(v, 1e-12);
        px = X0 + xs * kx; py = Y1 - 4; caught++;
      } else if (x > state.L) { px = X1 + Math.min((x - state.L) * kx, 30); py = Y0 + Math.min(y, state.H) * ky; op = 0.35; lost++; }
      else { px = X0 + x * kx; py = Y0 + y * ky; }
      add(s('circle', { cx:px, cy:py, r: 1.8 + p.cls * 0.45, fill:SHADE[p.cls], 'fill-opacity':op }));
    });
    return { caught, lost };
  }

  function drawVelocity(r) {
    const P = { x0:440, x1:640, y0:330, y1:520 };
    add(txt(400, 312, 'Settling velocity against diameter', { an:'start', fs:12.5, fw:600, fill:C.ocean, halo:0 }));
    const dl = [-3, 0.5], vl = [-8, 0];
    const X = d => P.x0 + (Math.log10(d) - dl[0]) / (dl[1] - dl[0]) * (P.x1 - P.x0);
    const Y = v => P.y1 - (Math.log10(Math.max(v, 1e-9)) - vl[0]) / (vl[1] - vl[0]) * (P.y1 - P.y0);
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    [0.001, 0.01, 0.1, 1].forEach(d => add(txt(X(d), P.y1 + 14, String(d), { fs:9 })));
    [-8, -6, -4, -2, 0].forEach(e => add(txt(P.x0 - 4, Y(10 ** e) + 3, `1e${e}`, { an:'end', fs:9 })));
    add(txt(P.x1, P.y1 + 28, 'd mm', { an:'end', fs:10 }));
    add(txt(P.x0 - 36, (P.y0 + P.y1) / 2, 'vs m/s', { fs:10, rot:-90 }));
    let d1 = '', d2 = '';
    for (let i = 0; i <= 60; i++) {
      const d = Math.pow(10, dl[0] + (dl[1] - dl[0]) * i / 60), sv = SettlingEngine.settle(d, state.rhos, state.T);
      d1 += `${i ? 'L' : 'M'}${X(d)},${Y(sv.vStokes)}`;
      d2 += `${i ? 'L' : 'M'}${X(d)},${Y(sv.v)}`;
    }
    add(s('path', { d:d1, fill:'none', stroke:C.contour, 'stroke-dasharray':'4 3' }));
    add(s('path', { d:d2, fill:'none', stroke:C.ocean, 'stroke-width':2 }));
    add(line(P.x0, Y(r.tk.vo), P.x1, Y(r.tk.vo), { stroke:C.load, 'stroke-width':1.4, 'stroke-dasharray':'6 3' }));
    add(txt(P.x1, Y(r.tk.vo) - 5, `vo ${fmt(r.tk.vomd, 1)} m/d`, { an:'end', fs:10, fill:C.load }));
    add(s('circle', { cx:X(state.d), cy:Y(r.main.v), r:5.5, fill: r.captured ? C.green : C.load, stroke:'#fff', 'stroke-width':2 }));
  }

  function drawRemoval(r) {
    const X0 = 690, X1 = 930, Y0 = 340, Y1 = 520;
    add(txt(680, 312, 'Fraction removed by size', { an:'start', fs:12.5, fw:600, fill:C.ocean, halo:0 }));
    const bw = (X1 - X0) / r.classes.length;
    r.classes.forEach((c, i) => {
      const h = c.frac * (Y1 - Y0);
      add(s('rect', { x:X0 + i * bw + 4, y:Y1 - h, width:bw - 8, height:Math.max(h, 0.8), fill:SHADE[i] }));
      add(txt(X0 + i * bw + bw / 2, Y1 - h - 4, `${fmt(c.frac * 100, 0)}%`, { fs:9 }));
      add(txt(X0 + i * bw + bw / 2, Y1 + 14, c.d >= 0.01 ? `${fmt(c.d * 1000, 0)}` : `${fmt(c.d * 1000, 0)}`, { fs:9 }));
    });
    add(txt(X1, Y1 + 28, 'd µm', { an:'end', fs:10 }));
    add(line(X0, Y0, X1, Y0, { stroke:C.hair }));
    add(txt(X0, Y0 - 4, '100%', { an:'start', fs:9 }));
  }

  function drawLeft(r) {
    const X = 26, W = 330;
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:"Stokes' law", clause:'Re < 1' }, [
      { sym:'g Δρ / 18μ', val:fmt(9.81 * (state.rhos - r.main.rw) / (18 * r.main.mu), 0) }, { sym:'d² m²', val:((state.d / 1000) ** 2).toExponential(2) },
      { op:'=', sym:'vs m/s', val:r.main.vStokes < 1e-3 ? r.main.vStokes.toExponential(2) : fmt(r.main.vStokes, 4) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Overflow rate', clause:'Camp and Hazen' }, [
      { sym:'Q m³/d', val:fmt(state.Q, 0) }, { op:'÷', sym:'L W m²', val:fmt(r.tk.area, 0) }, { op:'=', sym:'vo m/d', val:fmt(r.tk.vomd, 2) }]);
    const items = [
      { name:'Particle caught, vo / vs', util:r.u.capture, note:'below 100% it settles before the outlet', clause:'vs ≥ vo' },
      { name:'No scour, vh / vc', util:r.u.scour, clause:'Camp' },
      { name:"Stokes' law valid, Re", util:r.u.stokes, note: r.main.regime === 'transitional' ? 'transitional drag used instead' : 'laminar settling', clause:'Re < 1' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:50, title:'Checks' }, items);
  }

  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  const vfmt = v => v < 1e-3 ? v.toExponential(2) : fmt(v, 4);

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aW', C.water, 5)));
    const r = SettlingEngine.solve(state);
    drawLeft(r);
    add(line(375, 16, 375, 544, { stroke:C.hair }));
    const counts = drawTank(r);
    drawVelocity(r);
    drawRemoval(r);
    resultsEl.innerHTML =
      chip('Verdict', r.captured ? 'Caught' : 'Carried over', `${fmt(r.R * 100, 0)}% of this size removed`, r.captured ? 'ok' : 'warn') +
      chip('Settling velocity', `${vfmt(r.main.v)} m/s`, `${fmt(r.main.vmd, 2)} m/d, ${r.main.regime}`) +
      chip('Reynolds number', r.main.Re < 0.01 ? r.main.Re.toExponential(1) : fmt(r.main.Re, 3), r.main.ReS < 1 ? 'Stokes holds' : 'transitional', r.main.ReS < 1 ? 'ok' : 'warn') +
      chip('Overflow rate', `${fmt(r.tk.vomd, 2)} m/d`, `${vfmt(r.tk.vo)} m/s`) +
      chip('Smallest caught', `${fmt(r.dcrit * 1000, 1)} µm`, 'vs = vo under Stokes') +
      chip('Detention', `${fmt(r.tk.t, 2)} h`, `vh ${vfmt(r.tk.vh)} m/s`) +
      chip('Viscosity', `${(r.main.mu * 1000).toFixed(3)} mPa s`, `${state.T} °C`) +
      chip('Mixed suspension', `${fmt(r.overall * 100, 0)}%`, 'equal mass in each of the seven sizes');
    DesignKit.trail(trailEl, 'Show the working', [
      { t:`Water at ${state.T} °C: ρw = ${fmt(r.main.rw, 1)} kg/m³, μ = ${(r.main.mu * 1000).toFixed(4)} × 10⁻³ Pa s`, c:'Tanaka, Vogel' },
      { t:`vs = g(ρs − ρw)d²/18μ = 9.81 × ${fmt(state.rhos - r.main.rw, 1)} × (${state.d / 1000})² / (18 × ${r.main.mu.toExponential(3)}) = ${vfmt(r.main.vStokes)} m/s`, c:'Stokes' },
      { t:`Re = ρw vs d/μ = ${r.main.ReS < 0.01 ? r.main.ReS.toExponential(2) : fmt(r.main.ReS, 3)}${r.main.ReS > 1 ? `, so the transitional drag gives vs = ${vfmt(r.main.v)} m/s with Cd = ${fmt(r.main.Cd, 3)}` : ''}`, c: r.main.ReS > 1 ? 'Cd = 24/Re + 3/√Re + 0.34' : 'Re < 1' },
      { t:`vo = Q/(L W) = ${state.Q} / ${fmt(r.tk.area, 0)} = ${fmt(r.tk.vomd, 2)} m/d, removal = min(1, vs/vo) = ${fmt(r.R * 100, 1)}%`, c:'ideal tank' },
      { t:`vh = Q/(W H) = ${vfmt(r.tk.vh)} m/s against the scour velocity ${vfmt(r.vc)} m/s`, c:'Camp' }]);
    return counts;
  }

  /* ---------- controls ---------- */
  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  function renderControls() {
    controls.innerHTML =
      `<div class="ctl"><label for="preset">Preset</label><select id="preset">` +
      Object.keys(PRESETS).map(k => `<option value="${k}"${state.preset === k ? ' selected' : ''}>${PRESETS[k].label}</option>`).join('') +
      `<option value="custom"${state.preset === 'custom' ? ' selected' : ''}>Custom</option></select></div>` +
      '<h3 style="margin-top:16px">Particle</h3>' +
      `<div class="ctl"><label for="ldr">Diameter, on a log scale (mm)</label><div class="row">` +
      `<input type="range" id="ldr" min="-3" max="0.3" step="0.01" value="${Math.log10(state.d)}">` +
      `<input type="number" id="dn" min="0.001" max="2" step="0.001" value="${state.d}"></div></div>` +
      slider('rhos', 'Density (kg/m³)', 1005, 2700, 5) +
      slider('T', 'Water temperature (°C)', 0, 35, 0.5) +
      '<h3>Tank</h3>' +
      slider('Q', 'Flow Q (m³/day)', 100, 50000, 100) + slider('L', 'Length L (m)', 2, 80, 0.5) +
      slider('W', 'Width W (m)', 1, 30, 0.5) + slider('H', 'Depth H (m)', 0.5, 6, 0.1) +
      `<div class="addrow"><button class="btn" id="anim">${anim ? 'Stop' : 'Animate'}</button></div>`;
  }
  function markCustom() {
    if (state.preset === 'custom') return;
    state.preset = 'custom';
    const sel = document.getElementById('preset');
    if (sel) sel.value = 'custom';
  }
  controls.addEventListener('input', e => {
    const t = e.target, k = t.dataset.k;
    if (t.id === 'ldr' || t.id === 'dn') {
      const v = parseFloat(t.value);
      if (isNaN(v)) return;
      state.d = t.id === 'ldr' ? +Math.pow(10, clamp(v, -3, 0.3)).toPrecision(3) : clamp(v, 0.001, 2);
      const other = document.getElementById(t.id === 'ldr' ? 'dn' : 'ldr');
      if (other && other !== document.activeElement) other.value = t.id === 'ldr' ? state.d : Math.log10(state.d);
      markCustom(); render(); return;
    }
    if (!k) return;
    const v = parseFloat(t.value);
    if (isNaN(v)) return;
    state[k] = clamp(v, parseFloat(t.min), parseFloat(t.max));
    const twin = document.getElementById(k + (t.type === 'range' ? 'n' : 'r'));
    if (twin && twin !== document.activeElement) twin.value = state[k];
    markCustom(); render();
  });
  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'preset') {
      if (PRESETS[t.value]) { Object.assign(state, PRESETS[t.value].f()); state.preset = t.value; renderControls(); }
      render();
    }
  });
  controls.addEventListener('click', e => {
    if (e.target.id !== 'anim') return;
    if (anim) { cancelAnimationFrame(anim); anim = null; e.target.textContent = 'Animate'; return; }
    e.target.textContent = 'Stop';
    t0 = performance.now() - simT * 9000;
    const step = now => { simT = (now - t0) / 9000; render(); anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  });

  renderControls();
  render();
})();
