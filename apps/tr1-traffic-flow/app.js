/* CivilLab · Tr1 Traffic Flow Fundamental Diagram */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const VW = 960, VH = 600;

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const PRESETS = {
    urban: { label:'Urban arterial', f:()=>({ model:'greenshields', vf:60, kj:120, kA:30, shock:false, kB:100 }) },
    motor: { label:'Motorway lane', f:()=>({ model:'greenshields', vf:110, kj:140, kA:40, shock:false, kB:110 }) },
    queue: { label:'Queue behind a red light', f:()=>({ model:'greenshields', vf:60, kj:120, kA:25, shock:true, kB:120 }) },
    clear: { label:'Queue discharging', f:()=>({ model:'greenshields', vf:60, kj:120, kA:110, shock:true, kB:60 }) },
    green: { label:'Greenberg, dense traffic', f:()=>({ model:'greenberg', vf:80, kj:140, kA:70, shock:false, kB:110 }) }
  };
  const state = Object.assign({ preset:'urban' }, PRESETS.urban.f());
  let anim = null, t0 = 0, simT = 0;

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

  /* three plots and the road */
  const BOX = { vk:{ x0:60, x1:430, y0:50, y1:260 }, qk:{ x0:540, x1:910, y0:50, y1:260 },
                vq:{ x0:60, x1:430, y0:340, y1:550 }, road:{ x0:540, x1:910, y0:340, y1:550 } };
  let scales = null;

  function axes(b, xl, yl, xmax, ymax, xt, yt) {
    add(line(b.x0, b.y1, b.x1, b.y1, { stroke:C.axis }));
    add(line(b.x0, b.y0, b.x0, b.y1, { stroke:C.axis }));
    add(txt(b.x1, b.y1 + 30, xl, { an:'end', fs:10.5 }));
    add(txt(b.x0 - 40, (b.y0 + b.y1) / 2, yl, { fs:10.5, rot:-90 }));
    for (let i = 0; i <= 4; i++) {
      const xv = xmax * i / 4, yv = ymax * i / 4;
      add(txt(b.x0 + (b.x1 - b.x0) * i / 4, b.y1 + 15, fmt(xv, xt), { fs:9.5 }));
      add(txt(b.x0 - 6, b.y1 - (b.y1 - b.y0) * i / 4 + 4, fmt(yv, yt), { an:'end', fs:9.5 }));
    }
  }

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, s('marker', { id:'aW', viewBox:'0 0 10 10', refX:8.5, refY:5, markerWidth:6, markerHeight:6, orient:'auto-start-reverse' },
      s('path', { d:'M0,0 L10,5 L0,10 z', fill:C.load }))));
    const r = TrafficEngine.solve(state), m = r.m;
    const kmax = state.kj, vmax = state.model === 'greenberg' ? Math.max(state.vf * 1.4, m.v(kmax * 0.05)) : state.vf * 1.08;
    const qtop = m.qmax * 1.15;
    const S = {
      vk: { x: k => BOX.vk.x0 + k / kmax * (BOX.vk.x1 - BOX.vk.x0), y: v => BOX.vk.y1 - Math.min(v, vmax) / vmax * (BOX.vk.y1 - BOX.vk.y0) },
      qk: { x: k => BOX.qk.x0 + k / kmax * (BOX.qk.x1 - BOX.qk.x0), y: q => BOX.qk.y1 - q / qtop * (BOX.qk.y1 - BOX.qk.y0) },
      vq: { x: q => BOX.vq.x0 + q / qtop * (BOX.vq.x1 - BOX.vq.x0), y: v => BOX.vq.y1 - Math.min(v, vmax) / vmax * (BOX.vq.y1 - BOX.vq.y0) }
    };
    scales = { S, kmax, vmax, qtop, m };
    add(txt(BOX.vk.x0, 30, 'Speed against density', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(txt(BOX.qk.x0, 30, 'Flow against density', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(txt(BOX.vq.x0, 320, 'Speed against flow', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    axes(BOX.vk, 'k veh/km', 'v km/h', kmax, vmax, 0, 0);
    axes(BOX.qk, 'k veh/km', 'q veh/h', kmax, qtop, 0, 0);
    axes(BOX.vq, 'q veh/h', 'v km/h', qtop, vmax, 0, 0);

    /* the three curves */
    const N = 160;
    let d1 = '', d2 = '', d3u = '', d3c = '';
    for (let i = 0; i <= N; i++) {
      const k = Math.max(kmax * i / N, kmax * 0.002), v = m.v(k), q = m.q(k);
      d1 += `${i ? 'L' : 'M'}${S.vk.x(k)},${S.vk.y(v)}`;
      d2 += `${i ? 'L' : 'M'}${S.qk.x(k)},${S.qk.y(q)}`;
      if (k <= m.kc) d3u += `${d3u ? 'L' : 'M'}${S.vq.x(q)},${S.vq.y(v)}`;
      else d3c += `${d3c ? 'L' : 'M'}${S.vq.x(q)},${S.vq.y(v)}`;
    }
    add(s('path', { d:d1, fill:'none', stroke:C.ocean, 'stroke-width':2.2 }));
    add(s('path', { d:d2, fill:'none', stroke:C.ocean, 'stroke-width':2.2 }));
    add(s('path', { d:d3u, fill:'none', stroke:C.green, 'stroke-width':2.2 }));
    add(s('path', { d:d3c, fill:'none', stroke:C.load, 'stroke-width':2.2, 'stroke-dasharray':'6 3' }));
    add(txt(S.vq.x(m.qmax * 0.55), S.vq.y(m.v(m.kc * 0.4)) - 8, 'uncongested', { fs:10, fill:C.green }));
    add(txt(S.vq.x(m.qmax * 0.55), S.vq.y(m.v(Math.min(kmax * 0.92, m.kc * 1.7))) + 16, 'congested', { fs:10, fill:C.load }));

    /* capacity marks */
    add(line(S.qk.x(m.kc), S.qk.y(0), S.qk.x(m.kc), S.qk.y(m.qmax), { stroke:C.contour, 'stroke-dasharray':'4 3' }));
    add(line(S.qk.x(0), S.qk.y(m.qmax), S.qk.x(m.kc), S.qk.y(m.qmax), { stroke:C.contour, 'stroke-dasharray':'4 3' }));
    add(txt(S.qk.x(m.kc) + 6, S.qk.y(m.qmax) - 6, `qmax ${fmt(m.qmax, 0)} at ${fmt(m.kc, 1)}`, { an:'start', fs:10.5, fill:C.ocean }));
    /* the space mean speed is the slope of the ray from the origin on the q-k plot */
    add(line(S.qk.x(0), S.qk.y(0), S.qk.x(r.A.k), S.qk.y(r.A.q), { stroke:C.water, 'stroke-width':1, 'stroke-dasharray':'3 3' }));

    if (state.shock) {
      add(line(S.qk.x(r.A.k), S.qk.y(r.A.q), S.qk.x(r.B.k), S.qk.y(r.B.q), { stroke:C.load, 'stroke-width':1.8 }));
      add(txt((S.qk.x(r.A.k) + S.qk.x(r.B.k)) / 2, (S.qk.y(r.A.q) + S.qk.y(r.B.q)) / 2 - 8,
        `shock ${fmt(r.uw, 1)} km/h`, { fs:10.5, fw:600, fill:C.load }));
    }
    const dot = (P, name, col) => {
      [['vk', S.vk.x(P.k), S.vk.y(P.v)], ['qk', S.qk.x(P.k), S.qk.y(P.q)], ['vq', S.vq.x(P.q), S.vq.y(P.v)]].forEach(([pl, x, y]) => {
        const g = add(s('g', { 'data-id':`${name}-${pl}` }));
        g.appendChild(s('circle', { cx:x, cy:y, r:15, fill:'transparent' }));
        g.appendChild(s('circle', { cx:x, cy:y, r:6.5, fill:col, stroke:'#fff', 'stroke-width':2 }));
        add(txt(x + 9, y - 9, name, { an:'start', fs:11, fw:600, fill:col }));
      });
    };
    dot(r.A, 'A', C.water);
    if (state.shock) dot(r.B, 'B', C.load);

    drawRoad(r);
    chips(r);
  }

  /* the road: cars spaced 1000/k metres, moving at v, the boundary at uw */
  function drawRoad(r) {
    const b = BOX.road, Lm = 600;   // metres shown
    const X = mtr => b.x0 + mtr / Lm * (b.x1 - b.x0);
    add(txt(b.x0, 320, 'On the road, 600 m', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const yA = b.y0 + 50, yR = b.y0 + 100;
    add(s('rect', { x:b.x0, y:yA, width:b.x1 - b.x0, height:36, fill:'#E9EDE6', stroke:C.hair }));
    add(line(b.x0, yA + 18, b.x1, yA + 18, { stroke:'#fff', 'stroke-dasharray':'10 8', 'stroke-width':1.5 }));
    const tS = simT / 3600;   // hours
    const bound = state.shock ? clamp(Lm / 2 + r.uw * 1000 * tS, -50, Lm + 50) : Lm + 100;
    if (state.shock) {
      add(line(X(clamp(bound, 0, Lm)), yA - 10, X(clamp(bound, 0, Lm)), yA + 46, { stroke:C.load, 'stroke-width':2 }));
      add(txt(X(clamp(bound, 0, Lm)), yA - 14, 'boundary', { fs:10, fill:C.load }));
    }
    const carsOf = (P, from, to, col) => {
      if (P.k <= 0.01) return;
      const sp = 1000 / P.k, off = (P.v * 1000 * tS) % sp;
      for (let x = from - sp + off; x < to; x += sp) {
        if (x < from || x > to) continue;
        add(s('rect', { x:X(x) - 5, y:yA + 8, width:10, height:20, rx:3, fill:col, 'fill-opacity':.85 }));
      }
    };
    if (state.shock) { carsOf(r.A, 0, Math.min(bound, Lm), C.water); carsOf(r.B, Math.max(bound, 0), Lm, C.load); }
    else carsOf(r.A, 0, Lm, C.water);
    const rows = [
      `A: ${fmt(r.A.k, 1)} veh/km at ${fmt(r.A.v, 1)} km/h, one car every ${fmt(r.A.spacing, 1)} m, ${fmt(r.A.headway, 2)} s apart`,
      state.shock ? `B: ${fmt(r.B.k, 1)} veh/km at ${fmt(r.B.v, 1)} km/h, boundary moves ${r.uw < 0 ? 'upstream' : 'downstream'} at ${fmt(Math.abs(r.uw), 1)} km/h` : '',
      `Traffic flows left to right. Press Animate to watch it move.`
    ];
    rows.filter(Boolean).forEach((t, i) => add(txt(b.x0, yR + 10 + i * 20, t, { an:'start', fs:11, fill:'#41505A', halo:0 })));
  }

  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  function chips(r) {
    const m = r.m;
    resultsEl.innerHTML =
      chip('Capacity qmax', `${fmt(m.qmax, 0)} veh/h`, m.type === 'greenshields' ? 'vf kj / 4' : m.type === 'greenberg' ? 'vm kj / e' : 'vf ko / e') +
      chip('At density kc', `${fmt(m.kc, 1)} veh/km`, `speed ${fmt(m.vc, 1)} km/h`) +
      chip('Density A', `${fmt(r.A.k, 1)} veh/km`, r.A.regime, r.A.regime === 'congested' ? 'warn' : 'ok') +
      chip('Speed A', `${fmt(r.A.v, 1)} km/h`, 'space mean speed') +
      chip('Flow A', `${fmt(r.A.q, 0)} veh/h`, `v/c = ${fmt(r.A.vc, 2)}`) +
      chip('Headway', `${fmt(r.A.headway, 2)} s`, `spacing ${fmt(r.A.spacing, 1)} m`) +
      (state.shock ? chip('Shockwave', `${fmt(r.uw, 1)} km/h`, r.uw < 0 ? 'travels upstream' : r.uw > 0 ? 'travels downstream' : 'stands still', r.uw < 0 ? 'warn' : '') : '');
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
      select('model', 'Speed density model', [['greenshields', 'Greenshields, linear'], ['greenberg', 'Greenberg, logarithmic'], ['underwood', 'Underwood, exponential']], state.model) +
      slider('vf', 'Free flow speed vf (km/h)', 20, 140, 1) + slider('kj', 'Jam density kj (veh/km)', 60, 200, 1) +
      '<h3>Operating state</h3>' + slider('kA', 'Density at A (veh/km)', 0.5, 200, 0.5) +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="shock"${state.shock ? ' checked' : ''}> Add a second state B and its shockwave</label>` +
      (state.shock ? slider('kB', 'Density at B, downstream (veh/km)', 0.5, 200, 0.5) : '') +
      `<div class="addrow"><button class="btn" id="anim">${anim ? 'Stop' : 'Animate'}</button></div>`;
  }
  function syncInput(k) {
    ['r', 'n'].forEach(suf => { const el = document.getElementById(k + suf);
      if (el && el !== document.activeElement) el.value = state[k]; });
  }
  function markCustom() {
    if (state.preset === 'custom') return;
    state.preset = 'custom';
    const sel = document.getElementById('preset');
    if (sel) sel.value = 'custom';
  }
  function keepInRange() {
    state.kA = clamp(state.kA, 0.5, state.kj); state.kB = clamp(state.kB, 0.5, state.kj);
    syncInput('kA'); syncInput('kB');
  }
  controls.addEventListener('input', e => {
    const t = e.target, k = t.dataset.k;
    if (!k) return;
    const v = parseFloat(t.value);
    if (isNaN(v)) return;
    state[k] = clamp(v, parseFloat(t.min), parseFloat(t.max));
    const twin = document.getElementById(k + (t.type === 'range' ? 'n' : 'r'));
    if (twin && twin !== document.activeElement) twin.value = state[k];
    keepInRange(); markCustom(); render();
  });
  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'preset') {
      if (PRESETS[t.value]) { Object.assign(state, PRESETS[t.value].f()); state.preset = t.value; simT = 0; renderControls(); }
      render(); return;
    }
    if (t.id === 'model') { state.model = t.value; markCustom(); render(); return; }
    if (t.id === 'shock') { state.shock = t.checked; simT = 0; markCustom(); renderControls(); render(); }
  });
  controls.addEventListener('click', e => {
    if (e.target.id !== 'anim') return;
    if (anim) { cancelAnimationFrame(anim); anim = null; e.target.textContent = 'Animate'; return; }
    e.target.textContent = 'Stop';
    t0 = performance.now() - simT / 4 * 1000;
    const step = now => { simT = (now - t0) / 1000 * 4; render(); anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  });

  /* drag A or B on whichever plot it was picked up from */
  let drag = null;
  fig.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-id]');
    if (!g) return;
    const [who, plot] = g.dataset.id.split('-');
    drag = { who, plot }; fig.setPointerCapture(e.pointerId); e.preventDefault();
  });
  fig.addEventListener('pointermove', e => {
    if (!drag || !scales) return;
    const rc = fig.getBoundingClientRect();
    const px = (e.clientX - rc.left) * VW / rc.width, py = (e.clientY - rc.top) * VH / rc.height;
    const { kmax, vmax, m } = scales;
    let k;
    if (drag.plot === 'vq') {
      const b = BOX.vq, v = clamp((b.y1 - py) / (b.y1 - b.y0) * vmax, 0.01, vmax);
      k = m.kOfV(v);
    } else {
      const b = BOX[drag.plot];
      k = (px - b.x0) / (b.x1 - b.x0) * kmax;
    }
    const key = drag.who === 'A' ? 'kA' : 'kB';
    state[key] = clamp(snap(k, 0.5), 0.5, state.kj);
    syncInput(key); markCustom(); render();
  });
  const end = () => { drag = null; };
  fig.addEventListener('pointerup', end);
  fig.addEventListener('pointercancel', end);

  renderControls();
  render();
})();
