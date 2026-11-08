/* CivilLab · En1 Water Treatment Train */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const all = () => ({ screen:true, coag:true, sed:true, filter:true, disinf:true });
  const PRESETS = {
    river:   { label:'River, dry season', f:()=>({ turb:50, tss:80, logE:4, units:all() }) },
    monsoon: { label:'River in the monsoon', f:()=>({ turb:300, tss:600, logE:5, units:all() }) },
    lake:    { label:'Clean reservoir, direct filtration', f:()=>({ turb:8, tss:12, logE:3, units:Object.assign(all(), { sed:false }) }) },
    nocoag:  { label:'Coagulant dosing has failed', f:()=>({ turb:50, tss:80, logE:4, units:Object.assign(all(), { coag:false }) }) },
    cl:      { label:'Chlorine alone', f:()=>({ turb:50, tss:80, logE:4, units:{ screen:false, coag:false, sed:false, filter:false, disinf:true } }) }
  };
  const state = Object.assign({ preset:'river' }, PRESETS.river.f());
  const solve = () => TreatmentEngine.solve({ raw:{ turb:state.turb, tss:state.tss, ecoli:Math.pow(10, state.logE) }, units:state.units });

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
  const SHORT = { raw:'Raw', screen:'Screen', coag:'Coagulate', sed:'Settle', filter:'Filter', disinf:'Chlorinate' };

  /* ---------- the train ---------- */
  function drawTrain(r) {
    const X0 = 400, W = 530, n = r.stages.length;
    const xAt = i => X0 + 20 + i * (W - 40) / (n - 1);
    add(txt(X0, 26, 'Click a unit to switch it on or off', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(line(xAt(0), 90, xAt(n - 1) + 30, 90, { stroke:C.water, 'stroke-width':6, 'stroke-opacity':.35, 'marker-end':'url(#aW)' }));
    r.stages.forEach((st, i) => {
      const x = xAt(i);
      if (st.unit === 'raw') {
        add(s('path', { d:`M${x - 28},${78} q 14 -10 28 0 t 28 0`, fill:'none', stroke:C.water, 'stroke-width':2 }));
        add(s('path', { d:`M${x - 28},${92} q 14 -10 28 0 t 28 0`, fill:'none', stroke:C.water, 'stroke-width':2 }));
        add(txt(x, 128, 'River intake', { fs:10.5, fw:600, fill:C.water }));
        return;
      }
      const g = add(s('g', { 'data-id':st.unit, style:'cursor:pointer' }));
      g.appendChild(s('rect', { x:x - 36, y:62, width:72, height:56, rx:8, fill: st.on ? C.ocean : '#fff',
        'fill-opacity': st.on ? .9 : 1, stroke: st.on ? C.ocean : C.contour, 'stroke-width':1.6, 'stroke-dasharray': st.on ? null : '5 3' }));
      g.appendChild(txt(x, 94, SHORT[st.unit], { fs:11, fw:600, fill: st.on ? '#fff' : C.muted, halo:0 }));
      add(txt(x, 134, st.on ? (st.log ? `${fmt(st.log, 1)} log` : '') : 'off', { fs:10, fill: st.on ? C.green : C.muted }));
    });
    add(txt(xAt(n - 1) + 34, 108, 'to the tap', { an:'start', fs:10, fill:C.water }));
    return xAt;
  }

  /* log scale line plot across the stages */
  function plotLog(r, xAt, key, title, y0, y1, lo, hi, targets, unit) {
    add(txt(400, y0 - 12, title, { an:'start', fs:12.5, fw:600, fill:C.ocean, halo:0 }));
    const Y = v => y1 - (Math.log10(clamp(v, lo, hi)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (y1 - y0);
    add(line(xAt(0) - 10, y1, xAt(r.stages.length - 1) + 10, y1, { stroke:C.axis }));
    for (let e = Math.ceil(Math.log10(lo)); e <= Math.log10(hi); e++) {
      add(line(xAt(0) - 10, Y(10 ** e), xAt(r.stages.length - 1) + 10, Y(10 ** e), { stroke:C.hair }));
      add(txt(xAt(0) - 16, Y(10 ** e) + 4, e >= 0 ? String(10 ** e) : `10${e < 0 ? '⁻' : ''}${String(Math.abs(e)).replace(/./g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`,
        { an:'end', fs:9.5 }));
    }
    targets.forEach(t => {
      add(line(xAt(0) - 10, Y(t.v), xAt(r.stages.length - 1) + 10, Y(t.v), { stroke:C.load, 'stroke-dasharray':'5 3', 'stroke-width':1.2 }));
      add(txt(xAt(r.stages.length - 1) + 14, Y(t.v) + 4, t.label, { an:'start', fs:9.5, fill:C.load }));
    });
    const pts = r.stages.map((st, i) => [xAt(i), Y(st[key])]);
    add(s('polyline', { points:pts.map(p => p.join(',')).join(' '), fill:'none', stroke:C.water, 'stroke-width':2.2 }));
    r.stages.forEach((st, i) => {
      add(s('circle', { cx:pts[i][0], cy:pts[i][1], r:4.5, fill: st.on ? C.water : '#fff', stroke:C.water, 'stroke-width':1.6 }));
      if (i === 0 || i === r.stages.length - 1) add(txt(pts[i][0] + (i ? 8 : -8), pts[i][1] - 7,
        `${st[key] < 0.01 ? st[key].toExponential(0) : fmt(st[key], st[key] < 10 ? 2 : 0)} ${unit}`, { an: i ? 'start' : 'end', fs:10.5, fw:600, fill:C.ocean }));
    });
  }

  function drawTss(r, xAt) {
    const y0 = 470, y1 = 540, top = Math.max(...r.stages.map(st => st.tss), 1);
    add(txt(400, y0 - 12, 'Suspended solids, mg/L', { an:'start', fs:12.5, fw:600, fill:C.ocean, halo:0 }));
    r.stages.forEach((st, i) => {
      const h = st.tss / top * (y1 - y0);
      add(s('rect', { x:xAt(i) - 14, y:y1 - h, width:28, height:Math.max(h, 0.8), fill:'#B9A07E', 'fill-opacity': st.on ? .75 : .3 }));
      add(txt(xAt(i), y1 - h - 4, fmt(st.tss, st.tss < 10 ? 1 : 0), { fs:9.5 }));
      add(txt(xAt(i), y1 + 14, SHORT[st.unit], { fs:9.5 }));
    });
  }

  function drawLeft(r) {
    const X = 26, W = 330;
    let y = 30;
    const logs = r.stages.filter(st => st.on && st.log > 0);
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'E. coli log removal, stage by stage', clause:'log credits' },
      (logs.length ? logs : [{ name:'none', log:0 }]).map((st, i) => ({ op: i ? '+' : '', sym:st.name === 'none' ? 'none' : SHORT[st.unit], val:fmt(st.log, 1) }))
        .concat([{ op:'=', sym:'total', val:fmt(r.totalLog, 1) }]));
    const items = [
      { name:'Turbidity before chlorination, 1 NTU', util:r.u.turbDisinf, clause:'WHO' },
      { name:'Turbidity at the tap, 2 NTU', util:r.u.turbTap, clause:'SLS 614' },
      { name:'E. coli, none in 100 mL', util: r.final.ecoli, note:'shown as count per 100 mL, below 1 passes', clause:'WHO, SLS 614' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:50, title:'Targets' }, items);
    return items;
  }

  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aW', C.water, 5)));
    const r = solve();
    const items = drawLeft(r);
    add(line(375, 16, 375, 544, { stroke:C.hair }));
    const xAt = drawTrain(r);
    plotLog(r, xAt, 'turb', 'Turbidity, NTU', 190, 290, 0.01, 1000, [{ v:1, label:'1 NTU' }], 'NTU');
    plotLog(r, xAt, 'ecoli', 'E. coli per 100 mL', 330, 430, 1e-4, 1e6, [{ v:1, label:'1 per 100 mL' }], '');
    drawTss(r, xAt);
    const v = DesignKit.verdict(items);
    const fe = r.final.ecoli;
    resultsEl.innerHTML =
      chip('Verdict', v[0] === 'Passes' ? 'Safe' : 'Unsafe', v[1], v[2]) +
      chip('Turbidity out', `${fmt(r.final.turb, r.final.turb < 10 ? 2 : 0)} NTU`, `${fmt(r.removal.turb * 100, 1)}% removed`, r.final.turb <= 2 ? 'ok' : 'warn') +
      chip('Before chlorine', `${fmt(r.preDisinfTurb, 2)} NTU`, 'WHO asks 1 NTU or less', r.preDisinfTurb <= 1 ? 'ok' : 'warn') +
      chip('E. coli out', fe < 0.01 ? fe.toExponential(1) : fmt(fe, fe < 10 ? 2 : 0), 'per 100 mL', fe < 1 ? 'ok' : 'warn') +
      chip('Log removal', fmt(r.totalLog, 1), `${fmt((1 - Math.pow(10, -r.totalLog)) * 100, Math.min(6, Math.max(1, Math.ceil(r.totalLog))))}% killed`) +
      chip('Solids out', `${fmt(r.final.tss, 1)} mg/L`, `${fmt(r.removal.tss * 100, 1)}% removed`);
    DesignKit.trail(trailEl, 'What each stage did', r.stages.map(st => ({
      t:`${st.name}: ${st.note}, leaving ${fmt(st.turb, st.turb < 10 ? 2 : 0)} NTU, ${fmt(st.tss, 1)} mg/L and ${st.ecoli < 0.01 ? st.ecoli.toExponential(1) : fmt(st.ecoli, st.ecoli < 10 ? 2 : 0)} E. coli per 100 mL`,
      c: st.on && st.log ? `${fmt(st.log, 1)} log` : '' })));
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
      '<h3 style="margin-top:16px">Raw water</h3>' +
      slider('turb', 'Turbidity (NTU)', 1, 500, 1) + slider('tss', 'Suspended solids (mg/L)', 1, 1000, 1) +
      slider('logE', 'E. coli, log10 per 100 mL', 1, 6, 0.1) +
      '<h3>Units in service</h3>' +
      TreatmentEngine.UNITS.map(u => `<label class="chk" style="margin:7px 0"><input type="checkbox" data-u="${u}"${state.units[u] ? ' checked' : ''}> ${TreatmentEngine.NAMES[u]}</label>`).join('');
  }
  function markCustom() {
    if (state.preset === 'custom') return;
    state.preset = 'custom';
    const sel = document.getElementById('preset');
    if (sel) sel.value = 'custom';
  }
  function toggle(u, on) {
    state.units[u] = on;
    const cb = controls.querySelector(`[data-u="${u}"]`);
    if (cb) cb.checked = on;
    markCustom(); render();
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
    if (t.dataset.u) toggle(t.dataset.u, t.checked);
  });
  fig.addEventListener('click', e => {
    const g = e.target.closest('[data-id]');
    if (g) toggle(g.dataset.id, !state.units[g.dataset.id]);
  });

  renderControls();
  render();
})();
