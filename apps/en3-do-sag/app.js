/* CivilLab · En3 DO Sag Curve */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { Qw:0.2, Lw:200, DOw:1, Tw:25, Qr:2.0, Lr:3, DOr:7.8, Tr:26, bod5:true, kd20:0.23, kr20:0.4, od:true, u:0.3, H:2.5, std:4 };
  const PRESETS = {
    town:    { label:'Untreated town sewage', f:()=>Object.assign({}, base) },
    treated: { label:'After secondary treatment', f:()=>Object.assign({}, base, { Lw:20 }) },
    dry:     { label:'Treated, dry season low flow', f:()=>Object.assign({}, base, { Lw:20, Qr:0.5, Tr:29 }) },
    fast:    { label:'Fast shallow river', f:()=>Object.assign({}, base, { u:0.8, H:1.0 }) }
  };
  const state = Object.assign({ preset:'town' }, PRESETS.town.f());

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
  const add = el => (fig.appendChild(el), el);

  function drawCurve(r) {
    const P = { x0:440, x1:920, y0:50, y1:450 };
    add(txt(400, 28, 'Dissolved oxygen along the river', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const xmax = r.curve[r.curve.length - 1].x, ymax = Math.max(r.sat * 1.1, 10);
    const X = x => P.x0 + x / xmax * (P.x1 - P.x0), Y = v => P.y1 - clamp(v, 0, ymax) / ymax * (P.y1 - P.y0);
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    for (let i = 0; i <= 5; i++) add(txt(X(xmax * i / 5), P.y1 + 15, fmt(xmax * i / 5, 0), { fs:9.5 }));
    for (let v = 0; v <= ymax; v += 2) add(txt(P.x0 - 6, Y(v) + 4, String(v), { an:'end', fs:9.5 }));
    add(txt(P.x1, P.y1 + 32, 'distance downstream km', { an:'end', fs:10.5 }));
    add(txt(P.x0 - 30, (P.y0 + P.y1) / 2, 'mg/L', { fs:10.5, rot:-90 }));
    add(line(P.x0, Y(r.sat), P.x1, Y(r.sat), { stroke:C.water, 'stroke-dasharray':'6 4' }));
    add(txt(P.x1, Y(r.sat) - 5, `saturation ${fmt(r.sat, 2)}`, { an:'end', fs:10, fill:C.water }));
    add(line(P.x0, Y(state.std), P.x1, Y(state.std), { stroke:C.load, 'stroke-dasharray':'5 3' }));
    add(txt(P.x1, Y(state.std) - 5, `standard ${state.std}`, { an:'end', fs:10, fill:C.load }));
    add(s('path', { d:r.curve.map((q, i) => `${i ? 'L' : 'M'}${X(q.x)},${Y(q.L)}`).join(''), fill:'none', stroke:C.contour, 'stroke-width':1.6, 'stroke-dasharray':'3 3' }));
    add(txt(X(xmax * 0.06), Y(r.curve[3].L) - 6, 'BOD remaining', { an:'start', fs:10 }));
    add(s('path', { d:r.curve.map((q, i) => `${i ? 'L' : 'M'}${X(q.x)},${Y(q.DO)}`).join(''), fill:'none', stroke:C.ocean, 'stroke-width':2.4 }));
    const ok = r.DOmin >= state.std;
    add(s('circle', { cx:X(r.xc), cy:Y(r.DOmin), r:6, fill: ok ? C.green : C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(X(r.xc) + 9, Y(r.DOmin) + 16, `critical ${fmt(r.DOmin, 2)} mg/L at ${fmt(r.xc, 1)} km`, { an:'start', fs:11, fw:600, fill: ok ? C.green : C.load }));
  }

  function drawLeft(r) {
    const X = 26, W = 330;
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Ultimate BOD after mixing', clause:'mass balance' }, [
      { sym:'Qw Lw + Qr Lr', val:fmt(state.Qw * r.m.Lw + state.Qr * r.m.Lr, 1) }, { op:'÷', sym:'Qw + Qr', val:fmt(r.m.Q, 2) },
      { op:'=', sym:'L0 mg/L', val:fmt(r.m.L0, 1) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Critical deficit', clause:'Streeter-Phelps' }, [
      { sym:'kd/kr', val:fmt(r.kd / r.kr, 3) }, { sym:'L0', val:fmt(r.m.L0, 1) }, { sym:'e^(−kd tc)', val:fmt(Math.exp(-r.kd * r.tc), 3) },
      { op:'=', sym:'Dc mg/L', val:fmt(r.Dc, 2) }]);
    const items = [
      { name:'Minimum DO against the standard', util:r.u.DO, note:'standard / DOmin', clause:'river standard' },
      { name:'Waste BOD against the allowed load', util:r.u.load, clause:'Streeter-Phelps' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:50, title:'Checks' }, items);
    return items;
  }

  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    const r = DOSagEngine.solve(state);
    const items = drawLeft(r);
    add(line(375, 16, 375, 504, { stroke:C.hair }));
    drawCurve(r);
    const v = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('Minimum DO', `${fmt(r.DOmin, 2)} mg/L`, `standard ${state.std}`, r.DOmin >= state.std ? 'ok' : 'warn') +
      chip('Critical distance', `${fmt(r.xc, 1)} km`, `tc = ${fmt(r.tc, 2)} days`) +
      chip('Mixed BOD L0', `${fmt(r.m.L0, 1)} mg/L`, 'ultimate') +
      chip('Initial deficit', `${fmt(r.D0, 2)} mg/L`, `saturation ${fmt(r.sat, 2)} at ${fmt(r.m.T, 1)} °C`) +
      chip('Rates kd, kr', `${fmt(r.kd, 3)}, ${fmt(r.kr, 3)}`, `per day, f = ${fmt(r.f, 2)}`) +
      chip('Allowed waste BOD', `${fmt(r.allow, 0)} mg/L`, state.bod5 ? 'as BOD5' : 'ultimate', r.u.load <= 1 ? 'ok' : 'warn');
    DesignKit.trail(trailEl, 'Show the working', [
      { t:`L0 = (${state.Qw} × ${fmt(r.m.Lw, 1)} + ${state.Qr} × ${fmt(r.m.Lr, 2)}) / ${fmt(r.m.Q, 2)} = ${fmt(r.m.L0, 2)} mg/L, DO = ${fmt(r.m.DO0, 2)}, T = ${fmt(r.m.T, 1)} °C`, c:'mixing' },
      { t:`DOsat = ${fmt(r.sat, 2)}, D0 = ${fmt(r.D0, 2)} mg/L`, c:'APHA' },
      { t:`kd = ${state.kd20} × 1.047^(T − 20) = ${fmt(r.kd, 4)}, kr20 = ${fmt(r.kr20, 3)}${state.od ? " from O'Connor-Dobbins" : ''}, kr = ${fmt(r.kr, 4)} per day`, c:'' },
      { t:`tc = ln[(kr/kd)(1 − D0(kr − kd)/(kd L0))]/(kr − kd) = ${fmt(r.tc, 3)} d, Dc = ${fmt(r.Dc, 3)} mg/L`, c:'Streeter-Phelps' }]);
  }

  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  function renderControls() {
    controls.innerHTML =
      `<div class="ctl"><label for="preset">Preset</label><select id="preset">` +
      Object.keys(PRESETS).map(k => `<option value="${k}"${state.preset === k ? ' selected' : ''}>${PRESETS[k].label}</option>`).join('') +
      `<option value="custom"${state.preset === 'custom' ? ' selected' : ''}>Custom</option></select></div>` +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="bod5"${state.bod5 ? ' checked' : ''}> BOD values are BOD5</label>` +
      '<h3>Waste discharge</h3>' + slider('Qw', 'Flow (m³/s)', 0.01, 2, 0.01) + slider('Lw', 'BOD (mg/L)', 0, 400, 1) +
      slider('DOw', 'DO (mg/L)', 0, 8, 0.1) + slider('Tw', 'Temperature (°C)', 5, 40, 0.5) +
      '<h3>River upstream</h3>' + slider('Qr', 'Flow (m³/s)', 0.1, 20, 0.1) + slider('Lr', 'BOD (mg/L)', 0, 10, 0.1) +
      slider('DOr', 'DO (mg/L)', 0, 12, 0.1) + slider('Tr', 'Temperature (°C)', 5, 35, 0.5) +
      '<h3>Rates and channel</h3>' + slider('kd20', 'kd at 20 °C (per day)', 0.05, 0.6, 0.01) +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="od"${state.od ? ' checked' : ''}> kr from O'Connor-Dobbins</label>` +
      (state.od ? '' : slider('kr20', 'kr at 20 °C (per day)', 0.05, 2, 0.01)) +
      slider('u', 'Velocity (m/s)', 0.05, 1.5, 0.05) + slider('H', 'Depth (m)', 0.3, 8, 0.1) +
      slider('std', 'DO standard (mg/L)', 2, 7, 0.5);
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
      render(); return;
    }
    if (t.id === 'bod5' || t.id === 'od') { state[t.id] = t.checked; markCustom(); renderControls(); render(); }
  });

  renderControls();
  render();
})();
