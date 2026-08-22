/* CivilLab · S3 Bending Stress Explorer */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7', bg:'#F6F7F4' };

  const TYPES = [['rect','Rectangle'],['ibeam','I-section'],['tee','T-section'],
                 ['box','Box (RHS)'],['circle','Solid circle'],['pipe','Pipe (CHS)']];
  const DIMS = {
    rect:[['b','b width'],['h','h depth']],
    ibeam:[['bf','bf flange width'],['tf','tf flange thk'],['tw','tw web thk'],['hw','hw web depth']],
    tee:[['bf','bf flange width'],['tf','tf flange thk'],['tw','tw web thk'],['hw','hw web depth']],
    box:[['b','b width'],['h','h depth'],['t','t wall thk']],
    circle:[['do','d diameter']],
    pipe:[['do','do outer dia'],['di','di inner dia']]
  };
  const state = { type:'ibeam', dims: {...SectionEngine.DEFAULTS.ibeam}, M: 60 };

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  /* geometry of the two panels */
  const SEC = { cx:280, yb:450, hMax:360 };       // section drawn to scale
  const STR = { ax:640, amp:200 };                // stress diagram axis

  function fixDims(){
    const d = state.dims, t = state.type;
    for (const k in d) d[k] = clamp(d[k], 4, 1200);
    if (t==='pipe') d.di = clamp(d.di, 4, d.do-8);
    if (t==='box') d.t = clamp(d.t, 2, Math.min(d.b,d.h)/2-2);
  }

  function drawSection(sec, k, yNA){
    const g = s('g');
    if (sec.type==='circle' || sec.type==='pipe'){
      const R = sec.R*k;
      g.appendChild(s('circle',{cx:SEC.cx, cy:SEC.yb-sec.ybar*k, r:R,
        fill:'rgba(20,65,107,.10)', stroke:C.ocean,'stroke-width':2}));
      if (sec.ri>0) g.appendChild(s('circle',{cx:SEC.cx, cy:SEC.yb-sec.ybar*k, r:sec.ri*k,
        fill:C.bg, stroke:C.ocean,'stroke-width':2}));
    } else {
      for (const r of sec.rects){
        // draw box webs as two separate walls for honesty
        if (sec.type==='box' && Math.abs(r.w-2*sec.dims.t)<1e-9){
          const t = sec.dims.t*k, bo = sec.dims.b*k;
          for (const off of [-bo/2, bo/2-t])
            g.appendChild(s('rect',{x:SEC.cx+off, y:SEC.yb-r.y1*k, width:t, height:(r.y1-r.y0)*k,
              fill:'rgba(20,65,107,.10)', stroke:C.ocean,'stroke-width':1.6}));
          continue;
        }
        g.appendChild(s('rect',{x:SEC.cx-r.w*k/2, y:SEC.yb-r.y1*k, width:r.w*k, height:(r.y1-r.y0)*k,
          fill:'rgba(20,65,107,.10)', stroke:C.ocean,'stroke-width':1.6}));
      }
    }
    // centroid + NA
    g.appendChild(s('circle',{cx:SEC.cx, cy:yNA, r:3.5, fill:C.ocean}));
    fig.appendChild(g);
  }

  function render(){
    fixDims();
    const sec = SectionEngine.build(state.type, state.dims);
    const k = SEC.hMax / sec.h;
    const yNA = SEC.yb - sec.ybar*k;
    const yTop = SEC.yb - sec.h*k;
    const sTop = -state.M*1e6*sec.ytop/sec.I;    // MPa, sagging + → top compression
    const sBot =  state.M*1e6*sec.ybot/sec.I;
    const smax = Math.max(Math.abs(sTop), Math.abs(sBot), 1e-9);
    const ks = STR.amp/smax;

    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(txt(40,26,'Cross section',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(txt(STR.ax,26,'Bending stress σ = M·y / I',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));

    drawSection(sec,k,yNA);

    // neutral axis across both panels
    fig.appendChild(line(SEC.cx-190, yNA, STR.ax+STR.amp+40, yNA,
      {stroke:C.contour,'stroke-width':1.2,'stroke-dasharray':'6 4'}));
    fig.appendChild(txt(SEC.cx-196, yNA+4,'NA',{an:'end',fs:11,halo:0}));
    fig.appendChild(txt(SEC.cx, SEC.yb+22, `ȳ = ${fmt(sec.ybar)} mm from the bottom`,{fs:11,halo:0}));

    // stress axis and two triangles (compression left in brick, tension right in water)
    fig.appendChild(line(STR.ax, yTop-16, STR.ax, SEC.yb+16, {stroke:C.axis,'stroke-width':1.2}));
    const xTop = STR.ax + sTop*ks, xBot = STR.ax + sBot*ks;
    // top wedge (NA to top)
    fig.appendChild(s('polygon',{points:`${STR.ax},${yNA} ${xTop},${yTop} ${STR.ax},${yTop}`,
      fill: sTop>=0 ? 'rgba(30,120,176,.16)' : 'rgba(176,58,46,.14)',
      stroke: sTop>=0 ? C.water : C.load, 'stroke-width':1.8}));
    // bottom wedge
    fig.appendChild(s('polygon',{points:`${STR.ax},${yNA} ${xBot},${SEC.yb} ${STR.ax},${SEC.yb}`,
      fill: sBot>=0 ? 'rgba(30,120,176,.16)' : 'rgba(176,58,46,.14)',
      stroke: sBot>=0 ? C.water : C.load, 'stroke-width':1.8}));
    fig.appendChild(line(xTop,yTop,STR.ax,yNA,{stroke:C.ocean,'stroke-width':2}));
    fig.appendChild(line(STR.ax,yNA,xBot,SEC.yb,{stroke:C.ocean,'stroke-width':2}));

    const lab=(v)=> `${fmt(v)} MPa ${v>=0?'(tension)':'(compression)'}`;
    fig.appendChild(txt(xTop + (sTop>=0?10:-10), yTop-6, lab(sTop),
      {an: sTop>=0?'start':'end', fs:11.5, fw:600, fill: sTop>=0?C.water:C.load}));
    fig.appendChild(txt(xBot + (sBot>=0?10:-10), SEC.yb+14, lab(sBot),
      {an: sBot>=0?'start':'end', fs:11.5, fw:600, fill: sBot>=0?C.water:C.load}));
    fig.appendChild(txt(STR.ax, SEC.yb+34, `M = ${fmt(state.M)} kN·m (sagging positive)`,{fs:11,halo:0}));

    resultsEl.innerHTML =
      chip('Area A', `${fmt(sec.A/1e3,2)} ×10³ mm²`) +
      chip('I about NA', `${fmt(sec.I/1e6,1)} ×10⁶ mm⁴`) +
      chip('Ztop', `${fmt(sec.Ztop/1e3,0)} ×10³ mm³`) +
      chip('Zbot', `${fmt(sec.Zbot/1e3,0)} ×10³ mm³`) +
      chip('σ top fibre', `${fmt(sTop)} MPa`, sTop>=0?'tension':'compression', sTop>=0?'':'warn') +
      chip('σ bottom fibre', `${fmt(sBot)} MPa`, sBot>=0?'tension':'compression', sBot>=0?'':'warn');
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const opts = TYPES.map(([v,t])=>`<option value="${v}" ${state.type===v?'selected':''}>${t}</option>`).join('');
    const dims = DIMS[state.type].map(([k,lab])=>
      `<div class="mini"><label>${lab} (mm)</label><input type="number" step="1" min="4" value="${state.dims[k]}" data-dim="${k}"></div>`).join('');
    controls.innerHTML = `
      <h3>Section</h3>
      <div class="ctl"><select id="type">${opts}</select></div>
      <div class="grid2">${dims}</div>
      <h3>Loading</h3>
      <div class="ctl"><label>Applied moment M (kN·m)</label>
        <div class="row">
          <input type="range" id="M-r" min="-200" max="200" step="5" value="${state.M}">
          <input type="number" id="M-n" min="-200" max="200" step="5" value="${state.M}">
        </div>
      </div>`;
  }

  controls.addEventListener('input', e=>{
    const t=e.target;
    if(t.id==='M-r'||t.id==='M-n'){
      state.M = clamp(parseFloat(t.value)||0,-200,200);
      const o=document.getElementById(t.id==='M-r'?'M-n':'M-r'); if(o)o.value=state.M;
      render(); return;
    }
    if(t.dataset.dim){
      const v=parseFloat(t.value); if(isNaN(v))return;
      state.dims[t.dataset.dim]=v; render();
    }
  });
  controls.addEventListener('change', e=>{
    if(e.target.id==='type'){
      state.type=e.target.value;
      state.dims={...SectionEngine.DEFAULTS[state.type]};
      renderControls(); render();
    }
  });

  renderControls(); render();
})();
