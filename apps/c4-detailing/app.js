/* CivilLab · C4 Detailing, Anchorage and Durability */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { fck:30, fyk:500, bond:'good', shape:'straight', tension:true, stress:1, lapped:50,
                 welded:false, Klam:0, pressure:0, life100:false, dg:20, phiLink:10, s:150 };
  const PRESETS = {
    beam:   { label:'Beam bottom bars, XC3', f:()=>Object.assign({}, base, { tab:'anchor', member:'beam', phi:20, b:300, n:3,
              cover:35, exposure:'XC3', R:60, la:650, l0p:1000 }) },
    top:    { label:'Top bars in a deep pour', f:()=>Object.assign({}, base, { tab:'anchor', member:'beam', phi:25, b:350, n:3,
              cover:40, exposure:'XC1', R:60, bond:'poor', shape:'bent', la:900, l0p:1500 }) },
    marine: { label:'Marine pile cap, XS3', f:()=>Object.assign({}, base, { tab:'cover', member:'beam', phi:32, b:600, n:5,
              cover:50, exposure:'XS3', R:90, fck:40, la:1300, l0p:2000, dg:20 }) },
    fire:   { label:'Narrow beam, two hours fire', f:()=>Object.assign({}, base, { tab:'cover', member:'beam', phi:20, b:250, n:3,
              cover:30, exposure:'XC1', R:120, la:700, l0p:1000 }) },
    slab:   { label:'Floor slab, H12 at 150', f:()=>Object.assign({}, base, { tab:'spacing', member:'slab', phi:12, b:1000, n:7,
              cover:25, exposure:'XC1', R:60, la:450, l0p:700, s:150 }) }
  };
  const TABS = { anchor:'Anchorage and lap', cover:'Cover', spacing:'Spacing' };
  const state = Object.assign({ preset:'beam', code:'ec2' }, PRESETS.beam.f());

  const solveFor = code => DetailEngine.solve(Object.assign({}, state, { code,
    K: 1, lambda: state.Klam, b: state.member === 'slab' ? 1000 : state.b }));

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
  const dim = (x1, x2, y, label, col) => {
    add(line(x1, y, x2, y, { stroke: col || C.ocean, 'stroke-width':1, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
    add(line(x1, y - 6, x1, y + 6, { stroke: col || C.ocean, 'stroke-width':1 }));
    add(line(x2, y - 6, x2, y + 6, { stroke: col || C.ocean, 'stroke-width':1 }));
    add(txt((x1 + x2) / 2, y - 6, label, { fs:11, fw:600, fill: col || C.ocean }));
  };

  /* ---------- anchorage and lap, to scale ---------- */
  function drawAnchor(r) {
    const an = r.an, X0 = 400, X1 = 930;
    const top = Math.max(an.lbd, state.la, an.l0, state.l0p) * 1.08;
    const sc = (X1 - X0 - 70) / top;
    const tb = Math.max(3, state.phi * sc * 1.6);
    add(txt(X0, 30, 'Anchorage beyond the support face, to scale', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    /* support on the left, member running right */
    const SY = 70, SH = 120, FX = X0 + 60;
    add(s('rect', { x:X0, y:SY, width:60, height:SH + 40, fill:'url(#hatch)', stroke:C.ocean }));
    add(txt(X0 + 30, SY + SH + 58, 'support', { fs:10.5 }));
    add(s('rect', { x:FX, y:SY, width:X1 - FX, height:SH, fill:'#FBFCFA', stroke:C.ocean, 'stroke-width':1.4 }));
    const by = SY + SH - 30;
    /* the bar runs from inside the support out into the span */
    const startX = FX - Math.min(55, an.lbd * sc * 0.0);
    const endX = startX + an.lbd * sc;
    const availX = FX + state.la * sc;
    add(s('rect', { x:FX, y:SY + 4, width:Math.max(0, availX - FX), height:SH - 8, fill:C.green, 'fill-opacity':.07 }));
    add(line(availX, SY, availX, SY + SH, { stroke:C.green, 'stroke-width':1.4, 'stroke-dasharray':'5 3' }));
    const hookL = state.shape === 'bent' ? 30 : 0;
    add(s('path', { d:`M${FX + 2},${by}` + (hookL ? ` L${FX + 2},${by - hookL}` : '') ,
      fill:'none', stroke:C.ocean, 'stroke-width':tb, 'stroke-linecap':'round' }));
    add(line(FX + 2, by, Math.max(endX, FX + 2), by, { stroke:C.ocean, 'stroke-width':tb, 'stroke-linecap':'round' }));
    add(line(endX, by, X1 - 4, by, { stroke:C.ocean, 'stroke-width':tb, 'stroke-opacity':.25 }));
    /* bond stress along the anchorage, and the bar force pulling at the end */
    const nArr = Math.max(3, Math.min(14, Math.round(an.lbd * sc / 34)));
    for (let i = 0; i < nArr; i++) {
      const x = FX + 14 + (endX - FX - 20) * i / Math.max(1, nArr - 1);
      add(line(x + 10, by - tb / 2 - 3, x - 4, by - tb / 2 - 3, { stroke:C.green, 'stroke-width':1.3, 'marker-end':'url(#aGrn)' }));
    }
    add(line(endX + 8, by + 26, endX + 70, by + 26, { stroke:C.load, 'stroke-width':2.2, 'marker-end':'url(#aLoad)' }));
    const F = Math.PI * state.phi * state.phi / 4 * (r.code === 'ec2' ? an.ssd : an.fs) / 1000;
    add(txt(endX + 74, by + 30, `bar force ${fmt(F, 0)} kN`, { an:'start', fs:10.5, fill:C.load }));
    add(txt(FX + 10, SY + 18, r.code === 'ec2' ? `bond fbd = ${fmt(an.fbd, 2)} MPa` : `bond fbu = ${fmt(an.fbu, 2)} MPa`,
      { an:'start', fs:10.5, fill:C.green }));
    dim(FX, endX, SY + SH + 22, `${r.code === 'ec2' ? 'lbd' : 'l'} = ${fmt(an.lbd, 0)} mm`, an.lbd <= state.la ? C.ocean : C.load);
    dim(FX, availX, SY - 14, `available ${fmt(state.la, 0)} mm`, C.green);

    /* lap below */
    const LY = 330;
    add(txt(X0, LY - 40, `Lap between two bars, ${state.lapped}% of bars lapped at one section`,
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const LX0 = X0 + 20, l0x = an.l0 * sc, provX = state.l0p * sc;
    add(line(LX0, LY, LX0 + Math.max(l0x, provX) + 60, LY, { stroke:C.ocean, 'stroke-width':tb, 'stroke-linecap':'round' }));
    add(line(LX0 + 60, LY + tb + 3, LX0 + 60 + Math.max(l0x, provX) + 70, LY + tb + 3, { stroke:C.midblue, 'stroke-width':tb, 'stroke-linecap':'round' }));
    add(s('rect', { x:LX0 + 60, y:LY - 12, width:provX, height:tb + 26, fill:C.green, 'fill-opacity':.07, stroke:C.green, 'stroke-dasharray':'4 3' }));
    dim(LX0 + 60, LX0 + 60 + l0x, LY + 46, `l0 = ${fmt(an.l0, 0)} mm`, an.l0 <= state.l0p ? C.ocean : C.load);
    dim(LX0 + 60, LX0 + 60 + provX, LY - 24, `provided ${fmt(state.l0p, 0)} mm`, C.green);
    const rows = r.code === 'ec2' ? [
      `lb,rqd = (φ/4)(σsd/fbd) = (${state.phi}/4)(${fmt(an.ssd, 0)}/${fmt(an.fbd, 2)}) = ${fmt(an.lbrqd, 0)} mm, ${fmt(an.mult, 1)}φ`,
      `lb,min = ${fmt(an.lbmin, 0)} mm, l0,min = ${fmt(an.l0min, 0)} mm, cd = ${fmt(r.cd, 1)} mm from the section`,
      an.floorHit ? 'α2 α3 α5 has hit its floor of 0.7' : `α2 α3 α5 = ${fmt(an.a2 * an.a3 * an.a5, 3)}, not below 0.7`
    ] : [
      `l = φ fs / (4 fbu) = ${state.phi} × ${fmt(an.fs, 0)} / (4 × ${fmt(an.fbu, 2)}) = ${fmt(an.lbd, 0)} mm, ${fmt(an.mult, 1)}φ`,
      `lap factor ${fmt(an.lapF, 1)}${an.lapF > 1 ? ' for a top bar or thin cover' : ''}, minimum ${fmt(an.l0min, 0)} mm`
    ];
    rows.forEach((t, i) => add(txt(X0, 450 + i * 20, t, { an:'start', fs:11.5, fill:'#41505A', halo:0 })));
  }

  /* ---------- cover at a corner ---------- */
  function drawCover(r) {
    const cv = r.cv, X0 = 400;
    add(txt(X0, 30, `Cover to the ${state.member === 'slab' ? 'main bars' : 'links'}, ${r.code === 'ec2' ? 'EN 1992-1-1 4.4' : 'BS 8110 3.3'}`,
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    /* corner detail at 2.6 px per mm */
    const k = 2.6, CX = X0 + 20, CY = 60, W = 240;
    add(s('rect', { x:CX, y:CY, width:W, height:W, fill:'#F2F4F0', stroke:C.ocean, 'stroke-width':1.6 }));
    const link = state.member === 'slab' ? 0 : state.phiLink;
    const lx = CX + state.cover * k, ly = CY + W - state.cover * k;
    if (link) {
      add(s('path', { d:`M${lx + link * k / 2},${CY + 4} L${lx + link * k / 2},${ly - link * k / 2} L${CX + W - 4},${ly - link * k / 2}`,
        fill:'none', stroke:C.midblue, 'stroke-width':link * k, 'stroke-linejoin':'round' }));
    }
    const bx = lx + link * k + state.phi * k / 2, byy = ly - link * k - state.phi * k / 2;
    add(s('circle', { cx:bx, cy:byy, r:state.phi * k / 2, fill:C.ocean }));
    /* provided cover, then the fire axis distance */
    add(line(CX, ly + 30, lx, ly + 30, { stroke:C.ocean, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
    add(txt((CX + lx) / 2, ly + 46, `c = ${state.cover}`, { fs:11, fw:600, fill:C.ocean }));
    if (r.code === 'ec2') {
      add(line(bx, byy, bx, CY + W, { stroke:C.load, 'stroke-dasharray':'3 3' }));
      add(txt(bx + 6, (byy + CY + W) / 2 + 4, `axis ${fmt(state.cover + link + state.phi / 2, 0)}`, { an:'start', fs:10.5, fill:C.load }));
      add(txt(bx + 6, (byy + CY + W) / 2 + 18, `fire needs a = ${fmt(cv.a, 0)}`, { an:'start', fs:10.5, fill:C.load }));
    }
    add(txt(CX + W / 2, CY + W + 26, `H${state.phi}${link ? ` inside H${link} links` : ''}, drawn at ${k} px per mm`, { fs:10.5 }));

    /* requirement ladder */
    const LX = 690, LW = 230, top = Math.max(...cv.parts.map(p => isNaN(p.c) ? 0 : p.c), state.cover, cv.cnom) * 1.25;
    add(txt(LX, 74, 'What the cover must satisfy', { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
    cv.parts.forEach((p, i) => {
      const y = 92 + i * 52, gov = p.key === cv.gov;
      const w = isNaN(p.c) ? LW : Math.max(0, p.c) / top * LW;
      add(txt(LX, y, p.name, { an:'start', fs:11, fw: gov ? 600 : 400, fill: gov ? C.ocean : C.muted, halo:0 }));
      add(s('rect', { x:LX, y:y + 6, width:LW, height:16, rx:4, fill:'#F2F4F0', stroke:C.hair }));
      add(s('rect', { x:LX, y:y + 6, width:w, height:16, rx:4, fill: isNaN(p.c) ? C.load : C.water, 'fill-opacity': gov ? .5 : .22 }));
      add(txt(LX + Math.min(w, LW) + 6, y + 19, isNaN(p.c) ? 'not allowed' : `${fmt(p.c, 0)} mm`,
        { an:'start', fs:11, fw:600, fill: isNaN(p.c) ? C.load : C.ocean, halo:0 }));
    });
    const gy = 92 + cv.parts.length * 52;
    const px = LX + state.cover / top * LW, rx = LX + cv.cnom / top * LW;
    add(line(rx, 86, rx, gy, { stroke:C.ocean, 'stroke-width':2 }));
    add(txt(rx, gy + 14, `required ${fmt(cv.cnom, 0)}`, { fs:11, fw:600, fill:C.ocean }));
    add(line(px, 86, px, gy, { stroke: state.cover >= cv.cnom ? C.green : C.load, 'stroke-width':2, 'stroke-dasharray':'5 3' }));
    add(txt(px, gy + 30, `provided ${state.cover}`, { fs:11, fw:600, fill: state.cover >= cv.cnom ? C.green : C.load }));

    const rows = r.code === 'ec2' ? [
      `Structural class S${cv.S}: S4, ${state.life100 ? 'plus 2 for 100 years, ' : ''}less 1 when fck reaches the Table 4.3N class${state.member === 'slab' ? ', less 1 for slab geometry' : ''}`,
      `cmin = max(cmin,b ${cv.cminb}, cmin,dur ${cv.cdur}, 10) = ${cv.cmin} mm, cnom = cmin + Δcdev ${cv.dev} = ${cv.cmin + cv.dev} mm`,
      `Fire R${state.R}: axis distance a = ${fmt(cv.a, 0)} mm${cv.fireOk ? '' : `, and the beam is narrower than bmin = ${cv.bmin} mm`}`,
      'Table 4.4N recommended values. The UK NA uses BS 8500,',
      'which trades cover against concrete strength in more detail.'
    ] : [
      `BS 8110 Table 3.3, ${cv.cond} exposure at fcu ${cv.fcu}: ${cv.allowed ? cv.parts[1].c + ' mm' : 'this grade is not allowed'}`,
      `Table 3.4, ${state.R / 60} h fire, simply supported ${state.member}: ${cv.parts[2].c} mm`,
      'The exposure classes are mapped onto the five BS 8110 conditions approximately.'
    ];
    rows.forEach((t, i) => add(txt(X0, 400 + i * 20, t, { an:'start', fs:11.5, fill:'#41505A', halo:0 })));
  }

  /* ---------- spacing across the section ---------- */
  function drawSpacing(r) {
    const sp = r.sp, X0 = 400, X1 = 930;
    add(txt(X0, 30, state.member === 'slab' ? 'Bars across a metre of slab' : 'Bars across the beam width',
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const Bw = state.member === 'slab' ? 1000 : state.b;
    const k = Math.min((X1 - X0 - 20) / Bw, 1.4);
    const x0 = X0 + (X1 - X0 - Bw * k) / 2, y0 = 70, H = state.member === 'slab' ? 220 : Math.min(Bw * 1.2, 380) ;
    const Hp = state.member === 'slab' ? 200 * k : H * k;
    add(s('rect', { x:x0, y:y0, width:Bw * k, height:Hp, fill:'#F2F4F0', stroke:C.ocean, 'stroke-width':1.6 }));
    const by = y0 + Hp - (state.cover + (state.member === 'slab' ? 0 : state.phiLink) + state.phi / 2) * k;
    const xs = [];
    if (state.member === 'slab') {
      for (let x = state.s / 2; x < 1000; x += state.s) xs.push(x);
    } else {
      const lk = state.phiLink;
      add(s('rect', { x:x0 + (state.cover + lk / 2) * k, y:y0 + (state.cover + lk / 2) * k,
        width:(Bw - 2 * state.cover - lk) * k, height:Hp - (2 * state.cover + lk) * k, rx:(lk * 2) * k,
        fill:'none', stroke:C.midblue, 'stroke-width':Math.max(1.2, lk * k) }));
      const inner = state.cover + lk + state.phi / 2;
      for (let i = 0; i < state.n; i++) xs.push(state.n === 1 ? Bw / 2 : inner + (Bw - 2 * inner) * i / (state.n - 1));
    }
    xs.forEach(x => add(s('circle', { cx:x0 + x * k, cy:by, r:state.phi * k / 2, fill:C.ocean })));
    if (xs.length > 1) {
      const gx1 = x0 + (xs[0] + state.phi / 2) * k, gx2 = x0 + (xs[1] - state.phi / 2) * k;
      add(line(gx1, by + 30, gx2, by + 30, { stroke: sp.ok ? C.green : C.load, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
      add(txt((gx1 + gx2) / 2, by + 46, `clear ${fmt(sp.clear, 0)} mm`, { fs:11, fw:600, fill: sp.ok ? C.green : C.load }));
      add(s('circle', { cx:(gx1 + gx2) / 2, cy:by - state.phi * k / 2 - state.dg * k / 2 - 4, r:state.dg * k / 2,
        fill:C.pale, 'fill-opacity':.6, stroke:C.midblue }));
      add(txt((gx1 + gx2) / 2, by - state.phi * k - state.dg * k - 12, `${state.dg} mm stone`, { fs:10.5, fill:C.midblue }));
    }
    const ty = y0 + Hp + 80;
    const rows = [
      `Clear gap needed = max(φ, dg + 5${r.code === 'ec2' ? ', 20' : ''}) = ${fmt(sp.need, 0)} mm, ${r.code === 'ec2' ? 'EN 1992-1-1 8.2(2)' : 'BS 8110 3.12.11.1'}`,
      state.member === 'slab' ? `At ${state.s} mm centres the gap is ${fmt(sp.clear, 0)} mm`
        : `Inside the links ${fmt(sp.inside, 0)} mm, so at most ${sp.nMax} bars of H${state.phi} fit in one layer`
    ];
    rows.forEach((t, i) => add(txt(X0, Math.min(ty, 500) + i * 20, t, { an:'start', fs:11.5, fill:'#41505A', halo:0 })));
  }

  /* ---------- left column ---------- */
  function drawLeft(r) {
    const X = 26, W = 310, an = r.an, ec = r.code === 'ec2';
    let y = 30;
    if (state.tab === 'cover' && ec) {
      y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Nominal cover for bond and durability',
        clause:'EN 1992-1-1 4.4.1, fire is in the ladder' }, [
        { sym:'cmin', val:fmt(r.cv.cmin, 0) }, { op:'+', sym:'Δcdev', val:'10' },
        { op:'=', sym:'cnom', val:fmt(r.cv.cmin + r.cv.dev, 0) }]);
    } else if (ec) {
      y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Design bond stress', clause:'EN 1992-1-1 8.4.2' }, [
        { sym:'2.25', val:'2.25' }, { sym:'η1', val:fmt(an.eta1, 1) }, { sym:'η2', val:fmt(an.eta2, 2) },
        { sym:'fctd', val:fmt(an.fctd, 2) }, { op:'=', sym:'fbd', val:fmt(an.fbd, 2) }]);
      y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Anchorage, the α chain', clause:'EN 1992-1-1 8.4.4' }, [
        { sym:'lb,rqd', val:fmt(an.lbrqd, 0) }, { sym:'α1', val:fmt(an.a1, 2) }, { sym:'α2', val:fmt(an.a2, 2) },
        { sym:'α3', val:fmt(an.a3, 2) }, { sym:'α4', val:fmt(an.a4, 2) }, { sym:'α5', val:fmt(an.a5, 2) },
        { op:'=', sym:'lbd', val:fmt(an.lbd, 0) }]);
    } else {
      y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Ultimate bond stress', clause:'BS 8110-1 3.12.8.4' }, [
        { sym:'β', val:fmt(an.beta, 2) }, { sym:'√fcu', val:fmt(Math.sqrt(an.fcu), 2) }, { op:'=', sym:'fbu', val:fmt(an.fbu, 2) }]);
      y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Anchorage length', clause:'BS 8110-1 3.12.8.3' }, [
        { sym:'φ', val:String(state.phi) }, { sym:'fs', val:fmt(an.fs, 0) }, { op:'÷', sym:'4 fbu', val:fmt(4 * an.fbu, 2) },
        { op:'=', sym:'l', val:fmt(an.lbd, 0) }]);
    }
    const items = [
      { name:'Anchorage, required / available', util: an.lbd / state.la, clause: ec ? '8.4.4' : '3.12.8.3' },
      { name:'Lap, required / provided', util: an.l0 / state.l0p, clause: ec ? '8.7.3' : '3.12.8.13' },
      { name:'Cover, required / provided', util: r.cv.code === 'bs' && !r.cv.allowed ? Infinity : r.cv.cnom / state.cover,
        clause: ec ? '4.4.1' : 'Tables 3.3, 3.4' },
      { name:'Clear gap, needed / actual', util: r.sp.clear > 0 ? r.sp.need / r.sp.clear : Infinity, clause: ec ? '8.2(2)' : '3.12.11.1' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:42, title:'Checks' }, items);
    return items;
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aDim', C.ocean, 5), marker('aGrn', C.green, 5), marker('aLoad', C.load),
      s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse', patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));
    const r = solveFor(state.code);
    const other = solveFor(state.code === 'ec2' ? 'bs' : 'ec2');
    const items = drawLeft(r);
    add(line(360, 16, 360, 544, { stroke:C.hair }));
    if (state.tab === 'cover') drawCover(r);
    else if (state.tab === 'spacing') drawSpacing(r);
    else drawAnchor(r);

    const ec = r.code === 'ec2', an = r.an;
    const v = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip(ec ? 'lb,rqd' : 'Basic length', `${fmt(an.lbrqd, 0)} mm`, `${fmt(an.mult, 1)} φ`) +
      chip(ec ? 'lbd' : 'Anchorage', `${fmt(an.lbd, 0)} mm`, `available ${state.la} mm`, an.lbd <= state.la ? 'ok' : 'warn') +
      chip('Lap l0', `${fmt(an.l0, 0)} mm`, ec ? `α6 = ${fmt(an.a6, 3)}` : `factor ${fmt(an.lapF, 1)}`, an.l0 <= state.l0p ? 'ok' : 'warn') +
      chip(ec ? 'fbd' : 'fbu', `${fmt(ec ? an.fbd : an.fbu, 2)} MPa`, ec ? (state.bond === 'poor' ? 'poor bond, η1 = 0.7' : 'good bond') : 'β √fcu') +
      chip('Cover needed', r.cv.code === 'bs' && !r.cv.allowed ? 'Not allowed' : `${fmt(r.cv.cnom, 0)} mm`,
           `${r.cv.gov === 'fire' ? 'fire' : r.cv.gov === 'dur' ? 'durability' : 'bond'} governs`,
           state.cover >= r.cv.cnom && (r.cv.code !== 'bs' || r.cv.allowed) ? 'ok' : 'warn') +
      chip('Clear gap', `${fmt(r.sp.clear, 0)} mm`, `need ${fmt(r.sp.need, 0)} mm`, r.sp.ok ? 'ok' : 'warn') +
      (r.sp.nMax ? chip('Bars per layer', `${r.sp.nMax}`, `of H${state.phi} in ${state.b} mm`) : '') +
      chip(ec ? 'BS 8110 anchorage' : 'EC2 lbd', `${fmt(other.an.lbd, 0)} mm`, `${fmt(other.an.lbd / state.phi, 1)} φ`);

    const steps = ec ? [
      { t:`fctm = 0.30 fck^⅔ = ${fmt(an.fctm, 2)}, fctd = 0.7 fctm / 1.5 = ${fmt(an.fctd, 3)} MPa`, c:'EN 1992-1-1 Table 3.1, 3.1.6(2)' },
      { t:`fbd = 2.25 × ${an.eta1} × ${fmt(an.eta2, 2)} × ${fmt(an.fctd, 3)} = ${fmt(an.fbd, 3)} MPa`, c:'8.4.2(2)' },
      { t:`σsd = ${fmt(state.stress, 2)} × fyd = ${fmt(an.ssd, 1)} MPa, lb,rqd = (${state.phi}/4)(${fmt(an.ssd, 1)}/${fmt(an.fbd, 3)}) = ${fmt(an.lbrqd, 0)} mm`, c:'8.4.3(2)' },
      { t:`cd = min(a/2, c) = min(${fmt(r.sp.clear / 2, 1)}, ${fmt(r.cBar, 0)}) = ${fmt(r.cd, 1)} mm, so α2 = ${fmt(an.a2, 3)}`, c:'Table 8.2' },
      { t:`lbd = ${fmt(an.a1, 2)} × ${fmt(an.a2 * an.a3 * an.a5 < 0.7 ? 0.7 : an.a2 * an.a3 * an.a5, 3)} × ${fmt(an.a4, 2)} × ${fmt(an.lbrqd, 0)} = ${fmt(an.lbdRaw, 0)} mm, not less than lb,min ${fmt(an.lbmin, 0)}`, c:'8.4.4(1)' },
      { t:`α6 = √(${state.lapped}/25) between 1 and 1.5 = ${fmt(an.a6, 3)}, l0 = ${fmt(an.l0, 0)} mm, l0,min ${fmt(an.l0min, 0)}`, c:'8.7.3' },
      { t:`Cover: S${r.cv.S}, cmin,dur ${r.cv.cdur}, cmin,b ${r.cv.cminb}, fire ${fmt(r.cv.cfire, 0)}, so cnom = ${fmt(r.cv.cnom, 0)} mm`, c:'4.4.1, EN 1992-1-2 5.6, 5.7' },
      { t:`Clear gap ${fmt(r.sp.clear, 1)} mm against ${fmt(r.sp.need, 0)} mm`, c:'8.2(2)' }
    ] : [
      { t:`fbu = ${an.beta} √${an.fcu} = ${fmt(an.fbu, 3)} MPa for type 2 deformed bars`, c:'BS 8110-1 3.12.8.4, Table 3.26' },
      { t:`l = φ fs / 4fbu = ${state.phi} × ${fmt(an.fs, 0)} / ${fmt(4 * an.fbu, 3)} = ${fmt(an.lbd, 0)} mm`, c:'3.12.8.3' },
      { t:`Lap = ${fmt(an.lapF, 1)} × ${fmt(an.lbd, 0)}, at least 15φ and 300 mm, = ${fmt(an.l0, 0)} mm`, c:'3.12.8.13' },
      { t:`Cover: ${r.cv.cond}, ${r.cv.allowed ? r.cv.parts[1].c + ' mm' : 'grade not allowed'}, fire ${r.cv.parts[2].c} mm, bar ${r.cv.parts[0].c} mm`, c:'Tables 3.3, 3.4' },
      { t:`Clear gap ${fmt(r.sp.clear, 1)} mm against hagg + 5 = ${fmt(r.sp.need, 0)} mm`, c:'3.12.11.1' }
    ];
    DesignKit.trail(trailEl, 'Show the working', steps);
  }

  /* ---------- controls ---------- */
  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  const select = (id, label, opts, cur) => `<div class="ctl"><label for="${id}">${label}</label><select id="${id}">` +
    opts.map(o => `<option value="${o[0]}"${String(cur) === String(o[0]) ? ' selected' : ''}>${o[1]}</option>`).join('') + '</select></div>';
  const check = (id, label) => `<label class="chk" style="margin:8px 0"><input type="checkbox" id="${id}"${state[id] ? ' checked' : ''}> ${label}</label>`;
  const SIZES = [8, 10, 12, 16, 20, 25, 32, 40];

  function renderControls() {
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      select('code', 'Code', [['ec2', 'EN 1992-1-1 with UK NA'], ['bs', 'BS 8110-1']], state.code) +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      '<h3 style="margin-top:16px">Bar and bond</h3>' +
      select('phi', 'Bar diameter', SIZES.map(d => [d, `H${d}`]), state.phi) +
      select('bond', 'Bond condition', [['good', 'Good'], ['poor', 'Poor, top of a deep pour']], state.bond) +
      select('shape', 'Bar end', [['straight', 'Straight'], ['bent', 'Bend or hook']], state.shape) +
      select('tension', 'Bar in', [['1', 'Tension'], ['0', 'Compression']], state.tension ? '1' : '0') +
      slider('stress', 'Bar stress σsd / fyd', 0.3, 1, 0.05) +
      slider('lapped', 'Bars lapped at one section (%)', 0, 100, 5) +
      slider('Klam', 'Transverse confinement Kλ', 0, 0.3, 0.01) +
      slider('pressure', 'Transverse pressure p (MPa)', 0, 15, 0.5) +
      check('welded', 'Welded transverse bars, α4 = 0.7') +
      '<h3>Lengths available</h3>' +
      slider('la', 'Anchorage available (mm)', 100, 2500, 10) + slider('l0p', 'Lap provided (mm)', 200, 3500, 10) +
      '<h3>Section</h3>' +
      select('member', 'Member', [['beam', 'Beam'], ['slab', 'Slab']], state.member) +
      (state.member === 'beam'
        ? slider('b', 'Beam width b (mm)', 150, 800, 10) + slider('n', 'Bars in the layer', 1, 10, 1) +
          select('phiLink', 'Link diameter', [[8, 'H8'], [10, 'H10'], [12, 'H12']], state.phiLink)
        : slider('s', 'Bar spacing (mm)', 75, 400, 5)) +
      slider('cover', 'Cover provided (mm)', 15, 80, 5) +
      select('dg', 'Largest aggregate', [[10, '10 mm'], [14, '14 mm'], [20, '20 mm'], [32, '32 mm']], state.dg) +
      '<h3>Durability and fire</h3>' +
      select('exposure', 'Exposure class', DetailEngine.EXPO.map(x => [x, x]), state.exposure) +
      check('life100', 'Design life 100 years') +
      select('R', 'Fire resistance', DetailEngine.PERIODS.map(p => [p, `R${p}, ${p / 60} h`]), state.R) +
      slider('fck', 'fck (MPa)', 20, 50, 5) + slider('fyk', 'fyk (MPa)', 400, 600, 50);
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
  const NUM = { phi:1, phiLink:1, dg:1, R:1 };
  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'preset') {
      if (PRESETS[t.value]) { Object.assign(state, PRESETS[t.value].f()); state.preset = t.value; renderControls(); }
      render(); return;
    }
    if (t.id === 'code') { state.code = t.value; render(); return; }
    if (t.type === 'checkbox') { state[t.id] = t.checked; markCustom(); render(); return; }
    if (t.tagName === 'SELECT') {
      state[t.id] = t.id === 'tension' ? t.value === '1' : NUM[t.id] ? +t.value : t.value;
      markCustom();
      if (t.id === 'member') renderControls();
      render();
    }
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
