/* CivilLab · C2 RC Column Designer */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const trailEl = document.getElementById('trail');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };
  const VW = 960, VH = 600;

  const PRESETS = {
    short:   { label:'Short braced column',  f:()=>({ b:300, h:300, phi:25, nx:2, ny:2, cover:30,
               fck:30, fyk:500, NEd:1000, Mx:60, My:0, l0:3.0, rm:-0.5, phiEf:1 }) },
    slender: { label:'Slender column',       f:()=>({ b:300, h:300, phi:25, nx:2, ny:2, cover:30,
               fck:30, fyk:500, NEd:1000, Mx:40, My:0, l0:4.5, rm:1, phiEf:1 }) },
    biax:    { label:'Corner column, biaxial', f:()=>({ b:300, h:400, phi:20, nx:3, ny:3, cover:30,
               fck:30, fyk:500, NEd:1200, Mx:80, My:40, l0:3.5, rm:0.5, phiEf:1 }) },
    bend:    { label:'Light load, big moment', f:()=>({ b:300, h:500, phi:25, nx:3, ny:2, cover:30,
               fck:30, fyk:500, NEd:300, Mx:250, My:0, l0:3.0, rm:-1, phiEf:1 }) }
  };
  const TABS = { nm:'N-M diagram', slender:'Slenderness', biax:'Biaxial' };
  const state = Object.assign({ preset:'short', code:'ec2', tab:'nm' }, PRESETS.short.f());

  const solveFor = code => RCColumnEngine.solve(Object.assign({}, state, { code, link:10 }));

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

  /* ---------- the section with its strain at the capacity state ---------- */
  function drawSection(r) {
    const X0 = 40, Y0 = 50, BOX = 145;
    const sc = BOX / Math.max(state.b, state.h);
    const w = state.b * sc, h = state.h * sc;
    add(txt(X0, 30, 'Section at MRd,x', { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(s('rect', { x:X0, y:Y0, width:w, height:h, fill:'#fff', stroke:C.ocean, 'stroke-width':2 }));
    const cap = r.capX;
    if (cap) {
      const a = Math.min(cap.a, state.h) * sc;
      add(s('rect', { x:X0, y:Y0, width:w, height:a, fill:C.load, 'fill-opacity':.13 }));
      if (cap.x < state.h) {
        const yx = Y0 + cap.x * sc;
        add(line(X0 - 8, yx, X0 + w + 8, yx, { stroke:C.load, 'stroke-width':1.4, 'stroke-dasharray':'5 3' }));
        add(txt(X0 + w + 10, yx + 4, `x = ${fmt(cap.x, 0)}`, { an:'start', fs:10.5, fill:C.load }));
      }
    }
    r.layX.bars.forEach(bar => add(s('circle', { cx:X0 + bar.x * sc, cy:Y0 + bar.y * sc,
      r:Math.max(2.5, state.phi / 2 * sc), fill:C.ocean })));
    add(txt(X0 + w / 2, Y0 + h + 16, `b = ${state.b}`, { fs:10.5 }));
    add(txt(X0 - 8, Y0 + h / 2, `h = ${state.h}`, { fs:10.5, rot:-90 }));
    add(txt(X0 + w / 2, Y0 + h + 30, `${r.layX.n}H${state.phi}, As = ${fmt(r.As, 0)} mm², ρ = ${fmt(r.rho * 100, 2)}%`,
      { fs:10.5, fill:C.ocean }));

    /* strain profile beside it, compression to the left */
    if (cap) {
      const SX = X0 + Math.max(w, 120) + 62, half = 34;
      const emax = Math.max(Math.abs(cap.etop), Math.abs(cap.ebot), 0.0035);
      const ex = e => SX - e / emax * half;
      add(line(SX, Y0, SX, Y0 + h, { stroke:C.axis }));
      add(s('polygon', { points:`${SX},${Y0} ${ex(cap.etop)},${Y0} ${ex(cap.ebot)},${Y0 + h} ${SX},${Y0 + h}`,
        fill:C.water, 'fill-opacity':.13, stroke:C.water, 'stroke-width':1.6 }));
      add(txt(ex(cap.etop), Y0 - 6, `${fmt(cap.etop * 1000, 2)}‰`, { fs:10, fill:C.water }));
      add(txt(ex(cap.ebot), Y0 + h + 13, `${fmt(cap.ebot * 1000, 2)}‰`, { fs:10, fill:C.water }));
      add(txt(SX, Y0 - 20, 'strain', { fs:10, fill:C.muted }));
    }
  }

  /* ---------- strength chains and the utilisation bars ---------- */
  function drawLeftBottom(r) {
    const X = 30, W = 300;
    let y = 262;
    if (r.code === 'ec2') {
      y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Concrete design strength', clause:'EN 1992-1-1 3.1.6' }, [
        { sym:'αcc', val:'0.85' }, { sym:'fck', val:fmt(state.fck, 0) },
        { op:'÷', sym:'γc', val:'1.5' }, { op:'=', sym:'fcd', val:fmt(r.m.fc, 1) }]);
      y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Steel design strength', clause:'EN 1992-1-1 3.2.7' }, [
        { sym:'fyk', val:fmt(state.fyk, 0) }, { op:'÷', sym:'γs', val:'1.15' },
        { op:'=', sym:'fyd', val:fmt(r.m.fyd, 1) }]);
    } else {
      y = DesignKit.chain(fig, { x:X, y, w:W, h:40, title:'Concrete block stress', clause:'BS 8110-1 3.4.4.4' }, [
        { sym:'0.67/γm', val:'0.45' }, { sym:'fcu', val:fmt(r.m.fcu, 0) },
        { op:'=', sym:'0.45 fcu', val:fmt(r.m.fc, 2) }]);
      y = DesignKit.chain(fig, { x:X, y:y + 6, w:W, h:40, title:'Steel design strength', clause:'BS 8110-1 2.4.4.1' }, [
        { sym:'1/γm', val:'0.87' }, { sym:'fy', val:fmt(state.fyk, 0) },
        { op:'=', sym:'0.87 fy', val:fmt(r.m.fyd, 1) }]);
    }
    const ec = r.code === 'ec2';
    return DesignKit.bars(fig, { x:X, y:y + 14, w:W, gap:36, title:'Checks' }, [
      { name:'Axial load, NEd / N0', util:r.axialUtil, clause: ec ? '6.1' : '3.8.4.3' },
      { name:'Major axis, MEd,x / MRd,x', util:r.ux, clause: ec ? '6.1, 5.8.8' : '3.8.4.1' },
      { name:'Minor axis, MEd,y / MRd,y', util:r.uy, clause: ec ? '6.1, 5.8.8' : '3.8.4.1' },
      { name:'Biaxial interaction', util:r.biax.util, clause: ec ? '5.8.9(4)' : '3.8.4.5' }]);
  }

  /* ---------- N-M diagram ---------- */
  const NM = { x0:400, x1:935, y0:40, y1:550 };
  let nmScale = null;
  function drawNM(r, other) {
    const pts = r.ix.pts, opts = other.ix.pts;
    const Mmax = Math.max(...pts.map(p => p.M), ...opts.map(p => p.M), r.MEdx, state.Mx, 1) * 1.12;
    const Nhi = Math.max(r.ix.N0, other.ix.N0, state.NEd) * 1.08;
    const Nlo = Math.min(r.ix.Nt, other.ix.Nt) * 1.15;
    const cx = (NM.x0 + NM.x1) / 2;
    const half = (NM.x1 - NM.x0) / 2 - 10;
    const X = M => cx + M / Mmax * half;
    const Y = N => NM.y1 - (N - Nlo) / (Nhi - Nlo) * (NM.y1 - NM.y0);
    nmScale = { X, Y, Mmax, Nhi, Nlo, half, cx };

    add(txt(NM.x0, 26, `N-M interaction, ${r.code === 'ec2' ? 'EN 1992-1-1' : 'BS 8110'}, major axis`,
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    add(line(NM.x0, Y(0), NM.x1, Y(0), { stroke:C.axis }));
    add(line(cx, NM.y0, cx, NM.y1, { stroke:C.axis }));
    add(txt(NM.x1, Y(0) - 6, 'M kNm', { an:'end', fs:10.5 }));
    add(txt(cx + 6, NM.y0 + 4, 'N kN, compression up', { an:'start', fs:10.5 }));
    [-1, -0.5, 0.5, 1].forEach(f => {
      const m = Mmax / 1.12 * f;
      add(line(X(m), Y(0) - 3, X(m), Y(0) + 3, { stroke:C.axis }));
      add(txt(X(m), Y(0) + 15, fmt(m, 0), { fs:9.5 }));
    });

    const path = (P, sign) => P.map(p => `${X(sign * p.M)},${Y(p.N)}`).join(' ');
    const ring = P => path(P, 1) + ' ' + path(P.slice().reverse(), -1);
    add(s('polygon', { points:ring(opts), fill:'none', stroke:C.pale, 'stroke-width':1.6, 'stroke-dasharray':'5 4' }));
    add(s('polygon', { points:ring(pts), fill:C.green, 'fill-opacity':.09, stroke:C.green, 'stroke-width':2.2 }));

    const dot = (M, N, col, label, an) => {
      add(s('circle', { cx:X(M), cy:Y(N), r:4, fill:col }));
      add(txt(X(M) + (an === 'end' ? -8 : 8), Y(N) + 4, label, { an:an || 'start', fs:10.5, fill:col }));
    };
    dot(0, r.ix.N0, C.ocean, `N0 = ${fmt(r.ix.N0, 0)}`);
    dot(0, r.ix.Nt, C.ocean, `Nt = ${fmt(r.ix.Nt, 0)}`);
    dot(r.ix.bal.M, r.ix.bal.N, C.ocean, `balanced ${fmt(r.ix.bal.M, 0)} kNm, ${fmt(r.ix.bal.N, 0)} kN`, 'end');
    dot(r.ix.pureM, 0, C.ocean, `M0 = ${fmt(r.ix.pureM, 0)}`, 'end');

    if (r.capX) {
      add(line(cx, Y(r.NEd), X(r.MRdx), Y(r.NEd), { stroke:C.green, 'stroke-width':1.2, 'stroke-dasharray':'4 3' }));
      add(s('circle', { cx:X(r.MRdx), cy:Y(r.NEd), r:4.5, fill:'#fff', stroke:C.green, 'stroke-width':2 }));
      add(txt(X(r.MRdx) + 8, Y(r.NEd) + 18, `MRd = ${fmt(r.MRdx, 0)}`, { an:'start', fs:10.5, fill:C.green, fw:600 }));
    }
    /* first order point hollow, design point filled and draggable */
    add(s('circle', { cx:X(state.Mx), cy:Y(state.NEd), r:4, fill:'#fff', stroke:C.load, 'stroke-width':1.5 }));
    if (Math.abs(r.MEdx - state.Mx) > 0.5)
      add(line(X(state.Mx), Y(state.NEd), X(r.MEdx), Y(state.NEd), { stroke:C.load, 'stroke-width':1.2, 'marker-end':'url(#mLoad)' }));
    const g = add(s('g', { 'data-id':'dp' }));
    g.appendChild(s('circle', { cx:X(r.MEdx), cy:Y(state.NEd), r:16, fill:'transparent' }));
    g.appendChild(s('circle', { cx:X(r.MEdx), cy:Y(state.NEd), r:6.5, fill:C.load, stroke:'#fff', 'stroke-width':2 }));
    const flip = X(r.MEdx) > NM.x1 - 210;
    add(txt(X(r.MEdx) + (flip ? -10 : 10), Y(state.NEd) - 10, `design point ${fmt(r.MEdx, 0)} kNm, ${fmt(state.NEd, 0)} kN`,
      { an: flip ? 'end' : 'start', fs:11, fw:600, fill:C.load }));
    add(txt(NM.x1, NM.y1 + 22, `dashed: ${r.code === 'ec2' ? 'BS 8110' : 'EN 1992-1-1'} for the same section`,
      { an:'end', fs:10, fill:C.muted }));
  }

  /* ---------- slenderness ---------- */
  function drawSlender(r) {
    const sx = r.sx, ec = r.code === 'ec2';
    add(txt(400, 26, ec ? 'Slenderness, nominal curvature (5.8.8)' : 'Slenderness, additional moment (3.8.3)',
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    /* column elevation with its bow */
    const CX = 460, T = 80, B = 520, cw = 26;
    const bow = ec ? sx.e2 : sx.au;
    const bpx = clamp(bow * 1.1, 0, 60);
    add(s('rect', { x:CX - cw / 2, y:T, width:cw, height:B - T, fill:'none', stroke:C.contour, 'stroke-dasharray':'4 3' }));
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, yy = T + (B - T) * t;
      d += (i ? 'L' : 'M') + (CX + bpx * Math.sin(Math.PI * t)) + ',' + yy;
    }
    add(s('path', { d, fill:'none', stroke:C.ocean, 'stroke-width':cw - 6, 'stroke-opacity':.18 }));
    add(s('path', { d, fill:'none', stroke:C.ocean, 'stroke-width':2 }));
    add(line(CX, T - 30, CX, T - 4, { stroke:C.load, 'stroke-width':2.4, 'marker-end':'url(#mLoad)' }));
    add(txt(CX, T - 36, `NEd ${fmt(state.NEd, 0)} kN`, { fs:11, fill:C.load, fw:600 }));
    add(line(CX, B + 4, CX, B + 28, { stroke:C.green, 'stroke-width':2.4, 'marker-start':'url(#mGrn)' }));
    const mid = (T + B) / 2;
    add(line(CX, mid, CX + bpx, mid, { stroke:C.load, 'stroke-width':1.2 }));
    add(txt(CX + bpx + 6, mid + 4, `${ec ? 'e2' : 'au'} = ${fmt(bow, 1)} mm`, { an:'start', fs:11, fill:C.load }));
    add(txt(CX - 30, mid, `l0 = ${fmt(state.l0, 2)} m`, { fs:11, rot:-90 }));

    /* slenderness ratio against its limit */
    const PX = 560, PW = 360;
    const lam = ec ? sx.lam : sx.ratio, lim = ec ? sx.lamLim : 15;
    const top = Math.max(lam, lim) * 1.3;
    const LX = v => PX + v / top * PW;
    add(txt(PX, 80, ec ? 'λ = l0 / i against λlim = 20 A B C / √n' : 'le / h against 15 for a braced column',
      { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
    add(s('rect', { x:PX, y:92, width:PW, height:16, rx:4, fill:'#F2F4F0', stroke:C.hair }));
    add(s('rect', { x:PX, y:92, width:LX(lim) - PX, height:16, rx:4, fill:C.green, 'fill-opacity':.18 }));
    add(line(LX(lim), 86, LX(lim), 114, { stroke:C.green, 'stroke-width':2 }));
    add(txt(LX(lim), 128, `limit ${fmt(lim, 1)}`, { fs:10.5, fill:C.green }));
    add(s('circle', { cx:LX(lam), cy:100, r:6, fill: lam > lim ? C.load : C.ocean }));
    add(txt(LX(lam), 82, `${ec ? 'λ' : 'le/h'} = ${fmt(lam, 1)}`, { fs:11, fw:600, fill: lam > lim ? C.load : C.ocean }));
    add(txt(PX, 150, sx.slender ? 'Slender, so the second order moment is added.' : 'Short, so the column is checked on its first order moment.',
      { an:'start', fs:12, fill: sx.slender ? C.load : C.green, halo:0 }));

    /* moment build up as a stacked bar */
    const parts = ec
      ? [ ['M0e, end moments + NEd ei', sx.slender ? sx.M0e : sx.M02, C.ocean],
          ['M2 = NEd e2', sx.M2, C.load] ]
      : [ ['Mi, first order', Math.abs(state.Mx), C.ocean], ['Madd = N au', sx.Madd, C.load] ];
    const MED = ec ? sx.MEd : sx.Mt;
    const mtop = Math.max(MED, parts.reduce((a, p) => a + p[1], 0), 1) * 1.15;
    const MX = v => PX + v / mtop * PW;
    add(txt(PX, 196, 'How the design moment builds up', { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
    let acc = 0;
    parts.forEach((p, i) => {
      if (p[1] <= 1e-9) return;
      add(s('rect', { x:MX(acc), y:208, width:MX(acc + p[1]) - MX(acc), height:24, fill:p[2], 'fill-opacity':.28, stroke:p[2] }));
      add(txt(PX, 252 + i * 18, `${p[0]} = ${fmt(p[1], 1)} kNm`, { an:'start', fs:11, fill:p[2], halo:0 }));
      acc += p[1];
    });
    add(line(MX(MED), 200, MX(MED), 240, { stroke:C.ocean, 'stroke-width':2 }));
    add(txt(MX(MED), 196, `MEd = ${fmt(MED, 1)}`, { fs:11, fw:600, fill:C.ocean }));

    const rows = ec ? [
      `i = h/√12 = ${fmt(sx.i, 1)} mm, λ = ${fmt(sx.lam, 1)}`,
      `n = NEd/(Ac fcd) = ${fmt(sx.n, 3)}, ω = ${fmt(sx.om, 3)}`,
      `A = ${fmt(sx.A, 3)}, B = ${fmt(sx.B, 3)}, C = 1.7 − rm = ${fmt(sx.C, 2)}`,
      `ei = l0/400 = ${fmt(sx.ei, 1)} mm, e0 = ${fmt(sx.e0, 1)} mm`,
      sx.slender ? `Kr = ${fmt(sx.Kr, 3)}, Kφ = ${fmt(sx.Kphi, 3)}, 1/r = ${(sx.rinv * 1e6).toFixed(2)}×10⁻⁶ /mm` : 'no second order effect',
      sx.slender ? `e2 = (1/r) l0² / 10 = ${fmt(sx.e2, 1)} mm` : ''
    ] : [
      `le/h = ${fmt(sx.ratio, 1)}, βa = (le/b′)²/2000 = ${fmt(sx.betaA, 3)}`,
      `Nuz = ${fmt(sx.Nuz, 0)} kN, Nbal = ${fmt(sx.Nbal, 0)} kN`,
      `K = (Nuz − N)/(Nuz − Nbal) = ${fmt(sx.K, 3)}`,
      `au = βa K h = ${fmt(sx.au, 1)} mm`,
      `emin = ${fmt(sx.emin, 1)} mm`
    ];
    rows.filter(Boolean).forEach((t, i) => add(txt(PX, 320 + i * 20, t, { an:'start', fs:11.5, fill:'#41505A', halo:0 })));
  }

  /* ---------- biaxial ---------- */
  function drawBiax(r) {
    const ec = r.code === 'ec2';
    add(txt(400, 26, ec ? 'Biaxial bending, load contour (5.8.9)' : 'Biaxial bending, enhanced moment (3.8.4.5)',
      { an:'start', fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));
    const X0 = 460, Y0 = 520, S = 400;
    const mx = Math.max(r.MRdx, r.MEdx, 1) * 1.15, my = Math.max(r.MRdy, r.MEdy, 1) * 1.15;
    const top = Math.max(mx, my);
    const PX = v => X0 + v / top * S, PY = v => Y0 - v / top * S;
    add(line(X0, Y0, X0 + S + 20, Y0, { stroke:C.axis }));
    add(line(X0, Y0, X0, Y0 - S - 20, { stroke:C.axis }));
    add(txt(X0 + S + 20, Y0 + 34, 'MEd,x kNm', { an:'end', fs:10.5 }));
    add(txt(X0 - 10, Y0 - S - 24, 'MEd,y kNm', { an:'start', fs:10.5 }));
    let d = '';
    if (ec) {
      const a = r.biax.a;
      for (let i = 0; i <= 60; i++) {
        const t = i / 60 * Math.PI / 2;
        const u = Math.pow(Math.pow(Math.cos(t), a) + Math.pow(Math.sin(t), a), -1 / a);
        d += `${i ? 'L' : 'M'}${PX(r.MRdx * Math.cos(t) * u)},${PY(r.MRdy * Math.sin(t) * u)}`;
      }
    } else {
      const be = r.biax.beta, hp = r.layX.d, bp = r.layY.d;
      /* Mx + be(h'/b')My <= MRdx while Mx/h' >= My/b', and the mirror image */
      for (let i = 0; i <= 60; i++) {
        const t = i / 60 * Math.PI / 2, cx = Math.cos(t), cy = Math.sin(t);
        const k1 = r.MRdx / (cx + be * hp / bp * cy), k2 = r.MRdy / (cy + be * bp / hp * cx);
        const k = (cx / hp >= cy / bp) ? k1 : k2;
        d += `${i ? 'L' : 'M'}${PX(cx * k)},${PY(cy * k)}`;
      }
    }
    add(s('path', { d:d + `L${X0},${Y0}Z`, fill:C.green, 'fill-opacity':.09, stroke:C.green, 'stroke-width':2.2 }));
    add(txt(PX(r.MRdx), Y0 + 16, `MRd,x ${fmt(r.MRdx, 0)}`, { fs:10.5, fill:C.green }));
    add(txt(X0 - 6, PY(r.MRdy) + 4, `MRd,y ${fmt(r.MRdy, 0)}`, { an:'end', fs:10.5, fill:C.green }));
    const pass = r.biax.util <= 1;
    add(s('circle', { cx:PX(r.MEdx), cy:PY(r.MEdy), r:6.5, fill: pass ? C.green : C.load, stroke:'#fff', 'stroke-width':2 }));
    add(txt(PX(r.MEdx) + 10, PY(r.MEdy) - 8, `(${fmt(r.MEdx, 0)}, ${fmt(r.MEdy, 0)})`, { an:'start', fs:11, fw:600, fill: pass ? C.green : C.load }));
    const note = ec
      ? `(MEd,x/MRd,x)^a + (MEd,y/MRd,y)^a = ${fmt(r.biax.util, 3)}, a = ${fmt(r.biax.a, 2)} at NEd/NRd = ${fmt(r.biax.ratio, 2)}`
      : `M′ = M${r.biax.about} + β (h′/b′) M = ${fmt(r.biax.Menh, 1)} kNm, β = ${fmt(r.biax.beta, 2)}`;
    add(txt(400, 572, note, { an:'start', fs:11.5, fill:'#41505A', halo:0 }));
  }

  /* ---------- render ---------- */
  const chip = (k, v, sub, cls) =>
    `<div class="chip ${cls || ''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs', {}, marker('mLoad', C.load), marker('mGrn', C.green)));
    const r = solveFor(state.code);
    const other = solveFor(state.code === 'ec2' ? 'bs' : 'ec2');
    drawSection(r);
    drawLeftBottom(r);
    add(line(360, 20, 360, 580, { stroke:C.hair }));
    if (state.tab === 'nm') drawNM(r, other);
    else if (state.tab === 'slender') drawSlender(r);
    else drawBiax(r);

    const ec = r.code === 'ec2';
    const items = [{ name:'Axial', util:r.axialUtil }, { name:'Major axis', util:r.ux },
                   { name:'Minor axis', util:r.uy }, { name:'Biaxial', util:r.biax.util }];
    const v = DesignKit.verdict(items);
    const lam = ec ? r.sx.lam : r.sx.ratio, lim = ec ? r.sx.lamLim : 15;
    resultsEl.innerHTML =
      chip('Verdict', v[0], v[1], v[2]) +
      chip('N0', `${fmt(r.ix.N0, 0)} kN`, `NEd / N0 = ${fmt(r.axialUtil, 2)}`, r.axialUtil <= 1 ? 'ok' : 'warn') +
      chip('MEd,x', `${fmt(r.MEdx, 1)} kNm`, ec ? (r.sx.slender ? 'with M2, 5.8.8' : 'with NEd ei, 5.2') : 'BS 3.8.3') +
      chip('MRd,x', r.capX ? `${fmt(r.MRdx, 1)} kNm` : '–', `at NEd = ${fmt(state.NEd, 0)} kN`, r.ux <= 1 ? 'ok' : 'warn') +
      chip('MRd,y', r.capY ? `${fmt(r.MRdy, 1)} kNm` : '–', `MEd,y = ${fmt(r.MEdy, 1)} kNm`, r.uy <= 1 ? 'ok' : 'warn') +
      chip(ec ? 'λ / λlim' : 'le/h', ec ? `${fmt(lam, 1)} / ${fmt(lim, 1)}` : fmt(lam, 1),
           r.sx.slender ? 'slender' : 'short', r.sx.slender ? 'warn' : 'ok') +
      chip('Biaxial', fmt(r.biax.util, 3), ec ? `a = ${fmt(r.biax.a, 2)}` : `β = ${fmt(r.biax.beta, 2)}`,
           r.biax.util <= 1 ? 'ok' : 'warn') +
      chip('Balanced point', `${fmt(r.ix.bal.N, 0)} kN`, `M = ${fmt(r.ix.bal.M, 0)} kNm`) +
      chip('As', `${fmt(r.As, 0)} mm²`, `min ${fmt(r.AsMin, 0)}, max ${fmt(r.AsMax, 0)}`,
           r.As >= r.AsMin && r.As <= r.AsMax ? 'ok' : 'warn') +
      chip(ec ? 'BS 8110 MRd,x' : 'EC2 MRd,x', other.capX ? `${fmt(other.MRdx, 1)} kNm` : '–',
           `utilisation ${fmt(other.ux * 100, 0)}%`);

    const sx = r.sx;
    const steps = ec ? [
      { t:`fcd = αcc fck / γc = 0.85 × ${state.fck} / 1.5 = ${fmt(r.m.fc, 2)} MPa, fyd = ${state.fyk} / 1.15 = ${fmt(r.m.fyd, 1)} MPa`, c:'EN 1992-1-1 3.1.6, 3.2.7' },
      { t:`Stress block η fcd over λx with λ = 0.8, strain 0.0035 at the face, pivoting at 3h/7 once x > h`, c:'3.1.7(3), Fig 6.1' },
      { t:`N0 = ${fmt(r.ix.N0, 0)} kN, balanced at x = ${fmt(r.ix.bal.x, 0)} mm with N = ${fmt(r.ix.bal.N, 0)} kN, M = ${fmt(r.ix.bal.M, 1)} kNm`, c:'6.1' },
      { t:`λ = l0√12/h = ${fmt(sx.lam, 1)}, λlim = 20 × ${fmt(sx.A, 3)} × ${fmt(sx.B, 3)} × ${fmt(sx.C, 2)} / √${fmt(sx.n, 3)} = ${fmt(sx.lamLim, 1)}, so ${sx.slender ? 'slender' : 'short'}`, c:'5.8.3.1' },
      { t:`ei = l0/400 = ${fmt(sx.ei, 1)} mm, M02 = ${fmt(Math.abs(state.Mx), 1)} + ${fmt(state.NEd, 0)} × ${fmt(sx.ei / 1000, 4)} = ${fmt(sx.M02, 1)} kNm`, c:'5.2(7)' },
      sx.slender ? { t:`e2 = Kr Kφ (εyd / 0.45d) l0²/10 = ${fmt(sx.e2, 1)} mm, M2 = ${fmt(sx.M2, 1)} kNm, MEd = max(M0e + M2, M02, M01 + M2/2, NEd e0) = ${fmt(sx.MEd, 1)} kNm`, c:'5.8.8.2, 5.8.8.3' }
                 : { t:`MEd = max(M02, NEd e0) = ${fmt(sx.MEd, 1)} kNm`, c:'6.1(4)' },
      { t:`MRd,x at NEd = ${fmt(r.MRdx, 1)} kNm, utilisation ${fmt(r.ux * 100, 0)}%`, c:'6.1' },
      { t:`Biaxial: a = ${fmt(r.biax.a, 2)}, ${fmt(r.ux, 3)}^a + ${fmt(r.uy, 3)}^a = ${fmt(r.biax.util, 3)}`, c:'5.8.9(4)' }
    ] : [
      { t:`Block 0.45 fcu = ${fmt(r.m.fc, 2)} MPa over 0.9x, steel 0.87 fy = ${fmt(r.m.fyd, 1)} MPa, fcu = fck + 5 = ${r.m.fcu}`, c:'BS 8110-1 3.4.4.4' },
      { t:`Nuz = 0.45 fcu Ac + 0.87 fy Asc = ${fmt(sx.Nuz, 0)} kN`, c:'3.8.4.1' },
      { t:`le/h = ${fmt(sx.ratio, 1)} against 15, so ${sx.slender ? 'slender' : 'short'}`, c:'3.8.1.3' },
      { t:`au = βa K h = ${fmt(sx.betaA, 3)} × ${fmt(sx.K, 3)} × ${state.h} = ${fmt(sx.au, 1)} mm, Madd = ${fmt(sx.Madd, 1)} kNm`, c:'3.8.3.1' },
      { t:`Mt = max(Mi + Madd, N emin) = ${fmt(sx.Mt, 1)} kNm`, c:'3.8.2.4' },
      { t:`Mu at N = ${fmt(state.NEd, 0)} kN is ${fmt(r.MRdx, 1)} kNm, utilisation ${fmt(r.ux * 100, 0)}%`, c:'3.8.4.1' },
      { t:`Biaxial: M′ = ${fmt(r.biax.Menh, 1)} kNm with β = ${fmt(r.biax.beta, 2)}, utilisation ${fmt(r.biax.util * 100, 0)}%`, c:'3.8.4.5' }
    ];
    DesignKit.trail(trailEl, 'Show the working', steps);
  }

  /* ---------- controls ---------- */
  const slider = (k, label, min, max, step) =>
    `<div class="ctl"><label for="${k}r">${label}</label><div class="row">` +
    `<input type="range" id="${k}r" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}">` +
    `<input type="number" id="${k}n" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}"></div></div>`;

  function renderControls() {
    const opts = Object.keys(PRESETS).map(k =>
      `<option value="${k}"${state.preset === k ? ' selected' : ''}>${PRESETS[k].label}</option>`).join('') +
      `<option value="custom"${state.preset === 'custom' ? ' selected' : ''}>Custom</option>`;
    controls.innerHTML =
      `<div class="ctl"><label for="preset">Preset</label><select id="preset">${opts}</select></div>` +
      `<div class="ctl"><label for="code">Code</label><select id="code">` +
      `<option value="ec2"${state.code === 'ec2' ? ' selected' : ''}>EN 1992-1-1 with UK NA</option>` +
      `<option value="bs"${state.code === 'bs' ? ' selected' : ''}>BS 8110-1</option></select></div>` +
      `<div class="addrow">${Object.keys(TABS).map(t =>
        `<button class="btn small${state.tab === t ? '' : ' ghost'}" data-tab="${t}">${TABS[t]}</button>`).join('')}</div>` +
      '<h3 style="margin-top:16px">Section</h3>' +
      slider('b', 'Width b (mm)', 200, 600, 25) + slider('h', 'Depth h (mm)', 200, 800, 25) +
      slider('phi', 'Bar diameter (mm)', 12, 40, 2) +
      slider('nx', 'Bars on each b face', 2, 6, 1) + slider('ny', 'Bars on each h face', 2, 6, 1) +
      slider('cover', 'Nominal cover (mm)', 20, 60, 5) +
      '<h3>Materials</h3>' +
      slider('fck', 'fck (MPa)', 20, 50, 5) + slider('fyk', 'fyk (MPa)', 400, 600, 50) +
      '<h3>Actions, design values</h3>' +
      slider('NEd', 'NEd (kN)', 0, 6000, 10) + slider('Mx', 'Mx, major axis (kNm)', 0, 600, 1) +
      slider('My', 'My, minor axis (kNm)', 0, 400, 1) +
      '<h3>Slenderness</h3>' +
      slider('l0', 'Effective length l0 (m)', 1, 10, 0.1) +
      slider('rm', 'Moment ratio rm = M01/M02', -1, 1, 0.1) +
      slider('phiEf', 'Effective creep ratio φef', 0, 3, 0.1);
  }

  function syncInput(k) {
    ['r', 'n'].forEach(suf => {
      const el = document.getElementById(k + suf);
      if (el && el !== document.activeElement) el.value = state[k];
    });
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
  });
  controls.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    controls.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('ghost', x.dataset.tab !== state.tab));
    render();
  });

  /* drag the design point across the N-M diagram */
  let drag = false;
  const toSvg = e => { const r = fig.getBoundingClientRect();
    return [(e.clientX - r.left) * VW / r.width, (e.clientY - r.top) * VH / r.height]; };
  fig.addEventListener('pointerdown', e => {
    if (state.tab !== 'nm' || !e.target.closest('[data-id="dp"]')) return;
    drag = true; fig.setPointerCapture(e.pointerId); e.preventDefault();
  });
  fig.addEventListener('pointermove', e => {
    if (!drag || !nmScale) return;
    const [px, py] = toSvg(e), sc = nmScale;
    const M = (px - sc.cx) / sc.half * sc.Mmax;
    const N = sc.Nlo + (NM.y1 - py) / (NM.y1 - NM.y0) * (sc.Nhi - sc.Nlo);
    /* the drag moves the design point, so back out the first order moment */
    const r = solveFor(state.code);
    state.Mx = clamp(snap(state.Mx + (M - r.MEdx), 1), 0, 600);
    state.NEd = clamp(snap(N, 10), 0, 6000);
    syncInput('Mx'); syncInput('NEd'); markCustom(); render();
  });
  const end = () => { drag = false; };
  fig.addEventListener('pointerup', end);
  fig.addEventListener('pointercancel', end);

  renderControls();
  render();
})();
