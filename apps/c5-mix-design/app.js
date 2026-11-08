/* CivilLab · C5 Concrete Mix Design Studio */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const tableWrap = document.getElementById('tablewrap');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');
  const VW = 960, VH = 560;

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };
  /* one shade per constituent, blues for the liquid phases, greys for solids */
  const PART = { water:C.water, cement:C.ocean, air:'#DCE6EE', fine:'#C9CEC7', coarse:'#8E9AA1' };

  const base = { method:'en', sd:5, FM:2.7, druw:1600, sgCA:2.65, sgFA:2.62, manual:false, wcUser:0.5,
                 mcCA:1, abCA:0.5, mcFA:4, abFA:1 };
  const PRESETS = {
    c25:    { label:'C25 general structural', f:()=>Object.assign({}, base, { fck:25, slump:'75-100', dmax:19, wcMax:0.6, cMin:280 }) },
    c40:    { label:'C40 high strength frame', f:()=>Object.assign({}, base, { fck:40, slump:'75-100', dmax:19, wcMax:0.5, cMin:340 }) },
    mass:   { label:'Mass foundation, big stone', f:()=>Object.assign({}, base, { fck:20, slump:'25-50', dmax:50, FM:2.8, wcMax:0.65, cMin:240 }) },
    pump:   { label:'Pumped, fine stone', f:()=>Object.assign({}, base, { fck:30, slump:'150-175', dmax:12.5, FM:2.6, wcMax:0.55, cMin:320 }) },
    marine: { label:'Marine exposure caps w/c', f:()=>Object.assign({}, base, { fck:25, slump:'75-100', dmax:19, wcMax:0.45, cMin:360 }) }
  };
  const state = Object.assign({ preset:'c25' }, PRESETS.c25.f());

  const solveFor = method => MixEngine.solve(Object.assign({}, state, { method,
    mcCA:state.mcCA / 100, abCA:state.abCA / 100, mcFA:state.mcFA / 100, abFA:state.abFA / 100 }));

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

  /* ---------- strength against w/c ---------- */
  const P = { x0:420, x1:700, y0:56, y1:290, w0:0.35, w1:0.85, f0:10, f1:50 };
  const PX = w => P.x0 + (w - P.w0) / (P.w1 - P.w0) * (P.x1 - P.x0);
  const PY = f => P.y1 - (f - P.f0) / (P.f1 - P.f0) * (P.y1 - P.y0);
  function drawCurve(r) {
    add(txt(P.x0 - 20, 30, 'Strength against water to cement ratio, ACI 211.1 Table 6.3.4a',
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    for (let w = 0.4; w <= 0.81; w += 0.1) {
      add(line(PX(w), P.y1, PX(w), P.y1 + 4, { stroke:C.axis }));
      add(txt(PX(w), P.y1 + 16, fmt(w, 1), { fs:10 }));
    }
    for (let f = 10; f <= 50; f += 10) {
      add(line(P.x0 - 4, PY(f), P.x0, PY(f), { stroke:C.axis }));
      add(txt(P.x0 - 8, PY(f) + 4, String(f), { an:'end', fs:10 }));
    }
    add(txt((P.x0 + P.x1) / 2, P.y1 + 32, 'w/c by mass', { fs:10.5 }));
    add(txt(P.x0 - 30, (P.y0 + P.y1) / 2, 'fcm MPa', { fs:10.5, rot:-90 }));
    /* the region the durability limit forbids */
    if (state.wcMax < P.w1) {
      add(s('rect', { x:PX(state.wcMax), y:P.y0, width:P.x1 - PX(state.wcMax), height:P.y1 - P.y0, fill:C.load, 'fill-opacity':.06 }));
      add(line(PX(state.wcMax), P.y0, PX(state.wcMax), P.y1, { stroke:C.load, 'stroke-width':1.4, 'stroke-dasharray':'5 3' }));
      add(txt(PX(state.wcMax) + 4, P.y0 + 12, `durability max ${fmt(state.wcMax, 2)}`, { an:'start', fs:10, fill:C.load }));
    }
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const w = 0.38 + (0.82 - 0.38) * i / 60;
      d += `${i ? 'L' : 'M'}${PX(w)},${PY(MixEngine.strengthFor(w))}`;
    }
    add(s('path', { d, fill:'none', stroke:C.ocean, 'stroke-width':2.2 }));
    MixEngine.WC.forEach(p => add(s('circle', { cx:PX(p[1]), cy:PY(p[0]), r:3, fill:'#fff', stroke:C.ocean, 'stroke-width':1.4 })));
    /* target read off the curve */
    const fm = r.t.fm;
    add(line(P.x0, PY(fm), PX(r.wcStr), PY(fm), { stroke:C.green, 'stroke-dasharray':'4 3' }));
    add(line(PX(r.wcStr), PY(fm), PX(r.wcStr), P.y1, { stroke:C.green, 'stroke-dasharray':'4 3' }));
    add(txt(P.x0 + 6, PY(fm) + 14, `target fm = ${fmt(fm, 1)}`, { an:'start', fs:10.5, fill:C.green, fw:600 }));
    add(txt(PX(r.wcStr) + 4, P.y1 - 6, fmt(r.wcStr, 3), { an:'start', fs:10.5, fill:C.green }));
    const g = add(s('g', { 'data-id':'wc' }));
    const ox = PX(r.wcEff), oy = PY(r.fExp);
    g.appendChild(s('circle', { cx:ox, cy:oy, r:15, fill:'transparent' }));
    g.appendChild(s('circle', { cx:ox, cy:oy, r:6.5, fill: r.strengthUtil <= 1 && r.durUtil <= 1 ? C.green : C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(ox + 10, oy - 10, `w/c ${fmt(r.wcEff, 3)} gives ${fmt(r.fExp, 1)} MPa`, { an:'start', fs:11, fw:600,
      fill: r.strengthUtil <= 1 && r.durUtil <= 1 ? C.green : C.load }));
  }

  /* ---------- slump cone ---------- */
  function drawCone() {
    const cx = 840, base = 270, k = 0.62;
    add(txt(cx, 30, 'Slump', { fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const mid = { '25-50':37.5, '75-100':87.5, '150-175':162.5 }[state.slump];
    /* the 100 / 200 / 300 mm cone outline, then the slumped heap */
    add(s('polygon', { points:`${cx - 50 * k},${base - 300 * k} ${cx + 50 * k},${base - 300 * k} ${cx + 100 * k},${base} ${cx - 100 * k},${base}`,
      fill:'none', stroke:C.contour, 'stroke-dasharray':'5 3', 'stroke-width':1.4 }));
    const hh = (300 - mid) * k, spread = 1 + mid / 300;
    add(s('path', { d:`M${cx - 100 * k * spread},${base} C${cx - 95 * k * spread},${base - hh * 0.6} ${cx - 55 * k},${base - hh} ${cx},${base - hh}` +
      ` C${cx + 55 * k},${base - hh} ${cx + 95 * k * spread},${base - hh * 0.6} ${cx + 100 * k * spread},${base} Z`,
      fill:PART.fine, 'fill-opacity':.7, stroke:C.muted, 'stroke-width':1.2 }));
    add(line(cx - 120, base, cx + 120, base, { stroke:C.axis, 'stroke-width':1.4 }));
    add(line(cx - 70, base - 300 * k, cx - 70, base - hh, { stroke:C.water, 'stroke-width':1.4 }));
    add(txt(cx - 76, base - 300 * k + (300 * k - hh) / 2 + 4, `${state.slump} mm`, { an:'end', fs:11, fw:600, fill:C.water }));
    add(txt(cx, base + 18, 'cone 100 / 200 / 300 mm', { fs:10 }));
  }

  /* ---------- proportions ---------- */
  function drawBars(r) {
    const X0 = 420, W = 500, keys = ['water', 'cement', 'air', 'fine', 'coarse'];
    const names = { water:'water', cement:'cement', air:'air', fine:'sand', coarse:'stone' };
    add(txt(X0 - 20, 352, 'Proportions of one cubic metre', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const rows = [
      { label:'by volume', vals:{ water:r.vol.water, cement:r.vol.cement, air:r.vol.air, fine:Math.max(0, r.vol.fine), coarse:r.vol.coarse },
        unit:v => fmt(v * 100, 1) + '%' },
      { label:'by mass', vals:{ water:r.W, cement:r.C, air:0, fine:Math.max(0, r.FA), coarse:r.CA }, unit:v => fmt(v, 0) }];
    rows.forEach((row, i) => {
      const y = 378 + i * 64, tot = keys.reduce((a, k) => a + row.vals[k], 0);
      add(txt(X0 - 8, y + 18, row.label, { an:'end', fs:11, halo:0 }));
      let x = X0;
      keys.forEach(k => {
        const w = row.vals[k] / tot * W;
        if (w <= 0.2) return;
        add(s('rect', { x, y, width:w, height:26, fill:PART[k], stroke:'#fff', 'stroke-width':1 }));
        if (w > 34) add(txt(x + w / 2, y + 17, row.unit(row.vals[k]), { fs:10.5, fw:600,
          fill: k === 'cement' || k === 'water' || k === 'coarse' ? '#fff' : C.ocean, halo:0 }));
        if (i === 0) add(txt(x + w / 2, y - 5, names[k], { fs:10, halo:0 }));
        x += w;
      });
    });
    add(txt(X0, 528, `By mass 1 : ${fmt(r.ratio.fine, 2)} : ${fmt(r.ratio.coarse, 2)} with w/c ${fmt(r.wcEff, 2)}, ` +
      `density ${fmt(r.density, 0)} kg/m³`, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
    if (!r.feasible) add(txt(X0, 548, 'Too little room is left for sand. Use a larger stone or less water.',
      { an:'start', fs:11.5, fill:C.load, halo:0 }));
  }

  /* ---------- left column ---------- */
  function drawLeft(r) {
    const X = 26, W = 310;
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Target mean strength',
      clause: state.method === 'aci' ? `ACI 318, ${r.t.eq}` : 'EN 206, fck + 1.64s' }, [
      { sym:'fck', val:fmt(state.fck, 0) }, { op:'+', sym:'margin', val:fmt(r.t.margin, 2) },
      { op:'=', sym:'fm', val:fmt(r.t.fm, 1) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Cement content', clause:'ACI 211.1 6.3.3, 6.3.4' }, [
      { sym:'water', val:fmt(r.W, 0) }, { op:'÷', sym:'w/c', val:fmt(r.wc, 3) },
      { op:'=', sym:'cement', val:fmt(r.C, 0) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Coarse aggregate', clause:'ACI 211.1 6.3.6' }, [
      { sym:'Vca', val:fmt(r.Vca, 3) }, { sym:'ρ rodded', val:fmt(state.druw, 0) },
      { op:'=', sym:'stone', val:fmt(r.CA, 0) }]);
    const items = [
      { name:'Strength, fm / fcm at this w/c', util:r.strengthUtil, clause:'6.3.4' },
      { name:'Durability, w/c / limit', util:r.durUtil, clause:'EN 206 Table F.1' },
      { name:'Cement, minimum / content', util:r.cementUtil, clause:'EN 206 Table F.1' }];
    if (!r.feasible) items.push({ name:'Room left for sand', util:Infinity, clause:'6.3.8' });
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:42, title:'Checks' }, items);
    return items;
  }

  function drawTable(r) {
    const td = 'white-space:nowrap;padding:5px 8px;border-bottom:1px solid #DFE3DC;text-align:right;font-size:12.5px';
    const th = 'white-space:nowrap;padding:5px 8px;border-bottom:2px solid #14416B;text-align:right;font-size:11px;color:#5C6A72;font-weight:600';
    const rows = [
      ['Water', r.W, r.vol.water, r.field.water],
      ['Cement', r.C, r.vol.cement, r.field.cement],
      ['Sand', r.FA, r.vol.fine, r.field.fine],
      ['Stone', r.CA, r.vol.coarse, r.field.coarse],
      ['Air', 0, r.vol.air, 0]];
    tableWrap.innerHTML = `<table style="border-collapse:collapse;width:100%"><thead><tr>` +
      ['Constituent', 'SSD kg/m³', 'volume m³', 'batch kg/m³', 'per 50 kg bag'].map((h, i) =>
        `<th style="${th}${i === 0 ? ';text-align:left' : ''}">${h}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(rw => `<tr><td style="${td};text-align:left">${rw[0]}</td><td style="${td}">${rw[1] ? fmt(rw[1], 0) : '–'}</td>` +
        `<td style="${td}">${fmt(rw[2], 4)}</td><td style="${td}">${rw[3] ? fmt(rw[3], 0) : '–'}</td>` +
        `<td style="${td}">${rw[3] ? fmt(rw[3] * r.perBag, 1) + ' kg' : '–'}</td></tr>`).join('') + '</tbody></table>' +
      `<div style="margin-top:8px;font-size:12.5px;color:#41505A">Batch weights take the stockpile moisture: the stone carries ` +
      `${fmt(state.mcCA - state.abCA, 1)}% free water and the sand ${fmt(state.mcFA - state.abFA, 1)}%, so the mixer gets ` +
      `${fmt(r.W - r.field.water, 1)} kg less water per cubic metre.</div>`;
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    const r = solveFor(state.method);
    const other = solveFor(state.method === 'en' ? 'aci' : 'en');
    const items = drawLeft(r);
    add(line(370, 16, 370, 544, { stroke:C.hair }));
    drawCurve(r);
    drawCone();
    drawBars(r);
    drawTable(r);

    const v = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('Target fm', `${fmt(r.t.fm, 1)} MPa`, state.method === 'aci' ? `ACI 318, ${r.t.eq}` : 'fck + 1.64s') +
      chip('w/c', fmt(r.wcEff, 3), state.manual ? 'set by hand' : `${r.governedBy} governs`,
           r.strengthUtil <= 1 && r.durUtil <= 1 ? 'ok' : 'warn') +
      chip('Water', `${fmt(r.W, 0)} kg/m³`, `slump ${state.slump}, ${state.dmax} mm stone`) +
      chip('Cement', `${fmt(r.C, 0)} kg/m³`, r.cementRaised ? 'raised to the minimum' : 'from w/c', r.cementUtil <= 1 ? 'ok' : 'warn') +
      chip('Sand', `${fmt(r.FA, 0)} kg/m³`, `${fmt(r.vol.fine * 100, 1)}% of the volume`, r.feasible ? '' : 'warn') +
      chip('Stone', `${fmt(r.CA, 0)} kg/m³`, `Vca = ${fmt(r.Vca, 3)}`) +
      chip('Mix by mass', `1 : ${fmt(r.ratio.fine, 2)} : ${fmt(r.ratio.coarse, 2)}`, `${fmt(r.density, 0)} kg/m³`) +
      chip(state.method === 'en' ? 'ACI 318 target' : 'EN 206 target', `${fmt(other.t.fm, 1)} MPa`, `cement ${fmt(other.C, 0)} kg/m³`);

    DesignKit.trail(trailEl, 'Show the working', [
      { t:`Target mean fm = ${state.fck} + ${fmt(r.t.margin, 2)} = ${fmt(r.t.fm, 2)} MPa with s = ${state.sd} MPa`, c: state.method === 'aci' ? 'ACI 318 26.4.3' : 'EN 206 8.2.1' },
      { t:`Water ${r.W} kg/m³ and entrapped air ${r.air}% for ${state.slump} mm slump and ${state.dmax} mm stone`, c:'ACI 211.1 Table 6.3.3' },
      { t:`w/c for ${fmt(r.t.fm, 1)} MPa = ${fmt(r.wcStr, 3)}${r.wcOutside ? ', read beyond the table' : ''}, durability limit ${fmt(state.wcMax, 2)}, so w/c = ${fmt(r.wc, 3)}`, c:'Table 6.3.4a' },
      { t:`Cement = ${r.W} / ${fmt(r.wc, 3)} = ${fmt(r.Cstr, 0)} kg/m³${r.cementRaised ? `, raised to the minimum ${state.cMin}` : ''}`, c:'6.3.5' },
      { t:`Stone = ${fmt(r.Vca, 3)} × ${state.druw} = ${fmt(r.CA, 0)} kg/m³ for FM ${fmt(state.FM, 2)}`, c:'Table 6.3.6' },
      { t:`Sand volume = 1 − ${fmt(r.vol.water, 3)} − ${fmt(r.vol.cement, 4)} − ${fmt(r.vol.coarse, 4)} − ${fmt(r.vol.air, 3)} = ${fmt(r.vol.fine, 4)} m³, so ${fmt(r.FA, 0)} kg at RD ${state.sgFA}`, c:'6.3.8.2' },
      { t:`Batch: water ${fmt(r.field.water, 0)}, sand ${fmt(r.field.fine, 0)}, stone ${fmt(r.field.coarse, 0)} kg/m³ after the moisture correction`, c:'6.3.9' }]);
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
      select('method', 'Target strength margin', [['en', 'EN 206 / BS 8500, fck + 1.64s'], ['aci', 'ACI 318, fc + 1.34s or 2.33s']], state.method) +
      '<h3 style="margin-top:16px">Strength</h3>' +
      slider('fck', 'Characteristic cylinder strength (MPa)', 15, 45, 1) +
      slider('sd', 'Standard deviation s (MPa)', 0, 8, 0.5) +
      '<h3>Workability and aggregate</h3>' +
      select('slump', 'Slump', [['25-50', '25 to 50 mm, stiff'], ['75-100', '75 to 100 mm, medium'], ['150-175', '150 to 175 mm, flowing']], state.slump) +
      select('dmax', 'Maximum stone size', MixEngine.SIZES.map(d => [d, `${d} mm`]), state.dmax) +
      slider('FM', 'Sand fineness modulus', 2.4, 3.0, 0.05) +
      slider('druw', 'Stone dry rodded density (kg/m³)', 1400, 1800, 10) +
      slider('sgCA', 'Stone relative density', 2.5, 2.8, 0.01) + slider('sgFA', 'Sand relative density', 2.5, 2.8, 0.01) +
      '<h3>Durability</h3>' +
      slider('wcMax', 'Maximum w/c', 0.35, 0.75, 0.01) + slider('cMin', 'Minimum cement (kg/m³)', 200, 450, 5) +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="manual"${state.manual ? ' checked' : ''}> Set the w/c by hand, or drag the point</label>` +
      slider('wcUser', 'w/c by hand', 0.35, 0.8, 0.005) +
      '<h3>Stockpile moisture (%)</h3>' +
      `<div class="grid2"><div class="mini"><label for="mcCAn">stone moisture</label><input type="number" id="mcCAn" data-k="mcCA" min="0" max="5" step="0.1" value="${state.mcCA}"></div>` +
      `<div class="mini"><label for="abCAn">stone absorption</label><input type="number" id="abCAn" data-k="abCA" min="0" max="5" step="0.1" value="${state.abCA}"></div>` +
      `<div class="mini"><label for="mcFAn">sand moisture</label><input type="number" id="mcFAn" data-k="mcFA" min="0" max="10" step="0.1" value="${state.mcFA}"></div>` +
      `<div class="mini"><label for="abFAn">sand absorption</label><input type="number" id="abFAn" data-k="abFA" min="0" max="5" step="0.1" value="${state.abFA}"></div></div>`;
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
  controls.addEventListener('input', e => {
    const t = e.target, k = t.dataset.k;
    if (!k) return;
    const v = parseFloat(t.value);
    if (isNaN(v)) return;
    state[k] = clamp(v, parseFloat(t.min), parseFloat(t.max));
    const twin = document.getElementById(k + (t.type === 'range' ? 'n' : 'r'));
    if (twin && twin !== document.activeElement) twin.value = state[k];
    if (k === 'wcUser' && !state.manual) { state.manual = true; document.getElementById('manual').checked = true; }
    markCustom();
    render();
  });
  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'preset') {
      if (PRESETS[t.value]) { Object.assign(state, PRESETS[t.value].f()); state.preset = t.value; renderControls(); }
      render(); return;
    }
    if (t.id === 'method') { state.method = t.value; render(); return; }
    if (t.id === 'manual') { state.manual = t.checked; markCustom(); render(); return; }
    if (t.tagName === 'SELECT') { state[t.id] = t.id === 'dmax' ? +t.value : t.value; markCustom(); render(); }
  });

  /* drag the operating point along the curve to set the w/c by hand */
  let drag = false;
  fig.addEventListener('pointerdown', e => {
    if (!e.target.closest('[data-id="wc"]')) return;
    drag = true; fig.setPointerCapture(e.pointerId); e.preventDefault();
  });
  fig.addEventListener('pointermove', e => {
    if (!drag) return;
    const rc = fig.getBoundingClientRect();
    const px = (e.clientX - rc.left) * VW / rc.width;
    state.wcUser = clamp(snap(P.w0 + (px - P.x0) / (P.x1 - P.x0) * (P.w1 - P.w0), 0.005), 0.35, 0.8);
    state.manual = true;
    const m = document.getElementById('manual');
    if (m) m.checked = true;
    syncInput('wcUser'); markCustom(); render();
  });
  const end = () => { drag = false; };
  fig.addEventListener('pointerup', end);
  fig.addEventListener('pointercancel', end);

  renderControls();
  render();
})();
