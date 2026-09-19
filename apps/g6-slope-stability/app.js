/* CivilLab · G6 Slope Stability, Method of Slices */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const tableWrap = document.getElementById('tablewrap');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const VW = 960, VH = 520;
  const FX0 = 44, FX1 = 916, FY0 = 40, FY1 = 424;
  const INSET_W = 210, INSET_H = 190;
  const RAD = Math.PI / 180;

  /* ---------- presets, factories so nothing is shared ---------- */
  const PRESETS = {
    cut:  { label:'Cutting in stiff clay',   f:()=>({ Hs:10, beta:30, gamma:19, c:10, phi:25, ru:0,
                                                      xc:8,  yc:18, R:20, n:24, method:'bishop', sel:8 }) },
    embk: { label:'Embankment, some seepage',f:()=>({ Hs:8,  beta:26, gamma:20, c:8,  phi:28, ru:0.3,
                                                      xc:7,  yc:15, R:17, n:24, method:'bishop', sel:8 }) },
    und:  { label:'Undrained clay, φu = 0',  f:()=>({ Hs:9,  beta:40, gamma:19, c:45, phi:0,  ru:0,
                                                      xc:7,  yc:16, R:18, n:24, method:'fellenius', sel:8 }) },
    marg: { label:'Marginal slope',          f:()=>({ Hs:12, beta:35, gamma:20, c:5,  phi:24, ru:0.35,
                                                      xc:9,  yc:19, R:20, n:24, method:'bishop', sel:8 }) }
  };

  const state = Object.assign({ preset:'cut', base:'cut', showSlices:true }, PRESETS.cut.f());

  const solveNow = () => SlopeEngine.solve({
    Hs: state.Hs, beta: state.beta, gamma: state.gamma, c: state.c, phi: state.phi,
    ru: state.ru, xc: state.xc, yc: state.yc, R: state.R, n: state.n, method: state.method });

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

  /* the view transform, recomputed each frame and cached for the pointer maths */
  let VIEW = { sc:1, ox:0, oy:0 };
  function setView() {
    const L = SlopeEngine.toeX(state.Hs, state.beta);
    const xmin = Math.min(-0.9 * state.Hs, state.xc - state.R);
    const xmax = Math.max(L + 1.1 * state.Hs, state.xc + state.R);
    const ymin = Math.min(-0.3 * state.Hs, state.yc - state.R);
    const ymax = Math.max(state.Hs * 1.25, state.yc + 0.12 * state.Hs);
    const sc = Math.min((FX1 - FX0) / (xmax - xmin), (FY1 - FY0) / (ymax - ymin));
    VIEW = { sc, ox: FX0 + ((FX1 - FX0) - (xmax - xmin) * sc) / 2 - xmin * sc,
             oy: FY1 - ((FY1 - FY0) - (ymax - ymin) * sc) / 2 + ymin * sc };
  }
  const SX = x => VIEW.ox + x * VIEW.sc;
  const SY = y => VIEW.oy - y * VIEW.sc;
  const invX = px => (px - VIEW.ox) / VIEW.sc;
  const invY = py => (VIEW.oy - py) / VIEW.sc;

  /* ---------- render ---------- */
  let last = null;

  function render() {
    const r = solveNow();
    last = r;
    setView();
    clearSvg(fig);
    fig.appendChild(s('defs', {},
      marker('gLoad', C.load), marker('gGrn', C.green, 5.5), marker('gWat', C.water, 5.5),
      s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse',
        patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.4 }))));

    fig.appendChild(txt(FX0, 22, 'Slope and slip circle',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    const L = SlopeEngine.toeX(state.Hs, state.beta);
    const xmin = invX(FX0), xmax = invX(FX1), ymin = invY(FY1);

    /* the ground */
    const gpts = [[xmin, state.Hs], [0, state.Hs], [L, 0], [xmax, 0]];
    fig.appendChild(s('polygon', {
      points: gpts.map(p => `${SX(p[0])},${SY(p[1])}`).join(' ') +
              ` ${SX(xmax)},${SY(ymin)} ${SX(xmin)},${SY(ymin)}`,
      fill:C.pale, 'fill-opacity':.22, stroke:'none' }));
    fig.appendChild(s('polyline', { points: gpts.map(p => `${SX(p[0])},${SY(p[1])}`).join(' '),
      fill:'none', stroke:C.ocean, 'stroke-width':2.2, 'stroke-linejoin':'round' }));
    /* the force polygon inset goes on whichever side the circle centre is not,
       and the crest label steps out of its way */
    const insetLeft = SX(state.xc) > VW / 2;
    const insetX = insetLeft ? FX0 + 18 : FX1 - 18 - INSET_W;
    fig.appendChild(txt(insetLeft ? insetX + INSET_W + 14 : SX(xmin) + 40,
      SY(state.Hs) - 10,
      `crest, H = ${fmt(state.Hs, 1)} m`, { an:'start', fs:11.5, fill:C.ocean, fw:600 }));
    fig.appendChild(txt(SX(L / 2) + 26, SY(state.Hs / 2) + 16, `β = ${fmt(state.beta, 0)}°`,
      { an:'start', fs:12, fw:600, fill:C.ocean }));

    if (!r.ok) {
      fig.appendChild(txt(VW / 2, VH / 2, r.why, { fs:14, fw:600, fill:C.load, halo:0 }));
      fig.appendChild(txt(VW / 2, VH / 2 + 22, 'drag the centre or change the radius',
        { fs:12, fill:C.muted, halo:0 }));
      tableWrap.innerHTML = '';
      resultsEl.innerHTML = '';
      return;
    }

    /* the sliding mass */
    const arcPts = [];
    for (let i = 0; i <= 80; i++) {
      const x = r.x1 + (r.x2 - r.x1) * i / 80;
      const dx = x - state.xc, q = state.R * state.R - dx * dx;
      arcPts.push([x, state.yc - Math.sqrt(Math.max(0, q))]);
    }
    const topPts = [];
    for (let i = 80; i >= 0; i--) {
      const x = r.x1 + (r.x2 - r.x1) * i / 80;
      topPts.push([x, SlopeEngine.ground(x, state.Hs, state.beta)]);
    }
    fig.appendChild(s('polygon', {
      points: arcPts.concat(topPts).map(p => `${SX(p[0])},${SY(p[1])}`).join(' '),
      fill:C.load, 'fill-opacity':.10, stroke:'none' }));

    /* the slices */
    if (state.showSlices) {
      for (const sl of r.slices) {
        const x0 = sl.x - sl.b / 2, x1 = sl.x + sl.b / 2;
        const b0 = state.yc - Math.sqrt(Math.max(0, state.R * state.R - (x0 - state.xc) ** 2));
        const b1 = state.yc - Math.sqrt(Math.max(0, state.R * state.R - (x1 - state.xc) ** 2));
        const t0 = SlopeEngine.ground(x0, state.Hs, state.beta);
        const t1 = SlopeEngine.ground(x1, state.Hs, state.beta);
        const on = sl.i === state.sel;
        const g = s('g', { 'data-slice':sl.i, style:'cursor:pointer' });
        g.appendChild(s('polygon', {
          points: `${SX(x0)},${SY(t0)} ${SX(x1)},${SY(t1)} ${SX(x1)},${SY(b1)} ${SX(x0)},${SY(b0)}`,
          fill: on ? C.load : '#fff', 'fill-opacity': on ? .30 : .01,
          stroke: on ? C.load : C.hair, 'stroke-width': on ? 2 : 0.9 }));
        fig.appendChild(g);
      }
    }

    /* the slip surface */
    fig.appendChild(s('polyline', {
      points: arcPts.map(p => `${SX(p[0])},${SY(p[1])}`).join(' '),
      fill:'none', stroke:C.load, 'stroke-width':2.8 }));

    /* the centre, draggable, with the radius arm */
    const cx = SX(state.xc), cy = SY(state.yc);
    fig.appendChild(line(cx, cy, SX(arcPts[0][0]), SY(arcPts[0][1]),
      { stroke:C.contour, 'stroke-width':1.2, 'stroke-dasharray':'5 4' }));
    fig.appendChild(line(cx, cy, SX(arcPts[arcPts.length - 1][0]), SY(arcPts[arcPts.length - 1][1]),
      { stroke:C.contour, 'stroke-width':1.2, 'stroke-dasharray':'5 4' }));
    const gc = s('g', { 'data-drag':'centre', style:'cursor:move' });
    gc.appendChild(s('circle', { cx, cy, r:16, fill:'transparent' }));
    gc.appendChild(s('circle', { cx, cy, r:6, fill:'#fff', stroke:C.ocean, 'stroke-width':2.2 }));
    gc.appendChild(line(cx - 11, cy, cx + 11, cy, { stroke:C.ocean, 'stroke-width':1.4 }));
    gc.appendChild(line(cx, cy - 11, cx, cy + 11, { stroke:C.ocean, 'stroke-width':1.4 }));
    fig.appendChild(gc);
    fig.appendChild(txt(cx, cy - 22, `O  (${fmt(state.xc, 1)}, ${fmt(state.yc, 1)})`,
      { fs:11, fw:600, fill:C.ocean }));

    /* a handle on the arc to change the radius */
    const hb = arcPts[Math.floor(arcPts.length / 2)];
    const gh = s('g', { 'data-drag':'radius', style:'cursor:ns-resize' });
    gh.appendChild(s('circle', { cx:SX(hb[0]), cy:SY(hb[1]), r:14, fill:'transparent' }));
    gh.appendChild(s('circle', { cx:SX(hb[0]), cy:SY(hb[1]), r:5.5, fill:C.load,
      stroke:'#fff', 'stroke-width':1.8 }));
    fig.appendChild(gh);
    fig.appendChild(txt(SX(hb[0]), SY(hb[1]) + 22, `R = ${fmt(state.R, 1)} m`,
      { fs:11, fw:600, fill:C.load }));

    drawPolygon(r, insetX);

    /* verdict */
    const F = r.F;
    const okF = F >= 1.5;
    fig.appendChild(txt(VW / 2, VH - 46,
      `F = Σ resisting / Σ W sin α = ${fmt(F, 3)}`,
      { fs:15, fw:600, fill: okF ? C.green : C.load, halo:0, head:true }));
    fig.appendChild(txt(VW / 2, VH - 24,
      okF ? 'at or above the usual design target of 1.5'
        : F >= 1 ? 'stable but below the usual design target of 1.5'
        : 'below 1.0, this circle fails',
      { fs:12, fw:600, fill: okF ? C.green : C.load, halo:0 }));

    drawTable(r);
    drawChips(r);
  }

  /* ---------- the force polygon for one slice ---------- */
  function drawPolygon(r, insetX) {
    const sl = r.slices.find(s2 => s2.i === state.sel) || r.slices[0];
    if (!sl) return;
    state.sel = sl.i;
    const F = r.F;
    const tp = Math.tan(clamp(state.phi, 0, 89) * RAD);
    const Nt = sl.W * Math.cos(sl.alpha);            // Fellenius normal
    const Ue = sl.u * sl.l;
    const Ne = Math.max(0, Nt - Ue);
    const T = (state.c * sl.l + Ne * tp) / (F > 1e-9 ? F : 1);

    const px = insetX, py = FY0 + 18, w = INSET_W, h = INSET_H;
    fig.appendChild(s('rect', { x:px, y:py, width:w, height:h, rx:8,
      fill:'#fff', 'fill-opacity':.94, stroke:C.hair, 'stroke-width':1 }));
    fig.appendChild(txt(px + 10, py + 18, `Slice ${sl.i + 1} of ${r.slices.length}`,
      { an:'start', fs:11.5, fw:600, fill:C.ocean, halo:0, head:true }));
    fig.appendChild(txt(px + w - 10, py + 18, `α = ${fmt(sl.alphaDeg, 1)}°`,
      { an:'end', fs:11, fw:600, fill: sl.alpha >= 0 ? C.load : C.green, halo:0 }));

    /* draw W down, then N normal to the base, then T along it. The triangle is
       measured first and then centred in the space above the value list, so it
       never runs into the header or out of the box. */
    const big = Math.max(sl.W, 1e-6);
    let sc = 56 / big;
    const a = sl.alpha;
    const nx = Math.sin(a), ny = Math.cos(a);        // unit normal to the base, upward
    const txv = Math.cos(a), tyv = -Math.sin(a);     // unit along the base, up-slope

    /* the polygon closes, so labelling the arrow tips piles them all on the
       same spot. Each label sits at its own vector's midpoint instead, pushed
       out along the perpendicular. */
    /* the three forces close into a triangle, so each label is pushed straight
       out from the triangle's centroid. That puts them on three different
       sides however squashed the triangle gets. */
    const AX0 = px + 14, AX1 = px + w - 14, AY0 = py + 28, AY1 = py + h - 74;
    const rel = () => {
      const a = [0, 0];
      const b = [a[0], a[1] + sl.W * sc];
      const c2 = [b[0] + Ne * sc * nx, b[1] - Ne * sc * ny];
      const d2 = [c2[0] + T * sc * txv, c2[1] + T * sc * tyv];
      return [a, b, c2, d2];
    };
    let pts = rel();
    const xsP = pts.map(p => p[0]), ysP = pts.map(p => p[1]);
    const bw = Math.max(1e-6, Math.max(...xsP) - Math.min(...xsP));
    const bh = Math.max(1e-6, Math.max(...ysP) - Math.min(...ysP));
    const fit = Math.min(1, (AX1 - AX0) / bw, (AY1 - AY0) / bh);
    if (fit < 1) { sc *= fit; pts = rel(); }
    const xs2 = pts.map(p => p[0]), ys2 = pts.map(p => p[1]);
    const tx0 = (AX0 + AX1) / 2 - (Math.min(...xs2) + Math.max(...xs2)) / 2;
    const ty0 = (AY0 + AY1) / 2 - (Math.min(...ys2) + Math.max(...ys2)) / 2;
    const P0 = [pts[0][0] + tx0, pts[0][1] + ty0];
    const P1 = [pts[1][0] + tx0, pts[1][1] + ty0];
    const P2 = [pts[2][0] + tx0, pts[2][1] + ty0];
    const P3 = [pts[3][0] + tx0, pts[3][1] + ty0];

    /* W and N' are both near vertical whenever alpha approaches zero, and their
       midpoints then coincide, so those two are pinned to opposite sides
       rather than trusting the centroid. T keeps the centroid rule. */
    /* No letters on the arrows. The triangle collapses onto a line whenever
       alpha approaches zero, and any label then lands on its neighbour. The
       value list below is coloured to match each arrow, which is the same
       colour to meaning mapping the rest of the suite uses. */
    const edge = (A, B, col, mk) =>
      fig.appendChild(line(A[0], A[1], B[0], B[1],
        { stroke:col, 'stroke-width':2.4, 'marker-end':`url(#${mk})` }));
    edge(P0, P1, C.load, 'gLoad');
    edge(P1, P2, C.green, 'gGrn');
    edge(P2, P3, C.water, 'gWat');

    const rows = [
      [`W = ${fmt(sl.W, 0)} kN`, C.load],
      [`N′ = W cos α − u·l = ${fmt(Ne, 0)} kN`, C.green],
      [`T = (c′l + N′tanφ′)/F = ${fmt(T, 0)} kN`, C.water],
      [`W sin α = ${fmt(sl.W * Math.sin(sl.alpha), 0)} kN`, C.muted]
    ];
    rows.forEach((rw, k) =>
      fig.appendChild(txt(px + 10, py + h - 58 + k * 14, rw[0],
        { an:'start', fs:10, fill:rw[1], halo:0 })));
  }

  /* ---------- the slice table ---------- */
  function drawTable(r) {
    const tp = Math.tan(clamp(state.phi, 0, 89) * RAD);
    const th = 'text-align:right;padding:5px 8px;border-bottom:1px solid #DFE3DC;' +
      'font-weight:600;color:#5C6A72;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase';
    const td = 'text-align:right;padding:3px 8px;font-variant-numeric:tabular-nums';
    let h = '<div style="font-family:Poppins,Inter,sans-serif;font-weight:600;color:#14416B;' +
      'font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">' +
      'Method of slices, Fellenius terms (kN per metre run)</div>';
    h += `<table style="border-collapse:collapse;font-size:12.5px;width:100%;min-width:560px"><thead><tr>
      <th style="${th};text-align:left">Slice</th><th style="${th}">b (m)</th>
      <th style="${th}">h (m)</th><th style="${th}">W</th><th style="${th}">α (°)</th>
      <th style="${th}">l (m)</th><th style="${th}">u·l</th>
      <th style="${th}">c′l + N′tanφ′</th><th style="${th}">W sin α</th></tr></thead><tbody>`;
    let sumR = 0, sumD = 0;
    const step = r.slices.length > 14 ? Math.ceil(r.slices.length / 14) : 1;
    for (const sl of r.slices) {
      const N = sl.W * Math.cos(sl.alpha), Ue = sl.u * sl.l;
      const res = state.c * sl.l + Math.max(0, N - Ue) * tp;
      const dis = sl.W * Math.sin(sl.alpha);
      sumR += res; sumD += dis;
      if (sl.i % step !== 0 && sl.i !== r.slices.length - 1) continue;
      const on = sl.i === state.sel;
      const bold = on ? 'font-weight:600;color:#B03A2E;' : '';
      h += `<tr><td style="${td};text-align:left;${bold}">${sl.i + 1}</td>
        <td style="${td};${bold}">${fmt(sl.b, 2)}</td><td style="${td};${bold}">${fmt(sl.h, 2)}</td>
        <td style="${td};${bold}">${fmt(sl.W, 0)}</td><td style="${td};${bold}">${fmt(sl.alphaDeg, 1)}</td>
        <td style="${td};${bold}">${fmt(sl.l, 2)}</td><td style="${td};${bold}">${fmt(Ue, 0)}</td>
        <td style="${td};${bold}">${fmt(res, 0)}</td><td style="${td};${bold}">${fmt(dis, 0)}</td></tr>`;
    }
    h += `<tr><td style="${td};text-align:left;font-weight:600;border-top:2px solid #14416B">Σ</td>
      <td style="${td};border-top:2px solid #14416B"></td><td style="${td};border-top:2px solid #14416B"></td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600">${fmt(r.W, 0)}</td>
      <td style="${td};border-top:2px solid #14416B"></td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600">${fmt(r.arc, 2)}</td>
      <td style="${td};border-top:2px solid #14416B"></td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600;color:#2E6B4F">${fmt(sumR, 0)}</td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600;color:#B03A2E">${fmt(sumD, 0)}</td></tr>`;
    h += '</tbody></table>';
    h += `<div style="margin-top:9px;font-size:12.5px;color:#41505A">
      Fellenius F = ${fmt(sumR, 0)} / ${fmt(sumD, 0)} = <strong>${fmt(r.Fel, 3)}</strong>.
      Bishop keeps vertical equilibrium of each slice and iterates to
      <strong>${fmt(r.Bis, 3)}</strong> after ${r.bisIters} passes.
      ${r.slices.length > 14 ? 'Every ' + step + 'th slice is listed, the sums cover all ' + r.slices.length + '.' : ''}
      </div>`;
    tableWrap.innerHTML = h;
  }

  /* ---------- results chips ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function drawChips(r) {
    const F = r.F;
    resultsEl.innerHTML =
      chip('F, Bishop', fmt(r.Bis, 3), `${r.bisIters} iterations`,
           r.Bis >= 1.5 ? 'ok' : 'warn') +
      chip('F, Fellenius', fmt(r.Fel, 3), 'ignores interslice forces') +
      chip('Bishop gain', `${fmt((r.Bis / r.Fel - 1) * 100, 1)} %`, 'over Fellenius') +
      chip('Sliding weight', `${fmt(r.W, 0)} kN/m`, 'of the mass above the circle') +
      chip('Σ W sin α', `${fmt(r.disturbing, 0)} kN/m`, 'the disturbing sum', 'warn') +
      chip('Arc length', `${fmt(r.arc, 2)} m`, `${r.slices.length} slices`) +
      chip('Slip exits at', `${fmt(r.x2, 1)} m`, `enters at ${fmt(r.x1, 1)} m`) +
      chip('Verdict', F >= 1.5 ? 'Safe' : F >= 1 ? 'Marginal' : 'Fails',
           'design target F ≥ 1.5', F >= 1.5 ? 'ok' : 'warn');
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
      <h3>Slope</h3>
      ${row('Hs', 'Height H (m)', 2, 25, 0.5, state.Hs)}
      ${row('beta', 'Face angle β (°)', 10, 70, 1, state.beta)}
      ${row('gamma', 'Unit weight γ (kN/m³)', 14, 24, 0.5, state.gamma)}
      <h3>Strength</h3>
      ${row('c', "Cohesion c′ (kPa)", 0, 80, 1, state.c)}
      ${row('phi', "Friction φ′ (°)", 0, 45, 1, state.phi)}
      ${row('ru', 'Pore pressure ratio ru', 0, 0.6, 0.05, state.ru)}
      <h3>Slip circle</h3>
      ${row('xc', 'Centre x (m)', -20, 50, 0.5, state.xc)}
      ${row('yc', 'Centre y (m)', 2, 60, 0.5, state.yc)}
      ${row('R', 'Radius R (m)', 3, 70, 0.5, state.R)}
      ${row('n', 'Number of slices', 5, 60, 1, state.n)}
      <div class="ctl"><select id="method">
        <option value="bishop"${state.method === 'bishop' ? ' selected' : ''}>Bishop simplified</option>
        <option value="fellenius"${state.method === 'fellenius' ? ' selected' : ''}>Fellenius, ordinary</option>
      </select></div>
      <div class="addrow">
        <button class="btn small" id="crit">Find the critical circle</button>
      </div>
      <label class="chk"><input type="checkbox" id="showSlices"${state.showSlices ? ' checked' : ''}>
        <span>Draw the slices</span></label>`;
  }

  const LIM = { Hs:[2,25], beta:[10,70], gamma:[14,24], c:[0,80], phi:[0,45],
                ru:[0,0.6], xc:[-20,50], yc:[2,60], R:[3,70], n:[5,60] };
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
    setCustom();
    render();
  });

  controls.addEventListener('change', e => {
    if (e.target.id === 'preset') {
      const p = PRESETS[e.target.value];
      if (!p) { state.preset = ''; return; }
      Object.assign(state, p.f());
      state.preset = state.base = e.target.value;
      renderControls(); render();
    } else if (e.target.id === 'method') {
      state.method = e.target.value;
      setCustom(); renderControls();
      const m = document.getElementById('method'); if (m) m.value = state.method;
      render();
    } else if (e.target.id === 'showSlices') {
      state.showSlices = e.target.checked;
      render();
    }
  });

  controls.addEventListener('click', e => {
    if (e.target.id !== 'crit') return;
    const best = SlopeEngine.critical({
      Hs: state.Hs, beta: state.beta, gamma: state.gamma, c: state.c, phi: state.phi,
      ru: state.ru, n: state.n, method: state.method }, { nx:11, ny:9, nr:7 });
    if (!best) return;
    state.xc = +best.xc.toFixed(2);
    state.yc = +best.yc.toFixed(2);
    state.R = +best.R.toFixed(2);
    setCustom();
    for (const k of ['xc', 'yc', 'R']) syncKey(k);
    render();
  });

  /* ---------- drag the circle, click a slice ---------- */
  let drag = null, grab = null;
  const findAttr = (el, attr) => {
    while (el && el !== fig) {
      if (el.getAttribute && el.getAttribute(attr) != null) return el.getAttribute(attr);
      el = el.parentNode;
    }
    return null;
  };
  const figXY = e => {
    const b = fig.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    return [(e.clientX - b.left) * (VW / b.width), (e.clientY - b.top) * (VH / b.height)];
  };

  fig.addEventListener('pointerdown', e => {
    const d = findAttr(e.target, 'data-drag');
    if (d) {
      const p = figXY(e);
      if (!p) return;
      drag = d;
      grab = { x: invX(p[0]), y: invY(p[1]), xc: state.xc, yc: state.yc, R: state.R };
      try { fig.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
      return;
    }
    const sl = findAttr(e.target, 'data-slice');
    if (sl != null) { state.sel = +sl; render(); }
  });

  fig.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = figXY(e);
    if (!p) return;
    const x = invX(p[0]), y = invY(p[1]);
    if (drag === 'centre') {
      state.xc = clamp(snap(grab.xc + (x - grab.x), 0.5), LIM.xc[0], LIM.xc[1]);
      state.yc = clamp(snap(grab.yc + (y - grab.y), 0.5), LIM.yc[0], LIM.yc[1]);
      syncKey('xc'); syncKey('yc');
    } else {
      const d = Math.hypot(x - state.xc, y - state.yc);
      state.R = clamp(snap(d, 0.5), LIM.R[0], LIM.R[1]);
      syncKey('R');
    }
    setCustom();
    render();
  });
  const endDrag = e => {
    if (!drag) return;
    drag = null;
    try { fig.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  fig.addEventListener('pointerup', endDrag);
  fig.addEventListener('pointercancel', endDrag);

  /* ---------- boot ---------- */
  renderControls();
  render();
})();
