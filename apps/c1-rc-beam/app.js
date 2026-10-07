/* CivilLab · C1 RC Beam Designer */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const TABS = ['flexure','shear','deflection','cracking'];
  const TAB_LABELS = { flexure:'Flexure', shear:'Shear', deflection:'Deflection', cracking:'Cracking' };

  const PRESETS = {
    singly: { label:'Singly reinforced', f:()=>({b:300,h:500,d:450,d2:50,cover:30,phi:16,
      fck:30,fyk:500,MEd:150,VEd:120,As1:900,As2:0,L:6,span:'ss',theta:21.8,code:'ec2'})},
    doubly: { label:'Doubly reinforced', f:()=>({b:250,h:400,d:350,d2:50,cover:30,phi:16,
      fck:30,fyk:500,MEd:200,VEd:150,As1:1600,As2:400,L:5,span:'ss',theta:25,code:'ec2'})},
    heavy:  { label:'Heavy shear', f:()=>({b:350,h:600,d:540,d2:60,cover:35,phi:20,
      fck:35,fyk:500,MEd:250,VEd:350,As1:1500,As2:0,L:8,span:'ss',theta:30,code:'ec2'})},
    cant:   { label:'Cantilever', f:()=>({b:300,h:500,d:450,d2:50,cover:30,phi:16,
      fck:30,fyk:500,MEd:100,VEd:80,As1:800,As2:0,L:3,span:'cant',theta:21.8,code:'ec2'})}
  };

  const state = Object.assign({ preset:'singly', tab:'flexure' }, PRESETS.singly.f());

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||11,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.dy)a.dy=o.dy;
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  const chip = (k,v,sub,cls) =>
    `<div class="chip ${cls||''}"><div class="k">${k}</div>` +
    `<div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function utilBar(label, util, x, y, w, h) {
    var g = s('g');
    var fill = util <= 1.0 ? C.green : C.load;
    var barW = Math.min(util, 1.5) / 1.5 * w;
    g.appendChild(s('rect', { x:x, y:y, width:w, height:h, fill:'#E8EBE6', rx:3 }));
    g.appendChild(s('rect', { x:x, y:y, width:barW, height:h, fill:fill, rx:3, opacity:0.8 }));
    if (util <= 1.5) {
      g.appendChild(line(x + w / 1.5, y, x + w / 1.5, y + h, { stroke:C.ocean, 'stroke-width':1.5, 'stroke-dasharray':'3 2' }));
    }
    g.appendChild(txt(x + w / 2, y - 4, label, { fs:10, fw:500, fill:C.ocean }));
    g.appendChild(txt(x + w + 6, y + h / 2, fmt(util * 100, 0) + '%',
      { fs:10, fw:600, fill:fill, an:'start', dy:'0.35em', halo:0 }));
    return g;
  }

  /* ---- drawing ---- */
  function drawFlexure(fr, bsr) {
    var sx = 80, sy = 60, scW = 200, scH = 380;
    var bPx = scW, hPx = scH;
    var dPx = hPx * (fr.d / fr.h);
    var xPx = hPx * (fr.x / fr.h);
    var zPx = hPx * (fr.z / fr.h);
    var lamX = fr.lam * xPx;

    fig.appendChild(txt(sx + bPx / 2, sy - 16, 'EC2 Stress Block',
      { fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));

    fig.appendChild(s('rect', { x:sx, y:sy, width:bPx, height:hPx,
      fill:'none', stroke:C.ocean, 'stroke-width':2 }));

    fig.appendChild(s('rect', { x:sx, y:sy, width:bPx, height:lamX,
      fill:C.water, opacity:0.15 }));
    fig.appendChild(s('rect', { x:sx, y:sy, width:bPx, height:lamX,
      fill:'none', stroke:C.water, 'stroke-width':1.5 }));

    fig.appendChild(line(sx - 20, sy + xPx, sx + bPx + 20, sy + xPx,
      { stroke:C.load, 'stroke-width':1.5, 'stroke-dasharray':'5 3' }));
    fig.appendChild(txt(sx + bPx + 24, sy + xPx, 'x = ' + fmt(fr.x, 1) + ' mm',
      { fs:10, an:'start', fill:C.load, dy:'0.35em' }));

    fig.appendChild(line(sx - 20, sy + dPx, sx + bPx + 20, sy + dPx,
      { stroke:C.green, 'stroke-width':1, 'stroke-dasharray':'3 3' }));
    fig.appendChild(txt(sx + bPx + 24, sy + dPx, 'd = ' + fmt(fr.d, 0) + ' mm',
      { fs:10, an:'start', fill:C.green, dy:'0.35em' }));

    var steelY = sy + dPx;
    for (var i = 0; i < 3; i++) {
      fig.appendChild(s('circle', { cx:sx + 30 + i * 70, cy:steelY, r:6, fill:C.ocean }));
    }
    if (fr.As2Req > 0 || state.As2 > 0) {
      for (var i = 0; i < 2; i++) {
        fig.appendChild(s('circle', { cx:sx + 50 + i * 100, cy:sy + hPx * (state.d2 / fr.h), r:5,
          fill:'none', stroke:C.ocean, 'stroke-width':1.5 }));
      }
    }

    var zTop = sy + lamX / 2;
    var zBot = steelY;
    fig.appendChild(line(sx - 30, zTop, sx - 30, zBot, { stroke:C.midblue, 'stroke-width':1.5 }));
    fig.appendChild(line(sx - 34, zTop, sx - 26, zTop, { stroke:C.midblue, 'stroke-width':1 }));
    fig.appendChild(line(sx - 34, zBot, sx - 26, zBot, { stroke:C.midblue, 'stroke-width':1 }));
    fig.appendChild(txt(sx - 38, (zTop + zBot) / 2, 'z=' + fmt(fr.z, 0),
      { fs:9, fill:C.midblue, an:'end', dy:'0.35em' }));

    fig.appendChild(txt(sx + bPx / 2, sy + lamX / 2,
      'η·fcd = ' + fmt(fr.eta * fr.mat.fcd, 1) + ' MPa',
      { fs:10, fill:C.water, dy:'0.35em' }));

    fig.appendChild(txt(sx + bPx / 2, sy + hPx + 20, 'b = ' + fmt(fr.b, 0) + ' mm',
      { fs:10, fill:C.muted }));

    var chainX = 400, chainY = 80;
    fig.appendChild(txt(chainX, chainY, 'Design chain',
      { fs:13, fw:600, fill:C.ocean, an:'start', head:true, halo:0 }));

    var steps = [
      'K = M/(bd²fck) = ' + fmt(fr.K, 4),
      fr.doubly ? 'K > K\' = 0.167 → doubly reinforced' : 'K ≤ K\' = 0.167 → singly reinforced',
      'z = ' + fmt(fr.z, 1) + ' mm',
      'x = ' + fmt(fr.x, 1) + ' mm  (x/d = ' + fmt(fr.xd, 3) + ')',
      'As,req = ' + fmt(fr.AsReq, 0) + ' mm²',
    ];
    if (fr.doubly) steps.push('As2,req = ' + fmt(fr.As2Req, 0) + ' mm²');
    steps.push('As,min = ' + fmt(fr.AsMin, 0) + ' mm²  (EC2 cl 9.2.1.1)');
    for (var i = 0; i < steps.length; i++) {
      fig.appendChild(txt(chainX, chainY + 24 + i * 20, steps[i],
        { fs:10, an:'start', fill:C.muted, halo:0 }));
    }

    fig.appendChild(utilBar('Flexure', fr.util,
      chainX, chainY + 24 + steps.length * 20 + 20, 250, 16));

    if (bsr) {
      var bsY = chainY + 24 + steps.length * 20 + 80;
      fig.appendChild(txt(chainX, bsY, 'BS 8110 comparison',
        { fs:12, fw:600, fill:C.muted, an:'start', head:true, halo:0 }));
      fig.appendChild(txt(chainX, bsY + 20,
        'K = ' + fmt(bsr.K, 4) + '  z = ' + fmt(bsr.z, 1) + ' mm  As = ' + fmt(bsr.As, 0) + ' mm²',
        { fs:10, an:'start', fill:C.muted, halo:0 }));
    }
  }

  function drawShear(sr, bssr) {
    var sx = 80, sy = 80;
    fig.appendChild(txt(sx + 100, sy - 16, 'Variable strut angle',
      { fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));

    var tw = 200, th = 300;
    var thetaRad = sr.theta * Math.PI / 180;
    var strutDx = th / Math.tan(thetaRad);

    fig.appendChild(s('rect', { x:sx, y:sy, width:tw, height:th,
      fill:'none', stroke:C.ocean, 'stroke-width':2 }));

    var nStruts = 3;
    for (var i = 0; i < nStruts; i++) {
      var x0 = sx + 20 + i * (tw - 40) / nStruts;
      var dx = Math.min(strutDx, tw - 20);
      fig.appendChild(line(x0, sy + th, x0 + dx, sy,
        { stroke:C.load, 'stroke-width':1.5, opacity:0.6 }));
    }

    for (var i = 0; i <= nStruts; i++) {
      var y = sy + i * th / nStruts;
      fig.appendChild(line(sx, y, sx + tw, y,
        { stroke:C.green, 'stroke-width':1.2, opacity:0.5 }));
    }

    fig.appendChild(txt(sx + tw / 2, sy + th + 20,
      'θ = ' + fmt(sr.theta, 1) + '°  cot θ = ' + fmt(sr.cotTh, 2),
      { fs:10, fill:C.muted }));

    var chainX = 360, chainY = 80;
    fig.appendChild(txt(chainX, chainY, 'Shear checks (EC2 cl 6.2)',
      { fs:13, fw:600, fill:C.ocean, an:'start', head:true, halo:0 }));

    var steps = [
      'VEd = ' + fmt(sr.VEd, 1) + ' kN',
      'VRd,c = ' + fmt(sr.VRdc, 1) + ' kN  (no links needed below this)',
      'VRd,max = ' + fmt(sr.VRdmax, 1) + ' kN  (at θ = ' + fmt(sr.theta, 1) + '°)',
      sr.needsLinks ? 'VEd > VRd,c → links required' : 'VEd ≤ VRd,c → minimum links only',
      sr.adequate ? 'VEd ≤ VRd,max → OK' : 'VEd > VRd,max → increase θ, b or fck',
      'Asw/s = ' + fmt(sr.AswUse, 2) + ' mm²/mm',
      'ν₁ = ' + fmt(sr.nu1, 3),
      'Optimal θ = ' + fmt(sr.thetaOpt, 1) + '°'
    ];
    for (var i = 0; i < steps.length; i++) {
      fig.appendChild(txt(chainX, chainY + 24 + i * 20, steps[i],
        { fs:10, an:'start', fill:C.muted, halo:0 }));
    }

    fig.appendChild(utilBar('Shear', sr.util,
      chainX, chainY + 24 + steps.length * 20 + 20, 250, 16));

    if (bssr) {
      var bsY = chainY + 24 + steps.length * 20 + 80;
      fig.appendChild(txt(chainX, bsY, 'BS 8110: v = ' + fmt(bssr.v, 2) +
        ' MPa  vc = ' + fmt(bssr.vc, 2) + ' MPa',
        { fs:10, an:'start', fill:C.muted, halo:0 }));
    }
  }

  function drawDeflection(dr) {
    var chainX = 100, chainY = 80;
    fig.appendChild(txt(chainX, chainY - 16, 'Span/depth check (EC2 Table 7.4N)',
      { fs:13, fw:600, fill:C.ocean, an:'start', head:true, halo:0 }));

    var steps = [
      'Span type: ' + dr.type,
      'K_b = ' + fmt(dr.Kb, 1),
      'ρ = As/(bd) = ' + fmt(dr.rho * 100, 3) + '%',
      'ρ₀ = √fck / 1000 = ' + fmt(dr.rho0 * 100, 3) + '%',
      'Basic L/d = ' + fmt(dr.basic, 1),
      'Modification factor = ' + fmt(dr.modAs, 2),
      'Allowable L/d = ' + fmt(dr.allowable, 1),
      'Actual L/d = ' + fmt(dr.actual, 1),
      dr.ok ? 'L/d OK' : 'L/d exceeds limit'
    ];
    for (var i = 0; i < steps.length; i++) {
      fig.appendChild(txt(chainX, chainY + 10 + i * 22, steps[i],
        { fs:11, an:'start', fill:C.muted, halo:0 }));
    }

    var bx = 500, by = 100, bw = 300, bh = 20;
    fig.appendChild(utilBar('Deflection (L/d)', dr.util, bx, by, bw, bh));

    fig.appendChild(s('rect', { x:bx, y:by + 60, width:bw * Math.min(dr.actual / (dr.allowable * 1.5), 1), height:bh,
      fill:dr.ok ? C.green : C.load, rx:3, opacity:0.6 }));
    fig.appendChild(s('rect', { x:bx, y:by + 60, width:bw, height:bh,
      fill:'none', stroke:C.contour, rx:3 }));
    fig.appendChild(txt(bx, by + 56, 'Actual L/d = ' + fmt(dr.actual, 1) +
      '  vs  Allowable = ' + fmt(dr.allowable, 1),
      { fs:10, an:'start', fill:C.muted, halo:0 }));
  }

  function drawCracking(cr) {
    var chainX = 100, chainY = 80;
    fig.appendChild(txt(chainX, chainY - 16, 'Crack width check (EC2 cl 7.3)',
      { fs:13, fw:600, fill:C.ocean, an:'start', head:true, halo:0 }));

    var steps = [
      'σ_s = M/(As·z) = ' + fmt(cr.sigS, 1) + ' MPa',
      'h_c,ef = ' + fmt(cr.hcef, 1) + ' mm',
      'ρ_eff = As/Ac,ef = ' + fmt(cr.rhoEff * 100, 3) + '%',
      'sr,max = ' + fmt(cr.srMax, 1) + ' mm',
      '(ε_sm − ε_cm) = ' + fmt(cr.esmEcm * 1000, 3) + ' × 10⁻³',
      'wk = sr,max × (ε_sm − ε_cm) = ' + fmt(cr.wk, 3) + ' mm',
      'wk,lim = ' + fmt(cr.wkLim, 1) + ' mm',
      cr.wkOk ? 'wk ≤ wk,lim → OK' : 'wk > wk,lim → increase As or reduce bar size',
      'Max bar spacing (Table 7.3N) = ' + fmt(cr.sMax, 0) + ' mm'
    ];
    for (var i = 0; i < steps.length; i++) {
      fig.appendChild(txt(chainX, chainY + 10 + i * 22, steps[i],
        { fs:11, an:'start', fill:C.muted, halo:0 }));
    }

    var bx = 500, by = 100, bw = 300, bh = 20;
    fig.appendChild(utilBar('Crack width', cr.util, bx, by, bw, bh));
  }

  function render() {
    while (fig.firstChild) fig.removeChild(fig.firstChild);

    var fr = RCBeamEngine.flexure({
      b:state.b, h:state.h, d:state.d, d2:state.d2,
      fck:state.fck, fyk:state.fyk, MEd:state.MEd
    });
    var sr = RCBeamEngine.shear({
      bw:state.b, d:state.d, fck:state.fck, fyk:state.fyk,
      VEd:state.VEd, As1:state.As1, theta:state.theta
    });
    var dr = RCBeamEngine.deflection({
      b:state.b, d:state.d, h:state.h, L:state.L,
      fck:state.fck, fyk:state.fyk, As1:state.As1, As2:state.As2,
      type:state.span
    });
    var cr = RCBeamEngine.cracking({
      b:state.b, d:state.d, h:state.h, cover:state.cover, phi:state.phi,
      fck:state.fck, fyk:state.fyk, As1:state.As1, MEd:state.MEd
    });
    var bsf = RCBeamEngine.bsFlexure({
      b:state.b, d:state.d, fck:state.fck, fyk:state.fyk, MEd:state.MEd
    });
    var bss = RCBeamEngine.bsShear({
      bw:state.b, d:state.d, fck:state.fck, fyk:state.fyk, VEd:state.VEd, As1:state.As1
    });

    if (state.tab === 'flexure') drawFlexure(fr, bsf);
    else if (state.tab === 'shear') drawShear(sr, bss);
    else if (state.tab === 'deflection') drawDeflection(dr);
    else if (state.tab === 'cracking') drawCracking(cr);

    var gov = Math.max(fr.util, sr.util, dr.util, cr.util);
    var govName = fr.util >= gov ? 'Flexure' :
                  sr.util >= gov ? 'Shear' :
                  dr.util >= gov ? 'Deflection' : 'Cracking';

    var html = '';
    html += chip('K', fmt(fr.K, 4), fr.doubly ? 'doubly reinforced' : 'singly reinforced',
      fr.doubly ? 'warn' : 'ok');
    html += chip('As,req', fmt(fr.AsReq, 0) + ' mm²', 'EC2 cl 6.1', '');
    html += chip('VRd,c', fmt(sr.VRdc, 1) + ' kN', 'no links needed below', 'ok');
    html += chip('VRd,max', fmt(sr.VRdmax, 1) + ' kN', 'θ = ' + fmt(sr.theta, 1) + '°',
      sr.adequate ? 'ok' : 'warn');
    html += chip('Asw/s', fmt(sr.AswUse, 2) + ' mm²/mm', 'EC2 cl 6.2.3', '');
    html += chip('L/d', fmt(dr.actual, 1) + ' / ' + fmt(dr.allowable, 1),
      dr.ok ? 'OK' : 'exceeds limit', dr.ok ? 'ok' : 'warn');
    html += chip('wk', fmt(cr.wk, 3) + ' mm', 'limit ' + fmt(cr.wkLim, 1) + ' mm',
      cr.wkOk ? 'ok' : 'warn');
    html += chip('Governs', govName, fmt(gov * 100, 0) + '% utilisation',
      gov <= 1.0 ? 'ok' : 'warn');

    if (state.code === 'bs') {
      html += chip('BS K', fmt(bsf.K, 4), bsf.doubly ? 'doubly' : 'singly', '');
      html += chip('BS As', fmt(bsf.As, 0) + ' mm²', 'BS 8110', '');
    }
    resultsEl.innerHTML = html;
  }

  /* ---- controls ---- */
  function renderControls() {
    var pOpts = Object.keys(PRESETS).map(function(k) {
      return '<option value="'+k+'"'+(state.preset===k?' selected':'')+'>'+PRESETS[k].label+'</option>';
    }).join('') + '<option value="custom"'+(state.preset==='custom'?' selected':'')+'>Custom</option>';

    var tabBtns = TABS.map(function(t) {
      return '<button class="btn small'+(state.tab===t?' ':' ghost')+'" data-tab="'+t+'">'+TAB_LABELS[t]+'</button>';
    }).join('');

    var spanOpts = [['ss','Simply supported'],['end','End span'],['int','Interior'],['cant','Cantilever']].map(function(sp) {
      return '<option value="'+sp[0]+'"'+(state.span===sp[0]?' selected':'')+'>'+sp[1]+'</option>';
    }).join('');

    var codeOpts = '<option value="ec2"'+(state.code==='ec2'?' selected':'')+'>EN 1992-1-1 (EC2)</option>'+
                   '<option value="bs"'+(state.code==='bs'?' selected':'')+'>BS 8110</option>';

    controls.innerHTML =
      '<div class="ctl"><label>Preset</label><select id="preset">'+pOpts+'</select></div>'+
      '<div class="ctl"><div class="row">'+tabBtns+'</div></div>'+
      '<div class="ctl"><label>Code</label><select id="code">'+codeOpts+'</select></div>'+
      '<div class="ctl"><label>b (mm)</label><div class="row">'+
        '<input type="range" id="br" data-k="b" min="150" max="500" step="10" value="'+state.b+'">'+
        '<input type="number" id="bn" data-k="b" min="150" max="500" step="10" value="'+state.b+'"></div></div>'+
      '<div class="ctl"><label>h (mm)</label><div class="row">'+
        '<input type="range" id="hr" data-k="h" min="200" max="1000" step="10" value="'+state.h+'">'+
        '<input type="number" id="hn" data-k="h" min="200" max="1000" step="10" value="'+state.h+'"></div></div>'+
      '<div class="ctl"><label>d (mm)</label><div class="row">'+
        '<input type="range" id="dr" data-k="d" min="150" max="950" step="5" value="'+state.d+'">'+
        '<input type="number" id="dn" data-k="d" min="150" max="950" step="5" value="'+state.d+'"></div></div>'+
      '<div class="ctl"><label>fck (MPa)</label><div class="row">'+
        '<input type="range" id="fckr" data-k="fck" min="20" max="50" step="5" value="'+state.fck+'">'+
        '<input type="number" id="fckn" data-k="fck" min="20" max="50" step="5" value="'+state.fck+'"></div></div>'+
      '<div class="ctl"><label>MEd (kN·m)</label><div class="row">'+
        '<input type="range" id="MEdr" data-k="MEd" min="0" max="500" step="5" value="'+state.MEd+'">'+
        '<input type="number" id="MEdn" data-k="MEd" min="0" max="500" step="5" value="'+state.MEd+'"></div></div>'+
      '<div class="ctl"><label>VEd (kN)</label><div class="row">'+
        '<input type="range" id="VEdr" data-k="VEd" min="0" max="500" step="5" value="'+state.VEd+'">'+
        '<input type="number" id="VEdn" data-k="VEd" min="0" max="500" step="5" value="'+state.VEd+'"></div></div>'+
      '<div class="ctl"><label>As (mm²)</label><div class="row">'+
        '<input type="range" id="As1r" data-k="As1" min="100" max="5000" step="50" value="'+state.As1+'">'+
        '<input type="number" id="As1n" data-k="As1" min="100" max="5000" step="50" value="'+state.As1+'"></div></div>'+
      '<div class="ctl"><label>As\' (mm²)</label><div class="row">'+
        '<input type="range" id="As2r" data-k="As2" min="0" max="2000" step="50" value="'+state.As2+'">'+
        '<input type="number" id="As2n" data-k="As2" min="0" max="2000" step="50" value="'+state.As2+'"></div></div>'+
      '<div class="ctl"><label>θ strut (°)</label><div class="row">'+
        '<input type="range" id="thetar" data-k="theta" min="21.8" max="45" step="0.1" value="'+state.theta+'">'+
        '<input type="number" id="thetan" data-k="theta" min="21.8" max="45" step="0.1" value="'+state.theta+'"></div></div>'+
      '<div class="ctl"><label>Span (m)</label><div class="row">'+
        '<input type="range" id="Lr" data-k="L" min="1" max="12" step="0.5" value="'+state.L+'">'+
        '<input type="number" id="Ln" data-k="L" min="1" max="12" step="0.5" value="'+state.L+'"></div></div>'+
      '<div class="ctl"><label>Span type</label><select id="span">'+spanOpts+'</select></div>'+
      '<div class="ctl"><label>Cover (mm)</label><div class="row">'+
        '<input type="range" id="coverr" data-k="cover" min="20" max="50" step="5" value="'+state.cover+'">'+
        '<input type="number" id="covern" data-k="cover" min="20" max="50" step="5" value="'+state.cover+'"></div></div>'+
      '<div class="ctl"><label>Bar ∅ (mm)</label><div class="row">'+
        '<input type="range" id="phir" data-k="phi" min="10" max="32" step="2" value="'+state.phi+'">'+
        '<input type="number" id="phin" data-k="phi" min="10" max="32" step="2" value="'+state.phi+'"></div></div>';
  }

  controls.addEventListener('input', function(e) {
    var t = e.target, k = t.dataset.k;
    if (!k) return;
    var v = parseFloat(t.value);
    if (isNaN(v)) return;
    state[k] = clamp(v, parseFloat(t.min), parseFloat(t.max));
    var twin = t.type === 'range'
      ? document.getElementById(k + 'n')
      : document.getElementById(k + 'r');
    if (twin && twin !== document.activeElement) twin.value = state[k];
    if (state.preset !== 'custom') {
      state.preset = 'custom';
      var sel = document.getElementById('preset');
      if (sel) sel.value = 'custom';
    }
    render();
  });

  controls.addEventListener('change', function(e) {
    var t = e.target;
    if (t.id === 'preset') {
      var p = PRESETS[t.value];
      if (p) {
        Object.assign(state, p.f());
        state.preset = t.value;
        renderControls();
      }
      render();
      return;
    }
    if (t.id === 'code') {
      state.code = t.value;
      render();
      return;
    }
    if (t.id === 'span') {
      state.span = t.value;
      if (state.preset !== 'custom') {
        state.preset = 'custom';
        var sel = document.getElementById('preset');
        if (sel) sel.value = 'custom';
      }
      render();
      return;
    }
    var k = t.dataset.k;
    if (k) {
      var v = parseFloat(t.value);
      if (isNaN(v)) return;
      state[k] = clamp(v, parseFloat(t.min), parseFloat(t.max));
      render();
    }
  });

  controls.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    renderControls();
    render();
  });

  renderControls();
  render();
})();
