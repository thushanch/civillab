/* CivilLab · T1 Timber Member Designer */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC', wood:'#D9C9A8' };

  const base = { gF:1.4, kLe:1, lb:50, kc90:1, lateral:'joists', Nk:0, ksys:false, service:1, duration:'medium' };
  const PRESETS = {
    joist:  { label:'Floor joists, load sharing', f:()=>Object.assign({}, base, { tab:'chain', cls:'C24', b:47, h:200, L:3.6, wk:1.5, ksys:true }) },
    lintel: { label:'Lintel over an opening', f:()=>Object.assign({}, base, { tab:'beam', cls:'C24', b:75, h:225, L:3.0, wk:5.5, lb:75, lateral:'ends' }) },
    post:   { label:'Post with a small moment', f:()=>Object.assign({}, base, { tab:'column', cls:'C24', b:100, h:100, L:2.7, wk:0.3, Nk:25, lateral:'none' }) },
    deck:   { label:'Outdoor hardwood beam', f:()=>Object.assign({}, base, { tab:'beam', cls:'D40', b:100, h:250, L:4.5, wk:4.0, service:3, duration:'long', lb:100, lateral:'ends' }) },
    crush:  { label:'Bearing that crushes', f:()=>Object.assign({}, base, { tab:'beam', cls:'C16', b:75, h:250, L:2.5, wk:6.0, lb:20, lateral:'edge' }) }
  };
  const TABS = { chain:'Modification chain', beam:'Beam', column:'Column' };
  const state = Object.assign({ preset:'joist', code:'ec5' }, PRESETS.joist.f());
  const solveFor = code => TimberEngine.solve(Object.assign({}, state, { code }));

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
  const title = t => add(txt(390, 28, t, { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));

  /* ---------- the full chain, one row per strength ---------- */
  function drawChains(r) {
    const X = 390, W = 545;
    if (r.code === 'ec5') {
      title(`fd = kmod · kh · ksys · fk / γM, ${state.cls}, ${state.duration} term, service class ${state.service}`);
      const c = r.c;
      const row = (y, name, fk, useKh, useKs, extra, fd, clause) => {
        const boxes = [{ sym:`${name},k`, val:fmt(fk, 1) }, { sym:'kmod', val:fmt(r.km, 2) }];
        if (useKh && r.k_h > 1) boxes.push({ sym:'kh', val:fmt(r.k_h, 3) });
        if (useKs && r.ks > 1) boxes.push({ sym:'ksys', val:fmt(r.ks, 2) });
        boxes.push({ op:'÷', sym:'γM', val:'1.3' });
        if (extra) boxes.push(extra);
        boxes.push({ op:'=', sym:`${name},d`, val:fmt(fd, 2) });
        return DesignKit.chain(fig, { x:X, y, w:W, h:40, title:name === 'fm' ? 'Bending' : name === 'ft,0' ? 'Tension along the grain'
          : name === 'fc,0' ? 'Compression along the grain' : name === 'fc,90' ? 'Compression across the grain' : 'Shear', clause }, boxes);
      };
      let y = 50;
      y = row(y, 'fm', c.fm, true, true, r.kcr < 1 ? { op:'×', sym:'kcrit', val:fmt(r.kcr, 3) } : null, r.fmd * (r.kcr < 1 ? r.kcr : 1), 'EN 1995-1-1 2.4.1, 3.2, 6.3.3');
      y = row(y + 6, 'ft,0', c.ft0, true, false, null, r.ftd, '6.1.2');
      y = row(y + 6, 'fc,0', c.fc0, false, false, state.Nk > 0 ? { op:'×', sym:'kc,z', val:fmt(r.kcz, 3) } : null, r.fc0d * (state.Nk > 0 ? r.kcz : 1), '6.1.4, 6.3.2');
      y = row(y + 6, 'fc,90', c.fc90, false, false, state.kc90 > 1 ? { op:'×', sym:'kc,90', val:fmt(state.kc90, 2) } : null, r.fc90d * state.kc90, '6.1.5');
      row(y + 6, 'fv', c.fv, false, false, { op:'×', sym:'kcr', val:'0.67' }, r.fvd * 0.67, '6.1.7, UK NA kcr');
    } else {
      title(`Permissible stress = grade stress · K2 · K3 · K7 · K8, ${state.cls}`);
      const c = r.c;
      const row = (y, name, g, k2, k7, k8, adm, clause) => {
        const boxes = [{ sym:`${name} grade`, val:fmt(g, 2) }];
        if (r.wet) boxes.push({ sym:'K2 wet', val:fmt(k2, 2) });
        boxes.push({ sym:'K3', val:fmt(r.k3, 2) });
        if (k7 && r.k7 !== 1) boxes.push({ sym:'K7', val:fmt(r.k7, 3) });
        if (k8 && r.k8 > 1) boxes.push({ sym:'K8', val:fmt(r.k8, 2) });
        boxes.push({ op:'=', sym:'permissible', val:fmt(adm, 2) });
        return DesignKit.chain(fig, { x:X, y, w:W, h:40, title:name, clause }, boxes);
      };
      let y = 50;
      y = row(y, 'Bending', c.m, TimberEngine.K2.m, true, true, r.smAdm, 'BS 5268-2 2.10');
      y = row(y + 6, 'Compression along the grain', c.c, TimberEngine.K2.c, false, true, r.cAdmRaw, '2.11, then K12');
      y = row(y + 6, 'Compression across the grain', c.cp, TimberEngine.K2.cp, false, true, r.cpAdm, '2.10.2');
      row(y + 6, 'Shear', c.v, TimberEngine.K2.v, false, true, r.vAdm, '2.10.4');
    }
  }

  /* ---------- the beam ---------- */
  function drawBeam(r) {
    const ec = r.code === 'ec5';
    title(`Beam, ${state.b} × ${state.h} ${state.cls}, span ${fmt(state.L, 2)} m`);
    const X0 = 420, W = 380, Y = 110, Hh = clamp(state.h * 0.25, 24, 70);
    add(s('rect', { x:X0, y:Y, width:W, height:Hh, fill:C.wood, 'fill-opacity':.55, stroke:C.ocean }));
    for (let i = 0; i <= 14; i++) {
      const x = X0 + W * i / 14;
      add(line(x, Y - 30, x, Y - 3, { stroke:C.load, 'stroke-width':1.2, 'marker-end':'url(#aLoad)' }));
    }
    add(line(X0, Y - 30, X0 + W, Y - 30, { stroke:C.load, 'stroke-width':1.2 }));
    add(txt(X0 + W / 2, Y - 36, `w = ${fmt(state.wk, 2)} kN/m characteristic${ec ? `, × γF ${fmt(state.gF, 2)}` : ', working load'}`, { fs:10.5, fill:C.load }));
    const bl = Math.max(8, state.lb * W / (state.L * 1000));
    [X0, X0 + W - bl].forEach(x => add(s('rect', { x, y:Y + Hh, width:bl, height:22, fill:'url(#hatch)', stroke:C.ocean })));
    add(txt(X0 + bl / 2, Y + Hh + 38, `bearing ${state.lb} mm`, { fs:10, fill:C.ocean }));
    if (ec) add(txt(X0 + W / 2, Y + Hh + 20, `lef for twisting = 0.9L + 2h = ${fmt(r.lef / 1000, 2)} m`, { fs:10.5 }));
    else add(txt(X0 + W / 2, Y + Hh + 20, `h/b = ${fmt(r.hb, 2)}, Table 19 limit ${r.lim}`, { fs:10.5 }));

    /* section with the bending stress and the shear stress */
    const sx = 470, sy = 250, k = Math.min(160 / state.h, 120 / state.b);
    const bw = state.b * k, bh = state.h * k;
    add(s('rect', { x:sx - bw / 2, y:sy, width:bw, height:bh, fill:C.wood, 'fill-opacity':.55, stroke:C.ocean }));
    add(txt(sx, sy + bh + 16, `${state.b} × ${state.h}`, { fs:10.5 }));
    const smx = sx + bw / 2 + 30, smax = 60;
    add(line(smx, sy, smx, sy + bh, { stroke:C.axis }));
    add(s('polygon', { points:`${smx},${sy} ${smx + smax},${sy} ${smx - smax},${sy + bh} ${smx},${sy + bh}`, fill:C.green, 'fill-opacity':.13, stroke:C.green }));
    add(txt(smx + smax + 4, sy + 4, `σm ${fmt(r.sm, 2)} MPa`, { an:'start', fs:10.5, fill:C.green, fw:600 }));
    const tx = smx + 170;
    add(line(tx, sy, tx, sy + bh, { stroke:C.axis }));
    let d = `M${tx},${sy}`;
    for (let i = 0; i <= 20; i++) { const t = i / 20; d += ` L${tx + 50 * 4 * t * (1 - t)},${sy + bh * t}`; }
    add(s('path', { d: d + ` L${tx},${sy + bh} Z`, fill:C.water, 'fill-opacity':.13, stroke:C.water }));
    add(txt(tx + 54, sy + bh / 2 + 4, `τ ${fmt(r.tau, 2)} MPa`, { an:'start', fs:10.5, fill:C.water, fw:600 }));
    /* bearing across the grain */
    const bx = 860, by = 280;
    add(s('rect', { x:bx - 40, y:by - 40, width:80, height:40, fill:C.wood, 'fill-opacity':.55, stroke:C.ocean }));
    add(s('rect', { x:bx - 20, y:by, width:40, height:30, fill:'url(#hatch)', stroke:C.ocean }));
    for (let i = -2; i <= 2; i++) add(line(bx + i * 8, by + 44, bx + i * 8, by + 32, { stroke:C.green, 'stroke-width':1.4, 'marker-end':'url(#aGrn)' }));
    add(txt(bx, by + 60, ec ? `σc,90 ${fmt(r.sc90, 2)} MPa over ${r.lb} mm` : `${fmt(r.scp, 2)} MPa over ${state.lb} mm`, { fs:10.5, fill:C.green, fw:600 }));
    add(txt(390, 540, ec ? `M = ${fmt(r.a.M, 2)} kNm, V = ${fmt(r.a.V, 2)} kN with γF ${fmt(state.gF, 2)}, kcrit = ${fmt(r.kcr, 3)}`
      : `M = ${fmt(r.a.M, 2)} kNm, V = ${fmt(r.a.V, 2)} kN at working load`, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- the column ---------- */
  function drawColumn(r) {
    const ec = r.code === 'ec5';
    title(ec ? 'Buckling, kc against relative slenderness, βc = 0.2' : 'Buckling, K12 from BS 5268-2 Annex B');
    const P = { x0:440, x1:900, y0:60, y1:450 };
    const lmax = ec ? 3 : 250;
    const X = v => P.x0 + v / lmax * (P.x1 - P.x0), Y = v => P.y1 - v * (P.y1 - P.y0);
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    for (let i = 0; i <= 6; i++) add(txt(X(lmax * i / 6), P.y1 + 15, fmt(lmax * i / 6, ec ? 1 : 0), { fs:9.5 }));
    for (let i = 0; i <= 4; i++) add(txt(P.x0 - 6, Y(i / 4) + 4, fmt(i / 4, 2), { an:'end', fs:9.5 }));
    add(txt(P.x1, P.y1 + 32, ec ? 'λrel' : 'λ = Le / i', { an:'end', fs:10.5 }));
    add(txt(P.x0 - 30, (P.y0 + P.y1) / 2, ec ? 'kc' : 'K12', { fs:11, rot:-90 }));
    let d = '';
    for (let i = 0; i <= 90; i++) {
      const l = lmax * i / 90;
      const v = ec ? TimberEngine.kc(l) : TimberEngine.k12(r.cAdmRaw, r.Emin, Math.max(l, 1)).K12;
      d += `${i ? 'L' : 'M'}${X(l)},${Y(v)}`;
    }
    add(s('path', { d, fill:'none', stroke:C.ocean, 'stroke-width':2.2 }));
    const pts = ec ? [['y', r.lry, r.kcy, C.water], ['z', r.lrz, r.kcz, C.load]] : [['min', r.lam, r.K12, C.load]];
    pts.forEach((p, i) => {
      const x = X(Math.min(p[1], lmax)), y = Y(p[2]);
      add(s('circle', { cx:x, cy:y, r:6, fill:p[3], stroke:'#fff', 'stroke-width':2 }));
      add(txt(x + 9, y - 8 - i * 14, ec ? `${p[0]} axis: λrel ${fmt(p[1], 3)}, kc ${fmt(p[2], 3)}` : `λ ${fmt(p[1], 0)}, K12 ${fmt(p[2], 3)}`,
        { an:'start', fs:11, fw:600, fill:p[3] }));
    });
    add(txt(390, 520, ec ? `σc,0 = ${fmt(r.sc, 2)} MPa against kc fc,0,d = ${fmt(Math.min(r.kcy, r.kcz) * r.fc0d, 2)} MPa, lef = ${fmt(r.lefC / 1000, 2)} m`
      : `σc = ${fmt(r.sc, 2)} MPa against K12 × ${fmt(r.cAdmRaw, 2)} = ${fmt(r.cAdm, 2)} MPa`, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- left column ---------- */
  function drawLeft(r) {
    const X = 26, W = 320, ec = r.code === 'ec5';
    let y = 30;
    y = ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Bending design strength', clause:'EN 1995-1-1 2.4.1' }, [
      { sym:'fm,k', val:fmt(r.c.fm, 0) }, { sym:'kmod', val:fmt(r.km, 2) }, { sym:'kh', val:fmt(r.k_h, 3) },
      { sym:'ksys', val:fmt(r.ks, 2) }, { op:'÷', sym:'γM', val:'1.3' }, { op:'=', sym:'fm,d', val:fmt(r.fmd, 2) }])
      : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Permissible bending stress', clause:'BS 5268-2 2.10.6' }, [
      { sym:'grade', val:fmt(r.c.m, 1) }, { sym:'K3', val:fmt(r.k3, 2) }, { sym:'K7', val:fmt(r.k7, 3) }, { sym:'K8', val:fmt(r.k8, 2) },
      { op:'=', sym:'σm,adm', val:fmt(r.smAdm, 2) }]);
    const items = [
      { name:'Bending', util:r.u.bend, clause: ec ? '6.1.6' : '2.10.5' },
      { name: ec ? 'Lateral torsional buckling, kcrit' : 'Depth to breadth, Table 19', util:r.u.ltb, clause: ec ? '6.3.3' : '2.10.8' },
      { name:'Shear', util:r.u.shear, clause: ec ? '6.1.7' : '2.10.4' },
      { name:'Bearing across the grain', util:r.u.bearing, clause: ec ? '6.1.5' : '2.10.2' }];
    if (state.Nk > 0) {
      items.push({ name:'Column buckling', util:r.u.column, clause: ec ? '6.3.2' : '2.11.5' });
      items.push({ name:'Compression with bending', util:r.u.comp, clause: ec ? '6.23, 6.24' : '2.11.6' });
    }
    if (state.Nk < 0 && ec) items.push({ name:'Tension with bending', util:r.u.tension, clause:'6.17' });
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:44, title:'Checks' }, items);
    return items;
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aLoad', C.load, 5), marker('aGrn', C.green, 5),
      s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse', patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));
    const r = solveFor(state.code), other = solveFor(state.code === 'ec5' ? 'bs' : 'ec5');
    const items = drawLeft(r);
    add(line(370, 16, 370, 544, { stroke:C.hair }));
    ({ chain:drawChains, beam:drawBeam, column:drawColumn })[state.tab](r);
    const ec = r.code === 'ec5';
    const v = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip(ec ? 'kmod' : 'K3', fmt(ec ? r.km : r.k3, 2), ec ? `${state.duration} term, service class ${state.service}` : `${state.duration} term`) +
      chip(ec ? 'fm,d' : 'σm,adm', `${fmt(ec ? r.fmd : r.smAdm, 2)} MPa`, ec ? `kh ${fmt(r.k_h, 3)}, ksys ${fmt(r.ks, 2)}` : `K7 ${fmt(r.k7, 3)}, K8 ${fmt(r.k8, 2)}`) +
      chip('σm', `${fmt(r.sm, 2)} MPa`, ec ? 'design' : 'working', r.u.bend <= 1 ? 'ok' : 'warn') +
      chip(ec ? 'kcrit' : 'h/b', fmt(ec ? r.kcr : r.hb, 3), ec ? `λrel,m ${fmt(r.lamM, 3)}` : `limit ${r.lim}`, r.u.ltb <= 1 ? 'ok' : 'warn') +
      chip('Shear τ', `${fmt(r.tau, 2)} MPa`, ec ? `fv,d kcr ${fmt(r.fvd * 0.67, 2)}` : `adm ${fmt(r.vAdm, 2)}`, r.u.shear <= 1 ? 'ok' : 'warn') +
      chip('Bearing', `${fmt(ec ? r.sc90 : r.scp, 2)} MPa`, ec ? `fc,90,d ${fmt(r.fc90d * state.kc90, 2)}` : `adm ${fmt(r.cpAdm, 2)}`, r.u.bearing <= 1 ? 'ok' : 'warn') +
      (state.Nk > 0 ? chip(ec ? 'kc' : 'K12', fmt(ec ? Math.min(r.kcy, r.kcz) : r.K12, 3), ec ? `λrel ${fmt(Math.max(r.lry, r.lrz), 3)}` : `λ ${fmt(r.lam, 0)}`,
        r.u.column <= 1 ? 'ok' : 'warn') : '') +
      chip(ec ? 'BS 5268 worst' : 'EC5 worst', `${fmt(Math.max(...Object.values(other.u)) * 100, 0)}%`, ec ? 'working loads' : 'factored loads');

    DesignKit.trail(trailEl, 'Show the working', ec ? [
      { t:`kmod = ${r.km} for ${state.duration} load in service class ${state.service}, γM = 1.3`, c:'EN 1995-1-1 Table 3.1, UK NA' },
      { t:`kh = min((150/h)^0.2, 1.3) = ${fmt(r.k_h, 3)}, ksys = ${fmt(r.ks, 2)}, fm,d = ${fmt(r.fmd, 3)} MPa`, c:'3.2(3), 6.6' },
      { t:`M = γF w L²/8 = ${fmt(r.a.M, 3)} kNm, σm = ${fmt(r.sm, 3)} MPa`, c:'' },
      { t:`σm,crit = 0.78 b² E0,05/(h lef) = ${fmt(r.scrit, 2)} MPa, λrel,m = ${fmt(r.lamM, 3)}, kcrit = ${fmt(r.kcr, 3)}`, c:'6.3.3' },
      { t:`τ = 1.5V/(kcr b h) = ${fmt(r.tau, 3)} MPa against fv,d = ${fmt(r.fvd, 3)}`, c:'6.1.7' },
      { t:`σc,90 = F/(b lef) with lef = ${r.lb} mm, ${fmt(r.sc90, 3)} MPa against kc,90 fc,90,d = ${fmt(r.fc90d * state.kc90, 3)}`, c:'6.1.5' },
      state.Nk > 0 ? { t:`λrel,y = ${fmt(r.lry, 3)}, λrel,z = ${fmt(r.lrz, 3)}, kc = ${fmt(Math.min(r.kcy, r.kcz), 3)}, 6.23/6.24 = ${fmt(r.u.comp, 3)}`, c:'6.3.2' }
        : { t:'No axial load', c:'' }
    ] : [
      { t:`Grade stresses for ${state.cls}: bending ${r.c.m}, shear ${r.c.v}, compression ${r.c.c}, across the grain ${r.c.cp} MPa`, c:'BS 5268-2 Table 8' },
      { t:`K3 = ${r.k3}, K7 = ${fmt(r.k7, 3)}, K8 = ${fmt(r.k8, 2)}${r.wet ? ', K2 for wet exposure' : ''}, σm,adm = ${fmt(r.smAdm, 3)} MPa`, c:'2.8, 2.9, 2.10.6' },
      { t:`Working M = w L²/8 = ${fmt(r.a.M, 3)} kNm, σm = ${fmt(r.sm, 3)} MPa`, c:'' },
      { t:`h/b = ${fmt(r.hb, 2)} against ${r.lim} for this lateral support`, c:'Table 19' },
      state.Nk > 0 ? { t:`λ = ${fmt(r.lam, 1)}, σe = ${fmt(r.se, 2)}, η = ${fmt(r.eta, 3)}, K12 = ${fmt(r.K12, 3)}`, c:'Annex B' } : { t:'No axial load', c:'' }
    ]);
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
      select('code', 'Code', [['ec5', 'EN 1995-1-1 with UK NA'], ['bs', 'BS 5268-2']], state.code) +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      '<h3 style="margin-top:16px">Timber</h3>' +
      select('cls', 'Strength class', Object.keys(TimberEngine.CLASSES).map(k => [k, k]), state.cls) +
      select('duration', 'Load duration', [['permanent', 'Permanent'], ['long', 'Long term'], ['medium', 'Medium term'],
        ['short', 'Short term'], ['inst', 'Instantaneous']], state.duration) +
      select('service', 'Service class', [[1, '1, heated indoors'], [2, '2, covered and unheated'], [3, '3, exposed outdoors']], state.service) +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="ksys"${state.ksys ? ' checked' : ''}> Load sharing system, four or more members</label>` +
      '<h3>Section and span</h3>' +
      slider('b', 'Breadth b (mm)', 35, 250, 1) + slider('h', 'Depth h (mm)', 50, 400, 1) + slider('L', 'Span or height (m)', 0.5, 8, 0.05) +
      '<h3>Characteristic actions</h3>' +
      slider('wk', 'UDL w (kN/m)', 0, 20, 0.1) + slider('Nk', 'Axial N, compression + (kN)', -80, 150, 1) +
      slider('gF', 'γF for EC5', 1.0, 1.6, 0.05) +
      '<h3>Support and restraint</h3>' +
      slider('lb', 'Bearing length (mm)', 20, 200, 5) + slider('kLe', 'Effective length factor', 0.5, 2.5, 0.05) +
      slider('kc90', 'kc,90 bearing factor', 1, 1.75, 0.05) +
      select('lateral', 'Lateral support for BS 5268', [['none', 'None, h/b ≤ 2'], ['ends', 'Ends held, ≤ 3'],
        ['edge', 'Compression edge held, ≤ 4'], ['joists', 'Joists and blocking, ≤ 5'], ['both', 'Both edges held, ≤ 6']], state.lateral);
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
    markCustom();
    render();
  });
  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'preset') {
      if (PRESETS[t.value]) { Object.assign(state, PRESETS[t.value].f()); state.preset = t.value; renderControls(); }
      render(); return;
    }
    if (t.id === 'code') { state.code = t.value; render(); return; }
    if (t.id === 'ksys') { state.ksys = t.checked; markCustom(); render(); return; }
    if (t.tagName === 'SELECT') { state[t.id] = t.id === 'service' ? +t.value : t.value; markCustom(); render(); }
  });
  controls.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    controls.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('ghost', x.dataset.tab !== state.tab));
    render();
  });

  renderControls();
  render();
})();
