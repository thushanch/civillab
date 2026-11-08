/* CivilLab · M1 Masonry Wall Design */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC', brick:'#D8B9A6' };

  const base = { unit:'clay1', fb:20, fm:6, gM6:2.3, gMbs:3.1, h:2.7, L:5, t:102.5, t2:102.5, cavity:false,
                 rho2:0.75, sides:2, N:60, e:10, creep:1, W:0.6, Ngk:30, fxk1:0.4, fxk2:1.1, span:'vertical' };
  const PRESETS = {
    inner:   { label:'Inner leaf of a cavity wall', f:()=>Object.assign({}, base, { tab:'vertical', cavity:true, N:70, e:15 }) },
    block:   { label:'215 block loadbearing wall', f:()=>Object.assign({}, base, { tab:'vertical', unit:'conc1', fb:10, fm:6, t:215, h:3.0, N:240, e:20, creep:1.5 }) },
    slender: { label:'Slender wall, timber floors', f:()=>Object.assign({}, base, { tab:'vertical', unit:'conc1', fb:7.3, fm:4, t:100, h:3.3, rho2:1, N:40, e:15, creep:1.5 }) },
    panel:   { label:'Panel wall under wind', f:()=>Object.assign({}, base, { tab:'lateral', span:'four', L:4.5, h:2.7, W:0.9, Ngk:0 }) },
    arch:    { label:'Arching between rigid frames', f:()=>Object.assign({}, base, { tab:'lateral', span:'arch', h:3.0, W:2.0, Ngk:0 }) }
  };
  const TABS = { vertical:'Vertical load', lateral:'Lateral load' };
  const state = Object.assign({ preset:'inner', code:'ec6' }, PRESETS.inner.f());

  const gM = code => code === 'bs' ? state.gMbs : state.gM6;
  const vertFor = code => MasonryEngine.vertical(Object.assign({}, state, { code, gM: gM(code) }));
  const latFor = code => MasonryEngine.lateral(Object.assign({}, state, { code, gM: gM(code) }));

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

  /* ---------- vertical ---------- */
  function drawVertical(r) {
    const ec = r.code === 'ec6';
    title(`Wall under vertical load, ${ec ? 'EN 1996-1-1 6.1 and Annex G' : 'BS 5628-1 32 and Annex B'}`);
    /* section through the wall between floors */
    const X = 470, T = 80, B = 460, k = 0.55;
    const tw = state.t * k;
    add(s('rect', { x:X - 90, y:T - 22, width:180, height:22, fill:'url(#hatch)', stroke:C.ocean }));
    add(s('rect', { x:X - 90, y:B, width:180, height:22, fill:'url(#hatch)', stroke:C.ocean }));
    add(txt(X + 96, T - 8, state.rho2 < 1 ? 'concrete floor' : 'timber floor', { an:'start', fs:10 }));
    const bow = clamp((ec ? r.emk : r.em) * 0.9, 2, 40);
    let d = '';
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, y = T + (B - T) * t, dx = bow * Math.sin(Math.PI * t);
      d += `${i ? 'L' : 'M'}${X - tw / 2 + dx},${y}`;
    }
    for (let i = 30; i >= 0; i--) {
      const t = i / 30, y = T + (B - T) * t, dx = bow * Math.sin(Math.PI * t);
      d += `L${X + tw / 2 + dx},${y}`;
    }
    add(s('path', { d: d + 'Z', fill:C.brick, 'fill-opacity':.7, stroke:C.ocean, 'stroke-width':1.2 }));
    if (state.cavity) {
      add(s('rect', { x:X + tw / 2 + 28, y:T, width:state.t2 * k, height:B - T, fill:C.brick, 'fill-opacity':.35, stroke:C.contour }));
      add(txt(X + tw / 2 + 28 + state.t2 * k / 2, T + 14, 'outer leaf', { fs:9.5, rot:-90 }));
    }
    const ex = state.e * k;
    add(line(X + ex, T - 70, X + ex, T - 26, { stroke:C.load, 'stroke-width':2.6, 'marker-end':'url(#aLoad)' }));
    add(txt(X + ex, T - 76, `NEd ${fmt(state.N, 0)} kN/m`, { fs:11, fw:600, fill:C.load }));
    if (state.e > 0) {
      add(line(X, T - 34, X + ex, T - 34, { stroke:C.ocean, 'stroke-width':1 }));
      add(txt(X - 6, T - 30, `e ${state.e}`, { an:'end', fs:10, fill:C.ocean }));
    }
    add(line(X - 70, T, X - 70, B, { stroke:C.ocean, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
    add(txt(X - 76, (T + B) / 2, `h ${fmt(state.h, 2)} m, hef ${fmt(r.hef / 1000, 2)} m`, { fs:10.5, rot:-90 }));
    add(txt(X, B + 40, `t = ${state.t} mm, tef = ${fmt(r.tef, 0)} mm, hef/tef = ${fmt(r.SR, 1)}`, { fs:10.5 }));

    /* the reduction factor against slenderness */
    const P = { x0:640, x1:920, y0:70, y1:400 };
    const X2 = v => P.x0 + v / 30 * (P.x1 - P.x0), Y2 = v => P.y1 - v * (P.y1 - P.y0);
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    [0, 10, 20, 27, 30].forEach(v => add(txt(X2(v), P.y1 + 15, String(v), { fs:9.5, fill: v === 27 ? C.load : C.muted })));
    add(line(X2(27), P.y0, X2(27), P.y1, { stroke:C.load, 'stroke-dasharray':'4 3' }));
    [0, 0.5, 1].forEach(v => add(txt(P.x0 - 6, Y2(v) + 4, fmt(v, 1), { an:'end', fs:9.5 })));
    add(txt(P.x1, P.y1 + 32, 'hef / tef', { an:'end', fs:10.5 }));
    add(txt(P.x0 - 24, (P.y0 + P.y1) / 2, ec ? 'Φm' : 'β', { fs:11, rot:-90 }));
    const fams = [0.05, 0.1, 0.2, 0.3];
    fams.forEach(ratio => {
      let p = '';
      for (let i = 0; i <= 60; i++) {
        const sr = 30 * i / 60;
        const v = ec ? MasonryEngine.phiG(Math.max(sr, 0.01), r.fk, ratio * state.t, state.t).phim
          : Math.min(1, 1.1 * (1 - 2 * (0.6 * Math.max(ratio, 0.05) * state.t + Math.max(0, state.t * (sr * sr / 2400 - 0.015))) / state.t));
        p += `${i ? 'L' : 'M'}${X2(sr)},${Y2(Math.max(0, v))}`;
      }
      add(s('path', { d:p, fill:'none', stroke:C.contour, 'stroke-width':1.3 }));
      add(txt(X2(2), Y2(ec ? MasonryEngine.phiG(2, r.fk, ratio * state.t, state.t).phim : 1.1 * (1 - 1.2 * Math.max(ratio, 0.05))) - 4,
        `${ec ? 'emk' : 'ex'}/t ${ratio}`, { an:'start', fs:9.5 }));
    });
    const py = ec ? r.phim : r.beta;
    add(s('circle', { cx:X2(Math.min(r.SR, 30)), cy:Y2(Math.max(0, py)), r:6, fill:C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(X2(Math.min(r.SR, 30)) + 9, Y2(Math.max(0, py)) - 8, `${ec ? 'Φm' : 'β'} = ${fmt(py, 3)}`, { an:'start', fs:11, fw:600, fill:C.load }));
    add(txt(640, 470, ec ? `Φ at the top ${fmt(r.phiI, 3)}, at mid height ${fmt(r.phim, 3)}, so ${r.govern} governs`
      : `em = 0.6ex + ea = ${fmt(r.em, 1)} mm, β = ${fmt(r.beta, 3)}`, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- lateral ---------- */
  function drawLateral(r) {
    title(`Wall panel under lateral load, ${r.mode}`);
    const BX = 420, BY = 70, BW = 470, BH = 360;
    const k = Math.min(BW / state.L, BH / state.h);
    const w = state.L * k, h = state.h * k, x0 = BX + (BW - w) / 2, y0 = BY + (BH - h) / 2;
    add(s('rect', { x:x0, y:y0, width:w, height:h, fill:C.brick, 'fill-opacity':.45, stroke:C.ocean, 'stroke-width':1.4 }));
    for (let yy = y0 + 8; yy < y0 + h; yy += 8) add(line(x0, yy, x0 + w, yy, { stroke:'#fff', 'stroke-opacity':.5, 'stroke-width':0.8 }));
    const sup = (x1, y1, x2, y2) => add(line(x1, y1, x2, y2, { stroke:C.green, 'stroke-width':4 }));
    if (state.span === 'vertical' || state.span === 'four' || state.span === 'arch') { sup(x0, y0, x0 + w, y0); sup(x0, y0 + h, x0 + w, y0 + h); }
    if (state.span === 'horizontal' || state.span === 'four') { sup(x0, y0, x0, y0 + h); sup(x0 + w, y0, x0 + w, y0 + h); }
    const crack = pts => add(s('polyline', { points:pts.map(p => p.join(',')).join(' '), fill:'none', stroke:C.load, 'stroke-width':2, 'stroke-dasharray':'7 4' }));
    if (state.span === 'vertical' || state.span === 'arch') crack([[x0, y0 + h / 2], [x0 + w, y0 + h / 2]]);
    else if (state.span === 'horizontal') crack([[x0 + w / 2, y0], [x0 + w / 2, y0 + h]]);
    else {
      /* yield lines in the affine isotropic slab, then mapped back */
      const sq = Math.sqrt(r.mu), A = state.L, Bt = state.h / sq;
      const longX = A >= Bt, a = Math.max(A, Bt), b = Math.min(A, Bt);
      const work = x => (4 * a / b + 2 * b / x) / (b * (a / 2 - x / 3));
      let lo = 1e-6, hi = a / 2;
      for (let i = 0; i < 80; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (work(m1) < work(m2)) hi = m2; else lo = m1; }
      const xs = (lo + hi) / 2;
      const map = (u, v) => longX ? [x0 + u * k, y0 + v * sq * k] : [x0 + v * k, y0 + u * sq * k];
      const P1 = map(xs, b / 2), P2 = map(a - xs, b / 2);
      crack([map(0, 0), P1, map(0, b)]); crack([map(a, 0), P2, map(a, b)]); crack([P1, P2]);
    }
    for (let i = 0; i < 5; i++) add(txt(x0 + w * (0.15 + 0.17 * i), y0 + h * 0.82, '⊗', { fs:16, fill:C.load, halo:0 }));
    add(txt(x0 + w / 2, y0 + h + 22, `L ${fmt(state.L, 2)} m × h ${fmt(state.h, 2)} m, wind ${fmt(state.W, 2)} kN/m² into the page`, { fs:10.5 }));
    if (state.span === 'arch') {
      add(txt(x0 + w + 10, y0 + h / 2, `arch thrust ${fmt(r.Nad, 0)} kN/m`, { an:'start', fs:10.5, fill:C.green }));
    }
    const rows = state.span === 'arch'
      ? [`Nad = 1.5 fd t/10 = ${fmt(r.Nad, 1)} kN/m, rise 0.9t = ${fmt(r.r, 0)} mm`, `qlat = 8 Nad r / h² = ${fmt(r.qR, 2)} kN/m²`]
      : [`fxd1,app = ${fmt(r.fx1, 3)} MPa with precompression ${fmt(r.sigd, 3)}, fxd2 = ${fmt(r.fx2, 3)} MPa, μ = ${fmt(r.mu, 3)}`,
         r.alpha2 != null ? `α2 = ${fmt(r.alpha2, 4)} from the yield lines, MEd2 = α2 W L² = ${fmt(r.MEd2, 3)} kNm/m` : `M = W span²/8 against m = f Z`];
    rows.forEach((t, i) => add(txt(420, 500 + i * 20, t, { an:'start', fs:11.5, fill:'#41505A', halo:0 })));
  }

  /* ---------- left column ---------- */
  function drawLeft(code) {
    const X = 26, W = 320, ec = code === 'ec6';
    const v = vertFor(code), l = latFor(code);
    let y = 30;
    y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Characteristic compressive strength', clause:'EN 1996-1-1 3.6.1.2' }, [
      { sym:'K', val:fmt(v.K, 2) }, { sym:'fb^0.7', val:fmt(Math.pow(state.fb, 0.7), 2) }, { sym:'fm^0.3', val:fmt(Math.pow(Math.min(state.fm, 2 * state.fb, 20), 0.3), 3) },
      { op:'=', sym:'fk', val:fmt(v.fk, 2) }]);
    if (state.tab === 'vertical') y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Vertical resistance per metre', clause: ec ? '6.1.2.1' : '32.2.1' }, [
      { sym: ec ? 'Φ' : 'β', val:fmt(v.Phi, 3) }, { sym:'t', val:String(state.t) }, { sym:'fk', val:fmt(v.fk, 2) },
      { op:'÷', sym: ec ? 'γM' : 'γm', val:fmt(gM(code), 1) }, { op:'=', sym:'kN/m', val:fmt(v.NRd, 0) }]);
    else y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Flexural strength parallel to the bed joints', clause: ec ? '6.3.1(3)' : '36.4.3' }, [
      { sym:'fxk1', val:fmt(state.fxk1, 2) }, { op:'÷', sym: ec ? 'γM' : 'γm', val:fmt(gM(code), 1) }, { op:'+', sym:'σd', val:fmt(l.sigd, 3) },
      { op:'=', sym:'fxd1,app', val:fmt(l.fx1, 3) }]);
    const items = [
      { name:'Vertical load, NEd / NRd', util:v.util, clause: ec ? '6.1.2' : '32.2' },
      { name:'Slenderness, hef/tef / 27', util:v.slender, clause: ec ? '5.5.1.4' : '28.1' },
      { name:'Lateral load, WEd / qRd', util:l.util, clause: ec ? '6.3, Annex E' : '36.4' }];
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:44, title:'Checks' }, items);
    return { items, v, l };
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aLoad', C.load), marker('aDim', C.ocean, 5),
      s('pattern', { id:'hatch', width:7, height:7, patternUnits:'userSpaceOnUse', patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 }))));
    const code = state.code, ec = code === 'ec6', other = ec ? 'bs' : 'ec6';
    const { items, v, l } = drawLeft(code);
    add(line(370, 16, 370, 544, { stroke:C.hair }));
    if (state.tab === 'vertical') drawVertical(v); else drawLateral(l);
    const vo = vertFor(other), lo = latFor(other);
    const verdict = DesignKit.verdict(items);
    resultsEl.innerHTML =
      chip('Verdict', verdict[0], verdict[1], verdict[2]) +
      chip('fk', `${fmt(v.fk, 2)} MPa`, `fd = ${fmt(v.fd, 2)} MPa`) +
      chip('hef / tef', fmt(v.SR, 1), `ρ = ${fmt(v.rho, 3)}`, v.slender <= 1 ? 'ok' : 'warn') +
      chip(ec ? 'Φ' : 'β', fmt(v.Phi, 3), ec ? `${v.govern} governs` : `em = ${fmt(v.em, 1)} mm`) +
      chip('NRd', `${fmt(v.NRd, 0)} kN/m`, `NEd = ${fmt(state.N, 0)} kN/m`, v.util <= 1 ? 'ok' : 'warn') +
      chip('Lateral qRd', `${fmt(l.qR, 2)} kN/m²`, l.mode, l.util <= 1 ? 'ok' : 'warn') +
      (l.alpha2 != null ? chip('α2', fmt(l.alpha2, 4), `μ = ${fmt(l.mu, 3)}`) : '') +
      chip(ec ? 'BS 5628 capacity' : 'EC6 NRd', `${fmt(vo.NRd, 0)} kN/m`, `lateral ${fmt(lo.qR, 2)} kN/m²`);
    DesignKit.trail(trailEl, 'Show the working', ec ? [
      { t:`fk = ${v.K} × ${state.fb}^0.7 × ${Math.min(state.fm, 2 * state.fb, 20)}^0.3 = ${fmt(v.fk, 3)} MPa, fd = fk/${state.gM6} = ${fmt(v.fd, 3)} MPa`, c:'EN 1996-1-1 3.6.1.2, 2.4.3' },
      { t:`hef = ρ h = ${fmt(v.rho, 3)} × ${state.h} = ${fmt(v.hef / 1000, 3)} m, tef = ${fmt(v.tef, 1)} mm, hef/tef = ${fmt(v.SR, 2)}`, c:'5.5.1.2, 5.5.1.3' },
      { t:`einit = hef/450 = ${fmt(v.einit, 2)} mm, ei = ${fmt(v.ei, 2)} mm, Φi = 1 − 2ei/t = ${fmt(v.phiI, 3)}`, c:'6.1.2.2' },
      { t:`em = ${fmt(v.em, 2)}, ek = ${fmt(v.ek, 2)}, emk = ${fmt(v.emk, 2)} mm, λ = ${fmt(v.lam, 3)}, u = ${fmt(v.u, 3)}, Φm = ${fmt(v.phim, 3)}`, c:'Annex G' },
      { t:`NRd = Φ t fd = ${fmt(v.Phi, 3)} × ${state.t} × ${fmt(v.fd, 3)} = ${fmt(v.NRd, 1)} kN/m`, c:'6.1.2.1' },
      { t:`Lateral: ${l.mode}, qRd = ${fmt(l.qR, 3)} kN/m² against ${fmt(state.W, 2)}`, c:'6.3' }
    ] : [
      { t:`fk = ${fmt(v.fk, 3)} MPa taken the same as EC6, γm = ${state.gMbs}`, c:'BS 5628-1 Table 4a' },
      { t:`hef/tef = ${fmt(v.SR, 2)}, ea = t[(hef/tef)²/2400 − 0.015] = ${fmt(v.ea, 2)} mm`, c:'Annex B' },
      { t:`em = 0.6ex + ea = ${fmt(v.em, 2)} mm, β = 1.1(1 − 2em/t) = ${fmt(v.beta, 3)}`, c:'Annex B' },
      { t:`Capacity β t fk/γm = ${fmt(v.NRd, 1)} kN/m`, c:'32.2.1' },
      { t:`Lateral: ${l.mode}, ${fmt(l.qR, 3)} kN/m²`, c:'36.4' }
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
    const ec = state.code === 'ec6';
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      select('code', 'Code', [['ec6', 'EN 1996-1-1'], ['bs', 'BS 5628-1']], state.code) +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      '<h3 style="margin-top:16px">Units and mortar</h3>' +
      select('unit', 'Units', [['clay1', 'Clay, group 1'], ['clay2', 'Clay, group 2'], ['conc1', 'Concrete block, group 1'],
        ['conc2', 'Concrete block, group 2'], ['cs1', 'Calcium silicate, group 1']], state.unit) +
      slider('fb', 'Normalised unit strength fb (MPa)', 3, 50, 0.1) +
      select('fm', 'Mortar', [[4, 'M4'], [6, 'M6'], [12, 'M12']], state.fm) +
      (ec ? slider('gM6', 'γM', 1.5, 3.0, 0.1) : slider('gMbs', 'γm', 2.5, 3.5, 0.1)) +
      '<h3>Wall</h3>' +
      slider('h', 'Storey height h (m)', 1.5, 6, 0.05) + slider('L', 'Length between returns L (m)', 1, 12, 0.1) +
      select('t', 'Loaded leaf t', [[90, '90 mm'], [100, '100 mm'], [102.5, '102.5 mm brick'], [140, '140 mm'], [190, '190 mm'], [215, '215 mm']], state.t) +
      `<label class="chk" style="margin:8px 0"><input type="checkbox" id="cavity"${state.cavity ? ' checked' : ''}> Cavity wall with an outer leaf</label>` +
      (state.cavity ? slider('t2', 'Outer leaf (mm)', 90, 215, 2.5) : '') +
      select('rho2', 'Top and bottom', [[0.75, 'Concrete floors, ρ2 = 0.75'], [1, 'Timber floors, ρ2 = 1.0']], state.rho2) +
      select('sides', 'Vertical edges', [[2, 'Free'], [3, 'One edge held'], [4, 'Both edges held']], state.sides) +
      '<h3>Vertical load</h3>' +
      slider('N', 'NEd (kN/m)', 0, 600, 1) + slider('e', 'Eccentricity at the top (mm)', 0, 60, 0.5) +
      (ec ? slider('creep', 'Final creep φ∞', 0.5, 2, 0.1) : '') +
      '<h3>Lateral load</h3>' +
      select('span', 'Support for wind', [['vertical', 'Top and bottom, spans vertically'], ['horizontal', 'Sides only, spans horizontally'],
        ['four', 'All four edges, two way'], ['arch', 'Tight between rigid supports, arching']], state.span) +
      slider('W', 'Wind WEd (kN/m²)', 0, 3, 0.05) + slider('Ngk', 'Permanent precompression (kN/m)', 0, 200, 1) +
      slider('fxk1', 'fxk1, parallel to bed joints (MPa)', 0.1, 1, 0.05) + slider('fxk2', 'fxk2, perpendicular (MPa)', 0.2, 2, 0.05);
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
    if (t.id === 'cavity') { state.cavity = t.checked; markCustom(); renderControls(); render(); return; }
    if (t.tagName === 'SELECT') {
      state[t.id] = ['fm', 't', 'rho2', 'sides'].includes(t.id) ? +t.value : t.value;
      markCustom();
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
