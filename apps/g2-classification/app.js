/* CivilLab · G2 Particle Size and Soil Classification */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const grade = document.getElementById('grade');
  const plast = document.getElementById('plast');
  const controls = document.getElementById('controls');
  const tableWrap = document.getElementById('tablewrap');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const STACK = SoilClassEngine.STACK;
  const N = STACK.length;

  /* ---------- presets, factories so nothing is shared ---------- */
  const PRESETS = {
    sw:   { label:'Well-graded sand · SW',        f:()=>({ pass:[100,100,100,100,95,84,65,33,22,10,3],   LL:24, PL:20 }) },
    sp:   { label:'Uniform sand · SP',            f:()=>({ pass:[100,100,100,100,100,100,95,70,20,5,2],  LL:0,  PL:0  }) },
    gw:   { label:'Sandy gravel · GW',            f:()=>({ pass:[100,100,92,70,44,30,22,15,9,6,4],       LL:0,  PL:0  }) },
    spsm: { label:'Sand with a little silt · SP-SM', f:()=>({ pass:[100,100,100,100,100,98,95,70,20,11,8], LL:24, PL:21 }) },
    sm:   { label:'Silty sand · SM',              f:()=>({ pass:[100,100,100,100,98,92,84,72,55,38,26],  LL:25, PL:22 }) },
    sc:   { label:'Clayey sand · SC',             f:()=>({ pass:[100,100,100,100,98,92,84,72,55,38,26],  LL:35, PL:20 }) },
    cl:   { label:'Lean clay with sand · CL',     f:()=>({ pass:[100,100,100,100,100,99,98,96,93,88,82], LL:42, PL:22 }) },
    ch:   { label:'Fat clay · CH',                f:()=>({ pass:[100,100,100,100,100,100,100,99,98,97,95], LL:68, PL:28 }) }
  };

  /* preset is what the select shows and goes blank on any manual edit.
     base remembers where the sample came from, so Reset returns to it. */
  const state = Object.assign({ preset:'sw', base:'sw', showD:true, showBands:true }, PRESETS.sw.f());

  const points = () => STACK.map((sv, i) => ({ d: sv.d, pass: state.pass[i] }));

  /* percent passing must fall as the sieve gets finer, index 0 is the coarsest */
  function setPass(j, v) {
    if (!isFinite(v)) return;
    const hi = j > 0 ? state.pass[j - 1] : 100;
    const lo = j < N - 1 ? state.pass[j + 1] : 0;
    state.pass[j] = clamp(+snap(v, 0.1).toFixed(1), lo, hi);
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
  const clearSvg = el => { while (el.firstChild) el.removeChild(el.firstChild); };

  /* =====================================================================
     Figure 1 · grading curve, percent passing against log particle size
     ===================================================================== */
  const GL = 54, GR = 462, GT = 64, GB = 372, GVH = 430;
  const LOGMIN = -2, DECADES = 4;                 // 0.01 mm to 100 mm
  const L10 = x => Math.log(x) / Math.LN10;
  const X = d => GL + (L10(d) - LOGMIN) / DECADES * (GR - GL);
  const Y = P => GB - P / 100 * (GB - GT);
  const invY = py => (GB - py) / (GB - GT) * 100;

  function drawGrading(r) {
    const g = r.g;
    clearSvg(grade);
    grade.appendChild(txt(GL - 6, 22, 'Grading curve', { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));
    grade.appendChild(txt(GR, 22, 'drag any point', { an:'end', fs:11, fill:C.muted, halo:0 }));

    /* size bands across the top */
    if (state.showBands) {
      const bands = [
        [GL, X(0.075), 'Fines', .22],
        [X(0.075), X(4.75), 'Sand', .40],
        [X(4.75), GR, 'Gravel', .62]
      ];
      for (const [x1, x2, lab, op] of bands) {
        grade.appendChild(s('rect', { x:x1, y:38, width:Math.max(0, x2 - x1), height:18,
          fill:C.pale, 'fill-opacity':op, stroke:C.hair, 'stroke-width':1 }));
        if (x2 - x1 > 34) grade.appendChild(txt((x1 + x2) / 2, 51, lab,
          { fs:10.5, fw:600, fill:C.ocean, halo:0 }));
      }
      for (const d of [0.075, 4.75])
        grade.appendChild(line(X(d), GT, X(d), GB,
          { stroke:C.contour, 'stroke-width':1.2, 'stroke-dasharray':'4 4' }));
    }

    /* grid */
    for (let P = 0; P <= 100; P += 10)
      grade.appendChild(line(GL, Y(P), GR, Y(P),
        Object.assign({ stroke:C.hair, 'stroke-width':1 },
          P % 20 === 0 ? {} : { 'stroke-opacity':.55 })));
    for (let e = LOGMIN; e <= LOGMIN + DECADES; e++) {
      const d = Math.pow(10, e);
      grade.appendChild(line(X(d), GT, X(d), GB, { stroke:C.hair, 'stroke-width':1 }));
      for (let m = 2; m <= 9 && e < LOGMIN + DECADES; m++)
        grade.appendChild(line(X(m * d), GB, X(m * d), GB - 4, { stroke:C.axis, 'stroke-width':.8 }));
    }

    /* axes */
    grade.appendChild(line(GL, GT, GL, GB, { stroke:C.axis, 'stroke-width':1.4 }));
    grade.appendChild(line(GL, GB, GR, GB, { stroke:C.axis, 'stroke-width':1.4 }));
    for (let e = LOGMIN; e <= LOGMIN + DECADES; e++) {
      const d = Math.pow(10, e);
      grade.appendChild(txt(X(d), GB + 17, d >= 1 ? String(d) : String(d).replace('0.', '.'),
        { fs:11, halo:0 }));
    }
    for (let P = 0; P <= 100; P += 20)
      grade.appendChild(txt(GL - 8, Y(P) + 4, String(P), { an:'end', fs:11, halo:0 }));
    grade.appendChild(txt((GL + GR) / 2, GB + 40, 'Particle size d (mm), log scale', { fs:11.5, halo:0 }));
    grade.appendChild(txt(15, (GT + GB) / 2, 'Percent passing (%)', { fs:11.5, halo:0, rot:-90 }));

    /* the dashed tail below the finest sieve, where sieving cannot reach */
    const fin = g.fines;
    grade.appendChild(line(X(0.075), Y(fin), GL, Y(0),
      { stroke:C.ocean, 'stroke-width':1.6, 'stroke-dasharray':'3 4', 'stroke-opacity':.55 }));
    if (fin > 4) grade.appendChild(txt((GL + X(0.075)) / 2, Y(fin / 2) - 6, 'hydrometer range',
      { fs:9.5, fill:C.muted, halo:2.5 }));

    /* the curve itself */
    const asc = points().slice().sort((a, b) => a.d - b.d);
    grade.appendChild(s('polyline', {
      points: asc.map(p => `${X(p.d)},${Y(p.pass)}`).join(' '),
      fill:'none', stroke:C.ocean, 'stroke-width':2.2,
      'stroke-linejoin':'round', 'stroke-linecap':'round' }));

    /* D10, D30 and D60 read off the curve */
    if (state.showD) {
      for (const P of [60, 30, 10]) {
        const d = g.dAt(P);
        if (d == null) continue;
        grade.appendChild(line(GL, Y(P), X(d), Y(P),
          { stroke:C.green, 'stroke-width':1.2, 'stroke-dasharray':'5 4' }));
        grade.appendChild(line(X(d), Y(P), X(d), GB,
          { stroke:C.green, 'stroke-width':1.2, 'stroke-dasharray':'5 4' }));
        grade.appendChild(s('circle', { cx:X(d), cy:Y(P), r:3.4, fill:C.green }));
        grade.appendChild(txt(GL + 6, Y(P) - 6, `D${P} = ${dfmt(d)} mm`,
          { an:'start', fs:10.5, fw:600, fill:C.green }));
      }
    }

    /* draggable sieve points */
    for (let i = 0; i < N; i++) {
      const px = X(STACK[i].d), py = Y(state.pass[i]);
      const grp = s('g', { 'data-i':i, style:'cursor:ns-resize' });
      grp.appendChild(s('circle', { cx:px, cy:py, r:11, fill:'transparent' }));
      grp.appendChild(s('circle', { cx:px, cy:py, r:4.2, fill:'#fff',
        stroke:C.ocean, 'stroke-width':1.8 }));
      grade.appendChild(grp);
    }
  }

  /* =====================================================================
     Figure 2 · Casagrande plasticity chart
     ===================================================================== */
  const PXL = 58, PXR = 520, PYT = 56, PYB = 352, PVH = 430;
  const LLMAX = 100, PIMAX = 60;
  const PX = LL => PXL + LL / LLMAX * (PXR - PXL);
  const PY = PI => PYB - PI / PIMAX * (PYB - PYT);
  const invPX = px => (px - PXL) / (PXR - PXL) * LLMAX;
  const invPY = py => (PYB - py) / (PYB - PYT) * PIMAX;

  function drawPlasticity(r) {
    const at = r.at, g = r.g;
    clearSvg(plast);
    plast.appendChild(s('defs', {},
      s('pattern', { id:'clml', width:6, height:6, patternUnits:'userSpaceOnUse',
        patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:6, stroke:C.contour, 'stroke-width':1.8 }))));

    plast.appendChild(txt(PXL - 6, 22, 'Casagrande plasticity chart',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));
    plast.appendChild(txt(PXR, 22,
      g.fines >= 50 ? 'this chart sets the symbol'
        : g.fines > 12 ? 'this chart sets the second letter'
        : g.fines >= 5 ? 'this chart sets the second symbol'
        : 'fines under 5 %, chart not used',
      { an:'end', fs:11, fill: g.fines >= 5 ? C.ocean : C.muted, halo:0 }));

    /* grid */
    for (let v = 0; v <= LLMAX; v += 10)
      plast.appendChild(line(PX(v), PYT, PX(v), PYB,
        { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.6 }));
    for (let v = 0; v <= PIMAX; v += 10)
      plast.appendChild(line(PXL, PY(v), PXR, PY(v),
        { stroke:C.hair, 'stroke-width':1, 'stroke-opacity':.6 }));

    /* CL-ML band, bounded by PI = 4, PI = 7, the A line and the U line */
    const aAt = PI => 20 + PI / 0.73, uAt = PI => 8 + PI / 0.9;
    plast.appendChild(s('polygon', {
      points: [[uAt(4),4],[aAt(4),4],[aAt(7),7],[uAt(7),7]]
        .map(p => `${PX(p[0])},${PY(p[1])}`).join(' '),
      fill:'url(#clml)', stroke:C.contour, 'stroke-width':1.2 }));

    /* LL = 50 divider */
    plast.appendChild(line(PX(50), PYT, PX(50), PYB,
      { stroke:C.contour, 'stroke-width':1.4, 'stroke-dasharray':'6 4' }));
    plast.appendChild(txt(PX(50), PYT - 6, 'LL = 50', { fs:10.5, fill:C.muted, halo:0 }));

    /* U line, then the A line on top */
    plast.appendChild(line(PX(8), PY(0), PX(uAt(PIMAX)), PY(PIMAX),
      { stroke:C.axis, 'stroke-width':1.6, 'stroke-dasharray':'7 4' }));
    plast.appendChild(line(PX(20), PY(0), PX(LLMAX), PY(SoilClassEngine.aLine(LLMAX)),
      { stroke:C.ocean, 'stroke-width':2.2 }));

    /* legend, tucked in the corner that no real soil can reach */
    const lg = (i, col, dash, label) => {
      const y = PYT + 14 + i * 16;
      plast.appendChild(line(PXL + 8, y, PXL + 30, y,
        Object.assign({ stroke:col, 'stroke-width':2 }, dash ? { 'stroke-dasharray':'7 4' } : {})));
      plast.appendChild(txt(PXL + 36, y + 4, label, { an:'start', fs:10.5, halo:2.5 }));
    };
    lg(0, C.ocean, false, 'A line   PI = 0.73 (LL − 20)');
    lg(1, C.axis, true, 'U line   PI = 0.9 (LL − 8)');

    /* axes */
    plast.appendChild(line(PXL, PYT, PXL, PYB, { stroke:C.axis, 'stroke-width':1.4 }));
    plast.appendChild(line(PXL, PYB, PXR, PYB, { stroke:C.axis, 'stroke-width':1.4 }));
    for (let v = 0; v <= LLMAX; v += 10)
      plast.appendChild(txt(PX(v), PYB + 17, String(v), { fs:11, halo:0 }));
    for (let v = 0; v <= PIMAX; v += 10)
      plast.appendChild(txt(PXL - 8, PY(v) + 4, String(v), { an:'end', fs:11, halo:0 }));
    plast.appendChild(txt((PXL + PXR) / 2, PYB + 40, 'Liquid limit LL (%)', { fs:11.5, halo:0 }));
    plast.appendChild(txt(16, (PYT + PYB) / 2, 'Plasticity index PI (%)', { fs:11.5, halo:0, rot:-90 }));

    /* zone labels */
    const zone = (LL, PI, lab) => plast.appendChild(
      txt(PX(LL), PY(PI), lab, { fs:14, fw:600, fill:C.ocean, halo:3.5, head:true }));
    zone(40, 30, 'CL');  zone(42, 7, 'ML');
    zone(68, 48, 'CH');  zone(78, 22, 'MH');
    plast.appendChild(line(PX(17), PY(14), PX(21.5), PY(6),
      { stroke:C.axis, 'stroke-width':1 }));
    plast.appendChild(txt(PX(15), PY(16), 'CL-ML', { fs:11.5, fw:600, fill:C.muted, halo:3 }));

    /* the sample */
    const sx = PX(clamp(at.LL, 0, LLMAX)), sy = PY(clamp(at.PI, 0, PIMAX));
    plast.appendChild(line(PXL, sy, sx, sy, { stroke:C.load, 'stroke-width':1,
      'stroke-dasharray':'4 4', 'stroke-opacity':.7 }));
    plast.appendChild(line(sx, sy, sx, PYB, { stroke:C.load, 'stroke-width':1,
      'stroke-dasharray':'4 4', 'stroke-opacity':.7 }));
    const pt = s('g', { 'data-p':'sample', style:'cursor:grab' });
    pt.appendChild(s('circle', { cx:sx, cy:sy, r:18, fill:'transparent' }));
    pt.appendChild(s('circle', { cx:sx, cy:sy, r:11, fill:C.load, 'fill-opacity':.14 }));
    pt.appendChild(s('circle', { cx:sx, cy:sy, r:6, fill:C.load, stroke:'#fff', 'stroke-width':1.6 }));
    plast.appendChild(pt);
    plast.appendChild(txt(sx + (at.LL > 70 ? -14 : 14), sy - 12,
      `LL ${fmt(at.LL, 0)}, PI ${fmt(at.PI, 0)}`,
      { an: at.LL > 70 ? 'end' : 'start', fs:11, fw:600, fill:C.load }));

    /* verdict line under the plot */
    plast.appendChild(txt((PXL + PXR) / 2, PVH - 12,
      at.PI <= 0 ? 'PI = 0, the fines are non plastic'
        : `PI ${fmt(at.PI, 1)} against the A line at ${fmt(at.A, 1)}, so the fines plot as ${at.fine}`,
      { fs:11.5, fw:600, fill: at.above ? C.ocean : C.midblue, halo:0 }));
    if (at.aboveU)
      plast.appendChild(txt(PXL, PYT - 6, 'above the U line, recheck the limits',
        { an:'start', fs:11, fw:600, fill:C.load, halo:0 }));
  }

  /* =====================================================================
     Sieve table and the decision trail
     ===================================================================== */
  const retained = j => (j === 0 ? 100 : state.pass[j - 1]) - state.pass[j];
  const fracText = r => `Gravel ${fmt(r.g.gravel, 1)} %  ·  Sand ${fmt(r.g.sand, 1)} %  ·  ` +
    `Fines ${fmt(r.g.fines, 1)} %` + (r.g.cobbles > 0.05 ? `  ·  Cobbles ${fmt(r.g.cobbles, 1)} %` : '');

  let tableBuilt = false;

  function tableHTML(r) {
    const th = 'text-align:right;padding:5px 8px;border-bottom:1px solid #DFE3DC;' +
      'font-weight:600;color:#5C6A72;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase';
    const td = 'text-align:right;padding:3px 8px;font-variant-numeric:tabular-nums';
    const tdTop = td + ';border-top:1px solid #DFE3DC';
    let h = '<div style="font-family:Poppins,Inter,sans-serif;font-weight:600;color:#14416B;' +
      'font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Sieve analysis</div>';
    h += `<table style="border-collapse:collapse;font-size:12.5px;width:100%;min-width:430px"><thead><tr>
      <th style="${th};text-align:left">Sieve</th>
      <th style="${th}">d (mm)</th>
      <th style="${th}">% passing</th>
      <th style="${th}">% retained</th>
      <th style="${th}">Cum. % retained</th></tr></thead><tbody>`;
    for (let j = 0; j < N; j++) {
      h += `<tr>
        <td style="${td};text-align:left">${STACK[j].tag}</td>
        <td style="${td};color:#5C6A72">${STACK[j].d}</td>
        <td style="${td}"><input type="number" id="sv${j}" data-j="${j}" min="0" max="100" step="0.5"
             value="${fmt(state.pass[j], 1)}" style="width:76px;text-align:right"></td>
        <td style="${td}" id="rt${j}">${fmt(retained(j), 1)}</td>
        <td style="${td}" id="cu${j}">${fmt(100 - state.pass[j], 1)}</td></tr>`;
    }
    h += `<tr><td style="${tdTop};text-align:left;color:#5C6A72">Pan, finer than 75 µm</td>
      <td style="${tdTop}"></td><td style="${tdTop}">0.0</td>
      <td style="${tdTop}" id="panret">${fmt(state.pass[N - 1], 1)}</td>
      <td style="${tdTop}">100.0</td></tr>`;
    h += '</tbody></table>';
    h += `<div id="fracline" style="margin-top:9px;font-size:12.5px;font-weight:600;color:#14416B">${fracText(r)}</div>`;
    h += `<div id="trail" style="margin-top:10px">${trailHTML(r)}</div>`;
    return h;
  }

  function trailHTML(r) {
    let h = '<div style="font-family:Poppins,Inter,sans-serif;font-weight:600;color:#14416B;' +
      'font-size:11px;letter-spacing:.06em;text-transform:uppercase">How the group symbol was reached</div>';
    h += '<ol style="margin:6px 0 0;padding-left:18px;font-size:12.5px;color:#41505A">';
    for (const st of r.steps) h += `<li style="margin:3px 0">${st}</li>`;
    h += `<li style="margin:3px 0">The group is <strong>${r.symbol}</strong>, ${r.name.toLowerCase()}.</li>`;
    h += '</ol>';
    for (const n of r.notes)
      h += `<div style="margin-top:6px;font-size:12px;color:#B03A2E">${n}</div>`;
    return h;
  }

  function drawTable(r, rebuild) {
    if (!tableBuilt || rebuild) { tableWrap.innerHTML = tableHTML(r); tableBuilt = true; return; }
    for (let j = 0; j < N; j++) {
      const inp = document.getElementById('sv' + j);
      if (inp && document.activeElement !== inp) inp.value = fmt(state.pass[j], 1);
      const rt = document.getElementById('rt' + j); if (rt) rt.textContent = fmt(retained(j), 1);
      const cu = document.getElementById('cu' + j); if (cu) cu.textContent = fmt(100 - state.pass[j], 1);
    }
    const pr = document.getElementById('panret'); if (pr) pr.textContent = fmt(state.pass[N - 1], 1);
    const fl = document.getElementById('fracline'); if (fl) fl.textContent = fracText(r);
    const tr = document.getElementById('trail'); if (tr) tr.innerHTML = trailHTML(r);
  }

  /* ---------- results chips ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  const dfmt = v => v == null ? '–' : (v >= 10 ? fmt(v, 1) : v >= 1 ? fmt(v, 2) : fmt(v, 3));

  function drawChips(r) {
    const g = r.g, at = r.at;
    const isG = r.group === 'coarse' && g.gravel > g.sand;
    const cuLimit = isG ? 4 : 6;
    const cuOk = r.group === 'coarse' && g.Cu != null && g.Cu >= cuLimit;
    const ccOk = r.group === 'coarse' && g.Cc != null && g.Cc >= 1 && g.Cc <= 3;
    let h =
      chip('D10', dfmt(g.D10) + ' mm', g.D10 == null ? 'below the 75 µm sieve' : 'effective size') +
      chip('D30', dfmt(g.D30) + ' mm', '30 % passing') +
      chip('D60', dfmt(g.D60) + ' mm', '60 % passing') +
      chip('Cu', g.Cu == null ? '–' : fmt(g.Cu, 2), `D60/D10, needs ≥ ${cuLimit}`, cuOk ? 'ok' : '') +
      chip('Cc', g.Cc == null ? '–' : fmt(g.Cc, 2), 'D30²/(D10 D60), needs 1 to 3', ccOk ? 'ok' : '') +
      chip('Gravel', fmt(g.gravel, 1) + ' %', '75 to 4.75 mm') +
      chip('Sand', fmt(g.sand, 1) + ' %', '4.75 to 0.075 mm') +
      chip('Fines', fmt(g.fines, 1) + ' %', 'finer than 75 µm', g.fines >= 50 ? 'warn' : '');
    if (g.cobbles > 0.05) h += chip('Cobbles', fmt(g.cobbles, 1) + ' %', 'coarser than 75 mm', 'warn');
    h += chip('PI', fmt(at.PI, 1), `LL ${fmt(at.LL, 0)} − PL ${fmt(at.PL, 0)}`, at.valid ? '' : 'warn') +
      chip('USCS group', r.symbol, r.name, 'ok');
    resultsEl.innerHTML = h;
  }

  /* ---------- render ---------- */
  function render(rebuildTable) {
    const r = SoilClassEngine.classify(points(), state.LL, state.PL);
    drawGrading(r);
    drawPlasticity(r);
    drawTable(r, rebuildTable);
    drawChips(r);
    const pn = document.getElementById('piNote');
    if (pn) pn.textContent = `PI = LL − PL = ${fmt(state.LL - state.PL, 0)}` +
      (state.PL > state.LL ? '  (PL is above LL)' : '');
  }

  /* ---------- controls ---------- */
  function renderControls() {
    const opts = Object.entries(PRESETS)
      .map(([k, p]) => `<option value="${k}"${k === state.preset ? ' selected' : ''}>${p.label}</option>`).join('');
    const row = (id, lab, min, max, st, val) => `<div class="ctl"><label for="${id}n">${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    controls.innerHTML = `
      <h3>Sample</h3>
      <div class="ctl"><select id="preset"><option value="">Custom</option>${opts}</select></div>
      <h3>Atterberg limits</h3>
      ${row('LL', 'Liquid limit LL (%)', 0, 100, 1, state.LL)}
      ${row('PL', 'Plastic limit PL (%)', 0, 60, 1, state.PL)}
      <div id="piNote" style="font-size:12.5px;font-weight:600;color:#14416B;margin:2px 0 4px"></div>
      <h3>Figure</h3>
      <label class="chk"><input type="checkbox" id="showD"${state.showD ? ' checked' : ''}>
        <span>Show the D10, D30 and D60 read-offs</span></label>
      <label class="chk"><input type="checkbox" id="showBands"${state.showBands ? ' checked' : ''}>
        <span>Show the gravel, sand and fines bands</span></label>
      <div class="addrow"><button class="btn ghost small" id="reset">Reset the sample</button></div>`;
  }

  const LIM = { LL:[0, 100], PL:[0, 60] };
  const setCustom = () => {
    state.preset = '';
    const el = document.getElementById('preset');
    if (el) el.value = '';
  };
  function syncLimits() {
    for (const k of ['LL', 'PL'])
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
      renderControls();
      render(true);
    } else if (e.target.id === 'showD' || e.target.id === 'showBands') {
      state[e.target.id] = e.target.checked;
      render();
    }
  });

  controls.addEventListener('click', e => {
    if (e.target.id !== 'reset') return;
    if (!PRESETS[state.base]) state.base = 'sw';
    Object.assign(state, PRESETS[state.base].f());
    state.preset = state.base;
    renderControls();
    render(true);
  });

  /* sieve inputs live in the table below the figures */
  tableWrap.addEventListener('input', e => {
    const j = e.target.dataset && e.target.dataset.j;
    if (j == null) return;
    const v = parseFloat(e.target.value);
    if (isNaN(v)) return;
    setPass(+j, v);
    setCustom();
    render();
  });

  /* ---------- dragging the grading curve ---------- */
  let dragI = -1;
  const closestG = (el, attr) => {
    while (el && el !== grade && el !== plast) {
      if (el.getAttribute && el.getAttribute(attr) != null) return el;
      el = el.parentNode;
    }
    return null;
  };
  grade.addEventListener('pointerdown', e => {
    const g = closestG(e.target, 'data-i');
    if (!g) return;
    dragI = +g.getAttribute('data-i');
    try { grade.setPointerCapture(e.pointerId); } catch (_) {}
    setCustom();
    e.preventDefault();
  });
  grade.addEventListener('pointermove', e => {
    if (dragI < 0) return;
    const b = grade.getBoundingClientRect();
    if (!b.height) return;
    setPass(dragI, invY((e.clientY - b.top) * (GVH / b.height)));
    render();
  });
  const endGrade = e => {
    if (dragI < 0) return;
    dragI = -1;
    try { grade.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  grade.addEventListener('pointerup', endGrade);
  grade.addEventListener('pointercancel', endGrade);

  /* ---------- dragging the plasticity sample ---------- */
  let dragP = false;
  plast.addEventListener('pointerdown', e => {
    if (!closestG(e.target, 'data-p')) return;
    dragP = true;
    try { plast.setPointerCapture(e.pointerId); } catch (_) {}
    setCustom();
    e.preventDefault();
  });
  plast.addEventListener('pointermove', e => {
    if (!dragP) return;
    const b = plast.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const LL = clamp(snap(invPX((e.clientX - b.left) * (540 / b.width)), 1), 0, LLMAX);
    const PI = clamp(snap(invPY((e.clientY - b.top) * (PVH / b.height)), 1), 0, Math.min(PIMAX, LL));
    if (!isFinite(LL) || !isFinite(PI)) return;
    state.LL = LL;
    state.PL = LL - PI;
    syncLimits();
    render();
  });
  const endPlast = e => {
    if (!dragP) return;
    dragP = false;
    try { plast.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  plast.addEventListener('pointerup', endPlast);
  plast.addEventListener('pointercancel', endPlast);

  /* ---------- boot ---------- */
  renderControls();
  render(true);
})();
