/* CivilLab · St1 Steel Member Capacity Checker */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const base = { holes:0, d0:22, ky:1, kz:1, psi:0, V:50 };
  const PRESETS = {
    beam:   { label:'Floor beam, one restraint', f:()=>Object.assign({}, base, { tab:'bend', family:'UB', idx:5, grade:'S275',
              N:0, M:250, V:150, L:6, nRest:1, shape:'udl' }) },
    column: { label:'Column, axial and moment', f:()=>Object.assign({}, base, { tab:'comp', family:'UC', idx:2, grade:'S355',
              N:1500, M:60, V:20, L:4, nRest:0, shape:'linear', psi:0 }) },
    tie:    { label:'Tie with bolt holes', f:()=>Object.assign({}, base, { tab:'tension', family:'UB', idx:2, grade:'S275',
              N:-1200, M:0, V:0, L:5, nRest:0, shape:'uniform', holes:4, d0:22 }) },
    long:   { label:'Long unrestrained beam', f:()=>Object.assign({}, base, { tab:'bend', family:'UB', idx:5, grade:'S275',
              N:0, M:250, V:80, L:10, nRest:0, shape:'uniform' }) },
    shs:    { label:'Hollow section strut', f:()=>Object.assign({}, base, { tab:'comp', family:'SHS', idx:2, grade:'S355',
              N:1200, M:40, V:20, L:5, nRest:0, shape:'linear', psi:0 }) }
  };
  const TABS = { cls:'Class', tension:'Tension', comp:'Compression', bend:'Bending', comb:'Combined' };
  const state = Object.assign({ preset:'beam', code:'ec3' }, PRESETS.beam.f());
  const solveFor = code => SteelEngine.solve(Object.assign({}, state, { code }));

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
  const dimH = (x1, x2, y, lab, col) => {
    add(line(x1, y, x2, y, { stroke:col, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
    add(txt((x1 + x2) / 2, y - 5, lab, { fs:10.5, fw:600, fill:col }));
  };

  /* section outline to scale, centred on (cx, cy) */
  function drawSection(sec, cx, cy, k, holes) {
    if (sec.family === 'SHS') {
      const b = sec.b * k, t = sec.t * k;
      add(s('rect', { x:cx - b / 2, y:cy - b / 2, width:b, height:b, rx:sec.r * k, fill:'#E9EDE6', stroke:C.ocean, 'stroke-width':1.4 }));
      add(s('rect', { x:cx - b / 2 + t, y:cy - b / 2 + t, width:b - 2 * t, height:b - 2 * t, rx:sec.t * k, fill:'#fff', stroke:C.ocean, 'stroke-width':1.2 }));
      return;
    }
    const h = sec.h * k, b = sec.b * k, tw = sec.tw * k, tf = sec.tf * k, r = sec.r * k;
    const xL = cx - b / 2, xR = cx + b / 2, yT = cy - h / 2, yB = cy + h / 2, wl = cx - tw / 2, wr = cx + tw / 2;
    const d = `M${xL},${yT} H${xR} V${yT + tf} H${wr + r} Q${wr},${yT + tf} ${wr},${yT + tf + r} V${yB - tf - r}` +
      ` Q${wr},${yB - tf} ${wr + r},${yB - tf} H${xR} V${yB} H${xL} V${yB - tf} H${wl - r} Q${wl},${yB - tf} ${wl},${yB - tf - r}` +
      ` V${yT + tf + r} Q${wl},${yT + tf} ${wl - r},${yT + tf} H${xL} Z`;
    add(s('path', { d, fill:'#E9EDE6', stroke:C.ocean, 'stroke-width':1.4 }));
    if (holes) {
      const hx = [xL + b * 0.22, xR - b * 0.22];
      [yT + tf / 2, yB - tf / 2].forEach(y => hx.forEach(x => {
        add(s('rect', { x:x - state.d0 * k / 2, y:y - tf / 2 - 1, width:state.d0 * k, height:tf + 2, fill:'#fff', stroke:C.load, 'stroke-width':1 }));
      }));
    }
  }

  /* ---------- tabs ---------- */
  function drawClass(r) {
    const sec = r.s;
    title(`Classification, ${r.code === 'ec3' ? 'EN 1993-1-1 Table 5.2' : 'BS 5950 Table 11'}, ε = ${fmt(r.eps, 3)}`);
    const k = Math.min(300 / sec.h, 260 / sec.b), cx = 520, cy = 290;
    drawSection(sec, cx, cy, k);
    if (sec.family === 'I') {
      const xR = cx + sec.b * k / 2, wr = cx + sec.tw * k / 2 + sec.r * k, yT = cy - sec.h * k / 2;
      dimH(wr, xR, yT - 14, `c = ${fmt(r.code === 'ec3' ? sec.cf : sec.b / 2, 1)}`, C.water);
      add(txt(xR + 6, yT + sec.tf * k / 2 + 4, `tf ${sec.tf}`, { an:'start', fs:10.5, fill:C.water }));
      const yA = cy - sec.h * k / 2 + (sec.tf + sec.r) * k, yB2 = cy + sec.h * k / 2 - (sec.tf + sec.r) * k;
      add(line(cx - 40, yA, cx - 40, yB2, { stroke:C.midblue, 'marker-start':'url(#aDim)', 'marker-end':'url(#aDim)' }));
      add(txt(cx - 46, cy, `c = ${fmt(r.code === 'ec3' ? sec.cw : sec.h - 2 * sec.tf - 2 * sec.r, 1)}`, { an:'end', fs:10.5, fw:600, fill:C.midblue }));
      add(txt(cx + sec.tw * k / 2 + 6, cy + 20, `tw ${sec.tw}`, { an:'start', fs:10.5, fill:C.midblue }));
    } else {
      dimH(cx - sec.cw * k / 2, cx + sec.cw * k / 2, cy - sec.b * k / 2 - 14, `c = b − 3t = ${fmt(sec.cw, 1)}`, C.water);
    }
    /* one ladder per part */
    const LX = 700, LW = 230;
    r.cl.parts.forEach((p, i) => {
      const y = 90 + i * 120;
      add(txt(LX, y, `${p.part}`, { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
      add(txt(LX, y + 16, `c/t = ${fmt(p.ratio, 2)}, class ${p.cls}`, { an:'start', fs:11.5, fw:600, fill: p.cls <= 2 ? C.green : p.cls === 3 ? C.water : C.load, halo:0 }));
      const top = Math.max(p.lim[2] * 1.25, p.ratio * 1.1);
      const X = v => LX + v / top * LW;
      const bands = [[0, p.lim[0], '1'], [p.lim[0], p.lim[1], '2'], [p.lim[1], p.lim[2], '3'], [p.lim[2], top, '4']];
      const cols = [C.green, '#5E9C7C', C.water, C.load];
      bands.forEach((bd, j) => {
        add(s('rect', { x:X(bd[0]), y:y + 26, width:Math.max(0, X(bd[1]) - X(bd[0])), height:16, fill:cols[j], 'fill-opacity':.25 }));
        add(txt((X(bd[0]) + X(bd[1])) / 2, y + 38, bd[2], { fs:10, fw:600, fill:cols[j], halo:0 }));
        if (j < 3) add(txt(X(bd[1]), y + 56, fmt(bd[1], 1), { fs:9.5, halo:0 }));
      });
      add(line(X(p.ratio), y + 20, X(p.ratio), y + 48, { stroke:C.ocean, 'stroke-width':2.4 }));
    });
    add(txt(700, 90 + r.cl.parts.length * 120 + 10, `Section class ${r.cl.cls}`, { an:'start', fs:15, fw:600, fill: r.cl.cls <= 2 ? C.green : r.cl.cls === 3 ? C.water : C.load, head:true, halo:0 }));
    add(txt(700, 90 + r.cl.parts.length * 120 + 30, r.cl.cls <= 2 ? 'plastic modulus allowed' : r.cl.cls === 3 ? 'elastic modulus only' : 'class 4, effective section needed',
      { an:'start', fs:11, halo:0 }));
  }

  function drawTension(r) {
    const sec = r.s, ec = r.code === 'ec3';
    title('Tension, gross yield against net fracture');
    drawSection(sec, 560, 260, Math.min(260 / sec.h, 240 / sec.b), state.holes > 0 && sec.family === 'I');
    const N = Math.max(-state.N, 0);
    add(line(400, 470, 520, 470, { stroke:C.load, 'stroke-width':3, 'marker-start':'url(#aLoad)' }));
    add(line(600, 470, 720, 470, { stroke:C.load, 'stroke-width':3, 'marker-end':'url(#aLoad)' }));
    add(txt(560, 474, `${fmt(N, 0)} kN`, { fs:12, fw:600, fill:C.load }));
    const rows = ec ? [
      `Npl,Rd = A fy / γM0 = ${fmt(sec.A, 0)} × ${r.fy} = ${fmt(r.Npl, 0)} kN`,
      `Anet = A − n d0 tf = ${fmt(r.Anet, 0)} mm² with ${state.holes} holes of ${state.d0} mm`,
      `Nu,Rd = 0.9 Anet fu / γM2 = 0.9 × ${fmt(r.Anet, 0)} × ${r.fu} / 1.25 = ${fmt(r.Nu, 0)} kN`,
      `Nt,Rd = ${fmt(r.NtRd, 0)} kN, ${r.Nu < r.Npl ? 'net fracture governs' : 'gross yield governs'}`
    ] : [
      `Ae = Ke Anet = ${r.Ke} × ${fmt(r.Anet, 0)}, not more than Ag = ${fmt(sec.A, 0)} mm²`,
      `Pt = py Ae = ${r.fy} × ${fmt(Math.min(r.Ke * r.Anet, sec.A), 0)} = ${fmt(r.Pt, 0)} kN`
    ];
    rows.forEach((t, i) => add(txt(780, 140 + i * 22, t, { an:'start', fs:11.5, fill:'#41505A', halo:0 })));
  }

  /* chi against slenderness for the five curves */
  function drawCurves(r) {
    const ec = r.code === 'ec3';
    title(ec ? 'Flexural buckling, EN 1993-1-1 Table 6.2 curves' : 'Struts, BS 5950 Table 24, Perry-Robertson');
    const P = { x0:430, x1:920, y0:60, y1:470 };
    const lmax = ec ? 2.5 : 250;
    const X = v => P.x0 + v / lmax * (P.x1 - P.x0), Y = v => P.y1 - v * (P.y1 - P.y0);
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    add(txt(P.x1, P.y1 + 32, ec ? 'λ̄, non-dimensional slenderness' : 'λ = LE / r', { an:'end', fs:10.5 }));
    add(txt(P.x0 - 30, (P.y0 + P.y1) / 2, ec ? 'χ' : 'pc / py', { fs:11, rot:-90 }));
    for (let i = 0; i <= 5; i++) { const v = lmax * i / 5;
      add(txt(X(v), P.y1 + 15, fmt(v, ec ? 1 : 0), { fs:9.5 })); }
    for (let i = 0; i <= 4; i++) add(txt(P.x0 - 6, Y(i / 4) + 4, fmt(i / 4, 2), { an:'end', fs:9.5 }));
    const list = ec ? ['a0', 'a', 'b', 'c', 'd'] : ['a', 'b', 'c', 'd'];
    const rob = { a:2.0, b:3.5, c:5.5, d:8.0 };
    list.forEach((cv, j) => {
      let d = '';
      for (let i = 0; i <= 80; i++) {
        const l = lmax * i / 80;
        const v = ec ? SteelEngine.chi(l, cv) : SteelEngine.perry(r.fy, Math.max(l, 1), rob[cv]) / r.fy;
        d += `${i ? 'L' : 'M'}${X(l)},${Y(v)}`;
      }
      add(s('path', { d, fill:'none', stroke:C.contour, 'stroke-width':1.3 }));
      const lab = ec ? 1.9 : 190;
      const v = ec ? SteelEngine.chi(lab, cv) : SteelEngine.perry(r.fy, lab, rob[cv]) / r.fy;
      add(txt(X(lab) + 4, Y(v) - 3, cv, { an:'start', fs:10, fill:C.muted }));
    });
    const pts = ec ? [['y', r.lamy, r.chiy, r.cv.y, C.water], ['z', r.lamz, r.chiz, r.cv.z, C.load]]
                   : [['x', r.lx, r.pcx / r.fy, '', C.water], ['y', r.ly, r.pcy / r.fy, '', C.load]];
    pts.forEach((p, i) => {
      const x = X(Math.min(p[1], lmax)), y = Y(p[2]);
      add(line(x, P.y1, x, y, { stroke:p[4], 'stroke-dasharray':'3 3' }));
      add(s('circle', { cx:x, cy:y, r:6, fill:p[4], stroke:'#fff', 'stroke-width':2 }));
      add(txt(x + 9, y - 8 - i * 14, ec ? `${p[0]}-${p[0]}: λ̄ ${fmt(p[1], 3)}, χ ${fmt(p[2], 3)}, curve ${p[3]}`
        : `${p[0]}-${p[0]}: λ ${fmt(p[1], 0)}, pc ${fmt(p[2] * r.fy, 0)} MPa`, { an:'start', fs:11, fw:600, fill:p[4] }));
    });
    add(txt(430, 530, ec ? `Nb,y,Rd = ${fmt(r.Nby, 0)} kN, Nb,z,Rd = ${fmt(r.Nbz, 0)} kN, Lcr,z = ${fmt(r.Lcz / 1000, 2)} m`
      : `Pcx = ${fmt(r.Pcx, 0)} kN, Pcy = ${fmt(r.Pcy, 0)} kN`, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  function drawBend(r) {
    const ec = r.code === 'ec3';
    title(ec ? 'Lateral torsional buckling between restraints, 6.3.2.3' : 'Lateral torsional buckling, BS 5950 4.3.6');
    /* elevation with the restraints */
    const X0 = 420, W = 480, Y = 90;
    add(s('rect', { x:X0, y:Y, width:W, height:22, fill:'#E9EDE6', stroke:C.ocean }));
    add(s('polygon', { points:`${X0},${Y + 22} ${X0 - 8},${Y + 34} ${X0 + 8},${Y + 34}`, fill:C.green }));
    add(s('polygon', { points:`${X0 + W},${Y + 22} ${X0 + W - 8},${Y + 34} ${X0 + W + 8},${Y + 34}`, fill:C.green }));
    for (let i = 1; i <= state.nRest; i++) {
      const x = X0 + W * i / (state.nRest + 1);
      add(line(x, Y - 16, x, Y + 38, { stroke:C.green, 'stroke-width':2 }));
      add(txt(x, Y - 20, 'restraint', { fs:9.5, fill:C.green }));
    }
    add(txt(X0 + W / 2, Y + 52, `L = ${fmt(state.L, 1)} m, unrestrained length ${fmt(state.L / (state.nRest + 1), 2)} m`, { fs:11 }));
    /* bending moment shape */
    const MY = 170, MH = 50;
    let d = `M${X0},${MY}`;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const m = state.shape === 'udl' ? 4 * t * (1 - t) : state.shape === 'point' ? (t < 0.5 ? 2 * t : 2 * (1 - t))
        : state.shape === 'linear' ? 1 - t * (1 - state.psi) : 1;
      d += ` L${X0 + W * t},${MY + m * MH}`;
    }
    add(s('path', { d: d + ` L${X0 + W},${MY} Z`, fill:C.green, 'fill-opacity':.13, stroke:C.green, 'stroke-width':2 }));
    add(txt(X0 - 6, MY + MH / 2, 'M', { an:'end', fs:11, fill:C.green }));
    /* chi_LT curve */
    const P = { x0:440, x1:900, y0:270, y1:510 };
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    if (r.s.family !== 'I') {
      add(txt((P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2, 'A closed hollow section does not twist sideways, so χLT = 1.', { fs:12, fill:C.green }));
      return;
    }
    const lmax = ec ? 2.5 : 250;
    const Xp = v => P.x0 + v / lmax * (P.x1 - P.x0), Yp = v => P.y1 - v * (P.y1 - P.y0);
    let dc = '';
    for (let i = 0; i <= 80; i++) {
      const l = lmax * i / 80;
      let v;
      if (ec) {
        const a = SteelEngine.ALPHA[r.cv.lt], ph = 0.5 * (1 + a * (l - 0.4) + 0.75 * l * l);
        v = l <= 0.4 ? 1 : Math.min(1, 1 / (l * l), 1 / (ph + Math.sqrt(ph * ph - 0.75 * l * l)));
      } else {
        const lam = Math.max(l, 1), pE = Math.PI ** 2 * 210000 / lam ** 2, l0 = 0.4 * Math.sqrt(Math.PI ** 2 * 210000 / r.fy);
        const ph = (r.fy + (Math.max(0, 0.007 * (lam - l0)) + 1) * pE) / 2;
        v = Math.min(r.fy, pE * r.fy / (ph + Math.sqrt(ph * ph - pE * r.fy))) / r.fy;
      }
      dc += `${i ? 'L' : 'M'}${Xp(l)},${Yp(v)}`;
    }
    add(s('path', { d:dc, fill:'none', stroke:C.ocean, 'stroke-width':2 }));
    const lv = ec ? r.lamLT : r.lamLT, cv = ec ? r.chiMod : r.pb / r.fy;
    add(s('circle', { cx:Xp(Math.min(lv, lmax)), cy:Yp(cv), r:6, fill:C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(Xp(Math.min(lv, lmax)) + 9, Yp(cv) - 8, ec ? `λ̄LT ${fmt(lv, 3)}, χLT,mod ${fmt(cv, 3)}` : `λLT ${fmt(lv, 0)}, pb ${fmt(r.pb, 0)} MPa`,
      { an:'start', fs:11, fw:600, fill:C.load }));
    add(txt(P.x1, P.y1 + 18, ec ? 'λ̄LT' : 'λLT', { an:'end', fs:10.5 }));
    add(txt(P.x0 - 8, P.y0 + 4, ec ? 'χLT 1.0' : 'pb/py 1.0', { an:'end', fs:10 }));
    add(txt(430, 550, ec ? `Mcr = ${fmt(r.Mcr, 0)} kNm with C1 = ${fmt(r.sh.C1, 3)}, curve ${r.cv.lt}, f = ${fmt(r.f, 3)}, Mb,Rd = ${fmt(r.MbRd, 0)} kNm`
      : `v = ${fmt(r.v, 3)}, mLT = ${fmt(r.sh.mLT, 3)}, Mb = ${fmt(r.Mb, 0)} kNm`, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  function drawComb(r) {
    const ec = r.code === 'ec3';
    title(ec ? 'Axial force with bending, 6.3.3 and Annex B' : 'Axial force with bending, BS 5950 4.8.3.3.1');
    const P = { x0:450, x1:880, y0:70, y1:500 };
    const X = v => P.x0 + v / 1.3 * (P.x1 - P.x0), Y = v => P.y1 - v / 1.3 * (P.y1 - P.y0);
    add(line(P.x0, P.y1, P.x1, P.y1, { stroke:C.axis }));
    add(line(P.x0, P.y0, P.x0, P.y1, { stroke:C.axis }));
    add(txt(P.x1, P.y1 + 30, ec ? 'My,Ed / Mb,Rd' : 'mLT M / Mb', { an:'end', fs:10.5 }));
    add(txt(P.x0 - 34, (P.y0 + P.y1) / 2, ec ? 'NEd / Nb,z,Rd' : 'Fc / Pcy', { fs:10.5, rot:-90 }));
    [0, 0.5, 1].forEach(v => { add(txt(X(v), P.y1 + 15, fmt(v, 1), { fs:9.5 })); add(txt(P.x0 - 6, Y(v) + 4, fmt(v, 1), { an:'end', fs:9.5 })); });
    add(s('polygon', { points:`${X(0)},${Y(0)} ${X(1)},${Y(0)} ${X(0)},${Y(1)}`, fill:C.green, 'fill-opacity':.1, stroke:C.green, 'stroke-width':2 }));
    add(txt(X(0.55), Y(0.55) - 6, 'n + k m = 1', { fs:10.5, fill:C.green, rot:-45 }));
    const n = ec ? Math.max(state.N, 0) / r.Nbz : Math.max(state.N, 0) / r.Pcy;
    const m = ec ? r.kzy * Math.abs(state.M) / r.MbRd : r.sh.mLT * Math.abs(state.M) / r.Mb;
    const pass = n + m <= 1;
    add(s('circle', { cx:X(Math.min(m, 1.25)), cy:Y(Math.min(n, 1.25)), r:6.5, fill: pass ? C.green : C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(X(Math.min(m, 1.25)) + 10, Y(Math.min(n, 1.25)) - 8, `${fmt(n, 3)} + ${fmt(m, 3)} = ${fmt(n + m, 3)}`, { an:'start', fs:11.5, fw:600, fill: pass ? C.green : C.load }));
    const rows = ec ? [`6.61: ${fmt(r.i61, 3)} with kyy = ${fmt(r.kyy, 3)}`, `6.62: ${fmt(r.i62, 3)} with kzy = ${fmt(r.kzy, 3)}`, `Cm = ${fmt(r.sh.Cm, 2)} from the moment shape`]
      : [`Cross section: ${fmt(r.i1, 3)}`, `Member buckling: ${fmt(r.i2, 3)}`, `mx = ${fmt(r.sh.mx, 2)}, mLT = ${fmt(r.sh.mLT, 3)}`];
    add(txt(450, 548, rows.join('   ·   '), { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- left column ---------- */
  function drawLeft(r) {
    const X = 26, W = 320, ec = r.code === 'ec3', sec = r.s;
    let y = 30;
    const chains = {
      cls: () => DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Material factor ε', clause: ec ? 'Table 5.2' : 'Table 11' }, [
        { sym: ec ? '235 / fy' : '275 / py', val:fmt(ec ? 235 / r.fy : 275 / r.fy, 3) }, { op:'√', sym:'ε', val:fmt(r.eps, 3) }]),
      tension: () => ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Net section fracture', clause:'6.2.3(2)b' }, [
        { sym:'0.9 Anet', val:fmt(0.9 * r.Anet, 0) }, { sym:'fu', val:String(r.fu) }, { op:'÷', sym:'γM2', val:'1.25' },
        { op:'=', sym:'Nu,Rd', val:fmt(r.Nu, 0) }])
        : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Tension capacity', clause:'4.6.1' }, [
        { sym:'py', val:String(r.fy) }, { sym:'Ae', val:fmt(Math.min(r.Ke * r.Anet, sec.A), 0) }, { op:'=', sym:'Pt kN', val:fmt(r.Pt, 0) }]),
      comp: () => ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Buckling resistance, weak axis', clause:'6.3.1.1' }, [
        { sym:'χz', val:fmt(r.chiz, 3) }, { sym:'A fy kN', val:fmt(r.NRk, 0) }, { op:'÷', sym:'γM1', val:'1.0' },
        { op:'=', sym:'Nb,z,Rd', val:fmt(r.Nbz, 0) }])
        : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Compression resistance', clause:'4.7.4' }, [
        { sym:'pc', val:fmt(Math.min(r.pcx, r.pcy), 0) }, { sym:'Ag', val:fmt(sec.A, 0) }, { op:'=', sym:'Pc kN', val:fmt(Math.min(r.Pcx, r.Pcy), 0) }]),
      bend: () => ec ? DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Buckling moment', clause:'6.3.2.1' }, [
        { sym:'χLT,mod', val:fmt(r.chiMod, 3) }, { sym:'W fy kNm', val:fmt(r.Mrk, 0) }, { op:'÷', sym:'γM1', val:'1.0' },
        { op:'=', sym:'Mb,Rd', val:fmt(r.MbRd, 0) }])
        : DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Buckling resistance moment', clause:'4.3.6.4' }, [
        { sym:'pb', val:fmt(r.pb, 0) }, { sym:'Sx', val:fmt(sec.Wply / 1e3, 0) + 'k' }, { op:'=', sym:'Mb kNm', val:fmt(r.Mb, 0) }]),
      comb: () => DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Member interaction', clause: ec ? '6.3.3(4) eq 6.62' : '4.8.3.3.1' }, ec ? [
        { sym:'N / Nb,z', val:fmt(Math.max(state.N, 0) / r.Nbz, 3) }, { op:'+', sym:'kzy M / Mb', val:fmt(r.kzy * Math.abs(state.M) / r.MbRd, 3) },
        { op:'=', sym:'total', val:fmt(r.i62, 3) }] : [
        { sym:'Fc / Pcy', val:fmt(Math.max(state.N, 0) / r.Pcy, 3) }, { op:'+', sym:'mLT M / Mb', val:fmt(r.sh.mLT * Math.abs(state.M) / r.Mb, 3) },
        { op:'=', sym:'total', val:fmt(r.i2, 3) }])
    };
    y = chains[state.tab]();
    const items = [
      { name:'Tension', util:r.u.tension, clause: ec ? '6.2.3' : '4.6' },
      { name:'Compression, flexural buckling', util:r.u.comp, clause: ec ? '6.3.1' : '4.7' },
      { name:'Bending, cross section', util:r.u.section, clause: ec ? '6.2.5' : '4.2.5' },
      { name:'Bending, lateral torsional buckling', util:r.u.bend, clause: ec ? '6.3.2' : '4.3.6' },
      { name:'Shear', util:r.u.shear, clause: ec ? '6.2.6' : '4.2.3' },
      { name:'Axial and bending together', util:r.u.combined, clause: ec ? '6.3.3' : '4.8.3' }];
    if (r.cl.cls === 4) items.push({ name:'Class 4, outside this app', util:Infinity, clause: ec ? '5.5.2' : '3.5' });
    DesignKit.bars(fig, { x:X, y:y + 16, w:W, gap:44, title:`Checks, class ${r.cl.cls}, fy = ${r.fy} MPa` }, items);
    return items;
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('aDim', C.ocean, 5), marker('aLoad', C.load)));
    const r = solveFor(state.code);
    const other = solveFor(state.code === 'ec3' ? 'bs' : 'ec3');
    const items = drawLeft(r);
    add(line(370, 16, 370, 564, { stroke:C.hair }));
    ({ cls:drawClass, tension:drawTension, comp:drawCurves, bend:drawBend, comb:drawComb })[state.tab](r);

    const ec = r.code === 'ec3', sec = r.s;
    const v = DesignKit.verdict(items);
    const oItems = Object.values(other.u);
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('Section', sec.name, `${state.family} ${state.grade}, class ${r.cl.cls}`) +
      chip(ec ? 'Nt,Rd' : 'Pt', `${fmt(ec ? r.NtRd : r.Pt, 0)} kN`, ec ? (r.Nu < r.Npl ? 'net fracture' : 'gross yield') : `Ke = ${r.Ke}`) +
      chip(ec ? 'Nb,Rd' : 'Pc', `${fmt(ec ? Math.min(r.Nby, r.Nbz) : Math.min(r.Pcx, r.Pcy), 0)} kN`,
           ec ? `χz = ${fmt(r.chiz, 3)}` : `pc = ${fmt(Math.min(r.pcx, r.pcy), 0)} MPa`, r.u.comp <= 1 ? 'ok' : 'warn') +
      chip(ec ? 'Mc,Rd' : 'Mc', `${fmt(ec ? r.McRd : r.Mc, 0)} kNm`, r.cl.cls <= 2 ? 'plastic' : 'elastic') +
      chip(ec ? 'Mb,Rd' : 'Mb', `${fmt(ec ? r.MbRd : r.Mb, 0)} kNm`, ec ? `χLT = ${fmt(r.chiMod, 3)}` : `pb = ${fmt(r.pb, 0)} MPa`, r.u.bend <= 1 ? 'ok' : 'warn') +
      (ec ? chip('Mcr', isFinite(r.Mcr) ? `${fmt(r.Mcr, 0)} kNm` : '–', `C1 = ${fmt(r.sh.C1, 3)}`) : chip('λLT', fmt(r.lamLT, 0), `v = ${fmt(r.v, 3)}`)) +
      chip(ec ? 'Vpl,Rd' : 'Pv', `${fmt(ec ? r.VplRd : r.Pv, 0)} kN`, `VEd = ${fmt(Math.abs(state.V), 0)} kN`, r.u.shear <= 1 ? 'ok' : 'warn') +
      chip('Interaction', fmt(r.u.combined, 3), ec ? '6.61 and 6.62' : '4.8.3.3.1', r.u.combined <= 1 ? 'ok' : 'warn') +
      chip(ec ? 'BS 5950 worst' : 'EC3 worst', `${fmt(Math.max(...oItems) * 100, 0)}%`, `class ${other.cl.cls}`);

    const steps = ec ? [
      { t:`fy = ${r.fy} MPa for tf = ${sec.tmax} mm, ε = √(235/fy) = ${fmt(r.eps, 3)}`, c:'EN 10025-2, Table 5.2' },
      ...r.cl.parts.map(p => ({ t:`${p.part}: c/t = ${fmt(p.ratio, 2)} against ${p.lim.map(x => fmt(x, 1)).join(', ')}, class ${p.cls}`, c:'Table 5.2' })),
      { t:`Npl,Rd = ${fmt(r.Npl, 0)} kN, Nu,Rd = ${fmt(r.Nu, 0)} kN`, c:'6.2.3' },
      { t:`λ̄y = ${fmt(r.lamy, 3)} on curve ${r.cv.y}, λ̄z = ${fmt(r.lamz, 3)} on curve ${r.cv.z}, χz = ${fmt(r.chiz, 4)}, Nb,z,Rd = ${fmt(r.Nbz, 0)} kN`, c:'6.3.1.2' },
      { t:`Mcr = C1 π²EIz/L² √(Iw/Iz + L²GIt/π²EIz) = ${fmt(r.Mcr, 1)} kNm over ${fmt(r.Lb / 1000, 2)} m`, c:'NCCI SN003' },
      { t:`λ̄LT = ${fmt(r.lamLT, 3)}, χLT = ${fmt(r.chiLT, 4)}, f = ${fmt(r.f, 3)}, Mb,Rd = ${fmt(r.MbRd, 1)} kNm`, c:'6.3.2.3' },
      { t:`Vpl,Rd = Av fy/√3 = ${fmt(sec.Av, 0)} × ${r.fy}/√3 = ${fmt(r.VplRd, 0)} kN`, c:'6.2.6' },
      { t:`Interaction 6.61 = ${fmt(r.i61, 3)}, 6.62 = ${fmt(r.i62, 3)}`, c:'6.3.3, Annex B' }
    ] : [
      { t:`py = ${r.fy} MPa, ε = √(275/py) = ${fmt(r.eps, 3)}`, c:'BS 5950 Tables 9, 11' },
      ...r.cl.parts.map(p => ({ t:`${p.part} = ${fmt(p.ratio, 2)} against ${p.lim.map(x => fmt(x, 1)).join(', ')}, class ${p.cls}`, c:'Table 11' })),
      { t:`Pt = py Ae = ${fmt(r.Pt, 0)} kN`, c:'4.6.1' },
      { t:`λx = ${fmt(r.lx, 0)}, λy = ${fmt(r.ly, 0)}, pc = ${fmt(Math.min(r.pcx, r.pcy), 0)} MPa, Pc = ${fmt(Math.min(r.Pcx, r.Pcy), 0)} kN`, c:'4.7.4, Annex C' },
      { t:`λLT = 0.9 v λ = ${fmt(r.lamLT, 1)}, pb = ${fmt(r.pb, 1)} MPa, Mb = ${fmt(r.Mb, 1)} kNm`, c:'4.3.6.7, B.2' },
      { t:`Pv = 0.6 py Av = ${fmt(r.Pv, 0)} kN`, c:'4.2.3' },
      { t:`Simplified interaction ${fmt(r.i1, 3)} and ${fmt(r.i2, 3)}`, c:'4.8.3.3.1' }
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

  function renderControls() {
    controls.innerHTML =
      select('preset', 'Preset', Object.keys(PRESETS).map(k => [k, PRESETS[k].label]).concat([['custom', 'Custom']]), state.preset) +
      select('code', 'Code', [['ec3', 'EN 1993-1-1 with UK NA'], ['bs', 'BS 5950-1:2000']], state.code) +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      '<h3 style="margin-top:16px">Section</h3>' +
      select('family', 'Family', [['UB', 'Universal beam'], ['UC', 'Universal column'], ['SHS', 'Square hollow, hot finished']], state.family) +
      select('idx', 'Size', SteelEngine.TABLE[state.family].map((row, i) => [i, row[0]]), state.idx) +
      select('grade', 'Grade', [['S275', 'S275'], ['S355', 'S355']], state.grade) +
      '<h3>Actions, design values</h3>' +
      slider('N', 'Axial N, compression + (kN)', -3000, 6000, 10) + slider('M', 'Major axis moment (kNm)', 0, 1500, 5) +
      slider('V', 'Shear (kN)', 0, 1500, 5) +
      '<h3>Length and restraint</h3>' +
      slider('L', 'Member length (m)', 1, 16, 0.1) +
      slider('ky', 'Effective length factor, major axis', 0.5, 2, 0.05) + slider('kz', 'Effective length factor, minor axis', 0.5, 2, 0.05) +
      slider('nRest', 'Intermediate lateral restraints', 0, 4, 1) +
      select('shape', 'Moment shape between restraints', [['uniform', 'Uniform'], ['udl', 'UDL, simply supported'],
        ['point', 'Central point load'], ['linear', 'Linear, end moments']], state.shape) +
      slider('psi', 'End moment ratio ψ (linear)', -1, 1, 0.1) +
      '<h3>Bolt holes for tension</h3>' +
      slider('holes', 'Holes in the cross section', 0, 8, 1) +
      select('d0', 'Hole diameter', [[18, '18 mm'], [22, '22 mm'], [26, '26 mm']], state.d0);
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
      state[t.id] = (t.id === 'idx' || t.id === 'd0') ? +t.value : t.value;
      if (t.id === 'family') { state.idx = Math.min(state.idx, SteelEngine.TABLE[state.family].length - 1); renderControls(); }
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
