/* CivilLab · Tr3 Pavement Design */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };
  const FILL = ['#3B4148', '#C9B79C', '#D9CDB8', '#B9A07E'];

  const base = { E1:3000, E2:400, cbrBase:80, E3:150, cbrSub:30, P:40, p:550 };
  const PRESETS = {
    main:  { label:'Main road, 2 msa', f:()=>Object.assign({}, base, { h1:100, h2:200, h3:300, CBR:5, N:2 }) },
    local: { label:'Local road, light traffic', f:()=>Object.assign({}, base, { h1:50, h2:250, h3:200, CBR:8, N:0.5 }) },
    weak:  { label:'Same road on soft clay', f:()=>Object.assign({}, base, { h1:100, h2:200, h3:300, CBR:2, N:2 }) },
    heavy: { label:'Trunk road, 30 msa', f:()=>Object.assign({}, base, { h1:180, E1:4000, h2:250, h3:350, CBR:5, N:30 }) },
    stiff: { label:'Stiffer asphalt, same thickness', f:()=>Object.assign({}, base, { h1:100, E1:6000, h2:200, h3:300, CBR:5, N:5 }) }
  };
  const state = Object.assign({ preset:'main' }, PRESETS.main.f());

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

  function drawSection(r) {
    add(txt(390, 26, 'Pavement under one wheel, and the vertical stress below it', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const top = 90, bottom = 520, dmax = Math.max(r.total + 300, r.needSub + 150);
    const Y = d => top + d / dmax * (bottom - top);
    const X0 = 410, X1 = 600;
    let d = 0;
    r.layers.forEach((L, i) => {
      if (L.h <= 0) return;
      add(s('rect', { x:X0, y:Y(d), width:X1 - X0, height:Y(d + L.h) - Y(d), fill:FILL[i], 'fill-opacity': i === 0 ? .85 : .7, stroke:'#fff' }));
      add(txt((X0 + X1) / 2, (Y(d) + Y(d + L.h)) / 2 + 4, `${L.name} ${L.h} mm, E ${L.E}`, { fs:10, fill: i === 0 ? '#fff' : C.ocean, halo: i === 0 ? 0 : 3, fw:600 }));
      d += L.h;
    });
    add(s('rect', { x:X0, y:Y(d), width:X1 - X0, height:bottom - Y(d), fill:FILL[3], 'fill-opacity':.45 }));
    add(txt((X0 + X1) / 2, Y(d) + 22, `Subgrade CBR ${state.CBR}%, Es ${fmt(r.Es, 0)} MPa`, { fs:10, fw:600, fill:C.ocean }));
    /* the wheel and its print */
    const cx = (X0 + X1) / 2, aw = clamp(r.a / dmax * (bottom - top), 6, 70);
    add(s('rect', { x:cx - aw, y:top - 46, width:2 * aw, height:30, rx:8, fill:'#2F3438' }));
    for (let i = -2; i <= 2; i++) add(line(cx + i * aw / 2.2, top - 14, cx + i * aw / 2.2, top - 2, { stroke:C.load, 'stroke-width':1.6, 'marker-end':'url(#aLoad)' }));
    add(txt(cx, top - 54, `${state.P} kN at ${state.p} kPa, a = ${fmt(r.a, 0)} mm`, { fs:10.5, fill:C.load }));
    /* stress against depth */
    const PX0 = 640, PX1 = 920, PX = v => PX0 + v * (PX1 - PX0);
    add(line(PX0, top, PX1, top, { stroke:C.axis }));
    add(line(PX0, top, PX0, bottom, { stroke:C.axis }));
    [0, 0.25, 0.5, 0.75, 1].forEach(v => add(txt(PX(v), top - 6, fmt(v, 2), { fs:9.5 })));
    add(txt(PX1, top - 22, 'σz / p', { an:'end', fs:10.5 }));
    for (let dd = 0; dd <= dmax; dd += 200) add(txt(PX0 - 6, Y(dd) + 4, String(dd), { an:'end', fs:9.5 }));
    add(txt(PX0 - 34, (top + bottom) / 2, 'depth mm', { fs:10.5, rot:-90 }));
    let dd = 0;
    r.layers.forEach(L => { dd += L.h; add(line(PX0, Y(dd), PX1, Y(dd), { stroke:C.contour, 'stroke-dasharray':'4 3' })); });
    const pts = r.profile.filter(q => q.d <= dmax);
    add(s('path', { d: pts.map((q, i) => `${i ? 'L' : 'M'}${PX(q.ratio)},${Y(q.d)}`).join('') + `L${PX0},${Y(pts[pts.length - 1].d)} L${PX0},${top} Z`,
      fill:C.water, 'fill-opacity':.13, stroke:C.water, 'stroke-width':2.2 }));
    add(s('circle', { cx:PX(r.sigSub / state.p), cy:Y(r.total), r:5, fill:C.water }));
    add(txt(PX(r.sigSub / state.p) + 8, Y(r.total) + 4, `${fmt(r.sigSub, 1)} kPa on the subgrade`, { an:'start', fs:10.5, fw:600, fill:C.water }));
    /* CBR thickness needed over the subgrade */
    const okT = r.total >= r.needSub;
    add(line(X0 - 30, Y(r.needSub), PX1, Y(r.needSub), { stroke: okT ? C.green : C.load, 'stroke-width':1.6, 'stroke-dasharray':'7 4' }));
    add(txt(X0 - 34, Y(r.needSub) + 4, `CBR needs ${fmt(r.needSub, 0)}`, { an:'end', fs:10.5, fw:600, fill: okT ? C.green : C.load }));
    add(txt(X0 - 34, Y(r.total) + 4, `provided ${r.total}`, { an:'end', fs:10.5, fill:C.ocean }));
    add(txt(390, 548, `Odemark depth ${fmt(r.he, 0)} mm, vertical strain on the subgrade ${fmt(r.eps * 1e6, 0)} µε, rutting life ${fmt(r.Nd / 1e6, 2)} msa`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  function drawLeft(r) {
    const X = 26, W = 330;
    const f = 0.23 * Math.log10(Math.max(r.C, 10)) + 0.15;
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'CBR cover over the subgrade', clause:'Corps of Engineers' }, [
      { sym:'0.23 log C + 0.15', val:fmt(f, 3) }, { sym:'√(P/8.1CBR − A/π)', val:fmt(r.needSub / f / 25.4, 2) + ' in' },
      { op:'=', sym:'t mm', val:fmt(r.needSub, 0) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Subgrade strain to rutting life', clause:'Asphalt Institute' }, [
      { sym:'εz µε', val:fmt(r.eps * 1e6, 0) }, { op:'→', sym:'Nd = 1.365e-9 εz^−4.477, msa', val:fmt(r.Nd / 1e6, 2) }]);
    const items = [
      { name:'Total cover over the subgrade', util:r.u.total, note:'CBR thickness needed / provided', clause:'CBR' },
      { name:'Cover over the subbase', util:r.u.overSub, note:'asphalt and base over the subbase CBR', clause:'CBR' },
      { name:'Subgrade rutting, N / Nd', util:r.u.rut, note:`design traffic ${fmt(state.N, 1)} msa`, clause:'Asphalt Institute' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:48, title:'Checks' }, items);
    return items;
  }

  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aLoad', C.load, 5)));
    const r = PavementEngine.solve(state);
    const items = drawLeft(r);
    add(line(375, 16, 375, 544, { stroke:C.hair }));
    drawSection(r);
    const v = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('Thickness needed', `${fmt(r.needSub, 0)} mm`, `provided ${r.total} mm`, r.u.total <= 1 ? 'ok' : 'warn') +
      chip('Contact radius', `${fmt(r.a, 0)} mm`, `${state.P} kN at ${state.p} kPa`) +
      chip('Subgrade modulus', `${fmt(r.Es, 0)} MPa`, `10 × CBR ${state.CBR}`) +
      chip('Odemark depth', `${fmt(r.he, 0)} mm`, 'equivalent subgrade') +
      chip('Subgrade strain', `${fmt(r.eps * 1e6, 0)} µε`, `stress ${fmt(r.sigSub, 1)} kPa`) +
      chip('Rutting life', `${fmt(r.Nd / 1e6, 2)} msa`, `design ${fmt(state.N, 1)} msa`, r.u.rut <= 1 ? 'ok' : 'warn');
    DesignKit.trail(trailEl, 'Show the working', [
      { t:`a = √(P/πp) = √(${state.P * 1000} / (π × ${state.p / 1000})) = ${fmt(r.a, 1)} mm`, c:'' },
      { t:`t = (0.23 log ${fmt(r.C, 0)} + 0.15) √(P/(8.1 CBR) − A/π) = ${fmt(r.needSub, 0)} mm over CBR ${state.CBR}, ${fmt(r.needOverSub, 0)} mm over CBR ${state.cbrSub}`, c:'Corps of Engineers CBR equation' },
      { t:`Es = 10 CBR = ${fmt(r.Es, 0)} MPa, he = 0.9 Σ h (E/Es)^⅓ = ${fmt(r.he, 1)} mm`, c:'Heukelom and Klomp, Odemark' },
      { t:`εz = (1 + ν) p/E [1 − 2ν + 2ν z/R − (z/R)³] = ${fmt(r.eps * 1e6, 1)} µε with ν = 0.4`, c:'Boussinesq on the axis' },
      { t:`Nd = 1.365×10⁻⁹ εz^−4.477 = ${fmt(r.Nd / 1e6, 3)} msa against ${fmt(state.N, 2)} msa`, c:'Asphalt Institute rutting' }]);
  }

  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  const select = (id, label, opts, cur) => `<div class="ctl"><label for="${id}">${label}</label><select id="${id}">` +
    opts.map(o => `<option value="${o[0]}"${String(cur) === String(o[0]) ? ' selected' : ''}>${o[1]}</option>`).join('') + '</select></div>';
  function renderControls() {
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      '<h3 style="margin-top:16px">Asphalt surfacing</h3>' + slider('h1', 'Thickness (mm)', 25, 300, 5) + slider('E1', 'Modulus (MPa)', 1000, 8000, 100) +
      '<h3>Granular base</h3>' + slider('h2', 'Thickness (mm)', 0, 400, 5) + slider('E2', 'Modulus (MPa)', 100, 1000, 10) +
      '<h3>Subbase</h3>' + slider('h3', 'Thickness (mm)', 0, 600, 5) + slider('E3', 'Modulus (MPa)', 50, 400, 5) +
      slider('cbrSub', 'Subbase CBR (%)', 10, 60, 1) +
      '<h3>Subgrade and traffic</h3>' + slider('CBR', 'Subgrade CBR (%)', 1, 30, 0.5) +
      slider('P', 'Wheel load (kN)', 20, 80, 1) + slider('p', 'Tyre pressure (kPa)', 400, 1000, 10) +
      slider('N', 'Design traffic (msa)', 0.1, 80, 0.1);
  }
  function markCustom() {
    if (state.preset === 'custom') return;
    state.preset = 'custom';
    const sel = document.getElementById('preset');
    if (sel) sel.value = 'custom';
  }
  controls.addEventListener('input', e => {
    const t = e.target, k = t.dataset.k;
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

  renderControls();
  render();
})();
