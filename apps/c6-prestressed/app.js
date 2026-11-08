/* CivilLab · C6 Prestressed Concrete Beam */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');
  const VW = 960, VH = 600;

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { psi2:0.3, Ep:195000, mu:0.19, k:0.005, slip:6, fpk:1860, rho1000:2.5, ecs:400, phi:2, mode:'zero', cp:100,
                 b:300, h:600, bf:400, tf:120, tw:150, hw:660 };
  const PRESETS = {
    post: { label:'Post-tensioned I beam, 20 m', f:()=>Object.assign({}, base, { type:'post', shape:'ibeam', bf:400, tf:120, tw:150, hw:660,
            L:20, wsdl:5, wq:6, Pj:2000, Ap:1500, e:330, eEnd:0, fck:50, fckt:35 }) },
    pre:  { label:'Pre-tensioned rectangle, 10 m', f:()=>Object.assign({}, base, { type:'pre', shape:'rect', b:300, h:600,
            L:10, wsdl:2, wq:8, Pj:1000, Ap:750, e:175, eEnd:175, fck:45, fckt:30 }) },
    tee:  { label:'Pre-tensioned T girder, 16 m', f:()=>Object.assign({}, base, { type:'pre', shape:'tee', bf:1200, tf:150, tw:200, hw:750,
            L:16, wsdl:3, wq:12, Pj:2200, Ap:1650, e:390, eEnd:390, fck:50, fckt:35 }) },
    over: { label:'Too much prestress at transfer', f:()=>Object.assign({}, base, { type:'pre', shape:'rect', b:300, h:600,
            L:10, wsdl:2, wq:8, Pj:1500, Ap:1100, e:225, eEnd:225, fck:45, fckt:30 }) }
  };
  const TABS = { stress:'Stresses', magnel:'Magnel', losses:'Losses' };
  const state = Object.assign({ preset:'post', code:'ec2', tab:'stress' }, PRESETS.post.f());

  const dims = () => state.shape === 'rect' ? { b:state.b, h:state.h }
    : { bf:state.bf, tf:state.tf, tw:state.tw, hw:state.hw };
  const solveFor = code => PrestressEngine.solve(Object.assign({}, state, { code, dims:dims(), ecs:state.ecs * 1e-6,
    eEnd: state.type === 'pre' ? state.e : state.eEnd }));

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

  /* section outline from its rectangles, y up from the bottom */
  function drawSection(sec, x, yTop, k) {
    const h = sec.h;
    sec.rects.forEach(rc => add(s('rect', { x: x - rc.w * k / 2, y: yTop + (h - rc.y1) * k, width: rc.w * k,
      height: (rc.y1 - rc.y0) * k, fill:'#F2F4F0', stroke:'none' })));
    sec.rects.forEach(rc => add(s('rect', { x: x - rc.w * k / 2, y: yTop + (h - rc.y1) * k, width: rc.w * k,
      height: (rc.y1 - rc.y0) * k, fill:'none', stroke:C.ocean, 'stroke-width':1.2 })));
  }

  /* ---------- stresses ---------- */
  function drawStress(r) {
    const X0 = 390, X1 = 935;
    add(txt(X0, 28, `Elevation, ${state.type === 'post' ? 'post-tensioned, parabolic duct' : 'pre-tensioned, straight strand'}`,
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const EY = 70, EH = 80, sx = (X1 - X0 - 20) / state.L, ex = X0 + 10;
    const yOf = e => EY + (r.sec.ytop + e) / r.sec.h * EH;
    add(s('rect', { x:ex, y:EY, width:state.L * sx, height:EH, fill:'#F2F4F0', stroke:C.ocean, 'stroke-width':1.4 }));
    add(line(ex, yOf(0), ex + state.L * sx, yOf(0), { stroke:C.contour, 'stroke-dasharray':'6 4' }));
    add(txt(ex + state.L * sx + 4, yOf(0) + 4, 'centroid', { an:'end', fs:9.5 }));
    const eE = state.type === 'pre' ? state.e : state.eEnd;
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, e = eE + (state.e - eE) * 4 * t * (1 - t);
      d += `${i ? 'L' : 'M'}${ex + state.L * sx * t},${yOf(e)}`;
    }
    add(s('path', { d, fill:'none', stroke:C.water, 'stroke-width':2.4 }));
    for (let i = 0; i <= 12; i++) {
      const x = ex + state.L * sx * i / 12;
      add(line(x, EY - 24, x, EY - 3, { stroke:C.load, 'stroke-width':1.2, 'marker-end':'url(#aLoad)' }));
    }
    add(line(ex, EY - 24, ex + state.L * sx, EY - 24, { stroke:C.load, 'stroke-width':1.2 }));
    add(txt(ex + state.L * sx / 2, EY - 30, `g ${fmt(r.wg, 2)} + ${fmt(state.wsdl, 1)} and q ${fmt(state.wq, 1)} kN/m`, { fs:10.5, fill:C.load }));
    add(s('polygon', { points:`${ex},${EY + EH} ${ex - 8},${EY + EH + 12} ${ex + 8},${EY + EH + 12}`, fill:C.green }));
    add(s('circle', { cx:ex + state.L * sx, cy:EY + EH + 6, r:6, fill:'none', stroke:C.green, 'stroke-width':1.6 }));
    add(txt(ex + state.L * sx / 2, yOf(state.e) + 16, `e = ${fmt(state.e, 0)} mm at midspan`, { fs:10.5, fill:C.water }));
    add(txt(X0, EY + EH + 30, `L = ${fmt(state.L, 1)} m, depth drawn ${fmt(EH / r.sec.h / (sx / 1000), 0)} times the length scale`,
      { an:'start', fs:10, halo:0 }));

    /* two stress profiles */
    const panel = (px, title, P, top, bot, fmin, fmax) => {
      const y0 = 250, H = 230, k = H / r.sec.h;
      add(txt(px, 222, title, { an:'start', fs:12.5, fw:600, fill:C.ocean, halo:0 }));
      drawSection(r.sec, px + 40, y0, Math.min(k, 70 / Math.max(r.sec.h, 1) * 3));
      const ax = px + 140, span = 120;
      const top_ = Math.max(fmax, top, bot, 1) * 1.15, bot_ = Math.min(fmin, top, bot, 0) * 1.15;
      const X = v => ax + (v - 0) / (top_ - bot_) * span * 1.4;
      add(line(X(0), y0, X(0), y0 + H, { stroke:C.axis }));
      add(line(X(fmax), y0 - 6, X(fmax), y0 + H + 6, { stroke:C.load, 'stroke-dasharray':'4 3' }));
      add(txt(X(fmax), y0 + H + 18, `${fmt(fmax, 1)}`, { fs:9.5, fill:C.load }));
      if (fmin < 0) {
        add(line(X(fmin), y0 - 6, X(fmin), y0 + H + 6, { stroke:C.load, 'stroke-dasharray':'4 3' }));
        add(txt(X(fmin), y0 + H + 18, `${fmt(fmin, 1)}`, { fs:9.5, fill:C.load }));
      }
      add(s('polygon', { points:`${X(0)},${y0} ${X(top)},${y0} ${X(bot)},${y0 + H} ${X(0)},${y0 + H}`,
        fill:C.water, 'fill-opacity':.15, stroke:C.water, 'stroke-width':2 }));
      const bad = (v) => v > fmax + 1e-9 || v < fmin - 1e-9;
      add(txt(X(top) + (top >= 0 ? 6 : -6), y0 + 4, `${fmt(top, 2)}`, { an: top >= 0 ? 'start' : 'end', fs:11, fw:600, fill: bad(top) ? C.load : C.ocean }));
      add(txt(X(bot) + (bot >= 0 ? 6 : -6), y0 + H, `${fmt(bot, 2)}`, { an: bot >= 0 ? 'start' : 'end', fs:11, fw:600, fill: bad(bot) ? C.load : C.ocean }));
      add(txt(px, y0 + H + 40, `P = ${fmt(P, 0)} kN, MPa compression +`, { an:'start', fs:10.5, halo:0 }));
    };
    panel(390, 'At transfer, P0 with self weight', r.ls.P0, r.st.trTop, r.st.trBot, r.lim.trT, r.lim.trC);
    panel(665, 'In service, Pe with full load', r.ls.Pe, r.st.svTop, r.st.svBot, r.lim.svT, r.lim.svC);
  }

  /* ---------- Magnel ---------- */
  const MG = { x0:430, x1:920, y0:50, y1:530 };
  let mgScale = null;
  function drawMagnel(r) {
    add(txt(390, 28, 'Magnel diagram, eccentricity against 1/P0', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const b = r.box;
    const ymax = Math.max(1000 / Math.max(r.ls.P0, 1) * 1.8, ...r.mg.poly.map(q => q[1] * 1000)) || 1;
    const X = e => MG.x0 + (e - b.e0) / (b.e1 - b.e0) * (MG.x1 - MG.x0);
    const Y = y => MG.y1 - y / ymax * (MG.y1 - MG.y0);
    mgScale = { X, Y, ymax, b };
    add(line(MG.x0, MG.y1, MG.x1, MG.y1, { stroke:C.axis }));
    add(line(X(0), MG.y0, X(0), MG.y1, { stroke:C.axis }));
    add(txt(MG.x1, MG.y1 + 28, 'e mm, below the centroid positive', { an:'end', fs:10.5 }));
    add(txt(MG.x0 - 34, (MG.y0 + MG.y1) / 2, '1/P0 per MN', { fs:10.5, rot:-90 }));
    [-0.5, 0, 0.5, 1].forEach(f => { const e = f * b.e1; if (e < b.e0) return;
      add(txt(X(e), MG.y1 + 14, fmt(e, 0), { fs:9.5 })); });
    for (let i = 1; i <= 4; i++) { const y = ymax * i / 4;
      add(txt(MG.x0 - 6, Y(y) + 4, fmt(y, 2), { an:'end', fs:9.5 })); }
    if (r.mg.poly.length >= 3)
      add(s('polygon', { points: r.mg.poly.map(q => `${X(q[0])},${Y(Math.min(q[1] * 1000, ymax))}`).join(' '),
        fill:C.green, 'fill-opacity':.14, stroke:C.green, 'stroke-width':1.6 }));
    /* each limit as a line across the plot, clipped to it */
    add(s('defs', {}, s('clipPath', { id:'mgclip' }, s('rect', { x:MG.x0, y:MG.y0, width:MG.x1 - MG.x0, height:MG.y1 - MG.y0 }))));
    const lines = add(s('g', { 'clip-path':'url(#mgclip)' }));
    r.mg.cons.forEach(c => {
      if (Math.abs(c.c) < 1e-15) return;
      const yAt = e => -(c.a + c.b * e) / c.c * 1000;
      const pts = [[b.e0, yAt(b.e0)], [b.e1, yAt(b.e1)]];
      lines.appendChild(line(X(pts[0][0]), Y(pts[0][1]), X(pts[1][0]), Y(pts[1][1]), { stroke:C.contour, 'stroke-width':1 }));
    });
    add(line(X(r.eMax), MG.y0, X(r.eMax), MG.y1, { stroke:C.ocean, 'stroke-width':1.4, 'stroke-dasharray':'6 3' }));
    add(txt(X(r.eMax) - 4, MG.y0 + 12, `tendon limit ${fmt(r.eMax, 0)}`, { an:'end', fs:10, fill:C.ocean }));
    const inside = isFinite(r.pr.Pmin) && r.pr.ok && r.ls.P0 >= r.pr.Pmin - 1e-6 && r.ls.P0 <= r.pr.Pmax + 1e-6;
    const g = add(s('g', { 'data-id':'mp' }));
    const px = X(state.e), py = Y(1000 / r.ls.P0);
    g.appendChild(s('circle', { cx:px, cy:py, r:15, fill:'transparent' }));
    g.appendChild(s('circle', { cx:px, cy:py, r:6.5, fill: inside ? C.green : C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(px + 10, py - 10, `P0 ${fmt(r.ls.P0, 0)} kN at e ${fmt(state.e, 0)}`, { an:'start', fs:11, fw:600, fill: inside ? C.green : C.load }));
    if (r.pr.ok) add(txt(390, 584, `At e = ${fmt(state.e, 0)} mm any P0 from ${fmt(r.pr.Pmin, 0)} to ${isFinite(r.pr.Pmax) ? fmt(r.pr.Pmax, 0) : '∞'} kN satisfies all eight fibre limits.`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
    else add(txt(390, 584, `No prestress force works at e = ${fmt(state.e, 0)} mm. Move the tendon or change the section.`,
      { an:'start', fs:11.5, fill:C.load, halo:0 }));
  }

  /* ---------- losses waterfall ---------- */
  function drawLosses(r) {
    const l = r.ls;
    add(txt(390, 28, 'Where the jacking force goes, midspan', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const steps = [['Jacking', l.Pmax, 'total'], ['Friction', -l.dFric], ['Draw-in', -l.dSet], ['Elastic', -l.dEl],
                   ['P0', l.P0, 'total'], ['Shrinkage', -l.dShr], ['Creep', -l.dCreep], ['Relaxation', -l.dRelx], ['Pe', l.Pe, 'total']];
    const X0 = 400, W = 530, bw = W / steps.length, Y1 = 500, Y0 = 70;
    const top = l.Pmax * 1.08;
    const Y = v => Y1 - v / top * (Y1 - Y0);
    add(line(X0, Y1, X0 + W, Y1, { stroke:C.axis }));
    let run = 0;
    steps.forEach((st, i) => {
      const x = X0 + i * bw + 6, w = bw - 12;
      let y0, y1, col;
      if (st[2] === 'total') { y0 = 0; y1 = st[1]; run = st[1]; col = C.ocean; }
      else { y1 = run; y0 = run + st[1]; run = y0; col = C.load; }
      const hh = Math.abs(Y(y0) - Y(y1));
      add(s('rect', { x, y:Math.min(Y(y0), Y(y1)), width:w, height:Math.max(hh, 0.8), fill:col, 'fill-opacity': st[2] ? .7 : .35, stroke:col }));
      add(txt(x + w / 2, Math.min(Y(y0), Y(y1)) - 6, st[2] ? fmt(st[1], 0) : (Math.abs(st[1]) < 0.05 ? '0' : fmt(st[1], 0)),
        { fs:10.5, fw:600, fill:col }));
      add(txt(x + w / 2, Y1 + 16, st[0], { fs:10 }));
      add(txt(x + w / 2, Y1 + 30, st[2] ? '' : `${fmt(-st[1] / l.Pmax * 100, 1)}%`, { fs:9.5, fill:C.muted }));
    });
    add(txt(400, 560, `Immediate ${fmt(l.immediate / l.Pmax * 100, 1)}%, long term ${fmt(l.dLong / l.Pmax * 100, 1)}%, total ${fmt(l.total / l.Pmax * 100, 1)}% of the jacking force. η = Pe/P0 = ${fmt(l.eta, 3)}.`,
      { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- left column ---------- */
  function drawLeft(r) {
    const X = 26, W = 320, ec = r.lim && state.code === 'ec2';
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Force at transfer', clause:'EN 1992-1-1 5.10.4, 5.10.5' }, [
      { sym:'Pjack', val:fmt(r.ls.Pmax, 0) }, { op:'−', sym:'immediate', val:fmt(r.ls.immediate, 0) },
      { op:'=', sym:'P0 kN', val:fmt(r.ls.P0, 0) }]);
    y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Force in service', clause:'EN 1992-1-1 5.10.6' }, [
      { sym:'P0', val:fmt(r.ls.P0, 0) }, { sym:'η', val:fmt(r.ls.eta, 3) }, { op:'=', sym:'Pe kN', val:fmt(r.ls.Pe, 0) }]);
    const items = [
      { name:'Jacking stress, σp / σp,max', util:r.jack, clause: ec ? '5.10.2.1' : '4.7.1' },
      { name:'Transfer, top fibre', util:r.u.trTop, clause: ec ? '5.10.2.2' : '4.3.5' },
      { name:'Transfer, bottom fibre', util:r.u.trBot, clause: ec ? '5.10.2.2' : '4.3.5' },
      { name:'Service, top fibre', util:r.u.svTop, clause: ec ? '7.2(2)' : '4.3.4' },
      { name:'Service, bottom fibre', util:r.u.svBot, clause: ec ? '7.2, 7.3' : '4.3.4' },
      { name:'Tendon inside the section, e / emax', util: state.e / r.eMax, clause:'cover to duct' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:40, title:'Checks' }, items);
    return items;
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aLoad', C.load, 5)));
    const r = solveFor(state.code);
    const other = solveFor(state.code === 'ec2' ? 'bs' : 'ec2');
    const items = drawLeft(r);
    add(line(370, 16, 370, 584, { stroke:C.hair }));
    if (state.tab === 'magnel') drawMagnel(r);
    else if (state.tab === 'losses') drawLosses(r);
    else drawStress(r);

    const ec = state.code === 'ec2';
    const v = DesignKit.verdict(items);
    const otherItems = [other.jack, other.u.trTop, other.u.trBot, other.u.svTop, other.u.svBot];
    const otherWorst = Math.max(...otherItems);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('P0', `${fmt(r.ls.P0, 0)} kN`, `immediate loss ${fmt(r.ls.immediate / r.ls.Pmax * 100, 1)}%`) +
      chip('Pe', `${fmt(r.ls.Pe, 0)} kN`, `total loss ${fmt(r.ls.total / r.ls.Pmax * 100, 1)}%`) +
      chip('Transfer top', `${fmt(r.st.trTop, 2)} MPa`, `limits ${fmt(r.lim.trT, 2)} to ${fmt(r.lim.trC, 1)}`, r.u.trTop <= 1 ? 'ok' : 'warn') +
      chip('Transfer bottom', `${fmt(r.st.trBot, 2)} MPa`, `limit ${fmt(r.lim.trC, 1)}`, r.u.trBot <= 1 ? 'ok' : 'warn') +
      chip('Service top', `${fmt(r.st.svTop, 2)} MPa`, `limit ${fmt(r.lim.svC, 1)}`, r.u.svTop <= 1 ? 'ok' : 'warn') +
      chip('Service bottom', `${fmt(r.st.svBot, 2)} MPa`, `tension limit ${fmt(r.lim.svT, 2)}`, r.u.svBot <= 1 ? 'ok' : 'warn') +
      chip('P0 range at e', r.pr.ok ? `${fmt(r.pr.Pmin, 0)} to ${isFinite(r.pr.Pmax) ? fmt(r.pr.Pmax, 0) : '∞'}` : 'None',
           'kN, from the Magnel lines', r.pr.ok ? 'ok' : 'warn') +
      chip('Moments', `${fmt(r.Mg, 0)} / ${fmt(r.Ms, 0)}`, 'kNm, self weight / service') +
      chip(ec ? 'BS 8110 worst' : 'EC2 worst', `${fmt(otherWorst * 100, 0)}%`, 'same losses, other limits', otherWorst <= 1 ? 'ok' : 'warn');

    const l = r.ls;
    DesignKit.trail(trailEl, 'Show the working', [
      { t:`Section A = ${fmt(r.sec.A, 0)} mm², I = ${(r.sec.I / 1e9).toFixed(3)}×10⁹ mm⁴, Ztop = ${(r.sec.Ztop / 1e6).toFixed(2)}×10⁶, Zbot = ${(r.sec.Zbot / 1e6).toFixed(2)}×10⁶ mm³`, c:'SectionEngine' },
      { t:`Self weight ${fmt(r.wg, 2)} kN/m, Mg = ${fmt(r.Mg, 1)}, Ms = ${fmt(r.Ms, 1)}, Mqp = ${fmt(r.Mqp, 1)} kNm`, c:'wL²/8' },
      state.type === 'post' ? { t:`Friction θ = 4a/L = ${fmt(l.theta, 4)} rad, ΔPμ = ${fmt(l.dFric, 1)} kN, draw-in over ${fmt(l.lset / 1000, 2)} m gives ${fmt(l.dSet, 1)} kN at midspan`, c:'5.10.5.2, 5.10.5.3' }
        : { t:'Pre-tensioned, so no duct friction or draw-in at midspan', c:'' },
      { t:`Elastic shortening: σc = ${fmt(l.scp, 2)} MPa at the tendon, ΔPel = ${fmt(l.dEl, 1)} kN${state.type === 'post' ? ', halved for sequential stressing' : ''}`, c:'5.10.5.1' },
      { t:`Relaxation Δσpr = ${fmt(l.dRel, 1)} MPa at μ = ${fmt(l.mu, 3)}, σc,QP = ${fmt(l.scQP, 2)} MPa, Δσp,c+s+r = ${fmt(l.dsp, 1)} MPa, so ${fmt(l.dLong, 1)} kN`, c:'3.3.2 eq 3.29, 5.10.6 eq 5.46' },
      { t:`Transfer: σtop = ${fmt(r.st.trTop, 2)}, σbot = ${fmt(r.st.trBot, 2)} MPa. Service: σtop = ${fmt(r.st.svTop, 2)}, σbot = ${fmt(r.st.svBot, 2)} MPa`, c: ec ? '5.10.2.2, 7.2' : 'BS 8110 4.3.4, 4.3.5' }]);
  }

  /* ---------- controls ---------- */
  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;
  const select = (id, label, opts, cur) => `<div class="ctl"><label for="${id}">${label}</label><select id="${id}">` +
    opts.map(o => `<option value="${o[0]}"${String(cur) === String(o[0]) ? ' selected' : ''}>${o[1]}</option>`).join('') + '</select></div>';

  function renderControls() {
    const dimCtl = state.shape === 'rect'
      ? slider('b', 'Width b (mm)', 150, 800, 10) + slider('h', 'Depth h (mm)', 300, 1500, 10)
      : slider('bf', 'Flange width (mm)', 200, 2000, 10) + slider('tf', 'Flange thickness (mm)', 60, 300, 5) +
        slider('tw', 'Web thickness (mm)', 80, 400, 5) + slider('hw', 'Web depth (mm)', 200, 1500, 10);
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      select('code', 'Allowable stresses', [['ec2', 'EN 1992-1-1 with UK NA'], ['bs', 'BS 8110-1']], state.code) +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      '<h3 style="margin-top:16px">Beam</h3>' +
      select('type', 'Prestressing', [['pre', 'Pre-tensioned'], ['post', 'Post-tensioned']], state.type) +
      select('shape', 'Section', [['rect', 'Rectangle'], ['ibeam', 'I section'], ['tee', 'T section']], state.shape) +
      dimCtl + slider('L', 'Span (m)', 4, 40, 0.5) +
      slider('wsdl', 'Superimposed dead (kN/m)', 0, 30, 0.5) + slider('wq', 'Imposed (kN/m)', 0, 40, 0.5) +
      '<h3>Prestress</h3>' +
      slider('Pj', 'Jacking force (kN)', 100, 8000, 10) + slider('Ap', 'Tendon area Ap (mm²)', 100, 6000, 10) +
      slider('e', 'Eccentricity at midspan (mm)', -300, 900, 5) +
      (state.type === 'post' ? slider('eEnd', 'Eccentricity at the ends (mm)', -400, 600, 5) : '') +
      select('mode', 'Service tension', [['zero', state.code === 'bs' ? 'Class 1, none' : 'None, decompression'],
        ['fctm', state.code === 'bs' ? 'Class 2, limited' : 'Up to fctm']], state.mode) +
      '<h3>Concrete and losses</h3>' +
      slider('fck', 'fck (MPa)', 30, 70, 5) + slider('fckt', 'fck at transfer (MPa)', 20, 60, 1) +
      (state.type === 'post' ? slider('mu', 'Friction μ', 0.05, 0.4, 0.01) + slider('k', 'Wobble k (rad/m)', 0, 0.02, 0.001) +
        slider('slip', 'Draw-in slip (mm)', 0, 12, 0.5) : '') +
      slider('ecs', 'Shrinkage εcs (×10⁻⁶)', 0, 800, 10) + slider('phi', 'Creep coefficient φ', 0, 4, 0.1) +
      slider('rho1000', 'Relaxation ρ1000 (%)', 0, 8, 0.1) + slider('psi2', 'ψ2 for the imposed load', 0, 1, 0.1);
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
    markCustom();
    render();
  });
  controls.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'preset') {
      if (PRESETS[t.value]) { Object.assign(state, PRESETS[t.value].f()); state.preset = t.value; renderControls(); }
      render(); return;
    }
    if (t.id === 'code') { state.code = t.value; renderControls(); render(); return; }
    if (t.tagName === 'SELECT') {
      state[t.id] = t.value; markCustom();
      if (t.id === 'type' || t.id === 'shape') renderControls();
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

  /* drag the Magnel point: across sets e, up and down sets the force */
  let drag = false;
  fig.addEventListener('pointerdown', e => {
    if (state.tab !== 'magnel' || !e.target.closest('[data-id="mp"]')) return;
    drag = true; fig.setPointerCapture(e.pointerId); e.preventDefault();
  });
  fig.addEventListener('pointermove', e => {
    if (!drag || !mgScale) return;
    const rc = fig.getBoundingClientRect();
    const px = (e.clientX - rc.left) * VW / rc.width, py = (e.clientY - rc.top) * VH / rc.height;
    const sc = mgScale;
    state.e = clamp(snap(sc.b.e0 + (px - MG.x0) / (MG.x1 - MG.x0) * (sc.b.e1 - sc.b.e0), 5), -300, 900);
    const yv = Math.max(1e-6, (MG.y1 - py) / (MG.y1 - MG.y0) * sc.ymax);
    const target = 1000 / yv;
    /* the losses are nearly proportional to the force, so two rescalings land on P0 */
    for (let i = 0; i < 2; i++) state.Pj = state.Pj * target / Math.max(solveFor(state.code).ls.P0, 1);
    state.Pj = clamp(snap(state.Pj, 10), 100, 8000);
    syncInput('e'); syncInput('Pj'); markCustom(); render();
  });
  const end = () => { drag = false; };
  fig.addEventListener('pointerup', end);
  fig.addEventListener('pointercancel', end);

  renderControls();
  render();
})();
