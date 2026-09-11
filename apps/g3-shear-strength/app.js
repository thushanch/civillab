/* CivilLab · G3 Mohr-Coulomb Shear Strength */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const spec = document.getElementById('spec');
  const mohr = document.getElementById('mohr');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const RAD = Math.PI / 180;

  /* ---------- presets, factories so nothing is shared ---------- */
  const PRESETS = {
    dense: { label:'Dense sand · CD',        f:()=>({ mode:'cd', c:0,  phi:38, cu:40, s3:100, A:0,    load:60 }) },
    loose: { label:'Loose sand · CD',        f:()=>({ mode:'cd', c:0,  phi:30, cu:40, s3:100, A:0,    load:60 }) },
    silty: { label:'Silty gravel · CD',      f:()=>({ mode:'cd', c:5,  phi:35, cu:40, s3:150, A:0,    load:60 }) },
    nc:    { label:'Normally consolidated clay · CU', f:()=>({ mode:'cu', c:0, phi:24, cu:40, s3:200, A:0.9,  load:60 }) },
    oc:    { label:'Overconsolidated clay · CU',      f:()=>({ mode:'cu', c:15, phi:28, cu:40, s3:200, A:-0.2, load:60 }) },
    soft:  { label:'Soft clay · UU',         f:()=>({ mode:'uu', c:0,  phi:24, cu:35, s3:150, A:0,    load:60 }) }
  };

  const state = Object.assign({ preset:'loose', base:'loose' }, PRESETS.loose.f());

  /* the load slider is a percentage of the deviator at failure, so it always
     spans the meaningful range whatever the strength parameters are */
  function solveNow() {
    const probe = ShearEngine.solve({ mode:state.mode, c:state.c, phi:state.phi,
      cu:state.cu, s3:state.s3, A:state.A, sd:0 });
    const ref = isFinite(probe.sdf) && probe.sdf > 1e-9
      ? probe.sdf : Math.max(50, 4 * state.s3 + 4 * state.c);
    const sd = state.load / 100 * ref;
    const r = ShearEngine.solve({ mode:state.mode, c:state.c, phi:state.phi,
      cu:state.cu, s3:state.s3, A:state.A, sd });
    r.ref = ref;
    return r;
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

  /* split a rectangle by a line, used to shear the specimen apart */
  function splitRect(x0, y0, x1, y1, px, py, dx, dy) {
    const cor = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
    const side = p => (p[0] - px) * dy - (p[1] - py) * dx;
    const A = [], B = [];
    for (let i = 0; i < 4; i++) {
      const p = cor[i], q = cor[(i + 1) % 4];
      const sp = side(p), sq = side(q);
      if (sp >= 0) A.push(p);
      if (sp <= 0) B.push(p);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        const t = sp / (sp - sq);
        const ip = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
        A.push(ip); B.push(ip);
      }
    }
    return [A, B];
  }
  const poly = pts => pts.map(p => `${p[0]},${p[1]}`).join(' ');

  /* =====================================================================
     Figure 1 · the specimen, the applied stresses and the failure plane
     ===================================================================== */
  function drawSpec(r) {
    clearSvg(spec);
    spec.appendChild(s('defs', {}, marker('sLoad', C.load), marker('sWat', C.water, 5.5),
      marker('sGrn', C.green, 5.5)));
    spec.appendChild(txt(28, 22, 'Specimen and failure plane',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    const cx = 230, cy = 218, w = 118, h = 176;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;

    /* the failure plane rises to the right at theta from the horizontal,
       because sigma1 is vertical so the major principal plane is horizontal */
    const th = r.theta * RAD;
    const dx = Math.cos(th), dy = -Math.sin(th);

    const [above, below] = splitRect(x0, y0, x1, y1, cx, cy, dx, dy);
    const meanY = p => p.reduce((a, q) => a + q[1], 0) / p.length;
    let upper = above, lower = below;
    if (meanY(above) > meanY(below)) { upper = below; lower = above; }

    /* when the sample has failed the upper wedge slides along the plane */
    const slip = r.failed ? 15 : 0;
    const fill = r.failed ? 'rgba(176,58,46,.10)' : 'rgba(20,65,107,.07)';
    const edge = r.failed ? C.load : C.ocean;

    spec.appendChild(s('polygon', { points: poly(lower), fill, stroke: edge,
      'stroke-width':1.8, 'stroke-linejoin':'round' }));
    spec.appendChild(s('polygon', { points: poly(upper), fill, stroke: edge,
      'stroke-width':1.8, 'stroke-linejoin':'round',
      transform: `translate(${slip * dx} ${slip * dy})` }));

    /* the plane itself */
    const L = 132;
    spec.appendChild(line(cx - L * dx, cy - L * dy, cx + L * dx, cy + L * dy,
      { stroke: r.failed ? C.load : C.green, 'stroke-width':2,
        'stroke-dasharray': r.failed ? '' : '7 4' }));

    /* the angle from the horizontal */
    spec.appendChild(line(cx - L * dx, cy, cx + 26, cy,
      { stroke:C.axis, 'stroke-width':1, 'stroke-dasharray':'4 4' }));
    const ar = 46;
    spec.appendChild(s('path', {
      d:`M ${cx + ar} ${cy} A ${ar} ${ar} 0 0 0 ${cx + ar * dx} ${cy + ar * dy}`,
      fill:'none', stroke:C.green, 'stroke-width':1.4 }));
    spec.appendChild(txt(cx + ar + 30, cy - 16, `θ = ${fmt(r.theta, 1)}°`,
      { fs:12, fw:600, fill:C.green }));

    /* sigma1 on top, sigma3 on the sides, both applied by the student */
    const arrow = (x1_, y1_, x2_, y2_) => spec.appendChild(
      line(x1_, y1_, x2_, y2_, { stroke:C.load, 'stroke-width':2,
        'marker-end':'url(#sLoad)' }));
    for (const f of [0.25, 0.5, 0.75]) {
      arrow(x0 + w * f, y0 - 40, x0 + w * f, y0 - 8);
      arrow(x0 + w * f, y1 + 40, x0 + w * f, y1 + 8);
    }
    for (const f of [0.3, 0.7]) {
      arrow(x0 - 40, y0 + h * f, x0 - 8, y0 + h * f);
      arrow(x1 + 40, y0 + h * f, x1 + 8, y0 + h * f);
    }
    spec.appendChild(txt(cx, y0 - 50, `σ1 = ${fmt(r.s1, 0)} kPa`,
      { fs:12.5, fw:600, fill:C.load, halo:0 }));
    spec.appendChild(txt(cx, y1 + 62, `σ3 = ${fmt(r.s3, 0)} kPa  (cell pressure)`,
      { fs:12, fw:600, fill:C.load, halo:0 }));
    spec.appendChild(txt(x0 - 46, y0 + h * 0.3 - 10, 'σ3', { an:'end', fs:12, fill:C.load }));

    /* deviator */
    spec.appendChild(txt(cx, y0 - 68, `deviator σd = σ1 − σ3 = ${fmt(r.sd, 0)} kPa`,
      { fs:11.5, fill:C.muted, halo:0 }));

    /* pore pressure inside the specimen */
    if (r.u != null) {
      spec.appendChild(s('rect', { x:x0 + 14, y:cy + 44, width:w - 28, height:22, rx:4,
        fill:C.water, 'fill-opacity':.14, stroke:C.water, 'stroke-width':1 }));
      spec.appendChild(txt(cx, cy + 59, `u = ${fmt(r.u, 0)}`,
        { fs:11.5, fw:600, fill:C.water, halo:0 }));
    } else {
      spec.appendChild(txt(cx, cy + 59, 'u not measured',
        { fs:11, fw:600, fill:C.muted, halo:2.5 }));
    }

    /* normal and shear stress acting on the failure plane, at failure */
    if (r.atFailure) {
      const T = r.atFailure.tangent;
      spec.appendChild(txt(230, 372,
        `on that plane at failure:  σn′ = ${fmt(T.s, 0)} kPa,  τ = ${fmt(T.t, 0)} kPa`,
        { fs:11.5, fw:600, fill:C.green, halo:0 }));
    }
    spec.appendChild(txt(230, 396,
      r.failed ? 'the specimen has sheared along the plane'
               : `load is at ${fmt(state.load, 0)} % of the failure deviator`,
      { fs:11.5, fw:600, fill: r.failed ? C.load : C.muted, halo:0 }));
    spec.appendChild(txt(230, 416,
      r.mode === 'uu' ? 'UU test, total stress analysis with φu = 0'
        : r.mode === 'cu' ? 'CU test, failure governed by effective stress'
        : 'CD test, no excess pore pressure',
      { fs:11, fill:C.muted, halo:0 }));
  }

  /* =====================================================================
     Figure 2 · Mohr circles against the failure envelope
     ===================================================================== */
  const ML = 52, MR = 544, MT = 40, MB = 340, MVH = 430;
  const MW = MR - ML, MH = MB - MT;

  function drawMohr(r) {
    clearSvg(mohr);
    mohr.appendChild(s('defs', {}, marker('mU', C.water, 5.5)));

    /* equal scale on both axes, or the circles stop being circles */
    const sMax0 = Math.max(r.tot.C + r.tot.R,
                           r.atFailure ? r.atFailure.C + r.atFailure.R : 0,
                           r.s1, 50) * 1.14;
    const tNeed = Math.max(r.tot.R, r.atFailure ? r.atFailure.R : 0,
                           ShearEngine.tauF(r.c, r.phi, sMax0), 25) * 1.10;
    const k = Math.min(MW / sMax0, MH / tNeed);
    const SX = v => ML + v * k;
    const TY = v => MB - v * k;
    const invSX = px => (px - ML) / k;
    const sMax = MW / k, tMax = MH / k;

    mohr.appendChild(txt(ML - 6, 22, 'Mohr circles and the envelope',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    /* grid */
    const step = niceStep(sMax);
    for (let v = 0; v <= sMax; v += step)
      mohr.appendChild(line(SX(v), MT, SX(v), MB,
        { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.6 }));
    for (let v = 0; v <= tMax; v += step)
      mohr.appendChild(line(ML, TY(v), MR, TY(v),
        { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.6 }));

    /* axes */
    mohr.appendChild(line(ML, MB, MR, MB, { stroke:C.axis, 'stroke-width':1.4 }));
    mohr.appendChild(line(ML, MT, ML, MB, { stroke:C.axis, 'stroke-width':1.4 }));
    for (let v = 0; v <= sMax; v += step)
      mohr.appendChild(txt(SX(v), MB + 17, String(Math.round(v)), { fs:10.5, halo:0 }));
    for (let v = step; v <= tMax; v += step)
      mohr.appendChild(txt(ML - 7, TY(v) + 4, String(Math.round(v)), { an:'end', fs:10.5, halo:0 }));
    mohr.appendChild(txt((ML + MR) / 2, MB + 40,
      r.mode === 'uu' ? 'total normal stress σ (kPa)' : 'normal stress σ and σ′ (kPa)',
      { fs:11.5, halo:0 }));
    mohr.appendChild(txt(15, (MT + MB) / 2, 'shear stress τ (kPa)',
      { fs:11.5, halo:0, rot:-90 }));

    /* the failure envelope, what the soil answers with */
    const envY = ShearEngine.tauF(r.c, r.phi, sMax);
    mohr.appendChild(line(SX(0), TY(r.c), SX(sMax), TY(envY),
      { stroke:C.green, 'stroke-width':2.4 }));
    mohr.appendChild(txt(SX(sMax * 0.62),
      TY(ShearEngine.tauF(r.c, r.phi, sMax * 0.62)) - 10,
      r.mode === 'uu' ? `τf = cu = ${fmt(r.c, 0)}`
                      : `τf = c′ + σ′ tan φ′`,
      { fs:11.5, fw:600, fill:C.green }));
    if (r.c > 0.5) {
      mohr.appendChild(s('circle', { cx:SX(0), cy:TY(r.c), r:3, fill:C.green }));
      mohr.appendChild(txt(SX(0) + 8, TY(r.c) - 8,
        r.mode === 'uu' ? `cu = ${fmt(r.c, 0)}` : `c′ = ${fmt(r.c, 0)}`,
        { an:'start', fs:11, fw:600, fill:C.green }));
    }

    /* the failure circle, drawn as a ghost until it is reached */
    if (r.atFailure && !r.failed) {
      mohr.appendChild(s('circle', { cx:SX(r.atFailure.C), cy:TY(0),
        r:Math.max(0, r.atFailure.R * k), fill:'none', stroke:C.contour,
        'stroke-width':1.6, 'stroke-dasharray':'6 4' }));
      mohr.appendChild(txt(SX(r.atFailure.C), TY(r.atFailure.R) - 8, 'circle at failure',
        { fs:10.5, fill:C.muted }));
    }

    /* total circle, dashed, only worth drawing when it differs */
    const showTotal = r.mode === 'cu' && Math.abs(r.u) > 0.5;
    if (showTotal) {
      mohr.appendChild(s('circle', { cx:SX(r.tot.C), cy:TY(0), r:Math.max(0, r.tot.R * k),
        fill:'none', stroke:C.water, 'stroke-width':1.8, 'stroke-dasharray':'5 4' }));
      mohr.appendChild(txt(SX(r.tot.C), TY(r.tot.R) - 8, 'total',
        { fs:10.5, fw:600, fill:C.water }));
      /* the pore pressure gap between the two centres */
      mohr.appendChild(line(SX(r.act.C), TY(0) + 22, SX(r.tot.C), TY(0) + 22,
        { stroke:C.water, 'stroke-width':1.6, 'marker-end':'url(#mU)' }));
      mohr.appendChild(txt((SX(r.act.C) + SX(r.tot.C)) / 2, TY(0) + 38,
        `u = ${fmt(r.u, 0)}`, { fs:11, fw:600, fill:C.water, halo:0 }));
    }

    /* the acting circle: effective for CD and CU, total for UU */
    const col = r.failed ? C.load : C.ocean;
    mohr.appendChild(s('circle', { cx:SX(r.act.C), cy:TY(0), r:Math.max(0, r.act.R * k),
      fill:col, 'fill-opacity':.07, stroke:col, 'stroke-width':2.4 }));
    mohr.appendChild(txt(SX(r.act.C), TY(r.act.R) - 8,
      r.mode === 'uu' ? 'total' : 'effective',
      { fs:10.5, fw:600, fill:col }));

    /* the two principal stresses on the axis */
    const p3 = r.mode === 'uu' ? r.s3 : r.s3e, p1 = r.mode === 'uu' ? r.s1 : r.s1e;
    for (const [v, lab] of [[p3, r.mode === 'uu' ? 'σ3' : 'σ3′'],
                            [p1, r.mode === 'uu' ? 'σ1' : 'σ1′']]) {
      mohr.appendChild(s('circle', { cx:SX(v), cy:TY(0), r:3.6, fill:col }));
      mohr.appendChild(txt(SX(v), MB + 17, '', { fs:1, halo:0 }));
      mohr.appendChild(txt(SX(v), TY(0) - 9, lab, { fs:11.5, fw:600, fill:col }));
    }

    /* the tangent point and the 2 theta sweep, once the circle touches */
    if (r.failed && r.atFailure) {
      const T = r.atFailure.tangent;
      mohr.appendChild(line(SX(r.act.C), TY(0), SX(T.s), TY(T.t),
        { stroke:C.green, 'stroke-width':1.3, 'stroke-dasharray':'4 3' }));
      mohr.appendChild(s('circle', { cx:SX(T.s), cy:TY(T.t), r:4.6, fill:C.green,
        stroke:'#fff', 'stroke-width':1.5 }));
      mohr.appendChild(txt(SX(T.s), TY(T.t) - 12,
        `σn′ ${fmt(T.s, 0)},  τ ${fmt(T.t, 0)}`,
        { fs:11, fw:600, fill:C.green }));
      mohr.appendChild(txt(SX(r.act.C), TY(0) + 18, `2θ = ${fmt(2 * r.theta, 0)}°`,
        { fs:10.5, fw:600, fill:C.green, halo:2.5 }));
    }

    /* verdict */
    mohr.appendChild(txt((ML + MR) / 2, MVH - 12,
      r.neverFails ? 'this soil cannot be failed in this test, the pore pressure falls faster than the load rises'
        : r.failed ? 'the circle touches the envelope, the specimen has failed'
        : `the circle is ${fmt((1 - r.utilisation) * 100, 0)} % clear of the envelope, load to failure to close the gap`,
      { fs:12, fw:600, fill: r.failed ? C.load : C.ocean, halo:0 }));
  }

  function niceStep(range) {
    const raw = range / 6;
    const p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /* ---------- results chips ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function drawChips(r) {
    const uu = r.mode === 'uu';
    let h =
      chip('σ3 cell', `${fmt(r.s3, 0)} kPa`, 'total confining stress') +
      chip('Deviator σd', `${fmt(r.sd, 0)} kPa`, 'σ1 − σ3, applied by the ram') +
      chip('u', uu ? '–' : `${fmt(r.u, 0)} kPa`, uu ? 'not measured in UU' : 'pore water pressure') +
      chip('σ3′', uu ? '–' : `${fmt(r.s3e, 0)} kPa`, uu ? 'unknown in UU' : 'σ3 − u') +
      chip('σ1′', uu ? '–' : `${fmt(r.s1e, 0)} kPa`, uu ? 'unknown in UU' : 'σ1 − u') +
      chip('σd at failure', r.neverFails ? '–' : `${fmt(r.sdf, 0)} kPa`,
           uu ? '2 cu' : 'from the envelope', 'ok') +
      chip('Load margin', r.neverFails ? '–' : (r.margin >= 99 ? '> 99' : fmt(r.margin, 2)),
           'σd,f / σd', r.failed ? 'warn' : 'ok') +
      chip('Mobilised φ', uu ? '–' : `${fmt(r.phiMob, 1)}°`,
           uu ? 'φu = 0' : `of φ′ = ${fmt(r.phi, 0)}°`, r.failed ? 'warn' : '') +
      chip('Failure plane', `${fmt(r.theta, 1)}°`, '45 + φ/2 from the σ1 plane') +
      chip('State', r.failed ? 'FAILED' : 'Stable',
           r.failed ? 'the circle touches the envelope' : 'the circle is clear',
           r.failed ? 'warn' : 'ok');
    resultsEl.innerHTML = h;
  }

  /* ---------- render ---------- */
  function render() {
    const r = solveNow();
    drawSpec(r);
    drawMohr(r);
    drawChips(r);
    const n = document.getElementById('sdNote');
    if (n) n.textContent = `σd = ${fmt(r.sd, 0)} kPa` +
      (r.neverFails ? '  (no failure possible)' : `  of ${fmt(r.sdf, 0)} kPa at failure`);
  }

  /* ---------- controls ---------- */
  function renderControls() {
    const opts = Object.entries(PRESETS)
      .map(([k, p]) => `<option value="${k}"${k === state.preset ? ' selected' : ''}>${p.label}</option>`).join('');
    const row = (id, lab, min, max, st, val) => `<div class="ctl"><label for="${id}n">${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    const uu = state.mode === 'uu';
    controls.innerHTML = `
      <h3>Sample</h3>
      <div class="ctl"><select id="preset"><option value="">Custom</option>${opts}</select></div>
      <h3>Test type</h3>
      <div class="ctl"><select id="mode">
        <option value="cd"${state.mode === 'cd' ? ' selected' : ''}>CD · consolidated drained</option>
        <option value="cu"${state.mode === 'cu' ? ' selected' : ''}>CU · undrained, u measured</option>
        <option value="uu"${state.mode === 'uu' ? ' selected' : ''}>UU · unconsolidated undrained</option>
      </select></div>
      <h3>Strength</h3>
      ${uu ? row('cu', 'Undrained strength cu (kPa)', 5, 200, 1, state.cu)
           : row('c', 'Effective cohesion c′ (kPa)', 0, 100, 1, state.c) +
             row('phi', 'Effective friction φ′ (°)', 0, 45, 1, state.phi)}
      <h3>Test</h3>
      ${row('s3', 'Cell pressure σ3 (kPa)', 0, 500, 5, state.s3)}
      ${state.mode === 'cu' ? row('A', 'Skempton A (B = 1)', -0.5, 1.5, 0.05, state.A) : ''}
      ${row('load', 'Load level (% of failure)', 0, 120, 1, state.load)}
      <div id="sdNote" style="font-size:12.5px;font-weight:600;color:#14416B;margin:2px 0 6px"></div>
      <div class="addrow">
        <button class="btn small" id="tofail">Load to failure</button>
        <button class="btn ghost small" id="unload">Unload</button>
      </div>`;
  }

  const LIM = { c:[0,100], phi:[0,45], cu:[5,200], s3:[0,500], A:[-0.5,1.5], load:[0,120] };
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
    if (k !== 'load') setCustom();
    render();
  });

  controls.addEventListener('change', e => {
    if (e.target.id === 'preset') {
      const p = PRESETS[e.target.value];
      if (!p) { state.preset = ''; return; }
      Object.assign(state, p.f());
      state.preset = state.base = e.target.value;
      renderControls(); render();
    } else if (e.target.id === 'mode') {
      state.mode = e.target.value;
      setCustom();
      renderControls();
      const m = document.getElementById('mode'); if (m) m.value = state.mode;
      render();
    }
  });

  controls.addEventListener('click', e => {
    if (e.target.id === 'tofail') { state.load = 100; syncKey('load'); render(); }
    else if (e.target.id === 'unload') { state.load = 0; syncKey('load'); render(); }
  });

  /* ---------- drag sigma1 along the axis to load the sample ---------- */
  let dragging = false;
  const grab = e => {
    const b = mohr.getBoundingClientRect();
    if (!b.width) return null;
    return (e.clientX - b.left) * (560 / b.width);
  };
  mohr.addEventListener('pointerdown', e => {
    const px = grab(e);
    if (px == null) return;
    dragging = true;
    try { mohr.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    applyDrag(px);
  });
  mohr.addEventListener('pointermove', e => {
    if (!dragging) return;
    const px = grab(e);
    if (px != null) applyDrag(px);
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    try { mohr.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  mohr.addEventListener('pointerup', endDrag);
  mohr.addEventListener('pointercancel', endDrag);

  /* the pointer sets sigma1, which sets the deviator, which sets the load level */
  function applyDrag(px) {
    const r = solveNow();
    const sMax0 = Math.max(r.tot.C + r.tot.R,
                           r.atFailure ? r.atFailure.C + r.atFailure.R : 0, r.s1, 50) * 1.14;
    const tNeed = Math.max(r.tot.R, r.atFailure ? r.atFailure.R : 0,
                           ShearEngine.tauF(r.c, r.phi, sMax0), 25) * 1.10;
    const k = Math.min(MW / sMax0, MH / tNeed);
    const sig = (px - ML) / k;
    const base = r.mode === 'uu' ? r.s3 : r.s3 - (r.u || 0);
    const sd = Math.max(0, sig - base);
    if (!isFinite(sd) || !r.ref) return;
    state.load = clamp(snap(sd / r.ref * 100, 1), 0, 120);
    syncKey('load');
    render();
  }

  /* ---------- boot ---------- */
  renderControls();
  render();
})();
