/* CivilLab · Tr2 Highway Alignment and Curves */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { t:2.5, a:3.4, G:0, e:0.08, fAuto:true, f:0.12 };
  const PRESETS = {
    rural: { label:'Rural highway, 100 km/h', f:()=>Object.assign({}, base, { V:100, R:500, delta:40, M:12, g1:3, g2:-2, L:300 }) },
    tight: { label:'Curve too tight for the speed', f:()=>Object.assign({}, base, { V:100, R:300, delta:50, M:6, g1:2, g2:-2, L:250 }) },
    urban: { label:'Urban road, 50 km/h', f:()=>Object.assign({}, base, { V:50, R:90, delta:60, M:4, g1:4, g2:-3, L:80, e:0.04 }) },
    sag:   { label:'Sag curve at night', f:()=>Object.assign({}, base, { V:90, R:500, delta:30, M:10, g1:-4, g2:3, L:200 }) },
    hill:  { label:'Long downgrade, short crest', f:()=>Object.assign({}, base, { V:100, R:600, delta:30, M:12, G:-6, g1:4, g2:-5, L:250 }) }
  };
  const state = Object.assign({ preset:'rural' }, PRESETS.rural.f());

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
  const add = el => (fig.appendChild(el), el);

  /* ---------- plan ---------- */
  function drawPlan(r) {
    const R = state.R, Lc = r.Lc, S = r.sd.S;
    add(txt(390, 26, `Plan, R ${fmt(R, 0)} m, Δ ${fmt(state.delta, 0)}°, true to scale`, { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const ph = Lc / (2 * R);
    /* a point on the inside lane centre at chainage c from the middle of the curve */
    const P = c => {
      if (Math.abs(c) <= Lc / 2) return [R * Math.sin(c / R), R * Math.cos(c / R)];
      const sg = Math.sign(c), ex = [sg * R * Math.sin(ph), R * Math.cos(ph)], d = Math.abs(c) - Lc / 2;
      return [ex[0] + sg * d * Math.cos(ph), ex[1] - d * Math.sin(ph)];
    };
    const span = Math.max(S, Lc) * 1.25 + 40;
    const pts = []; for (let i = 0; i <= 120; i++) pts.push(P(-span / 2 + span * i / 120));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const ymin = Math.min(...ys, R - state.M - 20), ymax = Math.max(...ys) + 12;
    const k = Math.min(530 / (Math.max(...xs) - Math.min(...xs)), 210 / (ymax - ymin));
    const X = x => 655 + x * k, Y = y => 60 + (ymax - y) * k;
    const path = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`).join('');
    const offset = (arr, o) => arr.map((p, i) => {
      const q = arr[Math.min(i + 1, arr.length - 1)], pp = arr[Math.max(i - 1, 0)];
      const dx = q[0] - pp[0], dy = q[1] - pp[1], L = Math.hypot(dx, dy) || 1;
      return [p[0] - dy / L * o, p[1] + dx / L * o];
    });
    add(s('path', { d: path(offset(pts, 1.8)), fill:'none', stroke:C.ocean, 'stroke-width':1.4 }));
    add(s('path', { d: path(offset(pts, -5.4)), fill:'none', stroke:C.ocean, 'stroke-width':1.4 }));
    add(s('path', { d: path(offset(pts, -1.8)), fill:'none', stroke:C.contour, 'stroke-dasharray':'6 5' }));
    /* obstruction on the inside */
    const oy = R - state.M;
    add(s('rect', { x:X(-14), y:Y(oy), width:28 * k, height:Math.max(10, 10 * k), fill:'url(#hatch)', stroke:C.load }));
    add(txt(X(0), Y(oy) + Math.max(10, 10 * k) + 14, `obstruction ${fmt(state.M, 1)} m from the lane centre`, { fs:10.5, fill:C.load }));
    /* the stopping sight line */
    const a = P(-S / 2), b = P(S / 2);
    const clear = r.Savail >= S;
    add(line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), { stroke: clear ? C.green : C.load, 'stroke-width':2, 'stroke-dasharray':'7 4' }));
    add(s('circle', { cx:X(a[0]), cy:Y(a[1]), r:5, fill:C.water }));
    add(s('circle', { cx:X(b[0]), cy:Y(b[1]), r:4, fill:C.load }));
    add(txt(X(a[0]) - 6, Y(a[1]) - 8, 'driver', { an:'end', fs:10, fill:C.water }));
    add(txt(X(b[0]) + 6, Y(b[1]) - 8, 'object', { an:'start', fs:10, fill:C.load }));
    add(line(X(0), Y(R), X(0), Y(R - r.Mneed), { stroke:C.ocean, 'stroke-width':1.4 }));
    add(txt(X(0) + 6, Y(R - r.Mneed / 2) + 4, `M needed ${fmt(r.Mneed, 1)} m`, { an:'start', fs:10.5, fw:600, fill:C.ocean }));
    add(txt(390, 296, `SSD ${fmt(S, 0)} m against ${fmt(r.Savail, 0)} m visible past the obstruction`,
      { an:'start', fs:11.5, fill: clear ? C.green : C.load, halo:0 }));
  }

  /* ---------- profile ---------- */
  function drawProfile(r) {
    const L = state.L, g1 = state.g1 / 100, g2 = state.g2 / 100, S = r.sd.S;
    add(txt(390, 330, `Profile, ${r.crest ? 'crest' : 'sag'} curve L ${fmt(L, 0)} m, A ${fmt(r.A, 1)}%, vertical scale × 10`,
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const span = Math.max(L, S) * 1.5 + 40;
    /* elevation with the PVC at x = -L/2 and y = 0 there */
    const z = x => {
      const u = x + L / 2;
      if (u <= 0) return g1 * u;
      if (u >= L) return g1 * L + (g2 - g1) * L / 2 + g2 * (u - L);
      return g1 * u + (g2 - g1) / (2 * L) * u * u;
    };
    const xs = []; for (let i = 0; i <= 160; i++) xs.push(-span / 2 + span * i / 160);
    const zs = xs.map(z);
    const zmin = Math.min(...zs) - 3, zmax = Math.max(...zs) + 4;
    const kx = 530 / span, kz = Math.min(kx * 10, 200 / (zmax - zmin));
    const X = x => 655 + x * kx, Z = v => 560 - (v - zmin) * kz;
    add(s('path', { d: xs.map((x, i) => `${i ? 'L' : 'M'}${X(x)},${Z(zs[i])}`).join('') + `L${X(xs[xs.length - 1])},575 L${X(xs[0])},575 Z`,
      fill:'#E9EDE6', stroke:C.ocean, 'stroke-width':1.8 }));
    add(line(X(-L / 2), Z(z(-L / 2)) - 8, X(-L / 2), Z(z(-L / 2)) + 8, { stroke:C.ocean }));
    add(line(X(L / 2), Z(z(L / 2)) - 8, X(L / 2), Z(z(L / 2)) + 8, { stroke:C.ocean }));
    add(txt(X(-L / 2), Z(z(-L / 2)) - 12, 'BVC', { fs:9.5 }));
    add(txt(X(L / 2), Z(z(L / 2)) - 12, 'EVC', { fs:9.5 }));
    add(txt(X(-span / 2) + 6, Z(z(-span / 2)) - 10, `${state.g1 > 0 ? '+' : ''}${state.g1}%`, { an:'start', fs:10.5, fill:C.ocean }));
    add(txt(X(span / 2) - 6, Z(z(span / 2)) - 10, `${state.g2 > 0 ? '+' : ''}${state.g2}%`, { an:'end', fs:10.5, fill:C.ocean }));
    const ok = r.Sv >= S;
    if (r.crest) {
      const xe = -S / 2, xo = S / 2;
      add(line(X(xe), Z(z(xe) + 1.08), X(xo), Z(z(xo) + 0.6), { stroke: ok ? C.green : C.load, 'stroke-width':2, 'stroke-dasharray':'7 4' }));
      add(s('circle', { cx:X(xe), cy:Z(z(xe) + 1.08), r:4.5, fill:C.water }));
      add(s('circle', { cx:X(xo), cy:Z(z(xo) + 0.6), r:4, fill:C.load }));
      add(txt(X(xe), Z(z(xe) + 1.08) - 10, 'eye 1.08 m', { fs:10, fill:C.water }));
      add(txt(X(xo), Z(z(xo) + 0.6) - 10, 'object 0.6 m', { fs:10, fill:C.load }));
    } else {
      const xh = -S / 2, ang = g1 + Math.tan(Math.PI / 180);
      const reach = Math.min(r.Sv, span / 2 - xh);
      add(s('polygon', { points:`${X(xh)},${Z(z(xh) + 0.6)} ${X(xh + reach)},${Z(z(xh) + 0.6 + (ang + 0.012) * reach)} ${X(xh + reach)},${Z(z(xh) + 0.6 + (ang - 0.012) * reach)}`,
        fill:'#F2D88A', 'fill-opacity':.45, stroke:'none' }));
      add(line(X(xh), Z(z(xh) + 0.6), X(xh + reach), Z(z(xh) + 0.6 + ang * reach), { stroke: ok ? C.green : C.load, 'stroke-width':1.6, 'stroke-dasharray':'6 4' }));
      add(s('circle', { cx:X(xh), cy:Z(z(xh) + 0.6), r:4.5, fill:C.water }));
      add(txt(X(xh), Z(z(xh) + 0.6) - 10, 'headlights 0.6 m, 1° up', { fs:10, fill:C.water }));
    }
    add(txt(390, 595, `${r.crest ? 'Sight' : 'Headlight'} distance over the curve ${isFinite(r.Sv) ? fmt(r.Sv, 0) : 'unlimited'} m against SSD ${fmt(S, 0)} m, Lmin ${fmt(r.Lmin, 0)} m`,
      { an:'start', fs:11.5, fill: ok ? C.green : C.load, halo:0 }));
  }

  /* ---------- left column ---------- */
  function drawLeft(r) {
    const X = 26, W = 320;
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Stopping sight distance', clause:'AASHTO 2011 eq 3-2, 3-3' }, [
      { sym:'0.278 V t', val:fmt(r.sd.react, 1) }, { op:'+', sym:'V²/254(a/g + G)', val:fmt(r.sd.brake, 1) },
      { op:'=', sym:'SSD m', val:fmt(r.sd.S, 1) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Minimum radius', clause:'AASHTO 2011 eq 3-8' }, [
      { sym:'V²', val:fmt(state.V * state.V, 0) }, { op:'÷', sym:'127', val:'127' }, { op:'÷', sym:'e + f', val:fmt(state.e + r.f, 3) },
      { op:'=', sym:'Rmin m', val:fmt(r.Rm, 0) }]);
    const items = [
      { name:'Radius, Rmin / R', util:r.u.radius, clause:'3.3.3' },
      { name:'Sight past the obstruction', util:r.u.hsight, note:'SSD / sight distance available', clause:'3.3.12' },
      { name:`${r.crest ? 'Crest' : 'Sag'} curve length, Lmin / L`, util:r.u.vsight, clause: r.crest ? '3.4.6.2' : '3.4.6.3' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:48, title:'Checks' }, items);
    return items;
  }

  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse', patternTransform:'rotate(45)' },
      s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));
    const r = AlignmentEngine.solve(state);
    const items = drawLeft(r);
    add(line(370, 16, 370, 584, { stroke:C.hair }));
    drawPlan(r);
    add(line(390, 310, 940, 310, { stroke:C.hair }));
    drawProfile(r);
    const v = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('SSD', `${fmt(r.sd.S, 0)} m`, `reaction ${fmt(r.sd.react, 0)} + braking ${fmt(r.sd.brake, 0)}`) +
      chip('Rmin', `${fmt(r.Rm, 0)} m`, `e ${fmt(state.e * 100, 0)}%, f ${fmt(r.f, 3)}`, r.u.radius <= 1 ? 'ok' : 'warn') +
      chip('M needed', `${fmt(r.Mneed, 1)} m`, `provided ${fmt(state.M, 1)} m`, state.M >= r.Mneed ? 'ok' : 'warn') +
      chip('Curve length', `${fmt(r.Lc, 0)} m`, 'R Δ') +
      chip(r.crest ? 'Crest Lmin' : 'Sag Lmin', `${fmt(r.Lmin, 0)} m`, `K = ${fmt(r.Kmin, 1)}`, r.u.vsight <= 1 ? 'ok' : 'warn') +
      chip('K provided', isFinite(r.K) ? fmt(r.K, 1) : '–', `L ${fmt(state.L, 0)} m over A ${fmt(r.A, 1)}%`);
    DesignKit.trail(trailEl, 'Show the working', [
      { t:`SSD = 0.278 × ${state.V} × ${state.t} + ${state.V}² / (254 (${state.a}/9.81 ${state.G >= 0 ? '+' : '−'} ${fmt(Math.abs(state.G) / 100, 3)})) = ${fmt(r.sd.react, 1)} + ${fmt(r.sd.brake, 1)} = ${fmt(r.sd.S, 1)} m`, c:'AASHTO 3.2.2' },
      { t:`Rmin = ${state.V}² / (127 × (${fmt(state.e, 2)} + ${fmt(r.f, 3)})) = ${fmt(r.Rm, 1)} m${state.fAuto ? ', f from the AASHTO fmax table' : ''}`, c:'3.3.3' },
      { t:`M = R (1 − cos(S/2R)) = ${fmt(r.Mneed, 2)} m for R = ${state.R} m, curve length ${fmt(r.Lc, 1)} m`, c:'3.3.12' },
      { t:`A = |${state.g2} − ${state.g1}| = ${fmt(r.A, 1)}%, ${r.crest ? 'L = AS²/658 or 2S − 658/A' : 'L = AS²/(120 + 3.5S) or 2S − (120 + 3.5S)/A'} gives Lmin = ${fmt(r.Lmin, 1)} m`, c: r.crest ? '3.4.6.2' : '3.4.6.3' }]);
  }

  /* ---------- controls ---------- */
  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  const select = (id, label, opts, cur) => `<div class="ctl"><label for="${id}">${label}</label><select id="${id}">` +
    opts.map(o => `<option value="${o[0]}"${String(cur) === String(o[0]) ? ' selected' : ''}>${o[1]}</option>`).join('') + '</select></div>';
  function renderControls() {
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      '<h3 style="margin-top:16px">Stopping</h3>' +
      slider('V', 'Design speed V (km/h)', 30, 130, 5) + slider('t', 'Reaction time (s)', 1, 3.5, 0.1) +
      slider('a', 'Deceleration (m/s²)', 2, 5, 0.1) + slider('G', 'Grade while braking (%)', -9, 9, 0.5) +
      '<h3>Horizontal curve</h3>' +
      slider('R', 'Radius R (m)', 30, 2000, 5) + slider('delta', 'Deflection angle Δ (°)', 5, 120, 1) +
      slider('e', 'Superelevation e', 0, 0.12, 0.005) +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="fAuto"${state.fAuto ? ' checked' : ''}> Side friction from the AASHTO fmax table</label>` +
      (state.fAuto ? '' : slider('f', 'Side friction f', 0.05, 0.4, 0.005)) +
      slider('M', 'Clear offset to the obstruction (m)', 1, 40, 0.5) +
      '<h3>Vertical curve</h3>' +
      slider('g1', 'Grade in g1 (%)', -8, 8, 0.5) + slider('g2', 'Grade out g2 (%)', -8, 8, 0.5) +
      slider('L', 'Curve length L (m)', 0, 800, 5);
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
    if (t.id === 'fAuto') { state.fAuto = t.checked; markCustom(); renderControls(); render(); }
  });

  renderControls();
  render();
})();
