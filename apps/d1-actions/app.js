/* CivilLab · D1 Actions and Load Combinations */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72',
              axis:'#B9C0C5', contour:'#C9CEC7', hair:'#DFE3DC' };

  const CATS = [
    ['A','Cat A · Domestic'],['B','Cat B · Office'],['C','Cat C · Congregation'],
    ['D','Cat D · Shopping'],['E','Cat E · Storage'],['F','Cat F · Traffic ≤ 30 kN'],
    ['G','Cat G · Traffic 30–160 kN'],['H','Cat H · Roofs']
  ];
  const VCATS = [
    ['wind','Wind'],['snow','Snow (≤ 1000 m)'],['snowH','Snow (> 1000 m)'],
    ['A','Cat A'],['B','Cat B'],['C','Cat C'],['D','Cat D'],['E','Cat E'],['H','Cat H']
  ];

  const PRESETS = {
    office: { label:'Typical office floor', f:()=>({Gk:5,Qk1:2.5,cat1:'B',Qk2:0,cat2:'wind',Qk3:0,cat3:'snow'})},
    residential:{label:'Residential with wind', f:()=>({Gk:4,Qk1:1.5,cat1:'A',Qk2:0.8,cat2:'wind',Qk3:0,cat3:'snow'})},
    storage:{label:'Warehouse storage', f:()=>({Gk:6,Qk1:7.5,cat1:'E',Qk2:0,cat2:'wind',Qk3:0,cat3:'snow'})},
    roof:  {label:'Roof with wind and snow', f:()=>({Gk:3,Qk1:0.6,cat1:'H',Qk2:1.2,cat2:'wind',Qk3:0.5,cat3:'snow'})},
    heavy: {label:'Heavy imposed + wind + snow', f:()=>({Gk:8,Qk1:5,cat1:'C',Qk2:1.5,cat2:'wind',Qk3:0.8,cat3:'snow'})}
  };

  const state = Object.assign({ preset:'office', base:'office' }, PRESETS.office.f());

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

  /* -------- layout -------- */
  const PL = { x0:60, x1:930, y0:55, yBase:520, barW:56, gap:20, groupGap:50 };

  function barX(groupIdx, barIdx) {
    var gx = PL.x0 + groupIdx * (3 * PL.barW + 2 * PL.gap + PL.groupGap);
    return gx + barIdx * (PL.barW + PL.gap);
  }

  function render() {
    var r = ActionsEngine.solve(state);
    while (fig.firstChild) fig.removeChild(fig.firstChild);

    var allTotals = [
      r.uls.eq610.total, r.uls.eq610a.total, r.uls.eq610b.total,
      r.sls.char.total, r.sls.freq.total, r.sls.qp.total,
      r.bs.ulsGrav.total
    ];
    if (r.bs.ulsWind.total !== 0) allTotals.push(r.bs.ulsWind.total);
    if (r.bs.ulsComb.total !== 0) allTotals.push(r.bs.ulsComb.total);
    var maxVal = Math.max.apply(null, allTotals.map(function(v){return Math.abs(v);}));
    if (maxVal < 0.01) maxVal = 1;
    var barH = PL.yBase - PL.y0 - 60;
    var sc = barH / maxVal;

    var colors = { g: C.ocean, q1: C.load, q2: C.water, q3: C.midblue };

    function drawBar(x, w, parts, label, total, isGoverning) {
      var g = s('g');
      var y = PL.yBase;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (Math.abs(p.val) < 0.001) continue;
        var h = Math.abs(p.val) * sc;
        y -= h;
        g.appendChild(s('rect', { x:x, y:y, width:w, height:h,
          fill:p.color, opacity:0.82, rx:1 }));
        if (h > 16) {
          g.appendChild(txt(x + w/2, y + h/2, fmt(p.val, 2),
            { fs:9.5, fw:500, fill:'#fff', dy:'0.35em', halo:0 }));
        }
      }
      if (isGoverning) {
        g.appendChild(s('rect', { x:x-2, y:PL.yBase - Math.abs(total)*sc - 2,
          width:w+4, height:Math.abs(total)*sc + 4,
          fill:'none', stroke:C.ocean, 'stroke-width':2.2, rx:2, 'stroke-dasharray':'4 3' }));
      }
      g.appendChild(txt(x + w/2, PL.yBase + 13, label,
        { fs:10, fw:isGoverning ? 600 : 400, fill:isGoverning ? C.ocean : C.muted, an:'middle' }));
      g.appendChild(txt(x + w/2, PL.yBase - Math.abs(total)*sc - 6, fmt(total, 2),
        { fs:11, fw:600, fill:C.ocean }));
      fig.appendChild(g);
    }

    /* baseline */
    fig.appendChild(line(PL.x0 - 10, PL.yBase, PL.x1, PL.yBase,
      { stroke:C.axis, 'stroke-width':1 }));

    /* ---- ULS group ---- */
    fig.appendChild(txt(barX(0,1), PL.y0 - 20, 'ULS — EN 1990 Table A1.2(B)',
      { fs:13, fw:600, fill:C.ocean, head:true, halo:0 }));

    var hasAccomp = Math.abs(state.Qk2) > 0.001 || Math.abs(state.Qk3) > 0.001;

    function ulsParts(gPart, q1Part, accomp) {
      var parts = [{ val:gPart, color:colors.g }];
      parts.push({ val:q1Part, color:colors.q1 });
      if (hasAccomp) parts.push({ val:accomp, color:colors.q2 });
      return parts;
    }

    var ux0 = barX(0, 0);
    drawBar(ux0, PL.barW,
      ulsParts(r.uls.eq610.gPart, r.uls.eq610.q1Part, r.uls.eq610.accomp),
      '6.10', r.uls.eq610.total, true);

    drawBar(ux0 + PL.barW + PL.gap, PL.barW,
      ulsParts(r.uls.eq610a.gPart, r.uls.eq610a.q1Part, r.uls.eq610a.accomp),
      '6.10a', r.uls.eq610a.total, false);

    drawBar(ux0 + 2*(PL.barW + PL.gap), PL.barW,
      ulsParts(r.uls.eq610b.gPart, r.uls.eq610b.q1Part, r.uls.eq610b.accomp),
      '6.10b', r.uls.eq610b.total, false);

    /* ---- SLS group ---- */
    var sx0 = barX(0, 0) + 3*(PL.barW + PL.gap) + PL.groupGap;
    fig.appendChild(txt(sx0 + PL.barW + PL.gap/2, PL.y0 - 20, 'SLS — EN 1990 cl 6.5.3',
      { fs:13, fw:600, fill:C.green, head:true, halo:0 }));

    function slsParts(gPart, q1Part, accomp) {
      var parts = [{ val:gPart, color:C.green }];
      parts.push({ val:q1Part, color:'#B03A2E' });
      if (hasAccomp) parts.push({ val:accomp, color:C.water });
      return parts;
    }

    drawBar(sx0, PL.barW,
      slsParts(r.sls.char.gPart, r.sls.char.q1Part, r.sls.char.accomp),
      'Char', r.sls.char.total, false);

    drawBar(sx0 + PL.barW + PL.gap, PL.barW,
      slsParts(r.sls.freq.gPart, r.sls.freq.q1Part, r.sls.freq.accomp),
      'Freq', r.sls.freq.total, false);

    drawBar(sx0 + 2*(PL.barW + PL.gap), PL.barW,
      slsParts(r.sls.qp.gPart, r.sls.qp.q1Part, r.sls.qp.accomp),
      'Q-P', r.sls.qp.total, false);

    /* ---- BS group ---- */
    var bx0 = sx0 + 3*(PL.barW + PL.gap) + PL.groupGap;
    fig.appendChild(txt(bx0 + PL.barW/2, PL.y0 - 20, 'BS 8110',
      { fs:13, fw:600, fill:C.muted, head:true, halo:0 }));

    drawBar(bx0, PL.barW,
      [{ val:r.bs.ulsGrav.gPart, color:'#8899AA' }, { val:r.bs.ulsGrav.q1Part, color:'#AA7766' }],
      '1.4+1.6', r.bs.ulsGrav.total, false);

    /* ---- Legend ---- */
    var lx = PL.x0, ly = PL.yBase + 30;
    var legItems = [
      { color:colors.g, label:'γ_G · Gk (permanent)' },
      { color:colors.q1, label:'γ_Q · Qk1 (leading variable)' }
    ];
    if (hasAccomp) legItems.push({ color:colors.q2, label:'γ_Q · ψ₀ · Qki (accompanying)' });
    for (var i = 0; i < legItems.length; i++) {
      fig.appendChild(s('rect', { x:lx, y:ly - 7, width:12, height:12, fill:legItems[i].color, rx:2, opacity:0.85 }));
      fig.appendChild(txt(lx + 16, ly + 2, legItems[i].label,
        { fs:10, an:'start', halo:0, fill:C.muted }));
      lx += 180;
    }

    /* ---- Factor chain annotations ---- */
    var annY = PL.yBase + 48;
    fig.appendChild(txt(ux0 + PL.barW/2, annY,
      'γ_G=' + fmt(r.GG,2) + '  γ_Q=' + fmt(r.GQ,1),
      { fs:9, fill:C.contour, halo:0 }));
    fig.appendChild(txt(ux0 + PL.barW + PL.gap + PL.barW/2, annY,
      'ψ₀=' + fmt(r.psi1.psi0,1),
      { fs:9, fill:C.contour, halo:0 }));
    fig.appendChild(txt(ux0 + 2*(PL.barW+PL.gap) + PL.barW/2, annY,
      'ξ=' + fmt(r.XI,3),
      { fs:9, fill:C.contour, halo:0 }));

    fig.appendChild(txt(sx0 + PL.barW/2, annY,
      'ψ₀=' + fmt(r.psi1.psi0,1),
      { fs:9, fill:C.contour, halo:0 }));
    fig.appendChild(txt(sx0 + PL.barW + PL.gap + PL.barW/2, annY,
      'ψ₁=' + fmt(r.psi1.psi1,1),
      { fs:9, fill:C.contour, halo:0 }));
    fig.appendChild(txt(sx0 + 2*(PL.barW+PL.gap) + PL.barW/2, annY,
      'ψ₂=' + fmt(r.psi1.psi2,1),
      { fs:9, fill:C.contour, halo:0 }));

    /* ---- Equation labels ---- */
    var eqY = PL.y0 - 4;
    fig.appendChild(txt(ux0 + PL.barW/2, eqY,
      'γ_G·Gk + γ_Q·Qk₁',
      { fs:8.5, fill:C.contour, halo:0 }));
    fig.appendChild(txt(ux0 + PL.barW + PL.gap + PL.barW/2, eqY,
      'γ_G·Gk + γ_Q·ψ₀·Qk₁',
      { fs:8.5, fill:C.contour, halo:0 }));
    fig.appendChild(txt(ux0 + 2*(PL.barW+PL.gap) + PL.barW/2, eqY,
      'ξ·γ_G·Gk + γ_Q·Qk₁',
      { fs:8.5, fill:C.contour, halo:0 }));

    /* ---- Results chips ---- */
    var psiLabel = 'Cat ' + state.cat1 + ': ψ₀=' + fmt(r.psi1.psi0,1) +
      '  ψ₁=' + fmt(r.psi1.psi1,1) + '  ψ₂=' + fmt(r.psi1.psi2,1);
    var html = '';
    html += chip('Eq 6.10', fmt(r.uls.eq610.total, 2) + ' kN/m²', 'γ_G·Gk + γ_Q·Qk₁', 'ok');
    html += chip('Eq 6.10a', fmt(r.uls.eq610a.total, 2) + ' kN/m²', 'γ_G·Gk + γ_Q·ψ₀·Qk₁', '');
    html += chip('Eq 6.10b', fmt(r.uls.eq610b.total, 2) + ' kN/m²', 'ξ·γ_G·Gk + γ_Q·Qk₁', '');
    html += chip('max(a,b)', fmt(r.uls.maxAB, 2) + ' kN/m²', 'may use instead of 6.10', '');
    html += chip('SLS Char', fmt(r.sls.char.total, 2) + ' kN/m²', 'Gk + Qk₁ + ψ₀·Qki', '');
    html += chip('SLS Freq', fmt(r.sls.freq.total, 2) + ' kN/m²', 'Gk + ψ₁·Qk₁ + ψ₂·Qki', '');
    html += chip('SLS Q-P', fmt(r.sls.qp.total, 2) + ' kN/m²', 'Gk + ψ₂·Qki', '');
    html += chip('BS ULS', fmt(r.bs.ulsGrav.total, 2) + ' kN/m²', '1.4·Gk + 1.6·Qk', 'warn');
    html += chip('ψ factors', psiLabel, ActionsEngine.psiFor(state.cat1).name, '');
    if (r.uls.eq610.total > 0) {
      var ratio = r.uls.maxAB / r.uls.eq610.total * 100;
      html += chip('6.10a/b saving',
        fmt(100 - ratio, 1) + '%',
        'using max(a,b) vs 6.10', ratio < 100 ? 'ok' : '');
    }
    resultsEl.innerHTML = html;
  }

  /* ---- controls ---- */
  function renderControls() {
    var opts = Object.keys(PRESETS).map(function(k) {
      return '<option value="'+k+'"'+(state.preset===k?' selected':'')+'>'+PRESETS[k].label+'</option>';
    }).join('') + '<option value="custom"'+(state.preset==='custom'?' selected':'')+'>Custom</option>';

    var catOpts = CATS.map(function(c) {
      return '<option value="'+c[0]+'"'+(state.cat1===c[0]?' selected':'')+'>'+c[1]+'</option>';
    }).join('');

    var v2Opts = VCATS.map(function(c) {
      return '<option value="'+c[0]+'"'+(state.cat2===c[0]?' selected':'')+'>'+c[1]+'</option>';
    }).join('');

    var v3Opts = VCATS.map(function(c) {
      return '<option value="'+c[0]+'"'+(state.cat3===c[0]?' selected':'')+'>'+c[1]+'</option>';
    }).join('');

    controls.innerHTML =
      '<div class="ctl"><label>Preset</label><select id="preset">'+opts+'</select></div>'+
      '<div class="ctl"><label>Permanent Gk (kN/m²)</label><div class="row">'+
        '<input type="range" id="Gkr" data-k="Gk" min="0" max="30" step="0.5" value="'+state.Gk+'">'+
        '<input type="number" id="Gkn" data-k="Gk" min="0" max="30" step="0.5" value="'+state.Gk+'"></div></div>'+
      '<div class="ctl"><label>Imposed Qk₁ (kN/m²)</label><div class="row">'+
        '<input type="range" id="Qk1r" data-k="Qk1" min="0" max="20" step="0.5" value="'+state.Qk1+'">'+
        '<input type="number" id="Qk1n" data-k="Qk1" min="0" max="20" step="0.5" value="'+state.Qk1+'"></div></div>'+
      '<div class="ctl"><label>Building category</label><select id="cat1">'+catOpts+'</select></div>'+
      '<div class="ctl"><label>Variable 2 (kN/m²)</label><div class="row">'+
        '<input type="range" id="Qk2r" data-k="Qk2" min="0" max="10" step="0.1" value="'+state.Qk2+'">'+
        '<input type="number" id="Qk2n" data-k="Qk2" min="0" max="10" step="0.1" value="'+state.Qk2+'"></div></div>'+
      '<div class="ctl"><label>Variable 2 type</label><select id="cat2">'+v2Opts+'</select></div>'+
      '<div class="ctl"><label>Variable 3 (kN/m²)</label><div class="row">'+
        '<input type="range" id="Qk3r" data-k="Qk3" min="0" max="10" step="0.1" value="'+state.Qk3+'">'+
        '<input type="number" id="Qk3n" data-k="Qk3" min="0" max="10" step="0.1" value="'+state.Qk3+'"></div></div>'+
      '<div class="ctl"><label>Variable 3 type</label><select id="cat3">'+v3Opts+'</select></div>';
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
        state.base = t.value;
        renderControls();
      }
      render();
      return;
    }
    if (t.id === 'cat1') {
      state.cat1 = t.value;
      if (state.preset !== 'custom') {
        state.preset = 'custom';
        var sel = document.getElementById('preset');
        if (sel) sel.value = 'custom';
      }
      render();
      return;
    }
    if (t.id === 'cat2') {
      state.cat2 = t.value;
      if (state.preset !== 'custom') {
        state.preset = 'custom';
        var sel = document.getElementById('preset');
        if (sel) sel.value = 'custom';
      }
      render();
      return;
    }
    if (t.id === 'cat3') {
      state.cat3 = t.value;
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

  renderControls();
  render();
})();
