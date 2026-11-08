/* CivilLab · St2 Steel Connection Designer */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { steel:'S275', d:20, grade:'8.8', nr:3, nc:1, p:70, g:60, e1:40, e2:40, t:10, planes:1,
                 V:200, ecc:0, N:0, tp:15, mT:40, nT:40, leff:150, boltsT:2,
                 s:8, L:200, b:150, Vw:150, eccW:100,
                 colIdx:2, B:450, D:450, tpB:20, fck:30, padRatio:1, NEd:1500 };
  const PRESETS = {
    fin:     { label:'Fin plate, three bolts', f:()=>Object.assign({}, base, { tab:'bolts', V:220, ecc:0 }) },
    ecc:     { label:'Eccentric bolt group', f:()=>Object.assign({}, base, { tab:'bolts', nr:3, nc:2, V:150, ecc:120 }) },
    tstub:   { label:'End plate in tension', f:()=>Object.assign({}, base, { tab:'bolts', nr:2, nc:2, V:60, ecc:0, N:220, tp:12 }) },
    bracket: { label:'Welded bracket', f:()=>Object.assign({}, base, { tab:'welds' }) },
    base:    { label:'Column base plate', f:()=>Object.assign({}, base, { tab:'base', tpB:25 }) }
  };
  const TABS = { bolts:'Bolt group', welds:'Welds', base:'Base plate' };
  const state = Object.assign({ preset:'fin', code:'ec3' }, PRESETS.fin.f());

  const boltsFor = code => ConnEngine.boltGroup(Object.assign({}, state, { code }));
  const weldFor = code => ConnEngine.weld({ code, steel:state.steel, s:state.s, L:state.L, b:state.b, V:state.Vw, ecc:state.eccW });
  const baseFor = code => ConnEngine.basePlate({ code, colIdx:state.colIdx, B:state.B, D:state.D, tp:state.tpB,
    steel:state.steel, fck:state.fck, padRatio:state.padRatio, NEd:state.NEd });

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

  /* ---------- bolt group ---------- */
  function drawBolts(r) {
    const ec = r.code === 'ec3';
    title(`Bolt group, M${state.d} grade ${state.grade}, ${state.nr} × ${state.nc}`);
    const W = 2 * state.e2 + (state.nc - 1) * state.g, H = 2 * state.e1 + (state.nr - 1) * state.p;
    const k = Math.min(300 / H, 230 / W, 2.2);
    const cx = 560, cy = 220;
    const x0 = cx - W * k / 2, y0 = cy - H * k / 2;
    add(s('rect', { x:x0 - 60, y:y0 - 30, width:60, height:H * k + 60, fill:'url(#hatch)', stroke:C.ocean }));
    add(txt(x0 - 30, y0 + H * k + 48, 'supporting member', { fs:10 }));
    add(s('rect', { x:x0, y:y0, width:W * k, height:H * k, fill:'#E9EDE6', stroke:C.ocean, 'stroke-width':1.4 }));
    /* block tearing: shear down the first bolt column, tension out to the free edge */
    if (state.nr >= 1) {
      const bx = cx + (-(state.nc - 1) / 2) * state.g * k;
      const yTop = y0, yBot = cy + ((state.nr - 1) / 2) * state.p * k;
      add(s('path', { d:`M${bx},${yTop} L${bx},${yBot} L${x0 + W * k},${yBot}`, fill:'none', stroke:C.load,
        'stroke-width':1.6, 'stroke-dasharray':'6 4' }));
      add(txt(bx - 6, (yTop + yBot) / 2, 'shear plane', { an:'end', fs:10, fill:C.load, rot:-90 }));
      add(txt((bx + x0 + W * k) / 2, yBot + 18, 'tension plane', { fs:10, fill:C.load }));
    }
    const sc = 60 / Math.max(r.pg.Fmax, 1e-9);
    r.pg.bolts.forEach(b => {
      const bx = cx + b.x * k, by = cy - b.y * k, crit = b === r.pg.crit;
      add(s('circle', { cx:bx, cy:by, r:r.d0 * k / 2, fill:'#fff', stroke:C.ocean, 'stroke-width':1.2 }));
      add(s('circle', { cx:bx, cy:by, r:state.d * k / 2, fill: crit ? C.load : C.ocean, 'fill-opacity': crit ? .85 : .7 }));
      add(line(bx, by, bx + b.Fx * sc, by - b.Fy * sc, { stroke: crit ? C.load : C.green, 'stroke-width':1.8, 'marker-end': crit ? 'url(#aLoad)' : 'url(#aGrn)' }));
    });
    const c = r.pg.crit;
    add(txt(cx + c.x * k + c.Fx * sc + 6, cy - c.y * k - c.Fy * sc + 14, `${fmt(c.F, 1)} kN`, { an:'start', fs:11, fw:600, fill:C.load }));
    /* the applied load at its eccentricity */
    const lx = cx + state.ecc * k;
    add(line(lx, y0 - 50, lx, y0 - 8, { stroke:C.load, 'stroke-width':2.6, 'marker-end':'url(#aLoad)' }));
    add(txt(lx, y0 - 56, `V = ${fmt(state.V, 0)} kN`, { fs:11, fw:600, fill:C.load }));
    if (Math.abs(state.ecc) > 0.5) {
      add(line(cx, y0 - 22, lx, y0 - 22, { stroke:C.ocean, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
      add(txt((cx + lx) / 2, y0 - 26, `e = ${fmt(state.ecc, 0)}`, { fs:10, fill:C.ocean }));
    }
    add(s('circle', { cx, cy, r:3, fill:C.ocean }));
    add(txt(390, 470, `Direct V/n = ${fmt(state.V / r.pg.n, 1)} kN, moment V e = ${fmt(r.pg.M / 1000, 2)} kNm, Σr² = ${fmt(r.pg.Ip, 0)} mm²`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
    if (ec && state.N > 0) add(txt(390, 492, `T-stub in tension: mode 1 ${fmt(r.FT1, 0)}, mode 2 ${fmt(r.FT2, 0)}, mode 3 ${fmt(r.FT3, 0)} kN, mode ${r.mode} governs`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
    /* the T-stub sketch on the right */
    if (ec && state.N > 0) {
      const tx = 820, ty = 360, m = state.mT * 0.8, n = state.nT * 0.8;
      add(s('rect', { x:tx - 5, y:ty - 60, width:10, height:60, fill:'#E9EDE6', stroke:C.ocean }));
      add(s('rect', { x:tx - m - n, y:ty, width:2 * (m + n), height:Math.max(6, state.tp * 0.8), fill:'#E9EDE6', stroke:C.ocean }));
      [-1, 1].forEach(sg => {
        add(line(tx + sg * m, ty - 14, tx + sg * m, ty + 26, { stroke:C.ocean, 'stroke-width':4 }));
        if (r.mode < 3) add(line(tx + sg * (m + n), ty + 34, tx + sg * (m + n), ty + 14, { stroke:C.green, 'stroke-width':1.6, 'marker-end':'url(#aGrn)' }));
      });
      add(line(tx, ty - 90, tx, ty - 64, { stroke:C.load, 'stroke-width':2.4, 'marker-start':'url(#aLoad)' }));
      add(txt(tx, ty - 96, `N = ${fmt(state.N, 0)} kN`, { fs:10.5, fill:C.load }));
      add(txt(tx, ty + 56, r.mode < 3 ? `mode ${r.mode}, prying Q at the edges` : 'mode 3, bolts fail first', { fs:10.5, fill:C.green }));
    }
  }

  /* ---------- welds ---------- */
  function drawWelds(r) {
    title(`Welded bracket, ${state.s} mm fillets, directional method`);
    const k = Math.min(320 / state.L, 260 / state.b, 1.6);
    const cx = 560, cy = 230;
    add(s('rect', { x:cx - state.b * k / 2 - 70, y:cy - state.L * k / 2 - 40, width:state.b * k + 140, height:state.L * k + 80,
      fill:'url(#hatch)', stroke:C.ocean }));
    add(s('rect', { x:cx - state.b * k / 2 - 6, y:cy - state.L * k / 2, width:state.b * k + 12 + state.eccW * k, height:state.L * k,
      fill:'#E9EDE6', stroke:C.ocean, 'stroke-width':1.4 }));
    [-1, 1].forEach(sg => add(line(cx + sg * state.b * k / 2, cy - state.L * k / 2, cx + sg * state.b * k / 2, cy + state.L * k / 2,
      { stroke:C.water, 'stroke-width':6, 'stroke-linecap':'round' })));
    const lx = cx + state.eccW * k;
    add(line(lx, cy - state.L * k / 2 - 60, lx, cy - state.L * k / 2 - 6, { stroke:C.load, 'stroke-width':2.6, 'marker-end':'url(#aLoad)' }));
    add(txt(lx, cy - state.L * k / 2 - 66, `V = ${fmt(state.Vw, 0)} kN`, { fs:11, fw:600, fill:C.load }));
    if (state.eccW > 0.5) {
      add(line(cx, cy - state.L * k / 2 - 24, lx, cy - state.L * k / 2 - 24, { stroke:C.ocean, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
      add(txt((cx + lx) / 2, cy - state.L * k / 2 - 28, `e = ${fmt(state.eccW, 0)}`, { fs:10, fill:C.ocean }));
    }
    /* the force per mm at the worst point, the far bottom corner */
    const px = cx + state.b * k / 2, py = cy + state.L * k / 2;
    const sc = 70 / Math.max(r.w, 1e-9);
    add(line(px, py, px - r.wx * sc, py + r.wy * sc, { stroke:C.load, 'stroke-width':2, 'marker-end':'url(#aLoad)' }));
    add(txt(px - r.wx * sc - 6, py + r.wy * sc + 14, `${fmt(r.w, 3)} kN/mm at ${fmt(r.theta * 180 / Math.PI, 0)}° to the weld`, { an:'end', fs:11, fw:600, fill:C.load }));
    add(txt(cx, cy + state.L * k / 2 + 64, `L = ${state.L} mm each side, ${state.b} mm apart`, { fs:10.5 }));
    /* throat inset */
    const ix = 830, iy = 120, ss = state.s * 6;
    add(s('polygon', { points:`${ix},${iy} ${ix},${iy + ss} ${ix + ss},${iy + ss}`, fill:C.water, 'fill-opacity':.3, stroke:C.water }));
    add(line(ix, iy + ss, ix + ss / 2, iy + ss / 2, { stroke:C.ocean, 'stroke-width':1.4 }));
    add(txt(ix - 6, iy + ss / 2, `s ${state.s}`, { an:'end', fs:10.5 }));
    add(txt(ix + ss / 2 + 6, iy + ss / 2 - 4, `a = 0.7s = ${fmt(r.a, 1)}`, { an:'start', fs:10.5, fill:C.ocean }));
    add(txt(390, 520, `Ip = ${fmt(r.Ip, 0)} mm³ for the two lines, direct ${fmt(state.Vw / r.Lw, 3)} kN/mm, resistance ${fmt(r.Rd, 3)} kN/mm`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- base plate ---------- */
  function drawBase(r) {
    title(`Column base plate, ${r.col.name} UC on C${state.fck}`);
    const k = Math.min(380 / state.D, 380 / state.B);
    const cx = 600, cy = 270;
    add(s('rect', { x:cx - state.B * k / 2, y:cy - state.D * k / 2, width:state.B * k, height:state.D * k, fill:'#F2F4F0', stroke:C.ocean, 'stroke-width':1.6 }));
    const col = r.col, c = r.c;
    const cl = (v, m) => Math.min(v, m);
    const fx = cl(c, (state.B - col.b) / 2), fyOut = cl(c, (state.D - col.h) / 2), fyIn = cl(c, (col.h - 2 * col.tf) / 2);
    [-1, 1].forEach(sg => {
      const yOuter = cy + sg * (col.h / 2 + fyOut) * k, yInner = cy + sg * (col.h / 2 - col.tf - fyIn) * k;
      add(s('rect', { x:cx - (col.b / 2 + fx) * k, y:Math.min(yOuter, yInner), width:(col.b + 2 * fx) * k, height:Math.abs(yOuter - yInner),
        fill:C.green, 'fill-opacity':.22, stroke:C.green, 'stroke-dasharray':'4 3' }));
    });
    if (r.webH > 0) add(s('rect', { x:cx - (col.tw / 2 + cl(c, (state.B - col.tw) / 2)) * k, y:cy - r.webH * k / 2,
      width:(col.tw + 2 * cl(c, (state.B - col.tw) / 2)) * k, height:r.webH * k, fill:C.green, 'fill-opacity':.22, stroke:C.green, 'stroke-dasharray':'4 3' }));
    /* the column footprint on top */
    const h = col.h * k, b = col.b * k, tw = col.tw * k, tf = col.tf * k;
    add(s('path', { d:`M${cx - b / 2},${cy - h / 2} h${b} v${tf} h${-(b - tw) / 2} v${h - 2 * tf} h${(b - tw) / 2} v${tf} h${-b} v${-tf} h${(b - tw) / 2} v${-(h - 2 * tf)} h${-(b - tw) / 2} Z`,
      fill:C.ocean, 'fill-opacity':.75 }));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => add(s('circle', { cx:cx + sx * (state.B / 2 - 40) * k, cy:cy + sy * (state.D / 2 - 40) * k, r:5, fill:'#fff', stroke:C.muted })));
    add(line(cx + b / 2, cy - h / 2 - 12, cx + b / 2 + fx * k, cy - h / 2 - 12, { stroke:C.green, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
    add(txt(cx + b / 2 + fx * k / 2, cy - h / 2 - 16, `c = ${fmt(c, 0)}`, { fs:10.5, fw:600, fill:C.green }));
    add(txt(cx, cy + state.D * k / 2 + 22, `plate ${state.B} × ${state.D} × ${state.tpB} mm`, { fs:10.5 }));
    add(txt(390, 540, `Aeff = ${fmt(r.Aeff, 0)} mm² at fjd = ${fmt(r.fjd, 2)} MPa gives ${fmt(r.NjRd, 0)} kN. A ${fmt(r.tpReq, 1)} mm plate would just carry ${fmt(state.NEd, 0)} kN.`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- left column per tab ---------- */
  function drawLeft(code) {
    const X = 26, W = 320, ec = code === 'ec3';
    let y = 30, items;
    if (state.tab === 'bolts') {
      const r = boltsFor(code), gr = ConnEngine.GRADES[state.grade];
      y = ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Bolt shear resistance', clause:'EN 1993-1-8 Table 3.4' }, [
        { sym:'αv', val:fmt(gr.av, 1) }, { sym:'fub', val:String(gr.fub) }, { sym:'As', val:String(r.As) },
        { op:'÷', sym:'γM2', val:'1.25' }, { op:'=', sym:'Fv,Rd kN', val:fmt(r.FvRd, 1) }])
        : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Bolt shear capacity', clause:'BS 5950-1 6.3.2' }, [
        { sym:'ps', val:String(gr.ps) }, { sym:'As', val:String(r.As) }, { op:'=', sym:'Ps kN', val:fmt(r.Ps, 1) }]);
      if (ec) y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Bearing on the ply', clause:'Table 3.4' }, [
        { sym:'k1', val:fmt(r.k1, 2) }, { sym:'αb', val:fmt(r.ab, 3) }, { sym:'fu d t', val:fmt(ConnEngine.STEEL[state.steel].fu * state.d * state.t / 1e3, 0) },
        { op:'÷', sym:'γM2', val:'1.25' }, { op:'=', sym:'Fb,Rd', val:fmt(r.FbRd, 1) }]);
      items = [
        { name:'Bolt shear, worst bolt', util:r.u.shear, clause: ec ? '3.6.1' : '6.3.2' },
        { name:'Bearing on the ply', util:r.u.bearing, clause: ec ? '3.6.1' : '6.3.3' },
        { name:'Block tearing', util:r.u.block, clause: ec ? '3.10.2' : '6.2.4' }];
      if (state.N > 0) {
        items.push({ name:'Bolt tension', util:r.u.tension, clause: ec ? '3.6.1' : '6.3.4' });
        items.push({ name:'Shear and tension together', util:r.u.combined, clause: ec ? 'Table 3.4' : '6.3.6' });
        if (ec) items.push({ name:`T-stub, mode ${r.mode}`, util:r.u.tstub, clause:'6.2.4, Table 6.2' });
      }
    } else if (state.tab === 'welds') {
      const r = weldFor(code), st = ConnEngine.STEEL[state.steel];
      y = ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Weld resistance per mm', clause:'EN 1993-1-8 4.5.3' }, [
        { sym:'fu/√3', val:fmt(st.fu / Math.sqrt(3), 0) }, { op:'÷', sym:'βw γM2', val:fmt(st.bw * 1.25, 3) },
        { sym:'a', val:fmt(r.a, 1) }, { sym:'K(θ)', val:fmt(r.K, 3) }, { op:'=', sym:'kN/mm', val:fmt(r.Rd, 3) }])
        : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Weld capacity per mm', clause:'BS 5950-1 6.8.7' }, [
        { sym:'pw', val:String(st.pw) }, { sym:'a', val:fmt(r.a, 1) }, { sym:'K', val:fmt(r.K, 3) }, { op:'=', sym:'kN/mm', val:fmt(r.Rd, 3) }]);
      items = [
        { name:'Directional method at the worst point', util:r.util, clause: ec ? '4.5.3.2' : '6.8.7.3' },
        { name:'Simplified method, for comparison', util:r.utilSimple, clause: ec ? '4.5.3.3' : '6.8.7.2' }];
    } else {
      const r = baseFor(code);
      y = ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Joint bearing strength', clause:'EN 1993-1-8 6.2.5' }, [
        { sym:'βj', val:'0.667' }, { sym:'fcd', val:fmt(0.85 * state.fck / 1.5, 2) }, { sym:'√(Ac1/Ac0)', val:fmt(Math.sqrt(Math.max(1, state.padRatio)), 2) },
        { op:'=', sym:'fjd', val:fmt(r.fjd, 2) }])
        : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Concrete bearing strength', clause:'BS 5950-1 4.13.1' }, [
        { sym:'0.6', val:'0.6' }, { sym:'fcu', val:String(state.fck + 5) }, { op:'=', sym:'w max', val:fmt(r.fjd, 1) }]);
      y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Bearing strip width', clause: ec ? '6.2.5(4)' : '4.13.2.2' }, [
        { sym:'tp', val:String(state.tpB) }, { op:'×', sym:'√(fy/3fjd)', val:fmt(r.c / state.tpB, 3) }, { op:'=', sym:'c mm', val:fmt(r.c, 1) }]);
      items = [{ name:'Plate and concrete in bearing', util:r.util, clause: ec ? '6.2.5, 6.2.8' : '4.13.2' }];
    }
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:44, title:'Checks' }, items);
    return items;
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aDim', C.ocean, 5), marker('aLoad', C.load), marker('aGrn', C.green, 5.5),
      s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse', patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));
    const code = state.code, ec = code === 'ec3', other = ec ? 'bs' : 'ec3';
    const items = drawLeft(code);
    add(line(370, 16, 370, 544, { stroke:C.hair }));
    const v = DesignKit.verdict(items);
    let html = chip('Verdict', v[0], v[1], v[2]), steps;
    if (state.tab === 'bolts') {
      const r = boltsFor(code), o = boltsFor(other);
      drawBolts(r);
      html += chip('Worst bolt', `${fmt(r.pg.Fmax, 1)} kN`, `${r.pg.n} bolts, Σr² ${fmt(r.pg.Ip, 0)} mm²`) +
        chip(ec ? 'Fv,Rd' : 'Ps', `${fmt(ec ? r.FvRd : r.Ps, 1)} kN`, `per bolt, ${state.planes} plane${state.planes > 1 ? 's' : ''}`, r.u.shear <= 1 ? 'ok' : 'warn') +
        chip(ec ? 'Fb,Rd' : 'Pbs', `${fmt(ec ? r.FbRd : r.Pbear, 1)} kN`, `${state.t} mm ${state.steel} ply`, r.u.bearing <= 1 ? 'ok' : 'warn') +
        chip(ec ? 'Block tearing' : 'Block shear', `${fmt(ec ? r.Veff : r.Pr, 0)} kN`, ec ? (Math.abs(state.ecc) > 0 ? 'eccentric, Veff,2' : 'concentric, Veff,1') : 'Pr',
             r.u.block <= 1 ? 'ok' : 'warn') +
        (state.N > 0 ? chip(ec ? 'Ft,Rd' : 'Pnom', `${fmt(ec ? r.FtRd : r.Pnom, 1)} kN`, `Ft,Ed = ${fmt(r.Ft, 1)} kN per bolt`, r.u.tension <= 1 ? 'ok' : 'warn') : '') +
        (state.N > 0 && ec ? chip('T-stub', `${fmt(r.FT, 0)} kN`, `mode ${r.mode}`, r.u.tstub <= 1 ? 'ok' : 'warn') : '') +
        chip(ec ? 'BS 5950 worst' : 'EC3 worst', `${fmt(Math.max(...Object.values(o.u)) * 100, 0)}%`, 'same group');
      steps = ec ? [
        { t:`Polar analysis: V/n = ${fmt(state.V / r.pg.n, 2)} kN, M = V e = ${fmt(r.pg.M / 1e3, 3)} kNm, worst bolt ${fmt(r.pg.Fmax, 2)} kN`, c:'elastic method' },
        { t:`Fv,Rd = αv fub As / γM2 = ${ConnEngine.GRADES[state.grade].av} × ${ConnEngine.GRADES[state.grade].fub} × ${r.As} / 1.25 = ${fmt(r.FvRd, 2)} kN`, c:'Table 3.4' },
        { t:`αd = ${fmt(r.ad, 3)}, αb = ${fmt(r.ab, 3)}, k1 = ${fmt(r.k1, 3)}, Fb,Rd = ${fmt(r.FbRd, 2)} kN`, c:'Table 3.4' },
        { t:`Ant = ${fmt(r.Ant, 0)}, Anv = ${fmt(r.Anv, 0)} mm², Veff = ${fmt(r.Veff, 1)} kN`, c:'3.10.2' },
        state.N > 0 ? { t:`T-stub Mpl = ${fmt(r.Mpl, 3)} kNm, FT,1 = ${fmt(r.FT1, 1)}, FT,2 = ${fmt(r.FT2, 1)}, FT,3 = ${fmt(r.FT3, 1)} kN`, c:'Table 6.2' } : { t:'No tension applied', c:'' }
      ] : [
        { t:`Worst bolt ${fmt(r.pg.Fmax, 2)} kN, Ps = ${fmt(r.Ps, 2)} kN`, c:'BS 5950-1 6.3.2' },
        { t:`Pbb = ${fmt(r.Pbb, 1)} kN, Pbs = ${fmt(r.Pbs, 1)} kN`, c:'6.3.3' },
        { t:`Block shear Pr = 0.6 py t [Lv + Ke(Lt − kD)] = ${fmt(r.Pr, 1)} kN`, c:'6.2.4' }
      ];
    } else if (state.tab === 'welds') {
      const r = weldFor(code), o = weldFor(other);
      drawWelds(r);
      html += chip('Throat a', `${fmt(r.a, 1)} mm`, `${state.s} mm leg`) +
        chip('Force at worst point', `${fmt(r.w, 3)} kN/mm`, `θ = ${fmt(r.theta * 180 / Math.PI, 1)}° to the weld`) +
        chip('Resistance', `${fmt(r.Rd, 3)} kN/mm`, `K = ${fmt(r.K, 3)}`, r.util <= 1 ? 'ok' : 'warn') +
        chip('Simplified', `${fmt(r.simple, 3)} kN/mm`, `utilisation ${fmt(r.utilSimple * 100, 0)}%`) +
        chip(ec ? 'BS 5950 weld' : 'EC3 weld', `${fmt(o.util * 100, 0)}%`, `${fmt(o.Rd, 3)} kN/mm`);
      steps = [
        { t:`a = 0.7 s = ${fmt(r.a, 2)} mm, Ip = 2(L³/12 + L(b/2)²) = ${fmt(r.Ip, 0)} mm³`, c:'' },
        { t:`At the worst point wx = M(L/2)/Ip = ${fmt(r.wx, 4)}, wy = V/2L + M(b/2)/Ip = ${fmt(r.wy, 4)}, w = ${fmt(r.w, 4)} kN/mm`, c:'elastic method' },
        { t: ec ? `Resistance fu a / (βw γM2 √(2 sin²θ + 3 cos²θ)) = ${fmt(r.Rd, 4)} kN/mm` : `pw a K = ${fmt(r.Rd, 4)} kN/mm`, c: ec ? '4.5.3.2' : '6.8.7.3' }];
    } else {
      const r = baseFor(code), o = baseFor(other);
      drawBase(r);
      html += chip(ec ? 'fjd' : 'Bearing w', `${fmt(r.fjd, 2)} MPa`, ec ? '(2/3) fcd √(Ac1/Ac0)' : '0.6 fcu') +
        chip('c', `${fmt(r.c, 1)} mm`, `tp ${state.tpB} mm, fy ${r.fyp} MPa`) +
        chip('Aeff', `${fmt(r.Aeff / 1e3, 1)}×10³ mm²`, 'T strips around the profile') +
        chip(ec ? 'Nj,Rd' : 'Capacity', `${fmt(r.NjRd, 0)} kN`, `NEd ${fmt(state.NEd, 0)} kN`, r.util <= 1 ? 'ok' : 'warn') +
        chip('Plate needed', `${fmt(r.tpReq, 1)} mm`, 'to just carry NEd') +
        chip(ec ? 'BS 5950 capacity' : 'EC3 Nj,Rd', `${fmt(o.NjRd, 0)} kN`, `plate needed ${fmt(o.tpReq, 1)} mm`);
      steps = [
        { t: ec ? `fjd = (2/3) × ${fmt(0.85 * state.fck / 1.5, 2)} × √${fmt(Math.max(1, state.padRatio), 2)} = ${fmt(r.fjd, 3)} MPa` : `w = 0.6 fcu = ${fmt(r.fjd, 2)} MPa`, c: ec ? '6.2.5(7), EN 1992 6.7' : '4.13.1' },
        { t:`c = ${state.tpB} × √(${r.fyp} / (3 × ${fmt(r.fjd, 3)})) = ${fmt(r.c, 2)} mm`, c: ec ? '6.2.5(4)' : '4.13.2.2' },
        { t:`Aeff = ${fmt(r.Aeff, 0)} mm², capacity = ${fmt(r.NjRd, 1)} kN`, c: ec ? '6.2.8.2' : '4.13.2.2' }];
    }
    resultsEl.innerHTML = html;
    DesignKit.trail(trailEl, 'Show the working', steps);
  }

  /* ---------- controls ---------- */
  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  const select = (id, label, opts, cur) => `<div class="ctl"><label for="${id}">${label}</label><select id="${id}">` +
    opts.map(o => `<option value="${o[0]}"${String(cur) === String(o[0]) ? ' selected' : ''}>${o[1]}</option>`).join('') + '</select></div>';

  function renderControls() {
    let body = '';
    if (state.tab === 'bolts') body =
      select('d', 'Bolt size', Object.keys(ConnEngine.BOLTS).map(d => [d, `M${d}`]), state.d) +
      select('grade', 'Bolt grade', [['4.6', '4.6'], ['8.8', '8.8'], ['10.9', '10.9']], state.grade) +
      select('planes', 'Shear planes', [[1, 'Single'], [2, 'Double']], state.planes) +
      slider('nr', 'Rows', 1, 6, 1) + slider('nc', 'Columns', 1, 3, 1) +
      slider('p', 'Pitch p (mm)', 40, 120, 5) + slider('g', 'Gauge g (mm)', 40, 140, 5) +
      slider('e1', 'End distance e1 (mm)', 25, 80, 1) + slider('e2', 'Edge distance e2 (mm)', 25, 80, 1) +
      slider('t', 'Ply thickness (mm)', 6, 30, 1) +
      '<h3>Loads</h3>' + slider('V', 'Shear V (kN)', 0, 800, 5) + slider('ecc', 'Eccentricity e (mm)', 0, 300, 5) +
      slider('N', 'Tension N (kN)', 0, 800, 5) +
      '<h3>End plate T-stub</h3>' + slider('tp', 'Plate thickness (mm)', 6, 40, 1) +
      slider('mT', 'm, bolt to weld (mm)', 20, 100, 1) + slider('nT', 'n, bolt to edge (mm)', 20, 100, 1) +
      slider('leff', 'Effective length (mm)', 60, 400, 5);
    else if (state.tab === 'welds') body =
      slider('s', 'Leg length s (mm)', 4, 16, 1) + slider('L', 'Weld length each side (mm)', 50, 500, 5) +
      slider('b', 'Distance apart b (mm)', 50, 400, 5) +
      '<h3>Load</h3>' + slider('Vw', 'V (kN)', 0, 800, 5) + slider('eccW', 'Eccentricity e (mm)', 0, 400, 5);
    else body =
      select('colIdx', 'Column', SteelEngine.TABLE.UC.map((r, i) => [i, `${r[0]} UC`]), state.colIdx) +
      slider('B', 'Plate width (mm)', 200, 900, 10) + slider('D', 'Plate depth (mm)', 200, 900, 10) +
      slider('tpB', 'Plate thickness (mm)', 10, 80, 1) + slider('fck', 'Grout and pad fck (MPa)', 20, 50, 5) +
      slider('padRatio', 'Pad to plate area Ac1/Ac0', 1, 9, 0.1) +
      '<h3>Load</h3>' + slider('NEd', 'Axial NEd (kN)', 100, 6000, 10);
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      select('code', 'Code', [['ec3', 'EN 1993-1-8 with UK NA'], ['bs', 'BS 5950-1:2000']], state.code) +
      select('steel', 'Plate steel', [['S275', 'S275'], ['S355', 'S355']], state.steel) +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      `<h3 style="margin-top:16px">${TABS[state.tab]}</h3>` + body;
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
    if (t.tagName === 'SELECT') {
      state[t.id] = ['d', 'planes', 'colIdx'].includes(t.id) ? +t.value : t.value;
      markCustom();
      render();
    }
  });
  controls.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    renderControls();
    render();
  });

  renderControls();
  render();
})();
