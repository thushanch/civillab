/* CivilLab · F1 Earth Pressure and Retaining Wall */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const wall = document.getElementById('wall');
  const checks = document.getElementById('checks');
  const controls = document.getElementById('controls');
  const tableWrap = document.getElementById('tablewrap');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const WVW = 460, WVH = 500;
  const CVW = 540, CVH = 500;

  /* ---------- presets, factories so nothing is shared ---------- */
  const PRESETS = {
    dry:  { label:'Dry granular backfill', f:()=>({ H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0.8,
              gamma:18, gammaSat:20, gammaC:24, phi:30, c:0, beta:0, q:0, zw:99,
              theory:'rankine', delta:0, deltaB:20, cB:0, qall:200, usePassive:false }) },
    surch:{ label:'With a surcharge',      f:()=>({ H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0.8,
              gamma:18, gammaSat:20, gammaC:24, phi:30, c:0, beta:0, q:20, zw:99,
              theory:'rankine', delta:0, deltaB:20, cB:0, qall:200, usePassive:false }) },
    water:{ label:'Blocked drains, water up', f:()=>({ H:6, B:3.5, tb:0.5, ts:0.4, Lt:1.0, Df:0.8,
              gamma:18, gammaSat:20, gammaC:24, phi:30, c:0, beta:0, q:0, zw:1.5,
              theory:'rankine', delta:0, deltaB:20, cB:0, qall:200, usePassive:false }) },
    slope:{ label:'Sloping backfill',      f:()=>({ H:6, B:4.0, tb:0.5, ts:0.4, Lt:1.0, Df:0.8,
              gamma:18, gammaSat:20, gammaC:24, phi:32, c:0, beta:15, q:0, zw:99,
              theory:'rankine', delta:0, deltaB:21, cB:0, qall:200, usePassive:false }) },
    clay: { label:'Cohesive backfill',     f:()=>({ H:5.5, B:3.6, tb:0.5, ts:0.4, Lt:1.1, Df:0.8,
              gamma:19, gammaSat:20, gammaC:24, phi:24, c:12, beta:0, q:10, zw:99,
              theory:'rankine', delta:0, deltaB:16, cB:10, qall:180, usePassive:false }) },
    coul: { label:'Coulomb, rough wall',   f:()=>({ H:6, B:3.2, tb:0.5, ts:0.4, Lt:0.9, Df:0.8,
              gamma:18, gammaSat:20, gammaC:24, phi:32, c:0, beta:0, q:0, zw:99,
              theory:'coulomb', delta:21, deltaB:21, cB:0, qall:200, usePassive:true }) }
  };

  const state = Object.assign({ preset:'dry', base:'dry' }, PRESETS.dry.f());

  const solveNow = () => EarthEngine.solve({
    H:state.H, B:state.B, tb:state.tb, ts:state.ts, Lt:state.Lt, Df:state.Df,
    gamma:state.gamma, gammaSat:state.gammaSat, gammaC:state.gammaC,
    phi:state.phi, c:state.c, beta:state.beta, q:state.q,
    zw: state.zw >= state.H ? null : state.zw,
    theory:state.theory, delta:state.delta,
    deltaB:state.deltaB, cB:state.cB, usePassive:state.usePassive, pts:140 });

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

  /* =====================================================================
     Figure 1 · the wall section with its pressure diagrams
     ===================================================================== */
  function drawWall(r) {
    clearSvg(wall);
    wall.appendChild(s('defs', {}, marker('wLoad', C.load), marker('wGrn', C.green, 5.5),
      marker('wWat', C.water, 5.5),
      s('pattern', { id:'wHatch', width:7, height:7, patternUnits:'userSpaceOnUse',
        patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));

    const X0 = 52, YB = 392, WALLW = 176, WALLH = 300;
    const sc = Math.min(WALLW / Math.max(0.5, state.B), WALLH / Math.max(0.5, state.H));
    const SX = x => X0 + x * sc;
    const SY = y => YB - y * sc;                  // y up from the base underside
    const backX = SX(state.B);

    wall.appendChild(txt(X0 - 8, 22, 'Wall section and pressure',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    /* retained soil behind the wall */
    const soilTop = SY(state.H);
    const betaRise = Math.tan(state.beta * Math.PI / 180) * (WVW - 24 - backX) / sc;
    wall.appendChild(s('polygon', {
      points: `${backX},${soilTop} ${WVW - 24},${SY(state.H + betaRise)} ` +
              `${WVW - 24},${SY(0)} ${backX},${SY(0)}`,
      fill:C.pale, 'fill-opacity':.20, stroke:'none' }));
    wall.appendChild(line(backX, soilTop, WVW - 24, SY(state.H + betaRise),
      { stroke:C.ocean, 'stroke-width':1.6 }));

    /* soil in front, the passive side */
    if (state.Df > 0.02)
      wall.appendChild(s('polygon', {
        points: `${SX(0)},${SY(state.Df)} ${24},${SY(state.Df)} ${24},${SY(0)} ${SX(0)},${SY(0)}`,
        fill:C.pale, 'fill-opacity':.28, stroke:C.ocean, 'stroke-width':1.2 }));

    /* the wall itself, stem plus base */
    const stemH = state.H - state.tb;
    wall.appendChild(s('polygon', {
      points: `${SX(0)},${SY(0)} ${SX(state.B)},${SY(0)} ${SX(state.B)},${SY(state.tb)} ` +
              `${SX(state.Lt + state.ts)},${SY(state.tb)} ${SX(state.Lt + state.ts)},${SY(state.H)} ` +
              `${SX(state.Lt)},${SY(state.H)} ${SX(state.Lt)},${SY(state.tb)} ${SX(0)},${SY(state.tb)}`,
      fill:'#fff', stroke:C.ocean, 'stroke-width':2.2, 'stroke-linejoin':'round' }));

    /* founding level hatch */
    wall.appendChild(s('rect', { x:24, y:SY(0), width:WVW - 48, height:10, fill:'url(#wHatch)' }));
    wall.appendChild(line(24, SY(0), WVW - 24, SY(0), { stroke:C.ocean, 'stroke-width':2 }));

    /* water table */
    if (state.zw < state.H) {
      const yw = SY(state.H - state.zw);
      wall.appendChild(line(backX, yw, WVW - 24, yw,
        { stroke:C.water, 'stroke-width':2 }));
      for (let i = 0; i < 4; i++)
        wall.appendChild(line(backX + 12 + i * 22, yw - 5, backX + 20 + i * 22, yw - 5,
          { stroke:C.water, 'stroke-width':1.4 }));
      wall.appendChild(txt(WVW - 26, yw - 8, 'water table',
        { an:'end', fs:10.5, fw:600, fill:C.water }));
    }

    /* surcharge on the backfill */
    if (state.q > 0.5) {
      for (let i = 0; i < 5; i++) {
        const x = backX + 16 + i * ((WVW - 44 - backX) / 4.5);
        wall.appendChild(line(x, soilTop - 30, x, soilTop - 8,
          { stroke:C.load, 'stroke-width':1.8, 'marker-end':'url(#wLoad)' }));
      }
      wall.appendChild(txt((backX + WVW - 24) / 2, soilTop - 36, `q = ${fmt(state.q, 0)} kPa`,
        { fs:11.5, fw:600, fill:C.load, halo:0 }));
    }

    /* dimensions */
    wall.appendChild(txt(SX(state.B / 2), SY(0) + 26, `B = ${fmt(state.B, 2)} m`,
      { fs:11.5, fw:600, fill:C.ocean, halo:0 }));
    wall.appendChild(txt(SX(state.Lt + state.ts / 2) - 4, SY(state.H) - 10,
      `H = ${fmt(state.H, 1)} m`, { an:'end', fs:11.5, fw:600, fill:C.ocean }));

    /* the pressure diagrams, on their own scale */
    const pts = r.profile.pts;
    const pmaxA = Math.max(...pts.map(p => p.sa), 1e-6);
    const pmaxU = Math.max(...pts.map(p => p.u), 0);
    const pmax = Math.max(pmaxA + pmaxU, 1e-6);
    const room = WVW - 26 - backX;
    const psc = Math.min(room * 0.86, 190) / pmax;

    /* effective active pressure, then water stacked outside it */
    const aPoly = [`${backX},${SY(state.H)}`];
    for (const p of pts) aPoly.push(`${backX + p.sa * psc},${SY(state.H - p.z)}`);
    aPoly.push(`${backX},${SY(0)}`);
    wall.appendChild(s('polygon', { points:aPoly.join(' '), fill:C.load,
      'fill-opacity':.22, stroke:C.load, 'stroke-width':1.8 }));

    if (pmaxU > 0.01) {
      const uPoly = [];
      for (const p of pts) uPoly.push(`${backX + p.sa * psc},${SY(state.H - p.z)}`);
      for (let i = pts.length - 1; i >= 0; i--)
        uPoly.push(`${backX + (pts[i].sa + pts[i].u) * psc},${SY(state.H - pts[i].z)}`);
      wall.appendChild(s('polygon', { points:uPoly.join(' '), fill:C.water,
        'fill-opacity':.28, stroke:C.water, 'stroke-width':1.6 }));
      wall.appendChild(txt(backX + (pmaxA + pmaxU * 0.5) * psc, SY(0) - 12, 'u',
        { fs:11, fw:600, fill:C.water }));
    }
    wall.appendChild(txt(backX + pmaxA * psc * 0.45, SY(0) - 12, 'σa′',
      { fs:11, fw:600, fill:C.load }));

    /* tension crack */
    if (r.z0 > 0.02) {
      if (r.z0 < state.H - 0.05) {
        const yc = SY(state.H - r.z0);
        wall.appendChild(line(backX, yc, backX + 54, yc,
          { stroke:C.contour, 'stroke-width':1.4, 'stroke-dasharray':'5 4' }));
        wall.appendChild(txt(backX + 58, yc + 4, `crack ${fmt(r.z0, 2)} m`,
          { an:'start', fs:10, fill:C.muted, halo:2.5 }));
      } else {
        wall.appendChild(txt(backX + 10, soilTop + 18,
          `z₀ = ${fmt(r.z0, 2)} m > H, no active pressure`,
          { an:'start', fs:10, fill:C.muted, halo:2.5 }));
      }
    }

    /* resultant thrust */
    if (r.Pa > 0.5) {
      const ya = SY(r.arm);
      wall.appendChild(line(backX + 96, ya, backX + 8, ya,
        { stroke:C.load, 'stroke-width':2.6, 'marker-end':'url(#wLoad)' }));
      wall.appendChild(txt(backX + 100, ya + 4, `Pa ${fmt(r.Pa, 0)} kN`,
        { an:'start', fs:11, fw:600, fill:C.load }));
    }
    if (r.Pw > 0.5) {
      const yw2 = SY(r.armW);
      wall.appendChild(line(backX + 96, yw2 + 16, backX + 8, yw2 + 16,
        { stroke:C.water, 'stroke-width':2.2, 'marker-end':'url(#wWat)' }));
      wall.appendChild(txt(backX + 100, yw2 + 20, `Pw ${fmt(r.Pw, 0)} kN`,
        { an:'start', fs:11, fw:600, fill:C.water }));
    }

    /* passive in front */
    if (state.Df > 0.02 && state.usePassive) {
      const pp = r.Pp, ppScale = Math.min(40 / Math.max(1e-6, pp), 1) * 1;
      const w2 = Math.min(34, 6 + pp * 0.12);
      wall.appendChild(s('polygon', {
        points: `${SX(0)},${SY(state.Df)} ${SX(0)},${SY(0)} ${SX(0) - w2},${SY(0)}`,
        fill:C.green, 'fill-opacity':.25, stroke:C.green, 'stroke-width':1.6 }));
      wall.appendChild(txt(SX(0) - w2 - 4, SY(state.Df / 3), `Pp ${fmt(pp, 0)}`,
        { an:'end', fs:10.5, fw:600, fill:C.green }));
    }

    wall.appendChild(txt(WVW / 2, WVH - 34,
      `${state.theory === 'coulomb' ? 'Coulomb' : 'Rankine'}` +
      `   Ka = ${fmt(r.Ka, 4)}` +
      (state.theory === 'coulomb' ? `   δ = ${fmt(state.delta, 0)}°` :
        state.beta > 0 ? `   β = ${fmt(state.beta, 0)}°` : ''),
      { fs:12, fw:600, fill:C.ocean, halo:0 }));
    wall.appendChild(txt(WVW / 2, WVH - 14,
      `total horizontal push ΣH = ${fmt(r.Ph, 0)} kN per metre run`,
      { fs:11.5, fw:600, fill:C.load, halo:0 }));
  }

  /* =====================================================================
     Figure 2 · the three checks, then the base pressure
     ===================================================================== */
  function drawChecks(r) {
    clearSvg(checks);
    checks.appendChild(s('defs', {}, marker('cLoad', C.load), marker('cGrn', C.green, 5.5)));
    checks.appendChild(txt(40, 22, 'Stability checks',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    /* one utilisation bar. util is demand over capacity, so the target tick
       sits at 1/FoS_required and anything past 1.0 has already failed. */
    const BX = 40, BW = 380, BH = 26;
    function bar(y, name, util, need, note) {
      const safe = util <= 1 / need + 1e-9;
      checks.appendChild(txt(BX, y - 8, name,
        { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
      checks.appendChild(txt(BX + BW, y - 8, note,
        { an:'end', fs:11, fill:C.muted, halo:0 }));
      checks.appendChild(s('rect', { x:BX, y, width:BW, height:BH, rx:5,
        fill:'#fff', stroke:C.hair, 'stroke-width':1 }));
      const w = clamp(util, 0, 1.35) / 1.35 * BW;
      checks.appendChild(s('rect', { x:BX, y, width:Math.max(0, w), height:BH, rx:5,
        fill: safe ? C.green : C.load, 'fill-opacity':.30,
        stroke: safe ? C.green : C.load, 'stroke-width':1.6 }));
      /* the tick the code asks for */
      const tx = BX + (1 / need) / 1.35 * BW;
      checks.appendChild(line(tx, y - 5, tx, y + BH + 5,
        { stroke:C.ocean, 'stroke-width':2 }));
      checks.appendChild(txt(tx, y + BH + 18, `need ${fmt(need, 1)}`,
        { fs:10, fill:C.ocean, halo:2.5 }));
      /* and where 1.0 is, the point of actual failure */
      const fx = BX + 1 / 1.35 * BW;
      checks.appendChild(line(fx, y, fx, y + BH,
        { stroke:C.load, 'stroke-width':1.2, 'stroke-dasharray':'3 3' }));
      checks.appendChild(txt(BX + BW + 14, y + BH / 2 + 4,
        util > 9.9 ? '—' : fmt(1 / Math.max(util, 1e-9), 2),
        { an:'start', fs:13, fw:600, fill: safe ? C.green : C.load, halo:0, head:true }));
      return safe;
    }
    checks.appendChild(txt(BX + BW + 30, 40, 'F',
      { fs:11, fw:600, fill:C.muted, halo:0 }));

    const uSlide = r.slideR > 1e-9 ? r.Ph / r.slideR : 9.99;
    const uOver = r.Mr > 1e-9 ? r.Mo / r.Mr : 9.99;
    const okS = bar(58, 'Sliding on the base', uSlide, 1.5,
      `${fmt(r.Ph, 0)} kN against ${fmt(r.slideR, 0)} kN`);
    const okO = bar(132, 'Overturning about the toe', uOver, 2.0,
      `${fmt(r.Mo, 0)} kNm against ${fmt(r.Mr, 0)} kNm`);
    const uBear = state.qall > 1e-9 ? r.qmax / state.qall : 9.99;
    const okB = bar(206, 'Bearing under the toe', uBear, 1.0,
      `${fmt(r.qmax, 0)} kPa against ${fmt(state.qall, 0)} kPa`);

    /* the base pressure diagram */
    const PX0 = 60, PX1 = 480, PY = 340, PH2 = 76;
    const sx = x => PX0 + x / Math.max(0.1, r.B) * (PX1 - PX0);
    checks.appendChild(txt(BX, PY - 34, 'Pressure under the base',
      { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
    checks.appendChild(line(PX0, PY, PX1, PY, { stroke:C.ocean, 'stroke-width':2.4 }));

    /* once the resultant leaves the base entirely the pressure is unbounded,
       so there is nothing to draw and the figure says so instead */
    if (r.offBase || !isFinite(r.qmax)) {
      checks.appendChild(txt((PX0 + PX1) / 2, PY + 36,
        'the resultant has left the base, the wall has overturned',
        { fs:12, fw:600, fill:C.load, halo:0 }));
    } else {
      const qm = Math.max(r.qmax, 1e-6);
      const qsc = PH2 / qm;
      const dT = clamp(r.qToe * qsc, 0, PH2), dH = clamp(r.qHeel * qsc, 0, PH2);
      if (r.middleThird) {
        checks.appendChild(s('polygon', {
          points: `${PX0},${PY} ${PX1},${PY} ${PX1},${PY + dH} ${PX0},${PY + dT}`,
          fill:C.green, 'fill-opacity':.22, stroke:C.green, 'stroke-width':1.8 }));
      } else if (r.e > 0) {
        const xEff = clamp(3 * r.xbar, 0, r.B);
        checks.appendChild(s('polygon', {
          points: `${PX0},${PY} ${sx(xEff)},${PY} ${PX0},${PY + dT}`,
          fill:C.load, 'fill-opacity':.22, stroke:C.load, 'stroke-width':1.8 }));
        checks.appendChild(txt(sx(clamp(xEff + (r.B - xEff) / 2, 0, r.B)), PY + 22,
          'heel lifts off', { fs:10.5, fw:600, fill:C.load, halo:2.5 }));
      } else {
        const xEff = clamp(r.B - 3 * (r.B - r.xbar), 0, r.B);
        checks.appendChild(s('polygon', {
          points: `${sx(xEff)},${PY} ${PX1},${PY} ${PX1},${PY + dH}`,
          fill:C.load, 'fill-opacity':.22, stroke:C.load, 'stroke-width':1.8 }));
        checks.appendChild(txt(sx(clamp(xEff / 2, 0, r.B)), PY + 22,
          'toe lifts off', { fs:10.5, fw:600, fill:C.load, halo:2.5 }));
      }
      if (dT > 0.5)
        checks.appendChild(txt(PX0, PY + dT + 16, `toe ${fmt(r.qToe, 0)} kPa`,
          { an:'start', fs:11, fw:600, fill: r.qToe >= r.qHeel ? C.load : C.green, halo:2.5 }));
      if (dH > 0.5)
        checks.appendChild(txt(PX1, PY + dH + 16, `heel ${fmt(r.qHeel, 0)} kPa`,
          { an:'end', fs:11, fw:600, fill: r.qHeel > r.qToe ? C.load : C.green, halo:2.5 }));
    }

    /* middle third and the resultant */
    const m1 = sx(r.B / 3), m2 = sx(2 * r.B / 3);
    checks.appendChild(s('rect', { x:m1, y:PY - 20, width:m2 - m1, height:16,
      fill:C.pale, 'fill-opacity':.45, stroke:C.contour, 'stroke-width':1 }));
    checks.appendChild(txt((m1 + m2) / 2, PY - 8, 'middle third',
      { fs:9.5, fill:C.ocean, halo:2.5 }));
    const rx = sx(clamp(r.xbar, 0, r.B));
    checks.appendChild(line(rx, PY - 48, rx, PY - 4,
      { stroke: r.middleThird ? C.green : C.load, 'stroke-width':2.4,
        'marker-end': `url(#${r.middleThird ? 'cGrn' : 'cLoad'})` }));
    checks.appendChild(txt(rx, PY - 54,
      `ΣV = ${fmt(r.V, 0)} kN at ${fmt(r.xbar, 2)} m`,
      { fs:11, fw:600, fill: r.middleThird ? C.green : C.load }));

    checks.appendChild(txt(CVW / 2, CVH - 14,
      `e = ${fmt(r.e, 3)} m, B/6 = ${fmt(r.B / 6, 3)} m` +
      (r.middleThird ? ', the whole base is in compression'
                     : ', the resultant has left the middle third'),
      { fs:11.5, fw:600, fill: r.middleThird ? C.green : C.load, halo:0 }));
    return okS && okO && okB;
  }

  /* ---------- the force and moment table ---------- */
  function drawTable(r) {
    const th = 'text-align:right;padding:5px 8px;border-bottom:1px solid #DFE3DC;' +
      'font-weight:600;color:#5C6A72;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase';
    const td = 'text-align:right;padding:3px 8px;font-variant-numeric:tabular-nums';
    let h = '<div style="font-family:Poppins,Inter,sans-serif;font-weight:600;color:#14416B;' +
      'font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">' +
      'Forces and moments about the toe, per metre run</div>';
    h += `<table style="border-collapse:collapse;font-size:12.5px;width:100%;min-width:520px"><thead><tr>
      <th style="${th};text-align:left">Item</th><th style="${th}">V (kN)</th>
      <th style="${th}">H (kN)</th><th style="${th}">arm (m)</th>
      <th style="${th}">restoring (kNm)</th><th style="${th}">overturning (kNm)</th>
      </tr></thead><tbody>`;
    for (const p of r.parts)
      h += `<tr><td style="${td};text-align:left">${p.name}</td>
        <td style="${td}">${fmt(p.W, 1)}</td><td style="${td}">–</td>
        <td style="${td}">${fmt(p.x, 2)}</td>
        <td style="${td};color:#2E6B4F">${fmt(p.W * p.x, 1)}</td>
        <td style="${td}">–</td></tr>`;
    if (r.PpUse > 0.01)
      h += `<tr><td style="${td};text-align:left">Passive in front</td>
        <td style="${td}">–</td><td style="${td};color:#2E6B4F">${fmt(r.PpUse, 1)}</td>
        <td style="${td}">${fmt(r.PpArm, 2)}</td>
        <td style="${td};color:#2E6B4F">${fmt(r.PpUse * r.PpArm, 1)}</td>
        <td style="${td}">–</td></tr>`;
    const Pah = r.Pa * Math.cos(r.lean * Math.PI / 180);
    h += `<tr><td style="${td};text-align:left">Active thrust, horizontal</td>
      <td style="${td}">–</td><td style="${td};color:#B03A2E">${fmt(Pah, 1)}</td>
      <td style="${td}">${fmt(r.arm, 2)}</td><td style="${td}">–</td>
      <td style="${td};color:#B03A2E">${fmt(Pah * r.arm, 1)}</td></tr>`;
    if (r.Pw > 0.01)
      h += `<tr><td style="${td};text-align:left">Water thrust</td>
        <td style="${td}">–</td><td style="${td};color:#1E78B0">${fmt(r.Pw, 1)}</td>
        <td style="${td}">${fmt(r.armW, 2)}</td><td style="${td}">–</td>
        <td style="${td};color:#1E78B0">${fmt(r.Pw * r.armW, 1)}</td></tr>`;
    h += `<tr><td style="${td};text-align:left;font-weight:600;border-top:2px solid #14416B">Σ</td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600">${fmt(r.V, 1)}</td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600">${fmt(r.Ph, 1)}</td>
      <td style="${td};border-top:2px solid #14416B"></td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600;color:#2E6B4F">${fmt(r.Mr, 1)}</td>
      <td style="${td};border-top:2px solid #14416B;font-weight:600;color:#B03A2E">${fmt(r.Mo, 1)}</td></tr>`;
    h += '</tbody></table>';
    h += `<div style="margin-top:9px;font-size:12.5px;color:#41505A">
      Sliding F = (ΣV tanδ<sub>b</sub> + c<sub>b</sub>B${r.PpUse > 0.01 ? ' + P<sub>p</sub>' : ''}) / ΣH
      = ${fmt(r.slideR, 1)} / ${fmt(r.Ph, 1)} = <strong>${fmt(r.FoSslide, 2)}</strong>.
      Overturning F = ${fmt(r.Mr, 1)} / ${fmt(r.Mo, 1)} = <strong>${fmt(r.FoSover, 2)}</strong>.
      Resultant at x̄ = (ΣM<sub>r</sub> − ΣM<sub>o</sub>)/ΣV = ${fmt(r.xbar, 3)} m,
      so e = ${fmt(r.e, 3)} m.</div>`;
    tableWrap.innerHTML = h;
  }

  /* ---------- results chips ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function drawChips(r) {
    const okS = r.FoSslide >= 1.5, okO = r.FoSover >= 2.0, okB = r.qmax <= state.qall;
    resultsEl.innerHTML =
      chip('Ka', fmt(r.Ka, 4), state.theory === 'coulomb' ? 'Coulomb' :
           state.beta > 0 ? 'Rankine, sloping' : 'tan²(45 − φ/2)') +
      chip('Active thrust', `${fmt(r.Pa, 0)} kN/m`, `at ${fmt(r.arm, 2)} m above the base`) +
      chip('Water thrust', r.Pw > 0.01 ? `${fmt(r.Pw, 0)} kN/m` : '–',
           r.Pw > 0.01 ? 'drains blocked' : 'drained', r.Pw > 0.01 ? 'warn' : '') +
      chip('ΣH', `${fmt(r.Ph, 0)} kN/m`, 'total horizontal push', 'warn') +
      chip('ΣV', `${fmt(r.V, 0)} kN/m`, 'weight plus any vertical thrust') +
      chip('F sliding', fmt(r.FoSslide, 2), 'need 1.5', okS ? 'ok' : 'warn') +
      chip('F overturning', fmt(r.FoSover, 2), 'need 2.0', okO ? 'ok' : 'warn') +
      chip('Eccentricity e', `${fmt(r.e, 3)} m`, `B/6 = ${fmt(r.B / 6, 3)} m`,
           r.middleThird ? 'ok' : 'warn') +
      chip('qmax', `${fmt(r.qmax, 0)} kPa`, `allowable ${fmt(state.qall, 0)} kPa`,
           okB ? 'ok' : 'warn') +
      chip('Verdict', okS && okO && okB ? 'Passes' : 'Fails',
           okS && okO && okB ? 'all three checks' :
           [!okS && 'sliding', !okO && 'overturning', !okB && 'bearing']
             .filter(Boolean).join(', '),
           okS && okO && okB ? 'ok' : 'warn');
  }

  function renderAll() {
    const r = solveNow();
    drawWall(r);
    drawChecks(r);
    drawTable(r);
    drawChips(r);
    const n = document.getElementById('geoNote');
    if (n) n.textContent = `heel ${fmt(r.heel, 2)} m, stem ${fmt(r.stemH, 2)} m` +
      (r.heel <= 0.01 ? '  (no heel left)' : '');
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
      <div class="ctl"><select id="theory">
        <option value="rankine"${state.theory === 'rankine' ? ' selected' : ''}>Rankine</option>
        <option value="coulomb"${state.theory === 'coulomb' ? ' selected' : ''}>Coulomb, with wall friction</option>
      </select></div>
      <h3>Wall</h3>
      ${row('H', 'Total height H (m)', 2, 12, 0.1, state.H)}
      ${row('B', 'Base width B (m)', 1, 8, 0.1, state.B)}
      ${row('Lt', 'Toe length (m)', 0, 4, 0.1, state.Lt)}
      ${row('ts', 'Stem thickness (m)', 0.2, 1.2, 0.05, state.ts)}
      ${row('tb', 'Base thickness (m)', 0.2, 1.5, 0.05, state.tb)}
      ${row('Df', 'Soil in front Df (m)', 0, 3, 0.1, state.Df)}
      <div id="geoNote" style="font-size:12px;font-weight:600;color:#14416B;margin:2px 0 6px"></div>
      <h3>Backfill</h3>
      ${row('phi', "Friction φ′ (°)", 0, 45, 1, state.phi)}
      ${row('c', "Cohesion c′ (kPa)", 0, 40, 1, state.c)}
      ${row('gamma', 'Unit weight γ (kN/m³)', 14, 22, 0.5, state.gamma)}
      ${row('gammaSat', 'Saturated γsat (kN/m³)', 16, 24, 0.5, state.gammaSat)}
      ${row('beta', 'Backfill slope β (°)', 0, 30, 1, state.beta)}
      ${row('q', 'Surcharge q (kPa)', 0, 60, 1, state.q)}
      ${row('zw', 'Water table depth (m)', 0, 12, 0.5, state.zw)}
      ${state.theory === 'coulomb' ? row('delta', 'Wall friction δ (°)', 0, 30, 1, state.delta) : ''}
      <h3>Base and ground</h3>
      ${row('deltaB', 'Base friction δb (°)', 0, 40, 1, state.deltaB)}
      ${row('cB', 'Base adhesion cb (kPa)', 0, 40, 1, state.cB)}
      ${row('qall', 'Allowable bearing (kPa)', 50, 500, 10, state.qall)}
      <label class="chk"><input type="checkbox" id="usePassive"${state.usePassive ? ' checked' : ''}>
        <span>Count the passive resistance in front</span></label>`;
  }

  const LIM = { H:[2,12], B:[1,8], Lt:[0,4], ts:[0.2,1.2], tb:[0.2,1.5], Df:[0,3],
                phi:[0,45], c:[0,40], gamma:[14,22], gammaSat:[16,24], beta:[0,30],
                q:[0,60], zw:[0,12], delta:[0,30], deltaB:[0,40], cB:[0,40], qall:[50,500] };
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
    /* the toe and stem cannot eat the whole base */
    if (k === 'B' || k === 'Lt' || k === 'ts') {
      const room = state.B - 0.1;
      if (state.Lt + state.ts > room) {
        if (k === 'ts') { state.Lt = Math.max(0, room - state.ts); syncKey('Lt'); }
        else { state.ts = clamp(room - state.Lt, LIM.ts[0], LIM.ts[1]); syncKey('ts'); }
      }
    }
    if (k === 'tb' && state.tb > state.H - 0.3) { state.tb = Math.max(0.2, state.H - 0.3); }
    for (const suf of ['r', 'n']) {
      const el = document.getElementById(k + suf);
      if (el && el !== e.target && document.activeElement !== el) el.value = state[k];
    }
    setCustom();
    renderAll();
  });

  controls.addEventListener('change', e => {
    if (e.target.id === 'preset') {
      const p = PRESETS[e.target.value];
      if (!p) { state.preset = ''; return; }
      Object.assign(state, p.f());
      state.preset = state.base = e.target.value;
      renderControls(); renderAll();
    } else if (e.target.id === 'theory') {
      state.theory = e.target.value;
      setCustom(); renderControls();
      const m = document.getElementById('theory'); if (m) m.value = state.theory;
      renderAll();
    } else if (e.target.id === 'usePassive') {
      state.usePassive = e.target.checked;
      renderAll();
    }
  });

  /* ---------- boot ---------- */
  renderControls();
  renderAll();
})();
