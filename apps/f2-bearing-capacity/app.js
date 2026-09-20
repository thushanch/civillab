/* CivilLab · F2 Shallow Foundation Bearing Capacity */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const cap = document.getElementById('cap');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  /* ---------- presets ---------- */
  const PRESETS = {
    clay: { label:'Strip on φ = 0 clay', f:()=>({
      method:'general', shape:'strip', B:1.5, L:1.5, D:1,
      gamma:18, gammaSat:20, c:75, phi:0, zw:99, eB:0, eL:0,
      FoS:3, qApp:80 }) },
    sand: { label:'Square on sand', f:()=>({
      method:'general', shape:'square', B:2, L:2, D:1,
      gamma:18, gammaSat:20, c:0, phi:30, zw:99, eB:0, eL:0,
      FoS:3, qApp:200 }) },
    rect: { label:'Rectangle on c–φ soil', f:()=>({
      method:'general', shape:'rect', B:2, L:4, D:1.5,
      gamma:18, gammaSat:20, c:15, phi:25, zw:99, eB:0, eL:0,
      FoS:3, qApp:150 }) },
    wet: { label:'Water at the base', f:()=>({
      method:'general', shape:'square', B:2, L:2, D:1.5,
      gamma:18, gammaSat:20, c:0, phi:30, zw:1.5, eB:0, eL:0,
      FoS:3, qApp:150 }) },
    terz: { label:'Terzaghi, φ = 0 clay', f:()=>({
      method:'terzaghi', shape:'strip', B:1.5, L:1.5, D:1,
      gamma:18, gammaSat:20, c:75, phi:0, zw:99, eB:0, eL:0,
      FoS:3, qApp:80 }) },
    ecc: { label:'Eccentric loading', f:()=>({
      method:'general', shape:'strip', B:3, L:3, D:1,
      gamma:18, gammaSat:20, c:0, phi:30, zw:99, eB:0.4, eL:0,
      FoS:3, qApp:200 }) }
  };

  const state = Object.assign({ preset:'clay' }, PRESETS.clay.f());

  const solveNow = () => BearingEngine.solve({
    method:state.method, shape:state.shape, B:state.B, L:state.L,
    D:state.D, gamma:state.gamma, gammaSat:state.gammaSat,
    c:state.c, phi:state.phi,
    zw: state.zw >= state.D + state.B + 1 ? undefined : state.zw,
    eB:state.eB, eL:state.eL, FoS:state.FoS, qApp:state.qApp });

  /* ---------- svg helpers ---------- */
  function txt(x, y, str, o) {
    o = o || {};
    var a = { x:x, y:y, 'font-size': o.fs || 12, fill: o.fill || C.muted,
      'text-anchor': o.an || 'middle', 'font-weight': o.fw || 400 };
    if (o.halo !== 0) { a['paint-order'] = 'stroke'; a.stroke = '#fff';
      a['stroke-width'] = o.halo || 3; a['stroke-linejoin'] = 'round'; }
    if (o.head) a['font-family'] = 'Poppins, Inter, sans-serif';
    if (o.rot) a.transform = 'rotate(' + o.rot + ' ' + x + ' ' + y + ')';
    return s('text', a, str);
  }
  var line = function(x1, y1, x2, y2, a) {
    return s('line', Object.assign({ x1:x1, y1:y1, x2:x2, y2:y2 }, a || {}));
  };
  function marker(id, color, w) {
    w = w || 6.5;
    return s('marker', { id:id, viewBox:'0 0 10 10', refX:8.5, refY:5,
      markerWidth:w, markerHeight:w, orient:'auto-start-reverse' },
      s('path', { d:'M0,0 L10,5 L0,10 z', fill:color }));
  }
  var clearSvg = function(el) { while (el.firstChild) el.removeChild(el.firstChild); };

  /* =====================================================================
     Figure 1 · Footing section and Prandtl failure mechanism
     ===================================================================== */
  function drawFig(r) {
    clearSvg(fig);
    fig.appendChild(s('defs', {},
      marker('fLoad', C.load), marker('fGrn', C.green, 5.5),
      s('pattern', { id:'fHatch', width:7, height:7, patternUnits:'userSpaceOnUse',
        patternTransform:'rotate(45)' },
        s('line', { x1:0, y1:0, x2:0, y2:7, stroke:C.contour, 'stroke-width':1.3 })),
      s('pattern', { id:'fSoil', width:8, height:8, patternUnits:'userSpaceOnUse',
        patternTransform:'rotate(-30)' },
        s('line', { x1:0, y1:0, x2:0, y2:8, stroke:C.contour, 'stroke-width':0.6, 'stroke-opacity':0.4 }))));

    fig.appendChild(txt(20, 22, 'Foundation section',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    var w = r.wedge;
    var maxZ = Math.max(w.d, 0);
    for (var i = 0; i < w.spiral.length; i++)
      if (w.spiral[i].z > maxZ) maxZ = w.spiral[i].z;

    var xExt = Math.max(r.B / 2 + 0.5, w.surfaceX + 0.3);
    var zExt = r.D + maxZ + 0.5;

    var AX0 = 30, AX1 = 450, AY0 = 52, AY1 = 480;
    var AW = AX1 - AX0, AH = AY1 - AY0;

    var sc = Math.min(AW / (2 * xExt), AH / zExt);
    sc = Math.max(sc, 50 / Math.max(r.B, 0.5));

    var cx = (AX0 + AX1) / 2;
    var gy = AY0 + 20;
    var SX = function(x) { return cx + x * sc; };
    var SZ = function(z) { return gy + z * sc; };

    var footL = SX(-r.B / 2), footR = SX(r.B / 2);
    var footW = footR - footL;
    var baseZ = SZ(r.D);

    /* ground surface */
    fig.appendChild(s('rect', { x:AX0, y:gy, width:AW, height:Math.max(0, baseZ - gy),
      fill:C.pale, 'fill-opacity':0.15, stroke:'none' }));
    fig.appendChild(line(AX0, gy, AX1, gy, { stroke:C.ocean, 'stroke-width':2 }));
    fig.appendChild(s('rect', { x:AX0, y:gy, width:AW, height:6,
      fill:'url(#fHatch)' }));

    /* soil around the footing (embedment) */
    if (r.D > 0.02) {
      fig.appendChild(s('rect', { x:AX0, y:gy, width:Math.max(0, footL - AX0), height:baseZ - gy,
        fill:C.pale, 'fill-opacity':0.25, stroke:'none' }));
      fig.appendChild(s('rect', { x:footR, y:gy, width:Math.max(0, AX1 - footR), height:baseZ - gy,
        fill:C.pale, 'fill-opacity':0.25, stroke:'none' }));
    }

    /* the footing */
    var footH = Math.max(8, Math.min(r.D * 0.3, 0.5) * sc);
    fig.appendChild(s('rect', { x:footL, y:baseZ - footH, width:footW, height:footH,
      fill:'#fff', stroke:C.ocean, 'stroke-width':2.4, rx:2 }));

    /* applied pressure arrows */
    var nArr = Math.max(2, Math.min(6, Math.floor(footW / 40)));
    var arrSp = footW / (nArr + 1);
    for (var ai = 1; ai <= nArr; ai++) {
      var ax = footL + ai * arrSp;
      fig.appendChild(line(ax, baseZ - footH - 36, ax, baseZ - footH - 6,
        { stroke:C.load, 'stroke-width':2, 'marker-end':'url(#fLoad)' }));
    }
    if (r.qApp > 0.5) {
      fig.appendChild(txt(cx, baseZ - footH - 42,
        'q = ' + fmt(r.qApp, 0) + ' kPa',
        { fs:11, fw:600, fill:C.load, halo:0 }));
    }

    /* failure mechanism below the footing */
    if (r.phi > 0.01 || true) {
      var spiralPts = w.spiral;

      /* active zone triangle: footing base corners to apex at (0, d) */
      fig.appendChild(s('polygon', {
        points: SX(-r.B / 2) + ',' + baseZ + ' ' +
                SX(r.B / 2) + ',' + baseZ + ' ' +
                SX(0) + ',' + SZ(r.D + w.d),
        fill:C.load, 'fill-opacity':0.12, stroke:C.load,
        'stroke-width':1.6, 'stroke-dasharray':'5 3' }));

      /* log-spiral, right side */
      var spiralR = '';
      for (var si = 0; si < spiralPts.length; si++) {
        var sp = spiralPts[si];
        spiralR += (si === 0 ? 'M' : 'L') + SX(sp.x) + ',' + SZ(r.D + sp.z);
      }
      fig.appendChild(s('path', { d:spiralR, fill:'none',
        stroke:C.ocean, 'stroke-width':1.8 }));

      /* passive zone, right: from spiral end to surface at surfaceX */
      var lastPt = spiralPts[spiralPts.length - 1];
      fig.appendChild(line(SX(lastPt.x), SZ(r.D + lastPt.z),
        SX(w.surfaceX), baseZ,
        { stroke:C.green, 'stroke-width':1.6, 'stroke-dasharray':'5 3' }));

      /* filled passive zone triangle */
      fig.appendChild(s('polygon', {
        points: SX(r.B / 2) + ',' + baseZ + ' ' +
                SX(lastPt.x) + ',' + SZ(r.D + lastPt.z) + ' ' +
                SX(w.surfaceX) + ',' + baseZ,
        fill:C.green, 'fill-opacity':0.08, stroke:'none' }));

      /* mirror the left side */
      var spiralL = '';
      for (var si2 = 0; si2 < spiralPts.length; si2++) {
        var sp2 = spiralPts[si2];
        spiralL += (si2 === 0 ? 'M' : 'L') + SX(-sp2.x) + ',' + SZ(r.D + sp2.z);
      }
      fig.appendChild(s('path', { d:spiralL, fill:'none',
        stroke:C.ocean, 'stroke-width':1.8 }));

      fig.appendChild(line(SX(-lastPt.x), SZ(r.D + lastPt.z),
        SX(-w.surfaceX), baseZ,
        { stroke:C.green, 'stroke-width':1.6, 'stroke-dasharray':'5 3' }));

      fig.appendChild(s('polygon', {
        points: SX(-r.B / 2) + ',' + baseZ + ' ' +
                SX(-lastPt.x) + ',' + SZ(r.D + lastPt.z) + ' ' +
                SX(-w.surfaceX) + ',' + baseZ,
        fill:C.green, 'fill-opacity':0.08, stroke:'none' }));

      /* labels on the zones */
      var triCx = SX(0), triCy = SZ(r.D + w.d * 0.55);
      if (triCy < AY1 - 20 && footW > 50)
        fig.appendChild(txt(triCx, triCy, 'active',
          { fs:10, fill:C.load, halo:2.5 }));

      var passCx = SX((lastPt.x + w.surfaceX) / 2);
      var passCy = SZ(r.D + lastPt.z * 0.4);
      if (passCx < AX1 - 20 && passCy < AY1 - 20)
        fig.appendChild(txt(passCx, passCy, 'passive',
          { fs:10, fill:C.green, halo:2.5 }));
    }

    /* water table */
    if (state.zw < state.D + state.B + 0.5) {
      var wz = SZ(Math.min(state.zw, r.D + maxZ));
      if (wz > gy && wz < AY1 - 10) {
        fig.appendChild(line(AX0 + 10, wz, AX1 - 10, wz,
          { stroke:C.water, 'stroke-width':2, 'stroke-dasharray':'6 4' }));
        fig.appendChild(txt(AX1 - 14, wz - 6, 'WT',
          { an:'end', fs:10, fw:600, fill:C.water, halo:2.5 }));
      }
    }

    /* dimensions */
    var dimY = gy - 6;
    fig.appendChild(line(footL, dimY - 12, footL, dimY + 6,
      { stroke:C.muted, 'stroke-width':1 }));
    fig.appendChild(line(footR, dimY - 12, footR, dimY + 6,
      { stroke:C.muted, 'stroke-width':1 }));
    fig.appendChild(line(footL, dimY - 6, footR, dimY - 6,
      { stroke:C.muted, 'stroke-width':1.2 }));
    fig.appendChild(txt(cx, dimY - 12, 'B = ' + fmt(r.B, 2) + ' m',
      { fs:11, fw:600, fill:C.ocean, halo:0 }));

    if (r.D > 0.02) {
      var dMidY = (gy + baseZ) / 2;
      fig.appendChild(line(footL - 10, gy, footL - 10, baseZ,
        { stroke:C.muted, 'stroke-width':1 }));
      fig.appendChild(txt(footL - 14, dMidY + 4,
        'D = ' + fmt(r.D, 1) + ' m',
        { an:'end', fs:10.5, fw:600, fill:C.ocean }));
    }

    /* effective width B' if eccentricity */
    if (r.eB > 0.01) {
      var bpL = SX(-r.Bp / 2), bpR = SX(r.Bp / 2);
      var eccY = baseZ + 14;
      fig.appendChild(line(bpL, eccY, bpR, eccY,
        { stroke:C.midblue, 'stroke-width':2, 'stroke-dasharray':'4 3' }));
      fig.appendChild(line(bpL, eccY - 4, bpL, eccY + 4,
        { stroke:C.midblue, 'stroke-width':1.5 }));
      fig.appendChild(line(bpR, eccY - 4, bpR, eccY + 4,
        { stroke:C.midblue, 'stroke-width':1.5 }));
      fig.appendChild(txt(cx, eccY + 14,
        "B' = " + fmt(r.Bp, 2) + ' m (e = ' + fmt(r.eB, 2) + ')',
        { fs:10.5, fw:600, fill:C.midblue, halo:2.5 }));

      /* mark the eccentric load point */
      var loadX = SX(r.eB);
      fig.appendChild(line(loadX, baseZ - footH - 4, loadX, baseZ + 2,
        { stroke:C.load, 'stroke-width':1.4, 'stroke-dasharray':'3 2' }));
    }

    /* angle labels */
    if (r.phi > 0.5) {
      fig.appendChild(txt(SX(r.B * 0.35), baseZ + 16,
        'α = ' + fmt(w.alpha, 0) + '°',
        { fs:9.5, fill:C.load, halo:2.5 }));
    }

    /* summary at the bottom */
    fig.appendChild(txt(cx, AY1 + 14,
      r.method === 'terzaghi' ? 'Terzaghi' : 'General (Hansen/Vesic)',
      { fs:12, fw:600, fill:C.ocean, halo:0 }));
    fig.appendChild(txt(cx, AY1 + 32,
      (r.shape === 'strip' ? 'Strip' :
       r.shape === 'square' ? 'Square' :
       r.shape === 'circle' ? 'Circle' : 'Rect ' + fmt(r.B, 1) + '×' + fmt(r.L, 1)) +
      ', B = ' + fmt(r.B, 2) + ' m, D = ' + fmt(r.D, 1) + ' m',
      { fs:11, fill:C.muted, halo:0 }));
  }

  /* =====================================================================
     Figure 2 · Bearing capacity breakdown, utilisation, stress decay
     ===================================================================== */
  function drawCap(r) {
    clearSvg(cap);
    cap.appendChild(s('defs', {}, marker('cLoad', C.load), marker('cGrn', C.green, 5.5)));

    cap.appendChild(txt(20, 22, 'Bearing capacity breakdown',
      { an:'start', fs:13, fw:600, fill:C.ocean, halo:0, head:true }));

    /* ---- equation text ---- */
    cap.appendChild(txt(270, 50,
      'qu = c·Nc·sc·dc + q·Nq·sq·dq + ½γB′·Nγ·sγ·dγ',
      { fs:11.5, fw:600, fill:C.ocean, halo:0 }));

    /* ---- three term rows ---- */
    var BX = 28, BW = 380, BH = 20;
    var quTotal = Math.max(r.qu, 1e-6);
    var maxTerm = Math.max(r.term1, r.term2, r.term3, 1);
    var barScale = BW / quTotal;

    var termData = [
      { name:'Cohesion', value:r.term1, color:C.ocean,
        chain: 'c=' + fmt(r.c, 0) + ' · Nc=' + fmt(r.N.Nc, 2) +
               ' · sc=' + fmt(r.sf.sc, 3) +
               ' · dc=' + fmt(r.df.dc, 3) },
      { name:'Surcharge', value:r.term2, color:C.green,
        chain: 'q=' + fmt(r.q, 1) + ' · Nq=' + fmt(r.N.Nq, 2) +
               ' · sq=' + fmt(r.sf.sq, 3) +
               ' · dq=' + fmt(r.df.dq, 3) },
      { name:'Self-weight', value:r.term3, color:C.midblue,
        chain: '½γB′=' + fmt(0.5 * r.gammaEff * r.Bp, 1) +
               ' · Nγ=' + fmt(r.N.Ng, 2) +
               ' · sγ=' + fmt(r.sf.sg, 3) +
               ' · dγ=' + fmt(r.df.dg, 3) }
    ];

    for (var ti = 0; ti < 3; ti++) {
      var td = termData[ti];
      var ty = 76 + ti * 52;

      cap.appendChild(txt(BX, ty, td.name,
        { an:'start', fs:11.5, fw:600, fill:td.color, halo:0 }));
      cap.appendChild(txt(BX + BW + 10, ty, fmt(td.value, 1) + ' kPa',
        { an:'start', fs:11.5, fw:600, fill:td.color, halo:0 }));

      /* term bar */
      var bw = Math.max(0, td.value * barScale);
      cap.appendChild(s('rect', { x:BX, y:ty + 6, width:BW, height:BH, rx:4,
        fill:'#fff', stroke:C.hair, 'stroke-width':1 }));
      if (bw > 1)
        cap.appendChild(s('rect', { x:BX, y:ty + 6, width:Math.min(bw, BW), height:BH, rx:4,
          fill:td.color, 'fill-opacity':0.25, stroke:td.color, 'stroke-width':1.4 }));

      /* factor chain */
      cap.appendChild(txt(BX + 4, ty + BH + 20, td.chain,
        { an:'start', fs:9.5, fill:C.muted, halo:2.5 }));
    }

    /* ---- stacked total bar ---- */
    var totalY = 240;
    cap.appendChild(txt(BX, totalY, 'Total qu',
      { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));
    cap.appendChild(txt(BX + BW + 10, totalY, fmt(r.qu, 0) + ' kPa',
      { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));

    cap.appendChild(s('rect', { x:BX, y:totalY + 8, width:BW, height:BH + 4, rx:4,
      fill:'#fff', stroke:C.hair, 'stroke-width':1 }));

    var stackX = BX;
    for (var si = 0; si < 3; si++) {
      var sw = Math.max(0, termData[si].value * barScale);
      if (sw > 0.5) {
        cap.appendChild(s('rect', {
          x:stackX, y:totalY + 8, width:Math.min(sw, BW - (stackX - BX)), height:BH + 4,
          rx: si === 0 ? 4 : 0,
          fill:termData[si].color, 'fill-opacity':0.30,
          stroke:termData[si].color, 'stroke-width':1 }));
        stackX += sw;
      }
    }

    /* ---- qa and utilisation ---- */
    var qaY = 290;
    cap.appendChild(txt(BX, qaY,
      'qa = qu / FoS = ' + fmt(r.qu, 0) + ' / ' + fmt(r.FoS, 1) + ' = ' + fmt(r.qa, 0) + ' kPa',
      { an:'start', fs:11.5, fw:600, fill:C.ocean, halo:0 }));

    var utilY = 316;
    cap.appendChild(txt(BX, utilY, 'Applied vs allowable',
      { an:'start', fs:12, fw:600, fill:C.ocean, halo:0 }));

    var utilBarY = utilY + 10;
    var utilMax = Math.max(r.qu, r.qApp, 1) * 1.15;
    var utilScale = BW / utilMax;

    cap.appendChild(s('rect', { x:BX, y:utilBarY, width:BW, height:BH + 6, rx:5,
      fill:'#fff', stroke:C.hair, 'stroke-width':1 }));

    /* qu fill */
    var quW = clamp(r.qu * utilScale, 0, BW);
    cap.appendChild(s('rect', { x:BX, y:utilBarY, width:quW, height:BH + 6, rx:5,
      fill:C.pale, 'fill-opacity':0.5, stroke:'none' }));

    /* qa tick */
    var qaX = BX + clamp(r.qa * utilScale, 0, BW);
    cap.appendChild(line(qaX, utilBarY - 5, qaX, utilBarY + BH + 11,
      { stroke:C.ocean, 'stroke-width':2 }));
    cap.appendChild(txt(qaX, utilBarY + BH + 24, 'qa = ' + fmt(r.qa, 0),
      { fs:10, fill:C.ocean, halo:2.5 }));

    /* qApp bar */
    var safe = r.safe;
    var qAppW = clamp(r.qApp * utilScale, 0, BW);
    if (qAppW > 1)
      cap.appendChild(s('rect', { x:BX, y:utilBarY, width:qAppW, height:BH + 6, rx:5,
        fill: safe ? C.green : C.load, 'fill-opacity':0.30,
        stroke: safe ? C.green : C.load, 'stroke-width':1.6 }));

    /* qu tick */
    var quX = BX + clamp(r.qu * utilScale, 0, BW);
    cap.appendChild(line(quX, utilBarY, quX, utilBarY + BH + 6,
      { stroke:C.load, 'stroke-width':1.2, 'stroke-dasharray':'3 3' }));

    cap.appendChild(txt(BX + BW + 16, utilBarY + (BH + 6) / 2 + 4,
      safe ? 'Safe' : 'FAIL',
      { an:'start', fs:13, fw:600, fill: safe ? C.green : C.load, halo:0, head:true }));

    if (r.qApp > 0.5) {
      cap.appendChild(txt(BX + qAppW / 2, utilBarY + (BH + 6) / 2 + 4,
        'qApp = ' + fmt(r.qApp, 0),
        { fs:10, fw:600, fill: safe ? C.green : C.load, halo:2.5 }));
    }

    /* ---- Boussinesq stress decay profile ---- */
    var profX0 = 60, profX1 = 380, profY0 = 380, profY1 = 505;
    var profW = profX1 - profX0, profH = profY1 - profY0;

    cap.appendChild(txt(BX, profY0 - 12, 'Stress decay below the footing (Boussinesq, strip)',
      { an:'start', fs:11, fw:600, fill:C.ocean, halo:0 }));

    /* axes */
    cap.appendChild(line(profX0, profY0, profX0, profY1,
      { stroke:C.axis, 'stroke-width':1.2 }));
    cap.appendChild(line(profX0, profY0, profX1, profY0,
      { stroke:C.axis, 'stroke-width':1.2 }));

    /* depth axis: 0 to 4B */
    var maxDepth = 4 * r.B;
    var dzScale = profH / maxDepth;
    for (var dz = 0; dz <= 4; dz++) {
      var yy = profY0 + dz * r.B * dzScale;
      if (yy > profY1 + 1) break;
      cap.appendChild(line(profX0 - 3, yy, profX0, yy,
        { stroke:C.axis, 'stroke-width':1 }));
      cap.appendChild(txt(profX0 - 8, yy + 4, dz + 'B',
        { an:'end', fs:9, fill:C.muted, halo:2 }));
    }

    /* horizontal axis: sigma_z/q from 0 to 1 */
    for (var sv = 0; sv <= 1; sv += 0.25) {
      var xx = profX0 + sv * profW;
      cap.appendChild(line(xx, profY0, xx, profY0 + 3,
        { stroke:C.axis, 'stroke-width':1 }));
      if (sv === 0 || sv === 0.5 || sv === 1)
        cap.appendChild(txt(xx, profY0 - 4, fmt(sv, sv === 0.5 ? 1 : 0),
          { fs:9, fill:C.muted, halo:2 }));
    }
    cap.appendChild(txt((profX0 + profX1) / 2, profY0 - 16, 'σz / q',
      { fs:10, fw:600, fill:C.ocean, halo:0 }));
    cap.appendChild(txt(profX0 - 20, (profY0 + profY1) / 2, 'depth',
      { fs:10, fill:C.muted, rot:-90, halo:0 }));

    /* stress decay curve */
    var pts = 'M' + profX0 + ',' + profY0;
    var nSteps = 50;
    for (var zi = 1; zi <= nSteps; zi++) {
      var zVal = zi / nSteps * maxDepth;
      var sigRatio = BearingEngine.boussinesqStrip(r.B, zVal);
      var px = profX0 + clamp(sigRatio, 0, 1) * profW;
      var py = profY0 + zVal * dzScale;
      if (py > profY1) break;
      pts += ' L' + px + ',' + py;
    }
    cap.appendChild(s('path', { d:pts, fill:'none',
      stroke:C.ocean, 'stroke-width':2.2 }));

    /* fill under the curve */
    var fillPts = pts;
    var lastPy = Math.min(profY0 + maxDepth * dzScale, profY1);
    fillPts += ' L' + profX0 + ',' + lastPy;
    cap.appendChild(s('path', { d:fillPts + ' Z', fill:C.ocean,
      'fill-opacity':0.10, stroke:'none' }));

    /* mark the 0.1q contour depth (the "pressure bulb" boundary) */
    var z01 = 0;
    for (var zt = 0.1; zt < maxDepth; zt += 0.05) {
      if (BearingEngine.boussinesqStrip(r.B, zt) < 0.1) { z01 = zt; break; }
    }
    if (z01 > 0.01) {
      var y01 = profY0 + z01 * dzScale;
      var x01 = profX0 + 0.1 * profW;
      if (y01 < profY1 - 10) {
        cap.appendChild(s('circle', { cx:x01, cy:y01, r:3.5,
          fill:C.ocean, stroke:'#fff', 'stroke-width':1.5 }));
        cap.appendChild(txt(x01 + 8, y01 + 4,
          '0.1q at ' + fmt(z01, 1) + ' m (' + fmt(z01 / r.B, 1) + 'B)',
          { an:'start', fs:9.5, fill:C.ocean, halo:2.5 }));
      }
    }
  }

  /* ---------- results chips ---------- */
  var chip = function(k, v, sub, cls) {
    return '<div class="chip ' + (cls || '') + '"><div class="k">' + k + '</div>' +
      '<div class="v">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  };

  function drawChips(r) {
    var safe = r.safe;
    var aFoS = isFinite(r.actualFoS) ? fmt(r.actualFoS, 2) : '∞';
    resultsEl.innerHTML =
      chip('Nc', fmt(r.N.Nc, 2), r.method === 'terzaghi' ? 'Terzaghi' : 'Prandtl') +
      chip('Nq', fmt(r.N.Nq, 2), r.phi > 0.01 ? 'tan²(45+φ/2)e^(πtanφ)' : 'Nq = 1 at φ = 0') +
      chip('Nγ', fmt(r.N.Ng, 2), r.method === 'terzaghi' ? 'Kumbhojkar' : '2(Nq+1)tanφ') +
      chip('qu', fmt(r.qu, 0) + ' kPa',
        fmt(r.term1, 0) + ' + ' + fmt(r.term2, 0) + ' + ' + fmt(r.term3, 0)) +
      chip('qa', fmt(r.qa, 0) + ' kPa', 'FoS = ' + fmt(r.FoS, 1), 'ok') +
      (r.eB > 0.01 ?
        chip("B'", fmt(r.Bp, 2) + ' m', 'B − 2e = ' + fmt(r.B, 2) + ' − ' + fmt(2 * r.eB, 2)) : '') +
      (r.waterCase < 3 ?
        chip('Water', 'case ' + r.waterCase,
          r.waterCase === 1 ? 'above the base' : 'within B below', 'warn') : '') +
      chip('qApp', fmt(r.qApp, 0) + ' kPa', 'applied pressure',
        safe ? '' : 'warn') +
      chip('Actual FoS', aFoS, 'qu / qApp',
        (r.actualFoS >= r.FoS - 0.01) ? 'ok' : 'warn') +
      chip('Verdict', safe ? 'Safe' : 'Exceeds qa',
        safe ? 'qApp ≤ qa' : 'qApp > qa',
        safe ? 'ok' : 'warn');
  }

  function renderAll() {
    var r = solveNow();
    drawFig(r);
    drawCap(r);
    drawChips(r);
  }

  /* ---------- controls ---------- */
  function renderControls() {
    var opts = '';
    var keys = Object.keys(PRESETS);
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      opts += '<option value="' + k + '"' +
        (k === state.preset ? ' selected' : '') + '>' + PRESETS[k].label + '</option>';
    }

    var row = function(id, lab, min, max, st, val) {
      return '<div class="ctl"><label for="' + id + 'n">' + lab + '</label><div class="row">' +
        '<input type="range" id="' + id + 'r" data-k="' + id + '" min="' + min + '" max="' + max +
        '" step="' + st + '" value="' + val + '">' +
        '<input type="number" id="' + id + 'n" data-k="' + id + '" min="' + min + '" max="' + max +
        '" step="' + st + '" value="' + val + '"></div></div>';
    };

    var showL = state.shape === 'rect';
    var showEL = state.shape === 'rect' && state.eB > 0.01;

    controls.innerHTML =
      '<h3>Case</h3>' +
      '<div class="ctl"><select id="preset"><option value="">Custom</option>' + opts + '</select></div>' +
      '<div class="grid2">' +
        '<div class="ctl"><label>Method</label><select id="method">' +
          '<option value="general"' + (state.method === 'general' ? ' selected' : '') + '>General (Hansen)</option>' +
          '<option value="terzaghi"' + (state.method === 'terzaghi' ? ' selected' : '') + '>Terzaghi</option>' +
        '</select></div>' +
        '<div class="ctl"><label>Shape</label><select id="shape">' +
          '<option value="strip"' + (state.shape === 'strip' ? ' selected' : '') + '>Strip</option>' +
          '<option value="square"' + (state.shape === 'square' ? ' selected' : '') + '>Square</option>' +
          '<option value="circle"' + (state.shape === 'circle' ? ' selected' : '') + '>Circle</option>' +
          '<option value="rect"' + (state.shape === 'rect' ? ' selected' : '') + '>Rectangle</option>' +
        '</select></div>' +
      '</div>' +
      '<h3>Geometry</h3>' +
      row('B', 'Width B (m)', 0.3, 6, 0.1, state.B) +
      (showL ? row('L', 'Length L (m)', 0.5, 12, 0.1, state.L) : '') +
      row('D', 'Depth D (m)', 0, 5, 0.1, state.D) +
      '<h3>Soil</h3>' +
      row('phi', "Friction φ' (°)", 0, 45, 1, state.phi) +
      row('c', "Cohesion c' (kPa)", 0, 200, 1, state.c) +
      row('gamma', 'Unit weight γ (kN/m³)', 14, 22, 0.5, state.gamma) +
      row('gammaSat', 'Saturated γsat (kN/m³)', 16, 24, 0.5, state.gammaSat) +
      row('zw', 'Water table depth (m)', 0, 10, 0.1, state.zw) +
      '<h3>Loading</h3>' +
      row('eB', 'Eccentricity eB (m)', 0, 1.5, 0.01, state.eB) +
      (showEL ? row('eL', 'Eccentricity eL (m)', 0, 1.5, 0.01, state.eL) : '') +
      row('FoS', 'Factor of safety', 1, 5, 0.5, state.FoS) +
      row('qApp', 'Applied pressure (kPa)', 0, 1000, 10, state.qApp);
  }

  var LIM = { B:[0.3,6], L:[0.5,12], D:[0,5], phi:[0,45], c:[0,200],
              gamma:[14,22], gammaSat:[16,24], zw:[0,10],
              eB:[0,1.5], eL:[0,1.5], FoS:[1,5], qApp:[0,1000] };

  var setCustom = function() {
    state.preset = '';
    var e = document.getElementById('preset');
    if (e) e.value = '';
  };

  controls.addEventListener('input', function(e) {
    var k = e.target.dataset && e.target.dataset.k;
    if (!k || !LIM[k]) return;
    var v = parseFloat(e.target.value);
    if (isNaN(v)) return;
    state[k] = clamp(v, LIM[k][0], LIM[k][1]);

    /* clamp eccentricity to half the width */
    if (k === 'eB') state.eB = Math.min(state.eB, state.B / 2 - 0.02);
    if (k === 'eL') state.eL = Math.min(state.eL, state.L / 2 - 0.02);
    if (k === 'B') state.eB = Math.min(state.eB, state.B / 2 - 0.02);
    if (k === 'L') {
      state.L = Math.max(state.B, state.L);
      state.eL = Math.min(state.eL, state.L / 2 - 0.02);
    }

    for (var suf of ['r', 'n']) {
      var el = document.getElementById(k + suf);
      if (el && el !== e.target && document.activeElement !== el) el.value = state[k];
    }
    setCustom();
    renderAll();
  });

  controls.addEventListener('change', function(e) {
    if (e.target.id === 'preset') {
      var p = PRESETS[e.target.value];
      if (!p) { state.preset = ''; return; }
      Object.assign(state, p.f());
      state.preset = e.target.value;
      renderControls(); renderAll();
    } else if (e.target.id === 'method') {
      state.method = e.target.value;
      setCustom(); renderAll();
    } else if (e.target.id === 'shape') {
      state.shape = e.target.value;
      if (state.shape === 'square' || state.shape === 'circle') state.L = state.B;
      if (state.shape === 'strip') { state.eL = 0; }
      setCustom(); renderControls(); renderAll();
    }
  });

  /* ---------- boot ---------- */
  renderControls();
  renderAll();
})();
