/* CivilLab · S4 Shear Stress Distribution */
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
  const state = { type:'ibeam', dims:{...SectionEngine.DEFAULTS.ibeam}, V:100 };

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));
  const SEC = { cx:280, yb:450, hMax:360 };
  const PLT = { ax:620, amp:230 };

  function fixDims(){
    const d=state.dims,t=state.type;
    for(const k in d) d[k]=clamp(d[k],4,1200);
    if(t==='pipe') d.di=clamp(d.di,4,d.do-8);
    if(t==='box') d.t=clamp(d.t,2,Math.min(d.b,d.h)/2-2);
  }

  function drawSection(sec,k,yNA){
    const g=s('g');
    if(sec.type==='circle'||sec.type==='pipe'){
      g.appendChild(s('circle',{cx:SEC.cx,cy:SEC.yb-sec.ybar*k,r:sec.R*k,
        fill:'rgba(20,65,107,.10)',stroke:C.ocean,'stroke-width':2}));
      if(sec.ri>0)g.appendChild(s('circle',{cx:SEC.cx,cy:SEC.yb-sec.ybar*k,r:sec.ri*k,
        fill:C.bg,stroke:C.ocean,'stroke-width':2}));
    } else {
      for(const r of sec.rects){
        if(sec.type==='box'&&Math.abs(r.w-2*sec.dims.t)<1e-9){
          const t=sec.dims.t*k,bo=sec.dims.b*k;
          for(const off of[-bo/2,bo/2-t])
            g.appendChild(s('rect',{x:SEC.cx+off,y:SEC.yb-r.y1*k,width:t,height:(r.y1-r.y0)*k,
              fill:'rgba(20,65,107,.10)',stroke:C.ocean,'stroke-width':1.6}));
          continue;
        }
        g.appendChild(s('rect',{x:SEC.cx-r.w*k/2,y:SEC.yb-r.y1*k,width:r.w*k,height:(r.y1-r.y0)*k,
          fill:'rgba(20,65,107,.10)',stroke:C.ocean,'stroke-width':1.6}));
      }
    }
    g.appendChild(s('circle',{cx:SEC.cx,cy:yNA,r:3.5,fill:C.ocean}));
    fig.appendChild(g);
  }

  function render(){
    fixDims();
    const sec = SectionEngine.build(state.type, state.dims);
    const k = SEC.hMax/sec.h;
    const yNA = SEC.yb - sec.ybar*k;
    const yTop = SEC.yb - sec.h*k;

    // sample τ(y) at slice midpoints so we never sit exactly on a junction
    const N = 400, pts = [];
    let tmax = 0, ymaxNA = 0;
    for (let i = 0; i < N; i++) {
      const y = -sec.ybot + (i + 0.5) / N * sec.h;   // from NA, mm
      const b = sec.bAt(y);
      const tau = b > 1e-9 ? state.V * 1e3 * sec.QAt(y) / (sec.I * b) : 0;
      pts.push({ y, tau });
      if (tau > tmax) { tmax = tau; ymaxNA = y; }
    }
    const tNA = state.V * 1e3 * sec.QAt(0) / (sec.I * sec.bAt(0));
    const tAvg = state.V * 1e3 / sec.A;
    const kt = PLT.amp / Math.max(tmax, 1e-9);
    const yscr = y => SEC.yb - (y + sec.ybot) * k;

    while (fig.firstChild) fig.removeChild(fig.firstChild);
    fig.appendChild(txt(40,26,'Cross section',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(txt(PLT.ax,26,'Shear stress τ = V·Q / (I·b)',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    drawSection(sec,k,yNA);

    fig.appendChild(line(SEC.cx-190,yNA,PLT.ax+PLT.amp+40,yNA,
      {stroke:C.contour,'stroke-width':1.2,'stroke-dasharray':'6 4'}));
    fig.appendChild(txt(SEC.cx-196,yNA+4,'NA',{an:'end',fs:11,halo:0}));

    // axis + profile
    fig.appendChild(line(PLT.ax,yTop-14,PLT.ax,SEC.yb+14,{stroke:C.axis,'stroke-width':1.2}));
    let d = `M ${PLT.ax} ${yscr(pts[0].y).toFixed(1)}`;
    d += ` L ${(PLT.ax+pts[0].tau*kt).toFixed(1)} ${yscr(pts[0].y).toFixed(1)}`;
    for (const p of pts) d += ` L ${(PLT.ax+p.tau*kt).toFixed(1)} ${yscr(p.y).toFixed(1)}`;
    d += ` L ${PLT.ax} ${yscr(pts[N-1].y).toFixed(1)} Z`;
    fig.appendChild(s('path',{d,fill:'rgba(30,120,176,.14)',stroke:C.water,'stroke-width':2.2,'stroke-linejoin':'round'}));

    // τmax marker
    fig.appendChild(s('circle',{cx:PLT.ax+tmax*kt,cy:yscr(ymaxNA),r:3.5,fill:C.water}));
    fig.appendChild(txt(PLT.ax+tmax*kt+10,yscr(ymaxNA)+4,`τmax = ${fmt(tmax,2)} MPa`,
      {an:'start',fs:11.5,fw:600,fill:C.water}));
    if (Math.abs(ymaxNA)>sec.h*0.02)
      fig.appendChild(txt(PLT.ax+tNA*kt+10,yNA+16,`τ at NA = ${fmt(tNA,2)} MPa`,{an:'start',fs:11,halo:3}));
    fig.appendChild(txt(PLT.ax,SEC.yb+34,`V = ${fmt(state.V)} kN`,{fs:11,halo:0}));

    resultsEl.innerHTML =
      chip('τmax', `${fmt(tmax,2)} MPa`, sec.type==='ibeam'||sec.type==='tee'?'in the web':'at the NA') +
      chip('τ at NA', `${fmt(tNA,2)} MPa`) +
      chip('Average V/A', `${fmt(tAvg,2)} MPa`) +
      chip('τmax / (V/A)', `${fmt(tmax/Math.max(tAvg,1e-9),2)}`,
        state.type==='rect'?'1.50 for a rectangle':state.type==='circle'?'1.33 for a circle':'shape factor') +
      chip('I about NA', `${fmt(sec.I/1e6,1)} ×10⁶ mm⁴`);
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const opts=TYPES.map(([v,t])=>`<option value="${v}" ${state.type===v?'selected':''}>${t}</option>`).join('');
    const dims=DIMS[state.type].map(([k,lab])=>
      `<div class="mini"><label>${lab} (mm)</label><input type="number" step="1" min="4" value="${state.dims[k]}" data-dim="${k}"></div>`).join('');
    controls.innerHTML=`
      <h3>Section</h3>
      <div class="ctl"><select id="type">${opts}</select></div>
      <div class="grid2">${dims}</div>
      <h3>Loading</h3>
      <div class="ctl"><label>Shear force V (kN)</label>
        <div class="row">
          <input type="range" id="V-r" min="5" max="500" step="5" value="${state.V}">
          <input type="number" id="V-n" min="5" max="500" step="5" value="${state.V}">
        </div>
      </div>`;
  }

  controls.addEventListener('input',e=>{
    const t=e.target;
    if(t.id==='V-r'||t.id==='V-n'){
      state.V=clamp(parseFloat(t.value)||5,5,500);
      const o=document.getElementById(t.id==='V-r'?'V-n':'V-r'); if(o)o.value=state.V;
      render(); return;
    }
    if(t.dataset.dim){const v=parseFloat(t.value); if(isNaN(v))return;
      state.dims[t.dataset.dim]=v; render();}
  });
  controls.addEventListener('change',e=>{
    if(e.target.id==='type'){
      state.type=e.target.value;
      state.dims={...SectionEngine.DEFAULTS[state.type]};
      renderControls(); render();
    }
  });

  renderControls(); render();
})();
