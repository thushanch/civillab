/* CivilLab · C3 RC Slab Designer */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const tableWrap = document.getElementById('tablewrap');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { cover:25, fck:30, fyk:500, pos:'int', c1:400, c2:400, VEd:500, rho:0.8 };
  const PRESETS = {
    oneway: { label:'One way continuous floor', f:()=>Object.assign({}, base, { tab:'panel', type:'one', support:'cont',
              caseId:1, lx:4, ly:12, h:175, phi:10, gsup:1.5, qk:3 }) },
    twoway: { label:'Two way corner panel', f:()=>Object.assign({}, base, { tab:'panel', type:'two', support:'ss',
              caseId:4, lx:5, ly:6, h:200, phi:12, gsup:1.5, qk:3 }) },
    ss:     { label:'Simply supported two way', f:()=>Object.assign({}, base, { tab:'panel', type:'two', support:'ss',
              caseId:0, lx:4.5, ly:6, h:175, phi:10, gsup:1.2, qk:2.5 }) },
    flat:   { label:'Flat slab, interior column', f:()=>Object.assign({}, base, { tab:'punch', type:'two', support:'ss',
              caseId:1, lx:6, ly:6, h:250, phi:16, gsup:1.5, qk:4, VEd:700, rho:1.0 }) },
    edge:   { label:'Flat slab, edge column', f:()=>Object.assign({}, base, { tab:'punch', type:'two', support:'ss',
              caseId:3, lx:6, ly:6, h:250, phi:16, gsup:1.5, qk:4, pos:'edge', VEd:380, rho:1.0 }) }
  };
  const state = Object.assign({ preset:'oneway', code:'ec2' }, PRESETS.oneway.f());

  const solveFor = code => SlabEngine.solve(Object.assign({}, state, { code }));
  const punchFor = (code, r) => SlabEngine.punch({ code, pos:state.pos, c1:state.c1, c2:state.c2,
    d:(r.dx + r.dy) / 2, VEd:state.VEd, fck:state.fck, fyk:state.fyk, rhoL:state.rho / 100 });

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
  const barTxt = st => `H${state.phi} @ ${st.s}`;
  const steelFit = r => Math.max(...r.strips.map(st => st.AsUse / st.AsProv));

  /* ---------- panel in plan ---------- */
  function drawPanel(r) {
    const BX = 400, BY = 64, BW = 520, BH = 420;
    const two = state.type === 'two';
    const lx = r.lx, ly = two ? r.ly : Math.max(r.lx * 1.4, 1);
    const sc = Math.min(BW / lx, BH / ly) * 0.8;
    const w = lx * sc, h = ly * sc;
    const x0 = BX + (BW - w) / 2, y0 = BY + (BH - h) / 2;
    const title = two ? `${SlabEngine.CASES[state.caseId].name}, ly/lx = ${fmt(r.ratio, 2)}`
                      : `One way slab, ${state.support === 'cont' ? 'continuous over several spans' : 'simply supported'}`;
    add(txt(BX, 30, title, { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    if (two && r.coeffs.clamped)
      add(txt(BX, 48, 'ly/lx is past 2, so this panel really spans one way. The 2.0 coefficients are used.',
        { an:'start', fs:11, fill:C.load, halo:0 }));

    add(s('defs', {}, s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse',
      patternTransform:'rotate(45)' }, s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));
    add(s('rect', { x:x0, y:y0, width:w, height:h, fill:'#FBFCFA' }));

    const disc = two ? SlabEngine.CASES[state.caseId].disc
                     : (state.support === 'cont' ? ['top', 'bottom'] : ['left', 'right', 'top', 'bottom']);
    const oneFree = !two;
    const edges = { left:[x0, y0, x0, y0 + h], right:[x0 + w, y0, x0 + w, y0 + h],
                    top:[x0, y0, x0 + w, y0], bottom:[x0, y0 + h, x0 + w, y0 + h] };
    const band = 14;
    Object.keys(edges).forEach(k => {
      const e = edges[k], cont = disc.indexOf(k) < 0;
      if (oneFree && (k === 'top' || k === 'bottom')) {
        add(line(...e, { stroke:C.contour, 'stroke-width':1.2, 'stroke-dasharray':'6 4' }));
        return;
      }
      if (cont) {
        const bx = k === 'left' ? x0 - band : k === 'right' ? x0 + w : x0;
        const by = k === 'top' ? y0 - band : k === 'bottom' ? y0 + h : y0;
        add(s('rect', { x:bx, y:by, width: k === 'left' || k === 'right' ? band : w,
          height: k === 'top' || k === 'bottom' ? band : h, fill:'url(#hatch)' }));
        add(line(...e, { stroke:C.ocean, 'stroke-width':4 }));
      } else {
        add(line(...e, { stroke:C.ocean, 'stroke-width':1.6 }));
      }
    });
    if (!two && state.support === 'cont') {
      add(txt(x0 - band - 6, y0 + h / 2, 'next span', { fs:10, rot:-90 }));
      add(txt(x0 + w + band + 12, y0 + h / 2, 'next span', { fs:10, rot:-90 }));
    }

    /* bottom bars across the middle, spacing to scale */
    const strip = (dir, st, col, dash) => {
      if (!st) return;
      const sp = st.s / 1000 * sc;
      if (dir === 'x') {
        for (let y = y0 + h * 0.18; y <= y0 + h * 0.82; y += Math.max(sp, 3))
          add(line(x0 + 6, y, x0 + w - 6, y, { stroke:col, 'stroke-width':1, 'stroke-opacity':.55, 'stroke-dasharray':dash || null }));
      } else {
        for (let x = x0 + w * 0.18; x <= x0 + w * 0.82; x += Math.max(sp, 3))
          add(line(x, y0 + 6, x, y0 + h - 6, { stroke:col, 'stroke-width':1, 'stroke-opacity':.4, 'stroke-dasharray':dash || null }));
      }
    };
    const get = k => r.strips.find(st => st.key === k);
    const sagX = r.strips.find(st => st.dir === 'x' && st.sag);
    const sagY = r.strips.find(st => st.dir === 'y');
    strip('x', sagX, C.water);
    strip('y', sagY, C.midblue);

    /* top bars at continuous edges, out to about 0.25 lx */
    const hogX = two ? get('sxN') : get('firstSup');
    const hogY = two ? get('syN') : null;
    const topBars = (k, st) => {
      if (!st || disc.indexOf(k) >= 0 || (oneFree && (k === 'top' || k === 'bottom'))) return;
      const reach = 0.25 * lx * sc, sp = Math.max(st.s / 1000 * sc, 3);
      if (k === 'left' || k === 'right') {
        const xa = k === 'left' ? x0 : x0 + w - reach;
        for (let y = y0 + 8; y <= y0 + h - 8; y += sp)
          add(line(xa, y, xa + reach, y, { stroke:C.green, 'stroke-width':1.4, 'stroke-opacity':.7 }));
      } else {
        const ya = k === 'top' ? y0 : y0 + h - reach;
        for (let x = x0 + 8; x <= x0 + w - 8; x += sp)
          add(line(x, ya, x, ya + reach, { stroke:C.green, 'stroke-width':1.4, 'stroke-opacity':.7 }));
      }
    };
    ['left', 'right'].forEach(k => topBars(k, hogX));
    ['top', 'bottom'].forEach(k => topBars(k, hogY));

    /* moment labels on each strip */
    const cx = x0 + w / 2, cy = y0 + h / 2;
    add(line(x0 + 20, cy, x0 + w - 20, cy, { stroke:C.ocean, 'stroke-width':1.6, 'marker-start':'url(#aOc)', 'marker-end':'url(#aOc)' }));
    if (sagX) {
      add(txt(cx, cy - 10, two ? `msx = ${fmt(sagX.coef, 3)} n lx² = ${fmt(sagX.M, 1)} kNm/m`
        : `${state.support === 'cont' ? 'end span 0.086 FL' : 'wL²/8'} = ${fmt(sagX.M, 1)} kNm/m`, { fs:11.5, fw:600, fill:C.ocean }));
      add(txt(cx, cy + 18, `${barTxt(sagX)} bottom, outer layer`, { fs:11, fill:C.water }));
    }
    if (two && sagY) {
      add(line(cx, y0 + 20, cx, y0 + h - 20, { stroke:C.midblue, 'stroke-width':1.3, 'marker-start':'url(#aMb)', 'marker-end':'url(#aMb)' }));
      add(txt(cx + 8, y0 + h * 0.28, `msy = ${fmt(sagY.coef, 3)} n lx² = ${fmt(sagY.M, 1)}`, { an:'start', fs:11, fill:C.midblue, fw:600 }));
      add(txt(cx + 8, y0 + h * 0.28 + 16, `${barTxt(sagY)} bottom, inner layer`, { an:'start', fs:10.5, fill:C.midblue }));
    } else if (sagY) {
      add(txt(cx, y0 + h - 24, `distribution ${barTxt(sagY)}`, { fs:10.5, fill:C.midblue }));
    }
    if (hogX && disc.indexOf('right') < 0)
      add(txt(x0 + w - 8, y0 + 22, `hogging ${fmt(hogX.M, 1)} kNm/m, ${barTxt(hogX)} top`,
        { an:'end', fs:10.5, fill:C.green, fw:600 }));
    else if (hogX && disc.indexOf('left') < 0)
      add(txt(x0 + 8, y0 + 22, `hogging ${fmt(hogX.M, 1)} kNm/m, ${barTxt(hogX)} top`,
        { an:'start', fs:10.5, fill:C.green, fw:600 }));
    if (hogY && disc.indexOf('top') < 0)
      add(txt(cx, y0 - band - 6, `hogging ${fmt(hogY.M, 1)} kNm/m, ${barTxt(hogY)} top`, { fs:10.5, fill:C.green, fw:600 }));

    /* dimensions */
    add(line(x0, y0 + h + 30, x0 + w, y0 + h + 30, { stroke:C.axis, 'marker-start':'url(#aAx)', 'marker-end':'url(#aAx)' }));
    add(txt(cx, y0 + h + 46, two ? `lx = ${fmt(r.lx, 2)} m` : `L = ${fmt(r.lx, 2)} m`, { fs:11 }));
    if (two) {
      add(line(x0 + w + 30, y0, x0 + w + 30, y0 + h, { stroke:C.axis, 'marker-start':'url(#aAx)', 'marker-end':'url(#aAx)' }));
      add(txt(x0 + w + 46, cy, `ly = ${fmt(r.ly, 2)} m`, { fs:11, rot:-90 }));
    }
    const ly0 = 520;
    add(line(BX, ly0, BX + 22, ly0, { stroke:C.ocean, 'stroke-width':4 }));
    add(txt(BX + 28, ly0 + 4, 'continuous edge', { an:'start', fs:10.5, halo:0 }));
    add(line(BX + 140, ly0, BX + 162, ly0, { stroke:C.ocean, 'stroke-width':1.6 }));
    add(txt(BX + 168, ly0 + 4, 'simple support', { an:'start', fs:10.5, halo:0 }));
    add(line(BX + 270, ly0, BX + 292, ly0, { stroke:C.water, 'stroke-width':1.4 }));
    add(txt(BX + 298, ly0 + 4, 'bottom bars', { an:'start', fs:10.5, halo:0 }));
    add(line(BX + 380, ly0, BX + 402, ly0, { stroke:C.green, 'stroke-width':1.4 }));
    add(txt(BX + 408, ly0 + 4, 'top bars', { an:'start', fs:10.5, halo:0 }));
  }

  /* ---------- punching perimeters ---------- */
  function drawPunch(r, p) {
    const BX = 400, BY = 60, BW = 520, BH = 440;
    add(txt(BX, 30, `Punching, ${state.pos === 'int' ? 'interior' : state.pos} column, ` +
      (p.code === 'ec2' ? 'EN 1992-1-1 6.4' : 'BS 8110 3.7.7'), { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const d = (r.dx + r.dy) / 2;
    const reach = Math.max(p.r1, p.needLinks ? p.rout : 0) * 1.12;
    const ext = Math.max(state.c1, state.c2) / 2 + reach;
    const sc = Math.min(BW, BH) / (2 * ext) * 0.92;
    let cx = BX + BW / 2, cy = BY + BH / 2;
    /* edge columns sit against a free edge on the left, corners against left and top */
    if (state.pos !== 'int') cx = BX + 60 + state.c1 / 2 * sc;
    if (state.pos === 'corner') cy = BY + 40 + state.c2 / 2 * sc;
    const hx = state.c1 / 2 * sc, hy = state.c2 / 2 * sc;
    const slabL = state.pos === 'int' ? BX : cx - hx, slabT = state.pos === 'corner' ? cy - hy : BY;
    add(s('rect', { x:slabL, y:slabT, width:BX + BW - slabL, height:BY + BH - slabT, fill:'#FBFCFA', stroke:C.hair }));
    if (state.pos !== 'int') add(line(slabL, slabT, slabL, BY + BH, { stroke:C.ocean, 'stroke-width':2 }));
    if (state.pos === 'corner') add(line(slabL, slabT, BX + BW, slabT, { stroke:C.ocean, 'stroke-width':2 }));

    const clipId = 'slabclip';
    add(s('defs', {}, s('clipPath', { id:clipId }, s('rect', { x:slabL, y:slabT, width:BX + BW - slabL, height:BY + BH - slabT }))));
    const perim = (a, col, dash, wdt) => {
      const ap = a * sc;
      const g = s('g', { 'clip-path':`url(#${clipId})` });
      g.appendChild(s('rect', { x:cx - hx - ap, y:cy - hy - ap, width:2 * (hx + ap), height:2 * (hy + ap),
        rx: p.shape === 'round' ? ap : 0, fill:'none', stroke:col, 'stroke-width':wdt || 2, 'stroke-dasharray':dash || null }));
      add(g);
    };
    if (p.needLinks) perim(p.rout, C.green, '6 4', 1.6);
    perim(p.r1, C.ocean, null, 2.2);
    add(s('rect', { x:cx - hx, y:cy - hy, width:2 * hx, height:2 * hy, fill:C.ocean, 'fill-opacity':.85 }));
    add(txt(cx, cy + 4, `${state.c1} × ${state.c2}`, { fs:10, fill:'#fff', halo:0 }));

    /* labels on the right of each perimeter */
    const lab = (a, t1, t2, col) => {
      const x = cx + hx + a * sc + 6;
      add(txt(x, cy - 6, t1, { an:'start', fs:11, fw:600, fill:col }));
      add(txt(x, cy + 9, t2, { an:'start', fs:10.5, fill:col }));
    };
    const ec = p.code === 'ec2';
    lab(0, `u0 = ${fmt(p.u0, 0)} mm`, `v = ${fmt(p.v0, 2)} of ${fmt(p.vmax, 2)} MPa`, p.face <= 1 ? C.load : C.load);
    add(line(cx + hx, cy + 24, cx + hx + p.r1 * sc, cy + 24, { stroke:C.ocean, 'stroke-width':1, 'marker-start':'url(#aOc)', 'marker-end':'url(#aOc)' }));
    add(txt(cx + hx + p.r1 * sc / 2, cy + 38, ec ? `2d = ${fmt(2 * d, 0)}` : `1.5d = ${fmt(1.5 * d, 0)}`, { fs:10.5, fill:C.ocean }));
    const y1 = cy - hy - p.r1 * sc - 10;
    add(txt(cx, Math.max(BY + 14, y1), `${ec ? 'u1' : 'u'} = ${fmt(p.u1, 0)} mm, v = ${fmt(p.v1, 3)} against ${ec ? 'vRd,c' : 'vc'} = ${fmt(p.vc, 3)} MPa`,
      { fs:11, fw:600, fill: p.basic <= 1 ? C.green : C.load }));
    if (p.needLinks)
      add(txt(cx, Math.min(BY + BH - 8, cy + hy + p.rout * sc + 18),
        `uout = ${fmt(p.uout, 0)} mm, ${fmt(p.rout, 0)} mm from the face, links needed inside it`, { fs:11, fill:C.green }));
    add(txt(BX, 530, `VEd = ${fmt(state.VEd, 0)} kN, d = ${fmt(d, 0)} mm, ${ec ? 'β' : 'Veff factor'} = ${fmt(p.beta, 2)}, ρl = ${fmt(state.rho, 2)}%`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- left column: load chain, strength chain and the bars ---------- */
  function drawLeft(r, p) {
    const X = 26, W = 310, ec = r.code === 'ec2';
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Design load on the slab',
      clause: ec ? 'EN 1990 Eq 6.10' : 'BS 8110-1 Table 2.1' }, [
      { sym:'γG', val:fmt(r.L.gG, 2) }, { sym:'gk', val:fmt(r.gk, 2) },
      { op:'+', sym:'γQ', val:fmt(r.L.gQ, 1) }, { sym:'qk', val:fmt(r.qk, 1) },
      { op:'=', sym:'n kN/m²', val:fmt(r.n, 2) }]);
    add(txt(X, y + 4, `gk = 25 × ${fmt(state.h / 1000, 3)} self weight + ${fmt(state.gsup, 2)} finishes`,
      { an:'start', fs:10, fill:'#8A969D', halo:0 }));
    y += 18;
    let items;
    if (state.tab === 'punch') {
      if (ec) y = DesignKit.chain(fig, { x:X, y:y + 4, w:W, h:40, title:'Punching resistance', clause:'EN 1992-1-1 6.4.4' }, [
        { sym:'CRd,c', val:'0.12' }, { sym:'k', val:fmt(p.k, 3) },
        { sym:'(100ρfck)^⅓', val:fmt(Math.cbrt(100 * p.rho * state.fck), 3) },
        { op:'=', sym:'vRd,c', val:fmt(p.vc, 3) }]);
      else y = DesignKit.chain(fig, { x:X, y:y + 4, w:W, h:40, title:'Concrete shear stress', clause:'BS 8110-1 Table 3.8' }, [
        { sym:'0.79/γm', val:'0.632' }, { sym:'(100As/bd)^⅓', val:fmt(Math.cbrt(Math.min(state.rho, 3)), 3) },
        { sym:'(400/d)^¼', val:fmt(Math.pow(Math.max(400 / ((r.dx + r.dy) / 2), 1), 0.25), 3) },
        { sym:'(fcu/25)^⅓', val:fmt(Math.cbrt(Math.min(state.fck + 5, 40) / 25), 3) },
        { op:'=', sym:'vc', val:fmt(p.vc, 3) }]);
      items = [
        { name:'Column face, v0 / vmax', util:p.face, clause: ec ? '6.4.5(3)' : '3.7.7.2' },
        { name: ec ? 'Basic perimeter, vEd / vRd,c' : 'Perimeter at 1.5d, v / vc', util:p.basic, clause: ec ? '6.4.4' : '3.7.7.4' }];
      if (p.needLinks) items.push({ name:'With links, v / 2vc', util:p.maxLinks, clause: ec ? 'UK NA 6.4.5' : '3.7.7.5' });
    } else {
      const sx = r.strips.find(st => st.dir === 'x' && st.sag);
      y = DesignKit.chain(fig, { x:X, y:y + 4, w:W, h:40, title:'Lever arm, worst strip', clause: ec ? 'EC2 6.1, z ≤ 0.95d' : 'BS 3.4.4.4' }, [
        { sym:'K', val:fmt(r.worst.K, 4) }, { op:'→', sym:'z/d', val:fmt(r.worst.z / r.worst.d, 3) },
        { op:'×', sym:'d', val:fmt(r.worst.d, 0) }, { op:'=', sym:'z mm', val:fmt(r.worst.z, 0) }]);
      items = [
        { name:`Flexure, K / K′ (${r.worst.name.toLowerCase()})`, util:r.worst.util, clause: ec ? '6.1' : '3.4.4.4' },
        { name:'Span to depth, actual / allowable', util:r.dfl.util, clause: ec ? '7.4.2' : '3.4.6' }];
      if (r.shear) items.push({ name:`Shear at the ${r.shear.where}`, util:r.shear.util, clause: ec ? '6.2.2' : '3.5.5.2' });
      if (sx && r.strips.some(st => st.tooTight)) items.push({ name:'Steel fits, As,req / As,prov', util: steelFit(r),
        note: `bars no closer than 75 mm, no wider than ${fmt(r.sMain, 0)} mm`, clause: ec ? '9.3.1.1(3)' : '3.12.11.2.7' });
    }
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:40, title:'Checks' }, items);
    return items;
  }

  /* ---------- tables ---------- */
  const td = 'white-space:nowrap;padding:5px 8px;border-bottom:1px solid #DFE3DC;text-align:right;font-size:12.5px';
  const th = 'white-space:nowrap;padding:5px 8px;border-bottom:2px solid #14416B;text-align:right;font-size:11px;color:#5C6A72;font-weight:600';
  function drawTable(r, p) {
    if (state.tab === 'punch') {
      const ec = p.code === 'ec2';
      const rows = [
        ['Column face, u0', p.u0, p.v0, p.vmax, p.face, ec ? 'EN 1992-1-1 6.4.5(3)' : 'BS 8110 3.7.7.2'],
        [ec ? 'Basic perimeter u1 at 2d' : 'Perimeter at 1.5d', p.u1, p.v1, p.vc, p.basic, ec ? '6.4.2, 6.4.4' : '3.7.7.4']];
      if (p.needLinks) rows.push(['Outer perimeter uout', p.uout, p.vc, p.vc, 1, ec ? '6.4.5(4)' : '3.7.7.6']);
      tableWrap.innerHTML = `<table style="border-collapse:collapse;width:100%"><thead><tr>` +
        ['Perimeter', 'u mm', 'v MPa', 'limit MPa', 'ratio', 'clause'].map((h, i) =>
          `<th style="${th}${i === 0 ? ';text-align:left' : ''}">${h}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(rw => `<tr><td style="${td};text-align:left">${rw[0]}</td><td style="${td}">${fmt(rw[1], 0)}</td>` +
          `<td style="${td}">${fmt(rw[2], 3)}</td><td style="${td}">${fmt(rw[3], 3)}</td>` +
          `<td style="${td};color:${rw[4] <= 1 ? '#2E6B4F' : '#B03A2E'};font-weight:600">${fmt(rw[4], 2)}</td>` +
          `<td style="${td};color:#8A969D">${rw[5]}</td></tr>`).join('') + '</tbody></table>' +
        (p.needLinks && ec ? `<div style="margin-top:8px;font-size:12.5px;color:#41505A">Links: Asw/sr = (vEd − 0.75 vRd,c) u1 / (1.5 fywd,ef) = <strong>${fmt(p.AswSr, 2)} mm²/mm</strong> per perimeter, with fywd,ef = 250 + 0.25d = ${fmt(p.fywef, 0)} MPa. The last perimeter of links sits within 1.5d of uout.</div>` : '');
      return;
    }
    tableWrap.innerHTML = `<table style="border-collapse:collapse;width:100%"><thead><tr>` +
      ['Strip', 'coef', 'M kNm/m', 'd mm', 'K', 'As,req', 'As,min', 'bars', 'As,prov', 'source'].map((h, i) =>
        `<th style="${th}${i === 0 ? ';text-align:left' : ''}">${h}</th>`).join('') + '</tr></thead><tbody>' +
      r.strips.map(st => `<tr><td style="${td};text-align:left;color:${st.sag ? '#1E78B0' : '#2E6B4F'}">${st.name}${st.sag ? '' : ', top'}</td>` +
        `<td style="${td}">${st.coef ? fmt(st.coef, 3) : '–'}</td><td style="${td}">${st.M ? fmt(st.M, 1) : '–'}</td>` +
        `<td style="${td}">${fmt(st.d, 0)}</td><td style="${td}">${st.M ? fmt(st.K, 4) : '–'}</td>` +
        `<td style="${td}">${fmt(st.AsReq, 0)}</td><td style="${td}">${fmt(st.AsMin, 0)}</td>` +
        `<td style="${td};font-weight:600">${barTxt(st)}${st.tooTight ? ' ⚠' : ''}</td><td style="${td}">${fmt(st.AsProv, 0)}</td>` +
        `<td style="${td};color:#8A969D">${st.clause}</td></tr>`).join('') + '</tbody></table>';
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aOc', C.ocean, 5.5), marker('aMb', C.midblue, 5.5), marker('aAx', C.axis, 5)));
    const r = solveFor(state.code);
    const p = punchFor(state.code, r);
    const other = solveFor(state.code === 'ec2' ? 'bs' : 'ec2');
    const op = punchFor(state.code === 'ec2' ? 'bs' : 'ec2', other);
    drawLeft(r, p);
    add(line(360, 16, 360, 544, { stroke:C.hair }));
    if (state.tab === 'punch') drawPunch(r, p); else drawPanel(r);
    drawTable(r, p);

    const ec = r.code === 'ec2';
    const all = [{ name:'Flexure', util:r.worst.util }, { name:'Span to depth', util:r.dfl.util },
                 { name:'Punching at u1', util:p.basic }, { name:'Punching at the face', util:p.face }];
    if (r.shear) all.push({ name:'Shear', util:r.shear.util });
    if (r.strips.some(st => st.tooTight)) all.push({ name:'Bars too close, use a bigger bar', util:steelFit(r) });
    const v = DesignKit.verdict(all);
    const sx = r.strips.find(st => st.dir === 'x' && st.sag);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('Design load n', `${fmt(r.n, 2)} kN/m²`, ec ? '1.35gk + 1.5qk' : '1.4gk + 1.6qk') +
      chip('Main span bars', barTxt(sx), `${fmt(sx.AsProv, 0)} mm²/m for ${fmt(Math.max(sx.AsReq, sx.AsMin), 0)}`, 'ok') +
      chip('Worst K', fmt(r.worst.K, 4), `K′ = ${r.worst.Kp}`, r.worst.util <= 1 ? 'ok' : 'warn') +
      chip('L/d', `${fmt(r.dfl.actual, 1)} / ${fmt(r.dfl.allowable, 1)}`, `factor ${fmt(r.dfl.Kb, 1)} × ${fmt(r.dfl.basic, 1)} × ${fmt(r.dfl.modAs, 2)}`,
           r.dfl.ok ? 'ok' : 'warn') +
      (r.shear ? chip('Support shear', `${fmt(r.shear.V, 1)} kN/m`, `${ec ? 'VRd,c' : 'vc bd'} = ${fmt(r.shear.cap, 1)} kN/m`,
           r.shear.util <= 1 ? 'ok' : 'warn') : '') +
      chip(ec ? 'vEd,1' : 'v at 1.5d', `${fmt(p.v1, 3)} MPa`, `${ec ? 'vRd,c' : 'vc'} = ${fmt(p.vc, 3)} MPa`, p.basic <= 1 ? 'ok' : 'warn') +
      chip('Punching links', p.needLinks ? 'Needed' : 'None', p.needLinks ? `out to ${fmt(p.rout, 0)} mm from the face` : 'concrete alone is enough',
           p.needLinks ? 'warn' : 'ok') +
      chip(ec ? 'BS 8110 main bars' : 'EC2 main bars', barTxt(other.strips.find(st => st.dir === 'x' && st.sag)),
           `punching ${fmt(op.basic * 100, 0)}%`);

    const steps = [
      { t:`gk = 25 h + finishes = ${fmt(r.gk, 2)} kN/m², n = ${fmt(r.L.gG, 2)} × ${fmt(r.gk, 2)} + ${fmt(r.L.gQ, 1)} × ${fmt(r.qk, 1)} = ${fmt(r.n, 2)} kN/m²`, c: ec ? 'EN 1990 6.10' : 'BS 8110 2.4.3' },
      { t:`dx = h − c − φ/2 = ${fmt(r.dx, 0)} mm for the main bars, dy = ${fmt(r.dy, 0)} mm one bar further in`, c:'' }
    ];
    r.strips.forEach(st => { if (st.M > 0) steps.push({
      t:`${st.name}: M = ${fmt(st.coef, 3)} × ${state.type === 'two' ? 'n lx²' : 'F L'} = ${fmt(st.M, 2)} kNm/m, K = ${fmt(st.K, 4)}, z = ${fmt(st.z, 0)} mm, As = ${fmt(st.AsReq, 0)} mm²/m, use ${barTxt(st)} (${fmt(st.AsProv, 0)})`,
      c: st.clause }); });
    steps.push({ t:`L/d = ${fmt(r.dfl.actual, 1)} against ${fmt(r.dfl.Kb, 1)} × ${fmt(r.dfl.basic, 1)} × ${fmt(r.dfl.modAs, 2)} = ${fmt(r.dfl.allowable, 1)}`, c: ec ? 'EC2 7.4.2' : 'BS 3.4.6' });
    if (r.shear) steps.push({ t:`Shear ${fmt(r.shear.coef, 1)} × F = ${fmt(r.shear.V, 1)} kN/m against ${fmt(r.shear.cap, 1)} kN/m`, c: ec ? 'EC2 6.2.2' : 'BS 3.5.5.2' });
    steps.push({ t:`Punching: ${ec ? 'β' : 'factor'} ${fmt(p.beta, 2)} × ${fmt(state.VEd, 0)} kN over u = ${fmt(p.u1, 0)} mm and d = ${fmt((r.dx + r.dy) / 2, 0)} mm gives ${fmt(p.v1, 3)} MPa against ${fmt(p.vc, 3)} MPa`, c: ec ? 'EC2 6.4.3, 6.4.4' : 'BS 3.7.7.4' });
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
    const presetOpts = Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]);
    const caseOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(i => [i, `${i ? i + '. ' : ''}${SlabEngine.CASES[i].name}`]);
    controls.innerHTML =
      select('preset', 'Preset', presetOpts, state.preset) +
      select('code', 'Code', [['ec2', 'EN 1992-1-1 with UK NA'], ['bs', 'BS 8110-1']], state.code) +
      `<div class="addrow"><button class="btn small${state.tab === 'panel' ? '' : ' ghost'}" data-tab="panel">Panel</button>` +
      `<button class="btn small${state.tab === 'punch' ? '' : ' ghost'}" data-tab="punch">Punching</button></div>` +
      '<h3 style="margin-top:16px">Panel</h3>' +
      select('type', 'Spanning', [['one', 'One way'], ['two', 'Two way']], state.type) +
      (state.type === 'one'
        ? select('support', 'Supports', [['ss', 'Simply supported'], ['cont', 'Continuous, equal spans']], state.support)
        : select('caseId', 'Edge conditions', caseOpts, state.caseId)) +
      slider('lx', state.type === 'one' ? 'Span L (m)' : 'Short span lx (m)', 2, 10, 0.1) +
      (state.type === 'two' ? slider('ly', 'Long span ly (m)', 2, 14, 0.1) : '') +
      slider('h', 'Slab depth h (mm)', 100, 400, 5) + slider('cover', 'Nominal cover (mm)', 15, 50, 5) +
      slider('phi', 'Bar diameter (mm)', 8, 20, 2) +
      '<h3>Materials and loads</h3>' +
      slider('fck', 'fck (MPa)', 20, 50, 5) + slider('fyk', 'fyk (MPa)', 400, 600, 50) +
      slider('gsup', 'Finishes and services (kN/m²)', 0, 5, 0.1) + slider('qk', 'Imposed qk (kN/m²)', 0, 10, 0.5) +
      '<h3>Punching column</h3>' +
      select('pos', 'Column position', [['int', 'Interior'], ['edge', 'Edge'], ['corner', 'Corner']], state.pos) +
      slider('c1', 'c1, normal to the edge (mm)', 200, 800, 25) + slider('c2', 'c2, along the edge (mm)', 200, 800, 25) +
      slider('VEd', 'VEd (kN)', 50, 2000, 10) + slider('rho', 'Top steel ratio ρl (%)', 0.2, 2, 0.05);
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
      render();
    } else if (t.id === 'code') { state.code = t.value; render(); }
    else if (t.id === 'type') { state.type = t.value; markCustom(); renderControls(); render(); }
    else if (t.id === 'support' || t.id === 'pos') { state[t.id] = t.value; markCustom(); render(); }
    else if (t.id === 'caseId') { state.caseId = +t.value; markCustom(); render(); }
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
